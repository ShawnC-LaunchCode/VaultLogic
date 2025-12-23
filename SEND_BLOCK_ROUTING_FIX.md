# Send Block Routing Fix - Complete Implementation

**Date:** December 20, 2025
**Status:** ✅ Complete
**Build:** ✅ Passing

---

## Problem Statement

User reported that clicking "Send to Table" block opened the Read Table editor instead of the Send Data to Table editor, with no mappings grid visible.

---

## Root Cause Analysis

The issue was caused by:
1. **Potential type mismatch**: Legacy blocks may have had `type: 'read_table'` with write config
2. **Title mismatch**: Modal title used `formData.type` which could differ from actual block type
3. **Insufficient logging**: No visibility into what block was being opened or which editor was selected
4. **Routing order**: Correct routing existed but needed defensive checks

---

## Fixes Implemented

### 1. Truth Logging (Required)

**File:** `client/src/components/builder/BlockEditorDialog.tsx`

Added two critical logging points:

```typescript
// When block is opened (line 82)
console.log('OPEN_BLOCK', {
    blockId: block.id,
    blockType: block.type,
    blockDisplayType: block.displayType,
    blockSource: block.source,
    rawType: block.raw?.type,
    rawConfig: block.raw?.config,
    fullBlock: block
});

// When editor is selected (line 340)
console.log('RENDER_EDITOR', {
    blockId: block?.id,
    blockType: formData.type,
    resolvedEditorName: editorName  // "SendDataToTableBlockEditor" | "ReadTableBlockEditor" | etc
});
```

**Acceptance:** User can now see exactly what block type is being opened and which editor is rendering.

---

### 2. Modal Title Fix (Prevent Mismatches)

**File:** `client/src/components/builder/BlockEditorDialog.tsx` (line 165)

**Before:**
```typescript
formData.type === 'write' ? 'Send Data to Table' : ...
```

**After:**
```typescript
// Use block.type for title (direct from database, not formData)
block.type === 'write' ? 'Send Data to Table' :
block.type === 'read_table' ? 'Read from Table' :
block.type === 'external_send' ? 'Send Data to API' :
...
```

**Result:** Modal title now always matches the actual block type from database, not the form state.

---

### 3. Mappings Grid Always Visible

**File:** `client/src/components/blocks/SendDataToTableBlockEditor.tsx` (line 178)

**Changes:**
```typescript
{/* B) Mappings Grid - ALWAYS VISIBLE */}
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <Label className="text-base font-medium">Mappings</Label>
    <Button type="button" variant="outline" size="sm" onClick={addMapping} disabled={!config.tableId}>
      <Plus className="w-3 h-3 mr-1" />
      Add mapping
    </Button>
  </div>

  {!config.tableId ? (
    /* Empty state when no table selected */
    <div className="text-center py-8 border rounded-lg bg-muted/30">
      <p className="text-sm text-muted-foreground">Select a table to configure mappings</p>
    </div>
  ) : config.columnMappings && config.columnMappings.length > 0 ? (
    /* Show mappings grid */
    ...
  ) : (
    /* Empty state when table selected but no mappings */
    <div className="text-center py-8 border rounded-lg bg-muted/30">
      <p className="text-sm text-muted-foreground">No mappings configured</p>
      <p className="text-xs text-muted-foreground mt-1">Click "Add mapping" to start mapping workflow variables to table columns</p>
    </div>
  )}
</div>
```

**Result:** Mappings section header and "Add Mapping" button are ALWAYS visible, with appropriate empty states.

---

### 4. Auto-Migration for Legacy Blocks

**File:** `client/src/components/builder/BlockEditorDialog.tsx` (line 93)

Added client-side migration logic:

