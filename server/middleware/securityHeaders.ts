/**
 * Security Headers Middleware
 *
 * Implements comprehensive security headers to protect against common web vulnerabilities.
 * Based on OWASP recommendations and modern security best practices.
 *
 * Headers implemented:
 * - Content Security Policy (CSP) - Prevents XSS, code injection
 * - Strict-Transport-Security (HSTS) - Forces HTTPS
 * - X-Content-Type-Options - Prevents MIME sniffing
 * - X-Frame-Options - Prevents clickjacking
 * - X-XSS-Protection - Legacy XSS protection (for older browsers)
 * - Referrer-Policy - Controls referrer information
 * - Permissions-Policy - Controls browser features
 *
 * Created: December 22, 2025
 * Security Audit Fix
 */

import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '../logger.js';

const logger = createLogger({ module: 'security-headers' });

/**
 * Security headers configuration
 */
interface SecurityHeadersConfig {
  /** Enable CSP header */
  enableCSP?: boolean;
  /** Enable HSTS header (only in production) */
  enableHSTS?: boolean;
  /** HSTS max age in seconds (default: 1 year) */
  hstsMaxAge?: number;
  /** Allow framing from same origin (default: DENY) */
  allowFraming?: 'DENY' | 'SAMEORIGIN';
  /** Additional CSP directives */
  cspDirectives?: Record<string, string[]>;
}

/**
 * Default security headers middleware
 *
 * Usage:
 * ```typescript
 * import { securityHeaders } from './middleware/securityHeaders.js';
 * app.use(securityHeaders());
 * ```
 */
export function securityHeaders(config: SecurityHeadersConfig = {}) {
  const {
    enableCSP = true,
    enableHSTS = process.env.NODE_ENV === 'production',
    hstsMaxAge = 31536000, // 1 year
    allowFraming = 'DENY',
    cspDirectives = {},
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    // ===========================================================================
    // 1. Content Security Policy (CSP)
    // ===========================================================================
    if (enableCSP) {
      // Base CSP directives (strict but functional)
      const defaultDirectives: Record<string, string[]> = {
        'default-src': ["'self'"],
        'script-src': [
          "'self'",
          "'unsafe-inline'", // Required for React/Vite in development
          "'unsafe-eval'",   // Required for some JS libraries (consider removing in prod)
          'https://*.google.com',
          'https://*.gstatic.com',
          'https://*.googleapis.com',
        ],
        'style-src': [
          "'self'",
          "'unsafe-inline'", // Required for styled-components, Tailwind
          'https://*.googleapis.com',
          'https://*.google.com',
          'https://*.gstatic.com',
        ],
        'font-src': [
          "'self'",
          'https://*.gstatic.com',
          'https://*.googleapis.com',
          'data:', // Allow data URIs for fonts
        ],
        'img-src': [
          "'self'",
          'data:',       // Data URIs for inline images
          'blob:',       // Blob URLs for generated images
          'https:',      // Allow HTTPS images (consider restricting)
        ],
        'connect-src': [
          "'self'",
          'https://*.google.com',
          'https://*.googleapis.com',
          'https://*.gstatic.com',
          'wss://localhost:*', // WebSocket for development
          'ws://localhost:*',
        ],
        'frame-src': [
          "'self'",
          'https://*.google.com',
          'https://*.firebaseapp.com', // Firebase Auth if used
        ],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"], // Prevent framing (redundant with X-Frame-Options)
        'upgrade-insecure-requests': [], // Upgrade HTTP to HTTPS
      };

      // Merge with custom directives
      const mergedDirectives = { ...defaultDirectives, ...cspDirectives };

      // Build CSP header value
      const cspValue = Object.entries(mergedDirectives)
        .map(([key, values]) => {
          if (values.length === 0) return key; // Directive without value
          return `${key} ${values.join(' ')}`;
        })
        .join('; ');

      res.setHeader('Content-Security-Policy', cspValue);
    }

    // ===========================================================================
    // 2. HTTP Strict Transport Security (HSTS)
    // ===========================================================================
    if (enableHSTS) {
      res.setHeader(
        'Strict-Transport-Security',
        `max-age=${hstsMaxAge}; includeSubDomains; preload`
      );
    }

    // ===========================================================================
    // 3. X-Content-Type-Options
    // ===========================================================================
    // Prevents MIME type sniffing, forces browser to respect Content-Type
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // ===========================================================================
    // 4. X-Frame-Options
    // ===========================================================================
    // Prevents clickjacking attacks by controlling framing
    res.setHeader('X-Frame-Options', allowFraming);

    // ===========================================================================
    // 5. X-XSS-Protection (Legacy, but still useful for older browsers)
    // ===========================================================================
    // Modern browsers rely on CSP, but this helps older browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // ===========================================================================
    // 6. Referrer-Policy
    // ===========================================================================
    // Controls how much referrer information is sent with requests
    res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');

    // ===========================================================================
    // 7. Permissions-Policy (formerly Feature-Policy)
    // ===========================================================================
    // Disable potentially dangerous browser features
    const permissionsPolicy = [
      'geolocation=()',       // Disable geolocation
      'microphone=()',        // Disable microphone
      'camera=()',            // Disable camera
      'payment=()',           // Disable payment APIs
      'usb=()',               // Disable USB access
      'magnetometer=()',      // Disable magnetometer
      'gyroscope=()',         // Disable gyroscope
      'accelerometer=()',     // Disable accelerometer
    ].join(', ');

    res.setHeader('Permissions-Policy', permissionsPolicy);

    // ===========================================================================
    // 8. X-Powered-By (Remove)
    // ===========================================================================
    // Remove default Express header that leaks implementation details
    res.removeHeader('X-Powered-By');

    // ===========================================================================
    // 9. COOP / COEP (Google Auth Compat)
    // ===========================================================================
    // Explicitly allow cross-origin popups for Google Sign-In
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');

    next();
  };
}

/**
 * Relaxed security headers for development/testing
 *
 * Use this in development if strict CSP breaks your workflow.
 * NEVER use in production!
 */
export function relaxedSecurityHeaders() {
  return securityHeaders({
    enableCSP: false,
    enableHSTS: false,
    allowFraming: 'SAMEORIGIN',
  });
}

/**
 * Maximum security headers for production
 *
 * Strictest possible configuration. Use this in production.
 */
export function strictSecurityHeaders() {
  return securityHeaders({
    enableCSP: true,
    enableHSTS: true,
    hstsMaxAge: 63072000, // 2 years
    allowFraming: 'DENY',
    cspDirectives: {
      // Remove unsafe-eval and unsafe-inline in production
      'script-src': [
        "'self'",
        'https://accounts.google.com',
        'https://www.google.com',
        'https://www.gstatic.com',
      ],
      'style-src': [
        "'self'",
        'https://fonts.googleapis.com',
        'https://accounts.google.com',
      ],
    },
  });
}

// Log security headers configuration on module load
logger.info({
  environment: process.env.NODE_ENV,
  hstsEnabled: process.env.NODE_ENV === 'production',
}, 'Security headers middleware loaded');
