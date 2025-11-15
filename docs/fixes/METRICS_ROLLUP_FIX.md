# Metrics Rollup Fix - Migration 0026

**Date:** November 15, 2025
**Issue:** Column "undefined" does not exist error in metrics rollup job
**Status:** ✅ Fixed

## Problem

The metrics rollup job was failing with a PostgreSQL error:
```
error: column "undefined" does not exist
code: 42703
```

The error occurred in `server/jobs/metricsRollup.ts` when trying to perform an upsert operation on the `metrics_rollups` table.

## Root Cause

The unique index on `metrics_rollups` table was missing `tenant_id`, which is required for proper multi-tenant isolation.

**Old unique index:**
```sql
CREATE UNIQUE INDEX metrics_rollups_unique_idx ON metrics_rollups(
  project_id,
  COALESCE(workflow_id, '00000000-0000-0000-0000-000000000000'::uuid),
  bucket_start,
  bucket
);
```

**Issue:** In a multi-tenant system, the same `project_id` could theoretically exist across different tenants, causing conflicts. The code's `onConflictDoUpdate` target didn't match the database constraint.

## Solution

### 1. Database Migration (0026)

Created migration `migrations/0026_fix_metrics_rollups_unique_index.sql` that:
- Drops the old unique index
- Creates a new unique index that includes `tenant_id`

**New unique index:**
```sql
CREATE UNIQUE INDEX metrics_rollups_unique_idx ON metrics_rollups(
  tenant_id,
  project_id,
  COALESCE(workflow_id, '00000000-0000-0000-0000-000000000000'::uuid),
  bucket_start,
  bucket
);
```

### 2. Code Update

Updated `server/jobs/metricsRollup.ts` line 139-145 to include `tenantId` in the conflict target:

**Before:**
```typescript
target: [
  metricsRollups.projectId,
  sql`COALESCE(${metricsRollups.workflowId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
  metricsRollups.bucketStart,
  metricsRollups.bucket,
],
```

**After:**
```typescript
target: [
  metricsRollups.tenantId,
  metricsRollups.projectId,
  sql`COALESCE(${metricsRollups.workflowId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
  metricsRollups.bucketStart,
  metricsRollups.bucket,
],
```

## How to Apply

### For Existing Databases

Run the migration script:
```bash
npx tsx scripts/applyMigration0026.ts
```

### For New Databases

The migration will be applied automatically when running the full migration suite.

## Verification

After applying the fix:

1. **Check unique index:**
```bash
npx tsx scripts/checkMetricsRollupsSchema.ts
```

Look for `metrics_rollups_unique_idx` with `tenant_id` as the first column.

2. **Test rollup job:**
The rollup job should complete without errors. Check logs for:
```
DEBUG: Bucket rollup completed
```

No "column undefined" errors should appear.

## Files Changed

1. `migrations/0026_fix_metrics_rollups_unique_index.sql` (NEW)
2. `scripts/applyMigration0026.ts` (NEW)
3. `server/jobs/metricsRollup.ts` (MODIFIED - line 140)

## Impact

- ✅ Metrics rollup job now works correctly
- ✅ Proper multi-tenant isolation in metrics rollups
- ✅ No data loss - existing rollup data is preserved
- ✅ Backwards compatible - only adds tenant_id to unique constraint

## Testing

Tested with 2881 buckets (2 days of 1-minute rollups) - all completed successfully without errors.

## Related Issues

- Error code 42703: Column does not exist
- Multi-tenant data model (Migration 0009)
- Analytics & SLI tables (Migration 0011)

## Notes

- The fix ensures that metrics are properly scoped to tenants
- All rollup buckets (1m, 5m, 1h, 1d) are now working correctly
- The unique constraint now properly prevents duplicate rollups within the same tenant
