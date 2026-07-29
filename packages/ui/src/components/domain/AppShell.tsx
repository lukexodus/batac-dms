// packages/ui/src/components/domain/AppShell.tsx
import type { ReactNode } from 'react';
import { cn } from '@batac/ui/lib/utils';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../ui/sheet';

export interface AppShellProps {
  children: ReactNode;
  /** Driven by apps/web useLayoutStore — passed as prop to keep packages/ui Zustand-free */
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  /** Mobile drawer open state */
  sidebarOpen?: boolean;
  /** Mobile drawer open state change handler */
  onMobileSidebarChange?: (open: boolean) => void;
  /** Rendered in the fixed left slot (desktop) */
  sidebarContent: ReactNode;
  /** Rendered in the mobile drawer (defaults to sidebarContent if omitted) */
  sidebarContentMobile?: ReactNode;
  /** Rendered in the fixed top slot */
  topbarContent: ReactNode;
}

export function AppShell({
  children,
  sidebarCollapsed,
  sidebarOpen,
  onMobileSidebarChange,
  sidebarContent,
  sidebarContentMobile,
  topbarContent,
}: AppShellProps) {
  return (
    <div className="bg-surface-raised min-h-screen">
      {/* Sidebar navigation slot (Desktop) */}
      <nav aria-label="Main navigation">{sidebarContent}</nav>

      {/* Mobile Navigation Drawer */}
      {sidebarOpen !== undefined && onMobileSidebarChange && (
        <Sheet open={sidebarOpen} onOpenChange={onMobileSidebarChange}>
          <SheetContent
            side="left"
            className="bg-primary-950 border-r-primary-900 w-60 p-0 text-white [&>button]:text-white md:hidden"
          >
            <SheetTitle className="sr-only">Main Navigation</SheetTitle>
            <SheetDescription className="sr-only">Mobile navigation menu</SheetDescription>
            {sidebarContentMobile ?? sidebarContent}
          </SheetContent>
        </Sheet>
      )}

      {/* Topbar slot */}
      {topbarContent}

      {/* Main scrollable content area */}
      <main
        className={cn(
          'bg-surface-raised duration-base ease-default mt-14 min-h-[calc(100vh-3.5rem)] overflow-y-auto transition-[margin-left] ml-0',
          sidebarCollapsed ? 'md:ml-14' : 'md:ml-60',
        )}
      >
        {children}
      </main>
    </div>
  );
}
