/**
 * Column Header Cell Component (PR 7 + PR 8)
 * Simple column header with type icon
 * Note: For draggable headers, use SortableColumnHeader instead
 */

import type { DatavaultColumn } from "@shared/schema";
import { ColumnTypeIcon, getColumnTypeColor } from "./ColumnTypeIcon";

interface ColumnHeaderCellProps {
  column: DatavaultColumn;
}

export function ColumnHeaderCell({ column }: ColumnHeaderCellProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Type icon with color */}
      <ColumnTypeIcon
        type={column.type}
        className={getColumnTypeColor(column.type)}
      />

      {/* Column name */}
      <span className="font-semibold">{column.name}</span>

      {/* Primary key badge */}
      {column.isPrimaryKey && (
        <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded">
          PK
        </span>
      )}

      {/* Required indicator */}
      {column.required && (
        <span className="text-xs text-red-500">*</span>
      )}
    </div>
  );
}
