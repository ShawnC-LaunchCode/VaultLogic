import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WorkflowRunner } from "@/pages/WorkflowRunner";
import { PreviewEnvironment } from "@/lib/previewRunner/PreviewEnvironment";
import { DevToolsPanel } from "@/components/devtools/DevToolsPanel";
import { hotReloadManager } from "@/lib/previewRunner/HotReloadManager";
import { useToast } from "@/hooks/use-toast";
import { DevToolbar } from "./DevToolbar";
import { generateAIRandomValues, generateAIRandomValuesForSteps } from "@/lib/randomizer/aiRandomFill";
import { Loader2 } from "lucide-react";
import { ApiStep } from "@/lib/vault-api";
import { evaluateConditionExpression } from "@shared/conditionEvaluator";

interface PreviewRunnerProps {
    workflowId: string;
    onExit: () => void;
}

export function PreviewRunner({ workflowId, onExit }: PreviewRunnerProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Preview Environment State
    const [env, setEnv] = useState<PreviewEnvironment | null>(null);
    const [showDevTools, setShowDevTools] = useState(false);
    const [previewRunId, setPreviewRunId] = useState<string | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [snapshotId, setSnapshotId] = useState<string | null>(null);

    // Fetch workflow data
    const { data: workflow, isLoading: loadingWorkflow } = useQuery({
        queryKey: ["preview-workflow", workflowId],
        queryFn: async () => {
            const response = await fetch(`/api/workflows/${workflowId}`, {
                credentials: "include",
                cache: "no-cache",
            });
            if (!response.ok) throw new Error('Failed to load workflow');
            return response.json();
        },
        enabled: !!workflowId,
        staleTime: 0,
        gcTime: 0,
    });

    const allSteps = workflow?.sections?.flatMap((section: any) => section.steps || []) || [];

    // Fetch snapshot values
    const { data: snapshotValues } = useQuery({
        queryKey: ["snapshot-values", snapshotId],
        queryFn: async () => {
            if (!snapshotId || snapshotId === 'none') return null;
            const response = await fetch(`/api/workflows/${workflowId}/snapshots/${snapshotId}/values`, {
                credentials: "include",
            });
            if (!response.ok) throw new Error('Failed to load snapshot values');
            return response.json();
        },
        enabled: !!snapshotId && snapshotId !== 'none',
    });

    // Create preview run ID (for docs)
    useEffect(() => {
        if (!workflowId || previewRunId) return;
        async function createRun() {
            try {
                const res = await fetch(`/api/workflows/${workflowId}/runs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });
                if (res.ok) {
                    const data = await res.json();
                    setPreviewRunId(data.data.runId);
                    // Set token?
                }
            } catch (e) { console.error(e); }
        }
        createRun();
    }, [workflowId, previewRunId]);

    // Init Environment
    useEffect(() => {
        if (workflow && allSteps && workflow.sections) {
            if (env && env.getState().workflowId === workflow.id && !snapshotId) {
                return; // Keep existing env if just re-rendering, UNLESS loading snapshot
            }

            let initialValues = {};
            if (snapshotId && snapshotValues) {
                const stepIdValues: Record<string, any> = {};
                // Map alias/id to stepId
                for (const [key, value] of Object.entries(snapshotValues)) {
                    const step = allSteps.find((s: ApiStep) => s.alias === key || s.id === key);
                    if (step) stepIdValues[step.id] = value;
                }
                initialValues = stepIdValues;
            }

            // Recreate env when snapshot loads or first load
            const newEnv = new PreviewEnvironment({
                workflowId: workflow.id,
                sections: workflow.sections,
                steps: allSteps,
                initialValues,
            });
            setEnv(newEnv);
            hotReloadManager.attach(newEnv);
        }
        return () => hotReloadManager.detach();
    }, [workflow, allSteps, snapshotId, snapshotValues]);

    const handleRandomFill = async () => {
        if (!env || !allSteps) return;
        setIsAiLoading(true);
        try {
            const values = await generateAIRandomValues(allSteps, workflowId, workflow.title);
            // Apply values
            Object.entries(values).forEach(([stepId, val]) => {
                env.setValue(stepId, val);
            });

            // Calculate visible sections to jump to the end
            if (workflow.sections) {
                const aliasResolver = (variableName: string): string | undefined => {
                    const step = allSteps.find((s: ApiStep) => s.alias === variableName);
                    return step?.id;
                };

                const visibleSections = workflow.sections.filter((section: any) => {
                    if (!section.visibleIf) return true;
                    try {
                        return evaluateConditionExpression(section.visibleIf, values, aliasResolver);
                    } catch (e) { return true; }
                });

                if (visibleSections.length > 0) {
                    // Jump to the last section
                    env.setCurrentSection(visibleSections.length - 1);
                }
            }

            toast({ title: "Random Data Generated", description: "Filled workflow and jumped to end." });
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to generate data", variant: "destructive" });
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleRandomFillPage = async () => {
        if (!env || !allSteps) return;
        const currentState = env.getState();
        const currentSectionId = workflow.sections[currentState.currentSectionIndex]?.id;
        if (!currentSectionId) return;

        const pageSteps = allSteps.filter((s: ApiStep) => s.sectionId === currentSectionId);

        setIsAiLoading(true);
        try {
            const values = await generateAIRandomValuesForSteps(pageSteps, workflowId, workflow.title);
            Object.entries(values).forEach(([stepId, val]) => {
                env.setValue(stepId, val);
            });
            toast({ title: "Page Filled", description: "Filled current page with random values." });
        } catch (e) {
            toast({ title: "Error", description: "Failed to generate data", variant: "destructive" });
        } finally {
            setIsAiLoading(false);
        }
    };

    if (loadingWorkflow || !env) {
        return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="h-full flex flex-col bg-background">
            <DevToolbar
                workflowId={workflowId}
                onExit={onExit}
                onReset={() => env.reset()}
                onRandomFill={handleRandomFill}
                onRandomFillPage={handleRandomFillPage}
                onLoadSnapshot={(id) => setSnapshotId(id)}
                onToggleDevTools={() => setShowDevTools(!showDevTools)}
                showDevTools={showDevTools}
                isAiLoading={isAiLoading}
            />

            <div className="flex-1 flex overflow-hidden relative">
                <div className="flex-1 overflow-auto">
                    <WorkflowRunner
                        runId={previewRunId || undefined}
                        previewEnvironment={env}
                    />
                </div>

                <DevToolsPanel
                    env={env}
                    isOpen={showDevTools}
                    onClose={() => setShowDevTools(false)}
                />
            </div>
        </div>
    );
}
