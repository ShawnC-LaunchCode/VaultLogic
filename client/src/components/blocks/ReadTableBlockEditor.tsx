/**
 * Read Table Block Editor Component
 * Configures a DataVault table read operation with filters, sorting, and limit
 */

import { useState, useEffect } from "react";
import { Database, Filter, SortAsc, Trash2, Plus, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorkflowDataSources } from "@/lib/vault-hooks";
import { useTables } from "@/hooks/useDatavaultTables";
import { useTableColumns } from "@/hooks/useTableColumns";
import type { ReadTableConfig, ReadTableFilter, ReadTableOperator } from "@shared/types/blocks";

interface ReadTableBlockEditorProps {
  workflowId: string;
  config: ReadTableConfig;
  onChange: (config: ReadTableConfig) => void;
  mode?: "easy" | "advanced";
}

const OPERATORS: { value: ReadTableOperator; label: string }[] = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "starts_with", label: "Starts With" },
  { value: "ends_with", label: "Ends With" },
  { value: "greater_than", label: "Greater Than" },
  { value: "less_than", label: "Less Than" },
  { value: "is_empty", label: "Is Empty" },
  { value: "is_not_empty", label: "Is Not Empty" },
  { value: "in", label: "In (comma-separated)" },
];

export function ReadTableBlockEditor({
  workflowId,
  config,
  onChange,
  mode = "easy"
}: ReadTableBlockEditorProps) {
  const [localConfig, setLocalConfig] = useState<ReadTableConfig>(config);

  const { data: dataSources } = useWorkflowDataSources(workflowId);
  const { data: allTables } = useTables();
  const { data: columns } = useTableColumns(localConfig.tableId);

  // Filter tables:
  // 1. If selected DS is a "native table" proxy (config.tableId), show only that table.
  // 2. Otherwise, show tables belonging to the database (t.databaseId === ds.id).
  const selectedDataSource = dataSources?.find(ds => ds.id === localConfig.dataSourceId);

  const tables = selectedDataSource?.config?.isNativeTable && selectedDataSource?.config?.tableId
    ? allTables?.filter((t: any) => t.id === selectedDataSource.config.tableId) || []
    : allTables?.filter((t: any) => t.databaseId === localConfig.dataSourceId) || [];

  // Update parent when local config changes
  useEffect(() => {
    onChange(localConfig);
  }, [localConfig]);

  const handleDataSourceChange = (dataSourceId: string) => {
    const ds = dataSources?.find(d => d.id === dataSourceId);

    // If it's a native table proxy, auto-select the table
    if (ds?.config?.isNativeTable && ds?.config?.tableId) {
      setLocalConfig({
        ...localConfig,
        dataSourceId,
        tableId: ds.config.tableId,
        filters: [],
        sort: undefined
      });
    } else {
      setLocalConfig({
        ...localConfig,
        dataSourceId,
        tableId: "",
        filters: [],
        sort: undefined
      });
    }
  };

  const handleTableChange = (tableId: string) => {
    setLocalConfig({
      ...localConfig,
      tableId,
      filters: [],
      sort: undefined
    });
  };

  const handleAddFilter = () => {
    const newFilter: ReadTableFilter = {
      columnId: columns?.[0]?.id || "",
      operator: "equals",
      value: ""
    };
    setLocalConfig({
      ...localConfig,
      filters: [...(localConfig.filters || []), newFilter]
    });
  };

  const handleUpdateFilter = (index: number, updates: Partial<ReadTableFilter>) => {
    const newFilters = [...(localConfig.filters || [])];
    newFilters[index] = { ...newFilters[index], ...updates };
    setLocalConfig({ ...localConfig, filters: newFilters });
  };

  const handleRemoveFilter = (index: number) => {
    const newFilters = [...(localConfig.filters || [])];
    newFilters.splice(index, 1);
    setLocalConfig({ ...localConfig, filters: newFilters });
  };

  const handleSortChange = (columnId: string) => {
    if (!columnId) {
      setLocalConfig({ ...localConfig, sort: undefined });
    } else {
      setLocalConfig({
        ...localConfig,
        sort: {
          columnId,
          direction: localConfig.sort?.direction || "asc"
        }
      });
    }
  };

  const handleSortDirectionChange = (direction: "asc" | "desc") => {
    if (localConfig.sort) {
      setLocalConfig({
        ...localConfig,
        sort: { ...localConfig.sort, direction }
      });
    }
  };

  const isEasyMode = mode === "easy";
  const maxFilters = isEasyMode ? 1 : 10;
  const showLimit = !isEasyMode;

  return (
    <div className="space-y-4">
      {/* Data Source Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Database className="w-4 h-4" />
          Data Source
        </Label>
        <Select
          value={localConfig.dataSourceId || ""}
          onValueChange={handleDataSourceChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a data source..." />
          </SelectTrigger>
          <SelectContent>
            {dataSources?.map((ds: any) => (
              <SelectItem key={ds.id} value={ds.id}>
                {ds.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table Selection */}
      {localConfig.dataSourceId && (
        <div className="space-y-2">
          <Label>Table</Label>
          <Select
            value={localConfig.tableId || ""}
            onValueChange={handleTableChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a table..." />
            </SelectTrigger>
            <SelectContent>
              {tables?.map((table: any) => (
                <SelectItem key={table.id} value={table.id}>
                  {table.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Output Variable Name */}
      <div className="space-y-2">
        <Label>Output Variable Name</Label>
        <Input
          value={localConfig.outputKey || ""}
          onChange={(e) => setLocalConfig({ ...localConfig, outputKey: e.target.value })}
          placeholder="e.g., customerList"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          This variable will contain a list of rows from the table
        </p>
      </div>

      {/* Filters Section */}
      {localConfig.tableId && columns && columns.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <CardTitle className="text-sm">Filters</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {localConfig.filters?.length || 0} / {maxFilters}
                </Badge>
              </div>
              {(localConfig.filters?.length || 0) < maxFilters && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddFilter}
                  className="h-7 gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add Filter
                </Button>
              )}
            </div>
            <CardDescription className="text-xs">
              {isEasyMode
                ? "Add one filter to narrow down results"
                : "Add multiple filters to narrow down results"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(!localConfig.filters || localConfig.filters.length === 0) && (
              <div className="text-sm text-muted-foreground text-center py-4">
                No filters configured. All rows will be returned (up to limit).
              </div>
            )}
            {localConfig.filters?.map((filter, index) => (
              <div key={index} className="flex gap-2 items-start p-3 bg-background rounded-md border">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  {/* Column Selection */}
                  <div className="space-y-1">
                    <Label className="text-xs">Column</Label>
                    <Select
                      value={filter.columnId}
                      onValueChange={(value) => handleUpdateFilter(index, { columnId: value })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col: any) => (
                          <SelectItem key={col.id} value={col.id}>
                            {col.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Operator Selection */}
                  <div className="space-y-1">
                    <Label className="text-xs">Operator</Label>
                    <Select
                      value={filter.operator}
                      onValueChange={(value) =>
                        handleUpdateFilter(index, { operator: value as ReadTableOperator })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Value Input */}
                  {filter.operator !== "is_empty" && filter.operator !== "is_not_empty" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Value</Label>
                      <Input
                        value={filter.value || ""}
                        onChange={(e) => handleUpdateFilter(index, { value: e.target.value })}
                        placeholder="Value or {{variable}}"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* Remove Button */}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleRemoveFilter(index)}
                  className="h-8 w-8 mt-5 text-destructive hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Sort Section */}
      {localConfig.tableId && columns && columns.length > 0 && (
        <Card className="border-purple-200 bg-purple-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <SortAsc className="w-4 h-4 text-purple-600" />
              <CardTitle className="text-sm">Sort</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Optional: Order results by a column
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Sort By</Label>
                <Select
                  value={localConfig.sort?.columnId || "NO_SORT"}
                  onValueChange={(val) => handleSortChange(val === "NO_SORT" ? "" : val)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NO_SORT">None</SelectItem>
                    {columns.map((col: any) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {localConfig.sort && (
                <div className="space-y-1">
                  <Label className="text-xs">Direction</Label>
                  <Select
                    value={localConfig.sort.direction}
                    onValueChange={(value: "asc" | "desc") => handleSortDirectionChange(value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Limit (Advanced Mode Only) */}
      {showLimit && (
        <div className="space-y-2">
          <Label className="text-xs">Row Limit</Label>
          <Input
            type="number"
            value={localConfig.limit || 100}
            onChange={(e) =>
              setLocalConfig({ ...localConfig, limit: parseInt(e.target.value) || 100 })
            }
            min={1}
            max={1000}
            className="h-8 text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Maximum number of rows to return (default: 100, max: 1000)
          </p>
        </div>
      )}

      {/* Configuration Summary */}
      {localConfig.tableId && (
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono">Configuration Summary</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1 font-mono">
            <div>
              <span className="text-muted-foreground">Output:</span>{" "}
              <span className="font-semibold">{localConfig.outputKey || "(not set)"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Filters:</span>{" "}
              <span className="font-semibold">{localConfig.filters?.length || 0}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Sort:</span>{" "}
              <span className="font-semibold">
                {localConfig.sort
                  ? `${columns?.find((c: any) => c.id === localConfig.sort?.columnId)?.name || "Unknown"} (${localConfig.sort.direction})`
                  : "None"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Limit:</span>{" "}
              <span className="font-semibold">{localConfig.limit || 100} rows</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
