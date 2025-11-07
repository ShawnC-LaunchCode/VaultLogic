# VaultLogic Testing Framework

**Status:** 🟡 Partially Implemented - Templates Require Configuration
**Date:** 2025-10-28
**Current:** 3/3 passing (simple verification tests)
**Potential:** 100+ tests once fully configured
**Coverage Goal:** 80% lines, 80% functions, 75% branches

---

## 📦 Overview

VaultLogic includes a complete automated testing infrastructure with templates for:
- **Unit Tests** - Repositories, Services, Utilities (50+ test templates)
- **Integration Tests** - API Routes mapped to User Stories (30+ test templates)
- **E2E Tests** - Complete user journeys with Playwright (20+ test templates)
- **Mock Data Factories** - Realistic test data generators (✅ Working)
- **Test Configuration** - Vitest and Playwright configs (✅ Working)

---

## 🚨 Current Status

### What's Working ✅

- ✅ **Test infrastructure** (Vitest, Playwright configs)
- ✅ **Mock data factories** (all 5 factories create test data)
- ✅ **Simple verification tests** (3/3 passing)
- ✅ **Test scripts** in package.json

### What Needs Setup 🔧

Most test files are **skipped** (`.skip.ts` extension) because they require proper database mocking:

**Unit Tests (Skipped):**
- `tests/unit/repositories/*.test.skip.ts` (9 tests)
- `tests/unit/services/*.test.skip.ts` (39 tests)
- `tests/unit/utils/conditionalLogic.test.skip.ts` (29 tests)

**Integration Tests (Skipped):**
- `tests/integration/routes/*.test.skip.ts` (30+ tests)

**E2E Tests (Skipped):**
- `tests/e2e/*.e2e.skip.ts` (20+ tests)

---

## 🗂 Complete File Structure

```
tests/
├── unit/                                    # Unit Tests
│   ├── repositories/
│   │   ├── SurveyRepository.test.skip.ts    ⚠️ Needs mocking
│   │   ├── ResponseRepository.test.skip.ts  ⚠️ Needs mocking
│   │   └── AnalyticsRepository.test.skip.ts ⚠️ Needs mocking
│   ├── services/
│   │   ├── SurveyService.test.skip.ts       ⚠️ Needs mocking
│   │   ├── ResponseService.test.skip.ts     ⚠️ Needs mocking
│   │   └── AnalyticsService.test.skip.ts    ⚠️ Needs mocking
│   └── utils/
│       ├── conditionalLogic-simple.test.ts  ✅ Working
│       └── conditionalLogic.test.skip.ts    ⚠️ Needs implementation
│
├── integration/                             # Integration Tests (API)
│   └── routes/
│       ├── US-A-001-login.test.skip.ts      ⚠️ Needs setup
│       ├── US-C-004-create-survey.test.skip.ts
│       ├── US-RS-030-submit-response.test.skip.ts
│       ├── US-RS-031-submit-anon-response.test.skip.ts
│       └── US-AN-042-export-results.test.skip.ts
│
├── e2e/                                     # End-to-End Tests (Playwright)
│   ├── US-C-004-create-survey.e2e.skip.ts   ⚠️ Needs setup
│   ├── US-S-013-nested-loop-builder.e2e.skip.ts
│   ├── US-AN-041-analytics-dashboard.e2e.skip.ts
│   └── US-UX-060-mobile-builder.e2e.skip.ts
│
├── factories/                               # Mock Data Factories
│   ├── userFactory.ts                       ✅ Working
│   ├── surveyFactory.ts                     ✅ Working
│   ├── recipientFactory.ts                  ✅ Working
│   ├── responseFactory.ts                   ✅ Working
│   ├── analyticsFactory.ts                  ✅ Working
│   └── testHelpers.ts                       ✅ Working
│
├── setup.ts                                 ✅ Global test setup
└── README.md                                ✅ Analytics testing docs

Root Level:
├── vitest.config.ts                         ✅ Updated with coverage
├── playwright.config.ts                     ✅ Playwright configuration
└── package.json                             ✅ Updated with test scripts
```

---

## 🎯 Test Scripts

```bash
npm test                  # Run all tests with coverage
npm run test:unit         # Unit tests only (3 passing)
npm run test:integration  # Integration tests (all skipped)
npm run test:e2e          # E2E tests with Playwright (all skipped)
npm run test:e2e:ui       # E2E with Playwright UI
npm run test:watch        # Watch mode (auto-rerun)
npm run test:ui           # Vitest interactive UI
npm run test:coverage     # Generate coverage report
```

---

## 🏭 Mock Data Factories (✅ Working)

The factories are fully functional and ready to use:

### User Factory
```typescript
const user = createTestUser({ email: "test@example.com" });
const admin = createTestAdmin();
const users = createTestUsers(5); // Create 5 users
```

### Survey Factory
```typescript
const survey = createTestSurvey({ title: "My Survey" });
const fullSurvey = createTestSurveyWithQuestions({}, 2, 3); // 2 pages, 3 questions each
const anonSurvey = createTestAnonymousSurvey();
```

### Response Factory
```typescript
const response = createTestResponse({ surveyId: "123" });
const completed = createTestCompletedResponse("survey-123");
const anonymous = createTestAnonymousResponse("survey-123");
const withAnswers = createTestResponseWithAnswers("survey-123", ["q1", "q2"]);
```

