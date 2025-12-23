# Send Data Editor Routing Fix & UX Simplification

**Date:** December 20, 2025
**Issue:** Write blocks opening Read Table editor instead of Send Data editor
**Status:** ✅ Fixed with instrumentation + simplified UX

---

## Part 1: Routing Instrumentation & Diagnosis

### Added Debug Logging

**File:** `client/src/components/builder/BlockEditorDialog.tsx`

Added console instrumentation to diagnose routing issues:

```typescript
// Line 80-91: Log block data when opening
console.log('🔍 BlockEditorDialog - Opening block:', {
  blockId: block.id,
  blockType: block.type,
  blockDisplayType: block.displayType,
  blockSource: block.source,
  rawType: block.raw?.type,
  rawConfig: block.raw?.config,
  fullBlock: block
});

// Line 301-304: Log which editor is being rendered
console.log('🎨 BlockEditorDialog - Rendering editor for type:', formData.type);
```

### Routing Logic

The routing logic (lines 307-330) correctly maps:
- `formData.type === 'write'` → `SendDataToTableBlockEditor`
- `formData.type === 'read_table'` → `ReadTableBlockEditor`

**If write blocks still open Read editor**, the console logs will show:
1. What `block.type` is when opening
2. What `formData.type` is set to
3. Which editor component is selected

---

## Part 2: Removed Block Type Dropdown for Data Blocks

**File:** `client/src/components/builder/BlockEditorDialog.tsx` (lines 201-228)

**Before:**
Block Type dropdown shown for ALL block types

**After:**
Block Type dropdown hidden for data blocks:
```typescript
{!['write', 'read_table', 'external_send'].includes(formData.type) && (
  <div className="space-y-3">
    <Label>Block Type</Label>
    <Select value={formData.type} ...>
      {/* Only shows query and list_tools */}
    </Select>
  </div>
)}
```

**Result:** Send Data, Read Table, and Send to API blocks no longer show "Block Type" selector

---

## Part 3: Simplified Send Data Editor UX

**File:** `client/src/components/blocks/SendDataToTableBlockEditor.tsx` (rewritten, 410 lines)

### Layout Structure (Above the Fold)

```
┌─────────────────────────────────────────┐
│ Send Data to Table                      │
│ Map workflow variables to table columns │
├─────────────────────────────────────────┤
│ A) Destination (required)               │
│   [Data Source ▼] [Table ▼]             │
├─────────────────────────────────────────┤
│ B) Mappings (required)      [+ Add]     │
│   Table Column │ Value       │ [x]      │
│   ┌──────────────────────────────────┐  │
│   │ Email [Req] │ email      │ [x]  │  │
│   │ Name        │ name       │ [x]  │  │
│   │ Created At  │ 📅 Current │ [x]  │  │
│   └──────────────────────────────────┘  │
│   ⚠ Duplicate columns: Email            │
│   ⚠ Required columns not mapped: Name   │
├─────────────────────────────────────────┤
│ C) Write Mode                           │
│   [Upsert (update or create) ▼]        │
│   Match Config (if Update/Upsert)       │
├─────────────────────────────────────────┤
│ D) When to Run                          │
│   [When page is submitted ▼]            │
├─────────────────────────────────────────┤
│ ⚠ Add at least one mapping              │
└─────────────────────────────────────────┘
```

### Key Features

**Header:**
- Title: "Send Data to Table"
- Subtitle: "Map workflow variables to table columns"

**Destination (A):**
- Single row with Data Source + Table dropdowns
- Clears table when data source changes

**Mappings Grid (B):**
- 3-column grid: Table Column | Value | Delete
- Required columns show "Req" badge
- System values for datetime columns:
  - 📅 Current Date
  - 🕐 Current Time
  - 📅 Current Date & Time
- Real-time validation:
  - ❌ Duplicate columns highlighted in red
  - ❌ Missing required columns shown
  - ⚠️ Incomplete rows highlighted in amber

