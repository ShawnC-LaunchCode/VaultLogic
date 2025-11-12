/**
 * OAuth2 Service
 * Handles OAuth2 Client Credentials flow with token caching
 */

import { oauth2Cache } from './cache';
import { redactObject } from '../utils/encryption';

/**
 * OAuth2 token response
 */
export interface OAuth2TokenResponse {
  access_token: string;
  token_type: string; // Usually 'Bearer'
  expires_in: number; // Seconds
  scope?: string;
}

/**
 * OAuth2 client credentials config
 */
export interface OAuth2ClientCredentialsConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  tenantId?: string; // For cache key scoping
  projectId?: string; // For cache key scoping
}

/**
 * Generate a cache key for OAuth2 tokens
 */
function generateCacheKey(config: OAuth2ClientCredentialsConfig): string {
  const parts = [
    config.tenantId || 'global',
    config.projectId || 'global',
    config.tokenUrl,
    config.clientId,
    config.scope || '',
  ];
  return parts.join(':');
}

/**
 * Fetch an OAuth2 access token using client credentials flow
 * Implements caching to avoid unnecessary token requests
 *
 * @param config OAuth2 configuration
 * @returns Access token and metadata
 */
export async function getOAuth2Token(config: OAuth2ClientCredentialsConfig): Promise<OAuth2TokenResponse> {
  const cacheKey = generateCacheKey(config);

  // Check cache first
  const cached = oauth2Cache.get(cacheKey);
  if (cached) {
    // Check if token is still valid (with 30s buffer)
    const expiresAt = cached.obtainedAt + (cached.expires_in * 1000);
    const now = Date.now();

    if (now < expiresAt - 30000) {
      // Token is still valid, return from cache
      return {
        access_token: cached.access_token,
        token_type: cached.token_type,
        expires_in: Math.floor((expiresAt - now) / 1000), // Remaining lifetime
      };
    }

    // Token expired or near expiry, delete from cache
    oauth2Cache.delete(cacheKey);
  }

  // Fetch new token
  const token = await fetchOAuth2Token(config);

  // Cache the token (with 30s buffer before expiry)
  oauth2Cache.set(cacheKey, token);

  return token;
}

/**
 * Fetch a fresh OAuth2 token (no caching)
 * Uses application/x-www-form-urlencoded POST with client credentials
 *
 * @param config OAuth2 configuration
 * @returns Access token and metadata
 */
async function fetchOAuth2Token(config: OAuth2ClientCredentialsConfig): Promise<OAuth2TokenResponse> {
  const { tokenUrl, clientId, clientSecret, scope } = config;

  try {
    // Build form body
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    if (scope) {
      params.append('scope', scope);
    }

    // Make request
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('OAuth2 token request failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        tokenUrl: redactObject({ tokenUrl }).tokenUrl,
      });
      throw new Error(`OAuth2 token request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Validate response
    if (!data.access_token || !data.token_type) {
      console.error('Invalid OAuth2 token response:', redactObject(data));
      throw new Error('Invalid OAuth2 token response: missing access_token or token_type');
    }

    return {
      access_token: data.access_token,
      token_type: data.token_type,
      expires_in: data.expires_in || 3600, // Default to 1 hour if not provided
      scope: data.scope,
    };
  } catch (error) {
    console.error('OAuth2 token fetch error:', {
      error: (error as Error).message,
      tokenUrl: redactObject({ tokenUrl }).tokenUrl,
    });
    throw new Error(`Failed to obtain OAuth2 token: ${(error as Error).message}`);
  }
}

/**
 * Invalidate a cached OAuth2 token
 * Useful when a token is known to be invalid (e.g., revoked)
 *
 * @param config OAuth2 configuration
 */
export function invalidateOAuth2Token(config: OAuth2ClientCredentialsConfig): void {
  const cacheKey = generateCacheKey(config);
  oauth2Cache.delete(cacheKey);
}

/**
 * Clear all cached OAuth2 tokens
 */
export function clearOAuth2TokenCache(): void {
  oauth2Cache.clear();
}

/**
 * Test OAuth2 credentials by attempting to fetch a token
 * Returns true if successful, false otherwise
 *
 * @param config OAuth2 configuration
 * @returns True if token fetch succeeds
 */
export async function testOAuth2Credentials(config: OAuth2ClientCredentialsConfig): Promise<boolean> {
  try {
    await fetchOAuth2Token(config);
    return true;
  } catch (error) {
    return false;
  }
}
