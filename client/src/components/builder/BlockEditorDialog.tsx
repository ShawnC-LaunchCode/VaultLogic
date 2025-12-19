import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getAvailableBlockTypes, type Mode } from "@/lib/mode";
import { useCreateBlock, useUpdateBlock, useCreateTransformBlock, useUpdateTransformBlock } from "@/lib/vault-hooks";
import { JSBlockEditor } from "@/components/blocks/JSBlockEditor";
import { QueryBlockEditor } from "@/components/blocks/QueryBlockEditor";
import { WriteBlockEditor } from "@/components/blocks/WriteBlockEditor";
import { ExternalSendBlockEditor } from "@/components/blocks/ExternalSendBlockEditor";
import { ReadTableBlockEditor } from "@/components/blocks/ReadTableBlockEditor";
import { ListToolsBlockEditor } from "@/components/blocks/ListToolsBlockEditor";
import { ValidateBlockEditor } from "@/components/blocks/ValidateBlockEditor";

// UniversalBlock type definition (matching what was in BlocksPanel)
export type UniversalBlock = {
    id: string;
    type: string;
    phase: string;
    order: number;
    enabled: boolean;
    raw: any;
    source: 'regular' | 'transform';
    title?: string;
    displayType?: string;
};

export function BlockEditorDialog({
    workflowId,
    block,
    mode,
    isOpen,
    onClose,
}: {
    workflowId: string;
    block: UniversalBlock | null;
    mode: Mode;
    isOpen: boolean;
    onClose: () => void;
}) {
    const createBlockMutation = useCreateBlock();
    const updateBlockMutation = useUpdateBlock();
    const createTransformMutation = useCreateTransformBlock();
    const updateTransformMutation = useUpdateTransformBlock();
    const { toast } = useToast();

    // Determine initial state
    // If block is null, we are creating. Default to 'regular'.
    const [creationMode, setCreationMode] = useState<'regular' | 'transform'>(block?.source || 'regular');

    const [formData, setFormData] = useState<any>({
        // Common
        phase: block?.phase || "onRunStart",
        enabled: block?.enabled ?? true,
        order: block?.order ?? 0,

        // Regular Block
        type: (block?.source === 'regular' ? block.type : 'read_table'), // Default to read_table if new
        config: block?.raw?.config || {},

        // Transform Block
        name: block?.raw?.name || "",
        language: block?.raw?.language || "javascript",
        code: block?.raw?.code || "",
        inputKeys: block?.raw?.inputKeys || [],
        outputKey: block?.raw?.outputKey || "",
        timeoutMs: block?.raw?.timeoutMs || 1000,
    });

    useEffect(() => {
        if (isOpen) {
            const source = block?.source || 'regular';
            setCreationMode(source);
            setFormData({
                phase: block?.phase || "onRunStart",
                enabled: block?.enabled ?? true,
                order: block?.order ?? 0,
                type: (source === 'regular' ? block?.type : 'read_table'),
                config: block?.raw?.config || {},
                name: block?.raw?.name || "",
                language: block?.raw?.language || "javascript",
                code: block?.raw?.code || "",
                inputKeys: block?.raw?.inputKeys || [],
                outputKey: block?.raw?.outputKey || "",
                timeoutMs: block?.raw?.timeoutMs || 1000,
            });
        }
    }, [isOpen, block]);

    const handleSave = async () => {
        try {
            if (creationMode === 'regular') {
                const data = {
                    type: formData.type,
                    phase: formData.phase,
                    config: formData.config,
                    enabled: formData.enabled === undefined ? true : formData.enabled,
                    order: Number(formData.order) || 0,
                    sectionId: null // We might want to support sectionId later
                };

                if (block && block.source === 'regular') {
                    await updateBlockMutation.mutateAsync({ id: block.id, workflowId, ...data });
                } else {
                    await createBlockMutation.mutateAsync({ workflowId, ...data });
                }
            } else {
                // Transform
                const data = {
                    name: formData.name,
                    language: formData.language,
                    phase: formData.phase,
                    code: formData.code,
                    inputKeys: formData.inputKeys,
                    outputKey: formData.outputKey,
                    timeoutMs: formData.timeoutMs,
                    enabled: formData.enabled === undefined ? true : formData.enabled,
                    order: Number(formData.order) || 0,
                };

                if (block && block.source === 'transform') {
                    await updateTransformMutation.mutateAsync({ id: block.id, workflowId, ...data });
                } else {
                    await createTransformMutation.mutateAsync({ workflowId, ...data });
                }
            }

            toast({ title: "Success", description: "Block saved successfully." });
            onClose();
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to save block.", variant: "destructive" });
        }
    };

    const availableBlockTypes = getAvailableBlockTypes(mode);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{block ? `Edit ${block.title || block.type}` : "Add New Block"}</DialogTitle>
                    <DialogDescription>
                        {creationMode === 'regular' ? "Configure a standard workflow block." : "Configure a custom code transformation."}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    {/* Top Controls: Type Selection (Only if creating new) */}
                    {!block && (
                        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border">
                            <Label>Block Category:</Label>
                            <div className="flex gap-2">
                                <Button
                                    variant={creationMode === 'regular' ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCreationMode('regular')}
                                >
                                    Standard Block
                                </Button>
                                <Button
                                    variant={creationMode === 'transform' ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCreationMode('transform')}
                                    disabled={mode === 'easy'}
                                >
                                    Code Transform
                                </Button>
                            </div>
                            {mode === 'easy' && creationMode === 'regular' && (
                                <span className="text-xs text-muted-foreground ml-2">Code transforms are an Advanced Mode feature.</span>
                            )}
                        </div>
                    )}

                    {/* Configuration Form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Column: Settings */}
                        <div className="space-y-4">
                            {creationMode === 'regular' ? (
                                <div className="space-y-3">
                                    <Label>Block Type</Label>
                                    <Select
                                        value={formData.type}
                                        onValueChange={(v) => setFormData({ ...formData, type: v, config: {} })} // Reset config on type change
                                        disabled={!!block} // If editing, likely shouldn't change type unless we want to allow it (risky for config)
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {/* 
                          Cleaning up menu per prompt:
                          - Remove Prefill, Branch, Validate from *NEW* blocks (kept for edit if existing)
                      */}

                                            {/* Show legacy types only if editing a block of that type */}
                                            {(formData.type === 'prefill' || block?.type === 'prefill') && <SelectItem value="prefill">Prefill (Deprecated)</SelectItem>}
                                            {(formData.type === 'validate' || block?.type === 'validate') && <SelectItem value="validate">Validate (Deprecated)</SelectItem>}
                                            {(formData.type === 'branch' || block?.type === 'branch') && <SelectItem value="branch">Branch (Deprecated)</SelectItem>}

                                            {/* Supported Types */}
                                            {availableBlockTypes.includes('query') && <SelectItem value="query">Read Data (Legacy)</SelectItem>}
                                            {availableBlockTypes.includes('read_table') && <SelectItem value="read_table">Read from Table</SelectItem>}
                                            {availableBlockTypes.includes('list_tools') && <SelectItem value="list_tools">List Tools</SelectItem>}
                                            {availableBlockTypes.includes('write') && <SelectItem value="write">Save Data</SelectItem>}
                                            {availableBlockTypes.includes('external_send') && <SelectItem value="external_send">Send Data</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <Label>Language</Label>
                                    <Select
                                        value={formData.language}
                                        onValueChange={(v) => setFormData({ ...formData, language: v })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="javascript">JavaScript</SelectItem>
                                            <SelectItem value="python">Python</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <div className="pt-2">
                                        <Label>Block Name</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g. Calculate Risk Score"
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <Label>Execution Phase</Label>
                                <Select value={formData.phase} onValueChange={(v) => setFormData({ ...formData, phase: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="onRunStart">On Run Start</SelectItem>
                                        <SelectItem value="onSectionEnter">On Section Enter</SelectItem>
                                        <SelectItem value="onSectionSubmit">On Section Submit</SelectItem>
                                        <SelectItem value="onNext">On Next</SelectItem>
                                        <SelectItem value="onRunComplete">On Run Complete</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">When should this block run?</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Order</Label>
                                    <Input
                                        type="number"
                                        value={formData.order}
                                        onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2 pt-8">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.enabled}
                                            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                                            className="rounded border-gray-300"
                                        />
                                        <span className="text-sm font-medium">Enabled</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Editor */}
                        <div className="border-l pl-6">
                            <Label className="mb-2 block">Configuration</Label>

                            {creationMode === 'regular' ? (
                                <>
                                    {/* Render specific editors based on type */}
                                    {formData.type === 'query' ? (
                                        <QueryBlockEditor workflowId={workflowId} config={formData.config} onChange={(c) => setFormData({ ...formData, config: c })} />
                                    ) : formData.type === 'read_table' ? (
                                        <ReadTableBlockEditor workflowId={workflowId} config={formData.config} onChange={(c) => setFormData({ ...formData, config: c })} mode={mode} />
                                    ) : formData.type === 'list_tools' ? (
                                        <ListToolsBlockEditor workflowId={workflowId} config={formData.config} onChange={(c) => setFormData({ ...formData, config: c })} mode={mode} />
                                    ) : formData.type === 'write' ? (
                                        <WriteBlockEditor workflowId={workflowId} config={formData.config} onChange={(c) => setFormData({ ...formData, config: c })} />
                                    ) : formData.type === 'external_send' ? (
                                        <ExternalSendBlockEditor workflowId={workflowId} config={formData.config} onChange={(c) => setFormData({ ...formData, config: c })} />
                                    ) : formData.type === 'validate' ? (
                                        <ValidateBlockEditor workflowId={workflowId} config={formData.config} onChange={(c) => setFormData({ ...formData, config: c })} mode={mode} />
                                    ) : (
                                        <div className="space-y-2">
                                            <Textarea
                                                value={JSON.stringify(formData.config, null, 2)}
                                                onChange={(e) => {
                                                    try { setFormData({ ...formData, config: JSON.parse(e.target.value) }) } catch (e) { }
                                                }}
                                                className="font-mono text-xs h-[300px]"
                                                placeholder="{}"
                                            />
                                            <p className="text-xs text-muted-foreground">JSON Configuration for {formData.type}</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="h-full">
                                    <JSBlockEditor
                                        workflowId={workflowId}
                                        block={{
                                            config: {
                                                name: formData.name,
                                                code: formData.code,
                                                inputKeys: formData.inputKeys,
                                                outputKey: formData.outputKey,
                                                timeoutMs: formData.timeoutMs,
                                            }
                                        }}
                                        onChange={(updated) => {
                                            setFormData({
                                                ...formData,
                                                name: updated.config.name,
                                                code: updated.config.code,
                                                inputKeys: updated.config.inputKeys,
                                                outputKey: updated.config.outputKey,
                                                timeoutMs: updated.config.timeoutMs
                                            })
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save Block</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
