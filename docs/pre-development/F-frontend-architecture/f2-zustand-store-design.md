# F2. Zustand Store Design — Pre-dev (v3)

**Document ID:** F2 (v3 — supersedes the original `f2-zustand-store-design.md.bak`)
**Type:** Frontend UI-state design — `/apps/web`, Phase 1
**Status:** DRAFT — pre-development proposal, not yet reviewed or approved. Updated to reflect ADR-001 through ADR-016.
**Date:** June 2026 (v3 revision: 2026-06-19)
**Based on:**
- F1 v2 — `f1-application-route-map-v2.md`
- E3 — `e3-shared-zod-schema-catalog.md`
- Stack Context — `tech-stack.md`
- Consolidated Architecture & Requirements Reference Iteration 3 — `consolidated-architecture-and-requirements-reference-iteration-3.md`
- ADR-001 through ADR-011 (prior revisions) and ADR-012 through ADR-016 (this revision's direct cause)

**Audience:** Frontend development team; cross-referenced by any developer wiring a modal, drawer, sidebar, multi-step form, or notification surface in `/apps/web`

> **Notation note:** This document applies the same inference tagging used in F1. `[Confirmed — source]` means directly traceable to a named section of a source document. `[Inference]` means a reasonable conclusion drawn from confirmed facts. `[Speculation]` means an unconfirmed possibility raised because source material is silent. Every store design, slice boundary, and state shape decision not explicitly required by the source material is individually tagged at the point it is made. Read this document as a draft for team review, not as approved architecture.

> **v3 revision note:** This is a standalone, complete document. It incorporates all resolutions from `F2 v3 — Delta Against f2-zustand-store-design.md (v2)` based on ADR-012 through ADR-016. All five "Still open" items from v2 §18 have been resolved (concerning role codes shape, document type picker scope, partial batch failure handling, SSE reconnection strategy, and presiding officer substitute lookup procedure/test coverage), leaving zero open items inherited from v1/v2. See §18 for details.

## Table of Contents

- [L49–L76] 1. The Zustand / TanStack Query Boundary — Core rule separating client-side UI state from server-side state, with concrete boundary examples and SSE/auth exceptions.
- [L77–L94] 2. Store Inventory — A reference table of the 11 Zustand stores and their primary architectural concerns.
- [L95–L121] 3. File Structure — File layout of stores in the mono-repo and rules prohibiting direct cross-store dependencies.
- [L122–L167] 4. Store 1 — `useShellStore` — Sidebar collapse status, active navigation route highlights, and their respective device-specific behaviors.
- [L168–L227] 5. Store 2 — `useSessionStore` — Decoded auth identity, role codes for synchronous route guards/ABAC checks, and session hydration rules.
- [L228–L297] 6. Store 3 — `useModalStore` — TypeScript-typed global modal stack registry, rendering rules, and session timeout/scan warning triggers.
- [L298–L356] 7. Store 4 — `useNotificationDrawerStore` — Real-time SSE notification count increments, last event preview, and bell badge display logic.
- [L357–L479] 8. Store 5 — `useDocumentIntakeStore` — Multi-step form cache, S3 upload progress tracking, and per-type metadata storage for document creation.
  - [L366–L377] Steps — The sequential phases of the multi-step document intake form.
  - [L378–L418] State shape — TypeScript interface defining the layout and fields stored for document intake.
  - [L419–L454] Actions — Store methods for managing step navigation, field updates, and file upload progress.
  - [L455–L464] Usage notes — Integration details for React Hook Form validation and automatic OCR trigger handling.
  - [L465–L473] Step 1 picker scope — Confirmed exclusions (Urgent Certification, Request Form) and selectable types in the intake picker.
  - [L474–L479] What does NOT go here — Clarification on server-state data exclusions like document search results.
- [L480–L554] 9. Store 6 — `useWorkflowActionStore` — Active sub-panel selections, comment drafts, and veto options for the dynamic workflow action page.
- [L555–L650] 10. Store 7 — `useComplaintIntakeStore` — In-person, clerk-assisted complaint intake cache mapping complainant, incident, respondent, and routing decisions.
- [L651–L732] 11. Store 8 — `useDocumentRequestIntakeStore` — In-person, clerk-assisted document request flow buffering requester info, purpose, payment reference, and PDF URL.
- [L733–L784] 12. Store 9 — `useQrScannerStore` — Camera scanner state, inline metadata preview, and navigation triggers to detail views.
- [L785–L865] 13. Store 10 — `useOrderOfBusinessStore` — Staged schedule changes before batch save, with sequential commit error handling for partial failures.
- [L866–L951] 14. Store 11 — `useAttendanceStore` — Attendance-recording buffer tracking quorum status and active designation-backed presiding officer substitutes.
- [L952–L972] 15. Cross-Store Interaction Rules — Coding conventions prohibiting cross-store imports and defining hooks and read-only constraints.
- [L973–L999] 16. Persistence Rules — Storage configurations specifying which store buffers persist to sessionStorage and what fields are excluded.
- [L1000–L1018] 17. Testing Guidance — Vitest unit testing instructions for verifying actions, vanilla API state, and sessionStorage serialization.
- [L1019–L1037] 18. Known Gaps and Open Questions — Follow-up tracking on resolved issues and the remaining presiding officer substitute display name confirmation.

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

`[Confirmed — ADR-012]` `AuthResponseSchema` (E3 Part 2) is confirmed to return `roleCodes: string[]`, `officeScopeId`, and `officeCode` directly as part of the login response, computed server-side from the user's active role assignments at session-issue time. No second resolving call is made. This was previously `[Unverified]` (F2 v2 §18 item 1) and is now resolved — the `ActiveUserIdentity` state shape below was already designed for this exact payload and requires no change.

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

### Step 1 picker scope

`[Confirmed — ADR-013]` `CERTIFICATION_OF_URGENCY` and `DOCUMENT_REQUEST_FORM` — though both have metadata schemas defined in E3 Part 5 — are **excluded** from the Step 1 document-type picker. Neither is reachable through this store's flow:

- `CERTIFICATION_OF_URGENCY` is logged via `useModalStore`'s `LOG_CERTIFICATION_OF_URGENCY` modal (§6), scoped to an existing measure via `stepInstanceId`. It has no standalone title/classification/series number (Consolidated Reference Part 4.17) and does not fit the Step 2 core-fields shape.
- `DOCUMENT_REQUEST_FORM` is created via the dedicated `useDocumentRequestIntakeStore` (§11), which already models its distinct requester/purpose/payment/printable-PDF shape.

The Step 1 picker's selectable set is: `SP_RESOLUTION`, `SP_ORDINANCE`, `APPROPRIATION_ORDINANCE`, `CITIZEN_COMPLAINT`, and the Phase 1B administrative types as they come online (Letters Received/Sent, Memos Incoming/Outgoing, Notices of Committee Hearing/Special Session, Designations, Barangay Resolutions) — i.e., types that are genuinely freestanding documents with their own title, classification, and series number assigned through the standard intake path.

### What does NOT go here

Document list results, existing document metadata fetched for review — TanStack Query. `[Confirmed — boundary rule §1]`

---

## 9. Store 6 — `useWorkflowActionStore`

**Concern:** Transient UI state for the workflow step action page (`/workflow/steps/:instanceId`). The page renders different action panels conditionally based on `step_type` and `step.name` (F1 §8.2). This store tracks which panel is "active" when a step could legitimately show more than one panel surface, and holds the comment/decision fields before they are submitted. `[Confirmed — F1 §8.2: ten named panels; single dynamic route with conditional rendering]`

`[Confirmed — ADR-010]` The route's identifier is reconfirmed as `instanceId`, matching `workflow.getInstance`'s actual input parameter. No shape change to this store was needed — F2 had already used the correct key prior to ADR-010; ADR-010 closes F1's parallel gap (§14 item 10) on the same question, and this note records that the two documents were checked against each other and found consistent. See ADR-011 for the full propagation review.

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

`[Confirmed — ADR-009]` This store is structurally distinct from the citizen self-service form at `/portal/complaints/new`, which ADR-009 confirms is a no-login public form hosted in `/apps/portal` (per ADR-001) — outside this store's app boundary entirely. `useComplaintIntakeStore` exists only for mode 3 (clerk-assisted, in-person, SP Secretary operating the form on the citizen's behalf); it has no relationship to mode 2's digital self-service entry point. The two should not be conflated in implementation.

