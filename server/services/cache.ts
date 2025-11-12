/**
 * Cache Service
 * Simple in-memory LRU cache with TTL support
 * Used for OAuth2 tokens, HTTP responses, etc.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix timestamp in ms
}

class LRUCache<T = any> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get a value from the cache
   * Returns undefined if not found or expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set a value in the cache with TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttlMs Time-to-live in milliseconds
   */
  set(key: string, value: T, ttlMs: number): void {
    // Remove if already exists
    this.cache.delete(key);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    // Add new entry
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Delete a value from the cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    // Clean up expired entries first
    this.cleanupExpired();
    return this.cache.size;
  }

  /**
   * Remove all expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }
}

// Global cache instances
const oAuth2TokenCache = new LRUCache<{
  access_token: string;
  token_type: string;
  expires_in: number;
  obtainedAt: number;
}>(100); // 100 OAuth2 tokens max

const httpResponseCache = new LRUCache<{
  status: number;
  data: any;
  headers: Record<string, string>;
}>(500); // 500 HTTP responses max

/**
 * OAuth2 Token Cache
 * Stores access tokens with automatic expiration
 */
export const oauth2Cache = {
  /**
   * Get a cached OAuth2 token
   */
  get(key: string): { access_token: string; token_type: string; expires_in: number; obtainedAt: number } | undefined {
    return oAuth2TokenCache.get(key);
  },

  /**
   * Set a cached OAuth2 token
   * @param key Cache key (e.g., `${tenantId}:${projectId}:${tokenUrl}:${clientId}:${scope}`)
   * @param token OAuth2 token response
   * @param ttlMs Time-to-live in milliseconds (defaults to expires_in - 30s buffer)
   */
  set(
    key: string,
    token: { access_token: string; token_type: string; expires_in: number },
    ttlMs?: number
  ): void {
    const obtainedAt = Date.now();
    const effectiveTtl = ttlMs ?? (token.expires_in * 1000 - 30000); // 30s buffer

    oAuth2TokenCache.set(key, {
      ...token,
      obtainedAt,
    }, effectiveTtl);
  },

  /**
   * Delete a cached OAuth2 token
   */
  delete(key: string): boolean {
    return oAuth2TokenCache.delete(key);
  },

  /**
   * Check if a token is cached and not expired
   */
  has(key: string): boolean {
    return oAuth2TokenCache.has(key);
  },

  /**
   * Clear all cached tokens
   */
  clear(): void {
    oAuth2TokenCache.clear();
  },
};

/**
 * HTTP Response Cache
 * Stores HTTP responses for configured cache TTLs
 */
export const httpCache = {
  /**
   * Get a cached HTTP response
   */
  get(key: string): { status: number; data: any; headers: Record<string, string> } | undefined {
    return httpResponseCache.get(key);
  },

  /**
   * Set a cached HTTP response
   * @param key Cache key (e.g., `${projectId}:${method}:${url}:${bodyHash}`)
   * @param response HTTP response to cache
   * @param ttlMs Time-to-live in milliseconds
   */
  set(
    key: string,
    response: { status: number; data: any; headers: Record<string, string> },
    ttlMs: number
  ): void {
    httpResponseCache.set(key, response, ttlMs);
  },

  /**
   * Delete a cached HTTP response
   */
  delete(key: string): boolean {
    return httpResponseCache.delete(key);
  },

  /**
   * Check if a response is cached and not expired
   */
  has(key: string): boolean {
    return httpResponseCache.has(key);
  },

  /**
   * Clear all cached responses
   */
  clear(): void {
    httpResponseCache.clear();
  },
};

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    oauth2: {
      size: oAuth2TokenCache.size(),
      maxSize: 100,
    },
    http: {
      size: httpResponseCache.size(),
      maxSize: 500,
    },
  };
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  oAuth2TokenCache.clear();
  httpResponseCache.clear();
}
