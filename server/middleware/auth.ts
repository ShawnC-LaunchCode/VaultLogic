import type { Request, Response, NextFunction } from 'express';
import { authService, type JWTPayload } from '../services/AuthService';
import { parseCookies } from "../utils/cookies";
import { createLogger } from '../logger';
import { userRepository } from '../repositories';

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
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractTokenFromHeader(authHeader);

    if (!token) {
      logger.warn({ path: req.path }, 'No authorization token provided');
      res.status(401).json({ message: 'Authentication required', error: 'missing_token' });
      return;
    }

    const payload = authService.verifyToken(token);
    await attachUserToRequest(req, payload);
    next();
  } catch (error) {
    handleAuthError(error, req, res);
  }
}

/**
 * Optional JWT Authentication Middleware
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractTokenFromHeader(authHeader);

    if (!token) return next();

    const payload = authService.verifyToken(token);
    await attachUserToRequest(req, payload);
    next();
  } catch (error) {
    next();
  }
}

// =================================================================
// STRATEGIES
// =================================================================

/**
 * Strategy: JWT Bearer Token
 * Checks Authorization header for valid JWT
 */
async function jwtStrategy(req: Request): Promise<boolean> {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractTokenFromHeader(authHeader);

    if (token && authService.looksLikeJwt(token)) {
      const payload = authService.verifyToken(token);
      await attachUserToRequest(req, payload);
      return true;
    }
  } catch (error) {
    // Token valid but verification failed (expired/invalid)
    // We catch this so we can try the next strategy
  }
  return false;
}

/**
 * Strategy: Refresh Token Cookie
 * Checks cookie for valid RefreshToken (Safe Methods Only)
 */
async function cookieStrategy(req: Request): Promise<boolean> {
  // 1. Strict Method Check: Only allow cookie auth for safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (!safeMethods.includes(req.method)) return false;

  // 2. Precedence Check: If a Bearer header exists, ignore cookies (JWT wins)
  // This prevents ambiguity if a client sends both
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return false;

  try {
    const cookies = parseCookies(req.headers.cookie || '');
    const refreshToken = cookies['refresh_token'];

    if (refreshToken) {
      const userId = await authService.validateRefreshToken(refreshToken);
      if (userId) {
        const user = await userRepository.findById(userId);
        if (user) {
          const authReq = req as AuthRequest;
          authReq.userId = user.id;
          authReq.userEmail = user.email;
          authReq.tenantId = user.tenantId || undefined;
          authReq.userRole = user.tenantRole;
          logger.debug({ userId }, 'Authenticated via Refresh Token Cookie (Hybrid)');
          return true;
        }
      }
    }
  } catch (error) {
    // Cookie invalid or DB error
  }
  return false;
}

/**
 * Hybrid Authentication Middleware (Mutation-Strict)
 * Supports both JWT Bearer tokens and HTTP-Only Refresh Token cookies.
 */
export async function hybridAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1. Try JWT Strategy
    if (await jwtStrategy(req)) {
      next();
      return;
    }

    // 2. Try Cookie Strategy (Fallback)
    if (await cookieStrategy(req)) {
      next();
      return;
    }

    // 3. No valid auth found
    res.status(401).json({ message: 'Authentication required', error: 'unauthorized' });
  } catch (error) {
    logger.error({ error }, 'Hybrid auth error');
    res.status(500).json({ message: 'Authentication error', error: 'internal_error' });
  }
}

/**
 * Optional Hybrid Authentication Middleware
 * Tries both strategies but proceeds even if both fail (anonymous access).
 */
export async function optionalHybridAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (await jwtStrategy(req)) {
      next();
      return;
    }

    if (await cookieStrategy(req)) {
      next();
      return;
    }

    // Anonymous - just proceed
    next();
  } catch (e) {
    next();
  }
}

// =================================================================
// HELPERS
// =================================================================

async function attachUserToRequest(req: Request, payload: JWTPayload) {
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
    } catch (e) { /* ignore */ }
  }
}

function handleAuthError(error: unknown, req: Request, res: Response) {
  const message = error instanceof Error ? error.message : 'Authentication failed';
  const code = message === 'Token expired' ? 'token_expired' : 'invalid_token';
  res.status(401).json({ message, error: code });
}



export function getAuthUserId(req: Request): string | undefined {
  return (req as AuthRequest).userId;
}

export function getAuthUserTenantId(req: Request): string | undefined {
  return (req as AuthRequest).tenantId;
}

export function getAuthUserRole(req: Request): 'owner' | 'builder' | 'runner' | 'viewer' | null | undefined {
  return (req as AuthRequest).userRole;
}
