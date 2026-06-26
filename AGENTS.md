# Batac City LGU Platform

This file tells an AI agent which documents to read for a given task, and — just
as important — what to do when no document answers the question. Read this file
first. Do not open any document under `docs/` until you have matched your task to
a row below.

## How to use this file

1. Find your task in the **Task → Documents** table.
2. Open only the documents listed in the **Read** column, in the order listed.
3. Check `docs/development-findings-log.md` for any `confirmed` entries tagged with
   the same document IDs as your task row, or with the module name you're working
   in. See Section 4.5 for how this log works.
4. If your task is not in the table, go to **Section 3: Unlisted tasks** before
   reading anything.
5. If, while doing the work, you hit a question that none of the documents you read
   answers, go to **Section 4: When no document has the answer** — do not guess
   silently.

---

## Section 1: Source-of-truth hierarchy

When documents conflict, this is the resolution order, highest first:

1. `docs/requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md`
   — stakeholder-confirmed facts. This is the ground truth for *what the system
   must do*. Architecture documents (Group B–L) are downstream interpretations of
   this document and can be wrong; this document is the thing they're implementing.
2. `docs/pre-development/tech-stack.md` — confirmed for *how* it's built
   (stack, libraries, conventions). Marked "open" items in this file (currently:
   OCR library choice) are not yet decided — do not treat them as decided.
3. Any document under `docs/pre-development/` — these implement #1 and #2. If one
   of these contradicts the consolidated reference, the consolidated reference wins
   and the pre-development document has a bug. Flag it; do not silently follow the
   wrong one.

Never resolve a conflict by averaging or guessing which is "probably more recent."
State the conflict and which document you followed and why.

---

## Section 2: Task → Documents

<!--
  MAINTENANCE NOTE: The "Read" column is copied directly from the Prerequisites
  column in document-list.md, not re-derived. If document-list.md and this table
  ever disagree on a prerequisite, document-list.md is the source data and this
  table has a transcription error. Agents never edit this table.
-->

| Task type                                                                           | Read (in order)                                                                                                                             |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Write/modify the workflow engine (step types, transitions, timers)                  | B4 → D3 → H1                                                                                                                                |
| Write/modify any DB migration or schema file                                        | C1 → C5                                                                                                                                     |
| Write a tRPC procedure or router                                                    | E1 → I1 → I2                                                                                                                                |
| Write a REST/public endpoint                                                        | E2 → B2 → I1                                                                                                                                |
| Write/modify a Zod schema in `/packages/shared`                                     | E3 → C1                                                                                                                                     |
| Write a Zustand store                                                               | F2 → F1 → E3                                                                                                                                |
| Write a TanStack Query hook / cache key                                             | F3 → E1                                                                                                                                     |
| Build the `packages/ui` foundation (Tier 1 + Tier 2)                                | F5 → DESIGN.md → globals.css → F7                                                                                                           |
| Build a Tier 3 domain component in `packages/ui`                                    | F5 → J6 → F6 → DESIGN.md → F7                                                                                                               |
| Build a frontend page or view in `/apps/web`                                        | F4 → F1 → F5 → J6 → I2 → E1                                                                                                                 |
| Implement the workflow definitions for Resolution/Ordinance/Appropriation Ordinance | H1 → B4 → D3                                                                                                                                |
| Implement a new document type or its JSONB metadata                                 | H2 → B4 → H3                                                                                                                                |
| Implement or modify numbering-series logic                                          | H3 → §4.1, §5.1–5.2 of consolidated ref directly                                                                                            |
| Implement an ABAC policy or permission check                                        | I1 → I2 → B5                                                                                                                                |
| Implement RLS policies                                                              | C3 → C1 → I1                                                                                                                                |
| Implement audit logging for a new event type                                        | B3 → I3 → ADR-B2-2                                                                                                                          |
| Implement a notification                                                            | H4 → B3 → I2                                                                                                                                |
| Write/modify Docker/Compose/CI config                                               | L1 → L2 → L3                                                                                                                                |
| Write/modify Infrastructure as Code (IaC) configuration                             | L1 → L2 → L4 → L5                                                                                                                           |
| Write a backup/DR procedure                                                         | L4 → C1 → D5                                                                                                                                |
| Write any unit/integration test                                                     | K1 → (whichever row above matches the code under test)                                                                                      |
| Write a workflow-engine test specifically                                           | K2 → B4 → D3 → H1                                                                                                                           |
| Write a Playwright E2E test                                                         | K3 → F1 → H1                                                                                                                                |
| Write or amend an ADR                                                               | J5 → the relevant document above for the decision's domain                                                                                  |
| Execute an A1 task (development phase)                                              | AGENTS.md (this file) + the row matching the task type above + `docs/development-findings-log.md` confirmed entries for the relevant module |
| Generate or update A1 itself (A1-generation phase)                                  | See `docs/pre-development/A1-AGENTS.md` — a separate routing file governs A1 generation                                                     |

**Note on Tier 3 component tasks:** Every Tier 3 component PR includes a
`/dev/{component-name}` dev route as a mandatory deliverable — not a separate
task. The route renders the component in all its states and is the visual
acceptance gate for the PR. The J6 spec for each component lists which states must
be covered.

