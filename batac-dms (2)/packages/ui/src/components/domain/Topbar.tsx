import * as React from "react";
import { Bell } from "lucide-react";
import { cn } from "@batac/ui/lib/utils";
import type { SidebarUser, BreadcrumbItem } from "./types";
import { AvatarName } from "../ui/avatar";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem as UIBreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";

export interface TopbarProps {
  breadcrumbs: BreadcrumbItem[];
  /** Tracks sidebar width to adjust left offset (left-60 vs left-14) */
  sidebarCollapsed: boolean;
  notificationCount?: number;
  onNotificationClick?: () => void;
  currentUser: SidebarUser;
  onUserMenuAction?: (action: "profile" | "logout") => void;
}

export function Topbar({
  breadcrumbs,
  sidebarCollapsed,
  notificationCount,
  onNotificationClick,
  currentUser,
  onUserMenuAction,
}: TopbarProps) {
  return (
    <header
      className={cn(
        "fixed top-0 right-0 h-14 bg-white border-b border-border-default flex items-center justify-between px-6 gap-4 z-sticky transition-[left] duration-base ease-default",
        sidebarCollapsed ? "left-14" : "left-60"
      )}
    >
      {/* Left slot: Breadcrumb trail */}
      <Breadcrumb className="flex-1 min-w-0">
        <BreadcrumbList className="flex-nowrap overflow-hidden text-sm text-text-muted">
          {breadcrumbs.map((item, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === breadcrumbs.length - 1;
            const isMiddle = !isFirst && !isLast;

            const itemClass = cn(
              "min-w-0 inline-flex items-center touch-exempt",
              isFirst 
                ? "flex-shrink-0" 
                : isLast 
                ? "flex-shrink min-w-[80px]" 
                : "flex-shrink min-w-[32px] max-w-[80px] sm:max-w-[120px] lg:max-w-[200px]"
            );

            const textClass = cn(
              "truncate block w-full"
            );

            return (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <BreadcrumbSeparator className="text-text-disabled mx-1 touch-exempt flex-shrink-0">
                    /
                  </BreadcrumbSeparator>
                )}
                <UIBreadcrumbItem className={itemClass}>
                  {isLast ? (
                    <BreadcrumbPage
                      className={cn(
                        "font-medium text-text-primary pointer-events-none touch-exempt",
                        textClass
                      )}
                    >
                      {item.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      href={item.href}
                      className={cn(
                        "text-text-muted hover:text-text-primary transition-colors duration-fast touch-exempt",
                        textClass
                      )}
                    >
                      {item.label}
                    </BreadcrumbLink>
                  )}
                </UIBreadcrumbItem>
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Right slot: Actions */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Notification Bell */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onNotificationClick}
              aria-label="Notifications"
              className="relative flex items-center justify-center h-10 w-10 rounded-md text-text-secondary hover:text-text-primary hover:bg-neutral-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning-500 touch-exempt"
            >
              <Bell className="h-5 w-5" />
              {notificationCount !== undefined && notificationCount > 0 ? (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white leading-none touch-exempt">
                  {notificationCount}
                </span>
              ) : null}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="center">
            Notifications
          </TooltipContent>
        </Tooltip>

        {/* User Account Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="User account menu"
              className="flex items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning-500 touch-exempt"
            >
              <AvatarName name={currentUser.name} size="lg" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-56 p-2 bg-white"
            aria-label="User account menu"
          >
            <div className="px-2 py-1.5 select-none">
              <p className="text-sm font-semibold text-text-primary truncate">
                {currentUser.name}
              </p>
              <p className="text-xs text-text-muted truncate">
                {currentUser.role}
              </p>
            </div>
            <div className="h-px bg-border-default my-1" />
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => onUserMenuAction?.("profile")}
                className="w-full text-left px-2 py-1.5 text-sm text-text-secondary hover:bg-neutral-100 hover:text-text-primary rounded-md transition-colors touch-exempt"
              >
                Profile
              </button>
              <button
                type="button"
                onClick={() => onUserMenuAction?.("logout")}
                className="w-full text-left px-2 py-1.5 text-sm text-danger-500 hover:bg-danger-50 hover:text-danger-700 rounded-md transition-colors touch-exempt"
              >
                Logout
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