```typescript
// MIGRATION: Auto-fix legacy blocks with wrong type
let blockType = source === 'regular' ? block?.type : 'read_table';
if (block && source === 'regular') {
    const config = block.raw?.config || {};
    // If block has columnMappings (write config) but is typed as read_table, fix it
    if (blockType === 'read_table' && config.columnMappings) {
        console.warn('⚠️ MIGRATION: Converting read_table block with columnMappings to write block');
        blockType = 'write';
    }
    // If block has outputKey/filters (read config) but is typed as write, fix it
    if (blockType === 'write' && (config.outputKey || config.filters)) {
        console.warn('⚠️ MIGRATION: Converting write block with read config to read_table block');
        blockType = 'read_table';
    }
}
```

**Result:** Blocks with mismatched type/config are automatically corrected in memory when opened.

---

### 5. Strict Editor Routing

**File:** `client/src/components/builder/BlockEditorDialog.tsx` (line 349)

Reordered editor routing to prioritize data blocks:

```typescript
{/* Render specific editors based on type - STRICT ROUTING */}
{formData.type === 'write' ? (
    /* SEND DATA TO TABLE - Must be first to prevent fallthrough */
    <SendDataToTableBlockEditor ... />
) : formData.type === 'read_table' ? (
    /* READ FROM TABLE */
    <ReadTableBlockEditor ... />
) : formData.type === 'external_send' ? (
    /* SEND DATA TO API */
    <ExternalSendBlockEditor ... />
) : ...
```

**Result:** Write blocks are checked FIRST, preventing any accidental fallthrough to read editor.

---

## Verification Steps

### Quick Sanity Test

1. **Add Logic → Send Data to Table**
2. **Click the new block card**
3. **Verify Console Output:**
   ```
   OPEN_BLOCK { blockType: "write", ... }
   RENDER_EDITOR { blockType: "write", resolvedEditorName: "SendDataToTableBlockEditor" }
   ```
4. **Verify UI:**
   - ✅ Title: "Send Data to Table"
   - ✅ Mappings section visible with "Add mapping" button
   - ✅ NO Output Variable Name field
   - ✅ NO Filters / Sort / Limit fields
   - ✅ "When to Run" section present

---

## Files Modified

| File | Lines Changed | Purpose |
|------|--------------|---------|
| `client/src/components/builder/BlockEditorDialog.tsx` | ~40 | Truth logging, migration logic, title fix, routing order |
| `client/src/components/blocks/SendDataToTableBlockEditor.tsx` | ~15 | Always-visible mappings grid with empty states |

---

## Build Status

```bash
✅ TypeScript Compilation: SUCCESS
✅ Vite Build: SUCCESS (3.7MB bundle)
✅ Bundle Size: 3.72MB → 770KB gzipped
```

---

## Truth Logging Output (Example)

When opening a Send Data to Table block:

```javascript
OPEN_BLOCK {
  blockId: "abc-123-def",
  blockType: "write",
  blockDisplayType: "write",
  blockSource: "regular",
  rawType: "write",
  rawConfig: { dataSourceId: "...", tableId: "...", columnMappings: [...], mode: "upsert" },
  fullBlock: { ... }
}

RENDER_EDITOR {
  blockId: "abc-123-def",
  blockType: "write",
  resolvedEditorName: "SendDataToTableBlockEditor"
}
```

**If the block has the wrong type**, you will see:
```javascript
⚠️ MIGRATION: Converting read_table block with columnMappings to write block
```

---

## Next Steps (If Issue Persists)

If after this fix the block STILL opens the wrong editor:

1. **Check console logs** - look for `OPEN_BLOCK` and `RENDER_EDITOR`
2. **Verify block type in database** - check `blocks` table, `type` column
3. **Check for database migration** - some blocks may need permanent DB fix:
   ```sql
   UPDATE blocks
   SET type = 'write'
   WHERE config::jsonb ? 'columnMappings'
     AND type = 'read_table';
   ```

---

## Success Criteria

✅ Truth logging shows correct block type and editor name
✅ Modal title matches block type from database
✅ Mappings grid always visible in Send Data editor
✅ Read editor fields never appear in Send Data editor
✅ Auto-migration fixes legacy blocks
✅ Build passes without errors
✅ No TypeScript errors