`[Confirmed — ADR-004]` `routedToCommitteeId` (Step 4, below) is populated from a committee list now backed by the confirmed `organization.listCommittees` procedure. This was already implicitly a TanStack-Query-sourced list under this document's boundary rule (§1); ADR-004 supplies the procedure name but does not change this store's shape.

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

`[Confirmed — ADR-009]` As with `useComplaintIntakeStore` (§10), this store is structurally distinct from the citizen self-service form at `/portal/requests/new`, which ADR-009 confirms is a no-login public form hosted in `/apps/portal`. This store exists only for mode 3 (clerk-assisted, in-person, SP Secretary operating the form). No shape change results from ADR-009; this note exists to prevent future conflation of the two flows.

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
    lifecycleState: string;            // LifecycleStateSchema value (draft, under_review, pending_mayor_action, pending_panlalawigan_review, approved, released, superseded, cancelled, rejected)
    remarks: string | null;
    firstPageS3Key: string | null;
    canRequestCopy: boolean;
    routingHistoryCount: number;       // just the count for the preview; full history on navigate
    supersededBy: string | null;
    supersededAt: string | null;
    closureReason: string | null;
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

`[Confirmed — ADR-010, ADR-011]` The `ENTER_HEARING_DATE` variant below was patched in this revision against the confirmed `session.enterCommitteeHearingDate` input schema. `stepInstanceId` is the correct targeting identifier for this procedure — consistent with ADR-010's separate confirmation that `instanceId` and `stepInstanceId` are distinct, both-real identifiers in E1; `enterCommitteeHearingDate` is one of the procedures that keys on the step-level identifier. See the usage notes below for the `committeeId` strip-before-send rule and the nullable-`hearingDate` rationale.

