# ADR-009: No Authenticated Account Required for Portal Request/Complaint Forms

**Status:** Accepted
**Date:** 2026-06-19
**Resolves:** F1 §14 gap #9 (also referenced in F1 §13.2)
**Decision owner:** Luke (product/architecture owner)

## Context

F1-Context confirms three access modes for both Document Requests and Citizen Complaints `[Confirmed — F1-Context §10, "Three access modes," Interview 2]`:

1. Citizen downloads a template from `sp.batac.gov.ph` and submits a physical document with a handwritten/wet-ink signature.
2. Citizen inputs details on a digital form in batac-dms; the system generates a printable form; the citizen prints, signs, and submits it.
3. Citizen goes to the Secretariat in person; a clerk inputs the information into a digital form and prints it on-site for the citizen to sign on the spot.

`[Confirmed — F1-Context §10]` Physical submission with a signature is required regardless of mode — the digital form captures data and generates a formatted document, but is not a replacement for the physical submission. F1 had not resolved whether `/portal/requests/new` and `/portal/complaints/new` (mode 2's entry point) require a citizen to hold an authenticated account before using the digital form, since neither source stated this directly.

## Decision

**`/portal/requests/new` and `/portal/complaints/new` are no-login, public forms.** No authenticated citizen account is required to use them.

## Rationale

- Modes 1 and 3 clearly require no digital account at all — mode 1 is a pure offline/download flow, and mode 3 is handled entirely by a clerk on the citizen's behalf. Requiring login only for mode 2 would create an inconsistent evidentiary/access path for what is otherwise the same outcome (a signed physical submission) across all three modes.
- The physical signature, not the digital account, is what is legally operative — `[Confirmed — F1-Context §10]` the digital form is explicitly a data-capture and formatting convenience, not a replacement for the physical submission. An account requirement adds friction without changing what is legally required to complete the request.
- This does not weaken citizen status-tracking: `/portal/requests/:requestId/status` and `/portal/complaints/:complaintId/status` remain authenticated-citizen-only routes, exactly as already confirmed in I2 ("View own document request status" and "View own submitted complaint and status" are both Citizen-only) `[Confirmed — I2 §13, §12]`. This decision affects only the initial submission forms, not the status-tracking pages.

## Consequences

- `/portal/requests/new` (`PortalDocumentRequestFormPage`) and `/portal/complaints/new` (`PortalComplaintFormPage`) are gated as **Public, no authentication required** in the updated route map, rather than "Public / Citizen — see note."
- `[Inference]` Since no account exists at submission time, linking a no-login submission to a later status check needs a non-account-based key. The tracking-number mechanism already used by `/portal/lookup` and `/portal/documents/:trackingNumber` is the natural fit — `[Confirmed — F1-Context §10]` a generated request/complaint should be issued a tracking number at creation, which the citizen can later use to either look it up via `/portal/lookup` or to authenticate/associate it with an account if they choose to register afterward. This linkage mechanism is not itself specified in any source document and is this ADR's own proposed direction, not a confirmed requirement.
- `[Speculation]` Whether a citizen who registers an account *after* a no-login submission can retroactively claim/link that submission to their account (so it then shows up under their authenticated status page) is not addressed by any source document or by this ADR. This is a follow-up design question for whoever builds the registration/linking flow.
- F1 §13.2 and §14 gap #9's `[Unverified]` status are superseded by this ADR.

## Alternatives considered

- **Require login for both forms.** Would unify the digital-submission flow with the account-based status-tracking flow, but creates an inconsistency with modes 1 and 3 (which never require an account) and adds friction for citizens who may submit only once. Not selected.

## Traceability

- F1-Context §10 (Three access modes; digital-form-not-a-replacement note)
- I2 §12, §13 (citizen-only status-view rows)
- F1 §13.2, §14 gap #9
