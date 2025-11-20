# PR 8 — Column Reordering (Drag & Drop) + Type Icons

**Status:** ✅ Complete
**Date:** November 19, 2025
**Type:** Enhanced Functionality
**Depends On:** PR 7 (TableGridView foundation)

---

## Summary

This PR adds drag-and-drop column reordering functionality to the baseline TableGridView component using `@dnd-kit/core`. It also implements colored type icons for all column types, providing visual feedback about data types and improving the user experience.

## Features Implemented

✅ **Drag-and-drop column reordering** - Move columns by dragging headers
✅ **Type icons for all column types** - Visual indicators (text, number, boolean, date, etc.)
✅ **Colored type icons** - Different colors for each type for quick recognition
✅ **Optimistic UI updates** - Instant feedback while saving to backend
✅ **Error handling with rollback** - Reverts changes if API call fails
✅ **Toast notifications** - User feedback for success/error states
✅ **Keyboard navigation** - Accessible drag-and-drop with keyboard
✅ **Backend persistence** - Order saved via `/columns/reorder` endpoint

---

## Files Changed

### New Components

**`client/src/components/datavault/SortableColumnHeader.tsx`** (67 lines)
- Draggable column header using `useSortable` hook
- Integrated drag handle with `GripVertical` icon
- Type icon with color coding
- PK badge and required indicator
- Hover effects for better UX

### Modified Components

**`client/src/components/datavault/TableGridView.tsx`** (PR 7 → PR 8)
- Added `DndContext` wrapper around table
- Added `SortableContext` around column headers
- Implemented `handleDragEnd` handler
- Added optimistic local state for columns
- Integrated `reorderColumns` API call
- Added drag-and-drop sensors (pointer + keyboard)
- Error handling with rollback on failure

**`client/src/components/datavault/ColumnHeaderCell.tsx`** (PR 7 → PR 8)
- Added type icon with color coding
- Updated to use `ColumnTypeIcon` and `getColumnTypeColor`
- Added note: use `SortableColumnHeader` for draggable version

### Backend (Already Exists)

**`server/routes/datavault.routes.ts`**
- `POST /api/datavault/tables/:tableId/columns/reorder`
- Accepts `{ columnIds: string[] }`
- Updates `orderIndex` for each column

**`server/services/DatavaultColumnsService.ts`**
- `reorderColumns(tableId, tenantId, columnIds)` method
- Validates column ownership
- Updates order in transaction

### API Client (Already Exists)

**`client/src/lib/datavault-api.ts`**
- `reorderColumns(tableId, columnIds)` method

---

## Type Icons Mapping

