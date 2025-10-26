/**
 * ProtoWorkflowToolbar - Top toolbar with workflow controls
 * Now uses backend API instead of localStorage
 */

import { Save, FolderOpen, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
import {
  useWorkflows,
  useWorkflow,
  useCreateWorkflow,
  useUpdateWorkflow,
  useDeleteWorkflow,
} from "@/hooks/use-workflows";

export const ProtoWorkflowToolbar = () => {
  const navigate = useNavigate();
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [editingName, setEditingName] = useState("");

  const { currentWorkflowId, setCurrentWorkflow } = useProtoWorkflowStore();
  const { data: workflowsList } = useWorkflows();
  const { data: currentWorkflow } = useWorkflow(currentWorkflowId || "");
  const createWorkflow = useCreateWorkflow();
  const updateWorkflow = useUpdateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();

  // Sync editing name with current workflow
  useState(() => {
    if (currentWorkflow) {
      setEditingName(currentWorkflow.name);
    }
  });

  const handleNew = () => {
    if (!newWorkflowName.trim()) return;

    createWorkflow.mutate(
      {
        name: newWorkflowName.trim(),
        definition: { nodes: [], edges: [] },
      },
      {
        onSuccess: (newWorkflow) => {
          setCurrentWorkflow(newWorkflow.id);
          setNewWorkflowName("");
          setIsNewDialogOpen(false);
          console.log("✅ Created new workflow:", newWorkflow.name);
        },
      },
    );
  };

  const handleLoad = (workflowId: string) => {
    setCurrentWorkflow(workflowId);
    setIsLoadDialogOpen(false);
    console.log("✅ Loading workflow:", workflowId);
  };

  const handleDelete = (workflowId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this workflow?")) {
      deleteWorkflow.mutate(workflowId, {
        onSuccess: () => {
          console.log("✅ Deleted workflow:", workflowId);
          // If we deleted the current workflow, clear it
          if (workflowId === currentWorkflowId) {
            setCurrentWorkflow(null);
          }
        },
      });
    }
  };

  const handleRename = (newName: string) => {
    if (!currentWorkflowId || !newName.trim()) return;

    setEditingName(newName);

    // Debounced update
    updateWorkflow.mutate({
      workflowId: currentWorkflowId,
      update: { name: newName.trim() },
    });
  };

  const handleSave = () => {
    if (currentWorkflowId) {
      console.log("💾 Manual save triggered (auto-save is active)");
    }
  };

  return (
    <div className="bg-editor-panel pointer-events-auto absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border px-4 py-2 shadow-xl">
      {/* Current Workflow Name */}
      <div className="flex items-center gap-2">
        {currentWorkflow ? (
          <Input
            value={editingName || currentWorkflow.name}
            onChange={(e) => handleRename(e.target.value)}
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
              <Button
                onClick={handleNew}
                disabled={!newWorkflowName.trim() || createWorkflow.isPending}
              >
                {createWorkflow.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save (shown but auto-save is active) */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={handleSave}
        disabled={!currentWorkflowId}
        title="Auto-save is active"
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
            {!workflowsList || workflowsList.workflows.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                No saved workflows yet
              </div>
            ) : (
              workflowsList.workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className={`hover:bg-surface-3 flex cursor-pointer items-center justify-between rounded-lg border p-3 shadow-sm transition-colors ${
                    workflow.id === currentWorkflowId
                      ? "bg-card border-blue-500"
                      : "border-gray-700"
                  }`}
                  onClick={() => handleLoad(workflow.id)}
                >
                  <div className="flex-1">
                    <div className="text-foreground font-medium">
                      {workflow.name}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {
                        ((workflow.definition as { nodes?: unknown[] })?.nodes || [])
                          .length
                      }{" "}
                      nodes,{" "}
                      {
                        ((workflow.definition as { edges?: unknown[] })?.edges || [])
                          .length
                      }{" "}
                      connections
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      Updated {new Date(workflow.updated_at).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:text-red-400"
                    onClick={(e) => handleDelete(workflow.id, e)}
                    disabled={deleteWorkflow.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View All Workflows Link */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate({ to: "/workflows" })}
      >
        View All
      </Button>
    </div>
  );
};
