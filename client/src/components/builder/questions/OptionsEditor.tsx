/**
 * Options Editor Component
 * Inline editor for radio and multiple choice options
 * Supports add/remove/reorder with drag and drop
 */

import { useState } from "react";
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

interface OptionsEditorProps {
  options: string[];
  onChange: (options: string[]) => void;
  className?: string;
}

export function OptionsEditor({ options, onChange, className }: OptionsEditorProps) {
  const [localOptions, setLocalOptions] = useState<string[]>(options);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddOption = () => {
    const newOptions = [...localOptions, `Option ${localOptions.length + 1}`];
    setLocalOptions(newOptions);
    onChange(newOptions);
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = localOptions.filter((_, i) => i !== index);
    setLocalOptions(newOptions);
    onChange(newOptions);
  };

  const handleOptionTextChange = (index: number, text: string) => {
    const newOptions = [...localOptions];
    newOptions[index] = text;
    setLocalOptions(newOptions);
  };

  const handleOptionTextBlur = () => {
    onChange(localOptions);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localOptions.findIndex((_, i) => i.toString() === active.id);
      const newIndex = localOptions.findIndex((_, i) => i.toString() === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(localOptions, oldIndex, newIndex);
        setLocalOptions(reordered);
        onChange(reordered);
      }
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Options</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddOption}
          className="h-7 text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add
        </Button>
      </div>

      {localOptions.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No options yet. Click "Add" to create one.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localOptions.map((_, i) => i.toString())}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1.5">
              {localOptions.map((option, index) => (
                <OptionItem
                  key={index}
                  id={index.toString()}
                  option={option}
                  index={index}
                  onChange={(text) => handleOptionTextChange(index, text)}
                  onBlur={handleOptionTextBlur}
                  onRemove={() => handleRemoveOption(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

interface OptionItemProps {
  id: string;
  option: string;
  index: number;
  onChange: (text: string) => void;
  onBlur: () => void;
  onRemove: () => void;
}

function OptionItem({ id, option, index, onChange, onBlur, onRemove }: OptionItemProps) {
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
        "flex items-center gap-1.5 p-1.5 rounded border bg-background group",
        isDragging && "opacity-50"
      )}
    >
      <button
        className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-accent rounded opacity-0 group-hover:opacity-100"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>

      <span className="text-xs text-muted-foreground w-4">{index + 1}.</span>

      <Input
        value={option}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="flex-1 h-7 text-sm"
        placeholder={`Option ${index + 1}`}
      />

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
