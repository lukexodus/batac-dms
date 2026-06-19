# AGENTS.md — Batac City LGU Platform

This file tells an AI agent which documents to read for a given task, and — just as
important — what to do when no document answers the question. Read this file first.
Do not open any document under `docs/` until you have matched your task to a row
below.

## How to use this file

1. Find your task in the **Task → Documents** table.
2. Open only the documents listed in the **Read** column, in the order listed.
3. Check the **Status** column for each. If any required document's status is not
   `done`, stop and report which document is missing before doing any work that
   depends on it. Do not improvise its content.
4. Check `docs/pre-development/N-development-findings-log.md` for any `confirmed`
   entries tagged with the same document IDs as your task row, or with the module
   name you're working in. See Section 4.5 for how this log works.
5. If your task is not in the table, go to **Section 3: Unlisted tasks** before
   reading anything.
6. If, while doing the work, you hit a question that none of the documents you read
   answers, go to **Section 4: When no document has the answer** — do not guess
   silently.

---

## Section 1: Source-of-truth hierarchy

When documents conflict, this is the resolution order, highest first:

1. `docs/requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md`
   — stakeholder-confirmed facts. This is the ground truth for *what the system must
   do*. Architecture documents (Group B–L) are downstream interpretations of this
   document and can be wrong; this document is the thing they're implementing.
2. `docs/ai-context-docs/2-stack-context.md` — confirmed for *how* it's built
   (stack, libraries, conventions). Marked "open" items in this file (currently: OCR
   library choice) are not yet decided — do not treat them as decided.
3. Any document under `docs/pre-development/` — these implement #1 and #2. If one
   of these contradicts the consolidated reference, the consolidated reference wins
   and the pre-development document has a bug. Flag it; do not silently follow the
   wrong one.

Never resolve a conflict by averaging or guessing which is "probably more recent."
State the conflict and which document you followed and why.

---

## Section 2: Task → Documents

Status values: `done` (exists, content verified against consolidated reference),
`draft` (exists but not yet reviewed — treat content as provisional), `missing` (not
yet written).

<!--
  MAINTENANCE NOTE: the document set and dependency graph in document-list.md are
  final — IDs A1–M1 are the complete corpus, no new documents will be added. The
  Status column below is updated manually by a human after each document is
  reviewed; agents never edit this column. This means the table's accuracy depends
  entirely on the human review step actually happening before status flips to
  `done` — flip the status the same sitting you finish reviewing, not "later," or
  agents will trust a status that no longer matches the file's real content. The
  "Read" column is copied directly from the Prerequisites column already worked
  out in document-list.md, not re-derived — if document-list.md and this table ever
  disagree on a prerequisite, document-list.md is the source data and this table
  has a transcription error.
-->

| Task type | Read (in order) | Status |
|---|---|---|
| Write/modify the workflow engine (step types, transitions, timers) | B4 → D3 → H1 | B4: missing · D3: missing · H1: missing |
| Write/modify any DB migration or schema file | C1 → C5 | C1: missing · C5: missing |
| Write a tRPC procedure or router | E1 → I1 → I2 | E1: missing · I1: missing · I2: missing |
| Write a REST/public endpoint | E2 → B2 → I1 | E2: missing · B2: missing · I1: missing |
| Write/modify a Zod schema in `/packages/shared` | E3 → C1 | E3: missing · C1: missing |
| Write a frontend route/page in `/apps/web` | F1 → I2 → E1 | F1: missing · I2: missing · E1: missing |
| Write a Zustand store | F2 → F1 → E3 | F2: missing · F1: missing · E3: missing |
| Write a TanStack Query hook / cache key | F3 → E1 | F3: missing · E1: missing |
| Build a component in `/packages/ui` or `/apps/web` | F4 → F1 | F4: missing · F1: missing |
| Implement the workflow definitions for Resolution/Ordinance/Appropriation Ordinance | H1 → B4 → D3 | H1: missing · B4: missing · D3: missing |
| Implement a new document type or its JSONB metadata | H2 → B4 → H3 | H2: missing · B4: missing · H3: missing |
| Implement or modify numbering-series logic | H3 → §4.1, §5.1–5.2 of consolidated ref directly | H3: missing |
| Implement an ABAC policy or permission check | I1 → I2 → B5 | I1: missing · I2: missing · B5: missing |
| Implement RLS policies | C3 → C1 → I1 | C3: missing · C1: missing · I1: missing |
| Implement audit logging for a new event type | B3 → I3 → ADR-B2-2 | B3: missing · I3: missing · ADR-B2-2: done |
| Implement a notification | H4 → B3 → I2 | H4: missing · B3: missing · I2: missing |
| Write/modify Docker/Compose/CI config | L1 → L2 → L3 | L1: missing · L2: missing · L3: missing |
| Write a backup/DR procedure | L4 → C1 → D5 | L4: missing · C1: missing · D5: missing |
| Write any unit/integration test | K1 → (whichever row above matches the code under test) | K1: missing |
| Write a workflow-engine test specifically | K2 → B4 → D3 → H1 | K2: missing · B4: missing · D3: missing · H1: missing |
| Write a Playwright E2E test | K3 → F1 → H1 | K3: missing · F1: missing · H1: missing |
| Write or amend an ADR | J5 → the relevant document above for the decision's domain | J5: missing |
| Generate or update the Master Phased Task List (A1) | **All `done` documents in this table**, plus the consolidated reference in full | — |

