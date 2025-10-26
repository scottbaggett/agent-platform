/**
 * ProtoNodeFrame - Shared frame component for all proto nodes
 * Provides consistent structure with play button and optional resizer
 */

import { NodeResizer } from "@xyflow/react";
import { type ReactNode, type CSSProperties } from "react";
import { NodeColor } from "@/lib/nodeColors";

type ProtoNodeFrameProps = {
  selected: boolean;
  color?: NodeColor;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  width?: number;
  height?: number;
  nodeId: string;
  children: ReactNode;
  handles?: ReactNode;
  className?: string;
  style?: CSSProperties;
  resizable?: boolean;
  onResize?: (width: number, height: number) => void;
  onResizeEnd?: (width: number, height: number) => void;
};

export const ProtoNodeFrame = ({
  selected,
  color = NodeColor.STANDARD_BLUE,
  minWidth = 200,
  maxWidth,
  minHeight,
  maxHeight,
  width,
  height,
  children,
  handles,
  className = "",
  style = {},
  resizable = false,
  onResize,
  onResizeEnd,
}: ProtoNodeFrameProps) => (
  <div
    data-node-color={color}
    className={`bg-node shadow-node-border/20 rounded-lg border shadow-lg ${
      selected
        ? "border-node-border shadow-node-border/70"
        : "border-node-border/50"
    } ${className}`}
    style={{
      minWidth,
      maxWidth,
      minHeight,
      maxHeight,
      width,
      height,
      ...style,
    }}
  >
    {/* Handles */}
    {handles}

    {/* Node Resizer */}
    {resizable && selected && (
      <NodeResizer
        minWidth={minWidth}
        minHeight={minHeight}
        maxWidth={maxWidth}
        maxHeight={maxHeight}
        onResize={
          onResize
            ? (event, { width: newWidth, height: newHeight }) => {
                onResize(newWidth, newHeight);
              }
            : undefined
        }
        onResizeEnd={
          onResizeEnd
            ? (event, { width: newWidth, height: newHeight }) => {
                onResizeEnd(newWidth, newHeight);
              }
            : undefined
        }
        color="#3b82f6"
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: 2,
        }}
        lineStyle={{
          borderColor: "#3b82f6",
          borderWidth: 2,
        }}
      />
    )}

    {/* Content */}
    {children}
  </div>
);