### State shape

```typescript
// Represents a pending scheduling change not yet submitted to the server
type PendingScheduleChange =
  | { changeType: "SCHEDULE_FIRST_READING"; documentId: string; sessionDate: string; }
  | {
      changeType: "ENTER_HEARING_DATE";
      stepInstanceId: string;
      /**
       * UI-display-only field. Carries the committee name or ID so the pending-changes
       * list can render a human-readable label (e.g. "Committee on Laws — 2026-07-15")
       * instead of a bare UUID. This field is NOT sent to the server.
       * Stripped before the `session.enterCommitteeHearingDate` mutation fires.
       * [Confirmed — E1 `session.enterCommitteeHearingDate` input schema:
       *   z.object({ stepInstanceId, hearingDate }) — no committeeId parameter]
       */
      committeeId: string;
      /**
       * null = "assigned; date TBD" — a committee referral step may begin without a
       * scheduled hearing date. Matches E1 input: hearingDate z.coerce.date().nullish().
       * [Confirmed — E1; Consolidated Reference Q-C05]
       * Note: sessionDate on SCHEDULE_FIRST_READING is always a non-null Tuesday date;
       * that variant is unaffected.
       */
      hearingDate: string | null;
    }
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
  addEnterHearingDate: (stepInstanceId: string, committeeId: string, hearingDate: string | null) => void;
  removeChange: (index: number) => void;
  clearPendingChanges: () => void;

  setSaving: (isSaving: boolean) => void;
}
```

### Usage notes

`[Inference]` A "pending changes" buffer is used rather than immediate per-action mutations because the SP Secretary typically makes several scheduling adjustments together while reviewing the Order of Business (e.g. scheduling five first readings and entering three committee hearing dates before saving). Batching them into a single review-and-commit flow reduces the risk of partial saves and gives the Secretariat a chance to review the full set of changes before committing.

`[Confirmed — ADR-014]` On save, the component iterates `pendingChanges` **sequentially, in array order** — not in parallel via `Promise.all` — firing each item's corresponding tRPC mutation one at a time and tracking each item's status as `pending` → `committing` → `succeeded` | `failed`. On an item's success, it is immediately removed from the buffer. On an item's failure, it remains in the buffer marked `failed` with its error surfaced inline, and the iteration **continues** to the remaining items rather than aborting the batch. No rollback of already-succeeded items is performed on a later failure — each scheduling change is an independent fact with no transactional relationship to the others. After the pass completes, `session.getOrderOfBusiness` is invalidated once. The buffer, after a partial failure, contains only the failed items; a subsequent save attempt retries only what remains. This was previously `[Inference]` (F2 v2 §18 item 4, "team to confirm") and is now resolved.

