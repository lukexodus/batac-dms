import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@batac/ui/lib/utils';
import type { SidebarUser } from './types';
import { AvatarName } from '../ui/avatar';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Link } from 'react-router-dom';

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
  /** Optional callback triggered when a navigation item is clicked */
  onNavItemClick?: () => void;
  className?: string;
}

export function Sidebar({
  items,
  activeItemId,
  collapsed,
  onToggle,
  currentUser,
  onNavItemClick,
  className,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'bg-primary-950 z-sticky duration-base ease-default fixed top-0 left-0 flex h-screen flex-col transition-[width]',
        collapsed ? 'w-14' : 'w-60',
        className,
      )}
    >
      {/* Header / Brand & Toggle */}
      <div className="border-primary-900 flex h-14 shrink-0 items-center justify-between border-b px-3">
        {!collapsed ? (
          <span className="truncate pl-2 text-base font-semibold tracking-wide text-white select-none">
            Batac SP DMS
          </span>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'text-primary-200 hover:bg-primary-800 duration-fast focus-visible:outline-warning-500 inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
            collapsed && 'mx-auto',
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {items.map((item) => {
          const isActive = item.id === activeItemId;
          const isLink = Boolean(item.href) && !item.disabled;

          const sharedClassName = cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-fast focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning-500',
            isActive
              ? 'bg-primary-700 text-white font-semibold border-l-2 border-l-warning-500'
              : 'text-primary-200 hover:bg-primary-800 hover:text-white',
            item.disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
            collapsed && 'justify-center px-0 w-10 h-10 mx-auto',
          );

          const sharedChildren = (
            <>
              <item.icon className="h-5 w-5 shrink-0" />
              <span className={cn(collapsed ? 'sr-only' : 'truncate')}>{item.label}</span>
              {!collapsed && item.badge !== undefined && item.badge > 0 ? (
                <span className="bg-danger-500 touch-exempt ml-auto min-h-0 min-w-0 rounded-full px-1.5 py-0.5 text-xs font-medium text-white">
                  {item.badge}
                </span>
              ) : null}
            </>
          );

          const element = isLink ? (
            <Link
              to={item.href}
              aria-current={isActive ? 'page' : undefined}
              aria-label={collapsed ? item.label : undefined}
              tabIndex={item.disabled ? -1 : undefined}
              className={sharedClassName}
              onClick={onNavItemClick}
            >
              {sharedChildren}
            </Link>
          ) : (
            <button
              type="button"
              aria-current={isActive ? 'page' : undefined}
              aria-label={collapsed ? item.label : undefined}
              tabIndex={item.disabled ? -1 : undefined}
              className={sharedClassName}
              onClick={onNavItemClick}
            >
              {sharedChildren}
            </button>
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
          'border-primary-900 mt-auto flex shrink-0 items-center gap-3 border-t p-3',
          collapsed && 'justify-center',
        )}
      >
        <AvatarName name={currentUser.name} size="md" className="shrink-0" />
        {!collapsed ? (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-white">{currentUser.name}</span>
            <span className="text-primary-300 truncate text-xs">{currentUser.role}</span>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
