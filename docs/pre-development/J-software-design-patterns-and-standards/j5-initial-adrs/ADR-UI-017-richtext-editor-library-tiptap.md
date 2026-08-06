# ADR-UI-017: Rich-Text Editor Library — TipTap over Lexical, Slate, CKEditor, TinyMCE

**Status:** Accepted **Date:** August 2026 **Deciders:** Development team (planning-layer research, human-confirmed)

---

### Context

Workflow action panels across the SP Resolution (and other document-type) lifecycle
collect free-text comment/remarks/report input via a plain shadcn `Textarea`
(F5 §4.1, `packages/ui/src/components/ui/textarea.tsx`). Product requirement: replace
plain-text input with a WYSIWYG rich-text editor for these fields. No entry for this
component class exists in F5 §4.3's Tier 3 inventory. F5 §8 Procedure B step 4
requires an ADR before adding a new npm dependency to `packages/ui`.

### Decision

Adopt **TipTap** (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`) as the
rich-text editor library, wrapped in a new Tier 3 component `RichTextEditor`.

Content is stored and transmitted as a **sanitized HTML string** (TipTap's
`editor.getHTML()` output), not TipTap's native JSON document format. Server-side
sanitization via **DOMPurify** (`dompurify` on the server; content is never trusted
as pre-sanitized from the client) is mandatory before any TipTap-sourced HTML is
persisted to `workflow_events.payload` (jsonb).

### Alternatives Considered

**Lexical (Meta)** — TypeScript-first, smaller core bundle, MIT. Rejected: smaller
plugin/toolbar ecosystem than TipTap as of this evaluation; this codebase's
`packages/ui` is a headless/Radix-composed architecture already, which both
TipTap and Lexical satisfy equally, so ecosystem breadth was the deciding factor.

**Slate** — React-native model. Rejected: API explicitly described as still evolving
across versions by its own maintainers; higher long-term breaking-change risk for a
government-client codebase that needs stability over novelty.

**CKEditor 5, TinyMCE, Froala** — Rejected: CKEditor 5 is GPL-2-or-commercial;
TinyMCE's core is MIT but premium plugins require a license key; Froala is
closed-source, commercial-only. All three are unnecessary weight (hundreds of KB
gzipped) for a comment/remarks field, and the licensing terms introduce cost/compliance
surface this project has no stated budget or requirement for.

**JSON-document storage (TipTap's native format) instead of HTML string** — Rejected
for this iteration: `MultiReferralPanel.tsx` already renders `submission.reportText`
as plain JSX text — the one existing read-site for any of these fields. An HTML
string can be sanitized and rendered via `dangerouslySetInnerHTML` with a one-line
change at that site. A JSON-document format would need a TipTap-specific JSON→HTML
(or JSON→React) renderer built and wired into that same site for equivalent
functionality, for no compatibility or safety benefit over the HTML-string approach.
This can be revisited if collaborative editing or structured-content queries become
a requirement later — TipTap supports both storage formats natively, so this is not
a lock-in decision.

### Consequences

**Positive**
- Matches the existing headless/Radix-first architecture of `packages/ui`.
- No DB migration required — `workflow_events.payload` is `jsonb`
  (`packages/database/schema/workflow.schema.ts:389`); an HTML string fits as a
  jsonb string value with no schema change.
- MIT-licensed core, no commercial licensing exposure for a government client.

**Negative / Trade-offs**
- TipTap has no built-in HTML sanitizer — DOMPurify is a new, separate dependency
  this project did not previously have.
- TipTap's extension packages (`@tiptap/*`) have a documented history of
  peer-dependency lockstep breakage when versions drift independently across a
  package manager's resolution — mitigated by pinning exact, identical version
  numbers across every `@tiptap/*` package rather than caret ranges.
- Every server-side Zod validator currently checking `z.string().min(1)` or a
  `.trim() === ''` truthiness check against these fields needs updating, since an
  empty rich-editor value serializes as non-empty markup (e.g. `<p></p>`), not an
  empty string.

### Related Decisions

- F5 (UI Component Library Setup and Package Architecture) — §4.1, §4.3, §8
  Procedure B.
