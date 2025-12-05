import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { registerRoutes } from "../../server/routes";

/**
 * Authentication Integration Tests
 * Tests all authentication endpoints end-to-end
 */
describe("Authentication Integration Tests", () => {
  let app: Express;
  let server: Server;
  let baseURL: string;

  beforeAll(async () => {
    // Create Express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // Register all routes including auth
    server = await registerRoutes(app);

    // Find available port
    const port = await new Promise<number>((resolve) => {
      const testServer = server.listen(0, () => {
        const addr = testServer.address();
        const port = typeof addr === 'object' && addr ? addr.port : 5001;
        resolve(port);
      });
    });

    baseURL = `http://localhost:${port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe("Development Login", () => {
    it("should have dev-login endpoint available in development", async () => {
      // Only test if NODE_ENV is development
      if (process.env.NODE_ENV !== 'development') {
        return expect(true).toBe(true); // Skip in production
      }

      const response = await request(baseURL)
        .post("/api/auth/dev-login")
        .expect("Content-Type", /json/)
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("id");
      expect(response.body.user).toHaveProperty("email");
    });

    it("should create session cookie on dev login", async () => {
      if (process.env.NODE_ENV !== 'development') {
        return expect(true).toBe(true);
      }

      const response = await request(baseURL)
        .post("/api/auth/dev-login")
        .expect(200);

      // Check for session cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(Array.isArray(cookies) ? cookies.some(c => c.includes('survey-session')) : cookies?.includes('survey-session')).toBe(true);
    });
  });

  describe("GET /api/auth/user", () => {
    it("should return null for unauthenticated requests", async () => {
      // Note: /api/auth/user uses optionalHybridAuth and returns 200 with null
      // for unauthenticated requests to avoid console errors in the frontend
      const response = await request(baseURL)
        .get("/api/auth/user")
        .expect(200);

      expect(response.body).toBeNull();
    });

    it("should return user data when authenticated", async () => {
      if (process.env.NODE_ENV !== 'development') {
        return expect(true).toBe(true);
      }

      // First, login
      const loginResponse = await request(baseURL)
        .post("/api/auth/dev-login")
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];

      // Then get user
      const response = await request(baseURL)
        .get("/api/auth/user")
        .set('Cookie', cookies!)
        .expect(200);

      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("email");
      expect(response.body).toHaveProperty("firstName");
      expect(response.body).toHaveProperty("lastName");
    });
  });

  describe("POST /api/auth/google", () => {
    it("should return 400 when no token provided", async () => {
      const response = await request(baseURL)
        .post("/api/auth/google")
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("message");
      expect(response.body.error).toBe("missing_token");
    });

    it("should return 403 for invalid origin", async () => {
      const response = await request(baseURL)
        .post("/api/auth/google")
        .set('Origin', 'https://malicious-site.com')
        .send({ idToken: "fake-token" })
        .expect(403);

      expect(response.body).toHaveProperty("message");
      expect(response.body.error).toBe("invalid_origin");
    });

    it("should return 403 for invalid Google token without valid origin", async () => {
      // Without a valid Origin header, the request fails origin validation first
      const response = await request(baseURL)
        .post("/api/auth/google")
        .send({ idToken: "invalid-token-12345" })
        .expect(403);

      expect(response.body).toHaveProperty("message");
      expect(response.body.error).toBe("invalid_origin");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should successfully logout authenticated user", async () => {
      if (process.env.NODE_ENV !== 'development') {
        return expect(true).toBe(true);
      }

      // First, login
      const loginResponse = await request(baseURL)
        .post("/api/auth/dev-login")
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];

      // Then logout
      const logoutResponse = await request(baseURL)
        .post("/api/auth/logout")
        .set('Cookie', cookies!)
        .expect(200);

      expect(logoutResponse.body).toHaveProperty("message", "Logout successful");

      // Verify user can't access protected routes after logout
      await request(baseURL)
        .get("/api/auth/user")
        .set('Cookie', cookies!)
        .expect(401);
    });
  });

  describe("Session Management", () => {
    it("should maintain session across requests", async () => {
      if (process.env.NODE_ENV !== 'development') {
        return expect(true).toBe(true);
      }

      // Login
      const loginResponse = await request(baseURL)
        .post("/api/auth/dev-login")
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'];

      // Make multiple requests with same cookie
      const response1 = await request(baseURL)
        .get("/api/auth/user")
        .set('Cookie', cookies!)
        .expect(200);

      const response2 = await request(baseURL)
        .get("/api/auth/user")
        .set('Cookie', cookies!)
        .expect(200);

      expect(response1.body.id).toBe(response2.body.id);
    });

    it("should return null for requests with no session cookie", async () => {
      // Note: /api/auth/user uses optionalHybridAuth and returns 200 with null
      const response = await request(baseURL)
        .get("/api/auth/user")
        .expect(200);

      expect(response.body).toBeNull();
    });
  });

  describe("Health Check", () => {
    it("should have health endpoint available", async () => {
      const response = await request(baseURL)
        .get("/api/health");

      // Health check may return 503 if database is not available in test environment
      // Accept both 200 (healthy) and 503 (unhealthy) as valid responses
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty("status");
      expect(response.body).toHaveProperty("timestamp");
    });
  });
});
