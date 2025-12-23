/**
 * Choice Block Card Editor
 * Editor for choice blocks (radio, multiple_choice, choice)
 *
 * Config shape:
 * {
 *   display: "radio" | "dropdown" | "multiple",
 *   allowMultiple: boolean,
 *   options: Array<{ id: string; label: string; alias?: string; }>
 * }
 */

import { useState, useEffect, useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GripVertical, Trash2, Plus, AlertCircle, RefreshCw } from "lucide-react";
import { LabelField } from "./common/LabelField";
import { AliasField } from "./common/AliasField";
import { RequiredToggle } from "./common/RequiredToggle";
import { SectionHeader } from "./common/EditorField";
import { useUpdateStep, useWorkflowVariables, useBlocks, useSections } from "@/lib/vault-hooks";
import { useTableColumns } from "@/hooks/useTableColumns";
import { useToast } from "@/hooks/use-toast";
import type { ChoiceAdvancedConfig, ChoiceOption, LegacyMultipleChoiceConfig, LegacyRadioConfig, DynamicOptionsConfig } from "@/../../shared/types/stepConfigs";

interface ChoiceCardEditorProps {
  stepId: string;
  sectionId: string;
  step: {
    id: string;
    type: string;
    title: string;
    alias: string | null;
    required: boolean;
    config: any;
  };
  workflowId: string;
}

