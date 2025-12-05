# Test Failure Pattern Analysis
**Date:** December 5, 2025
**Total Failures:** 23 tests across 5 files

---

## Pattern 1: Test Isolation Issue ⭐ **HIGHEST IMPACT**
**Files:** `api.workflows.test.ts`
**Failures:** 12 tests (52% of total)

### Common Characteristics:
- ✅ **ALL tests PASS when run in isolation** (17/17 = 100%)
- ❌ **71% FAIL when run in full suite** (12/17 failures)
- **Tests affected:**
  - PATCH /api/workflows/:id - Update operations (2 tests)
  - POST /api/workflows/:id/publish - Publish operation (1 test)
  - GET /api/workflows/:id/versions - Version listing (1 test)
  - PUT /api/workflows/:id/move - All move operations (8 tests)

### Root Cause:
**Test interference / shared state between integration test files**
- Database state not properly isolated
- Tenant/user/workflow IDs may be colliding
- Cleanup not thorough enough between test files

### Single Fix Potential: **VERY HIGH**
✅ **Fixing test isolation will resolve ALL 12 failures**
- One infrastructure fix = 52% reduction in failures!
- Not 12 separate bugs - one systemic issue

### Recommended Solution:
1. Add unique prefix/suffix to all test data (tenant names, user emails)
2. Ensure cleanup runs BEFORE each test file (not just after)
3. Consider using isolated database schemas per test file
4. Add timeout between test file executions
5. Verify no global state leakage (ports, singletons, caches)

---

## Pattern 2: DataVault Permission Errors 🔧 **HIGH IMPACT**
**Files:** `datavault-v4-regression.test.ts`
**Failures:** 6 tests (26% of total)

### Common Characteristics:
- **ALL permission endpoint tests returning 500 errors**
- Expected: 200 (success) or 403 (forbidden)
- Receiving: 500 (internal server error)
- **Tests affected:**
  1. Grant table permission
  2. Update table permission role
  3. Revoke table permission
  4. RBAC enforcement (owner-only check)
  5. Multiselect validation
  6. Row notes deletion by other users

### Error Pattern:
```
Error: Access denied - owner permission required
Status: 500 (should be 403)
```

### Root Cause:
**Missing error handling in permission service**
- Permission checks throwing exceptions instead of returning proper status codes
- RBAC validation errors not caught and converted to HTTP responses
- Likely: try-catch missing in route handlers

### Single Fix Potential: **HIGH**
✅ **4 of 6 failures share identical error pattern**
- Fixing permission endpoint error handling = 4 tests fixed
- Remaining 2 (multiselect, notes) may be separate issues

### Recommended Solution:
1. Review `server/routes/datavault-*.routes.ts` for missing try-catch
2. Ensure RBAC errors return 403, not 500
3. Add proper error transformation in middleware
4. Check TablePermissionService for throwing errors vs returning results

---

## Pattern 3: Tenant Isolation Failures 🎯 **MEDIUM IMPACT**
**Files:** `api.runs.graph.test.ts`, `auth-jwt.integration.test.ts`
**Failures:** 3 tests (13% of total)

### Common Characteristics:
- **All related to tenant scoping/isolation**
- Tests expect tenant boundaries to be enforced
- **Tests affected:**
  1. Run comparison 404 handling
  2. Tenant isolation on runs list
  3. RBAC - only owner can update tenant

### Root Cause:
**Inconsistent tenant scoping in queries**
- Some endpoints not filtering by tenantId
- RBAC checks not verifying tenant ownership
- Cross-tenant access not properly blocked

### Single Fix Potential: **MEDIUM**
⚠️ **Likely 2-3 separate fixes needed**
- Runs API tenant scoping (1 fix → 2 tests)
- Tenant update RBAC (1 fix → 1 test)

### Recommended Solution:
1. Review RunService for missing `WHERE tenantId = ?`
2. Add tenant ownership check in tenant update endpoint
3. Ensure all queries include tenant scoping by default

---

## Pattern 4: Session Management 🔵 **LOW IMPACT**
**Files:** `auth-oauth.integration.test.ts`
**Failures:** 2 tests (9% of total)

### Common Characteristics:
- **Both related to OAuth session lifecycle**
- Session persistence and destruction issues
- **Tests affected:**
  1. Logout - session destruction
  2. (One other session-related test)

### Root Cause:
**Cookie/session handling in test environment**
- Session middleware may not be properly configured for tests
- Cookie persistence across requests
- Session store cleanup

### Single Fix Potential: **MEDIUM**
⚠️ **May be test environment limitation**
- Could require test-specific session configuration
- Acceptable to skip if it's a testing limitation (not production issue)

### Recommended Solution:
1. Configure supertest to handle cookies properly
2. Ensure session store is cleared between tests
3. May need to use `supertest.agent()` for session persistence
4. Consider skipping if this is a test-only issue

---

## Summary: Common Fixes by Impact

### 🏆 Tier 1: Single Fix = Multiple Tests (68% of failures)
1. **Test Isolation** → Fixes 12 tests (52%)
2. **Permission Error Handling** → Fixes 4 tests (17%)

**Total Impact:** 16 tests fixed with 2 infrastructure improvements

### 🎯 Tier 2: Related Fixes (13% of failures)
3. **Tenant Scoping** → Fixes 2-3 tests (13%)

### 🔵 Tier 3: Individual Fixes (19% of failures)
4. **Multiselect Validation** → 1 test
5. **Row Notes RBAC** → 1 test
6. **Session Management** → 2 tests (may skip)

---

## Recommended Fix Order

### Phase 1: Test Infrastructure (2-3 hours)
✅ Fix test isolation → **12 tests fixed** (23 → 11)
- Highest impact
- Pure infrastructure improvement
- Validates our test framework

### Phase 2: Permission Service (2 hours)
✅ Add error handling to permission endpoints → **4 tests fixed** (11 → 7)
- Clear error pattern
- Application improvement (not just tests)
- Prevents 500 errors in production

### Phase 3: Tenant Scoping (1-2 hours)
✅ Fix runs API and tenant update RBAC → **3 tests fixed** (7 → 4)
- Business logic fixes
- Improves security

### Phase 4: Remaining Issues (2-3 hours)
✅ Individual fixes for multiselect, notes, sessions → **4 tests fixed** (4 → 0)
- May skip session tests if test-only limitation

**Total Time:** 7-10 hours to 100% passing tests

---

## Key Insight

**78% of failures (18/23) can be fixed with just 3 changes:**
1. Test isolation infrastructure
2. Permission endpoint error handling
3. Tenant scoping in queries

This validates the "great long-term code over passing tests" approach.
We're fixing **root causes**, not patching individual symptoms.
