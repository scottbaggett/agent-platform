/**
 * ProtoEditor - Main editor component
 * Simple React Flow canvas with node browser and execution controls
 * Now uses backend API for workflow persistence instead of localStorage
 */

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
} from "@xyflow/react";
import { useCallback, useState, useEffect, useRef } from "react";
import { useSearch } from "@tanstack/react-router";
import { ProtoExecutionBar } from "./ProtoExecutionBar";
import { ProtoNode } from "./ProtoNode";
import { ProtoNodeBrowser } from "./ProtoNodeBrowser";
import { ProtoOutputNode } from "./ProtoOutputNode";
import { ProtoSchemaNode } from "./ProtoSchemaNode";
import { ProtoPropertiesPanel } from "./ProtoPropertiesPanel";
import { ProtoWorkflowToolbar } from "./ProtoWorkflowToolbar";
import { ProtoEditorContext } from "./ProtoEditorContext";
import { useProtoWorkflowStore } from "@/lib/stores/useProtoWorkflowStore";
import { useReactFlow } from "@xyflow/react";
import { ProtoDynamicTextNode } from "./ProtoDynamicTextNode";
import { useNodeDefinitions } from "@/hooks/use-node-definitions";
import { refreshNodeDefinitions } from "@/lib/utils/refreshNodeDefinitions";
import {
  useWorkflows,
  useWorkflow,
  useCreateWorkflow,
  useUpdateWorkflow,
} from "@/hooks/use-workflows";
import { protoEngineConfig } from "@/lib/config/protoEngine";

const nodeTypes = {
  protoNode: ProtoNode,
  protoOutputNode: ProtoOutputNode,
  protoSchemaNode: ProtoSchemaNode,
  protoDynamicTextNode: ProtoDynamicTextNode,
};

