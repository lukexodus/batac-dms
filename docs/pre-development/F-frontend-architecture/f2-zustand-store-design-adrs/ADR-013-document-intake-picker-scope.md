# ADR-013: CERTIFICATION_OF_URGENCY and DOCUMENT_REQUEST_FORM Excluded from `useDocumentIntakeStore` Step 1 Picker

**Status:** Accepted
**Date:** 2026-06-19
**Deciders:** Development team (product-facing UX decision), product owner approval
**Affected documents:** F2 (`f2-zustand-store-design.md`) §8 `useDocumentIntakeStore`; F1 (`f1-application-route-map.md`) — Step 1 document-type picker, if it enumerates these codes

---

## Context

`useDocumentIntakeStore` (F2 §8) drives a generic five-step "new document" intake flow: select type → core fields (title, classification, originating office) → type-specific metadata → file upload → review/submit. E3 Part 5 defines per-document-type metadata schemas for `SP_RESOLUTION`, `SP_ORDINANCE`, `APPROPRIATION_ORDINANCE`, `CITIZEN_COMPLAINT`, `DOCUMENT_REQUEST_FORM`, and `CERTIFICATION_OF_URGENCY` — all six therefore *could* render a Step 3 form via the existing per-type dispatch pattern.

The open question was whether `CERTIFICATION_OF_URGENCY` and `DOCUMENT_REQUEST_FORM` should be selectable in the Step 1 picker (making them reachable through this generic flow) or whether they should be excluded and only reachable through their own dedicated entry points.

This is a product/UX scope decision — it determines what a user sees and can click in the application — not a pure technical state-shape question, so it is recorded as an ADR.

## Decision

**Both `CERTIFICATION_OF_URGENCY` and `DOCUMENT_REQUEST_FORM` are excluded from the Step 1 picker.** Each is created only through its own dedicated entry point:

- **`CERTIFICATION_OF_URGENCY`** is logged via the existing `useModalStore` `LOG_CERTIFICATION_OF_URGENCY` modal (F2 §6), invoked from a workflow action page or the Order of Business view, scoped to an already-existing measure (`stepInstanceId` in context).
- **`DOCUMENT_REQUEST_FORM`** is created via the dedicated `useDocumentRequestIntakeStore` (F2 §11), which already models the in-person clerk-assisted flow with its own requester/purpose/payment/printable-PDF shape, distinct from the no-login citizen portal path (per ADR-009).

The Step 1 picker is scoped to: `SP_RESOLUTION`, `SP_ORDINANCE`, `APPROPRIATION_ORDINANCE`, `CITIZEN_COMPLAINT`, and the Phase 1B administrative types (Letters, Memos, Notices, Designations, Barangay Resolutions) as those come online — i.e., document types that are genuinely freestanding new documents with their own title, classification, and series number assigned through the standard intake path.

## Rationale

1. **Certification of Urgency is not a standalone document by its own confirmed definition.** Consolidated Reference Part 4.17 states it explicitly: "No standalone number... the Certification is always associated with and referenced by the document(s) it certifies... not filed as a standalone document." Step 2 of the generic intake flow asks for `title`, `classificationLevel`, `originatingOfficeId` — none of which a Certification of Urgency meaningfully has on its own. Routing it through a form built for freestanding documents would force the user to supply data the document type doesn't actually carry.
2. **The dedicated modal already exists and already fits.** `LOG_CERTIFICATION_OF_URGENCY` (F2 §6, `ModalPayload` union) already takes exactly the right input — `stepInstanceId` — i.e. "which existing measure does this attach to," which is the only thing a Certification of Urgency actually needs at creation time per Part 11.3's described system integration. Building a second path through the generic picker would create two ways to create the same record with inconsistent required fields.
3. **Document Request Form already has a purpose-built flow with regulatory shape.** Part 4.15 confirms three specific access modes (citizen template + physical signature; citizen digital form + print + sign; in-person clerk-assisted) and dual VM + SP Secretary approval. `useDocumentRequestIntakeStore` (F2 §11) was already built around requester info, purpose, payment reference, and printable PDF URL — a materially different shape from `DocumentIntakeState`'s file-upload-centric design (Step 4 of the generic flow is "upload a file to S3," which is backwards for a request *form being generated*, not a file being uploaded). Forcing it through the generic picker would be a shape mismatch, not just a UX inconsistency.
4. **Avoids duplicate, divergent creation paths.** If both a dedicated flow and the generic picker could create the same record type, the two paths will inevitably drift (different validation, different required fields, different post-creation side effects), and support/training has to cover both. Removing the generic path for these two types removes that drift risk entirely rather than managing it.

## Alternatives Considered

**Include both in the Step 1 picker.** Rejected — would require Step 2's core-fields form to either fake fields these types don't have (title/classification for a Certification of Urgency) or branch Step 2 itself by type, which adds complexity to the one step in the flow that was designed to be type-agnostic. Provides no benefit over using the already-built dedicated entry points.

**Include `DOCUMENT_REQUEST_FORM` only, exclude `CERTIFICATION_OF_URGENCY` only.** Rejected as a partial measure — `useDocumentRequestIntakeStore` already fully covers the Document Request use case with a better-fitted shape; routing it through the generic picker in addition would be pure duplication with no offsetting benefit.

## Consequences

- F1's Step 1 document-type picker (wherever it enumerates selectable types) must not list `CERTIFICATION_OF_URGENCY` or `DOCUMENT_REQUEST_FORM`.
- `useDocumentIntakeStore`'s Step 3 dispatch-by-`selectedDocumentTypeCode` pattern (F2 §8) never needs to render the `CERTIFICATION_OF_URGENCY` or `DOCUMENT_REQUEST_FORM` metadata schemas from E3 Part 5 — those schemas are consumed instead by the Certification-of-Urgency modal form and `useDocumentRequestIntakeStore`'s own Step 3-equivalent, respectively.
- No change to `useModalStore` or `useDocumentRequestIntakeStore` is required by this ADR — both already model the correct flow. This ADR formalizes that the generic intake store is deliberately *not* also wired to these two types.
