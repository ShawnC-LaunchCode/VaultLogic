# How to Apply Index Migrations (0057-0059)

Quick guide for applying the database index migrations.

---

## Option 1: Apply All Migrations at Once (Recommended)

```bash
# Connect to your database and run all three migrations
psql $DATABASE_URL << 'EOF'
\i migrations/0057_add_step_values_composite_index.sql
\i migrations/0058_add_logic_rules_indexes.sql
\i migrations/0059_add_performance_indexes.sql
EOF
```

---

## Option 2: Apply One at a Time

```bash
# Step 1: Apply step_values composite index (HIGHEST PRIORITY)
psql $DATABASE_URL -f migrations/0057_add_step_values_composite_index.sql

# Step 2: Apply logic_rules indexes
psql $DATABASE_URL -f migrations/0058_add_logic_rules_indexes.sql

# Step 3: Apply performance indexes
psql $DATABASE_URL -f migrations/0059_add_performance_indexes.sql
```

---

## Option 3: Using Drizzle Kit

If you're using Drizzle Kit for migrations:

```bash
# Drizzle should automatically detect these SQL files
npm run db:push

# Or using drizzle-kit directly
npx drizzle-kit push:pg
```

---

## Verify Indexes Were Created

```bash
# Run the verification script
psql $DATABASE_URL -f scripts/verify-indexes.sql
```

Expected output should show all 13 indexes as "FOUND" with green checkmarks.

---

## Quick Manual Verification

```sql
-- Connect to your database
psql $DATABASE_URL

-- List all new indexes
SELECT tablename, indexname
FROM pg_indexes
WHERE indexname LIKE 'idx_step_values_run_step'
   OR indexname LIKE 'idx_logic_rules_%'
   OR indexname LIKE 'idx_workflow_runs_%'
   OR indexname LIKE 'idx_audit_logs_%'
   OR indexname LIKE 'idx_analytics_events_%'
   OR indexname LIKE 'idx_script_execution_log_%'
ORDER BY tablename, indexname;
```

You should see 13 indexes total.

---

## Troubleshooting

### Error: "relation does not exist"

**Problem:** Table doesn't exist in your database.

**Solution:** Run earlier migrations first, or check that your database schema is up to date.

```bash
# Apply all previous migrations
npm run db:push
```

### Error: "index already exists"

**Problem:** Index was already created (migrations are idempotent).

**Solution:** This is not an error - the migration uses `IF NOT EXISTS` so it's safe to re-run.

### Error: Permission denied

**Problem:** Database user doesn't have permission to create indexes.

**Solution:** Connect as a superuser or grant CREATE privilege:

```sql
GRANT CREATE ON SCHEMA public TO your_user;
```

---

## Performance Testing

After applying the indexes, test the performance improvement:

```sql
-- Before and after comparison for step_values lookup
EXPLAIN ANALYZE
SELECT * FROM step_values
WHERE run_id = 'some-run-id'
  AND step_id = 'some-step-id';
```

Look for "Index Scan using idx_step_values_run_step" instead of "Seq Scan".

---

## Rollback (If Needed)

If you need to remove these indexes:

```bash
# Run the rollback SQL
psql $DATABASE_URL << 'EOF'
-- 0057 rollback
DROP INDEX IF EXISTS idx_step_values_run_step;

-- 0058 rollback
DROP INDEX IF EXISTS idx_logic_rules_target_step;
DROP INDEX IF EXISTS idx_logic_rules_target_section;
DROP INDEX IF EXISTS idx_logic_rules_workflow;

-- 0059 rollback
DROP INDEX IF EXISTS idx_workflow_runs_completed_at;
DROP INDEX IF EXISTS idx_workflow_runs_workflow_completed;
DROP INDEX IF EXISTS idx_workflow_runs_status;
DROP INDEX IF EXISTS idx_audit_logs_timestamp;
DROP INDEX IF EXISTS idx_audit_logs_user_timestamp;
DROP INDEX IF EXISTS idx_audit_logs_resource;
DROP INDEX IF EXISTS idx_analytics_events_workflow_timestamp;
DROP INDEX IF EXISTS idx_analytics_events_type_timestamp;
DROP INDEX IF EXISTS idx_script_execution_log_run;
DROP INDEX IF EXISTS idx_script_execution_log_failures;
EOF
```

---

## Production Deployment Checklist

- [ ] Test migrations on development database first
- [ ] Run verification script to confirm all indexes created
- [ ] Check query execution plans with `EXPLAIN ANALYZE`
- [ ] Monitor index usage with `pg_stat_user_indexes`
- [ ] Apply to staging environment
- [ ] Monitor performance for 24 hours
- [ ] Apply to production (indexes are created online, no downtime)
- [ ] Verify production performance improvements

---

## Support

For issues or questions:
1. Check the INDEX_MIGRATION_SUMMARY.md for detailed documentation
2. Review the SQL comments in each migration file
3. Contact the development team
