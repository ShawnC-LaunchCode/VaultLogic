/**
 * ExecutionTimeline Component
 * 
 * Displays a chronological list of executed steps, logic evaluations, and errors.
 * Used in the DevPanel to help users understand what happened during a workflow run.
 */

import React from "react";
import { CheckCircle, XCircle, AlertCircle, ArrowRight, Clock } from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TraceEntry } from "@/lib/previewRunner/PreviewEnvironment";

interface ExecutionTimelineProps {
    trace: TraceEntry[];
    isLoading?: boolean;
}

export function ExecutionTimeline({ trace, isLoading }: ExecutionTimelineProps) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading trace...
            </div>
        );
    }

    if (!trace || trace.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                <p>No execution trace yet</p>
                <p className="text-xs mt-2">Run the workflow to see execution steps</p>
            </div>
        );
    }

    // Reverse trace to show newest first? Or oldest first? 
    // Debuggers usually show newest at bottom (chronological).
    // Let's stick to chronological order for now.

    return (
        <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
                {trace.map((entry, index) => (
                    <TimelineItem key={entry.id} entry={entry} index={index} />
                ))}
            </div>
        </ScrollArea>
    );
}

function TimelineItem({ entry, index }: { entry: TraceEntry; index: number }) {
    const getIcon = () => {
        switch (entry.status) {
            case "executed":
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case "skipped":
                return <ArrowRight className="w-4 h-4 text-muted-foreground" />; // Skip icon
            case "failed":
                return <XCircle className="w-4 h-4 text-destructive" />;
            default:
                return <Clock className="w-4 h-4 text-blue-500" />;
        }
    };

    const formattedTime = format(new Date(entry.timestamp), "HH:mm:ss.SSS");

    return (
        <div className="flex gap-3 relative">
            {/* Connector Line */}
            <div className="absolute left-[7px] top-6 bottom-[-14px] w-[2px] bg-border last:hidden" />

            {/* Icon */}
            <div className="mt-1 relative z-10 bg-background">
                {getIcon()}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 border rounded-md p-2 text-sm bg-card shadow-sm">
                <div className="flex justify-between items-start mb-1">
                    <div className="font-medium truncate pr-2">
                        {entry.message || `Step ${index + 1}`}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">
                        {formattedTime}
                    </span>
                </div>

                {/* Details */}
                <div className="flex gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 capitalize">
                        {entry.type}
                    </Badge>
                    <Badge
                        variant={entry.status === 'failed' ? 'destructive' : 'secondary'}
                        className="text-[10px] px-1 py-0 h-4 capitalize"
                    >
                        {entry.status}
                    </Badge>
                </div>

                {entry.details && (
                    <div className="mt-2 text-xs bg-muted/50 p-1.5 rounded font-mono overflow-x-auto">
                        {entry.status === 'skipped' && (
                            <div className="text-muted-foreground">
                                Reason: {JSON.stringify(entry.details.reason || entry.details)}
                            </div>
                        )}
                        {entry.status === 'executed' && entry.details.outputs && (
                            <div>
                                Outputs: {JSON.stringify(entry.details.outputs)}
                            </div>
                        )}
                        {entry.status === 'failed' && (
                            <div className="text-destructive">
                                Error: {JSON.stringify(entry.details.error || entry.details)}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
