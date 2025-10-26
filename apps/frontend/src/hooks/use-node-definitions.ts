/**
 * Hook to fetch and cache node definitions from the backend
 */

import { useQuery } from "@tanstack/react-query";
import { protoEngineConfig } from "@/lib/config/protoEngine";

export type NodeDefinition = {
  name: string;
  display_name: string;
  category: string;
  short_description?: string;
  icon?: string;
  inputs?: any[];
  outputs?: any[];
  widgets?: any[];
};

export type NodeDefinitionsResponse = {
  nodes: NodeDefinition[];
};

/**
 * Fetch node definitions from the backend
 */
async function fetchNodeDefinitions(): Promise<Record<string, NodeDefinition>> {
  const response = await fetch(`${protoEngineConfig.url}/nodes`);

  if (!response.ok) {
    throw new Error(`Failed to fetch node definitions: ${response.status}`);
  }

  const data: NodeDefinitionsResponse = await response.json();

  // Convert array to map for easy lookup by name
  const nodeMap: Record<string, NodeDefinition> = {};
  data.nodes.forEach((node) => {
    nodeMap[node.name] = node;
  });

  return nodeMap;
}

/**
 * Hook to access node definitions with caching
 */
export function useNodeDefinitions() {
  return useQuery({
    queryKey: ["nodeDefinitions"],
    queryFn: fetchNodeDefinitions,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
