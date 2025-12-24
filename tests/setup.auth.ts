import { beforeAll, afterAll, beforeEach } from 'vitest';
import { cleanAuthTables } from './helpers/testUtils';

/**
 * Auth Test Setup
 * Runs before all auth tests
 */

beforeAll(async () => {
  console.log('🔧 Setting up auth test environment...');
  
  // Ensure JWT_SECRET is set for tests
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars';
  }
  
  if (!process.env.VL_MASTER_KEY) {
    process.env.VL_MASTER_KEY = Buffer.from('0'.repeat(32)).toString('base64');
  }
  
  console.log('✅ Auth test environment ready');
});

beforeEach(async () => {
  // Clean auth tables before each test
  try {
    await cleanAuthTables();
  } catch (error) {
    console.warn('Could not clean auth tables (might be running in mock mode)');
  }
});

afterAll(async () => {
  console.log('🧹 Cleaning up auth test environment...');
  try {
    await cleanAuthTables();
  } catch (error) {
    console.warn('Could not clean auth tables during teardown');
  }
});