If your task spans two rows (e.g., "implement the Citizen Complaint tRPC router and
its frontend form"), read the union of both rows' documents, not just one.

---

## Section 3: Unlisted tasks

If your task isn't in the table above:

1. Check `docs/pre-development/document-list.md` directly — it has the full prerequisite table (IDs
   A1–L5, the complete and final document set) and may cover something this routing
   table hasn't been transcribed for yet.
2. If it's there, follow its listed prerequisites the same way as Section 2, and
   flag to the human that Section 2 is missing a row for it so the table stays in
   sync with document-list.md.
3. If it genuinely isn't covered by document-list.md either, say so explicitly and
   ask the human before proceeding, rather than inferring scope from adjacent
   documents.

---

## Section 4: When no document has the answer

Some implementation questions are not answerable by any pre-development document —
not because of an oversight, but because they can only be resolved once code exists
and runs against real conditions. `docs/pre-development/document-list.md` names several of these
explicitly under "What Can Only Be Determined During Development" (e.g. PostgreSQL
sequence rollover edge cases, Fastify plugin registration order, SSE reconnection
behavior, pgboss retry/dead-letter behavior for the 10-day/30-day timers, OCR
threshold calibration).

If you hit one of these:

- Do not search harder for a document that will answer it — it does not exist.
- Do not present a guess as settled. Per project convention: label it
  `[Inference]` if it's a reasoned default, or `[Speculation]` if it's an
  unconfirmed guess.
- Implement the most conservative reasonable default, and continue. Do not block
  the whole task on a question that was never going to be pre-answered.
- Append an entry to `docs/development-findings-log.md` describing the gap, what
  you implemented, and the label above — see Section 4.5. The PR description should
  summarize the same finding and link to the log entry, but the log entry is the
  durable record; a PR description is not searchable by the next agent who needs
  this same answer six weeks from now.
- Do not claim a behavior is guaranteed, prevented, or ensured unless a document
  explicitly states it that way. If you're describing what your own code does,
  describe it as implemented, not as something the system "ensures" or "guarantees"
  — those words imply a stronger claim than "I wrote code that does X under the
  conditions I tested."

---

## Section 4.5: The development findings log

`docs/development-findings-log.md` is a single append-only `.md` file — not a
folder, and not split across multiple files. All entries go to the bottom of this
one file. Do not create a second file in this group

**This log is used only during A1 execution (the development phase).** Agents
working on A1 generation (building the task list itself, not running the tasks in
it) do not append entries here. A1-generation agents work in a document-production
context where all inputs are pre-development documents; findings from that process
go in the PR notes for the generation pass, not here. If you are an agent that has
been given an A1 task from the master list to implement in code, you are in the
execution phase and this log applies.

**This is not a side channel for editing architecture.** It is append-only, and the
rules differ for agents and humans:

- **Agents may append entries. Agents never edit AGENTS.md, A1-AGENTS.md,
  document-list.md, or any Group B–L document as a result of something learned
  during A1 work** — not even to "just fix" what looks like an obvious error.
  Append a log entry instead and let a human decide whether it warrants a
  source-document edit. This mirrors Section 1's rule that the consolidated
  reference outranks downstream documents: the same discipline applies in reverse —
  a downstream discovery does not get to silently overrule an upstream document
  just because an agent is confident.
- Every entry an agent adds is `status: proposed`. Only a human moves an entry to
  `confirmed` or `superseded`. Treat a `proposed` entry as informative but not yet
  trustworthy — read it, but don't build on it as settled the way you would a
  `confirmed` entry.
- Before starting work covered by a row in Section 2, also search the log for
  `confirmed` entries tagged with the same document ID(s) or the module you're
  about to touch. A `confirmed` entry can change how you approach a task even
  though it isn't itself one of the documents listed in your task's Read column.
- Full format, entry numbering, and the human review rules are in the log file's
  own header — read that before writing your first entry, the same way you'd read
  a document's ToC before requesting a line range.

---

## Section 5: Reading documents efficiently

Several documents in this corpus are long. Three rules to keep context usage down:

1. **Check for a table of contents first.** Every document in this corpus has a ToC
   inserted after its title/status header. Read the ToC before requesting the full
   file, then request only the line range(s) you need via the view tool's range
   parameter.
2. **The consolidated reference is the exception.** For tasks touching the workflow
   engine (B4), read the consolidated reference's Parts 4.1–4.3, 4.10, 4.17, 7.2,
   8, and 11.3 in full rather than excerpting — the workflow logic is
   interdependent enough across those parts that partial reads produce incorrect
   specs. For every other task row in Section 2, excerpting from the ToC range is
   fine.
3. **Never read a `.bak` file** unless explicitly asked to diff against it. These
   are superseded versions kept for history only. Files in this state:
   `b2-module-boundary-and-internal-api-contracts.md.bak`,
   `b3-internal-domain-event-catalog.md.bak`,
   `b5-authentication-and-authorization-architecture.md.bak`,
   `d3-state-machine-diagrams.md.bak`,
   `h1-workflow-definitions-structured-data.md.bak`,
   `l2-docker-compose-specification.md.bak`,
   `i1-abac-policy-specification.md.bak`.
   If a `.bak` file's content is needed, the live file should already have absorbed
   it — if it hasn't, that's a documentation bug; flag it rather than reading the
   `.bak` as a substitute.

---

## Section 6: What this file is not

This file contains routing only — no document content, no architecture decisions.
If you find yourself about to paste a chunk of architecture decisions into this file
"for convenience," don't — it will drift from the source document and become a
second, contradicting copy of the truth. Update the source document instead.

Discoveries from A1 execution go in `docs/development-findings-log.md` (Section
4.5), not here. If a task teaches you something the next agent should know, the log
gets the entry, not a new bullet point bolted onto a section here.

A1 generation (building the task list) is governed by its own routing file at
`docs/pre-development/A1-AGENTS.md`, not by this file.