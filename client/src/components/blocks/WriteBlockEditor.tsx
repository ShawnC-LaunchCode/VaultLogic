import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { useWorkflowDataSources, useWorkflowVariables } from "@/lib/vault-hooks";
import { dataSourceAPI } from "@/lib/vault-api";
import { useQuery } from "@tanstack/react-query";
import { useTables } from "@/hooks/useDatavaultTables";
import { useTableColumns } from "@/hooks/useTableColumns";

interface ColumnMapping {
    columnId: string; // UUID for durable identifier
    value: string; // variable alias or expression
}

interface MatchStrategy {
    type: "primary_key" | "column_match";
    columnId?: string;
    columnValue?: string;
}

interface WriteConfig {
    dataSourceId?: string;
    tableId?: string;
    mode: "create" | "update" | "upsert";
    matchStrategy?: MatchStrategy;
    primaryKeyColumnId?: string; // Deprecated
    primaryKeyValue?: string; // Deprecated
    columnMappings: ColumnMapping[];
    outputKey?: string;
}

interface WriteBlockEditorProps {
    workflowId: string;
    config: WriteConfig;
    onChange: (config: WriteConfig) => void;
}

export function WriteBlockEditor({ workflowId, config, onChange }: WriteBlockEditorProps) {
    const { data: dataSources } = useWorkflowDataSources(workflowId);
    const { data: variables = [] } = useWorkflowVariables(workflowId);
    const selectedDataSource = dataSources?.find(ds => ds.id === config.dataSourceId);

    // Fetch tables for standard data sources (Postgres, etc.)
    const { data: fetchedTables } = useQuery({
        queryKey: ["dataSource", config.dataSourceId, "tables"],
        queryFn: () => config.dataSourceId ? dataSourceAPI.getTables(config.dataSourceId) : Promise.resolve([]),
        enabled: !!config.dataSourceId && !selectedDataSource?.config?.isNativeTable
    });

    // Fetch all native tables to resolve the proxy
    const { data: allNativeTables } = useTables();

    // Determine the list of tables to show
    let tables: { name: string; type: string; id: string }[] = [];

    // Normalize fetched tables which might only have name/type
    if (fetchedTables) {
        // Warning: standard data source tables might not have IDs yet if just discovered
        // But for native tables we rely on IDs.
        // For external sources, we might default to using name as ID if ID is missing.
        tables = fetchedTables.map((t: any) => ({ ...t, id: t.id || t.name }));
    }

    if (selectedDataSource?.config?.isNativeTable && selectedDataSource?.config?.tableId) {
        const targetTable = allNativeTables?.find(t => t.id === selectedDataSource.config.tableId);
        if (targetTable) {
            tables = [{ name: targetTable.name, type: 'native', id: targetTable.id }];
        }
    }

    // Determine resolved table ID for column fetching
    // If it's a native table, we use the ID directly. 
    // If it's an external table, we also need an ID (or we might need to change useTableColumns to support names)
    // Currently useTableColumns expects a tableId (UUID).
    // For external tables, this might be tricky if we don't have UUIDs.
    // Assuming native tables for now as per user context (Datavault).
    const resolvedTableId = config.tableId && tables.find(t => t.name === config.tableId || t.id === config.tableId)?.id;

    // Fetch columns for the selected table
    const { data: columns } = useTableColumns(resolvedTableId);

    // Auto-select table if it's a native table proxy
    useEffect(() => {
        if (selectedDataSource?.config?.isNativeTable && tables.length === 1) {
            // Store the table NAME in config as per current convention, or proper ID?
            // Existing code seemed to use name.
            if (config.tableId !== tables[0].name) {
                // If the config expects name (legacy assumption from viewing previous code), use name.
                // But resolvedTableId lookup above tries to handle both.
                // Standard WriteBlock uses tableId from config.
                updateConfig({ tableId: tables[0].id });
            }
        }
    }, [selectedDataSource, tables, config.tableId]);

    const updateConfig = (updates: Partial<WriteConfig>) => {
        onChange({ ...config, ...updates });
    };

    const addMapping = () => {
        const mappings = config.columnMappings || [];
        // Default to first available column if possible
        const defaultCol = columns && columns.length > 0 ? columns[0].id : "";
        updateConfig({ columnMappings: [...mappings, { columnId: defaultCol, value: "" }] });
    };

    const updateMapping = (index: number, key: keyof ColumnMapping, value: string) => {
        const mappings = [...(config.columnMappings || [])];
        mappings[index] = { ...mappings[index], [key]: value };
        updateConfig({ columnMappings: mappings });
    };

    const removeMapping = (index: number) => {
        const mappings = [...(config.columnMappings || [])];
        mappings.splice(index, 1);
        updateConfig({ columnMappings: mappings });
    };

    // Helper to get column name
    const getColumnName = (colId: string) => {
        return columns?.find(c => c.id === colId)?.name || colId;
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Data Source</Label>
                    <Select
                        value={config.dataSourceId}
                        onValueChange={(val) => updateConfig({ dataSourceId: val })}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                            {dataSources?.map(ds => (
                                <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Mode</Label>
                    <Select
                        value={config.mode || "upsert"}
                        onValueChange={(val: any) => updateConfig({ mode: val })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="create">Create New</SelectItem>
                            <SelectItem value="update">Update Existing</SelectItem>
                            <SelectItem value="upsert">Upsert (Create or Update)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label>Table / Collection</Label>
                <Select
                    value={config.tableId}
                    onValueChange={(val) => {
                        // Find the selected table to get the right ID/Name to store
                        // Storing ID is safer for native.
                        updateConfig({ tableId: val })
                    }}
                    disabled={!config.dataSourceId}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select table" />
                    </SelectTrigger>
                    <SelectContent>
                        {tables.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {(config.mode === "update" || config.mode === "upsert") && (
                <div className="p-3 bg-muted rounded-md space-y-3">
                    <div className="space-y-2">
                        <Label>Match Strategy</Label>
                        <Select
                            value={config.matchStrategy?.type || "column_match"}
                            onValueChange={(val: any) => updateConfig({
                                matchStrategy: {
                                    type: val,
                                    columnId: config.matchStrategy?.columnId,
                                    columnValue: config.matchStrategy?.columnValue
                                }
                            })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="column_match">Match by Column</SelectItem>
                                <SelectItem value="primary_key">Match by Primary Key</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Match Column</Label>
                        {/* Column Select for Match Strategy */}
                        <Select
                            value={config.matchStrategy?.columnId || ""}
                            onValueChange={(val) => updateConfig({
                                matchStrategy: {
                                    ...config.matchStrategy,
                                    type: config.matchStrategy?.type || "column_match",
                                    columnId: val
                                } as MatchStrategy
                            })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                                {columns?.map(col => (
                                    <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            The column to match against (must be unique identifier)
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Match Value</Label>
                        <Select
                            value={config.matchStrategy?.columnValue || ""}
                            onValueChange={(val) => updateConfig({
                                matchStrategy: {
                                    ...config.matchStrategy,
                                    type: config.matchStrategy?.type || "column_match",
                                    columnValue: val
                                } as MatchStrategy
                            })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select variable..." />
                            </SelectTrigger>
                            <SelectContent>
                                {variables.map(v => (
                                    <SelectItem key={v.key} value={v.alias || v.key}>
                                        <div className="flex items-center gap-2">
                                            {/* Basic variable display */}
                                            <span className="font-mono text-xs">{v.alias || v.key}</span>
                                            {v.label && <span className="text-muted-foreground text-xs font-normal">({v.label})</span>}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Workflow variable containing the value to match
                        </p>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label>Column Mappings</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addMapping}>
                        <Plus className="w-3 h-3 mr-1" />
                        Add Field
                    </Button>
                </div>

                <div className="space-y-2">
                    {config.columnMappings?.map((mapping, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                            {/* Column Select for Mappings */}
                            <div className="flex-1 min-w-0">
                                <Select
                                    value={mapping.columnId}
                                    onValueChange={(val) => updateMapping(idx, "columnId", val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select column">
                                            {getColumnName(mapping.columnId)}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {columns?.map(col => (
                                            <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <span className="text-muted-foreground">=</span>

                            {/* Variable Select for Mapping Value */}
                            <div className="flex-1 min-w-0">
                                <Select
                                    value={mapping.value}
                                    onValueChange={(val) => updateMapping(idx, "value", val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select variable..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {variables.map(v => (
                                            <SelectItem key={v.key} value={v.alias || v.key}>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs">{v.alias || v.key}</span>
                                                    {v.label && <span className="text-muted-foreground text-xs font-normal">({v.label})</span>}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button type="button" variant="ghost" size="icon" onClick={() => removeMapping(idx)}>
                                <Trash2 className="w-4 h-4 text-muted-foreground" />
                            </Button>
                        </div>
                    ))}
                    {(!config.columnMappings || config.columnMappings.length === 0) && (
                        <p className="text-sm text-muted-foreground italic">No fields mapped yet.</p>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <Label>Output Variable (Optional)</Label>
                <Input
                    placeholder="Variable name to store row ID (e.g. new_row_id)"
                    value={config.outputKey || ""}
                    onChange={(e) => updateConfig({ outputKey: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                    After writing, the row ID will be stored in this variable for use in later steps
                </p>
            </div>

            {(!config.dataSourceId || !config.tableId) && (
                <div className="p-2 border border-yellow-200 bg-yellow-50 text-yellow-800 text-xs rounded">
                    ⚠ Please select a data source and table.
                </div>
            )}
            {(config.mode === 'update' || config.mode === 'upsert') && (!config.matchStrategy?.columnId || !config.matchStrategy?.columnValue) && (
                <div className="p-2 border border-yellow-200 bg-yellow-50 text-yellow-800 text-xs rounded">
                    ⚠ {config.mode === 'update' ? 'Update' : 'Upsert'} mode requires a match column and value.
                </div>
            )}
            {config.columnMappings?.length === 0 && (
                <div className="p-2 border border-yellow-200 bg-yellow-50 text-yellow-800 text-xs rounded">
                    ⚠ Add at least one column mapping to write data.
                </div>
            )}
        </div>
    );
}
