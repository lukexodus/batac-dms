// packages/ui/src/components/domain/AppShell.tsx
import type { ReactNode } from 'react';
import { cn } from '@batac/ui/lib/utils';

export interface AppShellProps {
  children: ReactNode;
  /** Driven by apps/web useLayoutStore — passed as prop to keep packages/ui Zustand-free */
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  /** Rendered in the fixed left slot */
  sidebarContent: ReactNode;
  /** Rendered in the fixed top slot */
  topbarContent: ReactNode;
}

export function AppShell({
  children,
  sidebarCollapsed,
  sidebarContent,
  topbarContent,
}: AppShellProps) {
  return (
    <div className="bg-surface-raised min-h-screen">
      {/* Sidebar navigation slot */}
      <nav aria-label="Main navigation">{sidebarContent}</nav>

      {/* Topbar slot */}
      {topbarContent}

      {/* Main scrollable content area */}
      <main
        className={cn(
          'bg-surface-raised duration-base ease-default mt-14 min-h-screen overflow-y-auto transition-[margin-left]',
          sidebarCollapsed ? 'ml-14' : 'ml-60',
        )}
      >
        {children}
      </main>
    </div>
  );
}
