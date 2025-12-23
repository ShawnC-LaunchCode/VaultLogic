
import { db } from "../db";
import {
    refreshTokens,
    passwordResetTokens,
    emailVerificationTokens,
    users
} from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";
import { logger } from "../logger";
import { v4 as uuidv4 } from "uuid";
import crypto from 'crypto';
import { hashToken, verifyToken } from "../utils/encryption";
import { createLogger } from "../logger";
import { sendPasswordResetEmail, sendVerificationEmail } from "./emailService";

const log = createLogger({ module: 'auth-security' });

export class AuthSecurityService {

    // =================================================================
    // REFRESH TOKENS
    // =================================================================

    /**
     * Create a new refresh token for a user
     * Returns the plaintext token (to be sent to client)
     */
    async createRefreshToken(userId: string, metadata: any = {}): Promise<string> {
        // Generate secure random token
        const plainToken = crypto.randomBytes(40).toString('hex');
        const tokenHash = hashToken(plainToken);

        // Expires in 30 days
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await db.insert(refreshTokens).values({
            userId,
            token: tokenHash,
            expiresAt,
            metadata,
            revoked: false
        });

        return plainToken;
    }

    /**
     * Verify and rotate a refresh token
     * Returns new access token info if valid, null otherwise
     * IMPL NOTE: Implements "RefreshToken Rotation" - using a token invalidates it and issues a new one
     */
    async rotateRefreshToken(plainToken: string): Promise<{ userId: string, newRefreshToken: string } | null> {
        const tokenHash = hashToken(plainToken);

        // Find the token
        const storedToken = await db.query.refreshTokens.findFirst({
            where: and(
                eq(refreshTokens.token, tokenHash),
                eq(refreshTokens.revoked, false),
                gt(refreshTokens.expiresAt, new Date())
            )
        });

        if (!storedToken) {
            // Security: Could be a reuse attempt. 
            // In a strict implementation, we might revoke all user tokens here if we detect reuse of an old token.
            log.warn({ tokenHash }, 'Invalid or expired refresh token used');
            return null;
        }

        // Revoke the used token (Rotation)
        await db.update(refreshTokens)
            .set({ revoked: true })
            .where(eq(refreshTokens.id, storedToken.id));

        // Issue a new refresh token
        const newRefreshToken = await this.createRefreshToken(storedToken.userId, storedToken.metadata);

        return {
            userId: storedToken.userId,
            newRefreshToken
        };
    }

    /**
     * Revoke a specific refresh token (e.g. logout)
     */
    async revokeRefreshToken(plainToken: string): Promise<void> {
        const tokenHash = hashToken(plainToken);
        await db.update(refreshTokens)
            .set({ revoked: true })
            .where(eq(refreshTokens.token, tokenHash));
    }

    /**
     * Revoke all tokens for a user (e.g. password change, security breach)
     */
    async revokeAllUserTokens(userId: string): Promise<void> {
        await db.update(refreshTokens)
            .set({ revoked: true })
            .where(eq(refreshTokens.userId, userId));
    }

    /**
     * Non-destructive refresh token validation
     * Returns userId if valid, null otherwise
     */
    async validateRefreshToken(plainToken: string): Promise<string | null> {
        const tokenHash = hashToken(plainToken);

        const storedToken = await db.query.refreshTokens.findFirst({
            where: and(
                eq(refreshTokens.token, tokenHash),
                eq(refreshTokens.revoked, false),
                gt(refreshTokens.expiresAt, new Date())
            )
        });

        return storedToken ? storedToken.userId : null;
    }

    // =================================================================
    // PASSWORD RESET
    // =================================================================

    /**
     * Generate password reset token
     */
    async generatePasswordResetToken(email: string): Promise<string | null> {
        const user = await db.query.users.findFirst({
            where: eq(users.email, email)
        });

        if (!user) return null;

        const plainToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(plainToken);
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

        // Invalidate old tokens for this user
        await db.update(passwordResetTokens)
            .set({ used: true })
            .where(eq(passwordResetTokens.userId, user.id));

        await db.insert(passwordResetTokens).values({
            userId: user.id,
            token: tokenHash,
            expiresAt,
            used: false
        });

        try {
            await sendPasswordResetEmail(email, plainToken);
            log.info({ email }, 'Password reset email sent');
        } catch (error) {
            log.error({ error, email }, 'Failed to send password reset email');
            // We still return token so flow continues (or we could throw)
            // But for security, maybe we should error if email fails?
            // "If an account exists..." message in UI masks this.
            // Let's log and proceed.
        }

        return plainToken;
    }

    /**
     * Verify password reset token
     */
    async verifyPasswordResetToken(plainToken: string): Promise<string | null> {
        const tokenHash = hashToken(plainToken);

        const storedToken = await db.query.passwordResetTokens.findFirst({
            where: and(
                eq(passwordResetTokens.token, tokenHash),
                eq(passwordResetTokens.used, false),
                gt(passwordResetTokens.expiresAt, new Date())
            )
        });

        if (!storedToken) return null;
        return storedToken.userId;
    }

    /**
     * Mark reset token as used
     */
    async consumePasswordResetToken(plainToken: string): Promise<void> {
        const tokenHash = hashToken(plainToken);
        await db.update(passwordResetTokens)
            .set({ used: true })
            .where(eq(passwordResetTokens.token, tokenHash));
    }

    // =================================================================
    // EMAIL VERIFICATION
    // =================================================================

    /**
     * Generate verification token
     */
    async generateEmailVerificationToken(userId: string, email: string): Promise<string> {
        const plainToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(plainToken);
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

        await db.insert(emailVerificationTokens).values({
            userId,
            token: tokenHash,
            expiresAt
        });

        try {
            await sendVerificationEmail(email, plainToken);
            log.info({ userId }, 'Verification email sent');
        } catch (error) {
            log.error({ error, userId }, 'Failed to send verification email');
        }

        return plainToken;
    }

    /**
     * Verify email
     */
    async verifyEmail(plainToken: string): Promise<boolean> {
        const tokenHash = hashToken(plainToken);

        const storedToken = await db.query.emailVerificationTokens.findFirst({
            where: and(
                eq(emailVerificationTokens.token, tokenHash),
                gt(emailVerificationTokens.expiresAt, new Date())
            )
        });

        if (!storedToken) return false;

        // Mark user as verified
        await db.update(users)
            .set({ emailVerified: true })
            .where(eq(users.id, storedToken.userId));

        // Cleanup used token (optional, or rely on expiry/cleanup job)
        await db.delete(emailVerificationTokens)
            .where(eq(emailVerificationTokens.id, storedToken.id));

        return true;
    }
}

export const authSecurity = new AuthSecurityService();
