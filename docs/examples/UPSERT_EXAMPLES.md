# Drizzle ORM Upsert Examples - Practical Scenarios

**Practical, copy-paste ready examples for common upsert scenarios**

---

## Example 1: Simple Email-Based User Upsert

**Scenario:** Sync user from external source (Google OAuth, etc.)

```typescript
// shared/schema.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// server/repositories/UserRepository.ts
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function upsertUserFromOAuth(userData: {
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}): Promise<typeof users.$inferSelect> {
  const [user] = await db
    .insert(users)
    .values(userData)
    .onConflictDoUpdate({
      target: users.email,
      set: {
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
        updatedAt: new Date(),
      },
    })
    .returning();

  return user;
}

// Usage
const user = await upsertUserFromOAuth({
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  profileImageUrl: 'https://...',
});
```

---

## Example 2: Multi-Tenant Metrics with Nullable Workflow

**Scenario:** Store aggregated metrics, where workflow can be NULL (tenant-level metrics)

```typescript
// shared/schema.ts
import { pgTable, uuid, timestamp, integer, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const metricsRollups = pgTable(
  "metrics_rollups",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
    projectId: uuid("project_id").references(() => projects.id).notNull(),
    workflowId: uuid("workflow_id").references(() => workflows.id), // NULLABLE
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    bucket: text("bucket").notNull(), // '1m', '5m', '1h', '1d'
    runsCount: integer("runs_count").default(0).notNull(),
    runsSuccess: integer("runs_success").default(0).notNull(),
    runsError: integer("runs_error").default(0).notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
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

// server/jobs/metricsRollup.ts
import { db } from '../db';
import { metricsRollups } from '@shared/schema';
import { sql } from 'drizzle-orm';

export async function rollupMetrics(data: {
  tenantId: string;
  projectId: string;
  workflowId: string | null;
  bucketStart: Date;
  bucket: '1m' | '5m' | '1h' | '1d';
  runsCount: number;
  runsSuccess: number;
  runsError: number;
}): Promise<void> {
  await db
    .insert(metricsRollups)
    .values(data)
    .onConflictDoUpdate({
      target: [
        metricsRollups.tenantId,
        metricsRollups.projectId,
        // CRITICAL: Must include the exact COALESCE expression from unique index
        sql`COALESCE(${metricsRollups.workflowId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        metricsRollups.bucketStart,
        metricsRollups.bucket,
      ],
      set: {
        runsCount: data.runsCount,
        runsSuccess: data.runsSuccess,
        runsError: data.runsError,
        updatedAt: new Date(),
      },
    });
}

// Usage - with NULL workflow
await rollupMetrics({
  tenantId: 'tenant-123',
  projectId: 'project-456',
  workflowId: null, // Tenant-level metric, no specific workflow
  bucketStart: new Date('2025-11-15T10:00:00Z'),
  bucket: '1m',
  runsCount: 42,
  runsSuccess: 40,
  runsError: 2,
});

// Usage - with specific workflow
await rollupMetrics({
  tenantId: 'tenant-123',
  projectId: 'project-456',
  workflowId: 'workflow-789',
  bucketStart: new Date('2025-11-15T10:00:00Z'),
  bucket: '1m',
  runsCount: 25,
  runsSuccess: 24,
  runsError: 1,
});
```

---

## Example 3: Composite Unique Key - ACL/Permissions

**Scenario:** Manage who has what access to which projects

```typescript
// shared/schema.ts
import { pgTable, uuid, text } from 'drizzle-orm/pg-core';

export const projectAccess = pgTable(
  "project_access",
  {
    projectId: uuid("project_id").references(() => projects.id).notNull(),
    principalType: text("principal_type").notNull(), // 'user' or 'team'
    principalId: uuid("principal_id").notNull(),
    role: text("role").notNull(), // 'owner', 'admin', 'editor', 'viewer'
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.projectId, table.principalType, table.principalId],
    }),
  ]
);

