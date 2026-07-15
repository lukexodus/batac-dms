# Glossary

Terms and abbreviations that appear constantly across this repo's code,
tests, and documentation, with no single definition point until now. If
you're new to this project, this is worth skimming once on day one.

This is a **living document** — if you hit a term in the docs or code that
isn't here, add it. Keep entries short: one or two sentences, plus a
pointer to the source document if the full detail lives elsewhere. Don't
let this file grow into a second copy of the architecture — if an entry
needs more than a few sentences to be useful, that's a sign the detail
belongs in its source document and this entry should just point there.

---

## Domain terms

### Certified Urgent

A path triggered by the Mayor issuing a formal document certifying urgency
on a Resolution or Ordinance. Its effect: **First and Second Reading occur
in the same session**, and the measure **skips committee review and report
entirely**. Described as frequent in practice, not an edge case. Scoped
for Phase 1 (not deferred to Phase 1B).
→ Full detail: consolidated reference, Part 4.1 and Part 4.2 (numbering
and flow per document type); Part 11.3 (workflow engine treatment);
D2 §2 and §5 (sequence diagrams for the Certified Urgent path,
Resolution and Ordinance respectively).

### Panlalawigan (Sangguniang Panlalawigan)

The Provincial Board — the reviewing body that both Resolutions and
Ordinances are transmitted to _after_ Mayor action (signature or lapse).
Panlalawigan review has its own automated **30-day timer**: see
[Lapse timer](#lapse-timer) below for how this differs from the Mayor's
10-day timer.
→ Full detail: consolidated reference, Part 4.3 (review sequence, tracked
log fields, outcome actions); D2 §7 (all four outcome paths).

### Lapse timer

Not one timer — **two**, for two different actors, and it's easy to
conflate them:

- **10-day lapse (Mayor):** If the Mayor takes no action on a Resolution
  or Ordinance within 10 days, it **lapses into law** by operation of
  RA 7160, is logged with that legal basis, and the SP Secretary is
  notified. Applies to both Resolutions and Ordinances.
- **30-day lapse (Panlalawigan):** If Panlalawigan takes no action within
  30 days of transmittal, the measure is **deemed approved** under
  RA 7160 Section 56(d).

Both are automated timers implemented as scheduled jobs in the workflow
engine (`evaluateMayorLapseTimers`, `evaluatePanlalawiganTimers` — see
`apps/server/src/modules/workflow/jobs/`), not manual follow-ups.
→ Full detail: consolidated reference, Part 4.1/4.2 (Mayor lapse) and
Part 4.3 (Panlalawigan lapse); Part 11.3 (engine-level timer handling).

### Multi-referral (`multi_referral`)

A workflow step type — distinct from a simple single-committee referral —
used when a measure is referred to **more than one committee at once**.
Key behaviors, not just "more than one committee reviews it":

- **All** assigned committees must sign/contribute to the unified report
  (not just one of them).
- A committee missing the Thursday cutoff **delays Second Reading**.
- Absent committees are marked **red** in the Order of Business, but this
  does not stop the hearing itself.
- The SP Secretary can **manually advance** past a non-responding
  committee, but only with a mandatory, audit-logged comment.

This is a finalized, Phase-1-required step type — not deferred, not
optional. Reserved-but-unused sibling step types (`parallel_split`,
`parallel_join`) exist in the schema for Phase 2 and should not be
confused with `multi_referral`.
→ Full detail: consolidated reference, Part 8.3 (the decision itself,
"Option B") and Part 10.4 (module boundary implication); B4 (workflow
engine spec) for the step-type implementation; D2 relevant sequence
diagrams for where multi-referral appears in a given document type's flow.

### Thursday cutoff

The weekly deadline, tied to committee report submission, that determines
whether a multi-referral measure can proceed to Second Reading on
schedule. Missing it doesn't fail the measure — it delays it and triggers
the red-flag/manual-advance behavior described under
[Multi-referral](#multi-referral-multi_referral) above.
→ Implementation: `evaluateThursdayCutoffs` job, `apps/server/src/modules/workflow/jobs/`.
→ Spec: consolidated reference, Part 7.2 (Session Patterns and Scheduling).

### Two-stage numbering (preliminary / final)

Every Resolution, Ordinance, and Appropriation Ordinance gets a
**preliminary "Draft" number** at Secretariat logging, and a separate
**final number** assigned after the last reading's vote (before VP and
Mayor sign). These are not the same number reused — they're two distinct,
sequential assignments, and the gap between them is deliberate, not a bug.
→ Full detail: consolidated reference, Part 5 (Numbering System);
H3 (numbering-series configuration spec).

### ARTA / RA 11032

The Anti-Red Tape Act — the legal basis for SLA (service-level agreement)
tracking on legislative processing. When you see "ARTA SLA" in code or
docs, it refers to deadline/escalation tracking required by this law, not
an internal invention.
→ Full detail: consolidated reference, Part 11.19 (Compliance);
K2 (workflow engine test suite design) ADR-TST-008 for the specific
escalation test scope.

---

## Module abbreviations

These prefixes appear in task IDs (`TASK-WF-025`), commit messages
(`feat(wf): ...`), and directory names. All six implemented-as-code
modules live under `apps/server/src/modules/`.

| Abbreviation | Full name                          | Code path                                   | What it owns                                                                 |
| ------------ | ---------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------- |
| **WF**       | Workflow                           | `apps/server/src/modules/workflow/`         | Workflow definitions, instances, step instances, transitions, timers, events |
| **DOCS**     | Documents                          | `apps/server/src/modules/documents/`        | Document types, documents, versions, attachments, numbering, signatures      |
| **TRACK**    | Tracking                           | `apps/server/src/modules/tracking/`         | QR codes, tracking records, routing history                                  |
| **ORG**      | Organization                       | `apps/server/src/modules/organization/`     | Offices, positions, employees, assignments, delegations/designations         |
| **IAM**      | Identity and Access Management     | `apps/server/src/modules/iam/`              | Users, credentials, sessions, roles, permissions, ABAC policy evaluation     |
| **AUDIT**    | Audit (Log)                        | `apps/server/src/modules/audit/`            | Append-only, hash-chained audit events                                       |
| **INFRA**    | Infrastructure                     | _(cross-cutting — not a single module dir)_ | Monorepo tooling, env config, Docker/Compose, CI, event bus, backups         |
| **UI**       | User Interface (component library) | `packages/ui/`                              | Shared React component library (shadcn/ui + Radix on Tailwind)               |
| **FE**       | Frontend (application)             | `apps/web/`                                 | The actual pages/routes built on top of `UI` and the module tRPC routers     |

Note the distinction between **UI** (the shared component library — Tier
1/2/3 components) and **FE** (the actual application pages that consume
those components). They're tracked as separate task categories in the
project checklist for a reason — a component existing in `packages/ui`
doesn't mean a page using it exists yet in `apps/web`.

Two module abbreviations you'll see referenced in architecture docs but
**not** yet as a code directory: `records` and `reporting` (Phase 2),
`search_meta` and `portal` (Phase 3, as a backend module — not to be
confused with the existing `apps/portal` scaffold, which is the frontend
shell for that future module). If you're looking for one of these in
`apps/server/src/modules/` and can't find it, that's expected — it's
planned, not missing.
→ Full module boundary list: consolidated reference, Part 10.2.

---

## Document ID conventions (B1, D2, K2, etc.)

You'll see documents referred to by a letter-number ID (`B4`, `D2`, `K2`,
`H1`) rather than by full filename. The letter identifies the document
_group_:

| Group | Covers                                 |
| ----- | -------------------------------------- |
| A     | Project planning                       |
| B     | Architecture documents                 |
| C     | Database                               |
| D     | UML and diagrams                       |
| E     | API design                             |
| F     | Frontend architecture                  |
| G     | End-to-end type safety                 |
| H     | Domain configuration                   |
| I     | Security and authorization             |
| J     | Software design patterns and standards |
| K     | Testing                                |
| L     | Infrastructure and DevOps              |

The number distinguishes documents within a group (e.g., B1 = System
Architecture, B4 = Workflow Engine Specification). ADRs (Architecture
Decision Records) referenced inline, like `ADR-WFL-004` or `ADR-TST-009`,
are separate short documents recording one specific decision — they live
in an `-adrs/` subfolder next to the document group they belong to.
→ Full index: `docs/pre-development/document-list.md`; routing by task
type: `AGENTS.md` at the repo root.
