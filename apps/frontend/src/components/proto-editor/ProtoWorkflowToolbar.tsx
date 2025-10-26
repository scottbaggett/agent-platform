/**
 * ProtoWorkflowToolbar - Top toolbar with workflow controls
 * Save, load, new workflow, etc.
 */

import { Save, FolderOpen, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useProtoWorkflowStore } from "@/lib/stores/useProtoWorkflowStore";

type ProtoWorkflowToolbarProps = {
  onSave: () => void;
  onLoad: (workflowId: string) => void;
  onNew: (name: string) => void;
};

export const ProtoWorkflowToolbar = ({
  onSave,
  onLoad,
  onNew,
}: ProtoWorkflowToolbarProps) => {
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [editingName, setEditingName] = useState("");

  const {
    workflows,
    currentWorkflowId,
    getCurrentWorkflow,
    deleteWorkflow,
    renameWorkflow,
  } = useProtoWorkflowStore();

  const currentWorkflow = getCurrentWorkflow();

  // Sync editing name with current workflow
  useEffect(() => {
    if (currentWorkflow) {
      setEditingName(currentWorkflow.name);
    }
  }, [currentWorkflow?.id]);

  const handleNew = () => {
    if (!newWorkflowName.trim()) return;
    onNew(newWorkflowName.trim());
    setNewWorkflowName("");
    setIsNewDialogOpen(false);
  };

  const handleLoad = (workflowId: string) => {
    onLoad(workflowId);
    setIsLoadDialogOpen(false);
  };

  const handleDelete = (workflowId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this workflow?")) {
      deleteWorkflow(workflowId);
    }
  };

  return (
    <div className="bg-editor-panel pointer-events-auto absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border px-4 py-2 shadow-xl">
      {/* Current Workflow Name */}
      <div className="flex items-center gap-2">
        {currentWorkflow ? (
          <Input
            value={editingName}
            onChange={(e) => {
              setEditingName(e.target.value);
              // Auto-save name change with debounce
              renameWorkflow(currentWorkflow.id, e.target.value);
            }}
            className="h-7 w-48 text-sm"
            placeholder="Workflow name..."
          />
        ) : (
          <span className="text-muted-foreground text-sm">
            No workflow loaded
          </span>
        )}
      </div>

      {/* New Workflow */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder="Workflow name..."
              value={newWorkflowName}
              onChange={(e) => setNewWorkflowName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNew()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsNewDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleNew} disabled={!newWorkflowName.trim()}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={onSave}
        disabled={!currentWorkflowId}
      >
        <Save className="h-4 w-4" />
        Save
      </Button>

      {/* Load */}
      <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Load
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Load Workflow</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 space-y-2 overflow-y-auto pt-4">
            {workflows.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                No saved workflows yet
              </div>
            ) : (
              workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className={`hover:bg-surface-3 flex cursor-pointer items-center justify-between rounded-lg border p-3 shadow-sm transition-colors ${
                    workflow.id === currentWorkflowId
                      ? "bg-card border"
                      : "border-blue-500"
                  }`}
                  onClick={() => handleLoad(workflow.id)}
                >
                  <div className="flex-1">
                    <div className="text-foreground font-medium">
                      {workflow.name}
                    </div>
                    <div className="mt-1 text-xs">
                      {workflow.nodes.length} nodes, {workflow.edges.length}{" "}
                      connections
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      Updated {new Date(workflow.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:text-red-400"
                    onClick={(e) => handleDelete(workflow.id, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
