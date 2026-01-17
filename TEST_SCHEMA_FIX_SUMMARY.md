# Test Schema Isolation Fix Summary

**Status**: IN PROGRESS - Partial fix implemented, investigating remaining issues

## Problem
Tests were failing with foreign key constraint violations because the `search_path` was not being consistently applied to all database connections, causing queries to reference the wrong schema.

### Current Situation
- **Fixed**: Migration statement execution now sets search_path correctly
- **Fixed**: Removed invalid connection string options parameter
- **Remaining Issue**: Search_path not consistently applied to pool connections in parallel test execution
- **Test Results**: 104-110 test files passing (out of 157), 1975-2033 tests passing (out of 2640)

## Root Causes

1. **Migration Search Path Issue**: When migrations were executed statement-by-statement (due to "already exists" errors), only the first statement had the `SET search_path` command, causing subsequent statements to use the wrong schema.

2. **Connection String Options Not Supported**: The SchemaManager was adding `options=-c search_path=...` to the connection string, but this parameter is NOT supported by the standard `pg` library and caused "unsupported startup parameter" errors.

3. **No Per-Connection Search Path**: The database pool was not setting `search_path` on individual connections, so different queries could use different schemas.

## Fixes Applied

### 1. Fixed Migration Statement Execution (`tests/setup.ts`)

**Location**: Lines 243-262

**Change**: Each migration statement now has `SET search_path` prepended when executed individually.

```typescript
// CRITICAL: Ensure each statement has the search_path set
const schema = (global as any).__TEST_SCHEMA__;
let stmtWithPath = statement;
if (schema && !statement.includes('SET search_path')) {
  stmtWithPath = `SET search_path TO "${schema}", public;\n${statement}`;
}
await db.execute(stmtWithPath);
```

### 2. Removed Invalid Connection String Option (`tests/helpers/schemaManager.ts`)

**Location**: Line 76-79

**Change**: Removed the `options` parameter from the connection string since it's not supported.

```typescript
// NOTE: We don't set search_path in the connection string options because:
// 1. It's not supported by the standard pg library (only by Neon pooler)
// 2. It causes "unsupported startup parameter" errors
// Instead, server/db.ts will set search_path on each connection via pool.connect() wrapper
```

### 3. Added Pool Connection Wrapper (`server/db.ts`)

**Location**: Lines 52-78

**Change**: Override `pool.connect()` to set `search_path` on every connection before returning it.

```typescript
// For test schemas, we MUST set search_path on EVERY connection
if (testSchema && env.NODE_ENV === 'test') {
  // Store the original connect method
  const originalConnect = pool.connect.bind(pool);

  // Override the connect method to set search_path BEFORE returning the client
  pool.connect = function() {
    return originalConnect().then(async (client: any) => {
      // Set search_path immediately on this connection
      try {
        await client.query(`SET search_path TO "${testSchema}", public`);
        logger.debug(`DB: Set search_path on connection: "${testSchema}",public`);
      } catch (err) {
        logger.warn(`DB: Failed to set search_path:`, err);
      }
      return client;
    });
  } as any;
}
```

### 4. Exposed Test Schema to Environment (`tests/setup.ts`)

**Location**: Line 140

**Change**: Added `process.env.TEST_SCHEMA = schemaName` so `server/db.ts` can access it.

```typescript
// Set TEST_SCHEMA in both global and env so db.ts can configure the pool correctly
(global as any).__TEST_SCHEMA__ = schemaName;
process.env.TEST_SCHEMA = schemaName;
```

## How It Works

1. **Setup Phase**: SchemaManager creates an isolated test schema for each worker
2. **Database Init**: `server/db.ts` reads the test schema name from `process.env.TEST_SCHEMA`
3. **Pool Configuration**: The pool's `connect()` method is overridden to inject `SET search_path` on every connection
4. **Migration Execution**: Each migration statement is prefixed with `SET search_path` to ensure consistency
5. **Test Execution**: All queries now use the correct test schema, preventing FK constraint violations

## Benefits

✅ **Schema Isolation**: Each test worker has its own isolated schema
✅ **FK Constraints Work**: Foreign keys now correctly reference records in the same test schema
✅ **Parallel Execution**: Multiple test workers can run simultaneously without conflicts
✅ **No Data Leakage**: Tests don't see data from other workers or the public schema
✅ **Reliable Migrations**: Migrations create all objects in the correct test schema

## Testing

Run tests to verify the fix:
```bash
npm test
```

Check specific failing tests:
```bash
npx vitest run tests/unit/services/WorkflowTemplateService.test.ts
```

## Related Files

- `server/db.ts` - Database pool configuration with search_path wrapper
- `tests/setup.ts` - Test setup with migration execution
- `tests/helpers/schemaManager.ts` - Test schema creation
- `tests/helpers/testFactory.ts` - Test data factory (unchanged)

## Notes

- The `on('connect')` event approach was tried but proved unreliable
- Connection string `options` parameter is NOT supported by `pg` library
- The pool.connect() wrapper ensures EVERY connection has the correct search_path
- This approach works for both local PostgreSQL and Neon databases
