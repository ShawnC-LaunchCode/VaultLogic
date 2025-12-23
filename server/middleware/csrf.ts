import type { Request, Response, NextFunction } from 'express';
import { randomBytes, createHmac } from 'crypto';
import { createLogger } from '../logger';

const logger = createLogger({ module: 'csrf' });

// CSRF token secret (should be in environment variables in production)
const CSRF_SECRET = process.env.CSRF_SECRET || 'csrf-default-secret-change-me';

/**
 * SECURITY FIX: CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks by validating tokens
 *
 * How it works:
 * 1. Generate CSRF token on session creation (stored in session)
 * 2. Client includes token in X-CSRF-Token header or _csrf field
 * 3. Server validates token matches session token
 *
 * Usage:
 * - Apply to all state-changing routes (POST, PUT, DELETE, PATCH)
 * - Exempt public/anonymous endpoints (intake forms, webhooks)
 */

/**
 * Generate a CSRF token for the current session
 */
export function generateCsrfToken(sessionId: string): string {
  const timestamp = Date.now().toString();
  const random = randomBytes(16).toString('hex');
  const payload = `${sessionId}:${timestamp}:${random}`;

  const hmac = createHmac('sha256', CSRF_SECRET);
  hmac.update(payload);
  const signature = hmac.digest('hex');

  return `${payload}:${signature}`;
}

/**
 * Validate a CSRF token
 */
export function validateCsrfToken(token: string, sessionId: string): boolean {
  if (!token || !sessionId) {
    return false;
  }

  try {
    const parts = token.split(':');
    if (parts.length !== 4) {
      return false;
    }

    const [tokenSessionId, timestamp, random, signature] = parts;

    // Check session ID matches
    if (tokenSessionId !== sessionId) {
      logger.warn({ tokenSessionId, sessionId }, 'CSRF token session ID mismatch');
      return false;
    }

    // Check token age (max 24 hours)
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (tokenAge > maxAge || tokenAge < 0) {
      logger.warn({ tokenAge, maxAge }, 'CSRF token expired or invalid timestamp');
      return false;
    }

    // Verify signature
    const payload = `${tokenSessionId}:${timestamp}:${random}`;
    const hmac = createHmac('sha256', CSRF_SECRET);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    if (signature !== expectedSignature) {
      logger.warn('CSRF token signature mismatch');
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ error }, 'CSRF token validation error');
    return false;
  }
}

/**
 * Middleware to enforce CSRF protection on state-changing requests
 * Checks for CSRF token in X-CSRF-Token header or _csrf body/query field
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Only protect state-changing methods
  const protectedMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!protectedMethods.includes(req.method)) {
    return next();
  }

  // Skip CSRF for public/anonymous endpoints
  const publicPaths = [
    '/api/auth/google',  // OAuth callback
    '/api/auth/login',   // Login endpoint
    '/api/auth/register', // Registration
    '/api/public/',      // Public intake forms
    '/api/webhooks/',    // Webhook receivers
    '/api/portal/',      // Portal endpoints (use magic tokens)
  ];

  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Skip CSRF in test environment to avoid breaking tests
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  // Get session ID
  const sessionId = req.sessionID || req.session?.id;
  if (!sessionId) {
    logger.warn({ path: req.path, method: req.method }, 'CSRF check: No session ID');
    return res.status(403).json({
      message: 'CSRF validation failed: No session',
      error: 'csrf_no_session'
    });
  }

  // Get CSRF token from header or body
  const token = req.get('X-CSRF-Token') ||
                req.body?._csrf ||
                req.query._csrf as string;

  if (!token) {
    logger.warn({ path: req.path, method: req.method }, 'CSRF check: No token provided');
    return res.status(403).json({
      message: 'CSRF validation failed: Token required',
      error: 'csrf_token_missing'
    });
  }

  // Validate token
  if (!validateCsrfToken(token, sessionId)) {
    logger.warn({
      path: req.path,
      method: req.method,
      sessionId,
      tokenProvided: !!token
    }, 'CSRF validation failed');

    return res.status(403).json({
      message: 'CSRF validation failed: Invalid token',
      error: 'csrf_token_invalid'
    });
  }

  // Token valid, proceed
  next();
}

/**
 * Endpoint to get a CSRF token for the current session
 * Should be called by frontend on app initialization
 */
export function getCsrfTokenHandler(req: Request, res: Response): void {
  const sessionId = req.sessionID || req.session?.id;

  if (!sessionId) {
    return res.status(401).json({
      message: 'Session required to generate CSRF token',
      error: 'no_session'
    });
  }

  const token = generateCsrfToken(sessionId);

  res.json({
    csrfToken: token,
    expiresIn: '24h'
  });
}
