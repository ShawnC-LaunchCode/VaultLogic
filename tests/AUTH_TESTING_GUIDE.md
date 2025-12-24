# Authentication Tests Guide

This guide explains how to run, maintain, and extend the VaultLogic authentication test suite.

## Quick Start

### Run All Auth Tests
```bash
npm run test:auth:all
```

### Run Unit Tests Only (Fast)
```bash
npm run test:auth
```

### Run Integration Tests Only
```bash
npm run test:auth:integration
```

### Run with Coverage Report
```bash
npm run test:auth:coverage
npm run test:auth:integration:coverage
```

### Watch Mode (Auto-rerun on changes)
```bash
npm run test:auth:watch
npm run test:auth:integration:watch
```

### Interactive UI
```bash
npm run test:auth:ui
```

---

## Test Structure

```
tests/
├── setup.auth.ts                          # Global test setup
├── helpers/
│   ├── testApp.ts                         # Express app factory
│   └── testUtils.ts                       # Helper functions
├── unit/
│   ├── services/
│   │   ├── AuthService.test.ts           # ✅ JWT, passwords, tokens
│   │   ├── MfaService.test.ts            # ✅ TOTP, backup codes
│   │   └── AccountLockoutService.test.ts # ✅ Lockout logic
│   └── middleware/
│       └── auth.middleware.test.ts        # ✅ Auth strategies
└── integration/
    ├── auth.routes.real.test.ts           # ✅ HTTP endpoints
    └── auth.flows.real.test.ts            # ✅ E2E flows
```

---

## Prerequisites

### Environment Variables

Create a `.env.test` file or set these in your environment:

```bash
# Required
DATABASE_URL="postgresql://user:pass@localhost:5432/vaultlogic_test"
JWT_SECRET="test-jwt-secret-minimum-32-characters-long"
VL_MASTER_KEY="base64-encoded-32-byte-key"

# Optional (for email tests)
SENDGRID_API_KEY="your-sendgrid-key"
SENDGRID_FROM_EMAIL="noreply@example.com"
```

### Generate VL_MASTER_KEY
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Database Setup

**Option 1: Use Test Database**
```bash
# Create test database
createdb vaultlogic_test

# Run migrations
DATABASE_URL="postgresql://user:pass@localhost:5432/vaultlogic_test" npm run db:push
```

**Option 2: Use Docker**
```bash
docker run -d \
  --name postgres-test \
  -e POSTGRES_DB=vaultlogic_test \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -p 5433:5432 \
  postgres:15
```

---

## Writing New Tests

### Test User Helpers

```typescript
import {
  createTestUser,
  createVerifiedUser,
  createUserWithMfa,
  randomEmail,
  randomPassword,
  generateTotpCode,
} from '../helpers/testUtils';

// Create unverified user
const { user, password, email } = await createTestUser();

// Create verified user (email verified)
const { user, password, email } = await createVerifiedUser();

// Create user with MFA enabled
const { user, password, totpSecret } = await createUserWithMfa();

// Generate TOTP code
const totpCode = generateTotpCode(totpSecret);
```

### HTTP Request Testing

```typescript
import request from 'supertest';
import { createTestApp } from '../helpers/testApp';

const app = createTestApp();

// POST request
const response = await request(app)
  .post('/api/auth/login')
  .send({ email: 'test@example.com', password: 'Password123' });

expect(response.status).toBe(200);
expect(response.body.token).toBeDefined();

// GET with auth header
const meResponse = await request(app)
  .get('/api/auth/me')
  .set('Authorization', `Bearer ${token}`);

// With cookies
const logoutResponse = await request(app)
  .post('/api/auth/logout')
  .set('Cookie', 'refresh_token=abc123');
```

---

## Resources

- **Vitest Docs:** https://vitest.dev/
- **Supertest Docs:** https://github.com/ladjs/supertest
- **Auth Test Coverage:** `AUTH_TEST_COVERAGE.md`
- **Auth Implementation:** `AUTH_IMPLEMENTATION_SUMMARY.md`

---

**Last Updated:** December 24, 2025
