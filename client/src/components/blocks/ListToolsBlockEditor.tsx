/**
 * List Tools Block Editor
 * Provides UI for configuring list transformation operations (filter, sort, limit, select)
 */

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSteps } from "@/lib/vault-hooks";
import { Filter, ArrowUpDown, Scissors, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type ListToolsOperation = "filter" | "sort" | "limit" | "select";
type ReadTableOperator = "equals" | "not_equals" | "contains" | "starts_with" | "ends_with" | "greater_than" | "less_than" | "is_empty" | "is_not_empty" | "in";

interface ListToolsConfig {
  inputKey: string;
  operation: ListToolsOperation;
  filter?: {
    columnId: string;
    operator: ReadTableOperator;
    value?: any;
  };
  sort?: {
    columnId: string;
    direction: "asc" | "desc";
  };
  limit?: number;
  select?: {
    mode: "count" | "column" | "row";
    columnId?: string;
    rowIndex?: number;
  };
  outputKey: string;
}

interface ListToolsBlockEditorProps {
  workflowId: string;
  config: Partial<ListToolsConfig>;
  onChange: (config: Partial<ListToolsConfig>) => void;
  mode: 'easy' | 'advanced';
}

export function ListToolsBlockEditor({ workflowId, config, onChange, mode }: ListToolsBlockEditorProps) {
  const { data: steps } = useSteps(workflowId);
  const [localConfig, setLocalConfig] = useState<Partial<ListToolsConfig>>(config);
  const [availableColumns, setAvailableColumns] = useState<Array<{ id: string; name: string; type: string }>>([]);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  // Get list variables (computed steps with list data from read_table/query blocks)
  const listVariables = (steps || []).filter(step =>
    step.type === 'computed' && step.alias && step.alias.length > 0
  );

  // Fetch columns when input list is selected
  useEffect(() => {
    if (!localConfig.inputKey) {
      setAvailableColumns([]);
      return;
    }

    // Find the step that creates this variable
    const sourceStep = listVariables.find(v => v.alias === localConfig.inputKey);
    if (!sourceStep) {
      setAvailableColumns([]);
      return;
    }

    // For now, we'll try to get columns from the step's description or metadata
    // In a real implementation, you would fetch the actual table/query columns
    // This is a simplified version that assumes columns are stored in step metadata
    if (sourceStep.description && sourceStep.description.includes('columns:')) {
      // Parse columns from description (temporary solution)
      try {
        const columnsMatch = sourceStep.description.match(/columns: \[(.*?)\]/);
        if (columnsMatch) {
          const cols = JSON.parse(`[${columnsMatch[1]}]`);
          setAvailableColumns(cols);
        }
      } catch (e) {
        setAvailableColumns([]);
      }
    } else {
      // Default fallback - show a note that user needs to run the workflow first
      setAvailableColumns([]);
    }
  }, [localConfig.inputKey, listVariables]);

  const handleChange = (updates: Partial<ListToolsConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    onChange(newConfig);
  };

  const getOperationIcon = (op: string) => {
    switch (op) {
      case "filter": return <Filter className="w-4 h-4" />;
      case "sort": return <ArrowUpDown className="w-4 h-4" />;
      case "limit": return <Scissors className="w-4 h-4" />;
      case "select": return <Target className="w-4 h-4" />;
      default: return null;
    }
  };

  const getOperationDescription = (op: string) => {
    switch (op) {
      case "filter": return "Filter rows based on a condition";
      case "sort": return "Sort rows by a column";
      case "limit": return "Limit the number of rows";
      case "select": return "Extract count, column values, or a specific row";
      default: return "";
    }
  };

  return (
    <div className="space-y-4">
      {/* Input List */}
      <div className="space-y-2">
        <Label>Input List Variable</Label>
        <Select
          value={localConfig.inputKey || ""}
          onValueChange={(value) => handleChange({ inputKey: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a list variable..." />
          </SelectTrigger>
          <SelectContent>
            {listVariables.length === 0 && (
              <div className="p-2 text-xs text-muted-foreground">
                No list variables found. Create a Read Table or Query block first.
              </div>
            )}
            {listVariables.map((variable) => (
              <SelectItem key={variable.id} value={variable.alias || ""}>
                {variable.alias} ({variable.title})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!localConfig.inputKey && (
          <p className="text-xs text-muted-foreground">
            Select a list variable created by a Read Table or Query block
          </p>
        )}
      </div>

      {/* Operation */}
      <div className="space-y-2">
        <Label>Operation</Label>
        <Select
          value={localConfig.operation || ""}
          onValueChange={(value) => handleChange({ operation: value as ListToolsOperation })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select operation..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="filter">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                <div>
                  <div className="font-medium">Filter</div>
                  <div className="text-xs text-muted-foreground">Filter rows by condition</div>
                </div>
              </div>
            </SelectItem>
            <SelectItem value="sort">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4" />
                <div>
                  <div className="font-medium">Sort</div>
                  <div className="text-xs text-muted-foreground">Sort rows by column</div>
                </div>
              </div>
            </SelectItem>
            <SelectItem value="limit">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4" />
                <div>
                  <div className="font-medium">Limit</div>
                  <div className="text-xs text-muted-foreground">Limit number of rows</div>
                </div>
              </div>
            </SelectItem>
            <SelectItem value="select">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <div>
                  <div className="font-medium">Select</div>
                  <div className="text-xs text-muted-foreground">Extract values or count</div>
                </div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Operation-Specific Configuration */}
      {localConfig.operation === "filter" && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
              <Filter className="w-4 h-4" />
              Filter Configuration
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Column</Label>
              <Select
                value={localConfig.filter?.columnId || ""}
                onValueChange={(value) => handleChange({
                  filter: { ...localConfig.filter, columnId: value, operator: localConfig.filter?.operator || "equals" }
                })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  {availableColumns.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground">
                      No columns available. Select a list variable first.
                    </div>
                  ) : (
                    availableColumns.map((col: any) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.name} ({col.type})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Operator</Label>
              <Select
                value={localConfig.filter?.operator || "equals"}
                onValueChange={(value) => handleChange({
                  filter: { ...localConfig.filter, columnId: localConfig.filter?.columnId || "", operator: value as ReadTableOperator }
                })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="not_equals">Not Equals</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="starts_with">Starts With</SelectItem>
                  <SelectItem value="ends_with">Ends With</SelectItem>
                  <SelectItem value="greater_than">Greater Than</SelectItem>
                  <SelectItem value="less_than">Less Than</SelectItem>
                  <SelectItem value="is_empty">Is Empty</SelectItem>
                  <SelectItem value="is_not_empty">Is Not Empty</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {localConfig.filter?.operator !== "is_empty" && localConfig.filter?.operator !== "is_not_empty" && (
              <div className="space-y-2">
                <Label className="text-xs">Value</Label>
                <Input
                  className="bg-background"
                  placeholder="Enter value or {{variable}}"
                  value={localConfig.filter?.value || ""}
                  onChange={(e) => handleChange({
                    filter: { ...localConfig.filter, columnId: localConfig.filter?.columnId || "", operator: localConfig.filter?.operator || "equals", value: e.target.value }
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  Use {`{{variableName}}`} to reference another variable
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {localConfig.operation === "sort" && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-purple-900">
              <ArrowUpDown className="w-4 h-4" />
              Sort Configuration
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Column</Label>
              <Select
                value={localConfig.sort?.columnId || ""}
                onValueChange={(value) => handleChange({
                  sort: { columnId: value, direction: localConfig.sort?.direction || "asc" }
                })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  {availableColumns.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground">
                      No columns available. Select a list variable first.
                    </div>
                  ) : (
                    availableColumns.map((col: any) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.name} ({col.type})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Direction</Label>
              <Select
                value={localConfig.sort?.direction || "asc"}
                onValueChange={(value) => handleChange({
                  sort: { ...localConfig.sort, columnId: localConfig.sort?.columnId || "", direction: value as "asc" | "desc" }
                })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending (A-Z, 0-9)</SelectItem>
                  <SelectItem value="desc">Descending (Z-A, 9-0)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {localConfig.operation === "limit" && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-orange-900">
              <Scissors className="w-4 h-4" />
              Limit Configuration
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Maximum Rows</Label>
              <Input
                className="bg-background"
                type="number"
                min="1"
                placeholder="e.g., 10"
                value={localConfig.limit || ""}
                onChange={(e) => handleChange({ limit: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                Only keep the first N rows
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {localConfig.operation === "select" && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-green-900">
              <Target className="w-4 h-4" />
              Select Configuration
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Select Mode</Label>
              <Select
                value={localConfig.select?.mode || "count"}
                onValueChange={(value) => handleChange({
                  select: { mode: value as "count" | "column" | "row" }
                })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Count (number of rows)</SelectItem>
                  <SelectItem value="column">Column Values (array)</SelectItem>
                  <SelectItem value="row">Specific Row (object)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {localConfig.select?.mode === "column" && (
              <div className="space-y-2">
                <Label className="text-xs">Column</Label>
                <Select
                  value={localConfig.select?.columnId || ""}
                  onValueChange={(value) => handleChange({
                    select: { ...localConfig.select, mode: "column", columnId: value }
                  })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColumns.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground">
                        No columns available. Select a list variable first.
                      </div>
                    ) : (
                      availableColumns.map((col: any) => (
                        <SelectItem key={col.id} value={col.id}>
                          {col.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Extracts an array of values from this column
                </p>
              </div>
            )}

            {localConfig.select?.mode === "row" && (
              <div className="space-y-2">
                <Label className="text-xs">Row Index (0-based)</Label>
                <Input
                  className="bg-background"
                  type="number"
                  min="0"
                  placeholder="e.g., 0 for first row"
                  value={localConfig.select?.rowIndex ?? ""}
                  onChange={(e) => handleChange({
                    select: { ...localConfig.select, mode: "row", rowIndex: parseInt(e.target.value) || 0 }
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  0 = first row, 1 = second row, etc.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Output Variable */}
      <div className="space-y-2">
        <Label>Output Variable Name</Label>
        <Input
          placeholder="e.g., filteredList, sortedData, rowCount"
          value={localConfig.outputKey || ""}
          onChange={(e) => handleChange({ outputKey: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          {localConfig.operation === "select" && localConfig.select?.mode === "count"
            ? "Will store a number (row count)"
            : localConfig.operation === "select" && localConfig.select?.mode === "column"
            ? "Will store an array of values"
            : localConfig.operation === "select" && localConfig.select?.mode === "row"
            ? "Will store a single row object"
            : "Will store a new list variable"
          }
        </p>
      </div>

      {mode === 'easy' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900">
          <p className="font-medium mb-1">Easy Mode Note</p>
          <p>
            List tools are primarily for Advanced Mode. They allow you to filter, sort, limit, and extract data from lists created by Read Table blocks.
          </p>
        </div>
      )}
    </div>
  );
}
