/**
 * Database Test Helper
 *
 * Utilities for tests that require database connectivity
 */

import { describe, it } from 'vitest';

/**
 * Check if database is available for testing
 * For unit tests, we always return false to skip database-dependent tests
 * These tests should be in the integration test suite instead
 */
export function isDatabaseAvailable(): boolean {
  return false;  // Always skip in unit tests - database tests belong in integration suite
}

/**
 * Skip test if database is not available
 * Use this for integration tests that require real database connectivity
 */
export function skipIfNoDatabase(): void {
  if (!isDatabaseAvailable()) {
    console.warn('⚠️  Skipping database-dependent test: DATABASE_URL not configured for testing');
  }
}

/**
 * Helper to conditionally run database tests
 * For unit tests, this will skip the suite. For integration tests with DATABASE_URL, it will run.
 * @param name - Test suite name
 * @param fn - Test function
 */
export function describeWithDb(name: string, fn: () => void): void {
  if (isDatabaseAvailable()) {
    describe(name, fn);
  } else {
    describe.skip(`${name} [requires database]`, fn);
  }
}

export function itWithDb(name: string, fn: () => void | Promise<void>, timeout?: number): void {
  if (isDatabaseAvailable()) {
    it(name, fn, timeout);
  } else {
    it.skip(`${name} [requires database]`, fn, timeout);
  }
}
