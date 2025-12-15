# Prompt DB-4 - Dynamic Dropdown Options Implementation

**Status:** ✅ Complete
**Date:** December 15, 2025
**Version:** 1.7.1

---

## Overview

Implemented comprehensive dynamic options support for choice questions (dropdown, radio, multiple choice). Questions can now source their options from:

1. **Static Options** - Manually defined options (existing behavior)
2. **From List** - Bind to a ListVariable from Read Table / List Tools blocks
3. **From Table Column** - Convenience path to load directly from a table column

---

## Implementation Summary

### 1. Type System Updates

**File:** `shared/types/stepConfigs.ts`

Added comprehensive type definitions:

```typescript
export type DynamicOptionsSourceType = 'static' | 'list' | 'table_column';

export type DynamicOptionsConfig =
  | { type: 'static'; options: ChoiceOption[] }
  | {
      type: 'list';
      listVariable: string;
      labelColumnId: string;
      valueColumnId: string;
    }
  | {
      type: 'table_column';
      dataSourceId: string;
      tableId: string;
      columnId: string;
      labelColumnId?: string;
      filters?: Array<{ columnId: string; operator: string; value: any }>;
      sort?: { columnId: string; direction: 'asc' | 'desc' };
      limit?: number;
    };
```

Updated `ChoiceAdvancedConfig` to support the new structure:

```typescript
export interface ChoiceAdvancedConfig {
  display: 'radio' | 'dropdown' | 'multiple';
  allowMultiple: boolean;
  options: ChoiceOption[] | DynamicOptionsConfig;  // ← Changed
  // ... other fields
}
```

### 2. OptionsEditor Component (Complete Rewrite)

**File:** `client/src/components/builder/questions/OptionsEditor.tsx`

**Key Features:**
- Three-button segmented control (Advanced mode) or dropdown (Easy mode)
- Static mode: Drag-and-drop option editor with label/value separation
- List mode: Configure list variable and column mappings
- Table column mode: Configure data source, table, column, optional label column, limit

**Easy Mode:**
- Simple dropdown selector: "Static Options" or "From Saved Data"
- Hides "From Table" option
- Hides advanced fields like limit

**Advanced Mode:**
- Three-button segmented control with icons
- Full table column configuration
- Limit control for table sources

### 3. ChoiceBlock Renderer Updates

**File:** `client/src/components/runner/blocks/ChoiceBlock.tsx`

**Key Changes:**
- Added `useState` and `useEffect` for async option loading
- Handles all three source types:
  - **Static:** Direct rendering from config
  - **List:** Reads from `context[listVariable]`, handles both `ListVariable` structure and plain arrays
  - **Table Column:** Fetches from `/api/tables/{tableId}/rows?limit={limit}` with proper error handling

**Loading States:**
- Loading: Shows "Loading options..." with pulse animation
- Error: Shows error message in destructive color
- Empty: Shows "No options available" message

**Data Mapping:**
- For list sources: Maps `rows[labelColumnId]` → label, `rows[valueColumnId]` → alias
- For table sources: Maps `row.data[columnId]` → alias, `row.data[labelColumnId || columnId]` → label

### 4. Backward Compatibility

**Legacy Formats:**
- Legacy `radio` type with string[] options - ✅ Supported
- Legacy `multiple_choice` with string[] options - ✅ Supported
- Legacy `choice` with static ChoiceOption[] - ✅ Supported
- Old dynamic format `{ type: 'dynamic', listVariable, labelKey, valueKey }` - ✅ Supported via migration path

---

## Feature Capabilities

### Static Options
- Manual option entry with drag-and-drop reordering
- Label vs Value (alias) separation
- Add/remove options dynamically
- Auto-generated IDs

### From List (List Variable)
- Binds to output of Read Table or List Tools blocks
- Specify list variable name (e.g., `usersList`)
- Map label and value columns by ID
- Handles both `ListVariable` structure and plain arrays
- Real-time updates if context changes

### From Table Column (Convenience Path)
- Directly load from a DataVault table
- Specify data source ID, table ID, column ID
- Optional separate label column
- Optional filters (future enhancement)
- Optional sort (future enhancement)
- Configurable limit (default: 100, max: 1000)
- Async loading with proper error handling

---

## UI/UX Details

### Easy Mode
```
Options Source: [Dropdown]
  ├─ Static Options
  └─ From Saved Data

[Source-specific config UI]
```

### Advanced Mode
```
Options Source: [Static] [From List] [From Table]
              (3-button segmented control with icons)

[Source-specific config UI]
```

### Static Options Editor
```
┌─────────────────────────────────────┐
│ Display Label   │ Saved Value   │ × │
├─────────────────────────────────────┤
│ Option 1        │ option_1      │ × │
│ Option 2        │ option_2      │ × │
└─────────────────────────────────────┘
[+ Add Option]
```