If your task spans two rows (e.g., "implement the Citizen Complaint tRPC router and
its frontend form"), read the union of both rows' documents, not just one.

---

## Section 3: Unlisted tasks

If your task isn't in the table above:

1. Check `docs/document-list.md` directly — it has the full prerequisite table (IDs
   A1–M1, the complete and final document set) and may cover something this
   routing table hasn't been transcribed for yet.
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
and runs against real conditions. `docs/document-list.md` names several of these
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
- Append an entry to `docs/pre-development/N-development-findings-log.md`
  describing the gap, what you implemented, and the label above — see Section 4.5.
  The PR description should summarize the same finding and link to the log entry,
  but the log entry is the durable record; a PR description is not searchable by
  the next agent who needs this same answer six weeks from now.
- Do not claim a behavior is guaranteed, prevented, or ensured unless a document
  explicitly states it that way. If you're describing what your own code does,
  describe it as implemented, not as something the system "ensures" or
  "guarantees" — those words imply a stronger claim than "I wrote code that does
  X under the conditions I tested."

---

## Section 4.5: The development findings log

`docs/pre-development/N-development-findings-log.md` exists for exactly one
purpose: capturing things learned *during* A1 execution that no pre-development
document specified — either because Section 4 applied (the answer was genuinely
undecidable in advance) or because a bug fix or implementation choice revealed a
constraint that future tasks touching the same code need to know about.

**This is not a side channel for editing architecture.** It is append-only, and
the rules differ for agents and humans:

- **Agents may append entries. Agents never edit AGENTS.md, document-list.md, or
  any Group B–L document as a result of something learned during A1 work** — not
  even to "just fix" what looks like an obvious error. Append a log entry instead
  and let a human decide whether it warrants a source-document edit. This mirrors
  Section 1's rule that the consolidated reference outranks downstream documents:
  the same discipline applies here in reverse — a downstream discovery does not
  get to silently overrule an upstream document just because an agent is confident.
- Every entry an agent adds is `status: proposed`. Only a human moves an entry to
  `confirmed` or `superseded`. Treat a `proposed` entry as informative but not yet
  trustworthy — read it, but don't build on it as settled the way you would a
  `confirmed` entry or a `done` document.
- Before starting work covered by a row in Section 2, also search the log for
  `confirmed` entries tagged with the same document ID(s) or the module you're
  about to touch. A `confirmed` entry can change how you approach a task even
  though it isn't itself one of the documents listed in your task's `Read` column.
- Full format, entry numbering, and the human review rules are documented in the
  log file's own header — read that before writing your first entry there, the
  same way you'd read a document's ToC before requesting a range.

---

## Section 5: Reading documents efficiently

Several documents in this corpus are long. Two rules to keep context usage down:

1. **Check for a table of contents or heads first.** If a document has a ToC
   section, read that before requesting the full file, then request only the line
   range(s) you need via the view tool's range parameter.
2. **The consolidated reference is the exception.** For `B4` (Workflow Engine
   Specification) specifically, read the consolidated reference's Parts 4.1–4.3,
   4.10, 4.17, 7.2, 8, and 11.3 in full rather than excerpting further — the
   workflow logic is interdependent enough across those parts that partial reads
   have produced incorrect specs before. For every other task row in Section 2,
   excerpting is fine.
3. **Never read a `.bak` file** unless explicitly asked to diff against it. These
   are superseded versions kept for history, not current source. Files currently in
   this state: `b2-module-boundary-and-internal-api-contracts.md.bak`,
   `b3-internal-domain-event-catalog.md.bak`,
   `b5-authentication-and-authorization-architecture.md.bak`,
   `d3-state-machine-diagrams.md.bak`, `h1-workflow-definitions-structured-data.md.bak`,
   `l2-docker-compose-specification.md.bak`, `i1-abac-policy-specification.md.bak`.
   If a `.bak` file's content is needed, the live (non-`.bak`) file should already
   have absorbed it — if it hasn't, that's a documentation bug, flag it rather than
   reading the `.bak` as a substitute.

---

## Section 6: What this file is not

This file does not contain document content, only routing. If you find yourself
about to paste a chunk of architecture decisions into this file "for convenience,"
don't — it will drift from the source document and become a second, contradicting
copy of the truth. Update the source document; update only the Status column here.

This file is also not where discoveries from A1 execution go — that's
`docs/pre-development/N-development-findings-log.md` (Section 4.5). If a task
teaches you something the next agent should know, the log gets the entry, not a
new bullet point bolted onto a section here.