// server/repositories/AccessRepository.ts
import { db } from '../db';
import { projectAccess } from '@shared/schema';

export async function grantAccess(params: {
  projectId: string;
  principalType: 'user' | 'team';
  principalId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
}): Promise<typeof projectAccess.$inferSelect> {
  const [entry] = await db
    .insert(projectAccess)
    .values(params)
    .onConflictDoUpdate({
      target: [
        projectAccess.projectId,
        projectAccess.principalType,
        projectAccess.principalId,
      ],
      set: {
        role: params.role,
        updatedAt: new Date(),
      },
    })
    .returning();

  return entry;
}

// Usage
// Grant user John 'editor' access to project-123
await grantAccess({
  projectId: 'project-123',
  principalType: 'user',
  principalId: 'user-john',
  role: 'editor',
});

// Upgrade John to 'admin' (updates existing)
await grantAccess({
  projectId: 'project-123',
  principalType: 'user',
  principalId: 'user-john',
  role: 'admin',
});

// Grant team-developers 'viewer' access to same project
await grantAccess({
  projectId: 'project-123',
  principalType: 'team',
  principalId: 'team-developers',
  role: 'viewer',
});
```

---

## Example 4: Case-Insensitive Email Uniqueness

**Scenario:** Ensure no duplicate emails (case-insensitive)

```typescript
// shared/schema.ts
import { pgTable, uuid, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    email: text("email").notNull(),
    displayName: text("display_name"),
    active: boolean("active").default(true).notNull(),
  },
  (table) => [
    uniqueIndex("accounts_email_lower_idx").on(
      sql`LOWER(${table.email})`
    ),
  ]
);

// server/services/AccountService.ts
import { db } from '../db';
import { accounts } from '@shared/schema';
import { sql } from 'drizzle-orm';

export async function createOrUpdateAccount(email: string, displayName: string): Promise<typeof accounts.$inferSelect> {
  const [account] = await db
    .insert(accounts)
    .values({
      email, // Can be any case: 'John@Example.com', 'john@example.com', etc.
      displayName,
      active: true,
    })
    .onConflictDoUpdate({
      target: [sql`LOWER(${accounts.email})`],
      set: {
        displayName,
        active: true,
        // Note: We don't update 'email' to preserve the original casing
      },
    })
    .returning();

  return account;
}

// Usage
const account1 = await createOrUpdateAccount('John@Example.com', 'John Doe');
const account2 = await createOrUpdateAccount('john@example.com', 'John Updated');
// account2.id === account1.id (same account, updated displayName)
```

---

## Example 5: Partial Unique Index (Only Non-Deleted Records)

**Scenario:** Allow multiple tombstoned (deleted) records, but enforce uniqueness on active ones

```typescript
// shared/schema.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workflowId: uuid("workflow_id").references(() => workflows.id).notNull(),
    name: text("name").notNull(),
    version: integer("version").default(1).notNull(),
    deletedAt: timestamp("deleted_at"), // NULL = active, NOT NULL = deleted
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // Enforce uniqueness only for active (non-deleted) documents
    uniqueIndex("documents_workflow_name_active_idx")
      .on(table.workflowId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
  ]
);

// server/services/DocumentService.ts
import { db } from '../db';
import { documents } from '@shared/schema';
import { sql } from 'drizzle-orm';

export async function createOrUpdateDocument(params: {
  workflowId: string;
  name: string;
  version: number;
}): Promise<typeof documents.$inferSelect> {
  const [doc] = await db
    .insert(documents)
    .values({
      ...params,
      deletedAt: null, // Ensure it's active
    })
    .onConflictDoUpdate({
      target: [documents.workflowId, documents.name],
      // Important: Only update if not deleted
      targetWhere: sql`${documents.deletedAt} IS NULL`,
      set: {
        version: params.version,
        deletedAt: null, // Reactivate if previously deleted
      },
    })
    .returning();

  return doc;
}

