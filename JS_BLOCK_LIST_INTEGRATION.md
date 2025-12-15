# JS Block + List Integration Guide (Prompt DB-5)

**Status:** Complete
**Version:** 1.7.0
**Last Updated:** December 15, 2025

---

## Overview

This document describes the complete integration of JavaScript blocks with VaultLogic's list system, enabling first-class list manipulation, filtering, mapping, and transformation through JS code.

## Key Features

### 1. Enhanced Variable Picker

**Location:** `client/src/components/common/EnhancedVariablePicker.tsx`

- **List Properties Display:** Expandable tree view showing:
  - `.count` - Number of rows in list
  - `.rows` - Array of row objects
  - `.rows[0]` - Example first row
  - `.columns` - Column metadata
- **Copy & Insert:** One-click copy or insert into code editor
- **Type Badges:** Visual indicators for list variables
- **Grouped by Section:** Variables organized by workflow sections

### 2. Updated JS Question Editor

**Location:** `client/src/components/builder/questions/JSQuestionEditor.tsx`

**New Features:**
- **Variable Picker Panel:** Collapsible panel with all workflow variables
- **Helper Functions Reference:** Built-in documentation for 40+ helpers
- **List Manipulation Examples:** Ready-to-use code snippets for:
  - Filtering list rows
  - Mapping over lists
  - Getting list count
  - Sorting lists
  - Deriving scalar values
  - Returning new list variables

**Usage:**
```tsx
<JSQuestionEditor
  config={jsConfig}
  onChange={handleChange}
  elementId="step-id"
  workflowId="workflow-id" // Required for variable picker
/>
```

### 3. Helper Library Access

**Verified:** JS questions have full access to the helper library via `ScriptEngine`

Available helpers:
- `helpers.date.*` - Date operations
- `helpers.string.*` - String manipulation
- `helpers.number.*` - Number formatting
- `helpers.array.*` - Array operations (filter, map, sortBy, unique)
- `helpers.math.*` - Math operations (sum, avg, min, max)
- `helpers.object.*` - Object utilities

### 4. ListVariable Format Support

**Interface:** `shared/types/blocks.ts`

```typescript
interface ListVariable {
  metadata: {
    source: 'read_table' | 'query' | 'list_tools' | 'computed';
    sourceId?: string;
    tableName?: string;
    queryParams?: Record<string, any>;
    filteredBy?: string[];
    sortedBy?: { columnId: string; direction: 'asc' | 'desc' };
  };
  rows: Array<{
    id: string;
    [columnId: string]: any;
  }>;
  count: number;
  columns: Array<{
    id: string;
    name: string;
    type: string;
  }>;
}
```

**Validator:** `server/utils/listVariableValidator.ts`
- `isListVariable(value)` - Type guard
- `validateListVariable(value, context)` - Validation with logging
- `createEmptyListVariable(source)` - Factory function

---

## Usage Examples

### Example 1: Filter List by Condition

```javascript
// Input: myList (from Read Table block)
const activeUsers = input.myList.rows.filter(row =>
  row.status === 'active' && row.age > 18
);

return {
  metadata: {
    source: 'computed',
    sourceId: input.myList.metadata.sourceId,
    filteredBy: ['status', 'age']
  },
  rows: activeUsers,
  count: activeUsers.length,
  columns: input.myList.columns
};
```

### Example 2: Map List to Extract Column

```javascript
// Input: myList (from Query block)
const names = input.myList.rows.map(row =>
  row.firstName + ' ' + row.lastName
);

// Return array of strings
return names;
```

### Example 3: Aggregate List Data

```javascript
// Input: salesList
const totalSales = helpers.math.sum(
  input.salesList.rows.map(row => row.amount)
);

const averageSale = helpers.math.avg(
  input.salesList.rows.map(row => row.amount)
);

return {
  total: totalSales,
  average: averageSale,
  count: input.salesList.count
};
```

### Example 4: Sort List by Column

```javascript
// Input: myList
const sorted = helpers.array.sortBy(
  input.myList.rows,
  'createdAt' // column ID
);

return {
  metadata: {
    source: 'computed',
    sortedBy: { columnId: 'createdAt', direction: 'asc' }
  },
  rows: sorted,
  count: sorted.length,
  columns: input.myList.columns
};
```

### Example 5: Complex Transformation

```javascript
// Input: ordersList
const enrichedOrders = input.ordersList.rows.map(row => ({
  ...row,
  totalWithTax: row.subtotal * 1.08,
  isPriority: row.amount > 1000,
  formattedDate: helpers.date.format(row.createdAt, 'MMM dd, yyyy')
}));

// Add new columns to metadata
const newColumns = [
  ...input.ordersList.columns,
  { id: 'totalWithTax', name: 'Total with Tax', type: 'number' },
  { id: 'isPriority', name: 'Priority Order', type: 'boolean' },
  { id: 'formattedDate', name: 'Formatted Date', type: 'text' }
];

return {
  metadata: {
    source: 'computed',
    sourceId: input.ordersList.metadata.sourceId
  },
  rows: enrichedOrders,
  count: enrichedOrders.length,
  columns: newColumns
};
```

