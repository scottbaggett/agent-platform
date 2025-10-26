/**
 * ProtoExecutionBar - Bottom floating bar with execution controls
 * Shows execution status and controls
 */

import { Play, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ProtoExecutionBarProps = {
  isExecuting: boolean;
  onExecute: () => void;
  nodeCount: number;
  executingNodeId: string | null;
};

export const ProtoExecutionBar = ({
  isExecuting,
  onExecute,
  nodeCount,
  executingNodeId,
}: ProtoExecutionBarProps) => (
  <div className="bg-editor-panel pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-lg border px-6 py-3 shadow-xl">
    {/* Status */}
    <div className="flex items-center gap-2">
      {isExecuting ? (
        <>
          <Loader2 className="text-success-8 h-4 w-4 animate-spin" />
          <span className="text-muted-foreground text-sm">
            {executingNodeId
              ? `Executing ${executingNodeId}...`
              : "Running workflow..."}
          </span>
        </>
      ) : (
        <>
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-muted-foreground text-sm">Ready</span>
        </>
      )}
    </div>

    {/* Divider */}
    <div className="h-6 w-px bg-gray-700" />

    {/* Node Count */}
    <div className="text-sm text-gray-400">
      {nodeCount} {nodeCount === 1 ? "node" : "nodes"}
    </div>

    {/* Divider */}
    <div className="h-6 w-px bg-gray-700" />

    {/* Execute Button */}
    <Button
      onClick={() => onExecute()}
      disabled={isExecuting || nodeCount === 0}
      size="sm"
      className="gap-2"
    >
      {isExecuting ? (
        <>
          <Square className="h-3.5 w-3.5" />
          Stop
        </>
      ) : (
        <>
          <Play className="h-3.5 w-3.5" />
          Execute
        </>
      )}
    </Button>
  </div>
);