export function ChoiceCardEditor({ stepId, sectionId, step, workflowId }: ChoiceCardEditorProps) {
  const updateStepMutation = useUpdateStep();
  const { toast } = useToast();

  // Determine mode
  const isAdvancedMode = step.type === "choice";

  // State
  const [localConfig, setLocalConfig] = useState<any>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [sourceMode, setSourceMode] = useState<"static" | "dynamic">("static");

  // Fetch Workflow Variables (for dynamic mode)
  const { data: variables = [] } = useWorkflowVariables(workflowId);
  const { data: blocks = [] } = useBlocks(workflowId);

  // Filter for List variables only
  // ApiWorkflowVariable doesn't have 'metadata', so we filter by type 'read_table' or 'list_tools'
  const listVariables = useMemo(() => {
    return variables.filter(v => v.type === 'read_table' || v.type === 'list_tools');
  }, [variables]);

  // Find the source block to get the table ID and check timing
  const sourceBlock = useMemo(() => {
    if (!localConfig?.dynamicOptions.listVariable || !blocks || blocks.length === 0) return null;
    return blocks.find(b => b.config && b.config.outputKey === localConfig.dynamicOptions.listVariable);
  }, [localConfig?.dynamicOptions.listVariable, blocks]);

  const sourceTableId = useMemo(() => {
    if (!sourceBlock) return null;
    if (sourceBlock.type === 'read_table') {
      return sourceBlock.config.tableId;
    }
    return null;
  }, [sourceBlock]);

  // Fetch sections to check order
  const { data: sections = [] } = useSections(workflowId);

  // Timing Check
  const timingWarning = useMemo(() => {
    if (!sourceBlock || !step || !sections.length) return null;

    const blockPhase = sourceBlock.phase;
    const stepSection = sections.find(s => s.id === sectionId);
    const blockSection = sourceBlock.sectionId ? sections.find(s => s.id === sourceBlock.sectionId) : null;

    if (!stepSection) return null;

    // Safe phases
    if (blockPhase === 'onRunStart') return null;

    // Section-based checks
    if (blockPhase === 'onSectionEnter') {
      // If global block (no section), acts like RunStart? No, depends. Usually associated with a section.
      // If blockSection is null, assume it runs ... when? API says sectionId can be null.
      if (!blockSection) return null; // Assume safe if global?

      if (blockSection.order > stepSection.order) {
        return "Read block runs in a later section.";
      }
      // Same section is safe for onSectionEnter
      return null;
    }

    if (blockPhase === 'onSectionSubmit' || blockPhase === 'onNext') {
      if (!blockSection) return "Block runs on submit but has no section?";
      // Must be strictly previous section
      if (blockSection.order < stepSection.order) return null;
      return "Read block runs after the page is displayed (on Next/Submit).";
    }

    if (blockPhase === 'onRunComplete') {
      return "Read block runs at the end of the workflow.";
    }

    return null;
  }, [sourceBlock, sections, sectionId]);

  const { data: columnsResponse, isLoading: loadingColumns } = useTableColumns(sourceTableId);
  const columns = Array.isArray(columnsResponse) ? columnsResponse : [];

  // Parse config on mount or change
  useEffect(() => {
    if (isAdvancedMode) {
      const config = step.config as ChoiceAdvancedConfig | undefined;
      const rawOptions = config?.options;

      let mode: "static" | "dynamic" = "static";
      let staticOptions: ChoiceOption[] = [];
      let dynamicOptions: any = {};

      if (rawOptions && typeof rawOptions === 'object' && 'type' in rawOptions) {
        // Dynamic Config
        const dynConfig = rawOptions as DynamicOptionsConfig;
        if (dynConfig.type === 'static') {
          staticOptions = dynConfig.options || [];
        } else if (dynConfig.type === 'list') {
          mode = "dynamic";
          dynamicOptions = dynConfig;
        }
      } else if (Array.isArray(rawOptions)) {
        staticOptions = rawOptions;
      }

      setLocalConfig({
        display: config?.display || "radio",
        allowMultiple: config?.allowMultiple || false,
        searchable: config?.searchable || false,
        staticOptions,
        dynamicOptions: dynamicOptions.type === 'list' ? dynamicOptions : {
          type: 'list',
          listVariable: '',
          labelColumnId: '',
          valueColumnId: '',
          dedupeBy: null,
          sort: null
        }
      });
      setSourceMode(mode);

    } else {
      // Easy mode legacy conversion
      const config = step.config as (LegacyMultipleChoiceConfig | LegacyRadioConfig) | undefined;
      const legacyOptions = config?.options || [];
      const options: ChoiceOption[] = Array.isArray(legacyOptions)
        ? legacyOptions.map((opt: any, idx: number) => ({
          id: opt.id || `opt${idx + 1}`,
          label: typeof opt === 'string' ? opt : (opt.label || opt),
          alias: typeof opt === 'string' ? `option${idx + 1}` : (opt.alias || opt.id || `option${idx + 1}`),
        }))
        : [];

      setLocalConfig({
        display: step.type === "multiple_choice" ? "multiple" : "radio",
        allowMultiple: step.type === "multiple_choice",
        staticOptions: options,
        dynamicOptions: {
          type: 'list',
          listVariable: '',
          labelColumnId: '',
          valueColumnId: '',
          dedupeBy: null
        }
      });
      setSourceMode("static");
    }
  }, [step.config, step.type, isAdvancedMode]);

  // Derived state for Dynamic Columns
  const selectedListVarName = localConfig?.dynamicOptions?.listVariable;

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

  const saveConfig = (newConfig: any, mode: "static" | "dynamic") => {
    // Validation
    const errors: string[] = [];
    if (mode === "static") {
      if (newConfig.staticOptions.length === 0) errors.push("At least one option is required");
      // Check for duplicate aliases
      const aliases = newConfig.staticOptions.map((opt: any) => opt.alias || opt.id);
      if (new Set(aliases).size !== aliases.length) errors.push("Duplicate aliases found");
    } else {
      if (!newConfig.dynamicOptions.listVariable) errors.push("List variable is required");
      // We allow saving with warning
    }
    setErrors(errors);
    if (errors.length > 0) return;

    // Construct Payload
    // If we are in "dynamic" mode, we MUST be 'choice' type (Advanced schema)
    const isNowAdvanced = mode === "dynamic" || isAdvancedMode;

    if (isNowAdvanced) {
      const payload: ChoiceAdvancedConfig = {
        display: newConfig.display,
        allowMultiple: newConfig.allowMultiple,
        searchable: newConfig.searchable,
        options: mode === 'static'
          ? { type: 'static', options: newConfig.staticOptions }
          : { ...newConfig.dynamicOptions, type: 'list' }
      };
      // Auto-upgrade type if needed
      if (step.type !== 'choice') {
        updateStepMutation.mutate({ id: stepId, sectionId, type: 'choice', config: payload });
      } else {
        updateStepMutation.mutate({ id: stepId, sectionId, config: payload });
      }
    } else {
      // Legacy Save
      const payload = {
        options: newConfig.staticOptions.map((opt: any) => ({
          id: opt.id,
          label: opt.label,
          alias: opt.alias
        }))
      };
      updateStepMutation.mutate({ id: stepId, sectionId, config: payload });
    }
  };

  const handleUpdate = (updates: any) => {
    const next = { ...localConfig, ...updates };
    setLocalConfig(next);
    saveConfig(next, sourceMode);
  };

  const handleSourceModeChange = (val: string) => {
    const newMode = val as "static" | "dynamic";
    setSourceMode(newMode);
    saveConfig(localConfig, newMode);
  };

  const handleAddOption = () => {
    const newOptions = [
      ...localConfig.staticOptions,
      {
        id: `opt${localConfig.staticOptions.length + 1}`,
        label: `Option ${localConfig.staticOptions.length + 1}`,
        alias: `option${localConfig.staticOptions.length + 1}`,
      },
    ];
    handleUpdate({ staticOptions: newOptions });
  };

  const handleUpdateOption = (index: number, field: keyof ChoiceOption, value: string) => {
    const newOptions = [...localConfig.staticOptions];
    newOptions[index] = { ...newOptions[index], [field]: value };
    handleUpdate({ staticOptions: newOptions });
  };

  const handleDeleteOption = (index: number) => {
    const newOptions = localConfig.staticOptions.filter((_: any, i: number) => i !== index);
    handleUpdate({ staticOptions: newOptions });
  };

  const handleLabelChange = (title: string) => updateStepMutation.mutate({ id: stepId, sectionId, title });
  const handleAliasChange = (alias: string | null) => updateStepMutation.mutate({ id: stepId, sectionId, alias });
  const handleRequiredChange = (required: boolean) => updateStepMutation.mutate({ id: stepId, sectionId, required });
  const handleDisplayChange = (display: "radio" | "dropdown" | "multiple") => {
    const allowMultiple = display === "multiple";
    if (!isAdvancedMode && sourceMode === 'static') {
      const newType = allowMultiple ? "multiple_choice" : "radio";
      updateStepMutation.mutate({ id: stepId, sectionId, type: newType });
    } else {
      handleUpdate({ display, allowMultiple });
    }
  };

  if (!localConfig) return null;

  return (
    <div className="space-y-4 p-4 border-t bg-muted/30">
      <LabelField value={step.title} onChange={handleLabelChange} />
      <AliasField value={step.alias} onChange={handleAliasChange} />
      <RequiredToggle checked={step.required} onChange={handleRequiredChange} />

      <Separator />

      {/* Display Mode */}
      <div className="space-y-3">
        <SectionHeader title="Display Mode" description="How choices are displayed" />
        <RadioGroup value={localConfig.display} onValueChange={(v) => handleDisplayChange(v as any)} disabled={false} className="flex gap-4">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="radio" id="d-radio" />
            <Label htmlFor="d-radio">Radio</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="dropdown" id="d-dropdown" />
            <Label htmlFor="d-dropdown">Dropdown</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="multiple" id="d-multiple" />
            <Label htmlFor="d-multiple">Multiple</Label>
          </div>
        </RadioGroup>

        {(localConfig.display === 'dropdown' || localConfig.display === 'multiple') && (
          <div className="flex items-center space-x-2 pt-2">
            <Switch
              id="searchable-mode"
              checked={localConfig.searchable || false}
              onCheckedChange={(c) => handleUpdate({ searchable: c })}
            />
            <Label htmlFor="searchable-mode" className="text-xs font-normal text-muted-foreground">Allow Search</Label>
          </div>
        )}
      </div>

      <Separator />

      {/* Options Source Toggle */}
      <Tabs value={sourceMode} onValueChange={handleSourceModeChange} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <Label className="text-sm font-medium">Options Source</Label>
          <TabsList className="grid w-[200px] grid-cols-2 h-8">
            <TabsTrigger value="static" className="text-xs">Manual</TabsTrigger>
            <TabsTrigger value="dynamic" className="text-xs">From Table</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="static" className="mt-0 space-y-3">
          <div className="space-y-2">
            {localConfig.staticOptions.map((option: any, index: number) => (
              <div key={option.id} className="flex items-start gap-2 p-3 border rounded-md bg-background">
                <div className="pt-2 cursor-grab"><GripVertical className="h-4 w-4 text-muted-foreground" /></div>
                <div className="flex-1 space-y-2">
                  <Input value={option.label} onChange={(e) => handleUpdateOption(index, 'label', e.target.value)} placeholder="Display Value" className="text-sm" />
                  <Input value={option.alias || option.id} onChange={(e) => handleUpdateOption(index, 'alias', e.target.value)} placeholder="Saved Value" className="text-sm font-mono" />
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteOption(index)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={handleAddOption}><Plus className="h-4 w-4 mr-2" />Add Option</Button>
        </TabsContent>

        <TabsContent value="dynamic" className="mt-0 space-y-4">
          <div className="p-3 bg-background border rounded-md space-y-4">

            {/* List Variable Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs">List Variable (from Read Block)</Label>
              <Select
                value={localConfig.dynamicOptions.listVariable}
                onValueChange={(val) => {
                  const newDynamic = { ...localConfig.dynamicOptions, listVariable: val, labelColumnId: '', valueColumnId: '' };
                  handleUpdate({ dynamicOptions: newDynamic });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select a list variable..." /></SelectTrigger>
                <SelectContent>
                  {listVariables.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground text-center">No list variables found. Add a Read Table block first.</div>
                  ) : (
                    listVariables.map(v => (
                      <SelectItem key={v.alias} value={v.alias || ''} className="flex items-center">
                        <span className="font-mono">{v.alias}</span>
                        {/* Optional: Show source table name if available */}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {localConfig.dynamicOptions.listVariable && !sourceTableId && listVariables.find(v => v.alias === localConfig.dynamicOptions.listVariable) && (
                <p className="text-[10px] text-yellow-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Source table not found. Columns may not load.
                </p>
              )}
              {timingWarning && (
                <div className="text-[10px] text-yellow-600 flex items-start gap-1 p-1 bg-yellow-50 rounded border border-yellow-200 mt-1">
                  <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{timingWarning}</span>
                </div>
              )}
            </div>

            {/* Columns Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Label Column (Display)</Label>
                <Select
                  value={localConfig.dynamicOptions.labelColumnId}
                  onValueChange={(val) => handleUpdate({ dynamicOptions: { ...localConfig.dynamicOptions, labelColumnId: val } })}
                  disabled={!sourceTableId || loadingColumns}
                >
                  <SelectTrigger><SelectValue placeholder="Select column..." /></SelectTrigger>
                  <SelectContent>
                    {columns.length > 0 ? columns.map((col: any) => (
                      <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                    )) : <div className="p-2 text-xs text-center text-muted-foreground">No columns</div>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Value Column (Saved)</Label>
                <Select
                  value={localConfig.dynamicOptions.valueColumnId}
                  onValueChange={(val) => handleUpdate({ dynamicOptions: { ...localConfig.dynamicOptions, valueColumnId: val } })}
                  disabled={!sourceTableId || loadingColumns}
                >
                  <SelectTrigger><SelectValue placeholder="Select column..." /></SelectTrigger>
                  <SelectContent>
                    {columns.length > 0 ? columns.map((col: any) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.name} {col.isPrimary ? '(ID)' : ''}
                      </SelectItem>
                    )) : <div className="p-2 text-xs text-center text-muted-foreground">No columns</div>}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Advanced: Dedupe & Sort */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Label className="text-xs text-muted-foreground">Dedupe by Value</Label>
                <Switch
                  checked={localConfig.dynamicOptions.dedupeBy === 'value'}
                  onCheckedChange={(c) => handleUpdate({ dynamicOptions: { ...localConfig.dynamicOptions, dedupeBy: c ? 'value' : null } })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Sort By */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Sort By</Label>
                  <Select
                    value={localConfig.dynamicOptions.sort?.by || 'none'}
                    onValueChange={(val) => {
                      if (val === 'none') {
                        handleUpdate({ dynamicOptions: { ...localConfig.dynamicOptions, sort: null } });
                      } else {
                        handleUpdate({ dynamicOptions: { ...localConfig.dynamicOptions, sort: { ...localConfig.dynamicOptions.sort, by: val, direction: localConfig.dynamicOptions.sort?.direction || 'asc' } } });
                      }
                    }}
                  >
                    <SelectTrigger className="h-8"><SelectValue placeholder="No Sort" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="label">Label</SelectItem>
                      <SelectItem value="value">Value</SelectItem>
                      <SelectItem value="column">Specific Column</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort Direction */}
                {localConfig.dynamicOptions.sort && (
                  <div className="space-y-1.5 animate-in fade-in">
                    <Label className="text-xs">Direction</Label>
                    <Select
                      value={localConfig.dynamicOptions.sort.direction}
                      onValueChange={(val) => handleUpdate({ dynamicOptions: { ...localConfig.dynamicOptions, sort: { ...localConfig.dynamicOptions.sort, direction: val as any } } })}
                    >
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Ascending</SelectItem>
                        <SelectItem value="desc">Descending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Sort Column ID - if by column */}
              {localConfig.dynamicOptions.sort?.by === 'column' && (
                <div className="space-y-1.5 animate-in fade-in">
                  <Label className="text-xs">Sort Column</Label>
                  <Select
                    value={localConfig.dynamicOptions.sort.columnId}
                    onValueChange={(val) => handleUpdate({ dynamicOptions: { ...localConfig.dynamicOptions, sort: { ...localConfig.dynamicOptions.sort, columnId: val } } })}
                    disabled={!sourceTableId || loadingColumns}
                  >
                    <SelectTrigger className="h-8"><SelectValue placeholder="Select column for sorting..." /></SelectTrigger>
                    <SelectContent>
                      {columns.map((col: any) => (
                        <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Blank Option */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Include Blank Option</Label>
                <Switch
                  checked={localConfig.dynamicOptions.includeBlankOption || false}
                  onCheckedChange={(c) => handleUpdate({ dynamicOptions: { ...localConfig.dynamicOptions, includeBlankOption: c } })}
                />
              </div>
              {localConfig.dynamicOptions.includeBlankOption && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label className="text-xs">Blank Option Label</Label>
                  <Input
                    placeholder="(e.g. Select an option...)"
                    value={localConfig.dynamicOptions.blankLabel || ''}
                    onChange={(e) => handleUpdate({ dynamicOptions: { ...localConfig.dynamicOptions, blankLabel: e.target.value } })}
                    className="text-xs"
                  />
                </div>
              )}
            </div>

            {/* Label Template */}
            <div className="space-y-1.5">
              <Label className="text-xs">Label Template (Optional)</Label>
              <Input
                placeholder="{FirstName} {LastName}"
                value={localConfig.dynamicOptions.labelTemplate || ''}
                onChange={(e) => handleUpdate({ dynamicOptions: { ...localConfig.dynamicOptions, labelTemplate: e.target.value } })}
                className="text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Use column names in braces to combine fields.</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Errors */}
      {
        errors.length > 0 && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-3 rounded-md">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <ul className="list-disc list-inside">
              {errors.map((error, idx) => <li key={idx}>{error}</li>)}
            </ul>
          </div>
        )
      }
    </div >
  );
}
