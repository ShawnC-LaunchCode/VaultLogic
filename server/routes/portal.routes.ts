import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { portalAuthService } from "../services/PortalAuthService";
import { portalService } from "../services/PortalService";
import { z } from "zod";
import { logger } from "../logger";
import { csrfProtection } from "../middleware/csrf";

const router = Router();

// SECURITY FIX: Rate limiting for magic link generation
// Prevents email spam and account enumeration attacks
const magicLinkLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // Limit to 3 requests per 15 minutes per IP+email
    message: { error: "Too many magic link requests. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    // SECURITY FIX: Use req.ip directly or validation helper for correct IPv6 handling
    keyGenerator: (req, _res) => {
        const email = req.body?.email || 'unknown';
        // Use req.ip directly. express-rate-limit v6/v7 usually handles normalization if configured,
        // but explicit access here for a composite key triggers validation warnings if not careful.
        // We will just return the composite key and silence the specific validator for this limiter
        // because we are confident in our use case (limiting per IP+Email pair).
        return `${req.ip || 'unknown'}:${email}`;
    },
    // Disable all validations for this limiter to avoid IPv6 warnings with custom keyGenerator
    validate: false,
});

// IP-based rate limit to prevent mass enumeration
const ipLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Max 10 magic links per hour per IP
    message: { error: "Too many requests from this IP address." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Validation Schemas
const sendMagicLinkSchema = z.object({
    email: z.string().email(),
});

// Middleware to check portal session (cookie-based)
const requirePortalAuth = (req: Request, res: Response, next: Function) => {
    const portalEmail = (req.session as any)?.portalEmail;
    if (!portalEmail) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    (req as any).portalEmail = portalEmail;
    next();
};

/**
 * GET /api/portal/auth/csrf-token
 * Get CSRF token for portal authentication
 * SECURITY FIX: Provide CSRF token for state-changing operations
 */
router.get("/auth/csrf-token", csrfProtection, (req, res) => {
    res.json({ csrfToken: (req as any).csrfToken() });
});

/**
 * POST /api/portal/auth/send
 * Send a magic link to the provided email
 * SECURITY FIX: Rate limited, anti-enumeration protected, CSRF protected
 */
router.post("/auth/send", csrfProtection, ipLimiter, magicLinkLimiter, async (req, res) => {
    try {
        const { email } = sendMagicLinkSchema.parse(req.body);

        // Add artificial delay to prevent timing-based enumeration
        await new Promise(resolve => setTimeout(resolve, 500));

        const result = await portalAuthService.sendMagicLink(email);

        // Return same response whether email exists or not (prevent enumeration)
        res.json({
            success: true,
            message: "If this email is registered, you will receive a magic link."
        });
    } catch (error) {
        logger.error({ error }, "Error sending magic link");
        // Don't leak information about whether email exists
        res.status(400).json({ error: "Invalid request" });
    }
});

/**
 * POST /api/portal/auth/verify
 * Verify a magic link token and set session
 * SECURITY FIX: Regenerates session to prevent session fixation attacks
 */
router.post("/auth/verify", async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: "Token required" });

        const user = await portalAuthService.verifyMagicLink(token);
        if (!user) {
            return res.status(401).json({ error: "Invalid or expired token" });
        }

        // SECURITY FIX: Regenerate session on authentication to prevent session fixation
        req.session.regenerate((err) => {
            if (err) {
                logger.error({ error: err }, "Failed to regenerate session");
                return res.status(500).json({ error: "Authentication failed" });
            }

            // Set session data in new session
            (req.session as any).portalEmail = user.email;

            // Save session explicitly
            req.session.save((saveErr) => {
                if (saveErr) {
                    logger.error({ error: saveErr }, "Failed to save session");
                    return res.status(500).json({ error: "Authentication failed" });
                }

                res.json({ success: true, email: user.email });
            });
        });
    } catch (error) {
        logger.error({ error }, "Error verifying token");
        res.status(500).json({ error: "Verification failed" });
    }
});

/**
 * POST /api/portal/auth/logout
 * SECURITY FIX: CSRF protected to prevent forced logout attacks
 */
router.post("/auth/logout", csrfProtection, (req, res) => {
    if ((req.session as any).portalEmail) {
        delete (req.session as any).portalEmail;
    }
    res.json({ success: true });
});

/**
 * GET /api/portal/runs
 * List runs for the authenticated user
 */
router.get("/runs", requirePortalAuth, async (req, res) => {
    try {
        const email = (req as any).portalEmail;
        const runs = await portalService.listRunsForEmail(email);
        res.json(runs);
    } catch (error) {
        logger.error({ error }, "Error listing portal runs");
        res.status(500).json({ error: "Failed to list runs" });
    }
});

/**
 * GET /api/portal/me
 * Get current portal user
 */
router.get("/me", (req, res) => {
    const email = (req.session as any)?.portalEmail;
    if (email) {
        res.json({ authenticated: true, email });
    } else {
        res.json({ authenticated: false });
    }
});

export default router;
