# ADR-UI-018: Highlight Mark Extension for RichTextEditor — Single-Color Only

**Status:** Proposed **Date:** August 2026 **Deciders:** Development team (planning-layer research, pending human confirmation)

---

### Context

`RichTextEditor` (ADR-UI-017) currently exposes every zero-new-dependency formatting
capability bundled by `@tiptap/starter-kit`: Bold, Italic, Bullet/Ordered List,
Underline, Strikethrough, Heading (H3/H4), Blockquote, Horizontal Rule, Link, Undo/Redo.
No further capability can be added without a new top-level dependency, which F5 §8
Procedure B requires an ADR to introduce.

This component serves comment/remarks/report fields across SP Resolution and other
document-type workflow panels (ADR-UI-017's Context). A recurring, functionally
motivated need in this domain — distinct from marking text as merely *important*
(bold) or as an *aside/term* (italic) — is flagging a specific phrase for another
reviewer's attention: a discrepancy to check, an amended figure, a point requiring
follow-up. No existing mark in the current toolbar serves this signal.

### Decision

Add **`@tiptap/extension-highlight`** (exact version `3.29.2`, matching this project's
existing pinned-version convention for every `@tiptap/*` package per ADR-UI-017's own
stated mitigation for cross-package version-drift risk) as a new toolbar mark.

**Scope: single default color only.** The extension's `multicolor` option defaults to
`false`; this ADR adopts that default rather than opting into `multicolor: true`. A
single highlight color (the extension's default `<mark>` rendering) is sufficient to
serve the "flag this for attention" use case above. A full color picker is explicitly
rejected in this decision — see Alternatives Considered.

New toolbar button: `Highlight` (`toggleHighlight()`), inserted immediately after the
existing Strikethrough button and before Heading 3 — grouped with the other text-level
marks (Bold/Italic/Underline/Strike/Highlight) rather than with the block-level
additions (Heading/Blockquote/HR) that follow. `isActive('highlight')` drives the
existing toggle-button visual/`aria-pressed` pattern identically to every other mark
in this component.

### Alternatives Considered

**Full multicolor highlight (`Highlight.configure({ multicolor: true })`) with a color
picker** — Rejected for this iteration. A color picker is a materially larger UI
surface than a toggle button (this project has no existing color-picker component in
`packages/ui/src/components/ui/` to reuse, so one would need to be built), introduces
a "which colors are appropriate for a government document tool" design question this
codebase's current token set doesn't answer, and adds contrast/accessibility
verification surface (arbitrary highlight colors against arbitrary future light/dark
theming) with no corresponding functional requirement identified. Single-color
highlight already fully serves the "flag for attention" use case motivating this
ADR. Can be revisited if a concrete multi-category flagging need emerges (e.g.,
distinguishing "needs legal review" from "needs figure verification" by color) —
this is not a lock-in decision; `multicolor` is a configuration flag on the same
package, not a different package.

**Text Align (`@tiptap/extension-text-align`)** — Considered and rejected as the
*next* extension to propose (not merely deferred — actively assessed and set aside
for this decision point). Alignment serves document-layout concerns (centering a
title, justifying body text) that a panel-embedded comment/remarks field does not
functionally have; no reviewer workflow in this codebase's requirements documents
was found to need it. Aesthetic-only relative to this component's stated purpose.

**Tables (`@tiptap/extension-table` + `-row`/`-cell`/`-header`)** — Considered and
rejected as the next extension to propose. Heaviest of the three candidates: requires
four separate `@tiptap/*` packages rather than one, compounding the peer-dependency
lockstep-breakage risk ADR-UI-017 already flags as a known trade-off of this library
choice. Tables also degrade poorly in this component's existing constrained contexts
— `MultiReferralPanel.tsx`'s read-site renders this content inside a `line-clamp-2`
preview, where a table has no reasonable clamped representation.

### Consequences

**Positive**
- Serves a concrete, domain-motivated need (attention-flagging) not covered by any
  existing mark.
- Single new package, no compounding multi-package dependency risk.
- No new design-token or color-system decision required — the extension's own
  unconfigured default (`multicolor: false`) is exactly the scope this ADR adopts,
  so implementation requires no deviation from the library's own default posture.

**Negative / Trade-offs**
- One more `@tiptap/*` package to keep in lockstep version-pinning with the rest,
  per ADR-UI-017's already-established mitigation pattern.
- `<mark>` is a new HTML tag reaching `sanitizeRichText()` and both existing
  read-sites (`MultiReferralPanel.tsx`, the dev route) for the first time — DOMPurify's
  default-allowlist behavior toward `<mark>` needs the same direct empirical
  verification this project has applied to every other new tag (not assumed from
  documentation), and both read-sites' CSS selector lists need a
  `[&_mark]:bg-{token}` (or equivalent) addition, following the exact established
  pattern used for every prior mark added to this component.
- If a genuine future need for multiple highlight categories emerges, `multicolor:
  true` is a config change, not a new-dependency ADR — but the color-token and
  accessibility questions deferred by this ADR would need to be answered at that
  point, not before.

### Related Decisions

- ADR-UI-017 (RichTextEditor library choice, HTML-string storage, DOMPurify mandate)
- F5 (UI Component Library Setup and Package Architecture) — §4.3, §8 Procedure B
