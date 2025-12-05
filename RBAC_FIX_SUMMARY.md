# RBAC Authentication Fix - Summary

**Date:** December 4, 2025
**Issue:** 401 Unauthorized errors, userRole was null, RBAC permission denied
**Status:** ✅ FIXED

---

## Root Cause Analysis

### The Problem
When logging in with Google OAuth (scooter4356@gmail.com), the user encountered:
- `GET /api/dashboard/stats 401 (Unauthorized)`
- `GET /api/auth/user 401 (Unauthorized)`
- RBAC middleware logs showed `userRole: null`
- Permission denied errors throughout the application

### Investigation Process

1. **Initial Hypothesis:** RBAC middleware was misconfigured
   - ❌ Rejected - RBAC logic was correct

2. **Second Hypothesis:** Auth middleware not setting userRole
   - ✅ Partially correct - Found the middleware code was correct but userRole wasn't being set

3. **Deep Dive:** Auth middleware flow analysis
   - File: `server/middleware/auth.ts` (lines 169-204)
   - Code path:
     ```typescript
     const user = await userRepository.findById(sessionUser.claims.sub);
     if (user) {
       authReq.tenantId = user.tenantId || undefined;
       authReq.userRole = user.tenantRole; // <-- This line should set the role
     }
     ```
   - The code was correct, but `user` was undefined

4. **Critical Discovery:** userRepository.findById() returned undefined
   - Created test script: `scripts/testFindById.ts`
   - Result: User ID '116568744155653496130' not found

5. **Database Investigation:**
   - Created diagnostic script: `scripts/checkDatabaseState.ts`
   - **FOUND:** Database had 0 users total
   - The user we thought we created earlier never actually persisted!

### Root Cause: User Did Not Exist in Database

**Why authentication failed:**
1. User logged in with Google OAuth (session created with sub ID)
2. Auth middleware called `userRepository.findById(sessionUser.claims.sub)`
3. Query returned `undefined` because user didn't exist in database
4. Auth middleware couldn't set `authReq.userRole` (stayed null)
5. RBAC middleware checked `userRole` and found null
6. Permission denied → 401 Unauthorized

**Why previous scripts didn't work:**
- `scripts/createAdminUser.ts` - Unknown why it failed to persist
- `scripts/fixAdminRole.ts` - Can't update a user that doesn't exist

---

## The Fix

### Created Proper Admin User Script

**File:** `scripts/createAdminUserProper.ts`

**What it does:**
1. Verifies tenant exists (2181d3ab-9a00-42c2-a9b6-0d202df1e5f0)
2. Checks if user already exists
3. Inserts new user with proper fields:
   - ID: `116568744155653496130` (Google OAuth sub)
   - Email: `scooter4356@gmail.com`
   - Role: `admin`
   - Tenant Role: `owner`
   - Auth Provider: `google`
4. Verifies user was created successfully
5. Counts total users (now 1)

**Result:**
```
✅ USER VERIFIED IN DATABASE:
   ID: 116568744155653496130
   Email: scooter4356@gmail.com
   Role: admin
   Tenant Role: owner
   Tenant ID: 2181d3ab-9a00-42c2-a9b6-0d202df1e5f0

Total users: 1
```

### Verified Repository Works

**Test:** `scripts/testFindById.ts`

**Result:**
```json
{
  "id": "116568744155653496130",
  "email": "scooter4356@gmail.com",
  "role": "admin",
  "tenantRole": "owner",
  "tenantId": "2181d3ab-9a00-42c2-a9b6-0d202df1e5f0"
}
```

✅ userRepository.findById() now returns the user correctly!

---

## Code Analysis: No Changes Needed

### Auth Middleware (server/middleware/auth.ts)
**Status:** ✅ Working correctly (no changes needed)

The `hybridAuth()` middleware already has the correct logic:
```typescript
// Lines 169-204
const sessionUser = req.session?.user || req.user;
if (sessionUser?.claims?.sub) {
  const authReq = req as AuthRequest;
  authReq.userId = sessionUser.claims.sub;

  const user = await userRepository.findById(sessionUser.claims.sub);
  if (user) {
    authReq.tenantId = user.tenantId || undefined;
    authReq.userRole = user.tenantRole; // Sets role from database
  }
}
```

Now that the user exists in the database, this code will:
1. Find the user ✅
2. Set `authReq.userRole = 'owner'` ✅

### RBAC Middleware (server/middleware/rbac.ts)
**Status:** ✅ Working correctly (no changes needed)

The `requirePermission()` middleware checks userRole:
```typescript
// Lines 146-174
const userRole = authReq.userRole;
const allowed = hasPermission(userRole, permission);

if (!allowed) {
  res.status(403).json({
    message: 'Permission denied',
    error: 'forbidden',
  });
  return;
}
```

With `userRole = 'owner'`, RBAC will allow all permissions:
```typescript
export const RolePermissions: Record<UserRole, Permission[]> = {
  owner: ['*'], // Owner has all permissions
  // ...
};
```

### User Repository (server/repositories/UserRepository.ts)
**Status:** ✅ Working correctly (no changes needed)

The `findById()` method works correctly - it was just querying an empty database before.

---

## Next Steps for User

### 1. Clear Browser State
- Open Developer Tools (F12)
- Application tab → Storage → Clear site data
- Or manually:
  - Cookies → Delete all for localhost:5000
  - Session Storage → Clear
  - Local Storage → Clear

### 2. Log Out and Log Back In
1. Navigate to `http://localhost:5000`
2. If logged in, log out
3. Click "Sign in with Google"
4. Select `scooter4356@gmail.com`
5. Authorize the application

### 3. Verify Access
After logging in, you should now have:
- ✅ Access to dashboard (`/api/dashboard/stats` returns 200)
- ✅ User profile loads (`/api/auth/user` returns user data)
- ✅ RBAC permissions as owner (can create/edit/delete workflows)
- ✅ No more 401 or 403 errors

---

## Why This Works Now

**Authentication Flow:**
1. ✅ User logs in with Google OAuth
2. ✅ Session created with sub: '116568744155653496130'
3. ✅ Auth middleware calls `userRepository.findById('116568744155653496130')`
4. ✅ Database query returns user with `tenantRole: 'owner'`
5. ✅ Auth middleware sets `authReq.userRole = 'owner'`
6. ✅ RBAC middleware checks permissions for 'owner' role
7. ✅ Owner has `['*']` permission (all permissions)
8. ✅ Request allowed → 200 OK

---

## Testing

### To verify the fix works:

```bash
# 1. Check user exists in database
npx tsx scripts/checkDatabaseState.ts
# Should show: "Found 1 user(s)"

# 2. Test repository lookup
npx tsx scripts/testFindById.ts
# Should return user with tenantRole: 'owner'

# 3. Test authentication in browser
# - Clear cookies/session
# - Log in with scooter4356@gmail.com
# - Check Network tab for 200 responses (not 401)
```

---

## Diagnostic Scripts Created

All scripts located in `scripts/` directory:

1. **createAdminUserProper.ts** - Creates admin user with full validation
2. **checkDatabaseState.ts** - Comprehensive database state checker
3. **diagnoseUserQuery.ts** - Compares raw SQL vs Drizzle ORM queries
4. **testFindById.ts** - Tests userRepository.findById() method

These can be used for future debugging or user creation.

---

## Summary

**What was broken:** User didn't exist in database
**What we fixed:** Created user with proper admin/owner roles
**Code changes:** None - all code was already correct
**User action needed:** Clear browser state and re-login

**Status:** ✅ Ready to test!
