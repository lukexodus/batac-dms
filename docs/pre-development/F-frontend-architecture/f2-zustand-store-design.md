# F2. Zustand Store Design — Pre-dev

**Document ID:** F2
**Type:** Frontend UI-state design — `/apps/web`, Phase 1
**Status:** DRAFT — pre-development proposal, not yet reviewed or approved
**Date:** June 2026
**Based on:**
- F1 — `f1-application-route-map.md`
- E3 — `e3-shared-zod-schema-catalog.md`
- Stack Context — `2-stack-context.md`
- Consolidated Architecture & Requirements Reference Iteration 3 — `consolidated-architecture-and-requirements-reference-iteration-3.md`

**Audience:** Frontend development team; cross-referenced by any developer wiring a modal, drawer, sidebar, multi-step form, or notification surface in `/apps/web`

> **Notation note:** This document applies the same inference tagging used in F1. `[Confirmed — source]` means directly traceable to a named section of a source document. `[Inference]` means a reasonable conclusion drawn from confirmed facts. `[Speculation]` means an unconfirmed possibility raised because source material is silent. Every store design, slice boundary, and state shape decision not explicitly required by the source material is individually tagged at the point it is made. Read this document as a draft for team review, not as approved architecture.

---

## Table of Contents

1. [The Zustand / TanStack Query boundary](#1-the-zustand--tanstack-query-boundary)
2. [Store inventory](#2-store-inventory)
3. [File structure](#3-file-structure)
4. [Store 1 — `useShellStore` (sidebar, global layout)](#4-store-1--useshellstore)
5. [Store 2 — `useSessionStore` (active auth context)](#5-store-2--usesessionstore)
6. [Store 3 — `useModalStore` (global modal stack)](#6-store-3--usemodalstore)
7. [Store 4 — `useNotificationDrawerStore` (SSE-pushed notifications)](#7-store-4--usenotificationdrawerstore)
8. [Store 5 — `useDocumentIntakeStore` (multi-step document intake form)](#8-store-5--usedocumentintakestore)
9. [Store 6 — `useWorkflowActionStore` (step-action panel transient state)](#9-store-6--useworkflowactionstore)
10. [Store 7 — `useComplaintIntakeStore` (clerk-assisted complaint intake)](#10-store-7--usecomplaintintakestore)
11. [Store 8 — `useDocumentRequestIntakeStore` (clerk-assisted document request intake)](#11-store-8--usedocumentrequestintakestore)
12. [Store 9 — `useQrScannerStore` (QR scan overlay)](#12-store-9--useqrscannerstore)
13. [Store 10 — `useOrderOfBusinessStore` (session scheduling)](#13-store-10--useorderofbusinessstore)
14. [Store 11 — `useAttendanceStore` (session attendance recording)](#14-store-11--useattendancestore)
15. [Cross-store interaction rules](#15-cross-store-interaction-rules)
16. [Persistence rules](#16-persistence-rules)
17. [Testing guidance](#17-testing-guidance)
18. [Known gaps and open questions](#18-known-gaps-and-open-questions)

---

---

## 1. The Zustand / TanStack Query Boundary

`[Confirmed — Stack Context: "UI state (frontend): Zustand — Modals, sidebar, multi-step form state — not server state"]`

This boundary is the most important constraint in this document. Violating it creates duplicated truth, stale data, and cache bugs that are extremely hard to reproduce. The rule is stated once here and applies to every store in this document without exception:

**Zustand owns UI state. TanStack Query owns server state.**

| Belongs in Zustand | Belongs in TanStack Query |
|---|---|
| Modal open/closed | Document list results |
| Which modal is showing and its local payload | Workflow instance data |
| Sidebar collapsed/expanded | Session attendance records |
| Multi-step form current step index | Notification event list |
| Multi-step form draft field values (pre-submit) | User profile |
| Active auth session identity (decoded from cookie on login) | Role assignments |
| Notification drawer open/closed | SSE-delivered notification payloads (after receipt) |
| QR scanner overlay open/closed | Committee list |
| Upload progress percentage (transient UI feedback) | Dashboard aggregates |
| Step-action panel which sub-panel is showing | Order of Business items |
| Attendance recording buffer before batch submission | Panlalawigan review status |

`[Inference]` The SSE connection itself is a special case: the server pushes `NotificationEvent` payloads (E3 Part 9) via SSE. The notification *list* — the full, persisted, paginated set of notifications — belongs in TanStack Query via `notifications.listMine`. The *drawer open/closed state* and the *unread count badge* (an ephemeral UI counter incremented on each incoming SSE event before the user opens the drawer) belong in Zustand. When the user opens the drawer, TanStack Query takes over and the Zustand unread counter is reset. This split is the correct design; it is elaborated in Store 4.

`[Inference]` Active auth identity (user ID, display name, role codes, office scope) is decoded from the initial login response and kept in Zustand for synchronous access in guards, headers, and ABAC checks without triggering a network round-trip. It is not a cache of server state — it is the single decoded representation of the session that arrived via HTTP-only cookie + `AuthResponseSchema`. When the cookie expires or is invalidated, the store is cleared and the user is redirected to login. TanStack Query is not used for this because ABAC guards need synchronous reads inside route protection logic.

---

## 2. Store Inventory

| # | Store | Primary concern |
|---|---|---|
| 1 | `useShellStore` | App shell layout: sidebar open/collapsed, active nav item |
| 2 | `useSessionStore` | Decoded auth identity for the active authenticated user |
| 3 | `useModalStore` | Global modal stack: which modal is open, its payload |
| 4 | `useNotificationDrawerStore` | Notification drawer open/closed; ephemeral unread counter |
| 5 | `useDocumentIntakeStore` | Multi-step document intake form (log a new document) |
| 6 | `useWorkflowActionStore` | Transient state for the workflow step action panel |
| 7 | `useComplaintIntakeStore` | Clerk-assisted complaint intake multi-step form |
| 8 | `useDocumentRequestIntakeStore` | Clerk-assisted document request intake multi-step form |
| 9 | `useQrScannerStore` | QR scan overlay open/closed and last scan result |
| 10 | `useOrderOfBusinessStore` | Pending scheduling changes before committing to server |
| 11 | `useAttendanceStore` | Attendance-recording buffer for one session |

---

## 3. File Structure

`[Inference]` Stores live inside `/apps/web` only. No Zustand store is shared via `/packages/shared` — `/packages/shared` holds Zod schemas and TypeScript types, not runtime state. `[Confirmed — Stack Context monorepo structure]`

```
/apps/web/src/
  stores/
    shell.store.ts
    session.store.ts
    modal.store.ts
    notification-drawer.store.ts
    document-intake.store.ts
    workflow-action.store.ts
    complaint-intake.store.ts
    document-request-intake.store.ts
    qr-scanner.store.ts
    order-of-business.store.ts
    attendance.store.ts
    index.ts              ← barrel re-export of all hooks
```

Each file exports exactly one named hook (e.g. `useShellStore`). The barrel `index.ts` re-exports all hooks so import paths are uniform across the app.

`[Inference]` Stores do not call each other's setters directly. Cross-store coordination (e.g. opening a modal from within another modal's action) is done in component event handlers or custom hooks that import both stores, never by one store importing another. This keeps stores independent and unit-testable in isolation.

---

## 4. Store 1 — `useShellStore`

**Concern:** App shell layout — sidebar visibility, collapsed state, and the active top-level navigation item. `[Confirmed — Stack Context: "UI state (frontend): Zustand — Modals, sidebar, multi-step form state"]`

### State shape

```typescript
interface ShellState {
  // Sidebar
  sidebarOpen: boolean;         // mobile: drawer open/closed
  sidebarCollapsed: boolean;    // desktop: collapsed to icon-only rail

  // Active navigation
  activeNavItem: string | null; // route path of the currently highlighted nav item
                                // e.g. "/secretary", "/documents", "/workflow/steps"
}
```

### Actions

```typescript
interface ShellActions {
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;

  collapseSidebar: () => void;
  expandSidebar: () => void;
  toggleSidebarCollapsed: () => void;

  setActiveNavItem: (path: string | null) => void;
}
```

### Usage notes

`[Inference]` `sidebarOpen` controls the mobile sheet/drawer variant of the sidebar (shadcn `Sheet` component). `sidebarCollapsed` controls the desktop rail variant. They are independent: on desktop the sidebar can be expanded or collapsed but is never "closed"; on mobile it is always in sheet mode and `sidebarCollapsed` is irrelevant.

`[Inference]` `setActiveNavItem` is called by the router's `onRouteChange` effect, not by clicking nav items directly. This ensures the active state is correct even on direct URL navigation or browser back/forward.

### What does NOT go here

`[Confirmed — boundary rule §1]` User display name, role, and office — those are in `useSessionStore`. Notification count badge — that is in `useNotificationDrawerStore`.

---

## 5. Store 2 — `useSessionStore`

**Concern:** The decoded identity of the currently authenticated user, available synchronously to all route guards, ABAC checks, and UI rendering decisions throughout the app.

`[Confirmed — Stack Context auth pattern: "Short-lived JWT + server-side refresh tokens + HTTP-only cookies — Never localStorage"]`
`[Confirmed — E3 Part 2: `AuthResponseSchema` carries `user: UserSelectSchema`, `sessionId: UuidSchema`, `expiresAt: TimestampSchema`]`
`[Confirmed — Consolidated Reference Part 11.1: auth token delivered via HTTP-only cookies; PKCE for the SPA]`
`[Confirmed — F1 §2.2: role codes list; roles determine gate access throughout the route map]`

### State shape

```typescript
// Mirrors the identity payload from AuthResponseSchema (E3 Part 2)
// plus the role/office data resolved after login
interface ActiveUserIdentity {
  userId: string;                      // UUID
  username: string;
  displayName: string;                 // computed from employee first+last, or username fallback
  sessionId: string;                   // UUID from AuthResponseSchema
  expiresAt: string;                   // ISO 8601; used to detect expiry client-side
  roleCodes: string[];                 // e.g. ["sp_secretary"], ["dept_encoder"], etc.
  officeScopeId: string | null;        // UUID of the office this role is scoped to
  officeCode: string | null;           // e.g. "SP_SEC", for display in headers
}

interface SessionState {
  identity: ActiveUserIdentity | null; // null = unauthenticated
  isHydrated: boolean;                 // true once the store has checked initial session
                                       // (prevents flash-of-unauthenticated on mount)
}
```

### Actions

```typescript
interface SessionActions {
  setIdentity: (identity: ActiveUserIdentity) => void;
  clearIdentity: () => void;           // called on logout or session expiry
  setHydrated: () => void;             // called once on app mount after initial auth check
}
```

### Usage notes

`[Inference]` On app mount, `/apps/web` calls the auth check endpoint (a tRPC `iam.getCurrentUser` call, or a lightweight ping that returns 401 if the cookie is absent or expired). If the cookie is valid, the response is used to populate `setIdentity`. If not, `clearIdentity` is called and the user is redirected to login. `setHydrated` is called in both cases so route guards know the check is complete — guards must not run before `isHydrated` is true or they will incorrectly redirect on every page load.

`[Confirmed — F1 §2.2]` Role access checks throughout F1 are expressed as role-code comparisons. The `roleCodes` array in `identity` is the single source of truth for these checks in the frontend. A utility function `hasRole(store.identity, 'sp_secretary')` is the recommended pattern — not inline string comparisons scattered across components.

`[Inference]` The store does NOT hold a full `UserSelectSchema` object. It holds only what is needed for synchronous identity checks. The full user profile (email, status, MFA enabled, etc.) is fetched by TanStack Query via `iam.getCurrentUser` when a profile page or settings view needs it.

`[Confirmed — Consolidated Reference Part 11.17: "New login from different device logs out previous session; notification sent to user"]` If the server returns 401 mid-session (session force-terminated by IT admin, or a new login from another device), the TanStack Query error handler calls `clearIdentity` and redirects to the login screen.

### What does NOT go here

`[Confirmed — boundary rule §1]` Role definition objects, permission matrices, full user profile fields. Those are server state fetched by TanStack Query.

---

## 6. Store 3 — `useModalStore`

**Concern:** A global modal stack so that any component anywhere in the tree can open a named modal with a typed payload, without prop drilling or context threading. `[Confirmed — Stack Context: "UI state (frontend): Zustand — Modals"]`

### Modal registry

`[Inference]` Modal names are a TypeScript discriminated union. Each modal variant carries its own payload type. Adding a new modal requires adding a new variant here, which keeps the registry auditable and prevents stray string-keyed modal opens with unverifiable payloads.

```typescript
// Modal payload union — each variant is a separate modal surface in the app
type ModalPayload =
  | { type: "CONFIRM_ACTION";        title: string; message: string; onConfirm: () => void; onCancel?: () => void; }
  | { type: "CANCEL_DOCUMENT";       documentId: string; documentTitle: string; }
  | { type: "ASSIGN_FINAL_NUMBER";   documentId: string; preliminaryNumber: string; }
  | { type: "LOG_SIGNATURE";         documentId: string; signatureType: string; }  // SignatureTypeSchema values
  | { type: "LOG_SECRETARIAT_DECISION"; documentId: string; stepInstanceId: string; }
  | { type: "UPLOAD_NEW_VERSION";    documentId: string; }
  | { type: "UPLOAD_ATTACHMENT";     documentId: string; attachmentType: string; }  // AttachmentTypeSchema values
  | { type: "LOG_CERTIFICATION_OF_URGENCY"; stepInstanceId: string; }
  | { type: "PANLALAWIGAN_OUTCOME";  documentId: string; reviewId: string; }
  | { type: "BYPASS_MULTI_REFERRAL"; stepInstanceId: string; }
  | { type: "REVOKE_DELEGATION";     delegationGrantId: string; delegatedToDisplayName: string; }
  | { type: "CONFIRM_BULK_ARCHIVE";  documentIds: string[]; previewItemCount: number; }
  | { type: "PLACE_LEGAL_HOLD";      documentId: string; }
  | { type: "REMOVE_LEGAL_HOLD";     documentId: string; }
  | { type: "PRINT_QR_COVER_SHEET";  documentId: string; trackingNumber: string; }
  | { type: "OCR_RESCAN_PROMPT";     documentId: string; versionId: string; qualityCategory: "fair" | "poor"; }
  | { type: "SESSION_TIMEOUT_WARNING"; secondsRemaining: number; }
  ;
```

### State shape

```typescript
interface ModalState {
  // Stack allows a modal to open another modal (e.g. a confirmation modal on top of an action modal)
  // In practice, the stack rarely exceeds depth 2.
  stack: ModalPayload[];
}
```

### Actions

```typescript
interface ModalActions {
  openModal: (payload: ModalPayload) => void;
  closeModal: () => void;              // pops the top of the stack
  closeAllModals: () => void;          // clears the entire stack
  replaceModal: (payload: ModalPayload) => void; // replaces the top item (prevents flash)
}
```

### Usage notes

`[Inference]` The root `App` component renders a single `<ModalRenderer />` component that reads `stack[stack.length - 1]` (the top modal) and renders the appropriate modal component. All modal components are lazy-loaded since most are never opened in any given session.

`[Inference]` `CONFIRM_ACTION` is the generic "are you sure?" modal and is reused everywhere. Destructive actions (cancel document, revoke delegation, bulk archive) always go through `CONFIRM_ACTION` before executing the mutation.

`[Confirmed — Consolidated Reference Part 11.12: "Pessimistic locking — lock timeout 15 minutes — User sees informational notice when document is locked by another user"]` The lock-notification UI is handled by an inline TanStack Query error surface on the document detail page, not by a modal — modals are reserved for user-initiated actions, not read-time errors. `[Inference]`

`[Confirmed — Consolidated Reference Part 11.17: "Standard timeout 30 minutes of inactivity — Timeout warning at 25 minutes"]` `SESSION_TIMEOUT_WARNING` opens at the 25-minute inactivity threshold and is closed by user activity or by `closeAllModals` when the session is extended. This modal is opened by the session timeout watcher, not by any user action.

`[Confirmed — E3 Part 4, `ScanQualityCategorySchema`: ["good", "fair", "poor"]]` `OCR_RESCAN_PROMPT` is opened after a document upload if OCR detects `fair` or `poor` scan quality. It prompts the user to re-scan before proceeding. `[Confirmed — Consolidated Reference Part 11.4, Q-C01: "System detects scan quality and always shows a scan quality indicator to the user"]`

### What does NOT go here

`[Inference]` Toast/snackbar notifications are not modals. They are ephemeral feedback that appears and disappears on mutation success/error and should be handled by a toast library (shadcn's `Sonner` integration or similar) that does not need Zustand — TanStack Query's `onSuccess`/`onError` callbacks call the toast library directly.

---

## 7. Store 4 — `useNotificationDrawerStore`

**Concern:** The notification drawer open/closed state and the ephemeral unread count that increments each time the SSE connection delivers a new notification event. `[Confirmed — Stack Context: "Real-time notifications: Server-Sent Events (SSE) — One-directional push"]` `[Confirmed — E3 Part 9: `NotificationEventSchema`, `SseEventSchema`]`

### State shape

```typescript
interface NotificationDrawerState {
  isOpen: boolean;

  // Ephemeral badge counter — incremented on each incoming SSE event of type "notification"
  // Reset to 0 when the drawer is opened (user has "seen" the new notifications)
  // This counter is additive: it tracks new arrivals since the drawer was last opened,
  // NOT the total unread count (which lives in TanStack Query via notifications.listMine filtered by isRead=false)
  newArrivalCount: number;

  // The last SSE event received, stored so the drawer can show a real-time preview
  // of the most recent notification without waiting for the TanStack Query refetch
  lastIncomingEvent: {
    type: string;
    title: string;
    body: string;
    referenceId: string | null;
    receivedAt: string; // client-side ISO timestamp
  } | null;
}
```

### Actions

```typescript
interface NotificationDrawerActions {
  openDrawer: () => void;              // also resets newArrivalCount to 0
  closeDrawer: () => void;
  toggleDrawer: () => void;
  onSseNotificationReceived: (event: {
    type: string;
    title: string;
    body: string;
    referenceId: string | null;
  }) => void;                          // increments newArrivalCount; sets lastIncomingEvent
  resetNewArrivalCount: () => void;    // called when drawer opens
}
```

### Usage notes

`[Inference]` The SSE connection is established in a singleton custom hook (`useNotificationSse`) mounted at the authenticated shell level. When the SSE delivers an event with `event: "notification"` (per `SseEventSchema`), the hook calls `onSseNotificationReceived` on the store and also invalidates the TanStack Query cache key for `notifications.listMine` so the drawer's full list refetches automatically. The store does not hold the list — TanStack Query does.

`[Confirmed — E3 Part 9: `SseEventSchema` event types: ["notification", "workflow_update", "sla_warning", "heartbeat"]]` Only events of type `"notification"` increment `newArrivalCount`. Events of type `"workflow_update"` and `"sla_warning"` invalidate relevant TanStack Query caches directly without touching this store. `"heartbeat"` events are consumed by the SSE hook to confirm the connection is alive; they do not touch any Zustand store.

`[Confirmed — Consolidated Reference Part 11.4: "In-app notifications"]` The `newArrivalCount` drives the numeric badge on the notification bell icon in the shell header. When `newArrivalCount === 0`, the badge is not rendered.

### What does NOT go here

The full notification list, pagination state, and read/unread status of individual items — those are TanStack Query. `[Confirmed — boundary rule §1]`

---

## 8. Store 5 — `useDocumentIntakeStore`

**Concern:** Multi-step document intake form state. `[Confirmed — Stack Context: "UI state (frontend): Zustand — multi-step form state"]` `[Confirmed — F1 §7.2: `/documents/new` — `DocumentIntakeFormPage`]`

The document intake form is the most complex multi-step flow in Phase 1. It creates a new document record, assigns document type and metadata, handles file upload via pre-signed URL, and optionally triggers OCR. The form spans multiple steps that each map to distinct server operations; intermediate state must survive navigation between steps without being re-fetched.

`[Confirmed — E3 Part 4: `LogDocumentInputSchema`; `PresignedUploadRequestSchema`/`PresignedUploadResponseSchema`; `DocumentMetadataSchema` discriminated union by `__type`]`
`[Confirmed — E3 Part 5: per-document-type metadata schemas for SP_RESOLUTION, SP_ORDINANCE, APPROPRIATION_ORDINANCE, CITIZEN_COMPLAINT, DOCUMENT_REQUEST_FORM, CERTIFICATION_OF_URGENCY]`

### Steps

```
Step 1: Document type selection
Step 2: Core fields (title, classification, originating office)
Step 3: Type-specific metadata (sponsors, readings, fiscal year, etc.)
Step 4: File upload (pre-signed URL → upload to S3 → confirm)
Step 5: Review and submit
```

`[Inference]` Steps are 1-indexed integers stored in the store so the form can be resumed at the correct step if the user navigates away and returns to `/documents/new` within the same session. The store is reset on successful submission or explicit discard.

### State shape

```typescript
type DocumentIntakeStep = 1 | 2 | 3 | 4 | 5;

// File upload tracking — separate from form data because upload is async
interface FileUploadState {
  file: File | null;                   // the File object from the file picker
  s3Key: string | null;                // set after presigned URL upload completes
  originalFilename: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  uploadProgress: number;              // 0–100, for the progress bar
  uploadStatus: "idle" | "requesting_url" | "uploading" | "complete" | "error";
  uploadError: string | null;
}

interface DocumentIntakeState {
  currentStep: DocumentIntakeStep;
  isSubmitting: boolean;

  // Step 1
  selectedDocumentTypeId: string | null;
  selectedDocumentTypeCode: string | null;  // e.g. "SP_RESOLUTION" — drives Step 3 metadata form

  // Step 2 — core fields matching LogDocumentInputSchema
  title: string;
  classificationLevel: string;             // ClassificationLevelSchema value
  originatingOfficeId: string | null;
  ownedByOfficeId: string | null;

  // Step 3 — type-specific metadata; keyed as a plain object
  // Populated by the per-type React Hook Form instance on Step 3
  // Held here so values survive the user navigating back to Step 2 and returning
  metadata: Record<string, unknown>;

  // Step 4
  fileUpload: FileUploadState;
}
```

### Actions

```typescript
interface DocumentIntakeActions {
  setStep: (step: DocumentIntakeStep) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Step 1
  selectDocumentType: (id: string, code: string) => void;

  // Step 2
  setCoreFields: (fields: {
    title?: string;
    classificationLevel?: string;
    originatingOfficeId?: string | null;
    ownedByOfficeId?: string | null;
  }) => void;

  // Step 3
  setMetadata: (metadata: Record<string, unknown>) => void;
  patchMetadata: (patch: Record<string, unknown>) => void;

  // Step 4
  setFile: (file: File) => void;
  setUploadProgress: (progress: number) => void;
  setUploadStatus: (status: FileUploadState["uploadStatus"]) => void;
  setUploadComplete: (s3Key: string) => void;
  setUploadError: (error: string) => void;

  // Lifecycle
  setSubmitting: (isSubmitting: boolean) => void;
  reset: () => void;                   // called on success or explicit discard
}
```

### Usage notes

`[Inference]` Step 3 renders a different React Hook Form instance per `selectedDocumentTypeCode` (using the appropriate schema from E3 Part 5 via `zodResolver`). The React Hook Form instance's `getValues()` output is stored in `metadata` when the user advances to Step 4, so the data survives the step transition. This is the correct pattern: React Hook Form owns field-level validation during the step; Zustand owns the collected output across steps.

`[Confirmed — Consolidated Reference Part 11.4, Q-C01: "OCR runs automatically on upload — system detects scan quality and always shows a scan quality indicator"]` After Step 4 completes, the server triggers OCR asynchronously. The scan quality indicator returned by `documents.getScanQualityIndicator` is a TanStack Query poll — not stored here. If the indicator returns `fair` or `poor`, `useModalStore.openModal({ type: "OCR_RESCAN_PROMPT", ... })` is called from the Step 4 component, not from this store.

`[Confirmed — E3 Part 1: `PresignedUploadRequestSchema` — max 26,214,400 bytes (25 MB); allowed MIME types: PDF, DOCX, XLSX, PNG, JPG]` File validation against these constraints happens in the Step 4 component before `setFile` is called.

`[Inference]` `reset()` is called in three situations: after a successful `documents.create` mutation; after the user explicitly clicks "Discard"; and when the user navigates away from `/documents/new` via the router's `onBeforeLeave` guard (the guard prompts with `CONFIRM_ACTION` first).

### What does NOT go here

Document list results, existing document metadata fetched for review — TanStack Query. `[Confirmed — boundary rule §1]`

---

## 9. Store 6 — `useWorkflowActionStore`

**Concern:** Transient UI state for the workflow step action page (`/workflow/steps/:instanceId`). The page renders different action panels conditionally based on `step_type` and `step.name` (F1 §8.2). This store tracks which panel is "active" when a step could legitimately show more than one panel surface, and holds the comment/decision fields before they are submitted. `[Confirmed — F1 §8.2: ten named panels; single dynamic route with conditional rendering]`

### State shape

```typescript
// Panels that can be "in progress" — user has started filling a form but not submitted
type WorkflowPanelId =
  | "generic_action"
  | "generic_approval"
  | "secretariat_decision"
  | "vp_certification"
  | "mayor_decision"
  | "mayor_lapse_confirmation"
  | "veto_override_recording"
  | "multi_referral"
  | "docketing"
  | "panlalawigan_outcome"
  | "publication_date"
  ;

interface WorkflowActionState {
  // Which sub-panel the user has actively selected (when a step could show multiple panels)
  activePanelId: WorkflowPanelId | null;

  // Comment/note field draft — shared across panels that have a freetext comment
  commentDraft: string;

  // Decision field for approval/secretariat-decision panels
  decisionDraft: string | null;     // ApprovalDecisionSchema value

  // Specific to multi_referral panel: which committee's report form is expanded
  expandedCommitteeId: string | null;

  // Specific to mayor_decision panel: whether the veto message textarea is visible
  vetoMessageVisible: boolean;

  // Whether the submission is in progress (prevents double-submit)
  isSubmitting: boolean;
}
```

### Actions

```typescript
interface WorkflowActionActions {
  setActivePanelId: (panelId: WorkflowPanelId | null) => void;
  setCommentDraft: (comment: string) => void;
  setDecisionDraft: (decision: string | null) => void;
  setExpandedCommitteeId: (committeeId: string | null) => void;
  setVetoMessageVisible: (visible: boolean) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  reset: () => void;                  // called on successful submission or when navigating away
}
```

### Usage notes

`[Inference]` This store is reset every time the user navigates to a new `/workflow/steps/:instanceId` route (via the router's `onRouteChange` effect calling `reset()`). Workflow step state should never bleed between different step instances.

`[Inference]` The `commentDraft` is distinct from the actual form submission payload. It is a controlled-input mirror so that the textarea in any panel can be a controlled React component that reads from and writes to the store, without React Hook Form overhead for a single textarea. The final value is read from the store at submit time and passed to the tRPC mutation.

`[Confirmed — E3 Part 6: `AdvanceWorkflowStepInputSchema` — comment required when `decision` is `rejected`, `returned_for_revision`, or `amended` (min 10 chars)]` This validation is enforced by the shared Zod schema at submit time. The store does not enforce it — it holds the draft value without constraints. Submit-time validation via `zodResolver` on the final assembled payload is the gate.

`[Confirmed — F1 §8.2, Multi-Referral Panel: `workflow.manuallyAdvanceMultiReferralStep` requires SP Secretary; audit-logged with mandatory comment]` `[Confirmed — E3 Part 6: `BypassStepInputSchema` — reason min 20 chars, max 2048]` The bypass reason textarea uses the same `commentDraft` field but with stricter validation at submit time.

### What does NOT go here

The workflow instance data, current step data, and committee assignment list — TanStack Query via `workflow.getInstance`. `[Confirmed — boundary rule §1]`

---

## 10. Store 7 — `useComplaintIntakeStore`

**Concern:** Clerk-assisted complaint intake form state for the in-person intake mode (`/complaints/new`). `[Confirmed — F1 §8.3: `ComplaintIntakeClerkAssistedPage` — SP Secretary only — `complaints.createClerkAssisted`]` `[Confirmed — Consolidated Reference Part 4.14: three access modes; clerk-assisted = mode 3]`

`[Confirmed — E3 Part 5: `CitizenComplaintMetadataSchema` — complainant, incident, respondent fields; `ComplaintOutcomeStateSchema` default `pending_hearing`]`

### Steps

```
Step 1: Complainant details (name, address, contact, email)
Step 2: Incident details (violation type, tricycle number, date/time/place, remarks)
Step 3: Respondent details (name, contact, email) — optional
Step 4: Initial routing decision (committee or Vice Mayor)
Step 5: Review and submit
```

`[Confirmed — Consolidated Reference Part 4.14: "Complaint not limited to transportation — any LGU-related complaint; Secretariat decides routing"]` Step 4 is present but the routing decision is the Secretariat's judgment call, not a fixed rule.

### State shape

```typescript
type ComplaintIntakeStep = 1 | 2 | 3 | 4 | 5;

interface ComplaintIntakeState {
  currentStep: ComplaintIntakeStep;
  isSubmitting: boolean;

  // Step 1 — complainant
  complainantName: string;
  complainantAddress: string;
  complainantContact: string;
  complainantEmail: string;

  // Step 2 — incident
  violationType: string | null;         // ComplaintViolationTypeSchema value or null
  subjectDescription: string;
  tricycleNumber: string;
  incidentDate: string;                 // YYYY-MM-DD or empty string
  incidentTime: string;                 // HH:MM or empty string
  incidentPlace: string;
  remarks: string;

  // Step 3 — respondent (all optional)
  respondentName: string;
  respondentContact: string;
  respondentEmail: string;

  // Step 4 — routing
  routedToCommitteeId: string | null;
  routedToViceMayor: boolean;
}
```

### Actions

```typescript
interface ComplaintIntakeActions {
  setStep: (step: ComplaintIntakeStep) => void;
  nextStep: () => void;
  prevStep: () => void;

  setComplainantFields: (fields: Partial<Pick<ComplaintIntakeState,
    "complainantName" | "complainantAddress" | "complainantContact" | "complainantEmail"
  >>) => void;

  setIncidentFields: (fields: Partial<Pick<ComplaintIntakeState,
    "violationType" | "subjectDescription" | "tricycleNumber" |
    "incidentDate" | "incidentTime" | "incidentPlace" | "remarks"
  >>) => void;

  setRespondentFields: (fields: Partial<Pick<ComplaintIntakeState,
    "respondentName" | "respondentContact" | "respondentEmail"
  >>) => void;

  setRoutingDecision: (fields: {
    routedToCommitteeId?: string | null;
    routedToViceMayor?: boolean;
  }) => void;

  setSubmitting: (isSubmitting: boolean) => void;
  reset: () => void;
}
```

### Usage notes

`[Inference]` `reset()` is called on successful submission. The Secretariat staff then logs the next complaint as a fresh intake. Unlike the document intake store, there is no "navigate away with unsaved work" guard needed here because the form is modal in practice — the clerk works through it linearly and submits before handling the next request. `[Speculation]` The team may decide otherwise if operational experience shows incomplete intakes being abandoned.

`[Confirmed — Consolidated Reference Part 4.14: "Respondent notification: if respondent has email, notification AND formal written notice sent by email; if only contact number, respondent must claim formal written notice in person"]` Respondent notification happens server-side after submission based on the `respondentEmail` and `respondentContact` values. This store holds those values; the server decides the notification channel.

---

## 11. Store 8 — `useDocumentRequestIntakeStore`

**Concern:** Clerk-assisted document request intake form for the in-person intake mode (`/document-requests/new`). `[Confirmed — F1 §8.4: `DocumentRequestIntakeClerkAssistedPage` — SP Secretary only — `documentRequests.createClerkAssisted`, `documentRequests.generatePrintableForm`]` `[Confirmed — Consolidated Reference Part 4.15: three access modes; physical signature still required after digital form generation]`

`[Confirmed — E3 Part 5: `DocumentRequestFormMetadataSchema`]`

### Steps

```
Step 1: Requester details (name, agency, email, phone, ID presented)
Step 2: Request details (document type, title, purpose)
Step 3: Payment reference (OR number, collecting officer) — may be deferred if payment is pending
Step 4: Review → generate printable form → print → obtain physical signature
```

`[Confirmed — Consolidated Reference Part 4.15: "Payment system deferred past Phase 5"]` `[Inference]` Step 3 fields are optional and can be filled in later when the requester pays. The printable form (`documentRequests.generatePrintableForm`) is generated in Step 4 regardless of whether payment fields are filled.

### State shape

```typescript
type DocumentRequestIntakeStep = 1 | 2 | 3 | 4;

interface DocumentRequestIntakeState {
  currentStep: DocumentRequestIntakeStep;
  isSubmitting: boolean;
  generatedFormUrl: string | null;     // pre-signed URL of the generated printable PDF

  // Step 1 — requester
  requesterName: string;
  requesterAgency: string;
  requesterEmail: string;
  requesterPhone: string;
  idPresented: string;

  // Step 2 — request
  requestedDocumentType: string;
  requestedDocumentTitle: string;
  numberOfPagesCopied: number | null;
  purpose: string;

  // Step 3 — payment (optional at intake)
  paymentOrNumber: string;
  collectingOfficer: string;
}
```

### Actions

```typescript
interface DocumentRequestIntakeActions {
  setStep: (step: DocumentRequestIntakeStep) => void;
  nextStep: () => void;
  prevStep: () => void;

  setRequesterFields: (fields: Partial<Pick<DocumentRequestIntakeState,
    "requesterName" | "requesterAgency" | "requesterEmail" | "requesterPhone" | "idPresented"
  >>) => void;

  setRequestFields: (fields: Partial<Pick<DocumentRequestIntakeState,
    "requestedDocumentType" | "requestedDocumentTitle" | "numberOfPagesCopied" | "purpose"
  >>) => void;

  setPaymentFields: (fields: Partial<Pick<DocumentRequestIntakeState,
    "paymentOrNumber" | "collectingOfficer"
  >>) => void;

  setGeneratedFormUrl: (url: string | null) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  reset: () => void;
}
```

### Usage notes

`[Confirmed — Consolidated Reference Part 4.15: "After a copy request is approved, person notified via contact number (primary channel)"]` Approval and notification happen post-submission via the standard workflow. This store only covers the initial intake.

`[Confirmed — Consolidated Reference Part 11.4, Q-B02: "QR Code, Tracking Number, Series Number — cover page auto-generated"]` The printable form from `generatePrintableForm` includes the QR cover sheet. `[Inference]` `generatedFormUrl` is a short-lived pre-signed S3 URL that the browser opens in a new tab for printing. It is stored here so the Step 4 UI can show a "Print again" button without re-calling the mutation.

---

## 12. Store 9 — `useQrScannerStore`

**Concern:** The QR scan overlay — open/closed state, scanner active/inactive, and the result of the last scan before the user navigates to the full document view. `[Confirmed — Stack Context: "`html5-qrcode` or `zxing-wasm` (frontend scanner)"]` `[Confirmed — E3 Part 7: `QrCodeScanResultSchema`; `QrScanInputSchema`]` `[Confirmed — F1 §7.1: tracking.scanQrCodeAuthenticated suggested as a search shortcut on the document list page]`

### State shape

```typescript
interface QrScannerState {
  isOpen: boolean;
  scannerActive: boolean;              // camera feed is live
  scanStatus: "idle" | "scanning" | "processing" | "success" | "error";
  lastScanResult: {
    trackingNumber: string;
    documentTitle: string;
    documentTypeLabel: string;
    lifecycleState: string;            // LifecycleStateSchema value
    remarks: string | null;
    firstPageS3Key: string | null;
    canRequestCopy: boolean;
    routingHistoryCount: number;       // just the count for the preview; full history on navigate
  } | null;
  scanError: string | null;
}
```

### Actions

```typescript
interface QrScannerActions {
  openScanner: () => void;
  closeScanner: () => void;           // also clears lastScanResult and scanError
  setScannerActive: (active: boolean) => void;
  setScanStatus: (status: QrScannerState["scanStatus"]) => void;
  setScanResult: (result: QrScannerState["lastScanResult"]) => void;
  setScanError: (error: string | null) => void;
  clearResult: () => void;            // allows the user to scan another document
}
```

### Usage notes

`[Confirmed — Consolidated Reference Part 11.6: "QR content is a UUID only (not a URL, not document content) — scan result: document type, remarks, history from draft, first page visible; other pages blurred"]` The `lastScanResult` shape in this store is a subset of `QrCodeScanResultSchema` (E3 Part 7) — sufficient for the inline scan result preview shown in the overlay. The full result (complete routing history, first page image) is loaded by TanStack Query after the user taps "View Document" and navigates to `/documents/:documentId`.

`[Inference]` When the overlay shows `lastScanResult`, it displays the document's preliminary or final number, lifecycle state, and a "View Document" link. If `canRequestCopy === true`, it also shows a "Request a Copy" button that opens `/portal/requests/new` (or the staff-side `/document-requests/new` if the current user is Secretariat staff).

`[Inference]` The scanner overlay is triggered from a persistent FAB (floating action button) visible on all authenticated pages for roles that have scanner access (all roles except Auditor in read-only mode). `[Speculation]` The team may decide to restrict the FAB to specific pages only.

---

## 13. Store 10 — `useOrderOfBusinessStore`

**Concern:** Pending unsaved changes to the Order of Business view before the SP Secretary commits them to the server. `[Confirmed — F1 §6: `OrderOfBusinessPage`; primary actions: `session.scheduleDocumentForFirstReading`, `session.enterCommitteeHearingDate`, `workflow.manuallyAdvanceMultiReferralStep`]` `[Confirmed — Consolidated Reference Part 4.18: "Order of Business generated from documents scheduled for the upcoming Tuesday session; cutoff Thursday"]`

### State shape

```typescript
// Represents a pending scheduling change not yet submitted to the server
type PendingScheduleChange =
  | { changeType: "SCHEDULE_FIRST_READING"; documentId: string; sessionDate: string; }
  | { changeType: "ENTER_HEARING_DATE";     stepInstanceId: string; committeeId: string; hearingDate: string; }
  ;

interface OrderOfBusinessState {
  // Pending changes buffer
  // Allows the SP Secretary to stage multiple scheduling changes and submit them together
  pendingChanges: PendingScheduleChange[];

  // Whether the "Save changes" flow is in progress
  isSaving: boolean;

  // Which Order of Business date is being viewed
  // (the next Tuesday, by default; may be changed if viewing a past week)
  viewingSessionDate: string | null;   // YYYY-MM-DD
}
```

### Actions

```typescript
interface OrderOfBusinessActions {
  setViewingSessionDate: (date: string | null) => void;

  addScheduleFirstReading: (documentId: string, sessionDate: string) => void;
  addEnterHearingDate: (stepInstanceId: string, committeeId: string, hearingDate: string) => void;
  removeChange: (index: number) => void;
  clearPendingChanges: () => void;

  setSaving: (isSaving: boolean) => void;
}
```

### Usage notes

`[Inference]` A "pending changes" buffer is used rather than immediate per-action mutations because the SP Secretary typically makes several scheduling adjustments together while reviewing the Order of Business (e.g. scheduling five first readings and entering three committee hearing dates before saving). Batching them into a single review-and-commit flow reduces the risk of partial saves and gives the Secretariat a chance to review the full set of changes before committing.

`[Inference]` On save, the component iterates `pendingChanges` and fires each corresponding tRPC mutation in sequence. On success, `clearPendingChanges` is called and TanStack Query's `session.getOrderOfBusiness` cache is invalidated. On error, the failed change is highlighted in the pending list; successfully committed changes are removed from the buffer.

`[Confirmed — Consolidated Reference Part 8.3, Q-A02: "SP Secretary can manually advance the step — must be audit-logged with a mandatory comment"]` `workflow.manuallyAdvanceMultiReferralStep` (the bypass action) is handled via `useModalStore` → `CONFIRM_ACTION` → inline TanStack Query mutation on the Order of Business page. It is not buffered in this store because it requires an immediate confirmation + mandatory reason, not a staged batch save.

`[Confirmed — Consolidated Reference Part 7.2: "Documents received by Secretariat before the Thursday cutoff are included in the next Tuesday Order of Business"]` `viewingSessionDate` tracks which session the Secretariat is building the Order of Business for. It defaults to the next upcoming Tuesday.

---

## 14. Store 11 — `useAttendanceStore`

**Concern:** A local buffer of attendance records being entered for a single SP session before batch submission. `[Confirmed — F1 §9: `SessionAttendanceDetailPage`; `session.recordAttendance` — SP Secretary only]` `[Confirmed — Consolidated Reference Part 7.3: "Absence input timing: recorded before the session; absence reasons: OB, sick leave, vacation leave, absent (unqualified)"]`

`[Confirmed — E3 Part 11: `CreateSpSessionInputSchema` — `attendanceRecords: z.array(...)` — quorum requires ≥ 7 present; `AttendanceStatusSchema`: ["present", "absent_ob", "absent_sick", "absent_vacation", "absent"]]`

### State shape

```typescript
interface AttendanceRecord {
  employeeId: string;
  displayName: string;
  status: "present" | "absent_ob" | "absent_sick" | "absent_vacation" | "absent";
  reason: string;
}

interface AttendanceState {
  // The session being recorded
  sessionDate: string | null;         // YYYY-MM-DD
  sessionId: string | null;           // UUID; null if the session row doesn't exist yet

  // Buffer of attendance inputs, keyed by employeeId for O(1) lookup
  records: Record<string, AttendanceRecord>;

  // Computed quorum status
  presentCount: number;
  quorumMet: boolean;                 // presentCount >= 7 (Confirmed — consolidated reference Part 3.2)

  isSubmitting: boolean;
}
```

### Actions

```typescript
interface AttendanceActions {
  initSession: (sessionDate: string, sessionId: string | null, members: Array<{
    employeeId: string;
    displayName: string;
  }>) => void;                         // seeds all members as "present"; SP Secretary changes absences

  setAttendanceRecord: (employeeId: string, record: Partial<AttendanceRecord>) => void;

  markPresent: (employeeId: string) => void;
  markAbsent: (employeeId: string, status: Exclude<AttendanceRecord["status"], "present">, reason?: string) => void;

  setSubmitting: (isSubmitting: boolean) => void;
  reset: () => void;                   // called after successful submission
}
```

### Usage notes

`[Inference]` `initSession` is called when the SP Secretary opens the attendance detail page for a given session. It seeds the `records` buffer with all 12 SP members (loaded from TanStack Query via `organization.getOfficeHierarchy` or a dedicated committee-member list) defaulted to `"present"`. The Secretariat then marks absences. This matches the operational pattern where most sessions have full or near-full attendance and absences are the exception.

`[Confirmed — Consolidated Reference Part 7.3: "Statistics: count of present/absent councilors; graph of attendee numbers over time — UI requirement: Session detail view: who is absent and why; visible before session"]` `presentCount` and `quorumMet` are derived from `records` synchronously in the store (either as computed in Zustand's selector or recomputed in the action that updates `records`). The attendance statistics graph over time is a TanStack Query concern, not stored here.

`[Confirmed — E3 Part 11: `CreateSpSessionInputSchema` refine — "at least 7 members must be present"]` The quorum check (`quorumMet`) is surfaced in the UI as a warning indicator while the Secretary is recording attendance. Submission is blocked if `quorumMet === false` and the session type is `"regular"`. `[Inference — the source confirms the quorum rule; the block-on-submit behavior is this document's proposed implementation]`

`[Confirmed — F1 §9: "designated substitute" field creates a tension with Phase 1B Designation document type]` This store does not model a `presidingOfficerSubstituteId` field. The presiding officer is selected at session creation and comes from the existing `SpSessionSelectSchema.presidingOfficerEmployeeId` field. The Phase 1B resolution to this tension (F1 §9, §14 item 7) is noted here but not pre-implemented.

### What does NOT go here

Historical attendance records across sessions, the attendance statistics graph data — TanStack Query. `[Confirmed — boundary rule §1]`

---

## 15. Cross-Store Interaction Rules

`[Inference]` These rules are not enforced by Zustand itself; they are team conventions enforced at code review.

**Rule 1: Stores do not import each other.**
Cross-store coordination is done in component event handlers or custom hooks. If Store A needs to know about Store B's state, the component that needs both reads from both and decides what to do.

**Rule 2: Only one store drives a given piece of UI.**
If both `useDocumentIntakeStore` and `useModalStore` could be responsible for showing a confirmation when the user discards an in-progress intake form, the rule is: `useDocumentIntakeStore` owns the "has unsaved work" boolean; the *component* reads it and calls `useModalStore.openModal({ type: "CONFIRM_ACTION", ... })` in its navigation guard. Neither store calls the other.

**Rule 3: TanStack Query mutations always call `reset()` on the corresponding form store after success.**
The mutation's `onSuccess` callback (not the store) is responsible for calling `reset()`. This keeps the store ignorant of the mutation lifecycle.

**Rule 4: Session store is read-only in all other stores.**
No store sets values on `useSessionStore` except the auth layer itself (`setIdentity`, `clearIdentity`). Other stores may read `useSessionStore.identity` in components but not in store actions.

**Rule 5: Modal store is ephemeral — never persist it.**
The modal stack is never persisted to `localStorage` or `sessionStorage`. On page reload, the modal stack is always empty.

---

## 16. Persistence Rules

`[Confirmed — Stack Context: "Auth pattern: Never localStorage; structured for future SSO migration"]`
`[Confirmed — Consolidated Reference Part 11.1: "Tokens delivered via HTTP-only, Secure, SameSite=Strict cookies — never localStorage or sessionStorage"]`

| Store | Persistence | Rationale |
|---|---|---|
| `useShellStore` | `sessionStorage` — `sidebarCollapsed` only | Desktop rail preference within a session; not worth a server round-trip |
| `useSessionStore` | None — hydrated from auth check on mount | Identity comes from the cookie + server check; never stored client-side |
| `useModalStore` | None | Ephemeral UI; meaningless after reload |
| `useNotificationDrawerStore` | None | SSE resets naturally; `newArrivalCount` resets to 0 on reload (acceptable) |
| `useDocumentIntakeStore` | `sessionStorage` — all fields | Protects work-in-progress if the browser tab is accidentally refreshed |
| `useWorkflowActionStore` | None | In-progress comment drafts are short-lived; losing them on reload is acceptable |
| `useComplaintIntakeStore` | `sessionStorage` — all fields | Protects clerk-entered complainant data from accidental refresh |
| `useDocumentRequestIntakeStore` | `sessionStorage` — all fields | Same rationale as complaint intake |
| `useQrScannerStore` | None | Scanner state is instantaneous and should not survive reload |
| `useOrderOfBusinessStore` | `sessionStorage` — `pendingChanges` and `viewingSessionDate` | Pending scheduling changes represent significant work and should survive accidental refresh |
| `useAttendanceStore` | `sessionStorage` — all fields | A full attendance record for 12 members is significant data entry; accidental refresh should not lose it |

`[Inference]` Zustand's `persist` middleware with `storage: sessionStorage` is used for the stores marked above. `sessionStorage` (not `localStorage`) is chosen because the data is session-scoped — a new browser tab should start fresh, and the data must not persist across logout. The `partialize` option on each `persist` call explicitly excludes `isSubmitting` and derived fields (e.g. `quorumMet`, `presentCount`) from the persisted subset; only raw input values are persisted.

`[Confirmed — boundary rule §1]` Persisted draft data in `sessionStorage` is UI state, not server state, and does not violate the JWT/cookie-only auth constraint. It holds form field strings and IDs, not credentials, tokens, or server-side entity data.

---

## 17. Testing Guidance

`[Confirmed — Stack Context: "Testing: Vitest (unit/integration) + Playwright (E2E)"]`

Each store should have a Vitest unit test file alongside it (`shell.store.test.ts`, etc.) covering:

- Initial state correctness (all fields match documented defaults)
- Each action's effect on state in isolation
- Persistence round-trip (for stores using `sessionStorage` persist): serialize → deserialize → state matches
- Cross-action sequences that mirror real user flows (e.g. for `useDocumentIntakeStore`: `selectDocumentType` → `setCoreFields` → `setMetadata` → `setUploadComplete` → confirm state shape is correct before submit)
- `reset()` returns all fields to initial values

`[Inference]` Stores should be tested without any React rendering (plain function calls on the store's `getState()` and action functions). This is straightforward with Zustand's vanilla store API. No component or hook is needed in store unit tests.

`[Inference]` The cross-store interaction patterns (Rule 1–5 in §15) are tested at the component level via Playwright E2E tests or React Testing Library integration tests, not at the store level.

---

## 18. Known Gaps and Open Questions

| # | Gap / question | Where it surfaces | Status |
|---|---|---|---|
| 1 | `useSessionStore` must hold `roleCodes` for synchronous ABAC checks, but the server returns role data via `RoleAssignmentSelectSchema` (E3 Part 2), not as a flat code array. The login response shape needs to be confirmed: does it return a resolved `string[]` of role codes, or the full `RoleAssignmentSelectSchema[]`? | §5 `useSessionStore` | `[Unverified]` — E3's `AuthResponseSchema` contains only `user: UserSelectSchema` which has no `roleCodes` field; role resolution may require an additional call |
| 2 | The Phase 1B Designation document type tension in `useAttendanceStore` (the "designated substitute" presiding officer field requires a Designation document, but Designation is Phase 1B). This store defers the field; the presiding officer is always the active VP unless set manually at session creation. | §14 `useAttendanceStore`, F1 §9 | `[Unverified]` — inherited from F1 §14 item 7 |
| 3 | `useDocumentIntakeStore` Step 3 renders different React Hook Form instances per `selectedDocumentTypeCode`. CERTIFICATION_OF_URGENCY and DOCUMENT_REQUEST_FORM have their own metadata schemas (E3 Part 5) but are arguably not "new document" types that go through the standard intake form — they are generated or logged differently. Whether these types appear in the Step 1 document type picker needs a product decision. | §8 `useDocumentIntakeStore` | `[Speculation]` |
| 4 | `useOrderOfBusinessStore.pendingChanges` batches scheduling mutations. If any one mutation in the batch fails, the UI must distinguish successfully committed changes (removed from buffer) from failed ones (highlighted). The error-handling pattern for partial batch failure is not detailed in any source document. | §13 `useOrderOfBusinessStore` | `[Inference]` — proposed approach is to iterate sequentially and track per-item status; team to confirm |
| 5 | SSE reconnection behavior: if the SSE connection drops and reconnects, `newArrivalCount` in `useNotificationDrawerStore` may miss events delivered during the gap. The source documents do not describe the SSE reconnection strategy. The standard `EventSource` browser API handles reconnection automatically with the `Last-Event-ID` header, but the server must support event replay for this to work. | §7 `useNotificationDrawerStore` | `[Speculation]` — the team should decide whether missed events during reconnection are acceptable or require a fallback TanStack Query poll |

---

*This document supersedes any informal or ad-hoc Zustand store definitions that may exist in `/apps/web` prior to Phase 1 development start. All new stores must be added to this catalog with the same structure: store name, state shape, actions, usage notes, and explicit boundary from TanStack Query. This document is updated after any stakeholder interview, developer decision, or UI design change that introduces a new modal, multi-step form, or persistent UI state requirement.*
