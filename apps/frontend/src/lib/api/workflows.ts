/**
 * Workflow API client
 * Uses auto-generated types from OpenAPI schema
 */

import type { components } from "../types/api.generated";
import { protoEngineConfig } from "../config/protoEngine";

type WorkflowResponse = components["schemas"]["WorkflowResponse"];
type WorkflowListResponse = components["schemas"]["WorkflowListResponse"];
type WorkflowCreate = components["schemas"]["WorkflowCreate"];
type WorkflowUpdate = components["schemas"]["WorkflowUpdate"];
type WorkflowRunSummary = components["schemas"]["routes__workflows__WorkflowRunSummary"];

const API_URL = protoEngineConfig.url;

// Dev mode user ID (matches backend DEV_USER_ID)
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Get default headers for API requests
 * Includes X-User-ID for dev mode authentication
 */
function getHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-User-ID": DEV_USER_ID,
  };
}

/**
 * Fetch all workflows with optional pagination
 */
export async function fetchWorkflows(params?: {
  skip?: number;
  limit?: number;
}): Promise<WorkflowListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.skip !== undefined)
    queryParams.set("skip", params.skip.toString());
  if (params?.limit !== undefined)
    queryParams.set("limit", params.limit.toString());

  const url = `${API_URL}/workflows/?${queryParams}`;
  const response = await fetch(url, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch workflows: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch a single workflow by ID
 */
export async function fetchWorkflow(
  workflowId: string,
): Promise<WorkflowResponse> {
  const response = await fetch(`${API_URL}/workflows/${workflowId}`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch workflow ${workflowId}: ${response.statusText}`,
    );
  }

  return response.json();
}

/**
 * Create a new workflow
 */
export async function createWorkflow(
  workflow: WorkflowCreate,
): Promise<WorkflowResponse> {
  const response = await fetch(`${API_URL}/workflows/`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(workflow),
  });

  if (!response.ok) {
    throw new Error(`Failed to create workflow: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Update an existing workflow
 */
export async function updateWorkflow(
  workflowId: string,
  update: WorkflowUpdate,
): Promise<WorkflowResponse> {
  const response = await fetch(`${API_URL}/workflows/${workflowId}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(update),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to update workflow ${workflowId}: ${response.statusText}`,
    );
  }

  return response.json();
}

/**
 * Delete a workflow
 */
export async function deleteWorkflow(workflowId: string): Promise<void> {
  const response = await fetch(`${API_URL}/workflows/${workflowId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to delete workflow ${workflowId}: ${response.statusText}`,
    );
  }
}

/**
 * Fetch all runs for a specific workflow
 */
export async function fetchWorkflowRuns(
  workflowId: string,
  limit?: number,
): Promise<WorkflowRunSummary[]> {
  const queryParams = new URLSearchParams();
  if (limit !== undefined) queryParams.set("limit", limit.toString());

  const url = `${API_URL}/workflows/${workflowId}/runs?${queryParams}`;
  const response = await fetch(url, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch runs for workflow ${workflowId}: ${response.statusText}`,
    );
  }

  return response.json();
}
