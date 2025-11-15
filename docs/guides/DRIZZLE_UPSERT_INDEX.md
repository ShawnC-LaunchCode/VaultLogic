# Drizzle ORM Upsert Documentation Index

**Complete reference for onConflictDoUpdate with expression-based unique indexes**

---

## Documentation Files

### 1. **DRIZZLE_ONCONFLICT_WITH_EXPRESSIONS.md** (Comprehensive Guide)
The complete, detailed guide covering all aspects of using `onConflictDoUpdate` with SQL expressions.

**Contents:**
- Problem statement and real-world scenarios
- Solution explanation with code examples
- Best practices and patterns
- NULL handling strategies (COALESCE vs partial indexes)
- Multi-tenant considerations
- Testing strategies
- Common errors and troubleshooting
- Performance considerations
- Migration guide from raw SQL
- Type safety with TypeScript
- References and external resources

**Use when:** You need deep understanding, troubleshooting complex issues, or implementing new upsert patterns

**Read time:** 20-30 minutes

### 2. **DRIZZLE_UPSERT_QUICK_REFERENCE.md** (Quick Lookup)
Quick reference guide with code snippets for common patterns.

**Contents:**
- 5 common patterns (single key, composite key, COALESCE, partial index, custom expressions)
- Troubleshooting decision tree
- Common expressions reference table
- Real examples from VaultLogic codebase
- Critical rules checklist
- When to ask for help

**Use when:** You know what you're trying to do and just need the syntax, or quick lookup during coding

**Read time:** 5-10 minutes

### 3. **UPSERT_EXAMPLES.md** (Practical Examples)
Real-world, copy-paste ready examples for common scenarios.

**Contents:**
- 8 complete examples with full code:
  1. Email-based user upsert (OAuth)
  2. Multi-tenant metrics with nullable workflow
  3. Composite unique key ACL/permissions
  4. Case-insensitive email uniqueness
  5. Partial unique index (soft deletes)
  6. Batch upsert with transaction
  7. Conditional update with SQL expressions
  8. Upsert with database-side defaults
- Testing examples with vitest
- Summary of key takeaways

**Use when:** You need working code for your specific scenario, learning by example, or writing tests

**Read time:** 10-15 minutes

---

## Quick Start

### I just need to use onConflictDoUpdate

1. **Start here:** [DRIZZLE_UPSERT_QUICK_REFERENCE.md](./DRIZZLE_UPSERT_QUICK_REFERENCE.md) - Find your pattern
2. **Copy code:** [UPSERT_EXAMPLES.md](../examples/UPSERT_EXAMPLES.md) - Find matching example
3. **Adapt to your code:** Update table/column names
4. **Done!**

### I'm getting an error

1. **Check list:** Quick Reference → Troubleshooting Decision Tree
2. **Read solutions:** DRIZZLE_ONCONFLICT_WITH_EXPRESSIONS.md → Common Errors section
3. **Still stuck?** Check Error handling checklist and database schema

### I need to understand this properly

1. **Overview:** DRIZZLE_ONCONFLICT_WITH_EXPRESSIONS.md → The Problem section
2. **Solution:** DRIZZLE_ONCONFLICT_WITH_EXPRESSIONS.md → Solution section
3. **Examples:** UPSERT_EXAMPLES.md → Most relevant example
4. **Best Practices:** DRIZZLE_ONCONFLICT_WITH_EXPRESSIONS.md → Best Practices section

### I'm implementing a new feature

1. **Choose pattern:** Quick Reference → Pick closest pattern
2. **Copy example:** UPSERT_EXAMPLES.md → Copy full example
3. **Implement schema:** Define unique index matching your needs
4. **Implement upsert:** Ensure target array matches schema
5. **Add tests:** UPSERT_EXAMPLES.md → Testing Examples section

---

## The Core Concept

### The Problem
Drizzle ORM's `onConflictDoUpdate` needs to know which database constraint to target. When your constraint includes SQL expressions (like `COALESCE` for nullable columns), you must include those expressions in the target array.

### The Solution
```typescript
import { sql } from 'drizzle-orm';

// Schema with expression in unique index
uniqueIndex("idx").on(
  table.col1,
  sql`COALESCE(${table.col2}, 'default')`,  // ← Expression
)

// Upsert must include the same expression in target
.onConflictDoUpdate({
  target: [
    myTable.col1,
    sql`COALESCE(${myTable.col2}, 'default')`,  // ← Must match exactly
  ],
  set: { /* ... */ },
})
```

### The Rule
**Target array must match unique index definition exactly**
- Same columns in same order
- All expressions with exact syntax
- No additions, no removals

---

## VaultLogic Examples

### Real Production Code

| Example | File | Pattern | Complexity |
|---------|------|---------|------------|
| Metrics Rollup | `server/jobs/metricsRollup.ts:138-160` | COALESCE for nullable workflow_id | High |
| Project Access | `server/repositories/AclRepository.ts:104-107` | Composite key (3 columns) | Medium |
| User Upsert | `server/repositories/UserRepository.ts:68-76` | Single column | Low |

---

## Common Questions

### Q: Do I need to import `sql`?
**A:** Only if your unique index uses SQL expressions (COALESCE, LOWER, UPPER, etc.). If it's just columns, no import needed.

```typescript
// No sql import needed
target: [table.col1, table.col2]

// sql import required
import { sql } from 'drizzle-orm';
target: [table.col1, sql`COALESCE(${table.col2}, 'default')`]
```

### Q: Why is my upsert creating new rows instead of updating?
**A:** Your `target` array doesn't match the unique constraint in the database. Check:
1. Do you have all columns?
2. Are they in the same order?
3. Did you include all expressions?

