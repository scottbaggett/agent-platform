/**
 * ProtoDynamicTextNode - Node for composing text with variable interpolation
 * Supports {{variable}} syntax for inserting values from connected nodes
 */

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo, useContext } from "react";
import { NodeColor } from "@/lib/nodeColors";
import { ProtoEditorContext } from "./ProtoEditorContext";
import { ProtoNodeFooter } from "./ProtoNodeFooter";
import { ProtoNodeFrame } from "./ProtoNodeFrame";
import { ProtoNodeHeader } from "./ProtoNodeHeader";
import type { ProtoDynamicTextNodeData } from "./types";

export const ProtoDynamicTextNode = memo(
  ({ data, selected, id }: NodeProps) => {
    const { label, nodeInputs, executionTime, output } = data as ProtoDynamicTextNodeData;
    const text = nodeInputs?.text ?? "";
    const { onExecuteFromNode } = useContext(ProtoEditorContext);

    const handleDelete = () => {
      // TODO: Implement delete functionality
      console.log("Delete node:", id);
    };

    // Extract variables from text ({{variable}} pattern)
    const variablePattern = /\{\{([^}]+)\}\}/g;
    const variables = [
      ...new Set(
        Array.from(text.matchAll(variablePattern), (m) => m[1].trim()),
      ),
    ];

    const handles = (
      <>
        {/* Dynamic input handles based on variables in text */}
        {variables.map((variable, idx) => (
          <div
            key={`input-wrapper-${variable}`}
            style={{ position: "relative" }}
          >
            <Handle
              type="target"
              position={Position.Left}
              id={variable}
              style={{
                top: `${((idx + 1) * 100) / (variables.length + 1)}%`,
                background: "#3b82f6",
                width: "12px",
                height: "12px",
                border: "2px solid #1e293b",
              }}
            />
            {/* Variable label */}
            <div
              style={{
                position: "absolute",
                left: "-4px",
                top: `${((idx + 1) * 100) / (variables.length + 1)}%`,
                transform: "translate(-100%, -50%)",
                fontSize: "10px",
                color: "#94a3b8",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                paddingRight: "4px",
              }}
            >
              {variable}
            </div>
          </div>
        ))}

        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{
            top: "50%",
            background: "#10b981",
            width: "12px",
            height: "12px",
            border: "2px solid #1e293b",
          }}
        />
      </>
    );

    return (
      <ProtoNodeFrame
        selected={selected}
        color={NodeColor.STANDARD_ORANGE}
        maxWidth={400}
        nodeId={id}
        handles={handles}
        className="flex flex-col gap-3 px-4 py-3"
      >
        <ProtoNodeHeader
          onExecute={() => onExecuteFromNode(id)}
          icon="type"
          iconClassName="h-4 w-4 text-orange-400"
          title={label}
          subtitle={
            variables.length > 0
              ? `${variables.length} ${variables.length === 1 ? "variable" : "variables"}`
              : "No variables"
          }
          actions={[
            {
              label: "Delete",
              icon: "trash2",
              onClick: handleDelete,
            },
          ]}
        />

        {/* Text preview */}
        {text && (
          <div className="bg-node-input text-node-foreground max-h-32 overflow-y-auto rounded px-3 py-2 font-mono text-xs leading-relaxed">
            {text.length > 200 ? `${text.substring(0, 200)}...` : text}
          </div>
        )}

        {/* Variables list */}
        {variables.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-muted-foreground text-xs font-medium">
              Variables:
            </div>
            <div className="flex flex-wrap gap-1">
              {variables.map((variable) => (
                <span
                  key={variable}
                  className="bg-node-input text-node-foreground rounded px-2 py-0.5 font-mono text-xs"
                >
                  {`{{${variable}}}`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Output preview */}
        {output && (
          <div className="border-node-border rounded border p-2">
            <div className="text-muted-foreground mb-1 text-xs font-medium">
              Output:
            </div>
            <div className="text-node-foreground max-h-24 overflow-y-auto font-mono text-xs leading-relaxed">
              {output}
            </div>
          </div>
        )}

        {/* Footer with execution metrics */}
        {(executionTime || output) && (
          <ProtoNodeFooter
            metrics={[
              ...(executionTime
                ? [
                    {
                      label: "Time",
                      value: `${executionTime}ms`,
                      icon: "clock",
                    },
                  ]
                : []),
              ...(output
                ? [{ label: "Length", value: output.length, icon: "hash" }]
                : []),
            ]}
          />
        )}
      </ProtoNodeFrame>
    );
  },
);

ProtoDynamicTextNode.displayName = "ProtoDynamicTextNode";
