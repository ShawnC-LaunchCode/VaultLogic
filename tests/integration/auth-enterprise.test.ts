import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import express, { type Express } from "express";
import { registerRoutes } from "../../server/routes";
import { nanoid } from "nanoid";

// Mock email service to capture tokens
const mockSendVerificationEmail = vi.fn();
const mockSendPasswordResetEmail = vi.fn();

vi.mock('../../server/services/emailService', () => ({
    sendVerificationEmail: (email: string, token: string) => mockSendVerificationEmail(email, token),
    sendPasswordResetEmail: (email: string, token: string) => mockSendPasswordResetEmail(email, token),
    sendEmail: vi.fn(),
}));

describe("Enterprise Auth Integration Tests", () => {
    let app: Express;
    let server: any;
    let baseURL: string;

    beforeAll(async () => {
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: false }));

        // IMPORTANT: Ensure we are using the real DB setup from setup.ts (which runs via vitest setup)
        // We do NOT mock repositories or db here, relying on integration test env.

        server = await registerRoutes(app);

        // Start server
        const port = await new Promise<number>((resolve) => {
            const testServer = server.listen(0, () => {
                const addr = testServer.address();
                resolve(typeof addr === 'object' && addr ? addr.port : 0);
            });
        });
        baseURL = `http://localhost:${port}`;
    });

    afterAll(async () => {
        if (server) await server.close();
    });

    describe("Full Auth Lifecycle", () => {
        const userEmail = `auth-test-${nanoid()}@example.com`;
        const userPassword = "SecurePassword123!";
        let verificationToken: string;
        let accessToken: string;
        let resetToken: string;

        it("1. Should register a new user and trigger verification email", async () => {
            const res = await request(baseURL)
                .post("/api/auth/register")
                .send({
                    email: userEmail,
                    password: userPassword,
                    firstName: "Enterprise",
                    lastName: "User"
                });

            expect(res.status).toBe(201);
            expect(mockSendVerificationEmail).toHaveBeenCalled();

            // Capture verification token from mock calls
            const calls = mockSendVerificationEmail.mock.calls;
            const lastCall = calls[calls.length - 1];
            expect(lastCall[0]).toBe(userEmail);
            verificationToken = lastCall[1];
            expect(verificationToken).toBeDefined();
        });

        it("2. Should verify email with token", async () => {
            const res = await request(baseURL)
                .post("/api/auth/verify-email")
                .send({ token: verificationToken });

            expect(res.status).toBe(200);
            expect(res.body.message).toContain("verified");
        });

        it("3. Should login and receive access token + refresh cookie", async () => {
            const res = await request(baseURL)
                .post("/api/auth/login")
                .send({ email: userEmail, password: userPassword });

            expect(res.status).toBe(200);
            expect(res.body.token).toBeDefined();
            accessToken = res.body.token;

            // Check for HttpOnly cookie (supertest handles cookies)
            const cookies = res.headers['set-cookie'] as unknown as string[];
            expect(cookies).toBeDefined();
            const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='));
            expect(refreshCookie).toBeDefined();
            expect(refreshCookie).toContain('HttpOnly');
        });

        it("4. Should refresh access token", async () => {
            // We need to send the cookie back
            const loginRes = await request(baseURL)
                .post("/api/auth/login")
                .send({ email: userEmail, password: userPassword });

            const cookies = loginRes.headers['set-cookie'];

            // Wait 1.1s to ensure JWT iat changes (seconds resolution)
            await new Promise(resolve => setTimeout(resolve, 1100));

            const res = await request(baseURL)
                .post("/api/auth/refresh-token")
                .set('Cookie', cookies);

            expect(res.status).toBe(200);
            expect(res.body.token).toBeDefined();
            expect(res.body.token).not.toBe(loginRes.body.token); // Should get new access token
        });

        it("5. Should initiate password reset", async () => {
            mockSendPasswordResetEmail.mockClear();

            const res = await request(baseURL)
                .post("/api/auth/forgot-password")
                .send({ email: userEmail });

            expect(res.status).toBe(200);

            const calls = mockSendPasswordResetEmail.mock.calls;
            const lastCall = calls[calls.length - 1];
            expect(lastCall[0]).toBe(userEmail);
            resetToken = lastCall[1];
            expect(resetToken).toBeDefined();
        });

        it("6. Should reset password with token", async () => {
            const newPassword = "NewSecurePassword456!";
            const res = await request(baseURL)
                .post("/api/auth/reset-password")
                .send({ token: resetToken, newPassword });

            expect(res.status).toBe(200);

            // Verify login with OLD password fails
            const failRes = await request(baseURL)
                .post("/api/auth/login")
                .send({ email: userEmail, password: userPassword });
            expect(failRes.status).toBe(401);

            // Verify login with NEW password succeeds
            const successRes = await request(baseURL)
                .post("/api/auth/login")
                .send({ email: userEmail, password: newPassword });
            expect(successRes.status).toBe(200);
        });

        it("7. Should logout and invalidate refresh token", async () => {
            // Login to get cookies
            const loginRes = await request(baseURL)
                .post("/api/auth/login")
                .send({ email: userEmail, password: "NewSecurePassword456!" });
            const cookies = loginRes.headers['set-cookie'];

            const res = await request(baseURL)
                .post("/api/auth/logout")
                .set('Cookie', cookies);

            expect(res.status).toBe(200);

            // Try refresh again - should fail
            const refreshRes = await request(baseURL)
                .post("/api/auth/refresh-token")
                .set('Cookie', cookies);

            expect(refreshRes.status).toBe(401);
        });
    });
});
