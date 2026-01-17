/**
 * AI Error Handling
 *
 * Unified error handling for all AI services
 */

import type { AIErrorCode } from './types';

export interface AIErrorDetails {
  code: AIErrorCode;
  message: string;
  details?: any;
  retryable?: boolean;
  retryAfterSeconds?: number;
}

/**
 * Custom AI Error class
 */
export class AIError extends Error {
  public readonly code: AIErrorCode;
  public readonly details?: any;
  public readonly retryable: boolean;
  public readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    code: AIErrorCode,
    details?: any,
    retryable = false,
    retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.details = details;
    this.retryable = retryable;
    this.retryAfterSeconds = retryAfterSeconds;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AIError);
    }
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): AIErrorDetails {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
      retryAfterSeconds: this.retryAfterSeconds,
    };
  }

  /**
   * Create error from unknown error object
   */
  static fromUnknown(error: unknown, defaultCode: AIErrorCode = 'API_ERROR'): AIError {
    if (error instanceof AIError) {
      return error;
    }

    if (error instanceof Error) {
      return new AIError(error.message, defaultCode, {
        originalError: error.name,
        stack: error.stack,
      });
    }

    return new AIError(String(error), defaultCode);
  }
}

/**
 * Create an AI error (factory function for backwards compatibility)
 */
export function createAIError(
  message: string,
  code: AIErrorCode,
  details?: any,
  retryable = false,
  retryAfterSeconds?: number
): AIError {
  return new AIError(message, code, details, retryable, retryAfterSeconds);
}

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error: any): boolean {
  return (
    error?.code === 'RATE_LIMIT' ||
    error?.status === 429 ||
    error?.code === 'rate_limit_exceeded' ||
    error?.message?.includes('429') ||
    error?.message?.includes('Quota exceeded') ||
    error?.message?.includes('rate limit')
  );
}

/**
 * Check if error is a timeout error
 */
export function isTimeoutError(error: any): boolean {
  return (
    error?.code === 'TIMEOUT' ||
    error?.code === 'ETIMEDOUT' ||
    error?.message?.includes('timeout') ||
    error?.message?.includes('timed out')
  );
}

/**
 * Extract retry-after seconds from error
 */
export function getRetryAfter(error: any): number {
  // Check for Retry-After header (seconds)
  if (error?.response?.headers?.['retry-after']) {
    const retryAfter = parseInt(error.response.headers['retry-after'], 10);
    if (!isNaN(retryAfter)) {
      return retryAfter * 1000; // Convert to ms
    }
  }

  // Check for rate limit reset timestamp
  if (error?.response?.headers?.['x-ratelimit-reset']) {
    const resetTime = parseInt(error.response.headers['x-ratelimit-reset'], 10);
    if (!isNaN(resetTime)) {
      const now = Math.floor(Date.now() / 1000);
      const waitSeconds = Math.max(0, resetTime - now);
      return waitSeconds * 1000; // Convert to ms
    }
  }

  // Default to 60 seconds if no info available
  return 60000;
}
