import * as React from 'react';
import { Bell } from 'lucide-react';
import { cn } from '@batac/ui/lib/utils';
import type { SidebarUser, BreadcrumbItem } from './types';
import { AvatarName } from '../ui/avatar';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem as UIBreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../ui/breadcrumb';

export interface TopbarProps {
  breadcrumbs: BreadcrumbItem[];
  /** Tracks sidebar width to adjust left offset (left-60 vs left-14) */
  sidebarCollapsed: boolean;
  notificationCount?: number;
  onNotificationClick?: () => void;
  currentUser: SidebarUser;
  onUserMenuAction?: (action: 'profile' | 'logout') => void;
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
        'border-border-default z-sticky duration-base ease-default fixed top-0 right-0 flex h-14 items-center justify-between gap-4 border-b bg-white px-6 transition-[left]',
        sidebarCollapsed ? 'left-14' : 'left-60',
      )}
    >
      {/* Left slot: Breadcrumb trail */}
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="text-text-muted flex-nowrap overflow-hidden text-sm">
          {breadcrumbs.map((item, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === breadcrumbs.length - 1;
            const isMiddle = !isFirst && !isLast;

            const itemClass = cn(
              'min-w-0 inline-flex items-center touch-exempt',
              isFirst
                ? 'flex-shrink-0'
                : isLast
                  ? 'flex-shrink min-w-[80px]'
                  : 'flex-shrink min-w-[32px] max-w-[80px] sm:max-w-[120px] lg:max-w-[200px]',
            );

            const textClass = cn('truncate block w-full');

            return (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <BreadcrumbSeparator className="text-text-disabled touch-exempt mx-1 flex-shrink-0">
                    /
                  </BreadcrumbSeparator>
                )}
                <UIBreadcrumbItem className={itemClass}>
                  {isLast ? (
                    <BreadcrumbPage
                      className={cn(
                        'text-text-primary touch-exempt pointer-events-none font-medium',
                        textClass,
                      )}
                    >
                      {item.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      href={item.href}
                      className={cn(
                        'text-text-muted hover:text-text-primary duration-fast touch-exempt transition-colors',
                        textClass,
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
      <div className="flex shrink-0 items-center gap-4">
        {/* Notification Bell */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onNotificationClick}
              aria-label="Notifications"
              className="text-text-secondary hover:text-text-primary focus-visible:outline-warning-500 touch-exempt relative flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <Bell className="h-5 w-5" />
              {notificationCount !== undefined && notificationCount > 0 ? (
                <span className="bg-danger-500 touch-exempt absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold text-white">
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
              className="focus-visible:outline-warning-500 touch-exempt flex items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <AvatarName name={currentUser.name} size="lg" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 bg-white p-2" aria-label="User account menu">
            <div className="px-2 py-1.5 select-none">
              <p className="text-text-primary truncate text-sm font-semibold">{currentUser.name}</p>
              <p className="text-text-muted truncate text-xs">{currentUser.role}</p>
            </div>
            <div className="bg-border-default my-1 h-px" />
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => onUserMenuAction?.('profile')}
                className="text-text-secondary hover:text-text-primary touch-exempt w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-neutral-100"
              >
                Profile
              </button>
              <button
                type="button"
                onClick={() => onUserMenuAction?.('logout')}
                className="text-danger-500 hover:bg-danger-50 hover:text-danger-700 touch-exempt w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors"
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
