import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ShellState {
  // Sidebar
  sidebarOpen: boolean; // mobile: drawer open/closed
  sidebarCollapsed: boolean; // desktop: collapsed to icon-only rail

  // Active navigation
  activeNavItem: string | null; // route path of the currently highlighted nav item
}

interface ShellActions {
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;

  collapseSidebar: () => void;
  expandSidebar: () => void;
  toggleSidebarCollapsed: () => void;

  setActiveNavItem: (path: string | null) => void;
}

export const useShellStore = create<ShellState & ShellActions>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      sidebarCollapsed: false,
      activeNavItem: null,

      openSidebar: () => set({ sidebarOpen: true }),
      closeSidebar: () => set({ sidebarOpen: false }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      collapseSidebar: () => set({ sidebarCollapsed: true }),
      expandSidebar: () => set({ sidebarCollapsed: false }),
      toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setActiveNavItem: (path) => set({ activeNavItem: path }),
    }),
    {
      name: 'batac-dms:layout', // Keep existing localStorage key from old layout.store
      version: 1,
      // Persist ONLY sidebarCollapsed, per F2 Persistence Rules
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }) as any,
    },
  ),
);
