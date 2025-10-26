/**
 * ProtoSchemaNode - Displays a JSON schema definition
 * Shows schema properties in a compact visual format
 */

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo, useContext } from "react";
import { NodeColor } from "@/lib/nodeColors";
import { ProtoEditorContext } from "./ProtoEditorContext";
import { ProtoNodeFrame } from "./ProtoNodeFrame";
import { ProtoNodeHeader } from "./ProtoNodeHeader";
import type { ProtoSchemaNodeData } from "./types";

export const ProtoSchemaNode = memo(({ data, selected, id }: NodeProps) => {
  const { label, nodeDef, nodeInputs } = data as ProtoSchemaNodeData;
  const schema = nodeInputs?.schema_definition || {};
  const properties = schema.properties || {};
  const propertyCount = Object.keys(properties).length;
  const { onExecuteFromNode } = useContext(ProtoEditorContext);

  const handleDelete = () => {
    // TODO: Implement delete functionality
    console.log("Delete node:", id);
  };

  const handles = (
    <Handle
      type="source"
      position={Position.Right}
      id="schema"
      style={{
        top: "50%",
        background: "#a855f7",
        width: "12px",
        height: "12px",
        border: "2px solid #1e293b",
      }}
    />
  );

  return (
    <ProtoNodeFrame
      selected={selected}
      color={NodeColor.STANDARD_PURPLE}
      maxWidth={300}
      nodeId={id}
      onExecute={onExecuteFromNode}
      handles={handles}
      className="flex flex-col gap-3 px-4 py-3"
    >
      <ProtoNodeHeader
        icon="braces"
        iconClassName="h-4 w-4 text-purple-400"
        title={label}
        subtitle={
          propertyCount > 0
            ? `${propertyCount} ${propertyCount === 1 ? "property" : "properties"}`
            : "No properties"
        }
        actions={[
          {
            label: "Delete",
            icon: "trash2",
            onClick: handleDelete,
          },
        ]}
      />

      {/* Schema name */}
      {schema.name && (
        <div className="text-node-foreground bg-node-input rounded px-2 py-1 font-mono text-xs">
          {schema.name}
        </div>
      )}

      {/* Property list (compact) */}
      {propertyCount > 0 && (
        <div className="flex max-h-32 flex-col gap-1 overflow-y-auto">
          {Object.entries(properties).map(([name, prop]) => (
            <div
              key={name}
              className="bg-node-input flex items-center gap-2 rounded px-2 py-1 text-xs"
            >
              <span className="text-node-foreground font-mono">{name}</span>
              <span className="text-node-foreground/50">:</span>
              <span className="text-[10px] text-purple-400 uppercase">
                {prop.type ?? "any"}
              </span>
            </div>
          ))}
        </div>
      )}
    </ProtoNodeFrame>
  );
});

ProtoSchemaNode.displayName = "ProtoSchemaNode";
