/**
 * Options Editor Component
 * Inline editor for radio and multiple choice options
 * Supports add/remove/reorder with drag and drop
 * Supports value aliases (Display Value vs Saved Value)
 */

import { useState, useEffect } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

export interface OptionItemData {
  id: string;
  label: string;
  alias?: string;
}

interface OptionsEditorProps {
  options: (string | OptionItemData)[];
  onChange: (options: OptionItemData[]) => void;
  className?: string;
}

export function OptionsEditor({ options, onChange, className }: OptionsEditorProps) {
  // Normalize options to objects
  const normalizeOptions = (opts: (string | OptionItemData)[]): OptionItemData[] => {
    return opts.map((opt, index) => {
      if (typeof opt === 'string') {
        return {
          id: `opt-${Date.now()}-${index}`,
          label: opt,
          alias: opt.toLowerCase().replace(/\s+/g, '_')
        };
      }
      return {
        ...opt,
        id: opt.id || `opt-${Date.now()}-${index}`
      };
    });
  };

  const [localOptions, setLocalOptions] = useState<OptionItemData[]>(normalizeOptions(options));

  // Sync with props if they change externally (and aren't just what we passed up)
  useEffect(() => {
    setLocalOptions(normalizeOptions(options));
  }, [options]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddOption = () => {
    const newId = `opt-${Date.now()}`;
    const newOption: OptionItemData = {
      id: newId,
      label: `Option ${localOptions.length + 1}`,
      alias: `option_${localOptions.length + 1}`
    };
    const newOptions = [...localOptions, newOption];
    setLocalOptions(newOptions);
    onChange(newOptions);
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = localOptions.filter((_, i) => i !== index);
    setLocalOptions(newOptions);
    onChange(newOptions);
  };

  const handleUpdateOption = (index: number, field: keyof OptionItemData, value: string) => {
    const newOptions = [...localOptions];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setLocalOptions(newOptions);
  };

  const handleBlur = () => {
    onChange(localOptions);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localOptions.findIndex((o) => o.id === active.id);
      const newIndex = localOptions.findIndex((o) => o.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(localOptions, oldIndex, newIndex);
        setLocalOptions(reordered);
        onChange(reordered);
      }
    }
  };

  // Dynamic Options State
  const [mode, setMode] = useState<'static' | 'dynamic'>(
    (options as any)?.type === 'dynamic' ? 'dynamic' : 'static'
  );

  // Sync mode when options prop changes
  useEffect(() => {
    setMode((options as any)?.type === 'dynamic' ? 'dynamic' : 'static');
  }, [options]);

  const handleModeChange = (newMode: 'static' | 'dynamic') => {
    setMode(newMode);
    if (newMode === 'static') {
      onChange(localOptions); // Restore static options
    } else {
      // Emit dynamic config
      // @ts-ignore
      onChange({ type: 'dynamic', listVariable: '', labelKey: '', valueKey: '' });
    }
  };

  const handleDynamicChange = (key: string, value: string) => {
    // @ts-ignore
    const currentConfig = (options as any)?.type === 'dynamic' ? options : { type: 'dynamic', listVariable: '', labelKey: '', valueKey: '' };
    // @ts-ignore
    onChange({ ...currentConfig, [key]: value });
  };

  const isDynamic = (options as any)?.type === 'dynamic';

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Options Source</span>
        <div className="flex bg-muted rounded-md p-0.5">
          <button
            onClick={() => handleModeChange('static')}
            className={cn("text-xs px-2 py-1 rounded-sm transition-colors", mode === 'static' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            Static
          </button>
          <button
            onClick={() => handleModeChange('dynamic')}
            className={cn("text-xs px-2 py-1 rounded-sm transition-colors", mode === 'dynamic' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            Dynamic
          </button>
        </div>
      </div>

      {mode === 'static' ? (
        <>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddOption}
              className="h-7 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Option
            </Button>
          </div>

          {localOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center border dashed border-border rounded">
              No options defined.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localOptions.map((o) => o.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  <div className="grid grid-cols-[24px_1fr_1fr_24px] gap-2 px-1.5 mb-1">
                    <span />
                    <span className="text-[10px] text-muted-foreground pl-1">Display Label</span>
                    <span className="text-[10px] text-muted-foreground pl-1">Saved Value</span>
                    <span />
                  </div>
                  {localOptions.map((option, index) => (
                    <OptionItem
                      key={option.id}
                      id={option.id}
                      data={option}
                      index={index}
                      onUpdate={handleUpdateOption}
                      onBlur={handleBlur}
                      onRemove={() => handleRemoveOption(index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </>
      ) : (
        <div className="space-y-3 p-3 border rounded-md bg-muted/20">
          <div className="space-y-1.5">
            <span className="text-xs font-medium">List Variable</span>
            <Input
              placeholder="e.g. usersList"
              className="h-8 font-mono text-xs"
              // @ts-ignore
              value={(options as any)?.listVariable || ''}
              onChange={(e) => handleDynamicChange('listVariable', e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">The variable name output by a Read Data block.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <span className="text-xs font-medium">Label Column</span>
              <Input
                placeholder="e.g. full_name"
                className="h-8 text-xs"
                // @ts-ignore
                value={(options as any)?.labelKey || ''}
                onChange={(e) => handleDynamicChange('labelKey', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium">Value Column</span>
              <Input
                placeholder="e.g. id"
                className="h-8 text-xs"
                // @ts-ignore
                value={(options as any)?.valueKey || ''}
                onChange={(e) => handleDynamicChange('valueKey', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface OptionItemProps {
  id: string;
  data: OptionItemData;
  index: number;
  onUpdate: (index: number, field: keyof OptionItemData, value: string) => void;
  onBlur: () => void;
  onRemove: () => void;
}

function OptionItem({ id, data, index, onUpdate, onBlur, onRemove }: OptionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-1.5 rounded border bg-background group",
        isDragging && "opacity-50"
      )}
    >
      <button
        className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-accent rounded opacity-0 group-hover:opacity-100 mt-1"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>

      {/* Display Value (Label) */}
      <Input
        value={data.label}
        onChange={(e) => onUpdate(index, 'label', e.target.value)}
        onBlur={onBlur}
        className="flex-1 h-8 text-sm"
        placeholder="Display Value"
      />

      {/* Saved Value (Alias) */}
      <Input
        value={data.alias || ""}
        onChange={(e) => onUpdate(index, 'alias', e.target.value)}
        onBlur={onBlur}
        className="flex-1 h-8 text-sm font-mono text-muted-foreground"
        placeholder="Saved Value"
      />

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
