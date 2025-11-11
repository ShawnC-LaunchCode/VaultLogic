# Transform Blocks Virtual Steps - Deployment Guide

**Status:** ✅ Ready to Deploy
**Date:** November 11, 2025
**Impact:** High - Fixes critical data persistence bug

## Quick Summary

This refactor fixes a critical bug where transform block outputs couldn't be persisted to the database due to UUID validation errors. The solution uses **virtual steps** - hidden steps that store computed values with proper UUIDs.

## What Changed

### Files Modified (8 files)

1. **`shared/schema.ts`** - Schema definitions
   - Added `'computed'` to `stepTypeEnum`
   - Added `isVirtual` and related indexes to `steps` table
   - Added `virtualStepId` to `transformBlocks` table

2. **`server/services/TransformBlockService.ts`** - Core logic
   - `createBlock()` - Now creates virtual step automatically
   - `updateBlock()` - Updates virtual step when outputKey/name changes
   - `deleteBlock()` - Deletes virtual step on block deletion
   - `executeBlock()` - Uses `virtualStepId` instead of `outputKey` ✅ FIXED BUG

3. **`server/repositories/StepRepository.ts`** - Data access
   - `findBySectionId()` - Added `includeVirtual` parameter (default: false)
   - `findBySectionIds()` - Added `includeVirtual` parameter (default: false)

### Files Created (3 files)

4. **`migrations/0008_add_virtual_steps_for_transform_blocks.sql`** - Schema migration
   - Adds new columns and indexes
   - Adds `'computed'` enum value

5. **`scripts/migrateTransformBlockVirtualSteps.ts`** - Data migration
   - Creates virtual steps for existing transform blocks
   - Handles edge cases and errors gracefully

6. **`docs/TRANSFORM_BLOCKS_VIRTUAL_STEPS_REFACTOR.md`** - Documentation
   - Complete technical documentation
   - Architecture diagrams
   - Testing guide

## Deployment Steps

### Step 1: Backup Database

```bash
# Production backup
pg_dump $DATABASE_URL > backup_before_virtual_steps_$(date +%Y%m%d).sql
```

### Step 2: Deploy Code

```bash
# Pull latest code
git pull origin main

# Install dependencies (if needed)
npm install

# Build
npm run build
```

### Step 3: Apply Schema Migration

```bash
# Run migrations
npm run db:migrate
```

**Expected Output:**
```
✓ Applied migration: 0008_add_virtual_steps_for_transform_blocks.sql
```

**Verification:**
```sql
-- Verify new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'steps' AND column_name IN ('is_virtual');

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'transform_blocks' AND column_name = 'virtual_step_id';
```

### Step 4: Run Data Migration

```bash
# Create virtual steps for existing blocks
tsx scripts/migrateTransformBlockVirtualSteps.ts
```

**Expected Output:**
```
=================================
Migration Results:
  Migrated: X
  Skipped:  0
  Errors:   0
=================================
```

**What to do if errors occur:**
- Check the error messages
- Common issues:
  - Workflow has no sections → Create a section first
  - Database connection issues → Check DATABASE_URL
