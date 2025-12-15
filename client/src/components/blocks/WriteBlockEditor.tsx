import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { useWorkflowDataSources } from "@/lib/vault-hooks";
import { dataSourceAPI } from "@/lib/vault-api";
import { useQuery } from "@tanstack/react-query";

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

    const { data: tables } = useQuery({
        queryKey: ["dataSource", config.dataSourceId, "tables"],
        queryFn: () => config.dataSourceId ? dataSourceAPI.getTables(config.dataSourceId) : Promise.resolve([]),
        enabled: !!config.dataSourceId
    });

    const updateConfig = (updates: Partial<WriteConfig>) => {
        onChange({ ...config, ...updates });
    };

    const addMapping = () => {
        const mappings = config.columnMappings || [];
        updateConfig({ columnMappings: [...mappings, { columnId: "", value: "" }] });
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
                    onValueChange={(val) => updateConfig({ tableId: val })}
                    disabled={!config.dataSourceId}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select table" />
                    </SelectTrigger>
                    <SelectContent>
                        {tables?.map(t => (
                            <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
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
                        <Input
                            placeholder="Column UUID (e.g. col_abc123)"
                            value={config.matchStrategy?.columnId || ""}
                            onChange={(e) => updateConfig({
                                matchStrategy: {
                                    ...config.matchStrategy,
                                    type: config.matchStrategy?.type || "column_match",
                                    columnId: e.target.value
                                } as MatchStrategy
                            })}
                        />
                        <p className="text-xs text-muted-foreground">
                            The column UUID to match against (must be unique identifier)
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Match Value</Label>
                        <Input
                            placeholder="Variable or expression (e.g. client_id)"
                            value={config.matchStrategy?.columnValue || ""}
                            onChange={(e) => updateConfig({
                                matchStrategy: {
                                    ...config.matchStrategy,
                                    type: config.matchStrategy?.type || "column_match",
                                    columnValue: e.target.value
                                } as MatchStrategy
                            })}
                        />
                        <p className="text-xs text-muted-foreground">
                            Workflow variable containing the value to match (e.g. step.client_id)
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
                            <Input
                                placeholder="Column UUID"
                                value={mapping.columnId}
                                onChange={(e) => updateMapping(idx, "columnId", e.target.value)}
                                className="flex-1"
                            />
                            <span className="text-muted-foreground">=</span>
                            <Input
                                placeholder="Value / Variable"
                                value={mapping.value}
                                onChange={(e) => updateMapping(idx, "value", e.target.value)}
                                className="flex-1"
                            />
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