### From List Config
```
List Variable: [usersList___________]
Label Column:  [full_name___] Value Column: [user_id_____]
```

### From Table Config
```
Data Source ID:      [database-uuid_____]
Table ID:            [table-uuid________]
Column ID:           [column-uuid_______]
Label Column ID:     [column-uuid_______] (optional)
Limit:               [100] (Advanced mode only)
```

---

## Runtime Behavior

### Preview Mode
- Static options: Rendered immediately
- List sources: Loaded from preview context
- Table sources: Fetched async via API

### Live Run Mode
- Static options: Rendered immediately
- List sources: Loaded from run context (after Read Table / List Tools execution)
- Table sources: Fetched async via API with proper authentication

### Error Handling
- Missing list variable: Logs warning, shows empty state
- Table fetch failure: Shows error message in UI
- Invalid config: Shows "Invalid choice configuration"

---

## Data Flow

### Static Options
```
OptionsEditor → config.options: { type: 'static', options: [...] }
              ↓
ChoiceBlock → Render options immediately
```

### From List
```
Read Table Block → context.usersList = { rows: [...], columns: [...] }
                 ↓
ChoiceBlock → Extract rows[labelColumnId] and rows[valueColumnId]
            → Render options
```

### From Table
```
OptionsEditor → config.options: {
  type: 'table_column',
  tableId,
  columnId,
  ...
}
              ↓
ChoiceBlock → fetch(`/api/tables/${tableId}/rows?limit=${limit}`)
            → Map row.data[columnId] → options
            → Render options
```

---

## Testing Checklist

- [x] Static options work in Easy mode
- [x] Static options work in Advanced mode
- [x] From List works with Read Table output
- [x] From List works with List Tools output
- [x] From List handles missing variables gracefully
- [x] From Table loads data correctly
- [x] From Table shows loading state
- [x] From Table shows error state
- [x] From Table respects limit parameter
- [x] Label/value separation works correctly
- [x] Required questions block progression
- [x] Hidden questions never block
- [x] Radio display mode works
- [x] Dropdown display mode works
- [x] Multiple (checkbox) display mode works
- [x] Backward compatibility with legacy formats

---

## Known Limitations

1. **Table Column Source:**
   - No filter/sort UI yet (config structure supports it)
   - Requires manual UUID entry (future: dropdown selector)
   - No preview of loaded options in builder

2. **List Source:**
   - Requires manual column ID entry (future: autocomplete)
   - No validation that list variable exists

3. **Performance:**
   - Large datasets (>1000 options) may slow dropdown rendering
   - No virtualization for very long lists

---

## Future Enhancements

1. **Builder UX:**
   - Dropdown selectors for data sources, tables, columns
   - Preview loaded options in builder
   - Autocomplete for list variables

2. **Runtime Features:**
   - Filter/sort UI for table sources
   - Virtualized dropdown for large option sets
   - Search functionality for dropdown mode
   - Caching for table column sources

3. **Advanced Features:**
   - Dependent dropdowns (cascade)
   - Remote search (typeahead)
   - Multi-column display in dropdown

---

## Migration Notes

**No breaking changes.** All existing workflows continue to work:

- Legacy `radio` / `multiple_choice` with string[] options → Auto-migrated
- Legacy `choice` with ChoiceOption[] → Works as-is
- New `choice` with DynamicOptionsConfig → Full feature support

**Migration path for old dynamic format:**
```typescript
// Old format (still works):
{ type: 'dynamic', listVariable: 'x', labelKey: 'y', valueKey: 'z' }

// Detected by: 'type' in options && options.type === 'dynamic'
// Auto-handled in ChoiceBlock renderer
```

---

## Files Changed

### Type Definitions
- `shared/types/stepConfigs.ts` - Added DynamicOptionsConfig types

### Frontend Components
- `client/src/components/builder/questions/OptionsEditor.tsx` - Complete rewrite
- `client/src/components/runner/blocks/ChoiceBlock.tsx` - Added async loading logic

### Backend
- No backend changes required (uses existing `/api/tables/{id}/rows` endpoint)

---

## Completion Criteria

✅ All functional requirements met:
1. ✅ Dropdown, Radio, Multiple choice support dynamic options
2. ✅ Three source types: Static, From List, From Table Column
3. ✅ Label vs Value separation working
4. ✅ Required + Show/Hide compatibility
5. ✅ Easy mode shows simplified UI
6. ✅ Preview behavior works deterministically

✅ All non-functional requirements met:
- No full query editor UI added
- No new backend systems introduced
- Naming is consistent (no survey terminology)
- Breaking frontend changes are acceptable

---

**Implementation Status:** ✅ **COMPLETE**

All requirements from Prompt DB-4 have been successfully implemented.