- Re-run the script (it's idempotent)

### Step 5: Restart Services

```bash
# Restart the application
pm2 restart vault-logic
# or
systemctl restart vault-logic
```

### Step 6: Verify Deployment

#### 6.1 Check Logs

```bash
tail -f logs/app.log | grep -i "transform"
```

**Look for:**
```
✓ Created transform block with virtual step
✓ Persisted transform block output to virtual step
```

**Should NOT see:**
```
✗ Failed to persist transform block output
✗ ERROR: invalid input syntax for type uuid
```

#### 6.2 Test Transform Block Creation

```bash
curl -X POST http://localhost:3000/api/workflows/{workflowId}/transform-blocks \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "name": "Test Block",
    "outputKey": "test_output",
    "language": "javascript",
    "code": "return \"Hello World\";",
    "inputKeys": [],
    "phase": "onSectionSubmit",
    "order": 0
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "Test Block",
    "outputKey": "test_output",
    "virtualStepId": "uuid-here" // ← Should be present!
  }
}
```

#### 6.3 Test Transform Block Execution

```bash
# Create a run
curl -X POST http://localhost:3000/api/workflows/{workflowId}/runs

# Execute transform blocks (happens automatically on section submit)
# ...submit section values...

# Check that output was persisted
curl -X GET http://localhost:3000/api/runs/{runId}/values \
  -H "Authorization: Bearer {runToken}"
```

**Expected:** Output values present with no errors

### Step 7: Monitor Production

**For the next 24 hours, monitor:**

1. **Error Logs**
   ```bash
   tail -f logs/error.log | grep -i "transform\|virtual\|uuid"
   ```

2. **Database Queries**
   ```sql
   -- Count transform blocks without virtual steps
   SELECT COUNT(*)
   FROM transform_blocks
   WHERE virtual_step_id IS NULL;
   -- Should be 0
   ```

3. **Application Metrics**
   - No increase in 500 errors
   - Transform block execution success rate
   - Step value insertion rate

## Rollback Plan

If critical issues arise:

### Option 1: Code Rollback (Keep Data)

```bash
# Revert to previous version
git revert HEAD
npm run build
pm2 restart vault-logic
```

**Note:** Virtual steps will remain in database but won't cause issues

### Option 2: Full Rollback (Remove Everything)

```bash
# 1. Revert code
git revert HEAD
npm run build

# 2. Remove virtual steps
psql $DATABASE_URL << EOF
DELETE FROM steps WHERE is_virtual = true;
UPDATE transform_blocks SET virtual_step_id = NULL;
EOF

# 3. Restart
pm2 restart vault-logic
```

## Success Criteria

✅ Schema migration applied successfully
✅ All existing transform blocks have virtual steps
✅ New transform blocks create virtual steps automatically
✅ Transform block outputs persist without UUID errors
✅ Virtual steps hidden from UI (builder, preview)
✅ No increase in error rates
✅ Application logs show successful persistence

## FAQ

### Q: Will this affect existing workflows?

**A:** No. Existing workflows continue to work. The data migration adds virtual steps retroactively for transform blocks that already exist.

### Q: What happens to transform blocks created before migration?

**A:** The data migration script creates virtual steps for all existing blocks. They'll work the same as new blocks after migration.

### Q: Can users see virtual steps in the builder?

**A:** No. Virtual steps are automatically filtered from UI queries (`isVirtual=true`). Users only see their own created steps.

### Q: What if a virtual step is manually deleted?

**A:** The transform block's `virtualStepId` will be set to `NULL` (cascade). The block will continue to exist but won't be able to persist outputs. The system logs a warning.

### Q: Can transform blocks reference other transform blocks' outputs?

**A:** Yes! This is the whole point. Virtual steps have aliases (the `outputKey`), so blocks can reference each other's computed values.

### Q: Do I need to update the frontend?

**A:** No. The virtual steps are completely transparent to the frontend. The API responses are unchanged (except for the informational `virtualStepId` field).

## Troubleshooting

### Issue: Migration script fails with "workflow has no sections"

**Solution:**
```sql
-- Find problematic workflows
SELECT w.id, w.title, COUNT(s.id) as section_count
FROM workflows w
LEFT JOIN sections s ON w.id = s.workflow_id
WHERE w.id IN (SELECT DISTINCT workflow_id FROM transform_blocks)
GROUP BY w.id, w.title
HAVING COUNT(s.id) = 0;

-- Add a section manually
INSERT INTO sections (workflow_id, title, "order")
VALUES ('{workflow-id}', 'Main Section', 0);
```

### Issue: "Failed to persist transform block output"

**Check:**
1. Is `virtualStepId` set on the block?
   ```sql
   SELECT id, name, virtual_step_id FROM transform_blocks WHERE virtual_step_id IS NULL;
   ```

2. Does the virtual step exist?
   ```sql
   SELECT s.*
   FROM steps s
   JOIN transform_blocks tb ON s.id = tb.virtual_step_id
   WHERE tb.id = '{block-id}';
   ```

3. Re-run data migration if needed

### Issue: Virtual steps showing in UI

**Check:**
```typescript
// Verify queries use includeVirtual=false (default)
await stepRepo.findBySectionId(sectionId); // Should exclude virtual
await stepRepo.findBySectionId(sectionId, undefined, true); // Includes virtual
```

## Support

For issues or questions:
1. Check this deployment guide
2. See `/docs/TRANSFORM_BLOCKS_VIRTUAL_STEPS_REFACTOR.md` for technical details
3. Review error logs and error context
4. Contact DevOps team for database issues

---

**Deployed by:** _________________
**Date:** _________________
**Status:** ☐ Success  ☐ Partial  ☐ Rolled Back
**Notes:** _________________________________