`[Confirmed — E1 session.enterCommitteeHearingDate input schema; developer decision June 2026]` When iterating `pendingChanges` on save, the component constructing the `session.enterCommitteeHearingDate` mutation payload must omit `committeeId` — it is a UI-display-only field and is not part of the procedure's input schema. Only `stepInstanceId` and `hearingDate` are sent. A `hearingDate` of `null` is passed as-is; E1 accepts `.nullish()` and the backend treats it as "date TBD."

`[Confirmed — Consolidated Reference Part 8.3, Q-A02: "SP Secretary can manually advance the step — must be audit-logged with a mandatory comment"]` `workflow.manuallyAdvanceMultiReferralStep` (the bypass action) is handled via `useModalStore` → `CONFIRM_ACTION` → inline TanStack Query mutation on the Order of Business page. It is not buffered in this store because it requires an immediate confirmation + mandatory reason, not a staged batch save.

`[Confirmed — Consolidated Reference Part 7.2: "Documents received by Secretariat before the Thursday cutoff are included in the next Tuesday Order of Business"]` `viewingSessionDate` tracks which session the Secretariat is building the Order of Business for. It defaults to the next upcoming Tuesday.

`[Confirmed — Consolidated Reference Part 4.10, Part 7.2, Q-C05: "A committee referral step can begin without a scheduled date (assigned; date TBD)"]` The nullable `hearingDate` directly supports this confirmed business rule: Secretariat staff can stage an `ENTER_HEARING_DATE` pending change for a committee referral before the committee has communicated a hearing date, then return later (a separate pending change, or an edit to this one before save) to fill in the date once known.

---


## 14. Store 11 — `useAttendanceStore`

**Concern:** A local buffer of attendance records being entered for a single SP session before batch submission. `[Confirmed — F1 §9: `SessionAttendanceDetailPage`; `session.recordAttendance` — SP Secretary only]` `[Confirmed — Consolidated Reference Part 7.3: "Absence input timing: recorded before the session; absence reasons: OB, sick leave, vacation leave, absent (unqualified)"]`

`[Confirmed — E3 Part 11: `CreateSpSessionInputSchema` — `attendanceRecords: z.array(...)` — quorum requires ≥ 7 present; `AttendanceStatusSchema`: ["present", "absent_ob", "absent_sick", "absent_vacation", "absent"]]`

