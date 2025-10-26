import { createFileRoute, Link } from "@tanstack/react-router";
import { useWorkflows, useDeleteWorkflow } from "@/hooks/use-workflows";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

export const Route = createFileRoute("/workflows/")({
  component: WorkflowsPage,
});

function WorkflowsPage() {
  const { data, isLoading, error, refetch } = useWorkflows();
  const deleteWorkflow = useDeleteWorkflow();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (workflowId: string) => {
    setDeletingId(workflowId);
    try {
      await deleteWorkflow.mutateAsync(workflowId);
    } catch (err) {
      console.error("Failed to delete workflow:", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Workflows</h1>
          <p className="text-muted-foreground">
            Manage and execute your AI workflow pipelines
          </p>
        </div>
        <Link to="/proto-editor">
          <Button size="lg">
            <LucideIcon name="plus" className="mr-2 h-4 w-4" />
            Create Workflow
          </Button>
        </Link>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <LucideIcon name="alert-circle" className="h-4 w-4" />
          <AlertDescription>
            Failed to load workflows: {error.message}
            <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-4">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && data?.workflows.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
            <LucideIcon name="workflow" className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-semibold mb-2">No workflows yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Get started by creating your first AI workflow pipeline
          </p>
          <Link to="/proto-editor">
            <Button size="lg">
              <LucideIcon name="plus" className="mr-2 h-4 w-4" />
              Create Your First Workflow
            </Button>
          </Link>
        </div>
      )}

      {/* Workflows Grid */}
      {!isLoading && data && data.workflows.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {data.total} workflow{data.total !== 1 ? "s" : ""} total
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.workflows.map((workflow) => (
              <Card key={workflow.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="truncate">{workflow.name}</CardTitle>
                      <CardDescription className="mt-1">
                        Updated{" "}
                        {formatDistanceToNow(new Date(workflow.updated_at), {
                          addSuffix: true,
                        })}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="ml-2 shrink-0">
                      <LucideIcon name="git-branch" className="mr-1 h-3 w-3" />
                      {(workflow.definition?.nodes as unknown[] | undefined)?.length || 0}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3">
                    {/* Workflow stats/preview could go here */}
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      Created {formatDistanceToNow(new Date(workflow.created_at), { addSuffix: true })}
                    </p>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link
                        to="/proto-editor"
                        search={{ workflowId: workflow.id }}
                        className="flex-1"
                      >
                        <Button variant="default" size="sm" className="w-full">
                          <LucideIcon name="edit" className="mr-2 h-3 w-3" />
                          Edit
                        </Button>
                      </Link>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={deletingId === workflow.id}
                          >
                            {deletingId === workflow.id ? (
                              <LucideIcon name="loader-2" className="h-3 w-3 animate-spin" />
                            ) : (
                              <LucideIcon name="trash-2" className="h-3 w-3" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Workflow?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{workflow.name}"? This action
                              cannot be undone and will also delete all associated run
                              history.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(workflow.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
