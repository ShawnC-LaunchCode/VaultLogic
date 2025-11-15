# Drizzle ORM onConflictDoUpdate - Quick Reference

**Quick lookup for common upsert patterns in VaultLogic**

---

## Pattern 1: Single Column Primary Key

```typescript
// Schema
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  name: text("name"),
});

// Upsert
await db
  .insert(users)
  .values({ id: '123', email: 'user@example.com', name: 'John' })
  .onConflictDoUpdate({
    target: users.id,
    set: { email: 'user@example.com', name: 'John', updatedAt: new Date() },
  });
```

---

## Pattern 2: Composite Key (Multiple Columns)

```typescript
// Schema
export const projectAccess = pgTable(
  "project_access",
  {
    projectId: uuid("project_id").notNull(),
    principalType: text("principal_type").notNull(),
    principalId: text("principal_id").notNull(),
    role: text("role").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.projectId, table.principalType, table.principalId],
    }),
  ]
);

// Upsert
await db
  .insert(projectAccess)
  .values({ projectId: 'p1', principalType: 'user', principalId: 'u1', role: 'editor' })
  .onConflictDoUpdate({
    target: [projectAccess.projectId, projectAccess.principalType, projectAccess.principalId],
    set: { role: 'viewer' },
  });
```

---

## Pattern 3: With COALESCE for Nullable Columns

```typescript
import { sql } from 'drizzle-orm';

// Schema
export const metricsRollups = pgTable(
  "metrics_rollups",
  {
    tenantId: uuid("tenant_id").notNull(),
    projectId: uuid("project_id").notNull(),
    workflowId: uuid("workflow_id"), // NULLABLE
    bucketStart: timestamp("bucket_start").notNull(),
    bucket: text("bucket").notNull(),
    runsCount: integer("runs_count").notNull(),
  },
  (table) => [
    uniqueIndex("metrics_rollups_unique_idx").on(
      table.tenantId,
      table.projectId,
      sql`COALESCE(${table.workflowId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      table.bucketStart,
      table.bucket
    ),
  ]
);

// Upsert - MUST include the COALESCE expression in target
await db
  .insert(metricsRollups)
  .values({ tenantId: 't1', projectId: 'p1', workflowId: null, bucketStart, bucket: '1m', runsCount: 42 })
  .onConflictDoUpdate({
    target: [
      metricsRollups.tenantId,
      metricsRollups.projectId,
      sql`COALESCE(${metricsRollups.workflowId}, '00000000-0000-0000-0000-000000000000'::uuid)`, // ← KEY LINE
      metricsRollups.bucketStart,
      metricsRollups.bucket,
    ],
    set: { runsCount: 42, updatedAt: new Date() },
  });
```

---

## Pattern 4: Partial Index (WHERE Clause)

```typescript
import { sql } from 'drizzle-orm';

// Schema - only enforce uniqueness when active = true
export const activeUsers = pgTable(
  "users",
  {
    email: text("email").notNull(),
    active: boolean("active").default(true),
  },
  (table) => [
    uniqueIndex("active_users_email_idx")
      .on(table.email)
      .where(sql`${table.active} = true`),
  ]
);

// Upsert with targetWhere
await db
  .insert(activeUsers)
  .values({ email: 'user@example.com', active: true })
  .onConflictDoUpdate({
    target: [activeUsers.email],
    targetWhere: sql`${activeUsers.active} = true`,
    set: { active: true, updatedAt: new Date() },
  });
```

---

## Pattern 5: With Custom Expressions

```typescript
import { sql } from 'drizzle-orm';

// Schema - unique on lower(email) for case-insensitive uniqueness
export const users = pgTable(
  "users",
  {
    email: text("email").notNull(),
  },
  (table) => [
    uniqueIndex("users_email_lower_idx").on(
      sql`LOWER(${table.email})`
    ),
  ]
);

// Upsert - must use same expression
await db
  .insert(users)
  .values({ email: 'User@Example.com' })
  .onConflictDoUpdate({
    target: [sql`LOWER(${users.email})`],
    set: { email: 'user@example.com', updatedAt: new Date() },
  });
```

---

## Troubleshooting Decision Tree

### Is it creating new row instead of updating?

1. Get your unique index from database:
   ```sql
   SELECT constraint_name, constraint_definition
   FROM information_schema.table_constraints
   WHERE table_name = 'your_table';
   ```

2. Compare with your `target` array:
   - Same columns? ✓
   - Same expressions? ✓
   - Same order? ✓
   - All expressions included? ✓

### Is it throwing "column does not exist"?

- Add the missing column to `target` array
- Or use `sql` import for expressions

### Is it throwing "duplicate key value violates"?

- The constraint in the database doesn't match your `target`
- Update `target` to match database constraint exactly

---

## Common Expressions Reference

| Use Case | Expression |
|----------|-----------|
| Handle NULL as specific value | `sql\`COALESCE(${table.col}, 'default')\`` |
| Case-insensitive uniqueness | `sql\`LOWER(${table.col})\`` |
| Uppercase uniqueness | `sql\`UPPER(${table.col})\`` |
| Trim whitespace | `sql\`TRIM(${table.col})\`` |
| NULL is NULL (strict) | No expression needed, just the column |

---

## VaultLogic Real Examples

### Metrics Rollup (Production - with COALESCE)
**File:** `server/jobs/metricsRollup.ts:138-160`

```typescript
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
})
```

### Project Access (Production - composite key)
**File:** `server/repositories/AclRepository.ts:104-107`

```typescript
.onConflictDoUpdate({
  target: [projectAccess.projectId, projectAccess.principalType, projectAccess.principalId],
  set: { role },
})
```

### User Upsert (Production - single key)
**File:** `server/repositories/UserRepository.ts:68-76`

```typescript
.onConflictDoUpdate({
  target: users.id,
  set: {
    firstName: userData.firstName,
    lastName: userData.lastName,
    profileImageUrl: userData.profileImageUrl,
    updatedAt: new Date(),
  },
})
```

---

## Critical Rules

1. **Import sql from drizzle-orm**
   ```typescript
   import { sql } from 'drizzle-orm';
   ```

2. **target must match unique constraint exactly**
   - All columns in same order
   - All expressions with exact syntax
   - Cannot add or remove items

3. **Use sql for expressions**
   ```typescript
   // ✓ Correct
   target: [sql`COALESCE(${table.col}, 'default')`]

   // ✗ Wrong - won't work
   target: [`COALESCE(${table.col}, 'default')`]
   ```

4. **Test with NULL values**
   ```typescript
   // Always test edge cases
   await insert({ ...data, nullableCol: null });
   ```

5. **Match database schema**
   - Your TypeScript schema must match actual database
   - Run migrations before upserting
   - Check with: `npm run db:push`

---

## When to Ask for Help

- Seeing "column does not exist" errors
- Creating new rows instead of updating
- Upsert works locally but fails in production
- Unsure about NULL handling strategy
- Adding new unique constraints

See full guide: `docs/guides/DRIZZLE_ONCONFLICT_WITH_EXPRESSIONS.md`
