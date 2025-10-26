/**
 * ProtoNodeFooter - Unified footer component for all proto nodes
 * Shows execution metrics like tokens, time, etc.
 */

import { type ReactNode } from "react";
import { LucideIcon } from "@/components/icon/LucideIcon";

type ProtoNodeFooterMetric = {
  label: string;
  value: string | number;
  icon?: string;
};

type ProtoNodeFooterProps = {
  metrics?: ProtoNodeFooterMetric[];
  children?: ReactNode;
  className?: string;
};

export const ProtoNodeFooter = ({
  metrics = [],
  children,
  className = "",
}: ProtoNodeFooterProps) => {
  if (!metrics.length && !children) {
    return null;
  }

  return (
    <div
      className={`border-node-border text-node-foreground flex shrink-0 items-center gap-3 border-t px-2 py-2 text-xs ${className}`}
    >
      {/* Metrics */}
      {metrics.map((metric, idx) => {
        const Icon = metric.icon;
        return (
          <div key={idx} className="flex items-center gap-1.5">
            {Icon && <LucideIcon name={Icon} className="h-3 w-3 opacity-60" />}
            <span className="opacity-60">{metric.label}:</span>
            <span className="font-medium">{metric.value}</span>
          </div>
        );
      })}

      {/* Custom content */}
      {children}
    </div>
  );
};
