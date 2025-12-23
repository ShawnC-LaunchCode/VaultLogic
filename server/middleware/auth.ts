import type { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader, looksLikeJwt, type JWTPayload } from '../services/auth';
import { createLogger } from '../logger';
import { userRepository } from '../repositories';
import type { AppUser } from '../types';

const logger = createLogger({ module: 'auth-middleware' });

/**
 * Extended Express Request with user and tenant information
 */
export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  tenantId?: string;
  userRole?: 'owner' | 'builder' | 'runner' | 'viewer' | null;
  jwtPayload?: JWTPayload;
}

/**
 * JWT Authentication Middleware
 * Verifies JWT token from Authorization header and attaches user info to request
 *
 * This middleware is separate from the session-based Google OAuth authentication.
 * Use this for API endpoints that need JWT-based authentication.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      logger.warn({ path: req.path }, 'No authorization token provided');
      res.status(401).json({
        message: 'Authentication required',
        error: 'missing_token',
      });
      return;
    }

    // Verify token
    const payload = verifyToken(token);

    // Attach user info to request
    const authReq = req as AuthRequest;
    authReq.userId = payload.userId;
    authReq.userEmail = payload.email;
    authReq.tenantId = payload.tenantId || undefined;
    authReq.userRole = payload.role;
    authReq.jwtPayload = payload;

    // If tenantId is missing in token (e.g. newly registered user who just created a tenant),
    // try to fetch it from the database to avoid stale token issues
    if (!authReq.tenantId && authReq.userId) {
      try {
        const user = await userRepository.findById(authReq.userId);
        if (user?.tenantId) {
          authReq.tenantId = user.tenantId;
          authReq.userRole = user.tenantRole; // Also update role
          logger.debug({ userId: authReq.userId, tenantId: authReq.tenantId }, 'Refreshed tenantId from database for JWT user');
        }
      } catch (dbError) {
        logger.warn({ error: dbError, userId: authReq.userId }, 'Failed to refresh tenantId from database');
      }
    }

    logger.debug({ userId: payload.userId, path: req.path }, 'Authentication successful');
    next();
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : String(error), path: req.path }, 'Authentication failed');

    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    const statusCode = errorMessage === 'Token expired' ? 401 : 401;

    res.status(statusCode).json({
      message: errorMessage,
      error: errorMessage === 'Token expired' ? 'token_expired' : 'invalid_token',
    });
  }
}

/**
 * Optional JWT Authentication Middleware
 * Attaches user info if token is present, but doesn't reject if missing
 * Useful for endpoints that have different behavior for authenticated vs anonymous users
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      // No token provided, continue without authentication
      next();
      return;
    }

    // Verify token
    const payload = verifyToken(token);

    // Attach user info to request
    const authReq = req as AuthRequest;
    authReq.userId = payload.userId;
    authReq.userEmail = payload.email;
    authReq.tenantId = payload.tenantId || undefined;
    authReq.userRole = payload.role;
    authReq.jwtPayload = payload;

    logger.debug({ userId: payload.userId, path: req.path }, 'Optional authentication successful');
    next();
  } catch (error) {
    // Token is invalid, but since this is optional auth, we just continue without authentication
    logger.debug({ error: error instanceof Error ? error.message : String(error), path: req.path }, 'Optional authentication failed, continuing without auth');
    next();
  }
}

/**
 * Hybrid Authentication Middleware
 * Supports both JWT tokens and session-based authentication
 * Checks JWT first, then falls back to session
 */
export async function hybridAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Try JWT authentication first
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    // Only attempt JWT verification if the token looks like a JWT
    // This avoids noisy warnings when run tokens (UUIDs) are passed
    if (token && looksLikeJwt(token)) {
      try {
        const payload = verifyToken(token);
        const authReq = req as AuthRequest;
        authReq.userId = payload.userId;
        authReq.userEmail = payload.email;
        authReq.tenantId = payload.tenantId || undefined;
        authReq.userRole = payload.role;
        authReq.jwtPayload = payload;

        // If tenantId is missing in token (e.g. newly registered user who just created a tenant),
        // try to fetch it from the database to avoid stale token issues
        if (!authReq.tenantId && authReq.userId) {
          try {
            const user = await userRepository.findById(authReq.userId);
            if (user?.tenantId) {
              authReq.tenantId = user.tenantId;
              authReq.userRole = user.tenantRole; // Also update role
              logger.debug({ userId: authReq.userId, tenantId: authReq.tenantId }, 'Refreshed tenantId from database for JWT user (hybrid)');
            }
          } catch (dbError) {
            logger.warn({ error: dbError, userId: authReq.userId }, 'Failed to refresh tenantId from database (hybrid)');
          }
        }

        logger.debug({ userId: payload.userId, path: req.path }, 'JWT authentication successful');
        next();
        return;
      } catch (error) {
        // JWT failed, will try session next
        logger.debug('JWT authentication failed, trying session');
      }
    } else if (token) {
      // Token exists but doesn't look like JWT (probably a run token)
      logger.debug({ path: req.path }, 'Non-JWT token provided, skipping JWT auth');
    }

    // Fallback to session-based authentication
    // Supports both new AppUser structure AND legacy Google structure
    const sessionUser = req.session?.user as any; // Cast to any to handle both types temporarily

    // Check for standard AppUser (new standard)
    if (sessionUser?.id) {
      const authReq = req as AuthRequest;
      authReq.userId = sessionUser.id;
      authReq.userEmail = sessionUser.email;
      authReq.tenantId = sessionUser.tenantId;
      authReq.userRole = sessionUser.tenantRole;

      logger.debug({ userId: sessionUser.id, path: req.path }, 'Session authentication successful (Standard AppUser)');
      next();
      return;
    }

    // Check for Legacy Google structure (claims.sub)
    if (sessionUser?.claims?.sub) {
      const authReq = req as AuthRequest;
      authReq.userId = sessionUser.claims.sub;
      authReq.userEmail = sessionUser.claims.email;

      // Fetch user from database to get tenant info (Legacy behavior)
      try {
        const user = await userRepository.findById(sessionUser.claims.sub);
        if (user) {
          authReq.tenantId = user.tenantId || undefined;
          authReq.userRole = user.tenantRole;
        }
      } catch (error) {
        logger.warn({ error, userId: sessionUser.claims.sub }, 'Failed to fetch user details');
      }

      logger.debug({ userId: sessionUser.claims.sub, path: req.path }, 'Session authentication successful (Legacy Claims)');
      next();
      return;
    }

    // No valid authentication found
    logger.warn({ path: req.path }, 'No valid authentication found');
    res.status(401).json({
      message: 'Authentication required',
      error: 'unauthorized',
    });
  } catch (error) {
    logger.error({ error, path: req.path }, 'Hybrid authentication error');
    res.status(500).json({
      message: 'Authentication error',
      error: 'internal_error',
    });
  }
}

