/**
 * Runner Preview - Embedded preview of the runner in builder
 */

import { X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkflowRunner } from "@/pages/WorkflowRunner";
import { useWorkflowBuilder } from "@/store/workflow-builder";

export function RunnerPreview({ runId }: { runId: string }) {
  const { stopPreview } = useWorkflowBuilder();

  return (
    <div className="h-full bg-background flex flex-col">
      <div className="border-b px-4 py-3 bg-primary/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-primary">Preview Mode</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={stopPreview}
          className="h-8"
        >
          <X className="w-4 h-4 mr-1" />
          Back to Builder
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <WorkflowRunner runId={runId} isPreview={true} />
      </div>
    </div>
  );
}