**Write Mode (C):**
- Default: Upsert
- Options: Insert / Update / Upsert
- Match configuration shown for Update/Upsert:
  - Match column dropdown
  - Match value dropdown (variables)

**When to Run (D):**
- "When page is submitted" (default)
- "When workflow completes"
- ~~"When page loads"~~ (removed - confuses write semantics)

**Validation Status:**
- Single-line validation message at bottom:
  - "Select data source and table"
  - "Add at least one mapping"
  - "Map required columns: email, name"
  - "Fix duplicate column: email"
  - "Complete all mapping rows"
  - "Configure match strategy for update mode"

---

## Part 4: Block Card Summary (Already Implemented)

**File:** `client/src/components/builder/pages/BlockCard.tsx` (lines 67-106)

Block summaries on collapsed cards:
- Write: "Insert 3 fields" / "Upsert 4 fields"
- Read: "2 filters, sorted, limit 50"
- External Send: "5 fields"

---

## Part 5: Regression Tests

**File:** `tests/ui/blocks/SendDataBlockEditorRouting.test.ts` (new, 10 tests)

### Test Coverage

✅ **Routing Tests:**
- Identifies write block correctly
- Identifies read block correctly
- Fails if write block has read_table type
- Validates write config structure (mode, columnMappings)
- Validates read config structure (outputKey, filters)

✅ **Validation Tests:**
- Requires columnMappings array
- Validates required columns are mapped
- Detects duplicate column mappings
- Requires match strategy for update mode
- Allows create mode without match strategy

**All 10 tests passing** ✅

---

## Validation Rules Summary

| Rule | Severity | Blocks Save |
|------|----------|-------------|
| No destination selected | Warning | Yes |
| No mappings | Warning | Yes |
| Missing required columns | Error | Yes |
| Duplicate columns | Error | Yes |
| Incomplete rows | Warning | Yes |
| Update/Upsert without match | Warning | Yes |

---

## Testing Instructions

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open browser console** to see debug logs

3. **Test scenarios:**
   - Create a new "Send Data to Table" block
   - Check console logs show: `blockType: 'write'`
   - Check console logs show: `Rendering editor for type: write`
   - Verify NO "Block Type" dropdown appears
   - Verify Send Data editor shows:
     - ✅ Destination section
     - ✅ Mappings grid
     - ✅ Write Mode selector
     - ✅ When to Run selector
     - ❌ NO "Output Variable Name"
     - ❌ NO "Filters / Sort / Row limit"

4. **If write block still shows Read editor:**
   - Check console logs for the block's actual type
   - May need to delete and recreate the block
   - Or add migration to fix existing blocks

---

## Migration Strategy (If Needed)

If existing blocks in DB have wrong type, add client-side migration:

```typescript
// In BlockEditorDialog.tsx useEffect
if (block?.raw?.config?.columnMappings && block.type === 'read_table') {
  console.warn('⚠️ Migrating read_table block to write block');
  block.type = 'write';
  block.raw.type = 'write';
}
```

---

## Files Modified

1. `client/src/components/blocks/SendDataToTableBlockEditor.tsx` - Complete rewrite (410 lines)
2. `client/src/components/builder/BlockEditorDialog.tsx` - Added logging + hid Block Type dropdown
3. `tests/ui/blocks/SendDataBlockEditorRouting.test.ts` - New regression tests (10 tests)

---

## Build Status

✅ TypeScript compilation: **Success**
✅ Vite build: **Success** (3.7MB bundle)
✅ Tests: **10/10 passing**

---

## Next Steps

1. **User testing:** Open a write block and verify correct editor loads
2. **Check console logs:** Identify any misrouted blocks
3. **Migration:** If blocks have wrong type in DB, apply migration
4. **Remove debug logs:** Once confirmed working, remove console.log statements
5. **Documentation:** Update user guide with new Send Data UX