`[Confirmed — ADR-007]` The Designation document type is pulled into Phase 1, resolving the dependency this store previously deferred (F1 §9, §14 item 7). The state shape below now models `presidingOfficerSubstituteId` directly. See the usage notes for sourcing details.

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

  // Designated presiding officer substitute for this session, if the active VP/presiding
  // officer is unavailable and a Designation document has assigned a substitute beforehand.
  // null = no active substitute designation for this session; the regular presiding officer
  // (SpSessionSelectSchema.presidingOfficerEmployeeId) applies.
  // [Confirmed — ADR-007: Designation document type is Phase 1]
  presidingOfficerSubstituteId: string | null;

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

  setPresidingOfficerSubstitute: (employeeId: string | null) => void;

  setSubmitting: (isSubmitting: boolean) => void;
  reset: () => void;                   // called after successful submission
}
```

### Usage notes

`[Inference]` `initSession` is called when the SP Secretary opens the attendance detail page for a given session. It seeds the `records` buffer with all 12 SP members (loaded from TanStack Query via `organization.getOfficeHierarchy` or a dedicated committee-member list) defaulted to `"present"`. The Secretariat then marks absences. This matches the operational pattern where most sessions have full or near-full attendance and absences are the exception.

`[Confirmed — Consolidated Reference Part 7.3: "Statistics: count of present/absent councilors; graph of attendee numbers over time — UI requirement: Session detail view: who is absent and why; visible before session"]` `presentCount` and `quorumMet` are derived from `records` synchronously in the store (either as computed in Zustand's selector or recomputed in the action that updates `records`). The attendance statistics graph over time is a TanStack Query concern, not stored here.

`[Confirmed — E3 Part 11: `CreateSpSessionInputSchema` refine — "at least 7 members must be present"]` The quorum check (`quorumMet`) is surfaced in the UI as a warning indicator while the Secretary is recording attendance. Submission is blocked if `quorumMet === false` and the session type is `"regular"`. `[Inference — the source confirms the quorum rule; the block-on-submit behavior is this document's proposed implementation]`

`[Confirmed — ADR-007, ADR-016, Developer Decision June 2026]` `presidingOfficerSubstituteId` is populated by `setPresidingOfficerSubstitute`, called when the component resolves an active Designation-backed substitute for the SP Presiding Officer role covering `sessionDate`. The confirmed procedure is **`organization.getActiveDesignations`** (E1, Organization Router) — a `query` taking `z.void()` input and returning **every** currently active designation system-wide, unfiltered by role, office, or date. There is no server-side parameter to narrow this to "the presiding officer, for this date" — the component must:

1. Filter the returned array client-side for the row whose `positionTitle` matches the SP Presiding Officer position's literal display string (confirmed as `"Presiding Officer"`);
2. Confirm `sessionDate` falls within that row's `[validFrom, validUntil]`;
3. Pass the matching row's `delegatedToUserId` to `setPresidingOfficerSubstitute`; pass `null` if no row matches.

Because only one active designation per person is permitted and designations auto-expire (Consolidated Reference Part 11.13), at most one row can match the position-title filter at a given moment — but the *query itself* returns the full unfiltered list, so naively taking `data[0]` without the filter above would pick an unrelated active designation (e.g. Acting Mayor grant) if one happens to exist concurrently. This procedure name and shape were previously `[Unverified]` (F2 v2 §18 item 6) and are now resolved.

`[Confirmed — Consolidated Reference Part 11.13: "One active designation per person enforced... Auto-expires at end date: routing returns to original authority automatically"]` Because only one active designation per person is permitted and designations auto-expire, the component does not need to handle multiple competing substitute candidates — at most one active Designation-backed substitute can exist for the presiding-officer role at any given session date.

### What does NOT go here

Historical attendance records across sessions, the attendance statistics graph data, the Designation document record itself, and the underlying `delegation_grant` row — all TanStack Query. `[Confirmed — boundary rule §1]`

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

`[Inference]` `useAttendanceStore`'s `presidingOfficerSubstituteId` (added in this revision per ADR-007) is a raw input value, not a derived field — it persists under the existing "all fields" rule with no `partialize` exclusion needed.

`[Confirmed — boundary rule §1]` Persisted draft data in `sessionStorage` is UI state, not server state, and does not violate the JWT/cookie-only auth constraint. It holds form field strings and IDs, not credentials, tokens, or server-side entity data.

---

## 17. Testing Guidance

`[Confirmed — Stack Context: "Testing: Vitest (unit/integration) + Playwright (E2E)"]`

Each store should have a Vitest unit test file alongside it (`shell.store.test.ts`, etc.) covering:

- Initial state correctness (all fields match documented defaults)
- Each action's effect on state in isolation
- Persistence round-trip (for stores using `sessionStorage` persist): serialize → deserialize → state matches
- Cross-action sequences that mirror real user flows (e.g. for `useDocumentIntakeStore`: `selectDocumentType` → `setCoreFields` → `setMetadata` → `setUploadComplete` → confirm state shape is correct before submit)
- `[Confirmed — ADR-016]` **Required:** a test asserting that the Order of Business save-orchestration logic (§13), when given a `pendingChanges` buffer containing an `ENTER_HEARING_DATE` item with a non-null `committeeId`, assembles a `session.enterCommitteeHearingDate` mutation payload containing exactly `{ stepInstanceId, hearingDate }` — with no `committeeId` key present at all, including as `undefined`. This guards against `committeeId` (a UI-display-only field per §13's state shape) leaking onto the wire via an incautious object-spread during a future refactor. This test lives at the component/hook level (the save-orchestration logic, not the store itself, per §15 Rule 1) but is listed here as required Phase 1 sign-off coverage rather than left to be inferred from the general cross-action-sequence guidance above.
- `reset()` returns all fields to initial values

`[Inference]` Stores should be tested without any React rendering (plain function calls on the store's `getState()` and action functions). This is straightforward with Zustand's vanilla store API. No component or hook is needed in store unit tests.

`[Inference]` The cross-store interaction patterns (Rule 1–5 in §15) are tested at the component level via Playwright E2E tests or React Testing Library integration tests, not at the store level.

---

## 18. Known Gaps and Open Questions

`[Confirmed — ADR-012 through ADR-016, Developer Decision June 2026]` All items, including the subsequent follow-up on the presiding officer's position title string, are resolved. F2 carries zero open items.

### Resolved in this revision (and carried forward from v2)

| # | Gap (as originally identified) | Resolution | ADR |
|---|---|---|---|
| 1 | `useSessionStore` must hold `roleCodes` for synchronous ABAC checks; login response shape (flat `string[]` vs. full `RoleAssignmentSelectSchema[]`) was unconfirmed. | `AuthResponseSchema` extended to return `roleCodes: string[]`, `officeScopeId`, `officeCode` directly, computed server-side at login. No second call; no store shape change. | [ADR-012](./f2-zustand-store-design-adrs/ADR-012-session-store-rolecodes-shape.md) |
| 2 (orig.) | The Phase 1B Designation document type tension in `useAttendanceStore` (presiding-officer substitute field deferred pending Designation reaching Phase 1). | Designation pulled into Phase 1; `presidingOfficerSubstituteId` modeled directly. | [ADR-007](./ADR-007-designation-document-type-phase1.md), [ADR-011](./f2-zustand-store-design-adrs/ADR-011-f2-propagation-of-f1-adrs.md) |
| 3 | Whether CERTIFICATION_OF_URGENCY and DOCUMENT_REQUEST_FORM appear in the Step 1 document-type picker needed a product decision. | Both excluded; each is created only through its own dedicated entry point (`LOG_CERTIFICATION_OF_URGENCY` modal; `useDocumentRequestIntakeStore`). | [ADR-013](./f2-zustand-store-design-adrs/ADR-013-document-intake-picker-scope.md) |
| 4 | Partial batch-failure UX for `useOrderOfBusinessStore.pendingChanges` was not detailed in any source document. | Sequential per-item commit; failed items remain in the buffer, highlighted, and retryable; no rollback of prior successes. | [ADR-014](./f2-zustand-store-design-adrs/ADR-014-order-of-business-batch-save-error-handling.md) |
| 5 | SSE reconnection strategy for `useNotificationDrawerStore.newArrivalCount` was not described in any source document. | Native `EventSource` reconnect + server-side `Last-Event-ID` replay as primary mechanism; unconditional TanStack Query refetch on drawer open as a correctness backstop; no continuous background poll added. | [ADR-015](./f2-zustand-store-design-adrs/ADR-015-sse-reconnection-strategy.md) |
| 6 | Procedure name for the presiding-officer-substitute lookup was unconfirmed; `committeeId` strip-before-send convention lacked specified test coverage. | Confirmed as `organization.getActiveDesignations` (unscoped — client-side filter by `positionTitle` + date range required). Strip-before-send Vitest case added as an explicit required test in §17. | [ADR-016](./f2-zustand-store-design-adrs/ADR-016-designation-lookup-procedure-and-test-coverage.md) |
| 7 | The literal display string for the SP Presiding Officer `positionTitle` value returned by `organization.getActiveDesignations` (e.g. `"Vice Mayor"`, `"Presiding Officer"`, or something else) is not confirmed against actual `organization.positions` seed data. `useAttendanceStore`'s client-side filter (§14, per ADR-016) cannot be implemented exactly until this string is confirmed. | Confirmed as `"Presiding Officer"`. §14's client-side filter is updated to use this literal string. | Developer decision / seed data check |

---

*This document supersedes any informal or ad-hoc Zustand store definitions that may exist in `/apps/web` prior to Phase 1 development start, and supersedes the original (v1/v2) `f2-zustand-store-design.md` in full as a standalone document. All new stores must be added to this catalog with the same structure: store name, state shape, actions, usage notes, and explicit boundary from TanStack Query. This document is updated after any stakeholder interview, developer decision, or UI design change that introduces a new modal, multi-step form, or persistent UI state requirement. This v3 revision incorporates the resolutions of all gaps from v2 via ADR-012 through ADR-016, plus the follow-up confirmation on the presiding officer's position title.*
