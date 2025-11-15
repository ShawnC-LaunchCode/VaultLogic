# Using onConflictDoUpdate with Expression-Based Unique Indexes in Drizzle ORM

**Date:** November 15, 2025
**Version:** 1.0
**Author:** Development Team
**Status:** Complete & Tested

---

## Overview

This guide explains how to use Drizzle ORM's `onConflictDoUpdate` method with unique indexes that contain SQL expressions (like `COALESCE`), which is critical for handling nullable columns and complex uniqueness constraints.

## The Problem

When you have a unique index that includes a SQL expression (not just column references), directly referencing columns in the `target` parameter of `onConflictDoUpdate` can fail or produce unexpected behavior.

### Example: Metrics Rollup Scenario

You want to track metrics with a nullable `workflow_id`. A row should be unique based on:
- tenant_id
- project_id
- workflow_id (with NULL treated as a specific value)
- bucket_start
- bucket

PostgreSQL requires using `COALESCE` to handle NULLs properly in the unique constraint, but Drizzle's `onConflictDoUpdate` needs to match this constraint exactly.

---

## Solution: Using `sql()` for Expression-Based Targets

The key insight: **Include the exact SQL expression in the `target` array of `onConflictDoUpdate`**.

### Schema Definition

```typescript
// shared/schema.ts
import { uniqueIndex, pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const metricsRollups = pgTable("metrics_rollups", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull(),
  projectId: uuid("project_id").notNull(),
  workflowId: uuid("workflow_id"), // NULLABLE
  bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
  bucket: text("bucket").notNull(),
  // ... other fields
}, (table) => [
  // CRITICAL: This unique index includes a COALESCE expression for nullable workflow_id
  uniqueIndex("metrics_rollups_unique_idx").on(
    table.tenantId,
    table.projectId,
    sql`COALESCE(${table.workflowId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
    table.bucketStart,
    table.bucket
  ),
  // ... other indexes
]);
```

### Upsert Operation

```typescript
// server/jobs/metricsRollup.ts
import { db } from '../db';
import { metricsRollups } from '@shared/schema';
import { sql } from 'drizzle-orm';

const rollupData = {
  tenantId: 'tenant-123',
  projectId: 'project-456',
  workflowId: null, // Could be NULL
  bucketStart: new Date(),
  bucket: '1m',
  runsCount: 42,
  // ... other metrics
};

