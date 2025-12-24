# Authentication Test Suite - Implementation Guide

## Quick Start

### Run Auth Unit Tests
```bash
npm run test:auth
```

### Run All Tests with Coverage
```bash
npm run test:auth:coverage
```

### Run Specific Test File
```bash
npx vitest run tests/unit/services/AuthService.test.ts
```

### Watch Mode (for development)
```bash
npx vitest watch tests/unit/services/AuthService.test.ts
```

---

## Current Status

✅ **Test Infrastructure Complete:**
- 7 test files created (3 unit, 3 integration, 1 e2e)
- 100+ test cases defined
- Test helpers created (`tests/helpers/testUtils.ts`)
- Vitest configuration ready (`vitest.config.auth.ts`)
- Test setup file created (`tests/setup.auth.ts`)

⚠️ **Tests are Templates:**
- All tests currently use placeholders: `expect(true).toBe(true)`
- Need actual implementations with database calls
- This is intentional to provide structure without breaking existing tests

---

## How to Implement Placeholder Tests

### Example: Converting a Placeholder Test

**Before (Placeholder):**
```typescript
it("should hash a password using bcrypt with 12 rounds", async () => {
  expect(true).toBe(true); // Placeholder
});
```

**After (Implemented):**
```typescript
it("should hash a password using bcrypt with 12 rounds", async () => {
  const password = "TestPassword123";
  const hashedPassword = await authService.hashPassword(password);

  expect(hashedPassword).toBeTruthy();
  expect(hashedPassword).not.toBe(password);
  expect(hashedPassword).toMatch(/^\$2[aby]\$/); // bcrypt format
});
```

### Using Test Helpers

```typescript
import { 
  createVerifiedUser, 
  createUserWithMFA, 
  cleanTestUser,
  randomEmail,
  randomPassword 
} from '../../helpers/testUtils';

it("should create a verified user", async () => {
  const email = randomEmail();
  const password = randomPassword();
  
  const user = await createVerifiedUser({ email, password });
  
  expect(user.email).toBe(email);
  expect(user.emailVerified).toBe(true);
  
  // Cleanup
  await cleanTestUser(email);
});
```

---

## Test Helper Functions

Located in `tests/helpers/testUtils.ts`:

### Database Cleanup
- `cleanAuthTables()` - Clean all auth tables
- `cleanTestUser(email)` - Remove specific test user and all related data

### User Creation
- `createVerifiedUser(options)` - Create user ready to login
- `createUserWithMFA(options)` - Create user with MFA enabled
- `createLockedUser(options)` - Create locked user (5 failed attempts)
- `createUnverifiedUser(options)` - Create user with verification token

### Auth Helpers
- `loginAndGetTokens(email, password)` - Login and get JWT + refresh token
- `generateTOTPCode(secret)` - Generate valid TOTP code
- `createTrustedDevice(userId, fingerprint)` - Create trusted device

### Random Data
- `randomEmail()` - Generate unique test email
- `randomPassword()` - Generate password meeting strength requirements

---

## Implementation Priority

### Phase 1: Core Unit Tests (Start Here)
1. ✅ **AuthService.test.ts** - Password hashing, email validation, JWT
2. ✅ **MfaService.test.ts** - TOTP, backup codes
3. ✅ **AccountLockoutService.test.ts** - Lockout logic

### Phase 2: Integration Tests
4. **auth.routes.test.ts** - Login, register, logout endpoints
5. **mfa.flow.test.ts** - Complete MFA flows
6. **session.management.test.ts** - Session management

### Phase 3: E2E Tests
7. **auth.flows.e2e.test.ts** - Complete user journeys

---

## Running Tests Against Real Database

### Option 1: Test Database (Recommended)
Create a separate test database:

```bash
# Create test database
createdb vaultlogic_test

# Set environment variable
export DATABASE_URL="postgresql://user:pass@localhost/vaultlogic_test"

# Run migrations
npm run db:push

# Run tests
npm run test:auth
```

### Option 2: Mock Database (Unit Tests Only)
Tests already have database mocks set up. No additional configuration needed.

---

## Test Coverage Goals

| Service | Target | Current |
|---------|--------|---------|
| AuthService | 95% | 0% (placeholders) |
| MfaService | 95% | 0% (placeholders) |
| AccountLockoutService | 95% | 0% (placeholders) |
| **Overall Auth** | **90%** | **0%** |

Run with coverage:
```bash
npm run test:auth:coverage
```

---

## Common Test Patterns

### Testing Password Hashing
```typescript
const password = "TestPassword123";
const hash = await authService.hashPassword(password);
expect(hash).toMatch(/^\$2[aby]\$/);

const isValid = await authService.comparePassword(password, hash);
expect(isValid).toBe(true);
```

### Testing JWT Tokens
```typescript
const user = await createVerifiedUser({ email, password });
const token = authService.createToken(user);

const payload = authService.verifyToken(token);
expect(payload.userId).toBe(user.id);
expect(payload.email).toBe(user.email);
```

### Testing MFA
```typescript
const { user, totpSecret } = await createUserWithMFA({ email, password });
const totpCode = generateTOTPCode(totpSecret);

const isValid = await mfaService.verifyTotp(user.id, totpCode);
expect(isValid).toBe(true);
```

### Testing Account Lockout
```typescript
// Create 5 failed attempts
for (let i = 0; i < 5; i++) {
  await accountLockoutService.recordAttempt(email, "192.168.1.1", false);
}

const lockStatus = await accountLockoutService.isAccountLocked(user.id);
expect(lockStatus.locked).toBe(true);
```

---

## Troubleshooting

### "Database not initialized" Error
- Ensure `DATABASE_URL` environment variable is set
- Run `npm run db:push` to apply migrations
- Check `tests/setup.auth.ts` is being loaded

### "JWT_SECRET not configured" Error
- Tests automatically set `JWT_SECRET` in setup file
- Check `tests/setup.auth.ts` is in `setupFiles` config

### Tests Pass but Coverage is 0%
- You're still running placeholder tests
- Implement actual test logic (replace `expect(true).toBe(true)`)

### Slow Tests
- Use `vi.mock()` to mock database calls in unit tests
- Only integration tests should hit real database
- Consider using `testTimeout` in vitest config

---

## Next Steps

1. **Implement Core Tests:** Start with AuthService password hashing tests
2. **Add Database Helpers:** Extend `testUtils.ts` as needed
3. **Run Coverage Reports:** Identify untested code paths
4. **Add Integration Tests:** Test actual API endpoints
5. **Setup CI/CD:** Run tests on every commit
6. **Add E2E Tests:** Test complete user flows

---

## Resources

- **Vitest Docs:** https://vitest.dev/
- **Test Helpers:** `tests/helpers/testUtils.ts`
- **Auth Summary:** `AUTH_IMPLEMENTATION_SUMMARY.md`
- **Test Summary:** `AUTH_TESTS_SUMMARY.md`

---

*Last Updated: December 23, 2025*
*Status: Ready for Implementation*