export async function deleteDocument(workflowId: string, name: string): Promise<void> {
  await db
    .update(documents)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(documents.workflowId, workflowId),
        eq(documents.name, name)
      )
    );
}

// Usage
const doc1 = await createOrUpdateDocument({
  workflowId: 'wf-123',
  name: 'Report',
  version: 1,
});

// Delete it
await deleteDocument('wf-123', 'Report');

// Create a new document with the same name (allowed because old one is deleted)
const doc2 = await createOrUpdateDocument({
  workflowId: 'wf-123',
  name: 'Report', // Same name, OK because old one is deleted
  version: 1,
});

// doc2.id !== doc1.id (different documents)
```

---

## Example 6: Batch Upsert with Transaction

**Scenario:** Insert/update many records atomically

```typescript
// server/services/MetricsService.ts
import { db } from '../db';
import { metricsRollups } from '@shared/schema';
import { sql } from 'drizzle-orm';

interface MetricData {
  tenantId: string;
  projectId: string;
  workflowId: string | null;
  bucketStart: Date;
  bucket: string;
  runsCount: number;
  runsSuccess: number;
  runsError: number;
}

export async function batchUpsertMetrics(metrics: MetricData[]): Promise<void> {
  // Use transaction for atomicity
  await db.transaction(async (tx) => {
    for (const metric of metrics) {
      await tx
        .insert(metricsRollups)
        .values(metric)
        .onConflictDoUpdate({
          target: [
            metricsRollups.tenantId,
            metricsRollups.projectId,
            sql`COALESCE(${metricsRollups.workflowId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
            metricsRollups.bucketStart,
            metricsRollups.bucket,
          ],
          set: {
            runsCount: metric.runsCount,
            runsSuccess: metric.runsSuccess,
            runsError: metric.runsError,
            updatedAt: new Date(),
          },
        });
    }
  });
}

// Usage
const metricsToUpsert: MetricData[] = [
  {
    tenantId: 't1',
    projectId: 'p1',
    workflowId: 'w1',
    bucketStart: new Date('2025-11-15T10:00:00Z'),
    bucket: '1m',
    runsCount: 10,
    runsSuccess: 9,
    runsError: 1,
  },
  {
    tenantId: 't1',
    projectId: 'p1',
    workflowId: null,
    bucketStart: new Date('2025-11-15T10:00:00Z'),
    bucket: '1m',
    runsCount: 25,
    runsSuccess: 24,
    runsError: 1,
  },
  // ... more metrics
];

await batchUpsertMetrics(metricsToUpsert);
```

---

## Example 7: Upsert with Conditional Update

**Scenario:** Only update if existing record meets certain criteria

```typescript
// shared/schema.ts
export const taskQueue = pgTable("task_queue", {
  id: uuid("id").primaryKey(),
  taskKey: text("task_key").unique().notNull(),
  status: text("status").notNull(), // 'pending', 'processing', 'completed'
  retries: integer("retries").default(0).notNull(),
  lastAttemptAt: timestamp("last_attempt_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// server/services/TaskQueueService.ts
import { db } from '../db';
import { taskQueue } from '@shared/schema';
import { sql } from 'drizzle-orm';

export async function enqueueOrRetry(
  taskKey: string,
  maxRetries: number = 3
): Promise<typeof taskQueue.$inferSelect> {
  const [task] = await db
    .insert(taskQueue)
    .values({
      taskKey,
      status: 'pending',
      retries: 0,
    })
    .onConflictDoUpdate({
      target: taskQueue.taskKey,
      set: {
        // Only increment retries if less than max and not in 'processing' state
        retries: sql`CASE
          WHEN ${taskQueue.retries} < ${maxRetries} AND ${taskQueue.status} != 'processing'
          THEN ${taskQueue.retries} + 1
          ELSE ${taskQueue.retries}
        END`,
        status: sql`CASE
          WHEN ${taskQueue.retries} < ${maxRetries}
          THEN 'pending'
          ELSE 'failed'
        END`,
        lastAttemptAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  return task;
}

// Usage
const task = await enqueueOrRetry('send-email-user-123', 3);
// If not exists: creates with status='pending', retries=0
// If exists with retries < 3: increments retries, sets status='pending'
// If exists with retries >= 3: sets status='failed', doesn't increment
```

---

## Example 8: Upsert with DEFAULT Values in SET

**Scenario:** Use database-side expressions in the update clause

```typescript
// shared/schema.ts
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  key: text("key").unique().notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// server/services/ApiKeyService.ts
import { db } from '../db';
import { apiKeys } from '@shared/schema';
import { sql } from 'drizzle-orm';

export async function recordApiKeyUsage(key: string): Promise<void> {
  await db
    .insert(apiKeys)
    .values({
      id: crypto.randomUUID(),
      userId: 'unknown', // Won't match, so always goes to update
      name: 'dynamic',
      key,
    })
    .onConflictDoUpdate({
      target: apiKeys.key,
      set: {
        // Update only lastUsedAt, preserve other fields
        lastUsedAt: new Date(),
        // This could also use NOW() from database:
        // lastUsedAt: sql`NOW()`,
        updatedAt: new Date(),
      },
    });
}
```

---

## Testing Examples

### Test 1: Verify NULL Handling

```typescript
import { describe, it, expect } from 'vitest';
import { db } from '../db';
import { metricsRollups } from '@shared/schema';

describe('Metrics Rollup Upsert', () => {
  it('should handle NULL workflow_id correctly', async () => {
    const now = new Date();

    // First insert with NULL workflow_id
    const [result1] = await db
      .insert(metricsRollups)
      .values({
        tenantId: 'tenant-test',
        projectId: 'project-test',
        workflowId: null,
        bucketStart: now,
        bucket: '1m',
        runsCount: 10,
        runsSuccess: 10,
        runsError: 0,
      })
      .onConflictDoUpdate({
        target: [
          metricsRollups.tenantId,
          metricsRollups.projectId,
          sql`COALESCE(${metricsRollups.workflowId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
          metricsRollups.bucketStart,
          metricsRollups.bucket,
        ],
        set: { runsCount: 10, runsSuccess: 10, runsError: 0, updatedAt: new Date() },
      })
      .returning();

    // Second insert with same data should UPDATE, not INSERT
    const [result2] = await db
      .insert(metricsRollups)
      .values({
        tenantId: 'tenant-test',
        projectId: 'project-test',
        workflowId: null,
        bucketStart: now,
        bucket: '1m',
        runsCount: 20, // Different value
        runsSuccess: 19,
        runsError: 1,
      })
      .onConflictDoUpdate({
        target: [
          metricsRollups.tenantId,
          metricsRollups.projectId,
          sql`COALESCE(${metricsRollups.workflowId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
          metricsRollups.bucketStart,
          metricsRollups.bucket,
        ],
        set: { runsCount: 20, runsSuccess: 19, runsError: 1, updatedAt: new Date() },
      })
      .returning();

    // Both should be the same record
    expect(result1.id).toBe(result2.id);
    expect(result2.runsCount).toBe(20); // Should be updated
  });
});
```

---

## Summary

Key takeaways from these examples:

1. **Always import `sql`** when using expressions
2. **Match target to schema** - target array must match unique index exactly
3. **Test edge cases** - NULL values, case sensitivity, deletions
4. **Use transactions** for multiple upsertsations
5. **Document NULL strategy** - COALESCE vs WHERE clause vs NULL=unique
6. **Verify in tests** - ensure updates happen, not new inserts

For more details, see: `docs/guides/DRIZZLE_ONCONFLICT_WITH_EXPRESSIONS.md`
