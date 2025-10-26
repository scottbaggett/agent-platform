/**
 * React Query hooks for workflow management
 * Provides data fetching, mutations, and cache management for workflows
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";
import type { components } from "@/lib/types/api.generated";
import {
  fetchWorkflows,
  fetchWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  fetchWorkflowRuns,
} from "@/lib/api/workflows";

type WorkflowResponse = components["schemas"]["WorkflowResponse"];
type WorkflowListResponse = components["schemas"]["WorkflowListResponse"];
type WorkflowCreate = components["schemas"]["WorkflowCreate"];
type WorkflowUpdate = components["schemas"]["WorkflowUpdate"];
type WorkflowRunSummary = components["schemas"]["routes__workflows__WorkflowRunSummary"];

// Query keys for consistent cache management
export const workflowKeys = {
  all: ["workflows"] as const,
  lists: () => [...workflowKeys.all, "list"] as const,
  list: (params?: { skip?: number; limit?: number }) =>
    [...workflowKeys.lists(), params] as const,
  details: () => [...workflowKeys.all, "detail"] as const,
  detail: (id: string) => [...workflowKeys.details(), id] as const,
  runs: (id: string) => [...workflowKeys.detail(id), "runs"] as const,
};

/**
 * Hook to fetch all workflows with optional pagination
 */
export function useWorkflows(params?: {
  skip?: number;
  limit?: number;
}): UseQueryResult<WorkflowListResponse, Error> {
  return useQuery({
    queryKey: workflowKeys.list(params),
    queryFn: () => fetchWorkflows(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch a single workflow by ID
 */
export function useWorkflow(
  workflowId: string,
): UseQueryResult<WorkflowResponse, Error> {
  return useQuery({
    queryKey: workflowKeys.detail(workflowId),
    queryFn: () => fetchWorkflow(workflowId),
    enabled: !!workflowId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch runs for a specific workflow
 */
export function useWorkflowRuns(
  workflowId: string,
  limit?: number,
): UseQueryResult<WorkflowRunSummary[], Error> {
  return useQuery({
    queryKey: workflowKeys.runs(workflowId),
    queryFn: () => fetchWorkflowRuns(workflowId, limit),
    enabled: !!workflowId,
    staleTime: 1000 * 30, // 30 seconds (runs are more dynamic)
  });
}

/**
 * Hook to create a new workflow
 * Automatically invalidates workflow list cache on success
 */
export function useCreateWorkflow(): UseMutationResult<
  WorkflowResponse,
  Error,
  WorkflowCreate
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWorkflow,
    onSuccess: (newWorkflow) => {
      // Invalidate and refetch workflow lists
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
      // Optionally set the new workflow in cache
      queryClient.setQueryData(workflowKeys.detail(newWorkflow.id), newWorkflow);
    },
  });
}

/**
 * Hook to update an existing workflow
 * Automatically updates cache on success
 */
export function useUpdateWorkflow(): UseMutationResult<
  WorkflowResponse,
  Error,
  { workflowId: string; update: WorkflowUpdate }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workflowId, update }) => updateWorkflow(workflowId, update),
    onSuccess: (updatedWorkflow, { workflowId }) => {
      // Update the specific workflow in cache
      queryClient.setQueryData(workflowKeys.detail(workflowId), updatedWorkflow);
      // Invalidate workflow lists to reflect changes
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
    },
  });
}

/**
 * Hook to delete a workflow
 * Automatically removes from cache and invalidates lists
 */
export function useDeleteWorkflow(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: (_, workflowId) => {
      // Remove the workflow from cache
      queryClient.removeQueries({ queryKey: workflowKeys.detail(workflowId) });
      // Invalidate workflow lists
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
    },
  });
}