See: DRIZZLE_ONCONFLICT_WITH_EXPRESSIONS.md → Error: "Upsert doesn't update"

### Q: How do I handle NULL values?
**A:** Two strategies:
1. **COALESCE** - Treats NULL as a specific value (recommended for single NULL)
2. **Partial Index** - Only enforce uniqueness when NOT NULL (recommended for multiple NULLs)

See: DRIZZLE_ONCONFLICT_WITH_EXPRESSIONS.md → Null Handling Strategies

### Q: Can I use expressions like LOWER or UPPER?
**A:** Yes! Use `sql` like COALESCE:
```typescript
sql`LOWER(${table.email})` // Case-insensitive unique
```

See: UPSERT_EXAMPLES.md → Example 4: Case-Insensitive Email

### Q: Should I use COALESCE or partial index?
**A:** It depends on your semantics:
- **COALESCE:** One NULL value means conflict (prevents duplicate NULLs)
- **Partial Index:** Multiple NULLs allowed (each NULL is unique)

See: DRIZZLE_ONCONFLICT_WITH_EXPRESSIONS.md → Best Practices → Null Handling Strategies

### Q: How do I handle multi-tenant systems?
**A:** Include tenant_id in your unique constraint:
```typescript
uniqueIndex("idx").on(table.tenantId, table.projectId, /* ... */)

// Then in upsert target
target: [myTable.tenantId, myTable.projectId, /* ... */]
```

See: VaultLogic's metrics rollup example, DRIZZLE_ONCONFLICT_WITH_EXPRESSIONS.md → Multi-Tenant Considerations

### Q: Can I upsert multiple rows at once?
**A:** Yes, use a transaction:
```typescript
await db.transaction(async (tx) => {
  for (const item of items) {
    await tx.insert(table).values(item).onConflictDoUpdate({ /* ... */ });
  }
});
```

See: UPSERT_EXAMPLES.md → Example 6: Batch Upsert

### Q: How do I test my upsert?
**A:** Test with edge cases, especially NULLs:
```typescript
// Insert 1st time
const result1 = await upsert({ /* ... */, nullableCol: null });

// Insert 2nd time with same key - should UPDATE, not INSERT
const result2 = await upsert({ /* ... */, nullableCol: null });

expect(result1.id).toBe(result2.id); // Same record
```

See: UPSERT_EXAMPLES.md → Testing Examples section

---

## Related VaultLogic Documentation

- **METRICS_ROLLUP_FIX.md** - The issue that prompted this documentation
- **AUTHENTICATION.md** - User management with OAuth (uses UserRepository upsert)
- **DATA_LAYER_AUDIT_2025_11_14.md** - Schema and data model overview
- **STEP_ALIASES_ARCHITECTURE.md** - Feature using upsert patterns

---

## Decision Tree: Which Document to Read

```
┌─ Do you know the pattern you need?
├─ YES → DRIZZLE_UPSERT_QUICK_REFERENCE.md
├─ NO  ─→ Do you want examples?
│        ├─ YES → UPSERT_EXAMPLES.md
│        └─ NO  → DRIZZLE_ONCONFLICT_WITH_EXPRESSIONS.md
│
├─ Are you getting an error?
├─ YES ─→ DRIZZLE_ONCONFLICT_WITH_EXPRESSIONS.md → Common Errors
└─ NO  ─→ Code looks good!
```

---

## Checklist Before Upserting

- [ ] Schema has unique index defined
- [ ] `target` array matches unique index (same columns, same expressions, same order)
- [ ] Imported `sql` if using expressions
- [ ] NULL values handled (COALESCE or WHERE clause)
- [ ] Multi-tenant systems include tenant_id
- [ ] Tested with edge cases (NULL, duplicates)
- [ ] Migrations applied (schema synced with code)
- [ ] Database connection working

---

## Common Patterns

| Pattern | Key Columns | Expression | Example |
|---------|------------|-----------|---------|
| Single unique | 1 | None | User.id, API key |
| Composite unique | 2+ | None | ACL (project + principal) |
| Nullable column | 1+ | COALESCE | Metrics (workflow_id nullable) |
| Case-insensitive | 1 | LOWER | Email uniqueness |
| Soft deletes | 1+ | WHERE clause | Active documents only |
| Multi-tenant | 1+ | None + tenant | Any tenant-scoped table |

---

## Getting Help

If stuck:

1. **Check Quick Reference** - Most answers are there
2. **Search DRIZZLE_ONCONFLICT_WITH_EXPRESSIONS.md** - Comprehensive
3. **Find matching example** in UPSERT_EXAMPLES.md
4. **Check error troubleshooting** section
5. **Verify database schema** - Run migrations first
6. **Test edge cases** - NULL values especially

Still stuck? Create an issue with:
- Your schema definition
- Your upsert code
- The error message
- What you're trying to do

---

## File Paths

All documentation is in the VaultLogic repository:

```
C:\Users\scoot\poll\VaultLogic\
├── docs\
│   ├── guides\
│   │   ├── DRIZZLE_UPSERT_INDEX.md          (you are here)
│   │   ├── DRIZZLE_ONCONFLICT_WITH_EXPRESSIONS.md   (comprehensive guide)
│   │   └── DRIZZLE_UPSERT_QUICK_REFERENCE.md        (quick lookup)
│   ├── examples\
│   │   └── UPSERT_EXAMPLES.md               (practical examples)
│   └── fixes\
│       └── METRICS_ROLLUP_FIX.md            (the original issue)
└── shared\schema.ts                         (all table definitions)
```

---

## Version History

**November 15, 2025** - Initial documentation created
- Comprehensive guide
- Quick reference
- 8 practical examples
- This index

---

**Last Updated:** November 15, 2025
**Status:** Complete and tested
**Author:** Development Team
