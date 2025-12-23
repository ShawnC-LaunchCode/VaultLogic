import type { Express, Request, Response } from "express";
import { userRepository, userCredentialsRepository } from "../repositories";
import { createLogger } from "../logger";
import {
  createToken,
  hashPassword,
  comparePassword,
  validateEmail,
  validatePasswordStrength
} from "../services/auth";
import { hybridAuth, optionalHybridAuth, type AuthRequest } from "../middleware/auth";
import { getCsrfTokenHandler } from "../middleware/csrf";
import { nanoid } from "nanoid";
import { authSecurity } from "../services/auth-security";
import { serialize } from "cookie";

const logger = createLogger({ module: 'auth-routes' });

/**
 * Register authentication-related routes
 * Supports both JWT-based auth (email/password) and session-based auth (Google OAuth)
 */
export function registerAuthRoutes(app: Express): void {
  // =====================================================================
  // EMAIL/PASSWORD AUTHENTICATION (JWT)
  // =====================================================================

  /**
   * POST /api/auth/register
   * Register a new user with email and password
   * Returns a JWT token on success
   */
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName, tenantId, tenantRole } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({
          message: 'Email and password are required',
          error: 'missing_fields',
        });
      }

      // Validate email format
      if (!validateEmail(email)) {
        return res.status(400).json({
          message: 'Invalid email format',
          error: 'invalid_email',
        });
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          message: passwordValidation.message,
          error: 'weak_password',
        });
      }

      // Check if user already exists
      const existingUser = await userRepository.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          message: 'User with this email already exists',
          error: 'user_exists',
        });
      }

      // Create user
      const userId = nanoid();
      const user = await userRepository.create({
        id: userId,
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        fullName: firstName && lastName ? `${firstName} ${lastName}` : null,
        profileImageUrl: null,
        tenantId: tenantId || null,
        role: 'creator',
        tenantRole: tenantRole || null,
        authProvider: 'local',
        defaultMode: 'easy',
      });

      // Hash password and store credentials
      const passwordHash = await hashPassword(password);
      await userCredentialsRepository.createCredentials(userId, passwordHash);

      // Enterprise: Generate Email Verification Token
      // We pass email to the service so it can send the email
      const verificationToken = await authSecurity.generateEmailVerificationToken(userId, email);
      logger.info({ userId, email }, `Verification token generated (sent to email)`);

      // Generate JWT token (Access Token)
      const token = createToken(user);

      // Enterprise: Generate Refresh Token
      const refreshToken = await authSecurity.createRefreshToken(userId, {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Set Refresh Token Cookie
      res.setHeader('Set-Cookie', serialize('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      }));

      logger.info({ userId: user.id, email: user.email }, 'User registered successfully');

      // Initialize session for compatibility with legacy auth
      req.session.regenerate(async (err) => {
        if (err) {
          logger.error({ err }, 'Session regeneration failed during register');
          return res.status(500).json({ message: 'Session initialization failed' });
        }

        req.session.user = {
          id: user.id,
          email: user.email,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          fullName: user.fullName || `${user.firstName} ${user.lastName}` || undefined,
          profileImageUrl: user.profileImageUrl || undefined,

          tenantId: user.tenantId || undefined,
          tenantRole: (user.tenantRole as any) || undefined,
          role: (user.role as any) || undefined,

          emailVerified: user.emailVerified,
          authProvider: 'local',
        };

        req.session.save((saveErr) => {
          if (saveErr) {
            logger.error({ err: saveErr }, 'Session save failed during register');
            return res.status(500).json({ message: 'Session save failed' });
          }
          res.status(201).json({
            message: 'Registration successful. Please verify your email.',
            token,
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              tenantId: user.tenantId,
              role: user.tenantRole,
              emailVerified: user.emailVerified
            },
          });
        });
      });
    } catch (error) {
      logger.error({ error }, 'Registration failed');
      res.status(500).json({
        message: 'Registration failed',
        error: 'internal_error',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/auth/login
   * Login with email and password
   * Returns a JWT token on success
   */
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({
          message: 'Email and password are required',
          error: 'missing_fields',
        });
      }

      // Find user by email
      const user = await userRepository.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          message: 'Invalid email or password',
          error: 'invalid_credentials',
        });
      }

      // Check if user uses local auth
      if (user.authProvider !== 'local') {
        return res.status(400).json({
          message: `This account uses ${user.authProvider} authentication. Please sign in with ${user.authProvider}.`,
          error: 'wrong_auth_provider',
        });
      }

      // Get user credentials
      const credentials = await userCredentialsRepository.findByUserId(user.id);
      if (!credentials) {
        return res.status(401).json({
          message: 'Invalid email or password',
          error: 'invalid_credentials',
        });
      }

      // Verify password
      const isPasswordValid = await comparePassword(password, credentials.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({
          message: 'Invalid email or password',
          error: 'invalid_credentials',
        });
      }

      // Generate JWT token (Access Token)
      const token = createToken(user);

      // Enterprise: Generate Refresh Token
      const refreshToken = await authSecurity.createRefreshToken(user.id, {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Set Refresh Token Cookie
      res.setHeader('Set-Cookie', serialize('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      }));

      logger.info({ userId: user.id, email: user.email }, 'User logged in successfully');

      // Initialize session for compatibility with legacy auth
      req.session.regenerate(async (err) => {
        if (err) {
          logger.error({ err }, 'Session regeneration failed during login');
          return res.status(500).json({ message: 'Session initialization failed' });
        }

        req.session.user = {
          id: user.id,
          email: user.email,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          fullName: user.fullName || `${user.firstName} ${user.lastName}` || undefined,
          profileImageUrl: user.profileImageUrl || undefined,

          tenantId: user.tenantId || undefined,
          tenantRole: (user.tenantRole as any) || undefined,
          role: (user.role as any) || undefined,

          emailVerified: user.emailVerified,
          authProvider: 'local',
        };

        req.session.save((saveErr) => {
          if (saveErr) {
            logger.error({ err: saveErr }, 'Session save failed during login');
            return res.status(500).json({ message: 'Session save failed' });
          }
          res.json({
            message: 'Login successful',
            token,
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              tenantId: user.tenantId,
              role: user.tenantRole,
              emailVerified: user.emailVerified
            },
          });
        });
      });
    } catch (error) {
      logger.error({ error }, 'Login failed');
      res.status(500).json({
        message: 'Login failed',
        error: 'internal_error',
      });
    }
  });

  /**
   * POST /api/auth/refresh-token
   * Exchange a valid refresh token for a new access token
   */
  app.post('/api/auth/refresh-token', async (req: Request, res: Response) => {
    try {
      // Parse cookies manually or use a middleware if available (express-session doesn't parse custom cookies by default without cookie-parser)
      // For simplicity, we'll parsing raw headers if cookie-parser isn't guaranteed
      const cookieHeader = req.headers.cookie;
      let refreshToken = "";

      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [name, value] = cookie.trim().split('=');
          acc[name] = value;
          return acc;
        }, {} as Record<string, string>);
        refreshToken = cookies['refresh_token'];
      }

      if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token missing' });
      }

      const result = await authSecurity.rotateRefreshToken(refreshToken);

      if (!result) {
        // Clear invalid cookie
        res.setHeader('Set-Cookie', serialize('refresh_token', '', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/api/auth',
          maxAge: 0
        }));
        return res.status(401).json({ message: 'Invalid or expired refresh token' });
      }

      const user = await userRepository.findById(result.userId);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Generate new Access Token
      const newAccessToken = createToken(user);

      // Set new Refresh Token Cookie (Rotation)
      res.setHeader('Set-Cookie', serialize('refresh_token', result.newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth',
        maxAge: 60 * 60 * 24 * 30
      }));

      res.json({
        token: newAccessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.tenantRole
        }
      });

    } catch (error) {
      logger.error({ error }, 'Refresh token failed');
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * POST /api/auth/forgot-password
   */
  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    try {
      const token = await authSecurity.generatePasswordResetToken(email);
      // Always return success to prevent email enumeration
      if (token) {
        logger.info({ email, token }, "Reset token generated (STUB)");
      }
      res.json({ message: "If an account exists, a reset link has been sent." });
    } catch (error) {
      logger.error({ error }, "Forgot password error");
      res.status(500).json({ message: "Internal error" });
    }
  });

  /**
   * POST /api/auth/reset-password
   */
  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ message: "Token and password required" });

    try {
      const validation = validatePasswordStrength(newPassword);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }

      const userId = await authSecurity.verifyPasswordResetToken(token);
      if (!userId) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }

      const passwordHash = await hashPassword(newPassword);

      // Update password
      await userCredentialsRepository.updatePassword(userId, passwordHash);

      // Revoke all sessions (refresh tokens) for security
      await authSecurity.revokeAllUserTokens(userId);

      // Mark token used
      await authSecurity.consumePasswordResetToken(token);

      res.json({ message: "Password updated successfully. Please login." });
    } catch (error) {
      logger.error({ error }, "Reset password error");
      res.status(500).json({ message: "Internal error" });
    }
  });

  /**
   * POST /api/auth/verify-email
   */
  app.post('/api/auth/verify-email', async (req: Request, res: Response) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token required" });

    try {
      const success = await authSecurity.verifyEmail(token);
      if (!success) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
      res.json({ message: "Email verified successfully" });
    } catch (error) {
      logger.error({ error }, "Email verification error");
      res.status(500).json({ message: "Internal error" });
    }
  });

  /**
   * GET /api/auth/me
   * Get current authenticated user
   * Supports both JWT and session-based authentication
   */
  app.get('/api/auth/me', hybridAuth, async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.userId;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await userRepository.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        profileImageUrl: user.profileImageUrl,
        tenantId: user.tenantId,
        role: user.tenantRole,
        authProvider: user.authProvider,
        defaultMode: user.defaultMode,
      });
    } catch (error) {
      logger.error({ error }, "Error fetching current user");
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  /**
   * POST /api/auth/logout
   * Logout (currently a no-op for JWT, but included for API consistency)
   * For session-based auth, this would clear the session
   */
  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    // 1. Revoke Refresh Token (if present)
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [name, value] = cookie.trim().split('=');
        acc[name] = value;
        return acc;
      }, {} as Record<string, string>);
      const refreshToken = cookies['refresh_token'];
      if (refreshToken) {
        logger.info({ tokenPrefix: refreshToken.substring(0, 10) }, 'Revoking refresh token on logout');
        await authSecurity.revokeRefreshToken(refreshToken);
      } else {
        logger.warn('No refresh_token found in cookies during logout');
      }
    } else {
      logger.warn('No cookie header found during logout');
    }

    // 2. Clear Refresh Cookie
    res.setHeader('Set-Cookie', serialize('refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 0
    }));

    // 3. Destroy Session (for Google/Legacy)
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          logger.error({ err }, 'Session destruction failed');
          return res.status(500).json({
            message: 'Logout failed',
            error: 'session_destruction_failed'
          });
        }
        res.clearCookie('survey-session'); // Clear the session cookie
        res.json({ message: 'Logout successful' });
      });
    } else {
      res.json({ message: 'Logout successful' });
    }
  });

  // =====================================================================
  // GOOGLE OAUTH AUTHENTICATION (Session-based)
  // Note: Google OAuth routes are registered in googleAuth.ts via setupAuth()
  // =====================================================================

  /**
   * GET /api/auth/google
   * Redirects to Google OAuth (handled in googleAuth.ts)
   */

  /**
   * GET /api/auth/google/callback
   * Google OAuth callback (handled in googleAuth.ts)
   */

  // =====================================================================
  // DEVELOPMENT AUTHENTICATION HELPER
  // =====================================================================

  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    const devLoginHandler = async (req: Request, res: Response) => {
      try {
        // Create a test user for development
        const testUser = {
          id: "dev-user-123",
          email: "dev@example.com",
          firstName: "Dev",
          lastName: "User",
          profileImageUrl: null,
          tenantId: undefined, // Add missing fields
          tenantRole: undefined,
          role: undefined,
        };

        // Upsert the test user
        // Cast to any because upsert expects more fields than we have here, or assumes partial is fine but TS complains
        await userRepository.upsert(testUser as any);

        // Simulate authentication by setting up the session (Google auth format)
        const mockAuthUser: AppUser = {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName || undefined,
          lastName: testUser.lastName || undefined,
          fullName: `${testUser.firstName} ${testUser.lastName}`,
          profileImageUrl: undefined,

          tenantId: testUser.tenantId,
          tenantRole: testUser.tenantRole as any,
          role: testUser.role as any,

          emailVerified: true,
          authProvider: 'local',
        };

        // Session fixation protection: regenerate session before login (same as Google auth)
        req.session.regenerate((err: unknown) => {
          if (err) {
            logger.error({ error: err }, 'Dev login session regeneration error');
            return res.status(500).json({ message: "Session creation failed" });
          }

          // Set up the session with new session ID
          req.session.user = mockAuthUser;

          // Save session before redirecting to avoid race condition
          req.session.save((saveErr: unknown) => {
            if (saveErr) {
              logger.error({ error: saveErr }, 'Dev login session save error');
              return res.status(500).json({ message: "Session save failed" });
            }

            // For GET requests, redirect to dashboard; for POST, return JSON
            if (req.method === 'GET') {
              res.redirect('/dashboard');
            } else {
              res.json({ message: "Development authentication successful", user: testUser });
            }
          });
        });
      } catch (error) {
        logger.error({ error }, "Dev login error");
        res.status(500).json({ message: "Failed to authenticate in dev mode" });
      }
    };

    // Support both GET and POST for dev login
    app.get('/api/auth/dev-login', devLoginHandler);
    app.post('/api/auth/dev-login', devLoginHandler);
  }

  // Legacy route for backward compatibility (uses session-based auth)
  app.get('/api/auth/user', optionalHybridAuth, async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.userId;

      // Return null instead of 401 to avoid console errors
      if (!userId) {
        return res.json(null);
      }

      const user = await userRepository.findById(userId);
      if (!user) {
        // If we have a userId but can't find the user, that's a valid 404 or null
        return res.json(null);
      }

      res.json(user);
    } catch (error) {
      logger.error({ error }, "Error fetching user");
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // =====================================================================
  // CSRF TOKEN ENDPOINT
  // =====================================================================

  /**
   * GET /api/auth/csrf-token
   * Get a CSRF token for the current session
   * Required for all state-changing operations (POST, PUT, DELETE, PATCH)
   * Client should include this token in X-CSRF-Token header
   */
  app.get('/api/auth/csrf-token', getCsrfTokenHandler);

  // =====================================================================
  // JWT TOKEN ENDPOINT (for WebSocket/API authentication)
  // =====================================================================

  /**
   * GET /api/auth/token
   * Get a JWT token for the current authenticated session
   * Useful for WebSocket connections and API authentication
   * Requires existing session-based authentication (Google OAuth)
   */
  app.get('/api/auth/token', async (req: Request, res: Response) => {
    try {
      // Check for session-based authentication
      // Cast to any to handle both possible session structures during migration
      const sessionUser = (req.session?.user || req.user) as any;

      const userId = sessionUser?.id || sessionUser?.claims?.sub;

      if (!sessionUser || !userId) {
        return res.status(401).json({
          message: "Authentication required",
          code: "unauthorized"
        });
      }
      const user = await userRepository.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: 'User not found',
          error: 'user_not_found',
        });
      }

      // Generate JWT token
      const token = createToken(user);

      logger.debug({ userId: user.id }, 'JWT token generated for session user');

      res.json({
        token,
        expiresIn: process.env.JWT_EXPIRY || '7d',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to generate JWT token');
      res.status(500).json({
        message: 'Failed to generate token',
        error: 'internal_error',
      });
    }
  });
}