export const ProtoEditor = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingNodeId, setExecutingNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [viewportChanged, setViewportChanged] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, setViewport, getViewport } = useReactFlow();

  // Get URL params
  const search = useSearch({ from: "/proto-editor/" });
  const urlWorkflowId = (search as { workflowId?: string }).workflowId;

  // Store and API hooks
  const { currentWorkflowId, setCurrentWorkflow } = useProtoWorkflowStore();
  const { data: workflowsList } = useWorkflows();
  const { data: currentWorkflowData } = useWorkflow(currentWorkflowId || "");
  const createWorkflow = useCreateWorkflow();
  const updateWorkflow = useUpdateWorkflow();

  // Fetch latest node definitions
  const { data: nodeDefinitions } = useNodeDefinitions();

  // Initialize workflow on mount
  useEffect(() => {
    if (initialized || !workflowsList) return;

    console.log("Initializing workflow system:", {
      currentWorkflowId,
      urlWorkflowId,
      workflowCount: workflowsList.total,
    });

    // Priority: URL param > current ID > most recent > create new
    if (urlWorkflowId) {
      console.log("✅ Loading workflow from URL:", urlWorkflowId);
      setCurrentWorkflow(urlWorkflowId);
    } else if (currentWorkflowId) {
      console.log("✅ Using current workflow ID:", currentWorkflowId);
      // Keep current workflow
    } else if (workflowsList.total > 0) {
      // Load most recent
      const mostRecent = workflowsList.workflows[0];
      console.log("✅ Loading most recent workflow:", mostRecent.name);
      setCurrentWorkflow(mostRecent.id);
    } else {
      // Create initial workflow
      console.log("✅ Creating initial workflow");
      createWorkflow.mutate(
        {
          name: "Untitled Workflow",
          definition: { nodes: [], edges: [] },
        },
        {
          onSuccess: (newWorkflow) => {
            setCurrentWorkflow(newWorkflow.id);
          },
        },
      );
    }

    setInitialized(true);
  }, [workflowsList, initialized]);

  // Load workflow data when current workflow changes
  useEffect(() => {
    if (!currentWorkflowData || !initialized) return;

    console.log("✅ Loading workflow data:", currentWorkflowData.name);

    const definition = currentWorkflowData.definition as {
      nodes?: Node[];
      edges?: any[];
      viewport?: { x: number; y: number; zoom: number };
    };

    setNodes(definition?.nodes || []);
    setEdges(definition?.edges || []);

    if (definition?.viewport) {
      setViewport(definition.viewport, { duration: 0 });
      console.log("📷 Restored viewport:", definition.viewport);
    }
  }, [currentWorkflowData?.id, initialized]);

  // Refresh node definitions when they're loaded
  useEffect(() => {
    if (!nodeDefinitions || !initialized || nodes.length === 0) return;

    console.log("🔄 Refreshing node definitions for", nodes.length, "nodes");
    const refreshedNodes = refreshNodeDefinitions(nodes, nodeDefinitions);

    const hasChanges = refreshedNodes.some((node, idx) => {
      const oldNode = nodes[idx];
      return (
        JSON.stringify(node.data.nodeDef) !==
        JSON.stringify(oldNode.data?.nodeDef)
      );
    });

    if (hasChanges) {
      console.log("✅ Node definitions updated");
      setNodes(refreshedNodes);
    }
  }, [nodeDefinitions, initialized]);

  // Auto-save workflow when nodes/edges/viewport change
  useEffect(() => {
    if (!currentWorkflowId || !initialized || updateWorkflow.isPending) return;

    const timeout = setTimeout(() => {
      const viewport = getViewport();
      const definition = {
        nodes,
        edges,
        viewport,
      };

      updateWorkflow.mutate(
        {
          workflowId: currentWorkflowId,
          update: { definition },
        },
        {
          onSuccess: () => {
            console.log(
              "💾 Auto-saved workflow:",
              currentWorkflowId.slice(0, 8),
              "|",
              nodes.length,
              "nodes",
              "|",
              edges.length,
              "edges",
              "| zoom:",
              viewport.zoom.toFixed(2),
            );
          },
        },
      );
    }, 1000); // Debounce 1s

    return () => clearTimeout(timeout);
  }, [nodes, edges, viewportChanged, currentWorkflowId, initialized]);

  // Handle viewport changes (pan/zoom)
  const onMoveEnd = useCallback(() => {
    if (initialized) {
      setViewportChanged((prev) => prev + 1);
    }
  }, [initialized]);

  // Keyboard shortcut: Cmd+Enter to execute workflow
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (!isExecuting) {
          handleExecute();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExecuting]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges],
  );

  const isValidConnection = useCallback(() => {
    return true;
  }, []);

  // Add node to canvas from node browser
  const handleAddNode = useCallback(
    (nodeType: string, nodeDef: any) => {
      const isOutputNode = nodeType === "ProtoOutputNode";
      const isAgentNode = nodeType === "ProtoAgentNode";
      const isSchemaNode = nodeType === "ProtoSchemaNode";
      const isDynamicTextNode = nodeType === "ProtoDynamicTextNode";

      let reactFlowType = "protoNode";
      if (isOutputNode) reactFlowType = "protoOutputNode";
      if (isSchemaNode) reactFlowType = "protoSchemaNode";
      if (isDynamicTextNode) reactFlowType = "protoDynamicTextNode";

      const newNode: Node = {
        id: `${nodeType}-${Date.now()}`,
        type: reactFlowType,
        position: { x: 250, y: 150 },
        data: {
          nodeType,
          nodeDef,
          label: nodeDef.display_name || nodeType,
          streamingContent: "",
          isStreaming: false,
          exposedInputs: [],
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes],
  );

  // Execute workflow (optionally from a specific node)
  const handleExecute = useCallback(
    async (startNodeId?: string) => {
      setIsExecuting(true);
      setContextMenu(null);

      try {
        let nodesToExecute = nodes;
        let edgesToUse = edges;

        if (startNodeId) {
          const downstreamNodeIds = new Set<string>([startNodeId]);
          const queue = [startNodeId];

          while (queue.length > 0) {
            const currentId = queue.shift()!;
            const outgoingEdges = edges.filter((e) => e.source === currentId);

            outgoingEdges.forEach((edge) => {
              if (!downstreamNodeIds.has(edge.target)) {
                downstreamNodeIds.add(edge.target);
                queue.push(edge.target);
              }
            });
          }

          nodesToExecute = nodes.filter((n) => downstreamNodeIds.has(n.id));
          edgesToUse = edges.filter(
            (e) =>
              downstreamNodeIds.has(e.source) &&
              downstreamNodeIds.has(e.target),
          );

          console.log(`Executing from node ${startNodeId}:`, {
            totalNodes: nodes.length,
            executingNodes: nodesToExecute.length,
            downstreamIds: Array.from(downstreamNodeIds),
          });
        }

        const workflowData = {
          nodes: nodesToExecute.reduce(
            (acc, node) => {
              acc[node.id] = {
                id: node.id,
                data: node.data,
              };
              return acc;
            },
            {} as Record<string, any>,
          ),
          edges: edgesToUse.map((edge) => ({
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
          })),
        };

        console.log("Sending workflow to backend:", workflowData);

        const executeUrl = `${protoEngineConfig.url}/execute`;
        console.log("Execute URL:", executeUrl);
        console.log("API Config:", protoEngineConfig);

        let response;
        try {
          response = await fetch(executeUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(workflowData),
          });
        } catch (fetchError) {
          console.error("Fetch failed:", fetchError);
          console.error("Execute URL was:", executeUrl);
          console.error("VITE_API_URL env:", import.meta.env.VITE_API_URL);
          throw new Error(
            `Failed to connect to backend at ${executeUrl}. Is the backend running? Error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
          );
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Response not OK:", response.status, errorText);
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No response body");
        }

        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log("Stream complete");
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split("\n\n");
          buffer = messages.pop() || "";

          for (const message of messages) {
            if (!message.trim()) continue;

            const dataMatch = message.match(/^data: (.+)$/m);
            if (!dataMatch) continue;

            try {
              const eventData = JSON.parse(dataMatch[1]);
              console.log("Received event:", eventData);

              switch (eventData.event) {
                case "workflow_start":
                  console.log("Workflow execution started");
                  break;

                case "node_start":
                  setExecutingNodeId(eventData.node_id);
                  console.log(`Node ${eventData.node_id} started`);
                  break;

                case "node_stream":
                  setNodes((nds) =>
                    nds.map((n) =>
                      n.id === eventData.node_id
                        ? {
                            ...n,
                            data: {
                              ...n.data,
                              streamingContent: eventData.content,
                              isStreaming: true,
                            },
                          }
                        : n,
                    ),
                  );
                  break;

                case "node_complete":
                  setExecutingNodeId(null);
                  setNodes((nds) =>
                    nds.map((n) => {
                      if (n.id === eventData.node_id) {
                        const output = eventData.output || {};

                        if (
                          n.data.nodeType === "ProtoOutputNode" &&
                          output.content !== undefined
                        ) {
                          return {
                            ...n,
                            data: {
                              ...n.data,
                              isStreaming: false,
                              streamingContent: output.content,
                            },
                          };
                        }

                        return {
                          ...n,
                          data: { ...n.data, isStreaming: false },
                        };
                      }
                      return n;
                    }),
                  );
                  console.log(`Node ${eventData.node_id} completed`);
                  break;

                case "workflow_complete":
                  console.log("Workflow execution completed");
                  setIsExecuting(false);
                  break;

                case "error":
                  console.error("Workflow error:", eventData.message);
                  alert(`Error: ${eventData.message}`);
                  setIsExecuting(false);
                  break;
              }
            } catch (parseError) {
              console.error("Failed to parse event:", parseError, dataMatch[1]);
            }
          }
        }

        setIsExecuting(false);
      } catch (error) {
        console.error("Execution error:", error);
        alert(
          `Execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        setIsExecuting(false);
        setExecutingNodeId(null);
      }
    },
    [nodes, edges, setNodes],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
    },
    [],
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      });
    },
    [],
  );

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  const handleUpdateNode = useCallback(
    (nodeId: string, data: any) => {
      setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data } : n)));
      setSelectedNode((prev) =>
        prev?.id === nodeId ? { ...prev, data } : prev,
      );
    },
    [setNodes],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const nodeData = event.dataTransfer.getData("application/reactflow");
      if (!nodeData) return;

      try {
        const nodeDef = JSON.parse(nodeData);
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const isOutputNode = nodeDef.name === "ProtoOutputNode";
        const isAgentNode = nodeDef.name === "ProtoAgentNode";
        const isSchemaNode = nodeDef.name === "ProtoSchemaNode";

        let reactFlowType = "protoNode";
        if (isOutputNode) reactFlowType = "protoOutputNode";
        if (isSchemaNode) reactFlowType = "protoSchemaNode";

        const newNode: Node = {
          id: `${nodeDef.name}-${Date.now()}`,
          type: reactFlowType,
          position,
          data: {
            nodeType: nodeDef.name,
            nodeDef,
            label: nodeDef.display_name || nodeDef.name,
            streamingContent: "",
            isStreaming: false,
            exposedInputs: isAgentNode ? ["context", "json_schema"] : [],
          },
        };

        setNodes((nds) => [...nds, newNode]);
      } catch (error) {
        console.error("Failed to drop node:", error);
      }
    },
    [screenToFlowPosition, setNodes],
  );

  return (
    <ProtoEditorContext.Provider value={{ onExecuteFromNode: handleExecute }}>
      <div ref={reactFlowWrapper} className="relative h-full w-full">
        {/* Workflow Toolbar */}
        <ProtoWorkflowToolbar />

        {/* React Flow Canvas */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onNodeClick={handleNodeClick}
          onNodeContextMenu={handleNodeContextMenu}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onMoveEnd={onMoveEnd}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-950"
        >
          <Background color="#374151" gap={16} />
          <Controls className="!border-gray-700 !bg-gray-800" />
          <MiniMap
            className="!border-gray-700 !bg-gray-800"
            nodeColor="#6b7280"
          />
        </ReactFlow>

        {/* Node Browser */}
        <ProtoNodeBrowser onAddNode={handleAddNode} />

        {/* Properties Panel */}
        <ProtoPropertiesPanel
          selectedNode={selectedNode}
          onClose={() => setSelectedNode(null)}
          onUpdateNode={handleUpdateNode}
        />

        {/* Execution Bar */}
        <ProtoExecutionBar
          isExecuting={isExecuting}
          onExecute={handleExecute}
          nodeCount={nodes.length}
          executingNodeId={executingNodeId}
        />

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="pointer-events-auto fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-48"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            <button
              className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 transition-colors flex items-center gap-2"
              onClick={() => handleExecute(contextMenu.nodeId)}
            >
              <span className="text-green-400">▶</span>
              Execute from here
            </button>
          </div>
        )}
      </div>
    </ProtoEditorContext.Provider>
  );
};
