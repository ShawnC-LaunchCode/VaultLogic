/**
 * Cell Renderer Component (PR 7)
 * Renders editable cells based on column type
 * Supports: text, number, date, boolean
 * Future: email, url, reference fields
 */

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { DatavaultColumn } from "@/lib/types/datavault";
import type { ApiDatavaultRowWithValues } from "@/lib/datavault-api";
import { ReferenceCell } from "./ReferenceCell";

interface CellRendererProps {
  row: ApiDatavaultRowWithValues;
  column: DatavaultColumn;
  editing: boolean;
  onCommit: (value: any) => void;
  onCancel?: () => void;
  batchReferencesData?: Record<string, { displayValue: string; row: any }>;
}

// Helper: Render value based on column type (display mode)
function renderValue(value: any, type: string): string {
  if (value === null || value === undefined) return "";

  switch (type) {
    case "boolean":
      return value ? "Yes" : "No";
    case "date":
      if (value) {
        const date = new Date(value);
        return date.toLocaleDateString();
      }
      return "";
    case "datetime":
      if (value) {
        const date = new Date(value);
        return date.toLocaleString();
      }
      return "";
    case "number":
    case "auto_number":
      return typeof value === "number" ? value.toString() : value;
    default:
      return value.toString();
  }
}

export function CellRenderer({ row, column, editing, onCommit, onCancel, batchReferencesData }: CellRendererProps) {
  const value = row.values[column.id];
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update edit value when row value changes
  useEffect(() => {
    setEditValue(value);
  }, [value]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    onCommit(editValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditValue(value); // Revert
      onCancel?.();
    }
  };

  // Display mode
  if (!editing) {
    // Special handling for reference types
    if (column.type === "reference") {
      return <ReferenceCell value={value} column={column} batchData={batchReferencesData} />;
    }

    // Special handling for boolean types
    if (column.type === "boolean") {
      return (
        <div className="flex items-center">
          <Checkbox checked={!!value} disabled aria-label={column.name} />
        </div>
      );
    }

    return (
      <span className="truncate block" title={renderValue(value, column.type)}>
        {renderValue(value, column.type)}
      </span>
    );
  }

  // Edit mode - render appropriate input based on column type
  switch (column.type) {
    case "text":
    case "email":
    case "url":
      return (
        <EditableTextCell
          value={editValue}
          type={column.type}
          onCommit={onCommit}
          onChange={setEditValue}
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
        />
      );

    case "number":
    case "auto_number":
      return (
        <NumberCell
          value={editValue}
          onCommit={onCommit}
          onChange={setEditValue}
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
          readOnly={column.type === "auto_number"}
        />
      );

    case "boolean":
      return (
        <BooleanCell
          value={editValue}
          onCommit={onCommit}
        />
      );

    case "date":
      return (
        <DateCell
          value={editValue}
          onCommit={onCommit}
          onChange={setEditValue}
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
        />
      );

    case "datetime":
      return (
        <DateTimeCell
          value={editValue}
          onCommit={onCommit}
          onChange={setEditValue}
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
        />
      );

    case "reference":
      // Reference columns are read-only for now
      return <ReferenceCell value={editValue} column={column} />;

    default:
      return <span className="text-muted-foreground">Unsupported type: {column.type}</span>;
  }
}

// Editable Text Cell
function EditableTextCell({
  value,
  type,
  onCommit,
  onChange,
  onKeyDown,
  inputRef
}: {
  value: any;
  type: string;
  onCommit: (v: any) => void;
  onChange: (v: any) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <Input
      ref={inputRef}
      type={type === "email" ? "email" : type === "url" ? "url" : "text"}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={onKeyDown}
      className="h-8 text-sm"
    />
  );
}

// Number Cell
function NumberCell({
  value,
  onCommit,
  onChange,
  onKeyDown,
  inputRef,
  readOnly = false
}: {
  value: any;
  onCommit: (v: any) => void;
  onChange: (v: any) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  readOnly?: boolean;
}) {
  return (
    <Input
      ref={inputRef}
      type="number"
      value={value || ""}
      onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
      onBlur={() => onCommit(value)}
      onKeyDown={onKeyDown}
      disabled={readOnly}
      className="h-8 text-sm"
    />
  );
}

// Boolean Cell
function BooleanCell({
  value,
  onCommit
}: {
  value: any;
  onCommit: (v: any) => void;
}) {
  return (
    <div className="flex items-center">
      <Checkbox
        checked={!!value}
        onCheckedChange={(checked) => onCommit(checked)}
        aria-label="Toggle value"
      />
    </div>
  );
}

// Date Cell
function DateCell({
  value,
  onCommit,
  onChange,
  onKeyDown,
  inputRef
}: {
  value: any;
  onCommit: (v: any) => void;
  onChange: (v: any) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  // Convert to YYYY-MM-DD format
  const dateValue = value ? new Date(value).toISOString().split('T')[0] : "";

  return (
    <Input
      ref={inputRef}
      type="date"
      value={dateValue}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={onKeyDown}
      className="h-8 text-sm"
    />
  );
}

// DateTime Cell
function DateTimeCell({
  value,
  onCommit,
  onChange,
  onKeyDown,
  inputRef
}: {
  value: any;
  onCommit: (v: any) => void;
  onChange: (v: any) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  // Convert to datetime-local format (YYYY-MM-DDThh:mm)
  const dateTimeValue = value
    ? new Date(value).toISOString().slice(0, 16)
    : "";

  return (
    <Input
      ref={inputRef}
      type="datetime-local"
      value={dateTimeValue}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={onKeyDown}
      className="h-8 text-sm"
    />
  );
}
