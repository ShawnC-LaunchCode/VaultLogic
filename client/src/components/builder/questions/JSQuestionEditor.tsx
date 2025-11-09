/**
 * JS Question Editor Component
 * Editor for JavaScript question configuration
 * Handles code, input/output mapping, display mode, and timeout settings
 */

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface JSQuestionConfig {
  display: "visible" | "hidden";
  code: string;
  inputKeys: string[];
  outputKey: string;
  timeoutMs?: number;
  helpText?: string;
}

interface JSQuestionEditorProps {
  config: JSQuestionConfig;
  onChange: (config: JSQuestionConfig) => void;
  className?: string;
}

export function JSQuestionEditor({ config, onChange, className }: JSQuestionEditorProps) {
  const [localConfig, setLocalConfig] = useState<JSQuestionConfig>(config);

  // Sync with external changes
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = (updates: Partial<JSQuestionConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
  };

  const handleBlur = () => {
    onChange(localConfig);
  };

  const handleInputKeysChange = (value: string) => {
    const keys = value.split(',').map(k => k.trim()).filter(k => k.length > 0);
    handleChange({ inputKeys: keys });
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="text-sm font-medium text-muted-foreground border-b pb-1">
        JavaScript Configuration
      </div>

      {/* Display Mode */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Display Mode
        </Label>
        <Select
          value={localConfig.display}
          onValueChange={(value) => {
            const newDisplay = value as "visible" | "hidden";
            handleChange({ display: newDisplay });
            handleBlur();
          }}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hidden">Hidden (compute only)</SelectItem>
            <SelectItem value="visible">Visible (interactive)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground pl-1">
          {localConfig.display === "hidden"
            ? "Runs as background computation, no UI shown"
            : "Shows help text in runner, but still computes automatically"}
        </p>
      </div>

      {/* Output Key */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Output Variable
        </Label>
        <Input
          value={localConfig.outputKey}
          onChange={(e) => handleChange({ outputKey: e.target.value })}
          onBlur={handleBlur}
          placeholder="e.g., computed_value, full_name"
          className="h-9 text-sm font-mono"
        />
        <p className="text-xs text-muted-foreground pl-1">
          Where to store the computed result
        </p>
      </div>

      {/* Input Keys */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Input Variables (comma-separated)
        </Label>
        <Input
          value={localConfig.inputKeys.join(', ')}
          onChange={(e) => handleInputKeysChange(e.target.value)}
          onBlur={handleBlur}
          placeholder="e.g., first_name, last_name, age"
          className="h-9 text-sm font-mono"
        />
        <p className="text-xs text-muted-foreground pl-1">
          Variables from other questions to use as inputs
        </p>
      </div>

      {/* Code Editor */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          JavaScript Code
        </Label>
        <Textarea
          value={localConfig.code}
          onChange={(e) => handleChange({ code: e.target.value })}
          onBlur={handleBlur}
          placeholder="return input.first_name + ' ' + input.last_name;"
          rows={6}
          className="text-sm font-mono resize-none"
        />
        <p className="text-xs text-muted-foreground pl-1">
          Function body. Use <code className="font-mono">input</code> to access input variables. Return the result.
        </p>
      </div>

      {/* Timeout */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Timeout (ms)
        </Label>
        <Input
          type="number"
          value={localConfig.timeoutMs || 1000}
          onChange={(e) => handleChange({ timeoutMs: parseInt(e.target.value) || 1000 })}
          onBlur={handleBlur}
          min={100}
          max={3000}
          className="h-9 text-sm"
        />
        <p className="text-xs text-muted-foreground pl-1">
          Execution timeout (100-3000ms)
        </p>
      </div>

      {/* Help Text (shown when display = visible) */}
      {localConfig.display === "visible" && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Help Text (optional)
          </Label>
          <Textarea
            value={localConfig.helpText || ""}
            onChange={(e) => handleChange({ helpText: e.target.value })}
            onBlur={handleBlur}
            placeholder="Optional text to show in the runner..."
            rows={2}
            className="text-sm resize-none"
          />
        </div>
      )}
    </div>
  );
}
