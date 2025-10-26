/**
 * ProtoNodeHandle - Reusable handle component for proto nodes
 * Supports stacked vertical positioning with optional labels
 */

import { Handle, Position } from "@xyflow/react";

type ProtoNodeHandleProps = {
  id: string;
  type: "source" | "target";
  position: Position;
  index: number;
  totalCount: number;
  color: string;
  label?: string;
  labelColor?: string;
  spacing?: number;
  isConnected?: boolean;
};

export const ProtoNodeHandle = ({
  id,
  type,
  position,
  index,
  totalCount,
  color,
  label,
  labelColor,
  spacing = 20,
  isConnected = false,
}: ProtoNodeHandleProps) => {
  const offsetFromCenter = (index - (totalCount - 1) / 2) * spacing;
  const isLeft = position === Position.Left;
  const isRight = position === Position.Right;

  return (
    <>
      <Handle
        key={`handle-${id}`}
        type={type}
        position={position}
        id={id}
        style={{
          border: "none",
          top: `calc(50% + ${offsetFromCenter}px)`,
          [isLeft ? "left" : "right"]: "-6px",
          background: isConnected ? color : "transparent",
          width: "10px",
          height: "10px",
          outline: `2px solid ${color}`,
        }}
      />
      {/* Label */}
      {label && (
        <div
          key={`label-${id}`}
          className={`rounded p-0.5 px-1.5 text-black`}
          style={{
            position: "absolute",
            background: color,
            [isLeft ? "left" : "right"]: "-15px",
            top: `calc(50% + ${offsetFromCenter}px)`,
            transform: isLeft
              ? "translate(-100%, -50%)"
              : "translate(100%, -50%)",
            fontSize: "9px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            [isLeft ? "paddingRight" : "paddingLeft"]: "6px",
            fontWeight: 500,
          }}
        >
          {label}
        </div>
      )}
    </>
  );
};
