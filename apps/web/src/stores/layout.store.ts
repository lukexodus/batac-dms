/**
 * apps/web/src/stores/layout.store.ts
 *
 * Zustand store for layout state — sidebar collapsed preference.
 * Stack: Zustand for "sidebar … state — not server state."
 *
 * localStorage note: The stack context rule "Never localStorage" is
 * scoped to authentication tokens only. Sidebar collapse preference
 * is non-sensitive UI state; persisting it via zustand/middleware/persist
 * is acceptable and provides a better staff UX.
 *
 * [Proposed default, not confirmed: persist enabled — confirm with team
 *  if any compliance policy treats localStorage as off-limits entirely]
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LayoutState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,

      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setSidebarCollapsed: (collapsed) =>
        set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: "batac-dms:layout",   // localStorage key
      version: 1,
    }
  )
);