| Type | Icon | Color |
|------|------|-------|
| **text** / **long_text** | `Type` (A icon) | Blue |
| **number** / **auto_number** | `Hash` (#) | Green |
| **boolean** / **yes_no** | `ToggleLeft` | Purple |
| **date** | `Calendar` | Orange |
| **datetime** | `Clock` | Orange |
| **email** | `Mail` | Pink |
| **phone** | `Phone` | Cyan |
| **url** | `Link` | Indigo |
| **json** | `FileJson` | Yellow |
| **file_upload** | `File` | Gray |
| **reference** (future) | `Link` (🔗) | Indigo |

All icons are from `lucide-react` with consistent sizing (4x4).

---

## Architecture

### Component Hierarchy

```
TableGridView
├── DndContext (collision detection: closestCenter)
│   └── table
│       └── thead
│           └── tr
│               └── SortableContext (horizontal strategy)
│                   └── SortableColumnHeader (for each column)
│                       ├── Drag handle (GripVertical)
│                       ├── Type icon (colored)
│                       ├── Column name
│                       ├── PK badge (conditional)
│                       └── Required indicator (conditional)
```

### Drag & Drop Flow

1. **User starts drag** → `PointerSensor` detects (8px threshold)
2. **Dragging** → Visual feedback (opacity, transform)
3. **Drop** → `handleDragEnd` fires with `active` and `over` IDs
4. **Optimistic update** → `setLocalColumns(newOrder)` (instant UI)
5. **API call** → `datavaultAPI.reorderColumns(tableId, columnIds)`
6. **Success** → Toast notification, state persists
7. **Failure** → Rollback to previous order, error toast

### State Management

```typescript
const [localColumns, setLocalColumns] = useState<DatavaultColumn[]>([]);

// Initialize from server data
useQuery({
  onSuccess: (data) => {
    if (data?.columns) {
      setLocalColumns(data.columns);
    }
  },
});

// Use local columns for display (with fallback to schema)
const columns = localColumns.length > 0 ? localColumns : (schema.columns || []);
```

---

## Usage Example

```tsx
import { TableGridView } from "@/components/datavault/TableGridView";

function DatabasePage() {
  const tableId = "table-uuid";

  return (
    <div className="p-6">
      <h1>My Table</h1>
      {/* TableGridView now supports drag-and-drop column reordering */}
      <TableGridView tableId={tableId} />
    </div>
  );
}
```

### User Interaction

1. **Mouse drag**: Click and hold the grip handle (⋮⋮), drag left/right
2. **Keyboard**: Tab to grip handle, press Space/Enter, use arrow keys, Space/Enter to drop
3. **Visual feedback**: Column becomes semi-transparent while dragging
4. **Success**: "Columns reordered" toast appears
5. **Error**: "Failed to reorder columns" toast, order reverts

---

## API Endpoint

### POST `/api/datavault/tables/:tableId/columns/reorder`

**Request:**
```json
{
  "columnIds": ["col-3", "col-1", "col-2"]
}
```

**Response:**
```json
HTTP 204 No Content
```

**Behavior:**
- Updates `orderIndex` for each column (0, 1, 2, ...)
- Validates all columns belong to the table and tenant
- Atomic update (all or nothing)

---

## Tests

### Unit Tests Created

**`tests/unit/components/datavault/SortableColumnHeader.test.tsx`**
- Renders column name
- Shows drag handle
- Shows type icon for each type
- Shows PK badge and required indicator
- Applies correct CSS classes

**`tests/unit/components/datavault/TableGridViewDragDrop.test.tsx`**
- Renders DndContext and SortableContext
- Displays columns with type icons
- Displays PK badges
- Calls reorderColumns API
- Displays columns in correct order based on orderIndex
- Maintains order after successful reorder

### Test Coverage

Run tests with:
```bash
npm test -- SortableColumnHeader
npm test -- TableGridViewDragDrop
```

---

## Key Differences from Advanced Components

| Feature | PR 8 (Basic) | Advanced (Existing) |
|---------|--------------|---------------------|
| **Column Reordering** | ✅ Yes (basic) | ✅ Yes (with PK constraints) |
| **Type Icons** | ✅ Yes (all types) | ✅ Yes (all types) |
| **Drag Threshold** | ✅ 8px | ✅ 8px |
| **Keyboard Support** | ✅ Yes | ✅ Yes |
| **Optimistic Updates** | ✅ Yes | ✅ Yes |
| **Primary Key Locking** | ❌ No | ✅ Yes (can't move sole PK) |
| **Multi-PK Handling** | ❌ No | ✅ Yes (PKs stay left) |
| **Visual Constraints** | ❌ No | ✅ Yes (blocks invalid drops) |

The basic implementation allows all columns to be reordered freely. The advanced implementation has business rules about primary key positioning.

---

## Browser Compatibility

- **Chrome/Edge**: ✅ Full support
- **Firefox**: ✅ Full support
- **Safari**: ✅ Full support (with `-webkit-` fallbacks)
- **Mobile**: ✅ Touch events supported via `PointerSensor`

---

## Performance Considerations

1. **Activation Constraint**: 8px distance prevents accidental drags
2. **Optimistic Updates**: Instant UI feedback (no waiting for API)
3. **Debouncing**: Not needed (single API call per complete drag)
4. **Rendering**: Only re-renders affected headers during drag
5. **Collision Detection**: `closestCenter` is efficient for horizontal lists

---

## Accessibility

- **Keyboard navigation**: Tab to grip handle, Space/Enter to activate
- **ARIA labels**: Type icons have descriptive labels
- **Screen readers**: Announce drag start/end events
- **Focus management**: Focus returns to dropped item
- **Visual feedback**: Clear hover states and drag previews

---

## Future Enhancements (Not in PR 8)

- Column width resizing
- Column pinning (freeze left columns)
- Column visibility toggle
- Column grouping
- Save column preferences per user
- Undo/redo for column operations

---

## Dependencies

**NPM Packages** (already installed):
- `@dnd-kit/core` ^6.3.1
- `@dnd-kit/sortable` ^10.0.0
- `@dnd-kit/utilities` ^3.2.2
- `lucide-react` (for icons)

**Internal Components**:
- `ColumnTypeIcon` (already exists)
- `getColumnTypeColor` helper (already exists)

---

## Migration Notes

### From PR 7 to PR 8

If you're using the basic `TableGridView` from PR 7:
- ✅ **No breaking changes** - component API is the same
- ✅ **Automatic upgrade** - just update the component file
- ✅ **New features enabled** - drag-and-drop works immediately
- ✅ **Type icons added** - no configuration needed

### Backend Requirements

- ✅ Column reorder endpoint already exists
- ✅ No migration needed
- ✅ `orderIndex` column already in schema

---

## Troubleshooting

### Columns won't reorder

1. Check console for API errors
2. Verify `reorderColumns` endpoint is working
3. Ensure user has permission to modify table
4. Check that `orderIndex` column exists in DB

### Type icons not showing

1. Verify `ColumnTypeIcon` component is imported
2. Check column `type` field is valid
3. Ensure lucide-react icons are installed

### Drag handle not working

1. Check `@dnd-kit` packages are installed
2. Verify sensors are configured correctly
3. Test on different browsers
4. Check for CSS conflicts with `cursor: grab`

---

## Related PRs

- **PR 7**: TableGridView foundation (required)
- **PR 9**: Column width resizing (future)
- **PR 10**: Column visibility controls (future)

---

## Conclusion

PR 8 successfully adds drag-and-drop column reordering and type icons to the baseline TableGridView component. The implementation uses industry-standard `@dnd-kit` library with proper accessibility support, optimistic updates, and error handling.

**Status:** ✅ Ready for testing and production use