### Analytics Factory
```typescript
const journey = createTestSurveyJourney("resp-1", "survey-1", ["page-1", "page-2"], true);
const interactions = createTestQuestionInteractions("resp-1", "survey-1", "q1", true);
const summary = createTestAnalyticsSummary({ completionRate: 0.85 });
```

---

## 🔧 How to Fix Tests

### Option 1: Fully Mock Dependencies (Recommended)

Mock the database module at the top level:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the entire database module
vi.mock("../../../server/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    where: vi.fn(),
    // ... etc
  }
}));

describe("SurveyRepository", () => {
  // Now tests use the mocked db
});
```

### Option 2: Use In-Memory SQLite

The project has `tests/setup/testDb.ts` with SQLite:

```typescript
import { testSqlite } from "../../setup/testDb";

// Use SQLite instead of PostgreSQL
const result = testSqlite.prepare("SELECT * FROM surveys").all();
```

### Option 3: Set Up Test Database

Configure a real test PostgreSQL database:

```bash
# .env
TEST_DATABASE_URL=postgresql://testuser:testpass@localhost:5432/vault_logic_test
```

Then run migrations:
```bash
npm run db:push
```

---

## 📊 Coverage Configuration

```typescript
// vitest.config.ts
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html"],
  include: [
    "server/**/*.ts",
    "shared/**/*.ts",
    "client/src/**/*.{ts,tsx}",
  ],
  exclude: [
    "**/*.test.ts",
    "**/node_modules/**",
    "**/dist/**",
  ],
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 75,
    statements: 80,
  },
}
```

---

## 🧪 Test Examples

### Unit Test Template
```typescript
// tests/unit/repositories/SurveyRepository.test.ts
describe("SurveyRepository", () => {
  it("should create a new survey", async () => {
    const surveyData = { title: "Customer Feedback", creatorId: user.id };
    const result = await repository.create(surveyData);
    expect(result.title).toBe("Customer Feedback");
    expect(result.status).toBe("draft");
  });
});
```

### Integration Test Template
```typescript
// tests/integration/routes/US-C-004-create-survey.test.ts
describe("US-C-004: Create New Survey", () => {
  it("should create a new survey and return 201", async () => {
    const response = await agent
      .post("/api/surveys")
      .send({ title: "Customer Feedback Survey" })
      .expect(201);
    expect(response.body.title).toBe("Customer Feedback Survey");
  });
});
```

### E2E Test Template
```typescript
// tests/e2e/US-C-004-create-survey.e2e.ts
test("should create a new survey through UI", async ({ page }) => {
  await page.click("button:has-text('Create Survey')");
  await page.fill('input[placeholder*="Survey Title"]', "My Survey");
  await page.click("button:has-text('Save')");
  await expect(page.locator("text=Survey saved")).toBeVisible();
});
```

---

## 📝 Test Naming Convention

Tests are mapped to user stories for traceability:

```
US-[CATEGORY]-[NUMBER]-[description].[test|e2e].ts

Categories:
- A   = Authentication
- C   = Creator (Survey Management)
- S   = Survey Building
- R   = Recipients
- RS  = Response Submission
- AN  = Analytics
- UX  = User Experience
```

---

## 📚 Dependencies Installed

### Testing Libraries
- ✅ `@playwright/test` - E2E testing framework
- ✅ `supertest` - HTTP assertions for API testing
- ✅ `@types/supertest` - TypeScript types
- ✅ `uuid` - Generate test IDs
- ✅ `@types/uuid` - TypeScript types
- ✅ `@vitest/coverage-v8` - Code coverage
- ✅ `@vitest/ui` - Interactive test UI
- ✅ `vitest` - Unit testing framework

### Playwright Browsers
- ✅ Chromium 141.0.7390.37
- ✅ Firefox 142.0.1
- ✅ WebKit 26.0
- ✅ Mobile Chrome & Safari emulation

---

## 🚀 Quick Start

### Run Passing Tests
```bash
npm run test:unit
# ✅ 3/3 tests passing (simple verification tests)
```

### Re-enable Template Tests

To work on fixing a test, rename it from `.skip.ts` to `.test.ts`:

```bash
# Example: Enable SurveyRepository tests
mv tests/unit/repositories/SurveyRepository.test.skip.ts \
   tests/unit/repositories/SurveyRepository.test.ts

# Then fix the mocking and run
npm run test:unit
```

---

## 🎯 Recommended Next Steps

1. **Choose Your Approach**
   - For true unit tests: Use Option 1 (mock everything)
   - For integration tests: Use Option 3 (test database)
   - For quick prototyping: Use Option 2 (SQLite)

2. **Start Small**
   - Pick one test file (e.g., `conditionalLogic.test.skip.ts`)
   - Implement the missing functions or add proper mocks
   - Get it passing
   - Repeat for other files

3. **CI/CD Integration**
   - Add GitHub Actions workflow
   - Run tests on every push
   - Report coverage

4. **Update Documentation**
   - Update this file as tests become functional
   - Document actual coverage metrics

---

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)

---

## Summary

**Current State:** 🟡 3/3 passing (simple tests)
**Potential:** 🎯 100+ tests once mocking is configured
**Action Required:** Choose mocking strategy and implement
**Infrastructure:** ✅ Complete and ready

The test framework infrastructure is in place - tests just need proper database mocking or test database configuration to run!

---

**Framework Version:** 1.0.0
**Last Updated:** 2025-10-28
**Status:** Templates committed, awaiting configuration
