#!/usr/bin/env bash
# =============================================================================
# batac-dms — Design System & Component Install Commands
# Run from monorepo root. All commands use pnpm workspaces.
# =============================================================================

# ── Step 1: Core package-level dependencies ───────────────────────────────────
# These go into packages/ui itself.

pnpm add \
  clsx \
  tailwind-merge \
  class-variance-authority \
  @radix-ui/react-slot \
  lucide-react \
  sonner \
  date-fns \
  --filter @batac/ui

# ── Step 2: shadcn/ui component install ──────────────────────────────────────
# Install all components confirmed from kitchen-sink.jsx variant audit.
# CLI runs with --cwd packages/ui so components install into packages/ui.

pnpm dlx shadcn@latest add --cwd packages/ui \
  button \
  card \
  input \
  textarea \
  label \
  separator \
  skeleton \
  avatar \
  badge \
  dialog \
  sheet \
  tabs \
  tooltip \
  table \
  alert \
  command \
  popover \
  select \
  checkbox \
  calendar \
  chart \
  breadcrumb \
  sonner

# NOTE: After running the above, REPLACE these generated files with the
# customized versions from the design system setup:
#   - packages/ui/src/components/ui/button.tsx  → (custom CVA: primary alias, ghost-danger, xs size)
#   - packages/ui/src/components/ui/tabs.tsx    → (custom CVA: underline variant)
#   - packages/ui/src/components/ui/avatar.tsx  → (custom CVA: sm/md/lg sizes + AvatarName)

# ── Step 3: App-level dependencies ────────────────────────────────────────────

# apps/web — internal SPA (Vite + React)
pnpm add \
  zustand \
  @tanstack/react-query \
  @tanstack/react-table \
  @tanstack/react-virtual \
  @trpc/react-query \
  @trpc/client \
  react-hook-form \
  @hookform/resolvers \
  zod \
  react-pdf \
  recharts \
  --filter @batac/web

# apps/portal — public citizen portal (Next.js, Phase 3)
pnpm add \
  @tanstack/react-query \
  zod \
  --filter @batac/portal

# ── Step 4: Dev dependencies (monorepo root or packages/ui) ──────────────────

pnpm add -D \
  tailwindcss \
  @types/node \
  typescript \
  --filter @batac/ui

# ── Step 5: Sonner ToastProvider setup ───────────────────────────────────────
# Add to apps/web/src/main.tsx (or root provider):
#
# RESOLVED [A1 UI module pass, human-authorized]: position is bottom-right, per
# DESIGN.md §6.5 ("Position: Bottom-right (bottom-4 right-4). Duration: 5s
# auto-dismiss."), which is the deliberate, specific design-system decision.
# This script previously showed "top-right" as an example value — that was
# never DESIGN.md's stated position and is corrected below.
#
#   import { Toaster } from "sonner";
#   // ...
#   <Toaster
#     position="bottom-right"
#     duration={5000}
#     toastOptions={{
#       classNames: {
#         success: "bg-success-100 text-success-900 border border-success-500",
#         error:   "bg-danger-100 text-danger-900 border border-danger-500",
#         warning: "bg-warning-100 text-warning-900 border border-warning-500",
#         info:    "bg-info-100 text-info-900 border border-info-500",
#       },
#     }}
#   />
#
# Imperative usage (replaces kitchen-sink.jsx custom Toast):
#   import { toast } from "sonner";
#   toast.success("Workflow step completed", {
#     description: "7SP 2026-001 transmitted to Office of the Mayor.",
#   });

# ── Step 6: Tooltip provider setup ───────────────────────────────────────────
# Wrap apps/web/src/main.tsx with TooltipProvider and set delayDuration:
#
#   import { TooltipProvider } from "@batac/ui/components/ui/tooltip";
#   // ...
#   <TooltipProvider delayDuration={500}>  {/* DESIGN.md §6.5: 500ms delay */}
#     <App />
#   </TooltipProvider>

# ── Step 7: TanStack Query client setup ──────────────────────────────────────
# tRPC v11 uses TanStack Query as its data layer (stack context).
# Set up QueryClient in apps/web/src/lib/query-client.ts:
#
#   import { QueryClient } from "@tanstack/react-query";
#   export const queryClient = new QueryClient({
#     defaultOptions: {
#       queries: {
#         staleTime: 60_000,
#         retry: 1,
#       },
#     },
#   });

echo "Install complete. Replace button.tsx, tabs.tsx, and avatar.tsx with customized versions."
