import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '../logger';

const logger = createLogger({ module: 'timeout' });

/**
 * SECURITY FIX: Request Timeout Middleware
 * Prevents long-running requests from consuming server resources
 *
 * Default timeout: 30 seconds (configurable via REQUEST_TIMEOUT_MS env var)
 * Endpoints can override with custom timeout by setting res.locals.timeout
 */

const DEFAULT_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS ?? '30000', 10);

export function requestTimeout(req: Request, res: Response, next: NextFunction): void {
  // Allow endpoints to override timeout
  const timeoutMs = res.locals.timeout || DEFAULT_TIMEOUT_MS;

  // Skip timeout in test environment
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  // Set timeout on the socket connection
  if (req.socket) {
    req.socket.setTimeout(timeoutMs);
  }

  // Create a timeout handler
  const timeoutHandler = setTimeout(() => {
    if (!res.headersSent) {
      logger.warn({
        method: req.method,
        path: req.path,
        timeoutMs
      }, 'Request timeout');

      res.status(408).json({
        message: 'Request timeout',
        error: 'request_timeout'
      });
    }
  }, timeoutMs);

  // Clear timeout on response finish
  res.on('finish', () => {
    clearTimeout(timeoutHandler);
  });

  // Clear timeout on response close (client disconnected)
  res.on('close', () => {
    clearTimeout(timeoutHandler);
  });

  next();
}

/**
 * Extended timeout middleware for long-running operations
 * Use this for operations like document generation, AI processing, etc.
 */
export function extendedTimeout(timeoutMs: number = 120000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.locals.timeout = timeoutMs;
    next();
  };
}