/**
 * Optional Hybrid Authentication Middleware
 * Attempts to authenticate via JWT or session, but continues even if it fails.
 * Does NOT return 401.
 */
export async function optionalHybridAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Try JWT authentication first
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (token && looksLikeJwt(token)) {
      try {
        const payload = verifyToken(token);
        const authReq = req as AuthRequest;
        authReq.userId = payload.userId;
        authReq.userEmail = payload.email;
        authReq.tenantId = payload.tenantId || undefined;
        authReq.userRole = payload.role;
        authReq.jwtPayload = payload;

        if (!authReq.tenantId && authReq.userId) {
          try {
            const user = await userRepository.findById(authReq.userId);
            if (user?.tenantId) {
              authReq.tenantId = user.tenantId;
              authReq.userRole = user.tenantRole;
            }
          } catch (dbError) {
            // Ignore db error for optional auth
          }
        }

        next();
        return;
      } catch (error) {
        // JWT failed, try session
      }
    }

    // Fallback to session-based authentication
    let sessionUser = req.session?.user as any;

    // Phase 2: Session Rehydration (If session is missing but Refresh Token exists)
    if (!sessionUser) {
      // Check for refresh token cookie (HttpOnly)
      const cookies = req.headers.cookie ? require('cookie').parse(req.headers.cookie) : {};
      const refreshToken = cookies.refresh_token;

      if (refreshToken) {
        try {
          // Dynamic imports to avoid circular dependencies
          const { authSecurity } = await import('../services/auth-security');
          const { userRepository } = await import('../repositories');

          const userId = await authSecurity.validateRefreshToken(refreshToken);
          if (userId) {
            const user = await userRepository.findById(userId);
            if (user) {
              // Rehydrate session
              const appUser: AppUser = {
                id: user.id,
                email: user.email,
                firstName: user.firstName || undefined,
                lastName: user.lastName || undefined,
                fullName: user.fullName || `${user.firstName} ${user.lastName}`,
                profileImageUrl: user.profileImageUrl || undefined,
                tenantId: user.tenantId || undefined,
                tenantRole: (user.tenantRole as any) || undefined,
                role: (user.role as any) || undefined,
                emailVerified: user.emailVerified,
                authProvider: 'local'
              };

              // Modifying request session directly
              if (req.session) {
                req.session.user = appUser;
                // Note: We don't save to store here to avoid async blocking, 
                // just in-memory for this request. 
                // If you want it persistent, you'd need explicit save, but standard flow usually regenerates on login.
                // This is "Transient Session from Token"
              }
              sessionUser = appUser;
              logger.debug({ userId }, 'Session rehydrated from refresh token');
            }
          }
        } catch (err) {
          logger.warn({ err }, 'Failed to rehydrate session from refresh token');
        }
      }
    }

    // Standard AppUser
    if (sessionUser?.id) {
      const authReq = req as AuthRequest;
      authReq.userId = sessionUser.id;
      authReq.userEmail = sessionUser.email;
      authReq.tenantId = sessionUser.tenantId;
      authReq.userRole = sessionUser.tenantRole;

      next();
      return;
    }

    // Legacy Google Claims
    if (sessionUser?.claims?.sub) {
      const authReq = req as AuthRequest;
      authReq.userId = sessionUser.claims.sub;
      authReq.userEmail = sessionUser.claims.email;

      try {
        const user = await userRepository.findById(sessionUser.claims.sub);
        if (user) {
          authReq.tenantId = user.tenantId || undefined;
          authReq.userRole = user.tenantRole;
        }
      } catch (error) {
        // Ignore db error
      }

      next();
      return;
    }

    // No auth found - just continue without setting userId
    next();
  } catch (error) {
    // On error, just continue without auth
    next();
  }
}

/**
 * Get authenticated user ID from request
 * Works with both JWT and session-based authentication
 */
export function getAuthUserId(req: Request): string | undefined {
  const authReq = req as AuthRequest;

  // Check JWT authentication first
  if (authReq.userId) {
    return authReq.userId;
  }

  // Fallback to session authentication
  const sessionUser = req.session?.user as any;
  return sessionUser?.id || sessionUser?.claims?.sub;
}

/**
 * Get authenticated user's tenant ID from request
 */
export function getAuthUserTenantId(req: Request): string | undefined {
  const authReq = req as AuthRequest;
  return authReq.tenantId;
}

/**
 * Get authenticated user's role from request
 */
export function getAuthUserRole(req: Request): 'owner' | 'builder' | 'runner' | 'viewer' | null | undefined {
  const authReq = req as AuthRequest;
  return authReq.userRole;
}