### Example 6: Get List Count

```javascript
// Simple scalar output
return input.myList.count;
```

### Example 7: Access First Row

```javascript
// Get first row from list
const firstRow = input.myList.rows[0];
return firstRow ? firstRow.name : 'No data';
```

---

## Architecture Details

### Execution Flow

1. **User configures JS question** with input variables and code
2. **During workflow run:**
   - `RunExecutionCoordinator.executeJsQuestions()` finds all JS questions in section
   - Calls `ScriptEngine.execute()` with:
     - Code
     - Input keys
     - Data map (all step values)
     - Helper library
3. **ScriptEngine executes code:**
   - Wraps code in sandboxed environment (isolated-vm)
   - Injects `input`, `context`, `helpers` objects
   - Executes with timeout (default 1000ms)
   - Captures console output
4. **Result is persisted:**
   - Output saved to step value via `runPersistenceWriter.saveStepValue()`
   - Can be any JavaScript value (scalar, object, array, ListVariable)
5. **Downstream blocks access result:**
   - Via step alias in logic rules
   - Via `input.variableName` in other JS blocks
   - Via block configurations (Write, External Send, etc.)

### Sandbox Security

**JavaScript (isolated-vm):**
- No access to: `require`, `process`, `Buffer`, `global`, timers
- Only `input`, `context`, `helpers` available
- Timeout enforced (100-3000ms)
- Code size limit: 32KB
- Output size limit: 64KB

**Python (subprocess):**
- Restricted builtins
- No file system or network access
- Must call `emit()` to produce output

### Error Handling

**Preview Mode:**
- Clear error message displayed
- User can go back and fix configuration
- Non-breaking (preview continues)

**Live Execution:**
- Errors logged to `script_execution_log` table
- Workflow continues (non-breaking)
- Error captured in run data
- Downstream blocks may fail if they depend on missing output

---

## Consistency Guarantees

### Output Contract

JS blocks return a single value via `return` statement (JavaScript) or `emit()` (Python).

**Supported output types:**
- **Scalars:** string, number, boolean
- **Objects:** nested structures
- **Arrays:** including arrays of objects
- **ListVariable:** standardized list format (see interface above)

**Persistence:**
- All outputs stored in `stepValues` table as JSONB
- Accessible via step ID or alias
- Available in preview, snapshots, and live execution

### Variable Resolution

**Alias Map:**
- JS blocks use human-friendly aliases (e.g., `myList`)
- `RunExecutionCoordinator` builds alias map: `alias → stepId`
- Passed to `ScriptEngine` for resolution
- Transparent to user (code uses aliases, engine resolves IDs)

### Cross-Mode Compatibility

**Preview Mode:**
- Uses in-memory snapshot data
- Full helper library access
- Console output captured
- No database persistence

**Live Mode:**
- Real step values from database
- Full helper library access
- Console output captured
- Persisted to database

**Snapshots:**
- Saved state with test data
- Can be loaded into preview mode
- Includes all list variables

---

## Troubleshooting

### Variable Picker Not Showing

**Cause:** `workflowId` prop not passed to `JSQuestionEditor`

**Fix:** Ensure parent component passes `workflowId`:
```tsx
<JSQuestionEditor ... workflowId={workflowId} />
```

### List Properties Not Expandable

**Cause:** Variable type not recognized as list

**Fix:** Ensure the source step type is one of: `query`, `read_table`, `list_tools`, or `computed`

### "Cannot read property 'rows' of undefined"

**Cause:** Input variable not provided or misspelled

**Fix:**
1. Check `inputKeys` includes the variable alias
2. Verify alias spelling matches exactly
3. Ensure upstream block has executed before this block

### "Output is not a valid ListVariable"

**Cause:** Returned object doesn't match ListVariable interface

**Fix:** Ensure returned object has all required properties:
```javascript
return {
  metadata: { source: 'computed' },  // Required
  rows: [...],                        // Required array
  count: rows.length,                 // Required number
  columns: [...]                      // Required array
};
```

### Helper Functions Not Available

**Cause:** Helper library not injected (should not happen)

**Fix:** Verify `ScriptEngine` is passing `helpers` parameter (already fixed in codebase)

---

## Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Main architecture overview
- [shared/types/blocks.ts](./shared/types/blocks.ts) - Block type definitions
- [server/services/scripting/ScriptEngine.ts](./server/services/scripting/ScriptEngine.ts) - Script execution engine
- [server/services/scripting/HelperLibrary.ts](./server/services/scripting/HelperLibrary.ts) - Helper function implementations
- [DYNAMIC_OPTIONS_USAGE.md](./DYNAMIC_OPTIONS_USAGE.md) - Dynamic dropdown options guide

---

**Completion Signal:** Prompt DB-5 — JS block list integration is complete.
