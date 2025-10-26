/**
 * ProtoEditor - Main editor component
 * Simple React Flow canvas with node browser and execution controls
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
  const [viewportChanged, setViewportChanged] = useState(0); // Counter to trigger saves
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, setViewport, getViewport } = useReactFlow();

  const store = useProtoWorkflowStore();
  const {
    createWorkflow,
    saveWorkflow,
    loadWorkflow,
    currentWorkflowId,
    setCurrentWorkflow,
    workflows,
  } = store;

  // Fetch latest node definitions
  const { data: nodeDefinitions } = useNodeDefinitions();

  // Initialize workflow on mount - wait for Zustand hydration
  useEffect(() => {
    if (initialized) return;

    // Small delay to ensure Zustand persist has hydrated
    const timer = setTimeout(() => {
      console.log("Initializing workflow system:", {
        currentWorkflowId,
        workflowCount: workflows.length,
        workflows: workflows.map((w) => ({
          id: w.id,
          name: w.name,
          nodeCount: w.nodes?.length || 0,
        })),
      });

      if (!currentWorkflowId) {
        if (workflows.length === 0) {
          // No workflows exist, create initial one
          const id = createWorkflow("Untitled Workflow");
          console.log("✅ Created initial workflow:", id);
        } else {
          // Load the most recent workflow
          const mostRecent = [...workflows].sort(
            (a, b) => b.updatedAt - a.updatedAt,
          )[0];
          console.log(
            "✅ Loading most recent workflow:",
            mostRecent.name,
            "with",
            mostRecent.nodes?.length || 0,
            "nodes",
          );
          setCurrentWorkflow(mostRecent.id);
          setNodes(mostRecent.nodes || []);
          setEdges(mostRecent.edges || []);
          if (mostRecent.viewport) {
            setViewport(mostRecent.viewport, { duration: 0 });
            console.log("📷 Restored viewport:", mostRecent.viewport);
          }
        }
      } else {
        // Load current workflow data
        const current = workflows.find((w) => w.id === currentWorkflowId);
        if (current) {
          console.log(
            "✅ Loading current workflow:",
            current.name,
            "with",
            current.nodes?.length || 0,
            "nodes",
          );
          setNodes(current.nodes || []);
          setEdges(current.edges || []);
          if (current.viewport) {
            setViewport(current.viewport, { duration: 0 });
            console.log("📷 Restored viewport:", current.viewport);
          }
        } else {
          console.warn(
            "⚠️ Current workflow ID set but workflow not found:",
            currentWorkflowId,
          );
        }
      }

      setInitialized(true);
    }, 50); // Wait 50ms for hydration

    return () => clearTimeout(timer);
  }, []);

  // Refresh node definitions when they're loaded
  useEffect(() => {
    if (!nodeDefinitions || !initialized || nodes.length === 0) return;

    console.log("🔄 Refreshing node definitions for", nodes.length, "nodes");
    const refreshedNodes = refreshNodeDefinitions(nodes, nodeDefinitions);

    // Check if any nodes were actually updated
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
    if (currentWorkflowId && initialized) {
      const timeout = setTimeout(() => {
        const viewport = getViewport();
        saveWorkflow(currentWorkflowId, nodes, edges, viewport);
        console.log(
          "💾 Auto-saved workflow:",
          currentWorkflowId,
          "|",
          nodes.length,
          "nodes",
          "|",
          edges.length,
          "edges",
          "| zoom:",
          viewport.zoom.toFixed(2),
        );
      }, 500); // Debounce 500ms
      return () => clearTimeout(timeout);
    }
  }, [nodes, edges, viewportChanged, currentWorkflowId, initialized]);

  // Handle viewport changes (pan/zoom)
  const onMoveEnd = useCallback(() => {
    if (initialized) {
      setViewportChanged((prev) => prev + 1); // Trigger auto-save
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
  }, [isExecuting]); // Re-attach when isExecuting changes

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges],
  );

  // Allow all connections (no type validation)
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

      // Determine node type
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
          // Expose context and json_schema inputs by default for agent nodes
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
      setContextMenu(null); // Close context menu

      try {
        // If starting from a specific node, filter to only include that node and downstream nodes
        let nodesToExecute = nodes;
        let edgesToUse = edges;

        if (startNodeId) {
          // Find all nodes downstream from the start node (BFS)
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

          // Filter nodes and edges
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

        // Prepare workflow data for backend
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

        // Call backend execution endpoint with streaming
        const response = await fetch("http://localhost:8001/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(workflowData),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Read SSE stream
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

          // Decode chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages (separated by \n\n)
          const messages = buffer.split("\n\n");
          buffer = messages.pop() || ""; // Keep incomplete message in buffer

          for (const message of messages) {
            if (!message.trim()) continue;

            // Parse SSE format: "data: {...}"
            const dataMatch = message.match(/^data: (.+)$/m);
            if (!dataMatch) continue;

            try {
              const eventData = JSON.parse(dataMatch[1]);
              console.log("Received event:", eventData);

              // Handle different event types
              switch (eventData.event) {
                case "workflow_start":
                  console.log("Workflow execution started");
                  break;

                case "node_start":
                  setExecutingNodeId(eventData.node_id);
                  console.log(`Node ${eventData.node_id} started`);
                  break;

                case "node_stream":
                  // Update connected output nodes with streaming content
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
                  // Stop streaming indicator and store final output
                  setNodes((nds) =>
                    nds.map((n) => {
                      if (n.id === eventData.node_id) {
                        const output = eventData.output || {};

                        // For output nodes, store the content in streamingContent
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

                        // For other nodes, just stop streaming
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

  // Handle node selection
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
    },
    [],
  );

  // Handle node context menu (right-click)
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

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  // Update node data from properties panel
  const handleUpdateNode = useCallback(
    (nodeId: string, data: any) => {
      setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data } : n)));
      // Update selected node to reflect changes
      setSelectedNode((prev) =>
        prev?.id === nodeId ? { ...prev, data } : prev,
      );
    },
    [setNodes],
  );

  // Workflow actions
  const handleSave = useCallback(() => {
    if (currentWorkflowId) {
      const viewport = getViewport();
      saveWorkflow(currentWorkflowId, nodes, edges, viewport);
      console.log("💾 Workflow manually saved");
    }
  }, [currentWorkflowId, nodes, edges, getViewport, saveWorkflow]);

  const handleLoad = useCallback(
    (workflowId: string) => {
      const workflow = loadWorkflow(workflowId);
      if (workflow) {
        setNodes(workflow.nodes);
        setEdges(workflow.edges);
        setCurrentWorkflow(workflowId);
        if (workflow.viewport) {
          setViewport(workflow.viewport, { duration: 300 });
          console.log("📷 Restored viewport:", workflow.viewport);
        }
        console.log("✅ Workflow loaded:", workflow.name);
      }
    },
    [loadWorkflow, setNodes, setEdges, setCurrentWorkflow, setViewport],
  );

  const handleNew = useCallback(
    (name: string) => {
      const newId = createWorkflow(name);
      setNodes([]);
      setEdges([]);
      setCurrentWorkflow(newId);
      console.log("New workflow created:", name);
    },
    [createWorkflow, setNodes, setEdges, setCurrentWorkflow],
  );

  // Handle drag and drop
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

        // Determine node type
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
            // Expose context and json_schema inputs by default for agent nodes
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
        {/* Workflow Toolbar - Top */}
        <ProtoWorkflowToolbar
          onSave={handleSave}
          onLoad={handleLoad}
          onNew={handleNew}
        />

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

        {/* Node Browser - Left Side */}
        <ProtoNodeBrowser onAddNode={handleAddNode} />

        {/* Properties Panel - Right Side */}
        <ProtoPropertiesPanel
          selectedNode={selectedNode}
          onClose={() => setSelectedNode(null)}
          onUpdateNode={handleUpdateNode}
        />

        {/* Execution Bar - Bottom */}
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
