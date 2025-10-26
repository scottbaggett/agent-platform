/**
 * Utility to refresh node definitions in existing workflow nodes
 * This updates the nodeDef while preserving node state (nodeInputs, exposedInputs, etc.)
 */

import type { Node } from "@xyflow/react";
import type { NodeDefinition } from "@/hooks/use-node-definitions";

/**
 * Refresh node definitions for all nodes in a workflow
 *
 * @param nodes - Current workflow nodes
 * @param nodeDefinitions - Latest node definitions from backend
 * @returns Updated nodes with refreshed definitions
 */
export function refreshNodeDefinitions(
  nodes: Node[],
  nodeDefinitions: Record<string, NodeDefinition>,
): Node[] {
  return nodes.map((node) => {
    const nodeType = node.data?.nodeType;

    if (!nodeType) {
      console.warn(`Node ${node.id} has no nodeType, skipping refresh`);
      return node;
    }

    const latestDef = nodeDefinitions[nodeType];

    if (!latestDef) {
      console.warn(
        `No definition found for node type: ${nodeType}, skipping refresh`,
      );
      return node;
    }

    // Update nodeDef while preserving all other node state
    return {
      ...node,
      data: {
        ...node.data,
        nodeDef: latestDef,
        // Update label if it was using the old display name
        label: latestDef.display_name || nodeType,
      },
    };
  });
}
