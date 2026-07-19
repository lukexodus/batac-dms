/**
 * apps/web/src/stores/ui.store.ts
 *
 * Zustand store for UI overlay state — modals, sheets, command palette, toasts.
 * Stack: Zustand for "modals, sidebar, multi-step form state — not server state."
 *
 * Pattern: Stateless shadcn Dialog/Sheet primitives in @batac/ui receive
 * open/onOpenChange from this store at the page level.
 * No component in packages/ui manages its own open state.
 */
import { create } from 'zustand';

/* ── Toast ────────────────────────────────────────────────── */

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastState {
  open: boolean;
  variant: ToastVariant;
  title: string;
  body?: string | undefined;
}

/* ── Full store shape ─────────────────────────────────────── */

interface UIState {
  /** Document detail side panel */
  sheetOpen: boolean;
  sheetDocId: string | null;

  /** Workflow advance confirmation dialog */
  dialogOpen: boolean;
  dialogDocId: string | null;

  /** Command palette */
  paletteOpen: boolean;

  /** Idle-session warning modal */
  idleWarningOpen: boolean;

  /** Global toast notification (Sonner is called imperatively;
      this tracks whether a persistent alert banner is shown) */
  toast: ToastState;

  /* ── Actions ─────────────────────────────────────────────── */

  openSheet: (docId: string) => void;
  closeSheet: () => void;

  openDialog: (docId: string) => void;
  closeDialog: () => void;

  openPalette: () => void;
  closePalette: () => void;

  openIdleWarning: () => void;
  closeIdleWarning: () => void;

  showToast: (variant: ToastVariant, title: string, body?: string) => void;
  dismissToast: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sheetOpen: false,
  sheetDocId: null,

  dialogOpen: false,
  dialogDocId: null,

  paletteOpen: false,
  idleWarningOpen: false,

  toast: {
    open: false,
    variant: 'info',
    title: '',
  },

  openSheet: (docId) => set({ sheetOpen: true, sheetDocId: docId }),
  closeSheet: () => set({ sheetOpen: false, sheetDocId: null }),

  openDialog: (docId) => set({ dialogOpen: true, dialogDocId: docId }),
  closeDialog: () => set({ dialogOpen: false, dialogDocId: null }),

  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),

  openIdleWarning: () => set({ idleWarningOpen: true }),
  closeIdleWarning: () => set({ idleWarningOpen: false }),

  showToast: (variant, title, body) =>
    set({ toast: { open: true, variant, title, ...(body !== undefined && { body }) } }),
  dismissToast: () => set((s) => ({ toast: { ...s.toast, open: false } })),
}));
