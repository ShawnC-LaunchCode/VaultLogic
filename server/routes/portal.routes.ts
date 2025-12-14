import { Router, Request, Response } from "express";
import { portalAuthService } from "../services/PortalAuthService";
import { portalService } from "../services/PortalService";
import { z } from "zod";
import { logger } from "../logger";

const router = Router();

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
 * POST /api/portal/auth/send
 * Send a magic link to the provided email
 */
router.post("/auth/send", async (req, res) => {
    try {
        const { email } = sendMagicLinkSchema.parse(req.body);
        const result = await portalAuthService.sendMagicLink(email);
        res.json(result);
    } catch (error) {
        logger.error({ error }, "Error sending magic link");
        res.status(400).json({ error: "Invalid email or service error" });
    }
});

/**
 * POST /api/portal/auth/verify
 * Verify a magic link token and set session
 */
router.post("/auth/verify", async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: "Token required" });

        const user = await portalAuthService.verifyMagicLink(token);
        if (!user) {
            return res.status(401).json({ error: "Invalid or expired token" });
        }

        // Set Session
        (req.session as any).portalEmail = user.email;

        // Check if there is creator session, do we keep it? 
        // Yes, they are separate. Portal access is distinct.

        res.json({ success: true, email: user.email });
    } catch (error) {
        logger.error({ error }, "Error verifying token");
        res.status(500).json({ error: "Verification failed" });
    }
});

/**
 * POST /api/portal/auth/logout
 */
router.post("/auth/logout", (req, res) => {
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
