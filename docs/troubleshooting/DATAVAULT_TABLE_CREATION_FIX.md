# DataVault Table Creation Error - Fix Guide

## Issue Description

When attempting to create or list DataVault tables, you may encounter a 500 Internal Server Error with the message:

```
Tenant ID not found in session
```

or in the improved error message:

```
Your account is not properly configured. Please log out and log back in to fix this issue.
```

## Root Cause

This error occurs when a user's account in the database doesn't have a `tenantId` assigned. This typically happens when:

1. The user account was created before the multi-tenant data model was added (migration 0009)
2. The user logged in before the `tenantId` field was properly populated
3. The database migration didn't properly assign a default tenant to existing users

## Solution

There are two ways to fix this issue:

### Option 1: Quick Fix (Recommended for End Users)

Simply **log out and log back in**. The authentication system will now automatically:
1. Find or create a default tenant
2. Assign the tenant to your user account
3. Store the `tenantId` in your session

**Steps:**
1. Click your profile menu
2. Select "Log out"
3. Log back in with Google OAuth
4. Try creating a DataVault table again

### Option 2: Manual Database Fix (For Administrators)

If Option 1 doesn't work or you need to fix multiple users at once, run the database fix script:

```bash
# From the project root directory
npx tsx scripts/fixUserTenantIds.ts
```

**What this script does:**
1. Checks for all users without a `tenantId`
2. Creates a default tenant if none exists
3. Assigns the default tenant to all users without one
4. Provides detailed logging of the process

**Expected output:**
```
🔍 Checking for users without tenantId...
Found 1 users without tenantId
🔧 Assigning tenantId abc123... to 1 users...
  ✅ Updated user user@example.com
✅ All users now have tenantId assigned

⚠️  IMPORTANT: Users need to log out and log back in for changes to take effect
```

## Prevention

This issue should not occur for new users as of the following changes:

1. **Updated Authentication Flow** (server/googleAuth.ts:100-136)
   - The `upsertUser()` function now ensures all users get a default tenant
   - If no tenant exists, one is created automatically

2. **Improved Error Messages** (server/routes/datavault.routes.ts:25-38)
   - The error message now clearly instructs users to log out and log back in
   - Server logs include the user's ID and email for debugging

3. **Database Migration** (migrations/0009_add_multi_tenant_data_model.sql)
   - Adds the `tenantId` column to the users table
   - Creates the tenants table with proper relationships

## Technical Details

### Database Schema

The `users` table should have:
```sql
ALTER TABLE users ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
```

### Session Object Structure

After successful login, the session should contain:
```javascript
{
  id: "user-uuid",
  email: "user@example.com",
  tenantId: "tenant-uuid",  // ← This must be present
  tenantRole: "owner",
  role: "creator",
  defaultMode: "easy",
  claims: { ... }
}
```

### API Route Protection

All DataVault routes use the `getTenantId()` helper which:
1. Checks if `req.user.tenantId` exists
2. Throws a clear error if missing
3. Returns the tenantId for database queries

## Testing

To verify the fix worked:

1. **Check User Session:**
   ```javascript
   // In browser console (with dev tools)
   fetch('/api/datavault/tables?stats=true')
     .then(r => r.json())
     .then(console.log);
   ```

2. **Check Database:**
   ```sql
   SELECT id, email, tenant_id FROM users WHERE email = 'your@email.com';
   ```
   The `tenant_id` column should NOT be NULL.

3. **Check Server Logs:**
   If the error persists, check server logs for:
   ```
   User session missing tenantId - user may need to log out and log back in
   ```

## Related Issues

- See `CLAUDE.md` section on "Troubleshooting & Common Issues"
- Migration 0024: Database schema synchronization
- Migration 0009: Multi-tenant data model

## Support

If this issue persists after trying both solutions:

1. Check server logs for detailed error messages
2. Verify database migrations have been applied: `npm run db:push`
3. Ensure environment variables are set correctly (DATABASE_URL, etc.)
4. Create a GitHub issue with:
   - Full error message
   - Server logs
   - Output from the fix script

---

**Last Updated:** November 18, 2025
**Related Files:**
- `server/routes/datavault.routes.ts:25-38`
- `server/googleAuth.ts:100-136`
- `scripts/fixUserTenantIds.ts`
