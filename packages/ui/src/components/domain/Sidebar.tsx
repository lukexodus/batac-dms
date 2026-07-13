import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@batac/ui/lib/utils";
import type { SidebarUser } from "./types";
import { AvatarName } from "../ui/avatar";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { Link } from "react-router-dom";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  /** Unread count — renders as danger-500 pill per DESIGN.md §6.1 badge variant */
  badge?: number;
  disabled?: boolean;
}

export interface SidebarProps {
  items: NavItem[];
  activeItemId: string;
  collapsed: boolean;
  onToggle: () => void;
  currentUser: SidebarUser;
}

export function Sidebar({
  items,
  activeItemId,
  collapsed,
  onToggle,
  currentUser,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-primary-950 flex flex-col z-sticky transition-[width] duration-base ease-default",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* Header / Brand & Toggle */}
      <div className="flex h-14 items-center justify-between px-3 border-b border-primary-900 shrink-0">
        {!collapsed ? (
          <span className="font-semibold text-white text-base tracking-wide pl-2 select-none truncate">
            Batac SP DMS
          </span>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "inline-flex items-center justify-center h-8 w-8 rounded-md text-primary-200 hover:bg-primary-800 hover:text-white transition-colors duration-fast focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning-500",
            collapsed && "mx-auto"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 overflow-y-auto px-2 space-y-1">
        {items.map((item) => {
          const isActive = item.id === activeItemId;
          const Tag = (item.href && !item.disabled ? Link : "button") as any;
          const itemProps =
            Tag === Link
              ? { to: item.href }
              : { type: "button" as const };

          const element = (
            <Tag
              aria-current={isActive ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              tabIndex={item.disabled ? -1 : undefined}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-fast focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning-500",
                isActive
                  ? "bg-primary-700 text-white font-semibold border-l-2 border-l-warning-500"
                  : "text-primary-200 hover:bg-primary-800 hover:text-white",
                item.disabled && "opacity-40 cursor-not-allowed pointer-events-none",
                collapsed && "justify-center px-0 w-10 h-10 mx-auto"
              )}
              {...itemProps}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className={cn(collapsed ? "sr-only" : "truncate")}>
                {item.label}
              </span>
              {!collapsed && item.badge !== undefined && item.badge > 0 ? (
                <span className="ml-auto text-xs font-medium bg-danger-500 text-white rounded-full px-1.5 py-0.5 touch-exempt min-h-0 min-w-0">
                  {item.badge}
                </span>
              ) : null}
            </Tag>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>{element}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={12}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return <React.Fragment key={item.id}>{element}</React.Fragment>;
        })}
      </nav>

      {/* User profile section */}
      <div
        className={cn(
          "mt-auto p-3 border-t border-primary-900 flex items-center gap-3 shrink-0",
          collapsed && "justify-center"
        )}
      >
        <AvatarName name={currentUser.name} size="md" className="shrink-0" />
        {!collapsed ? (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-white truncate">
              {currentUser.name}
            </span>
            <span className="text-xs text-primary-300 truncate">
              {currentUser.role}
            </span>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
