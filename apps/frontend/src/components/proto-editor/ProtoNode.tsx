/**
 * ProtoNode - Simple node component for proto editor
 * Just displays node name and basic I/O handles
 */

import { Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useContext, useMemo } from "react";
import { NodeColor } from "@/lib/nodeColors";
import { ProtoEditorContext } from "./ProtoEditorContext";
import { ProtoNodeFooter } from "./ProtoNodeFooter";
import { ProtoNodeFrame } from "./ProtoNodeFrame";
import { ProtoNodeHandle } from "./ProtoNodeHandle";
import { ProtoNodeHeader } from "./ProtoNodeHeader";
import { useModelConfig } from "@/hooks/use-model-registry";
import type { ProtoNodeData, ProtoSchemaNodeData } from "./types";

export const ProtoNode = memo(({ data, selected, id }: NodeProps) => {
  const {
    label,
    nodeDef,
    exposedInputs = [],
    nodeInputs = {},
    nodeType,
    executionTime,
    tokenCount,
  } = data as ProtoNodeData;
  const isAgentNode = nodeType === "ProtoAgentNode";
  const prompt = nodeInputs?.prompt ?? "";
  const { onExecuteFromNode } = useContext(ProtoEditorContext);
  const { getEdges, getNodes } = useReactFlow();

  // Get model config for dynamic model parameters
  const currentModel = nodeInputs?.model;
  const { modelConfig } = useModelConfig(currentModel);

  // Extract variables from prompt ({{variable}} pattern)
  const dynamicVariables = useMemo(() => {
    if (!isAgentNode) return [];

    const variablePattern = /\{\{([^}]+)\}\}/g;
    const variables = [
      ...new Set(
        Array.from(prompt.matchAll(variablePattern), (m: RegExpMatchArray) =>
          m[1].trim(),
        ),
      ),
    ];

    return variables;
  }, [isAgentNode, prompt]);

  // Check if agent is outputting JSON with schema
  const outputType = nodeInputs?.output_type;
  const inlineSchema = nodeInputs?.json_schema;

  // Check if a schema is connected to the json_schema input
  const connectedSchema = useMemo(() => {
    if (!isAgentNode || outputType !== "json") return null;

    const edges = getEdges();
    const nodes = getNodes();

    // Find edge connecting to this node's json_schema input
    const schemaEdge = edges.find(
      (edge) => edge.target === id && edge.targetHandle === "json_schema",
    );

    if (schemaEdge) {
      // Find the source node (should be a ProtoSchemaNode)
      const sourceNode = nodes.find((node) => node.id === schemaEdge.source);
      if (
        sourceNode?.data?.nodeInputs as
          | NonNullable<ProtoSchemaNodeData["nodeInputs"]>
          | undefined
      ) {
        return (
          sourceNode?.data.nodeInputs as NonNullable<
            ProtoSchemaNodeData["nodeInputs"]
          >
        ).schema_definition;
      }
    }
    return null;
  }, [isAgentNode, outputType, id, getEdges, getNodes]);

  // Use connected schema if available, otherwise use inline schema
  const effectiveSchema = connectedSchema || inlineSchema;
  const isJsonOutput =
    isAgentNode && outputType === "json" && effectiveSchema?.properties;
  const schemaProperties = isJsonOutput
    ? Object.keys(effectiveSchema.properties)
    : [];

  const handleDelete = () => {
    // TODO: Implement delete functionality
    // console.log('Delete node:', id);
  };

  // Combine exposed inputs with dynamic variables and model parameters (remove duplicates)
  const allInputHandles = useMemo(() => {
    const exposedInputNames =
      nodeDef?.inputs?.filter((input) => exposedInputs.includes(input.name)) ||
      [];

    const handles: {
      name: string;
      isDynamic?: boolean;
      isModelParam?: boolean;
    }[] = [...exposedInputNames];
    const handleNames = new Set(exposedInputNames.map((input) => input.name));

    // For agent nodes, add dynamic variables as inputs
    if (isAgentNode && dynamicVariables.length > 0) {
      // Filter out variables that match exposed input names
      const uniqueVariables = dynamicVariables.filter(
        (varName) => !handleNames.has(varName),
      );

      uniqueVariables.forEach((varName) => {
        handles.push({
          name: varName,
          isDynamic: true,
        });
        handleNames.add(varName);
      });
    }

    // For agent nodes, add exposed model parameters as inputs
    if (isAgentNode && modelConfig?.valid_params) {
      const modelParamNames = Object.keys(modelConfig.valid_params);
      const exposedModelParams = exposedInputs.filter(
        (inputName) =>
          modelParamNames.includes(inputName) && !handleNames.has(inputName),
      );

      exposedModelParams.forEach((paramName) => {
        handles.push({
          name: paramName,
          isModelParam: true,
        });
        handleNames.add(paramName);
      });
    }

    return handles;
  }, [nodeDef, exposedInputs, isAgentNode, dynamicVariables, modelConfig]);

  // Check which handles are connected
  const edges = getEdges();
  const isHandleConnected = (
    handleId: string,
    handleType: "source" | "target",
  ) =>
    edges.some((edge) => {
      if (handleType === "target") {
        return edge.target === id && edge.targetHandle === handleId;
      } else {
        return edge.source === id && edge.sourceHandle === handleId;
      }
    });

  const handles = (
    <>
      {/* Input Handles - Exposed inputs + Dynamic variables + Model parameters */}
      {allInputHandles.map((input, idx: number) => {
        // Determine color based on input type
        let color = "#3b82f6"; // Default blue for regular inputs
        let labelColor = "#3b82f6";

        if (input.isDynamic) {
          color = "#f59e0b"; // Orange for dynamic variables
          labelColor = "#f59e0b";
        } else if (input.isModelParam) {
          color = "#8b5cf6"; // Purple for model parameters
          labelColor = "#8b5cf6";
        }

        return (
          <ProtoNodeHandle
            key={`input-${input.name}`}
            id={input.name}
            type="target"
            position={Position.Left}
            index={idx}
            totalCount={allInputHandles.length}
            color={color}
            label={input.name}
            labelColor={labelColor}
            isConnected={isHandleConnected(input.name, "target")}
          />
        );
      })}

      {/* Output Handles - Dynamic based on JSON schema if applicable */}
      {isJsonOutput
        ? schemaProperties.map((propName: string, idx: number) => (
            <ProtoNodeHandle
              key={`output-${propName}`}
              id={propName}
              type="source"
              position={Position.Right}
              index={idx}
              totalCount={schemaProperties.length}
              color="#10b981"
              label={propName}
              labelColor="#10b981"
              isConnected={isHandleConnected(propName, "source")}
            />
          ))
        : nodeDef?.outputs?.map((output, idx: number) => {
            const outputs = nodeDef?.outputs || [];
            return (
              <ProtoNodeHandle
                key={`output-${idx}`}
                id={output.name}
                type="source"
                position={Position.Right}
                index={idx}
                totalCount={outputs.length}
                color="#10b981"
                label={output.name}
                labelColor="#10b981"
                isConnected={isHandleConnected(output.name, "source")}
              />
            );
          })}
    </>
  );

  return (
    <ProtoNodeFrame
      selected={selected}
      color={NodeColor.STANDARD_BLUE}
      maxWidth={350}
      nodeId={id}
      handles={handles}
      className="flex flex-col gap-3 p-2"
    >
      <ProtoNodeHeader
        onExecute={() => onExecuteFromNode(id)}
        icon={isAgentNode ? "brain" : undefined}
        iconClassName={isAgentNode ? "h-4 w-4 text-blue-400" : undefined}
        title={label}
        actions={[
          {
            label: "Delete",
            icon: "trash-2",
            onClick: handleDelete,
          },
        ]}
      />

      {/* Show prompt preview for agent nodes */}
      {isAgentNode && prompt && typeof prompt === "string" ? (
        <div className="bg-node-input text-node-foreground max-h-24 overflow-y-auto rounded px-2 py-1.5 text-xs leading-relaxed">
          {prompt.length > 150 ? `${prompt.substring(0, 150)}...` : prompt}
        </div>
      ) : null}

      {isAgentNode && dynamicVariables.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-muted-foreground text-xs font-medium">
            Variables:
          </div>
          <div className="flex flex-wrap gap-1">
            {dynamicVariables.map((variable) => (
              <span
                key={variable}
                className="bg-node-input text-node-foreground rounded px-2 py-0.5 font-mono text-xs"
                style={{ borderLeft: "2px solid #f59e0b" }}
              >
                {`{{${variable}}}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer with execution metrics */}
      {(executionTime || tokenCount) && (
        <ProtoNodeFooter
          metrics={[
            ...(executionTime
              ? [{ label: "Time", value: `${executionTime}ms`, icon: "clock" }]
              : []),
            ...(tokenCount
              ? [{ label: "Tokens", value: tokenCount, icon: "hash" }]
              : []),
          ]}
        />
      )}
    </ProtoNodeFrame>
  );
});

ProtoNode.displayName = "ProtoNode";
