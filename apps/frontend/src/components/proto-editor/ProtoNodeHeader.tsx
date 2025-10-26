/**
 * ProtoNodeHeader - Unified header component for all proto nodes
 * Provides consistent layout: icon > title > actions menu
 */

import { MoreVertical, Play } from "lucide-react";
import { type ReactNode } from "react";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ProtoNodeHeaderAction = {
  label: string;
  icon?: string;
  onClick: () => void;
};

type ProtoNodeHeaderProps = {
  onExecute: () => void;
  icon?: string;
  iconClassName?: string;
  title: string;
  subtitle?: string;
  actions?: ProtoNodeHeaderAction[];
  rightContent?: ReactNode;
  className?: string;
};

export const ProtoNodeHeader = ({
  onExecute,
  icon,
  title,
  subtitle,
  actions = [],
  rightContent,
  className = "",
}: ProtoNodeHeaderProps) => (
  <div
    className={`flex w-full items-center justify-between gap-2 ${className}`}
  >
    {/* Left side: Icon + Title */}
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="square bg-node-input text-node-foreground flex size-6 content-center items-center justify-center rounded-sm">
        {icon && <LucideIcon name={icon} className="size-4" />}
      </div>
      {/* {Icon && <Icon className={iconClassName} />} */}
      <div className="flex min-w-0 flex-col">
        <div className="text-foreground font-aeonik truncate text-lg font-medium">
          {title}
        </div>
        {subtitle && (
          <div className="text-foreground text-xxs truncate">{subtitle}</div>
        )}
      </div>
    </div>

    {/* Right side: Custom content + Actions menu */}
    <div className="flex shrink-0 items-center gap-1">
      {rightContent}

      {actions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="border-node-border hover:bg-node-input bg-node text-node-foreground size-7"
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExecute}>
              <Play className="text-success-8 mr-2 h-4 w-4" />
              Execute from here
            </DropdownMenuItem>
            {actions.map((action, idx) => (
              <DropdownMenuItem key={idx} onClick={action.onClick}>
                {action.icon && (
                  <LucideIcon name={action.icon} className="mr-2 h-4 w-4" />
                )}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  </div>
);
