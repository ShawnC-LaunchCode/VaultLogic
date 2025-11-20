/**
 * Sortable Column Header Component (PR 8)
 * Draggable column header with type icon and reorder handle
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { ColumnTypeIcon, getColumnTypeColor } from "./ColumnTypeIcon";
import type { DatavaultColumn } from "@shared/schema";

interface SortableColumnHeaderProps {
  column: DatavaultColumn;
}

export function SortableColumnHeader({ column }: SortableColumnHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="bg-gray-50 dark:bg-gray-800 px-3 py-2 border-b"
    >
      <div className="flex items-center gap-2">
        {/* Drag handle */}
        <span
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          title="Drag to reorder column"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </span>

        {/* Type icon */}
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
        {column.required && <span className="text-xs text-red-500">*</span>}
      </div>
    </th>
  );
}
