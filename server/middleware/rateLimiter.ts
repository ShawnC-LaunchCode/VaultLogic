import rateLimit from 'express-rate-limit';

/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse and DOS attacks
 *
 * Configuration via environment variables:
 * - RATE_LIMIT_WINDOW_MS: Time window in milliseconds (default: 15 minutes)
 * - RATE_LIMIT_MAX_REQUESTS: Max requests per window (default: 100)
 * - RATE_LIMIT_STRICT_MAX: Max requests for strict endpoints (default: 10)
 */

// Get configuration from environment or use defaults
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 minutes
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
const strictMax = parseInt(process.env.RATE_LIMIT_STRICT_MAX || '10');

/**
 * General API rate limit (100 requests per 15 minutes)
 * Apply to all standard API endpoints
 */
export const apiLimiter = rateLimit({
  windowMs, // 15 minutes
  max: maxRequests, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Skip rate limiting in test environment
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Stricter limit for expensive operations (10 per 15 minutes)
 * Apply to operations that are computationally expensive or database-intensive
 * Examples: bulk operations, complex queries, data exports
 */
export const strictLimiter = rateLimit({
  windowMs, // 15 minutes
  max: strictMax,
  message: 'Too many expensive operations, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Test endpoint limiter (10 per minute)
 * Apply to test/preview endpoints
 * Examples: transform block testing, workflow preview
 */
export const testLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many test requests, please wait.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Batch operation limiter (5 per minute)
 * Apply to batch/bulk operations
 * Examples: bulk row creation, bulk deletions, batch reference queries
 */
export const batchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: 'Too many batch requests, please wait.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Authentication limiter (10 per 15 minutes)
 * Apply to login/authentication endpoints
 * Helps prevent brute force attacks
 * Note: Already applied in googleAuth.ts, exported here for consistency
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  message: {
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Create operation limiter (20 per minute)
 * Apply to resource creation endpoints
 * Examples: create database, create table, create row
 */
export const createLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: 'Too many create requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Delete operation limiter (10 per minute)
 * Apply to delete endpoints to prevent accidental mass deletion
 */
export const deleteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many delete requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});