// The KEY: target array must match the unique index EXACTLY
const [result] = await db
  .insert(metricsRollups)
  .values(rollupData)
  .onConflictDoUpdate({
    target: [
      metricsRollups.tenantId,
      metricsRollups.projectId,
      // MUST use the exact same sql() expression as in the unique index
      sql`COALESCE(${metricsRollups.workflowId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      metricsRollups.bucketStart,
      metricsRollups.bucket,
    ],
    set: {
      runsCount: rollupData.runsCount,
      // ... other fields to update
      updatedAt: new Date(),
    },
  })
  .returning();
```

---

## Best Practices

### 1. **Always Match Unique Index Definition Exactly**

The `target` array in `onConflictDoUpdate` must match your unique index definition column-for-column and expression-for-expression.

```typescript
// SCHEMA
uniqueIndex("idx").on(
  table.col1,
  sql`COALESCE(${table.col2}, 'default')`,
  table.col3,
)

// UPSERT - Must match exactly
.onConflictDoUpdate({
  target: [
    myTable.col1,
    sql`COALESCE(${myTable.col2}, 'default')`, // Same expression
    myTable.col3,
  ],
  // ...
})
```

### 2. **Use Named Constants for Complex Expressions**

When using the same expression multiple times, define it as a constant:

```typescript
const WORKFLOW_ID_COALESCE = (table: typeof metricsRollups) =>
  sql`COALESCE(${table.workflowId}, '00000000-0000-0000-0000-000000000000'::uuid)`;

// In schema
uniqueIndex("metrics_rollups_unique_idx").on(
  table.tenantId,
  table.projectId,
  WORKFLOW_ID_COALESCE(table),
  table.bucketStart,
  table.bucket,
)

// In upsert
.onConflictDoUpdate({
  target: [
    metricsRollups.tenantId,
    metricsRollups.projectId,
    WORKFLOW_ID_COALESCE(metricsRollups),
    metricsRollups.bucketStart,
    metricsRollups.bucket,
  ],
  // ...
})
```

### 3. **Null Handling Strategies**

#### Option A: COALESCE (Recommended)
Treats NULL as a specific value for uniqueness purposes:

```typescript
sql`COALESCE(${table.nullable_col}, '00000000-0000-0000-0000-000000000000'::uuid)`
```

**Pros:**
- Enforces uniqueness where a single NULL value exists
- Multiple rows with NULL are not allowed (they all map to the same default value)

**Cons:**
- Requires explicit default value per data type
- Less flexible for certain scenarios

#### Option B: Partial Indexes
Only enforce uniqueness when column is NOT NULL:

```typescript
// In schema
uniqueIndex("idx").on(
  table.col1,
  table.nullable_col,
)
.where(sql`${table.nullable_col} IS NOT NULL`)

// In upsert
.onConflictDoUpdate({
  target: [
    myTable.col1,
    myTable.nullable_col,
  ],
  targetWhere: sql`${myTable.nullable_col} IS NOT NULL`,
  // ...
})
```

**Pros:**
- Multiple NULLs are allowed
- Simpler for multi-tenant systems where NULL has meaning

**Cons:**
- May miss important uniqueness violations
- Requires careful consideration of NULL semantics

### 4. **Multi-Tenant Considerations**

Always include tenant/scope columns in your unique index:

```typescript
// BAD: Project IDs could collide across tenants
uniqueIndex("idx").on(table.projectId, table.name)

// GOOD: Tenant scoped
uniqueIndex("idx").on(table.tenantId, table.projectId, table.name)
```

### 5. **Testing Upserts**

Create test data with NULL values to verify behavior:

```typescript
async function testMetricsRollupUpsert() {
  // Test 1: Insert with NULL workflow_id
  const result1 = await db
    .insert(metricsRollups)
    .values({
      tenantId: 'tenant-1',
      projectId: 'project-1',
      workflowId: null,
      bucketStart: new Date(),
      bucket: '1m',
      runsCount: 10,
    })
    .onConflictDoUpdate({
      target: [
        metricsRollups.tenantId,
        metricsRollups.projectId,
        sql`COALESCE(${metricsRollups.workflowId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        metricsRollups.bucketStart,
        metricsRollups.bucket,
      ],
      set: { runsCount: 20, updatedAt: new Date() },
    })
    .returning();

  // Test 2: Update with same NULL workflow_id
  const result2 = await db
    .insert(metricsRollups)
    .values({
      tenantId: 'tenant-1',
      projectId: 'project-1',
      workflowId: null,
      bucketStart: new Date(),
      bucket: '1m',
      runsCount: 15, // Different value
    })
    .onConflictDoUpdate({
      target: [
        metricsRollups.tenantId,
        metricsRollups.projectId,
        sql`COALESCE(${metricsRollups.workflowId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        metricsRollups.bucketStart,
        metricsRollups.bucket,
      ],
      set: { runsCount: 15, updatedAt: new Date() },
    })
    .returning();

  // Should be an update, not insert
  assert(result1.id === result2.id, 'Should update existing row');
  assert(result2.runsCount === 15, 'Should have updated runsCount');
}
```

---

## VaultLogic Codebase Examples

### Example 1: Metrics Rollup (Expression-Based)

**File:** `server/jobs/metricsRollup.ts` (lines 135-160)

```typescript
await db
  .insert(metricsRollups)
  .values(rollupData)
  .onConflictDoUpdate({
    target: [
      metricsRollups.tenantId,
      metricsRollups.projectId,
      sql`COALESCE(${metricsRollups.workflowId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      metricsRollups.bucketStart,
      metricsRollups.bucket,
    ],
    set: {
      runsCount: rollupData.runsCount,
      runsSuccess: rollupData.runsSuccess,
      runsError: rollupData.runsError,
      durP50: rollupData.durP50,
      durP95: rollupData.durP95,
      pdfSuccess: rollupData.pdfSuccess,
      pdfError: rollupData.pdfError,
      docxSuccess: rollupData.docxSuccess,
      docxError: rollupData.docxError,
      queueEnqueued: rollupData.queueEnqueued,
      queueDequeued: rollupData.queueDequeued,
      updatedAt: new Date(),
    },
  });
```

### Example 2: ACL Composite Key (Simple)

**File:** `server/repositories/AclRepository.ts` (lines 86-111)

```typescript
async upsert(
  projectId: string,
  principalType: PrincipalType,
  principalId: string,
  role: string,
  tx?: DbTransaction
): Promise<ProjectAccess> {
  const database = this.getDb(tx);

  // Simple composite unique key - no expressions needed
  const [entry] = await database
    .insert(projectAccess)
    .values({
      projectId,
      principalType,
      principalId,
      role,
    })
    .onConflictDoUpdate({
      target: [projectAccess.projectId, projectAccess.principalType, projectAccess.principalId],
      set: { role },
    })
    .returning();

  return entry;
}
```

**Schema:** `shared/schema.ts`
```typescript
// Composite unique constraint (no expressions)
export const projectAccess = pgTable(
  "project_access",
  {
    projectId: uuid("project_id").references(() => projects.id).notNull(),
    principalType: principalTypeEnum("principal_type").notNull(),
    principalId: text("principal_id").notNull(),
    role: text("role").notNull(),
    // ...
  },
  (table) => [
    primaryKey({
      columns: [table.projectId, table.principalType, table.principalId],
    }),
  ]
);
```

### Example 3: User Upsert (Single Column)

**File:** `server/repositories/UserRepository.ts` (lines 65-77)

```typescript
const [user] = await database
  .insert(users)
  .values(userData as any)
  .onConflictDoUpdate({
    target: users.id, // Single column target
    set: {
      firstName: userData.firstName,
      lastName: userData.lastName,
      profileImageUrl: userData.profileImageUrl,
      updatedAt: new Date(),
    },
  })
  .returning();
```

---

## Common Errors & Solutions

### Error: "column 'undefined' does not exist"

**Cause:** The `target` array doesn't match your database's unique constraint.

**Solution:**
1. Check your unique index definition in the schema
2. Ensure the `target` array includes all columns AND expressions in the same order
3. Use `sql` imports from drizzle-orm for expressions

### Error: "duplicate key value violates unique constraint"

**Cause:** The upsert is treating two separate logical records as different records.

**Common with NULLs:** If your constraint uses `COALESCE`, ensure you're using the same expression in the target.

**Solution:**
```typescript
// WRONG: Just the column
target: [myTable.projectId, myTable.workflowId],

// RIGHT: Must include the expression
target: [
  myTable.projectId,
  sql`COALESCE(${myTable.workflowId}, '00000000-0000-0000-0000-000000000000'::uuid)`
],
```

### Error: "Upsert doesn't update - creates new row instead"

**Cause:** The `target` doesn't match the actual unique constraint in the database.

**Debug Steps:**
1. Check what constraint PostgreSQL actually has:
   ```sql
   -- Connect to your database
   SELECT constraint_name, constraint_definition
   FROM information_schema.table_constraints
   WHERE table_name = 'your_table_name';
   ```

2. Compare the actual constraint with your `target` array

3. Use named constraints and reference them:
   ```typescript
   .onConflictDoUpdate({
     target: [table.col1, table.col2],
     targetWhere: sql`...`, // Add WHERE clause if partial index
     set: { /* ... */ },
   })
   ```

---

## Alternative: Using Constraint Names (PostgreSQL 15+)

If you prefer not to enumerate all columns/expressions, you can reference the constraint by name:

```typescript
// PostgreSQL 15+
.onConflictDoUpdate({
  target: sql`ON CONSTRAINT constraint_name`,
  set: { /* ... */ },
})
```

**Advantages:**
- More maintainable - doesn't require updating code when constraint changes
- Works with complex expressions automatically

**Disadvantages:**
- Requires explicit constraint naming
- May not work with all Drizzle versions (check docs)

**Note:** As of Drizzle ORM 0.39.1 (VaultLogic version), the `target` parameter expects column references and `sql` expressions, not constraint names. Stick with the column/expression approach for compatibility.

---

## Type Safety

Drizzle ORM provides type safety for upsert operations:

```typescript
import { sql } from 'drizzle-orm';

// TypeScript will ensure target columns exist
const result = await db
  .insert(myTable)
  .values(data)
  .onConflictDoUpdate({
    target: [myTable.validColumn], // ✅ Type-checked
    set: { validColumn: newValue }, // ✅ Type-checked
  });

// This would error:
// target: [myTable.nonExistentColumn] // ❌ Compilation error
```

---

## Performance Considerations

### 1. Index Coverage
Ensure your unique index is selective enough to minimize lock contention:

```typescript
// Less selective - more conflicts
uniqueIndex("idx").on(table.projectId, table.name)

// More selective - fewer conflicts
uniqueIndex("idx").on(table.tenantId, table.projectId, table.workflowId, table.date)
```

### 2. Expression Complexity
Simple expressions perform better than complex ones:

```typescript
// GOOD: Simple COALESCE
sql`COALESCE(${table.col}, 'default')`

// OKAY: Function call
sql`LOWER(${table.col})`

// AVOID: Complex operations in production
sql`CASE WHEN ${table.col} IS NULL THEN 'a' ELSE CONCAT(${table.col}, 'x') END`
```

### 3. Batch Operations
When upserting many rows, use transactions:

```typescript
const results = await db.transaction(async (tx) => {
  const results = [];
  for (const item of items) {
    const [result] = await tx
      .insert(myTable)
      .values(item)
      .onConflictDoUpdate({
        target: [myTable.id],
        set: { /* ... */ },
      })
      .returning();
    results.push(result);
  }
  return results;
});
```

---

## Migration Guide

If migrating from raw SQL to Drizzle ORM upserts:

### Before (Raw SQL)
```typescript
await db.execute(sql`
  INSERT INTO metrics_rollups (tenant_id, project_id, workflow_id, bucket_start, bucket, runs_count)
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (tenant_id, project_id, COALESCE(workflow_id, '00000000-0000-0000-0000-000000000000'::uuid), bucket_start, bucket)
  DO UPDATE SET runs_count = $6, updated_at = NOW()
`);
```

### After (Drizzle ORM)
```typescript
const [result] = await db
  .insert(metricsRollups)
  .values({
    tenantId,
    projectId,
    workflowId,
    bucketStart,
    bucket,
    runsCount,
  })
  .onConflictDoUpdate({
    target: [
      metricsRollups.tenantId,
      metricsRollups.projectId,
      sql`COALESCE(${metricsRollups.workflowId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      metricsRollups.bucketStart,
      metricsRollups.bucket,
    ],
    set: {
      runsCount,
      updatedAt: new Date(),
    },
  })
  .returning();
```

---

## Troubleshooting Checklist

- [ ] Unique index exists in database (check with `psql`)
- [ ] `target` array matches index columns exactly
- [ ] `target` array includes all SQL expressions with exact syntax
- [ ] NULL values are handled with COALESCE or partial index WHERE clause
- [ ] Multi-tenant systems include tenant_id in unique index
- [ ] Test with NULL values if applicable
- [ ] Verify upsert is updating, not inserting, with duplicate keys
- [ ] Check logs for "column does not exist" errors

---

## References

### VaultLogic Files
- **Schema:** `/shared/schema.ts` (metricsRollups definition, lines 1999-2031)
- **Usage:** `/server/jobs/metricsRollup.ts` (lines 135-160)
- **ACL Examples:** `/server/repositories/AclRepository.ts` (lines 86-111, 207-232)
- **User Example:** `/server/repositories/UserRepository.ts` (lines 65-77)

### External Resources
- [Drizzle ORM PostgreSQL Insert](https://orm.drizzle.team/docs/insert)
- [PostgreSQL ON CONFLICT Clause](https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT)
- [PostgreSQL COALESCE Function](https://www.postgresql.org/docs/current/functions-conditional.html#id1.5.8.5.2.2.1.1.1)

### Related Documentation
- [VaultLogic METRICS_ROLLUP_FIX.md](../fixes/METRICS_ROLLUP_FIX.md) - Specific issue that prompted this guide
- [Drizzle ORM Official Docs](https://orm.drizzle.team/)

---

## Summary

When using `onConflictDoUpdate` with expression-based unique indexes:

1. **Import `sql`** from `drizzle-orm`
2. **Match exactly** - target array must match unique index definition
3. **Include expressions** - use `sql` for COALESCE and other functions
4. **Handle NULLs** - choose COALESCE or partial index strategy
5. **Test thoroughly** - verify behavior with NULL values
6. **Document decisions** - explain NULL handling strategy in comments

This approach ensures reliable upsert operations even with complex uniqueness constraints.
