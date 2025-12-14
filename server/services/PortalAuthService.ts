import { db } from "../db";
import { portalTokens, users } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";
import { logger } from "../logger";
import { v4 as uuidv4 } from "uuid";
import crypto from 'crypto';

/**
 * Service for handling Portal Authentication
 * Uses "Magic Links" (email -> token -> session)
 */
export class PortalAuthService {
    /**
     * Send a magic link to the user
     */
    async sendMagicLink(email: string): Promise<{ success: boolean; message: string }> {
        try {
            // 1. Generate secure token
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

            // 2. Store token
            await db.insert(portalTokens).values({
                email,
                token,
                expiresAt,
            });

            // 3. Send Email (Stub for now)
            // In production, use `emailService.sendMagicLink(email, token)`
            const magicLinkUrl = `${process.env.VITE_BASE_URL || 'http://localhost:5000'}/portal/auth/verify?token=${token}`;

            logger.info({
                event: "PORTAL_MAGIC_LINK_SENT",
                email,
                magicLinkUrl, // Logged for dev/testing
            }, "Magic link generated");

            return { success: true, message: "Magic link sent to your email." };
        } catch (error) {
            logger.error({ error, email }, "Failed to send magic link");
            throw new Error("Failed to generate magic link");
        }
    }

    /**
     * Verify a magic link token and return user email
     */
    async verifyMagicLink(token: string): Promise<{ email: string } | null> {
        try {
            // 1. Find valid token
            const validToken = await db.query.portalTokens.findFirst({
                where: and(
                    eq(portalTokens.token, token),
                    gt(portalTokens.expiresAt, new Date())
                ),
            });

            if (!validToken) {
                return null;
            }

            // 2. Mark as used (optional, or delete)
            // For now, we delete it to prevent reuse
            await db.delete(portalTokens).where(eq(portalTokens.id, validToken.id));

            return { email: validToken.email };
        } catch (error) {
            logger.error({ error, token: token.substring(0, 5) + "..." }, "Failed to verify magic link");
            return null;
        }
    }
}

export const portalAuthService = new PortalAuthService();
