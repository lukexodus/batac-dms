# Chapter 0.1: The Documents That Tell You Which Documents to Read

## Before you read anything else in this repo

You're about to spend a long time inside `batac-dms`. Before you open a single architecture document, a single schema file, or a single line of application code, you need to understand something structural about how this repository came to exist, because it changes how you should read everything else in it.

Most codebases you'll encounter were written by a person, or a small group of people, over time, holding the whole design in their heads as they went. When you join a project like that, you learn it by reading code, asking a teammate "wait, why does this work this way?", and slowly accumulating context that lives partly in documents and partly in people's memory.

`batac-dms` doesn't work that way. This repository was built with heavy involvement from AI coding agents — not agents autocompleting individual lines, but agents being handed entire tasks ("implement the workflow engine's state transitions," "write the ABAC policy check for document cancellation") and producing real, reviewed pull requests. An agent doing that kind of work starts every task with *zero memory of any previous task*. It doesn't remember yesterday's design decision. It doesn't know that someone already resolved an ambiguity in the schema last week. Every single time, it has to be told, from scratch, in text: here is what you're building, here is how the system is architected, here is what's already decided versus what's still open, here is what to do if you hit a question nobody has answered yet.

That requirement — *tell an amnesiac collaborator everything it needs, every single time, in writing* — is what produced this repository's most unusual feature: an entire sub-system of documents whose only job is to tell you (or an agent) which *other* documents to read for a given kind of task. Nobody sat down one day and decided "let's have a beautifully organized docs folder." The routing layer exists because without it, every agent-run task would either re-derive the architecture from nothing (slow, and prone to silently reinventing things differently each time) or ignore it entirely (fast, and prone to building something that contradicts everything else).

This is why this material starts here, at Chapter 0.1, before Chapter 1 touches the database schema or the workflow engine or anything else. You cannot safely read `docs/pre-development/h1-workflow-definitions-structured-data.md` in isolation and trust what it tells you, because that document is not itself the ground truth — it's a downstream interpretation of something else, and knowing that changes how skeptically you should read it. You cannot open a task file like `wf.md` and understand its own internal jargon — "Wave E," "Module Summary," "`[SPEC GAP]`" — without knowing where those terms come from. The routing documents are the key that makes the rest of the repository legible. Read this chapter, and the next fifty documents you open will make sense on first read. Skip it, and you'll spend weeks quietly confused about why documents disagree with each other and which one you're supposed to trust.

Let's start with the single most important distinction in the whole system, one that's easy to blur if you don't slow down: there are two entirely different files named similarly, governing two entirely different *phases* of work, and they are not interchangeable.

## Two files, two phases: execution versus generation

At the root of the repository sits `AGENTS.md`. Its very first lines tell you exactly what it's for:

> This file tells an AI agent which documents to read for a given task, and — just as important — what to do when no document answers the question. Read this file first. Do not open any document under `docs/` until you have matched your task to a row below.

`AGENTS.md` governs what this chapter will call the **execution phase**: the situation where someone (an agent, or now you) has been handed a specific, already-defined piece of work — "implement a tRPC procedure," "write a database migration," "add audit logging for a new event type" — and needs to know what to read before writing code. The tasks already exist. The job is to build them correctly.

But somewhere *before* that phase can begin, someone had to write down what all those tasks actually were. That work — producing the master list of every task, in what order, with what acceptance criteria — is a different job entirely, and it's governed by a completely separate file: `docs/pre-development/A1-AGENTS.md`. Its opening paragraph states the distinction as directly as it's possible to state it:

> This file governs the **A1 generation phase** — building the Master Phased Task List itself, not executing tasks from it. If you are an agent that has received a task from a finished A1 to implement in code, stop here and read `AGENTS.md` instead. These two files govern different phases and must not be conflated.

"A1" is the project's own internal name for the Master Phased Task List — the giant document (150–300 pages, per A1-AGENTS.md's own estimate) that enumerates every concrete task an execution agent will ever pick up, with a task ID, its prerequisites, its deliverables, its acceptance criteria, and a fully self-contained prompt. Producing that document is what A1-AGENTS.md calls **the generation phase**. Consuming it — actually doing the tasks it lists — is what root AGENTS.md calls **the execution phase**.

Why does this distinction matter enough to be Chapter 0.1's first real content? Because A1-AGENTS.md explains something genuinely important about *why* an executing agent can't just "go read the architecture docs" when it gets stuck. Section 7 of A1-AGENTS.md, on writing the "AI Prompt" field for each task, is blunt about it:

> This is the most expensive field to generate and the most important to get right. It is the only thing an execution-phase agent will have access to at task time — it has no pre-dev documents and no AGENTS.md context when it receives a task.

That's the mechanical reason the two files can't be conflated: an execution-phase agent, at the moment it starts a task, has *only* the AI Prompt text for that one task and the codebase itself. It doesn't have A1-AGENTS.md's wave ordering, module boundaries, or any of the generation-phase bookkeeping — Section 8 of A1-AGENTS.md says so explicitly, listing "What Generation Agents Do Not Do," including "Do not read AGENTS.md during generation. It governs execution-phase agents." The two documents aren't just organizationally separate; they're operationally separate, because the audiences literally never see each other's context.

Where does this leave you, a human developer picking up this repo today, rather than an agent mid-task? In practice, you will spend almost all your time with root `AGENTS.md`. That's the file that routes *your* kind of work — implementing something, fixing something, writing a test. A1-AGENTS.md is not really "for" you in the same operational sense. But you still need to recognize it, for a specific reason: **the generation phase already happened**, largely. Task lists exist today for nearly every module — `infra.md`, `iam.md`, `audit.md`, `org.md`, `docs.md`, `wf.md`, `track.md`, `notif.md`, `rec.md`, `fe.md` — and those files were themselves produced by an agent working under A1-AGENTS.md's rules. That means they carry A1-AGENTS.md's own vocabulary baked in: things like `[SPEC GAP]`, `[Inference]`, `[CONFLICT]` markers, Module Summaries, "Wave" references, task IDs like `TASK-WF-001`. If you open `wf.md` and see a line like `rec.md`'s own header —

> **Documents loaded for this pass, in order:**
> 1. `docs/pre-development/A1-AGENTS.md` — Section 2 Pass Types table, Section 6 Step 2 rules (routing instructions, read first per those rules)

— you're looking directly at generation-phase bookkeeping, left in place as a record of how that file was produced. You don't need to *operate* A1-AGENTS.md's rules yourself day to day. But you do need to recognize its fingerprints when you see them, so a phrase like "Wave F — runs after DOCS... WF and TRACK... are complete" in `rec.md`'s header doesn't read as mysterious jargon — it's just A1-AGENTS.md's dependency-wave concept, applied.

One more thing worth knowing precisely, since the assignment framing for this chapter asserted it and it's worth checking rather than taking on faith: is the generation phase actually "essentially over"? Mostly, yes — but with real texture. Every module in A1-AGENTS.md's wave order (INFRA, UI, IAM, AUDIT, ORG, DOCS, WF, TRACK, REC, NOTIF, PORTAL) has a corresponding file on disk under `docs/pre-development/A-project-planning/a1-tasks/`. But they are not uniformly complete. `rec.md` is real and functional — two tasks plus a Module Summary, following A1-AGENTS.md's schema correctly — but at roughly 300 lines it's much thinner than neighboring modules like `wf.md` (over 2,600 lines) or `docs.md` (over 3,400 lines); "minimal" is the right word for it. `notif.md`, at a little over 1,100 lines, is likewise proportionally lighter than the larger modules, though more substantial than "minimal" alone would suggest. And `portal.md` — the file that exists to hold the PORTAL module's task list — is present on disk but is **completely empty, zero lines**. Not missing. Not deleted. A placeholder that was created and never filled in. That's a meaningfully different fact than "no file exists," and it matters later in this chapter, because it's a useful contrast case for a related but distinct kind of gap you'll run into.

## The source-of-truth hierarchy: a real ranking, not a vibe

Any project with this many documents will eventually have two documents disagree with each other. What happens then? This is where AGENTS.md is most emphatic, and it's worth reading Section 1 closely, because the ranking it sets up has real teeth — it's not "generally defer to the more detailed doc" or "use your judgment." It's an explicit, ordered hierarchy:

> When documents conflict, this is the resolution order, highest first:
>
> 1. `docs/requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md` — stakeholder-confirmed facts. This is the ground truth for _what the system must do_. Architecture documents (Group B–L) are downstream interpretations of this document and can be wrong; this document is the thing they're implementing.
> 2. `docs/pre-development/tech-stack.md` — confirmed for _how_ it's built (stack, libraries, conventions). Marked "open" items in this file (currently: OCR library choice) are not yet decided — do not treat them as decided.
> 3. Any document under `docs/pre-development/` — these implement #1 and #2. If one of these contradicts the consolidated reference, the consolidated reference wins and the pre-development document has a bug. Flag it; do not silently follow the wrong one.

Sit with the wording in tier 1 for a second: "Architecture documents (Group B–L) *can be wrong*." That's not a hedge — it's a design principle. Everything you'll read under `docs/pre-development/` in Groups B through L (architecture, database, API design, frontend, domain configuration, security, testing, infrastructure — you'll meet the full alphabet soon) is somebody's, or some agent's, *interpretation* of what the consolidated reference says the system must do. Interpretations can have bugs. The consolidated reference itself — the 2026-06-15, stakeholder-confirmed document covering all eighteen document types, the numbering system, the phase roadmap, and so on — is the thing being interpreted. If a downstream document says something the consolidated reference doesn't support, the downstream document is wrong, full stop, regardless of how detailed or recent-looking it is.

Tier 2 is `tech-stack.md`, and it's worth pausing here for something specific and currently live: **this file has an open decision that is not yet settled**, and you should not treat it as resolved just because it's sitting in a "confirmed" document. `tech-stack.md`'s own OCR Strategy section reads:

> **Open technical decision:** The specific OCR library has not been confirmed. Evaluate in this order:
>
> 1. **`tesseract.js`** — Pure Node.js; no native system dependencies; self-hostable; no cloud vendor required. Preferred given the on-premise deployment constraint. Primary concern: accuracy on scanned Filipino government documents, which may have variable scan quality and mixed-language text (Filipino/English/Ilocano).
> 2. **Self-hosted cloud OCR alternative** — Only if `tesseract.js` accuracy is found to be insufficient after testing against real SP Secretariat document samples. Must still be self-hostable with no external API calls. Cloud OCR services that send data off-premise are excluded — RA 10173 (Data Privacy Act) compliance and LGU data sovereignty requirements prohibit sending citizen document content to external vendors.

and specifies exactly what would close the decision:

> **Decision trigger:** Test `tesseract.js` against a representative sample of scanned SP Secretariat documents (letters, memos, resolutions) before the first OCR-dependent feature is implemented. If accuracy meets the threshold required for reliable full-text search indexing, the decision is closed. If not, evaluate alternatives under the self-hostable constraint.

(That's from `tech-stack.md`, lines 163–176, under "OCR Strategy" — worth knowing the exact location since you'll likely need to check whether this has been resolved by the time you're reading this.)

Practically: if you go looking through the codebase and find OCR-related code that assumes `tesseract.js`, treat that as a *provisional* implementation choice, not a settled architectural fact. The reasoning for preferring it is sound — it's pure Node.js, self-hostable, no cloud dependency, which matters a great deal given the on-premise, data-sovereignty constraints this project operates under — but "preferred" is explicitly not "decided." If you're the one who ends up running the accuracy test against real scanned Secretariat documents, that's the moment this decision actually closes, and it should be recorded as such (more on exactly where that gets recorded later in this chapter, when we get to the findings log).

Tier 3 is everything else under `docs/pre-development/` — the Group B through L documents, dozens of files. These implement tiers 1 and 2. They are useful, detailed, and mostly right, but they are not themselves the source of truth, and AGENTS.md wants you to hold that lightly rather than forget it the moment you start relying on one of them daily.

Here's the part that's easy to get wrong if you're moving fast: what do you do when two documents genuinely disagree, and one just *looks* more recent, or more polished, or more specific? AGENTS.md forecloses the obvious shortcut entirely:

> Never resolve a conflict by averaging or guessing which is "probably more recent." State the conflict and which document you followed and why.

This is worth internalizing precisely because it's the instinct you'll have to fight. "This file was clearly updated more recently, so it's probably right" is a completely reasonable-sounding heuristic in most codebases — but this project has an explicit rule against relying on it, because "more recent" and "correct" are not the same thing in a repository built by many independent passes, and guessing wrong here means building on a foundation nobody actually decided was solid. The correct move, every time, is the boring one: name the conflict explicitly, say which document you're following (using the tier ranking above), and say why. That's it. Not "figure out who's right" — state it and move on, and leave the trail so a human can adjudicate later if it matters.

## Section 2's routing table: task type in, document list out

The part of root AGENTS.md you'll actually use most often, day to day, is Section 2 — a table that maps a *kind of task* to the exact, ordered list of documents you should read before touching code. This is the practical payoff of everything above: instead of guessing which of the several dozen documents under `docs/pre-development/` are relevant to what you're doing, you look up your task type and get a short, ordered reading list.

A few rows, so you can see the shape of it:

| Task type | Read (in order) |
|---|---|
| Write a tRPC procedure or router | E1 → I1 → I2 |
| Implement an ABAC policy or permission check | I1 → I2 → B5 |
| Implement audit logging for a new event type | B3 → I3 → ADR-B2-2 |
| Implement a notification | H4 → B3 → I2 |

Take the first one. Say you're asked to add a new tRPC procedure. The table says: read E1 first (that's the tRPC Router and Procedure Catalog — the document that specifies exact procedure signatures, input/output schemas, naming conventions), then I1 (ABAC Policy Specification — because in this system, seemingly every mutating procedure has an access-control dimension baked into its design from the start), then I2 (Role-Permission Matrix — the concrete table of which roles can do what). Notice the order matters: you're meant to understand the API contract shape first, then the abstract policy rules, then the concrete role mapping — building context in a specific sequence rather than absorbing three documents' worth of unrelated material simultaneously.

The ABAC row is a good second example because it shows the same three documents recombined for a different purpose: I1 → I2 → B5. Here the emphasis flips — you start with the policy specification itself, then the role-permission matrix, and *then* B5 (the Authentication and Authorization Architecture document) for the broader architectural context those policies sit inside. Same underlying documents as the tRPC row, different order, because the job is different: writing a router needs the API-shape-first framing; writing a permission check needs the policy-rule-first framing.

The audit-logging row introduces something new: `ADR-B2-2`. That's an Architecture Decision Record — a named, numbered document capturing a specific decision and its rationale, filed separately from the main Group B–L documents. You'll meet the full ADR system later; for now, just notice that Section 2's rows don't only point at the big lettered Group documents — they'll sometimes point you at a specific ADR when the task genuinely hinges on one particular past decision rather than a whole document's worth of context.

And the notification row (H4 → B3 → I2) shows the pattern generalizing again: H4 is the Notification Event and Template Catalog (the domain-configuration document for this specific feature area), B3 is the Internal Domain Event Catalog (because notifications, in this architecture, are triggered by the same internal event bus that drives everything else), and I2 is back to the role-permission matrix, because *who* gets notified about what is itself a permission-shaped question.

Now, an important detail that's easy to skim past: this whole table has a maintenance rule attached to it, sitting in an HTML comment right above it, invisible if you're only skimming the rendered table:

> MAINTENANCE NOTE: The "Read" column is copied directly from the Prerequisites column in document-list.md, not re-derived. If document-list.md and this table ever disagree on a prerequisite, document-list.md is the source data and this table has a transcription error. Agents never edit this table.

In other words: this table is a *copy*. The actual source of the prerequisite data lives somewhere else — `docs/pre-development/document-list.md` — and this table exists purely as a convenient, task-oriented view onto that underlying data. If you ever notice the Section 2 table and document-list.md's own prerequisite listing disagree about what to read for some task, don't treat that as a genuine architectural conflict requiring the tier-1/tier-2/tier-3 hierarchy above — it's much more mundane than that. It means whoever transcribed the table made a copying mistake, and document-list.md wins by definition, because it's the actual data and Section 2 is just a view. This matters practically: it tells you exactly where to look when something seems off, and it tells you not to spend time agonizing over which one is "more authoritative" — that question is already answered, structurally, before you even hit it.

## document-list.md: the master index underneath everything

Which brings us to `docs/pre-development/document-list.md` itself — the file just referenced as the real source of the prerequisite data, and the master index for the entire pre-development document corpus.

Where Section 2 of AGENTS.md gives you a convenient, task-shaped view of a subset of documents, document-list.md gives you the complete picture: every document ID from A1 through L5, what it's called, and its full prerequisite chain. Its own Prerequisite Table opens like this:

```
| ID  | Document                                       | Prerequisites from this list |
| --- | ---------------------------------------------- | ----------------------------- |
| A1  | Master Phased Task List                        | All other documents          |
| A2  | Risk Register                                  | None                          |
| B1  | System Architecture Document (C4 L1–L3)        | None                          |
| B2  | Module Boundary and Internal API Contracts     | B1                            |
```

...and continues through every letter group — B (Architecture), C (Database), D (UML and Diagrams), E (API Design), F (Frontend Architecture), G (End-to-End Type Safety), H (Domain Configuration), I (Security and Authorization), J (Software Design Patterns and Standards), K (Testing), L (Infrastructure and DevOps) — all the way to L5. This is genuinely the complete document set for the project; nothing under `docs/pre-development/` exists outside this index.

What is document-list.md *for*, practically, given that Section 2 of AGENTS.md already routes most common tasks? AGENTS.md's own Section 3, "Unlisted tasks," answers this directly:

> If your task isn't in the table above:
> 1. Check `docs/pre-development/document-list.md` directly — it has the full prerequisite table (IDs A1–L5, the complete and final document set) and may cover something this routing table hasn't been transcribed for yet.
> 2. If it's there, follow its listed prerequisites the same way as Section 2, and flag to the human that Section 2 is missing a row for it so the table stays in sync with document-list.md.
> 3. If it genuinely isn't covered by document-list.md either, say so explicitly and ask the human before proceeding, rather than inferring scope from adjacent documents.

document-list.md is the fallback — the thing you check when Section 2's convenient table doesn't have a row matching your task. Since it holds the complete set, it should always have *something* relevant, even for oddball or novel tasks Section 2's table hasn't caught up to yet. And notice the discipline in step 2: if you use document-list.md to fill a gap in Section 2, you don't just quietly proceed — you flag that Section 2 is missing a row, so someone eventually goes and adds it, keeping the convenient table honest as a genuine subset of the master index rather than letting it slowly drift out of sync.

document-list.md also does something Section 2 doesn't attempt: it closes with a section called "What Can Only Be Determined During Development," setting expectations up front that some questions simply cannot be pre-answered no matter how thoroughly the documentation is written. That section is the direct ancestor of the next mechanism this chapter needs to explain, so let's go there now.

## The development-findings-log.md mechanism

Here's a genuine tension baked into this whole system: the pre-development documents are supposed to be comprehensive enough that an agent never has to guess. But some things simply cannot be known until code exists and runs against real conditions. AGENTS.md's Section 4 is honest about this, and it's worth reading its framing closely, because it's easy to misread "we couldn't pre-decide this" as a documentation failure when it's actually the opposite:

> Some implementation questions are not answerable by any pre-development document — not because of an oversight, but because they can only be resolved once code exists and runs against real conditions.

The document names several concrete examples, drawn directly from document-list.md's own "What Can Only Be Determined During Development" section: PostgreSQL sequence configuration edge cases (what actually happens when a numbering sequence rolls over mid-transaction, at year-end, say — a question this project cares about a great deal, since document numbering is central to the whole system), SSE reconnection behavior under intermittent connectivity (this matters specifically because the system needs to work reliably in Barangay-level network contexts, which the documents don't pretend are always great), pgboss job retry and dead-letter behavior for the platform's 10-day and 30-day statutory timers (the Mayor's 10-day lapse window, the Sangguniang Panlalawigan's 30-day review window — these aren't cosmetic deadlines, they're legally meaningful, so how retries actually behave under failure matters), and OCR threshold calibration (tied directly to that still-open tesseract.js decision from the last section — you can't calibrate a quality threshold for a library that hasn't been confirmed).

None of these are things a more thorough pre-development document could have nailed down in advance. They require actual PostgreSQL behavior, actual network conditions, actual scanned document samples. So the project has a dedicated mechanism for capturing exactly this class of discovery: `docs/development-findings-log.md`.

This is where the append-only discipline becomes important, and it's genuinely easy to get backwards if you're used to normal "living documentation" that gets edited in place. The log's own header states the ground rule:

> **Status:** Living document. Append-only by agents; status field per entry is edited only by a human.

Every entry an executing agent adds starts life at `status: proposed`. That's not a formality — it's a meaningful epistemic marker. A `proposed` entry means: an agent found this, wrote it down, and is telling you what it did and why — but no human has yet reviewed and endorsed it. Only a human can promote an entry to `confirmed` (meaning: reviewed, and treated as settled — something you or a future agent can build on the way you'd build on a Group B–L document) or to `superseded` (meaning: it was later found to be wrong or outdated, and a newer entry supersedes it, but the old one stays in the log rather than being deleted, because — per the log's own rules for the human reviewer — "the log is append-only for humans too; corrections are new information, not erasures").

Why keep it this strict? Because the whole point of the discipline is to prevent a subtle failure mode: an agent, mid-task, spots something that looks like an obvious error in the architecture — a schema that seems to contradict itself, a role that seems to have the wrong permission — and is tempted to just... fix it. Go edit the source document directly, since it's "obviously" wrong. AGENTS.md's Section 4.5 explains exactly why this is forbidden, and the reasoning is a genuinely elegant mirror of the source-hierarchy rule from Section 1:

> **This is not a side channel for editing architecture.** It is append-only, and the rules differ for agents and humans:
> - **Agents may append entries. Agents never edit AGENTS.md, A1-AGENTS.md, document-list.md, or any Group B–L document as a result of something learned during A1 work** — not even to "just fix" what looks like an obvious error. Append a log entry instead and let a human decide whether it warrants a source-document edit. This mirrors Section 1's rule that the consolidated reference outranks downstream documents: the same discipline applies in reverse — a downstream discovery does not get to silently overrule an upstream document just because an agent is confident.

Section 1 says: upstream documents outrank downstream ones, and being confident that a downstream document is right doesn't change that ranking. Section 4.5 applies the identical logic to time rather than document tier: a discovery made *during* execution doesn't get to silently overrule something decided *before* execution, no matter how confident the discovering agent is. Confidence isn't the deciding factor in either direction. A human reviewing the finding is.

This isn't abstract — the log has 115 real entries as of this writing, and reading a few makes the mechanism concrete in a way the rules alone don't. Here's the very first entry in the file, `LOG-0001`, showing the full cycle — proposed, evidence, an inference label, and an explicit note that a human still needs to weigh in on part of it:

> ### [LOG-0001] 01-create-roles.sh creates five roles, not three
>
> - date: 2026-06-25
> - task_id: TASK-INFRA-005
> - status: confirmed
> - affects: C1 (Part 2), infra.md (TASK-INFRA-005 AI Prompt)
>
> The TASK-INFRA-005 AI Prompt and its three acceptance criteria name exactly three roles: `batac_migrate`, `batac_app`, `batac_audit`. However, C1 Part 2 (the authoritative schema DDL document) defines five roles: `batac_migrate`, `batac_app`, `batac_audit`, `batac_it_admin`, `batac_readonly`. I3 §8.1 is cited as the source for this role set in C1.
>
> Per the Section 1 hierarchy (C1 outranks task-prompt text), `01-create-roles.sh` was implemented to create all five roles. `batac_it_admin` and `batac_readonly` are NOLOGIN with no passwords; they require no Docker secret and will not break any acceptance criterion...
>
> [Inference]: The task-prompt text was written before the full role set in C1 Part 2 was finalised and simply omitted the two supplementary roles. The implementation in 01-create-roles.sh follows C1 as the higher-priority source.
>
> A human reviewer should confirm whether the task-prompt acceptance criterion (`\du` lists `batac_migrate`, `batac_app`, and `batac_audit`) is intentionally restrictive (three-role minimum) or whether it should be updated to reflect all five roles from C1 Part 2.

Notice this entry does exactly what the rules ask: it doesn't silently deviate from the task prompt, and it doesn't silently patch anything. It states the conflict (three roles named in the prompt, five in the authoritative schema), states which source it followed and why (C1 outranks the task-prompt sample text, per the same hierarchy from Section 1), labels its own reasoning honestly as `[Inference]`, and explicitly flags the piece that still needs a human decision.

A related entry, `LOG-0003`, shows the promotion mechanism actually closing a loop — this one has been confirmed *and* resulted in an actual document correction:

> ### [LOG-0003] batac_app and batac_audit roles must have LOGIN attribute to authenticate
>
> - status: confirmed
> - affects: C1 (Part 2), C5 (Addendum)
> - resolved_in: c1-full-database-schema-ddl-v3.md (Part 2 — batac_app and batac_audit corrected to LOGIN)
>
> C1 Part 2 explicitly specifies `CREATE ROLE batac_app NOLOGIN;` and `CREATE ROLE batac_audit NOLOGIN;` while noting that `batac_app` is expected to be created as `LOGIN` by Docker/Bitnami via environment variables. However, because both `batac_app` and `batac_audit` have connection strings... and must authenticate directly, setting them to `NOLOGIN` in `01-create-roles.sh` prevents connection... [Inference]: The literal DDL text of C1 Part 2 uses `NOLOGIN`... but this contradicts the intent and practical connection requirements of these roles.

This is the whole system working exactly as designed: an agent found a genuine contradiction inside an authoritative document itself (not between two documents — the DDL literally said `NOLOGIN` while the surrounding text assumed login capability), didn't silently fix the DDL, appended a proposed finding, and a human later reviewed it, agreed, and actually edited the source document (note the `resolved_in` field pointing at the specific v3 DDL file) — with the log entry itself staying in place as the permanent record of why that edit happened.

And one more, still sitting at `proposed` as of this writing, to show you what an *unreviewed* entry looks like in practice — `LOG-0014`, on a subtle sequencing problem in the login flow:

> ### [LOG-0014] session_token_hash requires two-phase update: 'pending' placeholder → SHA-256(jti) after JWT sign
>
> - status: proposed
> - affects: none (implementation sequencing detail; no architecture document specifies how to handle the jti-before-session chicken-and-egg)
>
> ...Implemented as a two-phase approach: 1. INSERT session row with `session_token_hash = 'pending'` inside the transaction. 2. After the transaction commits and the JWT is signed, UPDATE the session row with `session_token_hash = SHA-256(jti)` outside the transaction.
>
> The UPDATE is best-effort (outside the atomic transaction). If the server crashes between step 1 and step 2, the session row has hash='pending'... This is considered an acceptable low-probability gap for Phase 1... [Inference]: The two-phase approach matches what other implementations of this pattern do in a single-server context. It was not pre-specified because the chicken-and-egg between jti and session_id is an implementation detail, not an architecture question.

This entry is genuinely useful information — it tells you about a real, if low-probability, crash-recovery gap in the auth flow — but it hasn't been reviewed yet. Treat it exactly as the rules say: informative, worth knowing, not yet something you should treat as a *settled, endorsed* design decision the way you'd treat a `confirmed` entry or a Group B–L document.

One honest observation worth passing on, since it's the kind of thing that only becomes visible by actually reading the log rather than just the rules describing it: as of this writing, 110 of the log's 115 entries are still sitting at `proposed`. Only a handful have been reviewed and promoted to `confirmed`, and none have been marked `superseded`. The log's own header, in its "Rules for the human reviewer" section, names exactly this as a real project risk rather than a hypothetical one: "a stale `proposed` entry that should have been `confirmed` is functionally invisible to AGENTS.md's lookup step... so treat the review lag itself as a project risk, not a formality." That's worth knowing going in — it means, in practice, that a lot of genuinely useful findings currently sit in a not-yet-endorsed state, and part of engaging with this system honestly is not assuming "it's in the log" is the same as "it's been checked."


## How you actually use this system, day to day

Everything above is the theory. Here's the practice, distilled into something closer to a checklist you can actually follow when you sit down to do real work in this repository:

**Starting any task**, check root `AGENTS.md`'s Section 2 table first. Find the row matching what you're doing. Read the documents it lists, in the order it lists them — the ordering isn't arbitrary, as you saw with the tRPC and ABAC rows sharing documents in different sequences for different reasons.

**If your task isn't in that table**, don't guess or infer scope from something adjacent that looks similar — go to `docs/pre-development/document-list.md` directly. It has the complete document set (A1 through L5) and will very likely cover your task even when Section 2's convenient subset hasn't been transcribed for it yet. If you end up using document-list.md to fill a gap, it's worth noting that gap somewhere so Section 2 eventually catches up.

**Before assuming you know the current state of any decision**, check `docs/development-findings-log.md` for `confirmed` entries tagged with the module or document ID you're about to touch. A confirmed entry can change your approach even though it isn't itself one of the documents in your task's official reading list — that's exactly what happened with LOG-0003 changing how role creation actually works versus what the raw DDL literally said. And hold `proposed` entries at arm's length accordingly: informative, worth reading, not yet something to build on as settled.

**If you discover something during your own work that isn't written down anywhere** — a database quirk that only showed up once you actually ran a migration, a timing behavior that only revealed itself once code was actually running, exactly the kind of thing document-list.md warned up front could never be fully pre-decided — that's precisely what a findings-log entry is for. You're not an executing agent yourself, but the same discipline applies to you for the same reasons it applies to them: append, don't quietly edit the source documents even when you're confident you've spotted an error, and label your own certainty honestly (`[Inference]` if it's a reasoned default, `[Speculation]` if it's an unverified guess, or state plainly that you tested something if you actually did). The whole value of this system comes from every discovery being written down in one place where the next person — human or agent — can actually find it, rather than living only in your own head or in a comment nobody will think to look for. You're now the person who knows this repository has that mechanism. Use it the same way everyone building it has been asked to.

---

# Chapter 0.2 — The Domain: How a Law Actually Gets Made in Batac City

Before you read a single line of the codebase, you need to understand the thing the code is a model of. `batac-dms` is not a generic "document management system" with a legislative flavor bolted on. Every table, every enum value, every timer in the workflow engine corresponds to a specific, real, legally mandated step that the Sangguniang Panlungsod (SP) — the City Council of Batac City, in the province of Ilocos Norte, Philippines — has been performing on paper for decades. If you skip this chapter and go straight to the code, terms like `PendingPanlalawigan`, `veto_override_vote`, or `triggers_mayor_lapse_timer` will look like arbitrary naming choices. They are not. They are direct transcriptions of a process defined by national law (the Local Government Code, Republic Act 7160) and by decades of local parliamentary practice. This chapter has zero code in it on purpose — the goal is for you to be able to explain, without looking at a screen, why a document needs *two* numbers instead of one, why the Mayor's silence can sometimes make something the law, and why a provincial body gets a say in a city's own ordinance.

## A. Who's Actually Involved: The Organizational Actors

Before any process makes sense, you need to know who the players are and, more importantly, what each one is actually *for*.

**The Sangguniang Panlungsod (SP)** is the City Council itself — the legislative body of Batac City. For the term this software was built around (the "7th Sangguniang Panlungsod"), it's made up of 12 voting members: 10 elected City Councilors, plus a representative from the ABC (the association of barangay captains) and a representative from the SK (the youth council). These 12 members debate, deliberate, and vote on the two kinds of measures this software handles: **resolutions** and **ordinances**. Passing something needs a simple majority — "half plus one," which with 12 members works out to 7 votes.

**The Vice Mayor** has a specific dual role that's easy to misunderstand if you've only seen U.S.-style government structures. The Vice Mayor is the **Presiding Officer** of the SP — they run the sessions, they're the one who formally refers a newly introduced measure to a committee, and they sign the certified final copy of anything the Council passes before it goes to the Mayor. The Vice Mayor is not a councilor casting an ordinary vote in day-to-day business; they're the person running the room.

**The SP Secretariat**, headed by the SP Secretary, is the administrative backbone of the whole operation — and this is the part of the organization the software serves most directly. The Secretariat is the office that receives every draft document, logs it, assigns it a tracking number, schedules it onto session agendas, records what happened at every reading and every vote, prepares transmittal letters, and manages the paperwork all the way through to permanent archiving. The Secretariat does not *decide* anything — it does not vote, veto, or judge legality — but almost nothing moves through the legislative process without the Secretariat touching it first. If you're building a feature and you're not sure who the primary user is, the answer is very often "the SP Secretariat staff."

**Committees** are where the substantive review of a measure actually happens. The 7th SP has 22 standing committees — Laws, Health and Sanitation, Transportation, Appropriations and Finance, and so on — each covering a different subject area. But committees aren't a separate body of people; they're just the same 12 councilors, organized into overlapping three-person groups (a Chairman, a Vice Chairman, and a Member), with each councilor typically sitting on four to six committees at once. When a measure gets referred to committee after its First Reading, it's being handed to a small subset of the same council members who specialize (informally) in that subject area, for closer study and a public hearing if one is needed.

One structural detail matters a lot here: **most measures go to two committees at once**, not one. The subject-matter committee (say, Transportation, for a traffic-related measure) is almost always joined by the **Committee on Laws, Rules, Ethics & Privileges**, which functions as a default co-reviewer on nearly everything. When multiple committees are involved, they don't each write a separate report — they hold a joint hearing and produce a single, unified report. And notably, if one of the co-referred committees can't show up, the hearing still goes ahead; a missing committee doesn't block the process, though the gap gets visibly flagged so it isn't quietly forgotten.

**The Mayor's Office** sits downstream of the SP entirely. Once the Council has passed something and the Vice Mayor has signed it, it goes to the Mayor for action — sign it, veto it, or (as you'll see below) simply let the clock run out. The Mayor's Office is also the source of one special procedural tool: the **Certification of Urgency**, which we'll get to in section F.

**The Sangguniang Panlalawigan** is the one actor on this list that's easy to get wrong, so it's worth being extra precise. "Panlalawigan" means "of the province" — this is the **Provincial Board**, the legislative council for the entire province of Ilocos Norte, of which Batac City is just one component city. After the City's own SP has passed a resolution or ordinance and the Mayor has acted on it, the document gets sent up to this provincial council for review. This is **not an appeals process**, and it is not the Provincial Board re-debating whether the policy is a good idea. Its job is narrower and more specific: checking whether the city's ordinance or resolution is *legally valid* — whether it was passed within the city government's authority and doesn't conflict with national law or the Provincial Board's own ordinances. Batac City is fully capable of passing its own laws; this review exists as a legality check that sits above every component city and municipality in the province, not as a body second-guessing the city's judgment.

## B. The Central Idea: Physical Paper Is the Law, the Software Is Where It Lives While It's Happening

This is the single most important conceptual distinction in the entire system, and if you get this backwards, everything else about the design will seem strange.

**The physical, wet-ink-signed document remains the legal source of truth.** A resolution isn't law because it exists as a row in a PostgreSQL database — it's law because a physical piece of paper was signed by the right people, in the right order, following the right procedure, and that piece of paper physically exists somewhere. This software is not trying to replace that paper. It is not a system of record for legal validity.

What the software *is*, is the **operational source of truth**: it tracks where a document currently is, what state it's in, who's responsible for the next step, what deadline is running against it, and the complete history of everything that's happened to it so far.

Concretely: when a councilor drafts a resolution, the physical draft is what matters legally. But nobody in the Secretariat, the Mayor's Office, or a citizen looking things up online can usefully answer questions like "has this been referred to committee yet," "is this waiting on the Mayor," or "did this already lapse into law" just by looking at a piece of paper sitting in a filing cabinet. That's the gap this software closes. It doesn't answer "is this a valid law" — the physical document, the readings, the votes, and ultimately the Panlalawigan's legal review answer that. It answers "where is this thing right now, and what needs to happen to it next."

This distinction is exactly why a stakeholder involved in gathering these requirements described the whole project's value, in their own words, as being "just for convenience so that people do not have to go in person" — the point isn't to digitize the *law*, it's to digitize the *waiting in line and asking around* that used to be required to find out what was happening to a piece of paper.

You'll also see this distinction show up as a very literal, physical checkpoint in the process: when a document is printed, wet-ink signed, and then scanned back into the system, a Records Officer has to manually verify that scanned image before it's accepted as the system's record of the official copy. The software isn't assumed to be correct by default — a human checks that the digital copy actually matches the physical one that's legally authoritative.

## C. The Three Document Types This Chapter (and This Phase of the Software) Cares About

The software's first phase of development covers exactly three kinds of legislative documents, and the differences between them are not cosmetic — they reflect real differences in legal weight.

**SP Resolution** — a resolution typically expresses the Council's position on something, or handles the SP's own internal business (like commending someone, or requesting something from another office). It goes through **two readings**.

**SP Ordinance** — an ordinance is a binding local law with permanent, ongoing legal effect on the city (things like a curfew ordinance, a business-permitting ordinance, a zoning rule). It goes through **three readings**.

**Appropriation Ordinance** — this is a specific kind of ordinance dealing with the city budget (allocating or reallocating funds). It follows the exact same downstream process as a regular ordinance — same three readings, same Mayor and Panlalawigan rules — but it has its own numbering series and, notably, is treated as never having a "penalty clause," which matters for the publication rule in section C below.

### What a "reading" actually is

If your only association with the word "reading" is a UI screen with a progress bar, drop that immediately. A **reading** is a real parliamentary-procedure event: it is a specific, formal occasion, during an actual session of the Council, when a measure is literally presented before the assembled body, usually by title (and sometimes read aloud in full), so that the members can act on it collectively. It's not a step in a computer workflow that happens to be named "reading" — the computer workflow step is named "reading" because it's recording something that happens live, in a room, with actual people voting.

- **First Reading** is largely procedural: the measure's title and sponsors are read, and the presiding Vice Mayor refers it to the appropriate committee (or committees) for study. There's no debate yet.
- **Second Reading** is where the real work happens: the measure comes back from committee (assuming it wasn't fast-tracked — see section F), and it's opened up to debate, discussion, and amendments. The Council votes on it here.
- **Third Reading** — which only ordinances go through, not resolutions — is the final, formal vote on the *fully finalized* text, incorporating whatever amendments were adopted at Second Reading. By design, no further debate is allowed at Third Reading and only minor, formal corrections are accepted; the point of a Third Reading is that everyone is voting on the exact same, final piece of text, not on a moving target.

### Why ordinances get an extra reading and resolutions don't

This isn't an arbitrary process quirk — it tracks directly with legal weight. An **ordinance** is a binding law with permanent, ongoing effect on the whole city and its residents; it needs the extra formal checkpoint of a Third Reading specifically so that the body votes on a stabilized, final text, not on "the resolution as amended, whatever exactly that ended up being." A **resolution**, by contrast, typically expresses a position or handles the SP's own internal affairs — lower permanent stakes, so the process allows amendments to be adopted and then voted on again within the *same* Second Reading, without a separate formal reading stage. More binding, more permanent consequence gets more procedural ceremony. Less permanent consequence gets a leaner process.

## D. Why Documents Get Two Different Numbers

This is one of those details that looks like unnecessary complexity until you think through what would happen without it.

When a councilor's draft resolution or ordinance first arrives at the Secretariat and gets logged, it's immediately assigned a **preliminary number** with a "Draft" prefix — something like `Draft 7SP 2026-02`. Note this happens *before* the document has been debated, before it's been through committee, before anyone has voted on anything. At this point, nobody knows yet whether this measure is going to pass.

The document only gets its **final number** — the same format but with the "Draft" prefix stripped off, e.g. `7SP 2026-1` — after it clears its *last* required reading's vote (Second Reading for a resolution, Third Reading for an ordinance), and specifically *before* the Vice Mayor and Mayor sign it.

Why go through this two-stage dance instead of just numbering things once, at intake? Think about what the historical, permanent record of "7SP 2026-1, 7SP 2026-2, 7SP 2026-3…" is supposed to mean to anyone looking it up years later: it's supposed to be the authoritative, gapless sequence of things the City Council actually *enacted*. If a draft got assigned a permanent slot in that sequence the moment it walked in the door, and then got voted down at Second Reading, you'd either have to live with a permanent gap in your enacted-law numbering (confusing to anyone doing historical research — "why does 7SP 2026-4 not exist?") or you'd have to go back and renumber everything that came after it (which destroys the historical record's stability in an even worse way). The two-stage system avoids both problems: the *preliminary* number is disposable and can even be reassigned before finalization — because if a different measure happens to clear its final vote first, the sequence of *final* numbers depends on which document actually completes its last reading first, not on which one got logged into the Secretariat first. The *final* number, once assigned, is permanent, unique, and never reused, even if the document is later cancelled — because by the time a document has a final number, it has actually passed, and the record needs to stay stable forever after that point.

## E. The Mayor's 10-Day Window: Sign, Veto, or Lapse

Once a resolution or ordinance has cleared its final reading vote and the Vice Mayor has signed the certified copy, the Secretariat prepares a formal cover letter — called a **Transmittal Letter**, addressed "For appropriate action" — and sends the whole package to the Mayor's Office. From that point, the Mayor has **10 calendar days** to act. There are exactly three things that can happen:

1. **The Mayor signs it.** Straightforward — the Mayor approves, and the document proceeds.
2. **The Mayor vetoes it.** The Mayor formally returns the document to the SP along with written objections explaining why. This is not a silent rejection; the Mayor has to put the reasons on paper.
3. **The Mayor does neither, and 10 days pass.** This is the case that trips people up if they've never encountered it before: the Mayor's *silence* does not kill the measure. If 10 calendar days go by with no signature and no veto, the resolution or ordinance is said to have **"lapsed into law."** That specific phrase — "lapse" — means exactly this: passive, automatic approval by the mere passage of time, with no affirmative action required from anyone. The legal basis for this rule is the Local Government Code (Republic Act 7160). Practically, this means a Mayor cannot indefinitely stall something they don't want to formally oppose just by never touching it — the clock does the work for them, in the Council's favor.

If the Mayor *does* veto, that's not automatically the end of the road either. The Council can attempt to **override** the veto — meaning it can vote again to pass the measure anyway, over the Mayor's stated objections. But an override isn't a simple majority vote like the original passage was. It requires a **supermajority**: two-thirds of the SP's membership, which with 12 total members works out to **8 of 12 votes**. This is a substantially higher bar than the 7-of-12 needed to pass something in the first place — deliberately so, since overriding an executive's formal, written veto is a bigger institutional move than passing ordinary business. If the override vote succeeds, the document proceeds as if the Mayor had signed it. If it fails, the measure dies.

## F. "Certified Urgent": When the Normal Pace Gets Skipped

Under the ordinary process described above, there's a real gap in time between First Reading (referral to committee) and Second Reading (debate and vote) — the committee needs time to actually study the measure and hold a hearing if one's warranted. The **Certification of Urgency** is the formal mechanism that collapses that gap.

A Certification of Urgency is a **formal written document issued by the Mayor** — not a verbal request, not an informal nudge, an actual signed document — certifying that a specific pending measure (or, sometimes, several measures at once) needs to move urgently. When the Secretariat logs a Certification of Urgency against a measure, that measure's **committee referral step is skipped entirely**, and it goes straight from First Reading to Second Reading, debate, and vote — all in the *same session*. This isn't a rare, exceptional procedure reserved for genuine emergencies only; it's confirmed to happen frequently in Batac City's actual practice.

One detail worth being precise about: the Certification itself doesn't get its own independent numbering series or standalone filing. It's always attached to, and filed alongside, the specific measure(s) it certifies — it has no separate identity of its own in the record.

## G. Sangguniang Panlalawigan Review and Its Own 30-Day Clock

Once the Mayor has acted on a resolution or ordinance — whether by signing it, by a 10-day lapse, or by a successful veto override — the document isn't finished with external review. It gets transmitted to the **Sangguniang Panlalawigan**, the provincial council described in section A, for review.

To restate the key point from section A because it's genuinely easy to get wrong: this is **not** an appeals process, and it is **not** the Provincial Board relitigating whether the policy is a good idea. It's specifically checking legality and validity — did the city stay within its authority, does this conflict with anything at the provincial or national level. The outcomes the Panlalawigan can hand back reflect that narrow legal-review scope:

- **VALID** — approved, no legal problems found.
- **VALID-IN-PART** — some specific provisions are found invalid, but the rest stands.
- **RETURNED** — sent back with objections; effectively treated as disapproved. When this happens, implementation of the measure is usually stopped, and the SP Secretariat follows the Panlalawigan's recommendations, which might mean modifying and repassing the measure, referring it to the City Legal Office, or in some cases the Secretariat implementing the needed changes directly without a full repass.
- **Operative in its entirety** — a Panlalawigan outcome used specifically for Appropriation Ordinances, meaning valid and fully implementable (functionally the budget-specific equivalent of VALID).

And then there's the automated timer: this whole review process runs on its own **30-day clock**, tracked from the date of transmission. If the Panlalawigan takes action within those 30 days, the SP Secretariat receives a formal written notification (the Panlalawigan's own resolution) recording the outcome. But if **30 days pass with no action at all**, the outcome is, in the source material's own precise language, **"Deemed Approved"** — with the specific legal basis being Section 56(d) of the Local Government Code, and the standard remarks notation being "Lapsed 30 days." This is structurally the same idea as the Mayor's 10-day lapse rule in section E: silence past a statutory deadline doesn't block the measure, it passively approves it.

## H. The Citizen Complaint Module and Its Three Access Modes

Separately from the legislative documents described above, the software also handles **Citizen Complaints** — grievances any resident can file with the Council. Despite an early version of this feature being scoped narrowly around tricycle-transportation complaints (overcharging, trip-cutting, refusing to pick up a passenger, discourtesy), the finalized scope covers **any LGU-related complaint**, not just transportation ones — a citizen with any grievance addressed to the SP can use this module, and the Secretariat decides, case by case, whether it should be routed straight to a committee or to the Vice Mayor's office.

The same "three access modes" pattern applies here as it does to document requests (section I), and it's worth being concrete about what each mode actually asks the citizen to do, since they're meaningfully different:

1. **Download-and-submit physical mode**: the citizen downloads a blank complaint form template from the city's public website, fills it out by hand, physically signs it, and submits the paper document to the Secretariat in person or by mail.
2. **Digital form, printed and signed**: the citizen enters their complaint details into a digital form inside the system itself, which generates a formatted, printable version of the same form. The citizen then has to print that generated form, physically sign it, and submit the signed paper — the digital entry captures the data and produces nicely formatted paperwork, but it does not eliminate the requirement for an actual wet-ink signature on physical paper.
3. **In-person, clerk-assisted**: the citizen goes to the Secretariat's office directly, and a clerk types the citizen's complaint details into the digital form on the citizen's behalf, prints the resulting document on the spot, and the citizen signs it right there before leaving.

Every one of these three modes ends the same way — with a signed physical document in the Secretariat's hands. What differs is only *how* the data initially gets typed in and *where* the citizen has to be for that to happen. None of the three modes are a way of avoiding the physical-signature requirement; the digital paths are conveniences layered on top of it, not replacements for it.

## I. What a Citizen Can See for Free vs. What They Have to Pay For

The public-facing side of this system — even though the actual public portal application is not what Phase 1 of the software delivers first — has a specific, deliberately scoped policy about what's freely visible versus what costs money.

For any approved resolution or ordinance, the **title and the first page** are visible to the public for free, with no account or payment required. Getting a **full copy** of the document, however, requires submitting a formal, paid **Document Request Form**, which itself needs sign-off from both the Vice Mayor and the SP Secretary before it's fulfilled.

The rationale the source material actually gives for this split is cost recovery, not a restriction on transparency for its own sake: the paid document-request process is explicitly tied to an existing local fee schedule (the city's own "Secretary's Fees" ordinance), and the underlying framing is that the LGU has real costs associated with producing and releasing full copies of official records, which the fee structure is meant to offset. It's worth being precise that this isn't framed as "citizens don't have a right to see this" — the title and first page being public *is* the transparency commitment; the fee applies specifically to the added service of producing a complete, certified copy on demand.

## J. What's Explicitly Not Built Yet, and What Those Things Actually Are

The software's first phase deliberately does not cover every document type the Secretariat handles in real life. Understanding what's deferred — and what those documents actually *are* in plain government-process terms — matters if you ever pick this work back up, because these aren't hypothetical future features; they're things the Secretariat is dealing with on paper right now, in parallel with everything Phase 1 covers.

**Letters Received and Letters Sent** are exactly what they sound like: the day-to-day flow of correspondence in and out of the SP Secretariat's office. Looking at an actual excerpt of the Secretariat's own log, "Letters Received" turns out to be an enormous, genuinely miscellaneous bucket — in a single quarter it includes things like a request to use the SP Session Hall as a venue for an unrelated city office's meeting, an invitation to a wedding, a letter of thanks from a local university, a request for burial assistance from a grieving family, a job application, a notice about a public hearing for an entirely different piece of provincial legislation, and dozens more like it. This is not legislative business in the sense that resolutions and ordinances are — it's the ordinary administrative correspondence that flows through any government office, and it needs to be logged and tracked, but it doesn't go through readings, votes, or Mayor/Panlalawigan review.

**Memos Incoming and Outgoing** are internal administrative communications — the kind of routine, lower-stakes office memo you'd expect inside any bureaucracy, as distinct from letters coming from or going to outside parties.

**Notices of Committee Hearing** are the formal notifications the Secretariat sends out when a committee is about to hold a public hearing on a referred measure — who's being notified, which committee(s), when and where. **Notices of Special Session** serve a similar notification function, but for an out-of-cycle emergency session of the full Council rather than a committee hearing — and it's worth knowing that these two document types share a very similar name but are tracked as two entirely separate numbering series; conflating them has actually been a documented clerical mistake in the Secretariat's own past records.

**Designations** are the formal documents by which the Mayor or Vice Mayor temporarily hands their own authority to someone else — the most common real-world example being the Vice Mayor being designated as **Acting Mayor** while the actual Mayor is traveling, which turns out to happen routinely (more than ten times in a recent two-year span, not as a rare edge case). A Designation has a defined start and end, and authority automatically reverts to the original office-holder once it expires.

**Barangay Resolutions** are a different kind of document entirely — these are resolutions passed at the *barangay* level (the barangay being the smallest, most local unit of Philippine government, below the city), which get forwarded up for the city-level SP to review as part of its own oversight function. They're deferred alongside the other Phase 1B items above.

**Franchise Ordinances** are the one item on this list that isn't just deferred — they're **out of scope entirely** for this platform, for a structural reason rather than a prioritization one. Franchise matters (things like tricycle or jeepney franchise regulation) are handled by a separate office — the Franchise Section — which operates under its own jurisdiction and already has its own separate system. This platform will, at most, show a read-only link out to that external system; it will never create, edit, or manage franchise data directly, because that's simply not this office's job to begin with.

Related to all of this is the broader compliance backdrop you'll hear referenced as "ARTA" or "RA 11032" — this stands for the **Anti-Red Tape Act**, a national law establishing service-level expectations (maximum allowable processing times) for government transactions generally. It's the legal basis for the SLA (service-level agreement) tracking and deadline/escalation behavior built into the legislative workflow, and it's a real statutory obligation the LGU has to meet, not an arbitrary internal performance target the development team invented.

---

# Chapter 1.1: The Database Layer — Postgres, Drizzle, and the Rules That Ship With Every Table

## Why this chapter starts with the database, not the API

You now know the governance system (Chapter 0.1) and the legislative process this software models (Chapter 0.2). The next logical place to go is the database, and there's a specific reason for that ordering: almost every rule this chapter covers — office isolation, the audit trail, gapless numbering, "nothing is ever really deleted" — is a rule about *data*, not about *behavior*. Once you understand how the data itself is shaped and constrained, the application code you'll read in later chapters will mostly look like it's just carefully avoiding fighting the database, rather than doing anything clever on its own. The database is where this project keeps its promises to the Commission on Audit, to RA 7160, and to itself. This chapter is about how those promises get written down in a way PostgreSQL can actually enforce.

## A. Why PostgreSQL, specifically — not "a database," not MySQL

It would be easy to treat "we're using PostgreSQL" as an arbitrary technology choice, the kind of thing a team picks because they know it well. That's not what happened here. The project has a formal Architecture Decision Record — `ADR-GEN-003` — that exists specifically to make the reasoning explicit and permanent, and it's worth reading its own words rather than a paraphrase:

> PostgreSQL is the sole relational database engine for the entire platform. MySQL and MariaDB are excluded entirely and permanently. No other relational database engine is used for any data storage requirement.

"Excluded entirely and permanently" is strong language for a technology choice, and the ADR backs it with specifics rather than vague preference. On MySQL and MariaDB specifically:

> Lacks JSONB (the MySQL `JSON` type does not support GIN indexing or efficient containment queries), lacks Row-Level Security as a native feature, and lacks the append-only grant model needed for audit log enforcement at the database permission level. All three are load-bearing architectural requirements.

The ADR also explains why two tempting alternatives were rejected. MongoDB "seems appealing for variable document metadata," but "does not provide the same ACID transaction guarantees across collections, has a weaker query model for relational data (committee membership, role assignment chains, delegation hierarchies), lacks the RLS model required for office-scoped isolation, and lacks native sequence support for gapless numbering." SQLite was "not considered beyond initial evaluation" — it isn't built for a multi-user server with concurrent writes, which this platform obviously is (many Secretariat staff, committee members, and the Mayor's office all touching the same data at once).

`tech-stack.md` distills this decision into a short, blunt list it calls the **PostgreSQL Non-Negotiables**:

> These features are the reason MySQL is excluded. Do not work around them.
>
> - **JSONB** — Admin-configurable document metadata (variable fields per document type). Use GIN indexes. Query with `@>` operator and `->>` accessors.
> - **Row-Level Security (RLS)** — Office-level data isolation enforced at the DB engine, not only in application middleware.
> - **Append-only audit log** — Revoke `UPDATE` and `DELETE` on the audit schema from the application DB user. Only `INSERT` is permitted. This is enforced at the PostgreSQL grant level.
> - **Check constraints for state transitions** — Enforce valid workflow state transitions at the DB level as a second line of defense.
> - **Sequences for gapless document numbering** — Use PostgreSQL sequences with appropriate configuration per series per year.

**JSONB** is PostgreSQL's binary-encoded JSON column type. To understand why it exists, think about the problem it solves: this platform handles eighteen different document types (you met these in Chapter 0.2 — resolutions, ordinances, complaints, letters, and so on), and each type has its own set of metadata fields. A Citizen Complaint needs a complainant name and a category. An SP Ordinance needs a penalty-clause flag. If you tried to model this with an ordinary rigid table schema, you'd either need one enormous table with dozens of mostly-empty columns (a different set relevant to each document type), or you'd need a separate table per document type with its own migration every time a Platform Administrator wants to add one new field to one document type. Neither is workable for a system where an admin — not a developer — needs to be able to configure fields without anyone touching code. JSONB solves this by letting a single column hold an arbitrary, nested JSON structure, while still being a real, indexable, queryable PostgreSQL column rather than an opaque blob of text — you can index into its keys, query for containment (`@>`), and pull specific values back out (`->>`) with real database performance, unlike a plain `TEXT` column holding JSON as a string.

**Row-Level Security (RLS)** solves a different problem: it moves an access-control rule from "somewhere in the application code, hopefully everywhere it needs to be" into "impossible to bypass no matter which code path runs the query." Think about what an ordinary, application-layer permission check looks like: somewhere in a service function, before returning results, code checks "does this user's office match the document's office?" and filters accordingly. That works, right up until some other code path — a new report-generation feature, a debugging script, a future engineer who didn't know the rule existed — queries the same table without remembering to apply that check. RLS closes that gap by attaching the restriction to the *table itself*, at the database engine level. Once RLS is enabled and a policy is defined, PostgreSQL silently rewrites every query against that table to include the restriction — automatically, for every query, from every piece of application code, forever, with no way to accidentally forget it. `ADR-GEN-003`'s own framing captures this precisely: RLS is "a second layer behind application ABAC" — not a replacement for the application's permission logic, but a backstop that catches the case where the application logic has a bug.

**The append-only audit log** solves the problem of trusting your own history. An audit trail's entire value proposition is that it's an honest record of what happened — but if the same database user account that writes normal application data can also modify or delete rows in the audit log, then the audit log is only as trustworthy as that account's code being bug-free and that account never being compromised. PostgreSQL's grant system lets you make this structurally impossible rather than merely policy-discouraged: you can `REVOKE` the `UPDATE` and `DELETE` privileges from a specific database role on a specific schema, so that even a fully compromised application process, running arbitrary attacker-controlled code, physically cannot alter or erase a row it already wrote — the database itself will reject the attempt, the same way it would reject any other privilege violation.

**Sequences for gapless numbering** solve a subtler problem than it first appears, and it's worth being precise about why "just take the current maximum ID and add one" doesn't actually work under real conditions. Imagine two Secretariat staff members logging documents at nearly the same instant. Staff member A reads the current max final number (say, 41) and prepares to insert 42. Before A's insert commits, staff member B also reads the max (still 41, since A hasn't committed yet) and also prepares to insert 42. Now you have two documents both trying to claim final number 42 — a collision, in a numbering series that's supposed to be a legally meaningful, permanent, unique historical record. A PostgreSQL `SEQUENCE` avoids this entirely, because `nextval()` is atomic at the database engine level: two concurrent callers asking for "the next value" are guaranteed, by PostgreSQL itself, to receive two different, sequential values, no matter how close together in time they ask. That's what "gapless" actually buys you here — not that a sequence can never skip a number (they can, under certain conditions, which is why Chapter 0.1's findings-log discussion flagged sequence rollover edge cases as a real open question), but that it can never hand out the *same* number twice under concurrent load, which "read the max and add one" fundamentally cannot guarantee.

You'll see all four of these — JSONB, RLS, the audit grant restrictions, and sequences — in actual code before this chapter ends. Let's start with the one that shows off the most Drizzle machinery at once.

## B. Drizzle ORM from first principles, using a real file

Drizzle ORM is a TypeScript library that lets you define your database schema as TypeScript code, and then generates both your actual SQL schema *and* fully-typed query functions from that single definition. The promise is: you write your tables once, in TypeScript, and you get compile-time type safety on every query you write against them, plus a generated migration whenever the schema changes.

The cleanest single file to learn Drizzle's core vocabulary from is `/packages/database/schema/audit.schema.ts` — it's short (91 lines), and it happens to use nearly every primitive you'll need across the rest of the codebase. Here it is in full:

```typescript
// packages/database/schema/audit.schema.ts
import {
  pgSchema,
  uuid,
  bigint,
  text,
  jsonb,
  integer,
  timestamp,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * The `audit` PostgreSQL schema.
 *
 * This schema acts as a tamper-evident append-only log for all system activities.
 *
 * Intentional invariant exceptions (per C5 §1.5 exception list):
 *   - No soft-delete columns (`deleted_at`, `deleted_by`) and no `updated_at` column.
 *     The table is append-only by design. UPDATE and DELETE privileges are revoked
 *     at the database grant level.
 *
 * Sources: C1 Part 10 DDL, Decision D-ABAC-04 (I3 §18.1 / I1 §8.3).
 */
export const auditSchema = pgSchema('audit');

/**
 * Monotonic sequence for unambiguous "previous record" pointer,
 * independent of wall-clock timestamp ordering.
 */
export const eventsSequenceSeq = auditSchema.sequence('events_sequence_seq', {
  startWith: 1,
  increment: 1,
});

/**
 * Append-only, hash-chained, HMAC-signed audit events.
 */
export const auditEvents = auditSchema.table(
  'events',
  {
    /** UUID v4 primary key. */
    id: uuid('id').primaryKey().defaultRandom(),
    /** Tenant identifier (Batac City LGU default UUID). */
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    /** Monotonically increasing sequence number. */
    sequenceNumber: bigint('sequence_number', { mode: 'bigint' })
      .notNull()
      .default(sql`nextval('audit.events_sequence_seq')`),
    /** Logical identifier of the event class (e.g. 'document.created'). */
    eventType: text('event_type').notNull(),
    /** Logical FK to iam.users.id (cross-schema); null for system/anonymous events. */
    actorId: uuid('actor_id'),
    /** ID of the target resource. */
    targetId: uuid('target_id'),
    /** Entity type of the target resource (e.g. 'document'). */
    targetType: text('target_type'),
    /** Denormalized owning office UUID of the target resource at write time. */
    resourceOfficeId: uuid('resource_office_id'),
    /** Full domain event structured payload. */
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
    /** Sha256 SHA-2 hash linking this event to the previous chain hash. */
    chainHash: text('chain_hash').notNull(),
    /** HMAC-SHA256 signature for data integrity. */
    hmac: text('hmac').notNull(),
    /** Version of the key used to generate the HMAC. */
    hmacKeyVersion: integer('hmac_key_version').notNull().default(1),
    /** Wall-clock timestamp of when the event occurred. */
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Unique Index
    uniqueIndex('uq_audit_events_sequence').on(table.sequenceNumber),
    // Standard Indexes
    index('idx_audit_events_city_occurred').on(table.cityId, table.occurredAt),
    index('idx_audit_events_actor').on(table.actorId),
    index('idx_audit_events_target').on(table.targetId),
    // Partial Index
    index('idx_audit_events_resource_office')
      .on(table.resourceOfficeId)
      .where(sql`${table.resourceOfficeId} IS NOT NULL`),
    // Check Constraints
    check('chain_hash_check', sql`${table.chainHash} ~ '^[a-f0-9]{64}$'`),
    check('hmac_check', sql`${table.hmac} ~ '^[a-f0-9]{64}$'`),
  ],
);
```

Let's walk this top to bottom.

### `pgSchema` — one PostgreSQL schema per module

```typescript
export const auditSchema = pgSchema('audit');
```

`pgSchema('audit')` doesn't create a table — it creates a handle representing a PostgreSQL *schema* (a named namespace inside the database, roughly analogous to a folder). Every table you define using `auditSchema.table(...)` from here on lives inside that `audit` namespace, fully qualified as `audit.events` rather than a bare `events` sitting in PostgreSQL's default `public` namespace.

This maps directly onto something you already know from Chapter 0.2's README excerpt: "Each module owns its own PostgreSQL schema. No cross-schema foreign keys." That's not a loose guideline being informally followed — it's implemented, literally, by having a separate `pgSchema(...)` call per module. You'll see this same pattern repeated in every schema file in the codebase: `organizationSchema = pgSchema('organization')`, `trackingSchema = pgSchema('tracking')`, and so on, each module getting its own genuinely separate PostgreSQL namespace. Why bother with this instead of one big `public` schema holding every table? Because a real PostgreSQL schema boundary gives you something a naming convention (like prefixing every table `audit_events`, `iam_users`, and so on) can't: you can grant and revoke permissions *per schema*, which is exactly the mechanism the append-only audit guarantee depends on (more on this in section C), and it makes "which module owns this table" a structural fact about the database rather than a convention someone has to remember to follow.

### `.sequence(...)` — a real PostgreSQL sequence, defined in TypeScript

```typescript
export const eventsSequenceSeq = auditSchema.sequence('events_sequence_seq', {
  startWith: 1,
  increment: 1,
});
```

This is Drizzle's wrapper around the `CREATE SEQUENCE` statement discussed in section A — a genuine, atomic, database-native counter, living inside the `audit` schema, starting at 1 and incrementing by 1 each time it's asked for the next value. The docstring above it in the real file explains its specific purpose here: it "gives the hash chain an unambiguous, monotonic 'previous record' pointer, independent of wall-clock timestamp ordering" — in other words, it's not used for anything document-numbering related in this particular table; it's used to give every audit event an unambiguous position in a strict, gapless order, which the hash-chaining mechanism (section C) depends on.

### `.table(...)` — the table definition, and its three-part shape

```typescript
export const auditEvents = auditSchema.table(
  'events',
  { /* columns */ },
  (table) => [ /* indexes and constraints */ ],
);
```

Every Drizzle table definition takes this same three-argument shape: the table's SQL name (`'events'`, so the fully qualified name is `audit.events`), an object mapping TypeScript property names to column definitions, and — this is the part worth pausing on if you haven't seen it before — a function that receives the table (once its columns exist) and returns an *array* of additional table-level constructs: indexes, unique constraints, and check constraints. This array-of-builder-functions pattern exists because things like a multi-column index or a check constraint that references two columns can't be attached to a single column definition in isolation — they need to see the whole table's shape first, which is why they're expressed as a separate function that runs after the columns are defined, rather than being embedded column-by-column.

### The column-type helpers

Each entry in the columns object calls a helper function that corresponds to a PostgreSQL column type:

- `uuid('id')` — a PostgreSQL `UUID` column. `.primaryKey()` marks it as the table's primary key; `.defaultRandom()` tells PostgreSQL to generate a random UUID v4 by default on insert (this is what compiles down to `DEFAULT gen_random_uuid()` in the actual SQL, which you'll see below).
- `text('event_type')` — PostgreSQL's `TEXT` type, an unbounded-length string column. Notice this project doesn't use `VARCHAR(n)` anywhere in this file — `TEXT` with no length limit is the default choice here, with actual value restriction handled by `check()` constraints where needed (see `organization.schema.ts`'s `officeType` column later in this chapter for an example) rather than by an arbitrary character limit.
- `jsonb('payload')` — the JSONB column type discussed in section A.
- `bigint('sequence_number', { mode: 'bigint' })` — a 64-bit integer column. The `{ mode: 'bigint' }` option tells Drizzle to represent this value as a JavaScript `BigInt` in your TypeScript code (rather than a regular `number`), because a `BIGINT` can hold values larger than JavaScript's `number` type can represent precisely.
- `integer('hmac_key_version')` — an ordinary 32-bit `INTEGER` column, used here because key versions will never realistically need `BIGINT`'s range.
- `timestamp('occurred_at', { withTimezone: true })` — a `TIMESTAMPTZ` (timestamp with time zone) column. You'll see this option, `{ withTimezone: true }`, on every single timestamp column in this codebase — it's not optional stylistic flourish, it's a documented project-wide invariant (Invariant #7, which you'll meet again in section D) requiring every timestamp to carry timezone information, specifically so that a timestamp recorded by a server in one timezone is never misinterpreted when read back by a client, or a report, or a future migration, running in a different one.

Chained onto several of these: `.notNull()` (forbids `NULL`, becoming `NOT NULL` in SQL), `.default(...)` (a default value, which can be a plain value like `.default(1)` or, as you see with `cityId` and `sequenceNumber` above, a raw SQL expression wrapped in Drizzle's `sql` template tag when the default needs to call a PostgreSQL function like `nextval()`), and `.defaultNow()` (a convenience shorthand specifically for "default to the current timestamp," equivalent to `.default(sql\`now()\`)`).

### `$type<T>()` on the JSONB column — constraining what Postgres itself won't

```typescript
payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
```

This is worth explaining carefully, because it does something that might seem redundant at first: PostgreSQL's `JSONB` column type will happily store *any* valid JSON value — a string, a number, an array, a deeply nested object, anything. The database itself enforces no particular shape on what's inside a JSONB column. So why does the TypeScript code add `.$type<Record<string, unknown>>()` here?

Because Drizzle's whole value proposition is that your TypeScript code gets to work with fully-typed query results — and without `$type<T>()`, Drizzle has no way to know what shape of JavaScript value a `JSONB` column should produce when you read a row back. Left unconstrained, it would have to type the column as something unhelpfully vague. `$type<T>()` doesn't add any runtime validation and doesn't change a single byte of what PostgreSQL will accept — it's a purely compile-time annotation that tells *Drizzle's TypeScript inference*, "when you read this column, treat it as this shape." That means if application code elsewhere tries to do `auditEvent.payload.someTypo`, TypeScript will catch that as an error at compile time, even though PostgreSQL itself would never have objected to storing or retrieving a payload missing that field. It's a way of borrowing some of the database's flexibility (any JSON shape can be stored) while still getting some of a rigid schema's safety (your own code can't casually misuse the shape you expect) — a genuinely useful middle ground, as long as you remember the annotation is enforced by the TypeScript compiler, not by PostgreSQL, and so it's only as trustworthy as the code that writes to that column actually being correct.

### `check`, `index`, and `uniqueIndex` — the table's third argument in practice

The array returned from the third-argument function in `auditEvents` shows all three:

```typescript
(table) => [
  uniqueIndex('uq_audit_events_sequence').on(table.sequenceNumber),
  index('idx_audit_events_city_occurred').on(table.cityId, table.occurredAt),
  index('idx_audit_events_actor').on(table.actorId),
  index('idx_audit_events_target').on(table.targetId),
  index('idx_audit_events_resource_office')
    .on(table.resourceOfficeId)
    .where(sql`${table.resourceOfficeId} IS NOT NULL`),
  check('chain_hash_check', sql`${table.chainHash} ~ '^[a-f0-9]{64}$'`),
  check('hmac_check', sql`${table.hmac} ~ '^[a-f0-9]{64}$'`),
],
```

`index(...)` creates an ordinary PostgreSQL index — a data structure that speeds up lookups on the columns it covers, at the cost of some extra storage and slightly slower writes. `uniqueIndex(...)` does the same, but additionally forbids duplicate values across the indexed column(s) — so `uq_audit_events_sequence` guarantees, at the database level, that no two audit events can ever share a sequence number.

One of these indexes has a `.where(...)` clause attached — `idx_audit_events_resource_office`, which only indexes rows where `resourceOfficeId` is not null. This is a *partial index*: rather than indexing every row in the table, it only indexes the subset matching the condition. The comment right above it in the source explains why: "most session/system events have `resource_office_id = NULL`; office-scoped ABAC reads... query only non-null rows." Building a full index across a column that's usually null would waste space indexing a value nobody's actually querying for — the partial index keeps the index small and fast by only covering the rows that matter for the specific query pattern it exists to serve.

`check(...)` is the one genuinely new concept here, and it's central to point C below, so let's move there directly.

## C. The append-only audit pattern: a guarantee with teeth

The docstring at the top of `audit.schema.ts` names something the file calls "intentional invariant exceptions":

> Intentional invariant exceptions (per C5 §1.5 exception list):
>   - No soft-delete columns (`deleted_at`, `deleted_by`) and no `updated_at` column. The table is append-only by design. UPDATE and DELETE privileges are revoked at the database grant level.

If you look back at the column list, you'll notice `auditEvents` has no `updatedAt` column and no `deletedAt`/`deletedBy` columns — a genuine, deliberate absence, not an oversight. Every other table you'll encounter in this codebase (organization's `offices`, tracking's `qrCodes`, essentially everything) has these columns. The audit table is different on purpose, and the reasoning is worth spelling out precisely, because "append-only" is doing real work here, not just describing a habit.

An audit log's entire value is that it's an honest, unalterable record of what actually happened. If the same table that records "user X did action Y at time Z" could later have that row's timestamp updated, or the row deleted outright, then the audit log stops being trustworthy evidence and becomes just another piece of application state that *might* have been tampered with — by a bug, by a malicious insider with database access, by anyone. So this table doesn't merely *lack* update/delete columns by convention; the actual PostgreSQL grants for this schema are configured so that `UPDATE` and `DELETE` are structurally impossible for the application's runtime database role — not "the application code chooses not to call those operations," but "the database itself will refuse the operation if anyone tries it, regardless of what code is asking." You'll see the exact grant statements that enforce this in section F, when we get to the three-database-role pattern.

Now look at the two `check(...)` calls at the bottom of the file:

```typescript
check('chain_hash_check', sql`${table.chainHash} ~ '^[a-f0-9]{64}$'`),
check('hmac_check', sql`${table.hmac} ~ '^[a-f0-9]{64}$'`),
```

A PostgreSQL `CHECK` constraint is a boolean condition attached directly to a table (or a column) that every row must satisfy, checked by the database engine itself on every `INSERT` and `UPDATE`. If a row would violate the condition, PostgreSQL rejects the write outright — the row simply never gets committed. Here, `~` is PostgreSQL's regular-expression match operator, so `${table.chainHash} ~ '^[a-f0-9]{64}$'` reads as: "the `chain_hash` column's value must match this pattern — start of string, followed by exactly 64 lowercase hexadecimal characters, then end of string." That's the exact shape of a SHA-256 hash rendered as a hex string (32 bytes, each represented as two hex characters, gives 64 characters total). The `hmac` column carries an identical constraint.

Why does this matter, and why is validating a hash's *format* at the database level meaningfully different from validating it in application code? Because a `CHECK` constraint closes off every possible write path at once, permanently, without relying on every piece of code that might ever insert into this table remembering to run the same validation. If someone writes a new script six months from now that inserts directly into `audit.events` — a data-migration tool, a one-off backfill, anything — and that script has a bug that produces a malformed or truncated hash, PostgreSQL itself refuses the insert before it ever lands in the table. An application-layer validation function, by contrast, only protects the specific code path that calls it; any other insert path that doesn't call that same validation function is unprotected. The `CHECK` constraint doesn't care which code is doing the inserting — it's a property of the table itself, always enforced, the same defense-in-depth logic behind RLS from section A, applied to data shape instead of data visibility.

Notice, too, exactly what these constraints do and don't guarantee: they check that `chain_hash` and `hmac` *look like* valid 64-character hex strings. They don't verify that the hash is *cryptographically correct* — that it was actually computed correctly from the preceding record and the right payload. That computation happens in application code, using Node's `crypto` module (the file's own comment on the `audit` schema in C1's DDL states this explicitly: "The application — never the database — computes `chain_hash` and `hmac`"). The database's job here is narrower and more mechanical: guarantee the *shape* is never wrong, as an unconditional backstop, while trusting the application to get the *cryptographic content* right. That's a genuinely useful division of labor — the database enforces what it can cheaply and unconditionally enforce (format), and leaves what requires actual cryptographic computation to the layer equipped to do it (application code).

## D. Soft delete: the rule everywhere else, and why a government system needs it

Section C described the audit table's deliberate exception. Now let's look at the rule that exception is an exception *to* — because "everywhere else, nothing is ever hard-deleted" is one of the strongest, most consistently applied conventions in this whole codebase.

The formal decision lives in `ADR-GEN-008`, and its opening context paragraph explains why a legislative records platform would even consider such an absolute rule:

> SP Resolutions and Ordinances are permanent public records under RA 7160 (Local Government Code). The Commission on Audit (COA) requires physical originals to be retained until COA formally accepts the digital record as the legal equivalent per document category — that confirmation has not yet been obtained for any category. ARTA compliance under RA 11032 requires a complete audit trail of all document processing steps. Accidental deletion of a government record creates legal exposure and violates the trust of the public the system serves.

And the decision itself is stated without hedging:

> No document, record, version, attachment, or audit entry may be permanently deleted by any user or any role — including Platform Administrators, IT Administrators, and Records Officers. Hard deletes (`DELETE` SQL statements) are prohibited in all application code for all tables. Every table carries `deleted_at TIMESTAMPTZ` and `deleted_by UUID` columns. "Deletion" in the UI sets these columns; the row remains in the database. All queries for active records must include `WHERE deleted_at IS NULL`.

Notice the specific phrase: "including Platform Administrators, IT Administrators, and Records Officers." This isn't a restriction on ordinary users while some privileged role retains a "real delete" button — the ADR explicitly considered and rejected that design, in its Alternatives Considered section: "Allow Platform Administrator hard delete with multi-step confirmation... Even with confirmation steps, a permanent hard delete by any user is a single point of failure with no recovery path. The invariant is cleaner, more defensible in a government audit context, and eliminates an entire class of irreversible accidents." Rather than trusting extra confirmation dialogs to prevent an entire category of catastrophic, unrecoverable mistake, the project simply removed the mistake's precondition: there is no code path, for any role, that issues a real `DELETE`.

You saw this pattern already, without it being named, in `organization.schema.ts`'s `offices` table from earlier in this chapter's research — every row carried `deletedAt: timestamp('deleted_at', { withTimezone: true })` and `deletedBy: uuid('deleted_by')` alongside its ordinary `createdAt`/`updatedAt` pair. The same shape appears on `tracking.schema.ts`'s tables. Here's `tracking.qr_codes`, showing exactly the pattern in practice:

```typescript
// packages/database/schema/tracking.schema.ts
export const qrCodes = trackingSchema.table(
  'qr_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    documentId: uuid('document_id').notNull(), // logical FK → documents.documents.id (cross-schema)
    trackingId: uuid('tracking_id').notNull(),
    trackingNumber: text('tracking_number').notNull(),
    qrImageFileKey: uuid('qr_image_file_key'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    generatedBy: uuid('generated_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'),
  },
  /* ... */
);
```

Notice `deletedAt` and `deletedBy` are the *only* two columns in this list without `.notNull()` — that's the point. A row that has never been "deleted" simply has `NULL` in both columns; the moment someone deletes it through the UI, application code sets these two columns to a real value and a real timestamp, and the row otherwise stays exactly where it was, forever. ADR-GEN-008 is explicit that this means every ordinary query needs an extra filter: "All queries for active records must include `WHERE deleted_at IS NULL`" — and it names the corresponding risk honestly in its own Consequences section: "a missing filter is a silent data correctness bug that returns logically deleted records." Soft-delete buys permanence at the cost of needing this discipline applied consistently across every query path, which is a real ongoing engineering cost, not a free lunch — but the alternative, in this ADR's judgment, was worse: an entire category of unrecoverable, legally consequential mistake.

Two more things worth knowing precisely here, because they're the kind of nuance you'd only catch by reading the actual files rather than trusting a one-line summary of "soft delete everywhere."

First: C1's own conventions section (§1.5) names exactly two tables as deliberate exceptions to universal soft-delete — `workflow.workflow_events` and `audit.events` — the same append-only reasoning from section C, applied to a second table you haven't met in detail yet (the workflow engine's own event log). But reading `shared.schema.ts` directly turns up a **third**, less obvious exception, worth being honest about rather than glossing over: `shared.event_bus_dead_letters`, the table that records failed internal event-bus deliveries for retry. Its own docstring explains why it breaks the pattern too, for a genuinely different reason than the audit table's:

> No soft-delete columns (`deleted_at`, `deleted_by`): rows are either retried (and deleted via `markRetried`) or exhausted (and kept for manual review). Soft-delete semantics do not apply to operational queue entries.

This is a real, deliberate, documented exception — not a gap in the convention, but a recognition that an internal operational queue table (rows that exist purely to drive a retry mechanism, not to represent a legal record) doesn't carry the same "must be permanently retrievable forever" obligation that a document, an audit entry, or an office record does. When you're checking whether a table follows the soft-delete convention, the answer is "check that specific table's own docstring," not "assume yes because it's the default everywhere."

Second, and similarly worth catching by reading rather than assuming: `tracking.routing_entries` — the append-only routing-history table — has `UPDATE`/`DELETE` revoked at the grant level and deliberately has no `updatedAt` column, matching the append-only pattern you'd expect. But unlike the audit table, it *does* still carry `deletedAt`/`deletedBy` columns in its actual TypeScript definition. That's a more surgical exception than a blanket "this table opts out of the convention" — it opts out specifically of *mutability* (no updates, ever) while keeping the soft-delete columns present, which tells you these two properties (append-only, and soft-deletable) are independent design choices in this codebase, not a single bundled feature you either get both of or neither.

## E. Row-Level Security: which tables actually have it, precisely

Section A explained what RLS is *for* conceptually. Now let's be precise about where it's actually applied in this repository — because it would be easy, and wrong, to assume that a project this serious about office isolation has RLS turned on for every table. It doesn't. As of this writing, exactly two tables in the entire schema have RLS policies defined, and knowing exactly which two — and no more — matters, because "does this table have RLS" is a per-table question you have to actually check, not a blanket assumption you get to make.

Here's the real DDL from C1 Part 12, the authoritative source for every grant and policy in the system:

```sql
-- documents.documents: office-level isolation + IT admin content block.
ALTER TABLE documents.documents ENABLE ROW LEVEL SECURITY;

-- Office isolation: a user's owned_by_office_id must match, or
-- app.bypass_office_isolation must be set (for SP Secretary, Records Officer, etc).
CREATE POLICY documents_office_isolation ON documents.documents
    FOR SELECT
    TO batac_app
    USING (
        owned_by_office_id = current_setting('app.current_office_id', true)::uuid
        OR current_setting('app.bypass_office_isolation', true) = 'true'
    );

-- IT admin: may see metadata rows for non-confidential/restricted documents
-- (e.g., to diagnose a stuck workflow) but never confidential or restricted.
CREATE POLICY documents_it_admin_no_confidential ON documents.documents
    FOR SELECT
    TO batac_it_admin
    USING (classification_level NOT IN ('confidential','restricted'));

-- IT admin UPDATE: closed-default policy — no UPDATE can commit until a
-- specific, narrower policy is added for the exact fields IT admin may touch.
CREATE POLICY documents_it_admin_metadata_only_update ON documents.documents
    FOR UPDATE
    TO batac_it_admin
    USING (true)
    WITH CHECK (false);

-- iam.sessions: own-session visibility + IT/Security Admin force-terminate.
ALTER TABLE iam.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sessions_own_or_admin ON iam.sessions
    FOR SELECT
    TO batac_app
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_role_tier', true) IN ('IT_ADMIN','SECURITY_ADMIN')
    );
```

That's it — `documents.documents` and `iam.sessions`. Nothing under `organization`, nothing under `tracking`, nothing under `workflow`, nothing else under `documents` besides the main table. I confirmed this isn't just a documentation artifact by checking the actual generated migration files: `0002_iam_create_iam_schema.sql` contains the real `ALTER TABLE iam.sessions ENABLE ROW LEVEL SECURITY` and `CREATE POLICY sessions_own_or_admin` statements, and `0004_documents_create_documents_schema.sql` contains the real `documents.documents` equivalent — word for word matching C1's DDL. This is genuinely applied, not just planned.

Let's unpack what each policy actually restricts, since the SQL is dense if you haven't read a `USING` clause before.

**`documents_office_isolation`** applies `TO batac_app` — meaning it governs queries run by the ordinary application runtime role — and its `USING` clause is the actual restriction: a row is visible only if that document's `owned_by_office_id` matches `current_setting('app.current_office_id', true)`, a PostgreSQL session variable the application sets per-request to reflect which office the current logged-in user belongs to, *or* if a second session variable, `app.bypass_office_isolation`, is set to `'true'` (used for roles like the SP Secretary or Records Officer, who legitimately need to see across office boundaries as part of their job). This is office-level isolation, precisely as Chapter 0.2's domain material would lead you to expect: a document belonging to one office isn't visible to a query running as a different office's user, unless that user's role carries the explicit bypass.

**`documents_it_admin_no_confidential`** governs a completely different role (`batac_it_admin`) with a completely different restriction: not office-based at all, but classification-based — an IT admin can see metadata rows for documents that aren't `'confidential'` or `'restricted'`, which the comment explains exists so IT staff can diagnose a stuck workflow without needing access to sensitive document content. And the third policy on the same table, `documents_it_admin_metadata_only_update`, is worth noticing for its shape alone: `USING (true) WITH CHECK (false)` is a deliberately closed-default policy — it matches every row for the purpose of the check (`USING (true)`), but the `WITH CHECK (false)` means *no* update can actually succeed, on any row, until a future, narrower policy is added specifically permitting the exact fields IT admin should be allowed to touch. That's a genuinely careful pattern: rather than leaving IT admin's UPDATE permissions undefined (which could mean "anything goes" depending on other grants), the policy is written to fail closed by default, so a future narrower permission has to be explicitly, positively added rather than a gap being silently exploitable.

**`sessions_own_or_admin`** on `iam.sessions` restricts visibility to a user's own session row (`user_id = current_setting('app.current_user_id', true)::uuid`) or, again, an explicit bypass for two named administrative role tiers. The practical effect: an ordinary user querying session data can only ever see their own sessions, never anyone else's, unless they're specifically IT_ADMIN or SECURITY_ADMIN.

Now, the honest caveat worth stating plainly: `ADR-GEN-003`'s own Required Follow-On Actions section states, as a stated intention, that "a table without an RLS policy on a tenant-scoped schema is a migration lint error." Reading the actual repository shows that intention isn't (yet) fully realized in practice — plenty of genuinely tenant-scoped, office-relevant tables (organization's `offices`, `employees`, `assignments`; most of `documents` beyond the main table; all of `tracking`) currently have no RLS policy defined at all. That's not a contradiction you need to silently paper over or a bug you should assume is a mistake — it may simply reflect where Phase 1 development priorities landed, with RLS applied first to the two tables judged to carry the most sensitive per-row access-control need (the actual document content, and session data). But it does mean you should never assume a table is RLS-protected just because this project takes RLS seriously in the abstract. Check the specific table. As of this writing, the answer for almost every table in the schema is "no RLS policy exists" — office isolation and permission enforcement for those tables happens entirely through the application's ABAC layer (which you'll meet properly in a later chapter), with the database engine itself not offering a second line of defense on those particular tables yet.

## F. Three database roles, not one: why `batac_app` alone would be a mistake

You've now seen enough grant statements (`GRANT SELECT, INSERT, UPDATE ON ... TO batac_app`, `REVOKE UPDATE, DELETE ON audit.events FROM batac_audit`) to understand the mechanics. This section is about the design reasoning behind having *three separate* database connection roles at all, rather than one all-purpose application account.

Here are the actual variables, straight from root `.env.example`:

```bash
DATABASE_URL_APP=postgresql://batac_app:app_devpassword_placeholder@localhost:5432/batac_lgu
DATABASE_URL_AUDIT=postgresql://batac_audit:audit_devpassword_placeholder@localhost:5432/batac_lgu
DATABASE_URL_MIGRATE=postgresql://batac_migrate:migrate_devpassword_placeholder@localhost:5432/batac_lgu
```

Three distinct PostgreSQL roles, three distinct passwords, three distinct connection strings — genuinely separate database identities, not one shared login used for everything. The README states the reasoning in a single sentence: these roles "back the audit-isolation and RLS design — don't collapse them into one connection string."

Think through what would happen if the project used a single `batac_app` role for absolutely everything the runtime application needs to do, including writing audit events. That role would need `INSERT` on `audit.events` to write audit entries at all — and if it's the *same* role used for every other piece of application logic (creating documents, updating workflow state, everything), then any bug, misconfiguration, or successful attack anywhere in that large surface of application code has, by definition, the same database privileges as the audit-writing code. An app-layer SQL injection bug in some unrelated document-search feature wouldn't just risk exposing document data — with a single shared role, it could, in principle, also let an attacker tamper with or erase the very audit trail meant to record what they did. Separating `batac_audit` from `batac_app` means the audit-writing pathway has its own distinct credential, and — as you saw in section C — that credential specifically has `UPDATE`/`DELETE` revoked on the audit schema regardless. But even before you get to that revoke, simply *not* using the same login for both jobs means a compromise of one doesn't automatically hand over the other; the blast radius of "something goes wrong in typical application code" doesn't automatically extend to "the audit trail is now untrustworthy."

`batac_migrate` is separated out for a related but distinct reason: it's the role that owns schema structure itself — it can run `CREATE TABLE`, `ALTER TABLE`, `CREATE POLICY`, and every other DDL operation, because it's the role migrations run as. The ordinary runtime `batac_app` role, by contrast, only has `SELECT`, `INSERT`, `UPDATE` on data — no ability to alter table structure, drop a table, or change a grant, even accidentally. Keeping these separate means a bug in the day-to-day running application — the code path handling actual user requests — cannot, structurally, run a schema-altering statement, because the role it's connected as doesn't have that privilege at all. The tooling itself reinforces this: `drizzle.config.ts`, which governs `drizzle-kit generate`, explicitly connects using `DATABASE_URL_MIGRATE`:

```typescript
// packages/database/drizzle.config.ts
export default defineConfig({
  schema: './schema/**/*.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL_MIGRATE'] as string,
  },
});
```

and the actual migration-running script, `scripts/migrate.ts`, refuses to even start without it:

```typescript
// packages/database/scripts/migrate.ts (excerpt)
if (!process.env['DATABASE_URL_MIGRATE']) {
  console.error(
    '[migrate] DATABASE_URL_MIGRATE is not set. ' +
      'This variable is required for migrations and post-migrate grants.',
  );
  process.exit(1);
}
```

You'll notice, if you go looking, there are actually five roles defined in C1's DDL (`batac_app`, `batac_audit`, `batac_migrate`, plus `batac_it_admin` and `batac_readonly`) — but only the first three appear as `.env` connection strings, because only those three are `LOGIN` roles that connect directly via their own credentials. `batac_it_admin` and `batac_readonly` are `NOLOGIN` — they exist as privilege sets that an already-connected session can switch into via `SET ROLE`, rather than as separate logins anyone connects as directly. The three-role pattern the README is describing, in other words, is specifically about the three roles application processes and tooling actually authenticate as.

## G. The migration workflow: from a schema edit to applied SQL

You now have all the pieces to understand how a schema change actually becomes a real change to the running database. `tech-stack.md`'s Migration Rules section states the core discipline in four short lines:

> - Every schema change produces a migration file committed to version control.
> - Drizzle Kit generates SQL migrations from schema diffs. Review the SQL before applying.
> - Never use reset-and-regenerate in production.
> - Migrations must be readable, reviewable, and executable directly by `psql` if needed.

The key idea in the second line is one you need to hold onto: **Drizzle Kit generates SQL by diffing your current schema TypeScript files against a snapshot of the last-known schema state** — it doesn't write migrations from scratch based on nothing, and it doesn't read your live database's actual current structure directly. It compares "what the schema files say now" against "what Drizzle Kit last recorded the schema as," and produces the SQL needed to get from one to the other. This is why C5 warns, sharply: "Do not hand-edit Drizzle Kit's snapshot files (the `drizzle/` meta directory)... Manual edits corrupt the diff engine and produce incorrect future migrations" — if that recorded snapshot doesn't match reality, every future diff computed against it will be wrong.

The generated SQL is never assumed correct by default — it's explicitly meant to be read by a human before it touches any real database, which is exactly why C5's local development procedure includes an explicit review step between generating and applying:

```bash
# 1. Generate the migration from your schema change:
pnpm --filter @batac/database db:generate

# 2. Review the generated SQL file (see Section 3 checklist).

# 3. Run the linter:
pnpm --filter @batac/scripts lint:migrations

# 4. Apply to local database:
pnpm --filter @batac/database db:migrate
```

Let's make this concrete by looking at what Drizzle Kit actually generated from the `audit.schema.ts` file you read in full earlier in this chapter. Here is the real, complete migration file it produced:

```sql
-- packages/database/migrations/0001_audit_create_audit_schema.sql
CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SEQUENCE "audit"."events_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "audit"."events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
	"sequence_number" bigint DEFAULT nextval('audit.events_sequence_seq') NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" uuid,
	"target_id" uuid,
	"target_type" text,
	"resource_office_id" uuid,
	"payload" jsonb NOT NULL,
	"chain_hash" text NOT NULL,
	"hmac" text NOT NULL,
	"hmac_key_version" integer DEFAULT 1 NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chain_hash_check" CHECK ("audit"."events"."chain_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "hmac_check" CHECK ("audit"."events"."hmac" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_audit_events_sequence" ON "audit"."events" USING btree ("sequence_number");--> statement-breakpoint
CREATE INDEX "idx_audit_events_city_occurred" ON "audit"."events" USING btree ("city_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_audit_events_actor" ON "audit"."events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_events_target" ON "audit"."events" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "idx_audit_events_resource_office" ON "audit"."events" USING btree ("resource_office_id") WHERE "audit"."events"."resource_office_id" IS NOT NULL;
```

Line up this file against the TypeScript you read in section B and the mapping is exact and mechanical: `pgSchema('audit')` becomes `CREATE SCHEMA "audit"`; `auditSchema.sequence('events_sequence_seq', { startWith: 1, increment: 1 })` becomes the `CREATE SEQUENCE` statement; every column definition becomes exactly one column line in the `CREATE TABLE`; `check('chain_hash_check', sql... ~ '\^[a-f0-9]{64}\$')` becomes, character for character, `CONSTRAINT "chain_hash_check" CHECK (... ~ '\^[a-f0-9]{64}\$')`. The `--> statement-breakpoint` comments you see between statements are Drizzle Kit's own bookkeeping — markers it uses to know where one logical SQL statement ends and the next begins when it later needs to replay this file. This is exactly what "review the generated SQL before applying" means in practice: reading a file like this and confirming it says what you meant it to say, before it runs against a database holding real data.

Not every migration is this clean and self-explanatory, though, and it's worth seeing a more realistic example — because generated migrations don't always match the tidy naming convention C5 describes (`{NNNN}_{scope}_{description}.sql`). Several files in the real `/packages/database/migrations/` directory carry auto-generated placeholder names instead, like `0003_glamorous_scream.sql` and `0007_slim_starfox.sql` — evidence that Drizzle Kit's default random-name generator was sometimes left as-is rather than renamed to the project's convention before commit. And migrations can do considerably more than a clean `CREATE TABLE`. Migration `0011` is a genuinely instructive example: it converts a batch of columns from `TEXT + CHECK` (the pattern C1 §1.6 calls out as the default for most schemas) into native PostgreSQL `ENUM` types, and in the process has to temporarily remove and recreate a policy that depended on the column being changed:

```sql
-- excerpt from 0011_lumpy_goblin_queen.sql
DROP POLICY IF EXISTS documents_it_admin_no_confidential ON documents.documents;--> statement-breakpoint
ALTER TABLE "documents"."documents" ALTER COLUMN "classification_level" SET DATA TYPE "documents"."classification_level_enum" USING "classification_level"::"documents"."classification_level_enum";--> statement-breakpoint
CREATE POLICY documents_it_admin_no_confidential ON documents.documents FOR SELECT TO batac_it_admin USING (classification_level NOT IN ('confidential','restricted'));--> statement-breakpoint
```

This is exactly the kind of migration where a careless, unreviewed apply could go wrong in a way a simple `CREATE TABLE` never could — if the `DROP POLICY`/`CREATE POLICY` pairing weren't both present and correctly ordered around the column-type change, the table could briefly, or permanently, lose the RLS protection you read about in section E. It's real, concrete evidence for why "review the SQL before applying" isn't a formality — some migrations genuinely do more than add a column, and the review step is where a human catches whether a structural change like this was handled correctly.

On the other end of the complexity spectrum, migration `0008` shows the simplest possible generated change — a single new column, nothing more:

```sql
-- packages/database/migrations/0008_add_legally_mandated_to_steps.sql
ALTER TABLE "workflow"."steps" ADD COLUMN "legally_mandated" boolean DEFAULT false NOT NULL;
```

Once a migration has been reviewed and looks correct, applying it runs through `scripts/migrate.ts`, which does two things in sequence: it hands the actual `.sql` files off to Drizzle's own migration runner (which tracks what's already been applied in a `drizzle.__drizzle_migrations` table, so re-running the script never re-applies something already in place), and then it separately re-runs a file called `post-migrate-grants.sql` — a plain, idempotent SQL script (safe to run repeatedly with no errors) that reapplies the `GRANT`/`REVOKE` statements from C1 Part 12. This second step exists because GRANT and REVOKE aren't something Drizzle's TypeScript table-definition API can express at all — they're applied as raw SQL, run separately, after the ORM-managed migrations complete.

Finally, the absolute rule from `tech-stack.md` — "never use reset-and-regenerate in production" — deserves its full reasoning, not just the bare prohibition, because C5 connects it directly back to concepts from earlier in this chapter:

> **Data loss is total and immediate.** Every row in every table — audit log, document records, workflow state, user accounts, tracking history — is destroyed... **It violates the no-hard-delete constraint.** Invariant #2 prohibits hard deletes at the application layer. A schema reset is a mass structural delete executed at the database level, bypassing every application-level and repository-layer safeguard.

A `reset-and-regenerate` operation is, in effect, the single largest possible hard delete imaginable — every soft-delete safeguard from section D, every append-only guarantee from section C, all of it, bypassed at once by an operation that drops and recreates tables directly at the database engine level, underneath all of that carefully-built application-layer discipline. C5 permits it only in two contexts where destroying and recreating everything genuinely costs nothing: a developer's own local environment, and CI's ephemeral, discarded-after-the-run test database.

## H. How you'll actually use this, day to day

Strip away the ceremony, and the actual workflow for changing anything about the database boils down to a short, repeatable sequence:

1. **Edit the relevant `{module}.schema.ts` file** under `/packages/database/schema/` — add a column, change a constraint, add a table. This is always where a schema change starts; you never hand-write SQL migration files directly except in the narrow, explicitly-flagged case C5 describes (correcting a generated file before it's been applied anywhere, and even then, marked with a comment stating it was manually authored and why).
2. **Run the generate command.** Based on C5's own stated workflow and confirmed directly against `/packages/database/package.json`'s actual `scripts` block (`"db:generate": "drizzle-kit generate"`), the command is:
   ```bash
   pnpm --filter @batac/database db:generate
   ```
3. **Review the resulting SQL migration file** in `/packages/database/migrations/` — read it the way you'd read any other pull request, checking that it says what you meant, paying particular attention if it touches anything with an RLS policy, a CHECK constraint, or a column type change (section G's `0011` example shows exactly why this matters).
4. **Run the migration linter and apply it locally.** `pnpm --filter @batac/scripts lint:migrations`, then `pnpm --filter @batac/database db:migrate` (confirmed against `package.json`: `"db:migrate": "tsx scripts/migrate.ts"`, the exact script you read in full in section F).
5. **Commit both the schema change and the migration file together, in the same PR.** They're two views of the same change — the TypeScript describes what the schema should be; the SQL file is the literal, reviewed record of how to get there from the previous state. A PR that changes one without the other leaves the pair out of sync, which is exactly the situation C5's warning about not hand-editing snapshot files is trying to prevent.

One honest gap worth naming plainly: I could confirm `db:generate` and `db:migrate` precisely, both from C5's own documented workflow and from the actual `package.json` scripts block, and they matched exactly. I did not find a root-level, unfiltered convenience alias for either command sitting in the repository's top-level `package.json` — the closest thing there is `db:seed` (`"pnpm --filter server db:seed"`, a different operation), but nothing named `db:generate` or `db:migrate` at the root. That likely just means these two commands are meant to be run filtered into the `@batac/database` package specifically, as shown above, rather than as bare `pnpm db:generate` from the repo root — but I'm telling you precisely what I confirmed rather than guessing at a shortcut that might not exist.

That's the whole loop. Everything else in this chapter — RLS policies, the append-only audit grant, soft-delete columns, gapless sequences — is enforced structurally, by the database itself, precisely so that you don't have to re-derive or remember these guarantees every time you touch a table. Your job, in practice, is narrower than it might feel from reading this chapter: change the TypeScript, read what Drizzle Kit generates before it runs, and let the database do the enforcing it was built to do.

---

# Chapter 1.2 — Zod v4 and the End-to-End Type Safety Chain

This project pins `"zod": "^4.4.3"` in both `apps/server/package.json` and `apps/web/package.json` — I checked both files directly before writing anything. This chapter is about **Zod version 4 specifically**. Zod v3 and v4 are not interchangeable; several APIs changed shape between them, and if you go looking for help online, a meaningful fraction of what you'll find (tutorials, Stack Overflow answers, even some AI-generated code) still assumes v3. Getting this distinction right matters enough that I went and read Zod's own official v4 migration guide before writing this chapter, rather than relying on memory — I'll mark each place that guide informed what follows as "per Zod's own v4 docs," so you know which claims are externally sourced rather than repo-specific.

The second thing this chapter teaches is a phrase you'll see used a lot in this codebase's own documentation: the **"end-to-end type safety chain."** It's the idea that a single change to a database column can become a compile error in a React component, without anyone writing a single line of glue code to make that happen. That's a strong claim. Some of it is real and I can show you exactly where. Some of it is aspirational, and I'll show you that just as plainly, because a developer who thinks a guarantee holds everywhere when it actually holds in only some places is worse off than one who knows precisely where the edges are.

## A. What Zod Actually Is, and Why One Library for Four Layers

If you've never used Zod before, here's the mental model in one sentence: **you write one description of a shape, and Zod gives you both a runtime validator and a compile-time TypeScript type from that single description.**

Concretely, a "schema" in Zod is an object that knows how to do two things:

1. **Validate real data at runtime.** Given some unknown value — the body of an HTTP request, form input a user typed, a row that came back from the database — a Zod schema can check whether that value actually matches the shape you described, and either return the validated (and possibly transformed) data, or produce a detailed error explaining exactly what didn't match.
2. **Describe a TypeScript type at compile time**, via `z.infer<typeof schema>`. This isn't a separate step you have to keep in sync by hand — TypeScript derives the type directly from the schema definition itself.

Here's the smallest possible example, structurally identical to real code you'll see later in this chapter:

```typescript
import { z } from 'zod';

const PlayerSchema = z.object({
  username: z.string(),
  xp: z.number(),
});

type Player = z.infer<typeof PlayerSchema>;
// Player is now the TypeScript type { username: string; xp: number }
// — you never wrote that type by hand.
```

Why would a codebase want to route four completely different layers — server input validation, tRPC procedures, React Hook Form, and TanStack Query response typing — through this one library, instead of writing separate validation logic for each? Because each of those layers, on its own, would need to answer the exact same question ("does this data match the `Document` shape?") using a completely different mechanism: a hand-written `if` statement on the server, a form-library-specific validation config on the frontend, a manually maintained TypeScript `interface` for the response type. If those four descriptions of "what a `Document` looks like" live in four different places, they will eventually disagree with each other — not because anyone made a mistake on purpose, but because someone will update one of the four and forget the other three. Zod's actual value proposition here isn't that it's a nicer validation syntax (though it is); it's that **one schema object can genuinely be imported and reused by all four layers**, so there's only one place to update.

## B. The Intended Full Chain — And What's Actually Real

The project's own `tech-stack.md` states this chain as a diagram:

```
Drizzle schema (PostgreSQL)
  └─▶ drizzle-zod → Zod schemas
        └─▶ /packages/shared (single source of truth)
              ├─▶ Fastify route validation (fastify-type-provider-zod)
              ├─▶ tRPC procedure input validation
              ├─▶ React Hook Form validation (@hookform/resolvers/zod)
              └─▶ TanStack Query response types
```

— with the accompanying claim: *"A DB schema change propagates as a compile error to every layer. No runtime contract surprises."* This exact diagram is repeated, expanded on, and reasoned through in `docs/pre-development/G-end-to-end-type-safety/g1-end-to-end-type-safety-chain-document.md` ("G1"), the project's dedicated design document for this chain.

Let's walk through each arrow, then I'll tell you honestly which ones I found real in the repository and which ones I didn't.

**Drizzle schema → drizzle-zod.** Drizzle is your ORM (covered in Chapter 1.1) — it's how you describe a PostgreSQL table as TypeScript. `drizzle-zod` is a separate small library whose whole job is to look at a Drizzle table definition and mechanically generate a matching Zod schema from it — `createSelectSchema()` for reading rows, `createInsertSchema()` for writing new ones, `createUpdateSchema()` for partial updates. The point of this arrow is that you never hand-write "the Zod shape of the `documents` table" — it's derived automatically from the same table definition Drizzle already needs for querying.

**drizzle-zod → Zod schemas in `/packages/shared`.** The raw output of `createSelectSchema()` is rarely exactly what you want to expose to the rest of the app — G1 documents this precisely (Part 5): sometimes you need to **narrow** it (strip out a `password_hash` column that should never leave the server), **widen** it (add a `documentType` field that's actually a joined object, not a real column), or **constrain** it further (a `.refine()` enforcing a business rule no single column's type could express on its own, like "these two fields must both be null or both be set"). The curated result — after any of that narrowing, widening, or constraining — is what actually gets exported from `/packages/shared`.

**`/packages/shared` → Fastify / tRPC / React Hook Form / TanStack Query.** This part is where the payoff supposedly happens: every one of these four downstream consumers imports the *same schema object*, by name, from `@batac/shared`. Not four separately-written schemas that happen to look similar — the literal same object in memory, doing double duty as a REST route validator, a tRPC input parser, a form's validation resolver, and (via `z.infer`) the type TanStack Query hands back to your component.

Now — here's the part I have to be honest about, because it changes how you should read that "single source of truth" claim in practice.

**I went and searched the actual repository for real usage of `createSelectSchema`, `createInsertSchema`, and `createUpdateSchema`, rather than assuming the diagram describes reality.** Here's exactly what I found:

```
=== createSelectSchema usage ===
packages/shared/src/schemas/documents.ts:2:import { createSelectSchema } from 'drizzle-zod';
packages/shared/src/schemas/documents.ts:109:  ...createSelectSchema(documentTypes).omit({
packages/shared/src/schemas/documents.ts:137:  ...createSelectSchema(documents).omit({
packages/shared/src/schemas/documents.ts:316:  ...createSelectSchema(versions).omit({
packages/shared/src/schemas/documents.ts:414:  ...createSelectSchema(attachments).omit({
packages/shared/src/schemas/documents.ts:457:  ...createSelectSchema(numbers).omit({
packages/shared/src/schemas/documents.ts:486:  ...createSelectSchema(signatures).omit({
packages/shared/src/schemas/documents.ts:514:  ...createSelectSchema(panlalawiganReviews).omit({

=== createInsertSchema usage ===
(no results)

=== createUpdateSchema usage ===
(no results)
```

==So the honest picture is: **`drizzle-zod` is genuinely wired up, but only partially.** `createSelectSchema` is real, and it's used in exactly one file (`documents.ts`), for exactly the tables that file cares about — every other schema file in `/packages/shared` (`common.ts`, `document-metadata.ts`, `organization.ts`, and the two workflow schema files) defines its schemas entirely by hand, with no drizzle-zod involvement at all, because those shapes don't correspond one-to-one with a single database table row (a JSONB metadata blob, a workflow step's config object, a UUID-and-pagination utility type). And **`createInsertSchema`/`createUpdateSchema` — the two generators the diagram explicitly names for the write side of the chain — are used nowhere in this repository at all.**==

==This matters for how you read the "single source of truth" claim: for the *read* side of `documents.ts`'s tables, a real, mechanical link exists between the Drizzle column definition and the exported Zod schema. For everything else — every write-input schema, and every schema outside `documents.ts` entirely — the schema was hand-written by a developer looking at the database schema, not generated from it. That's not automatically a bug (G1 itself acknowledges plenty of legitimate reasons a schema needs to diverge from a raw drizzle-zod output), but it does mean the specific mechanism that makes the diagram's opening claim true — "a DB schema change propagates as a compile error" — only actually fires for the subset of the chain where drizzle-zod is in the loop. Section F below has a concrete example of exactly what can go wrong in the parts where it isn't.==

## C. Walking Through a Real Schema File: `documents.ts`

Let's look at the real file, not an illustration of what it should look like. Here's the top of `packages/shared/src/schemas/documents.ts`:

```typescript
// packages/shared/src/schemas/documents.ts
import { z } from 'zod';
import { createSelectSchema } from 'drizzle-zod';
import {
  documents,
  versions,
  documentTypes,
  attachments,
  numbers,
  signatures,
  panlalawiganReviews,
} from '@batac/database/schema/documents.schema.js';
import {
  UuidSchema,
  TimestampSchema,
  DateSchema,
  PaginationInputSchema,
  SortOrderSchema,
  DateRangeSchema,
  AllowedMimeTypeSchema,
} from './common.js';
import { OfficeSummarySchema } from './organization.js';
```

Right away you can see the chain from section B in action: this file imports both `createSelectSchema` from `drizzle-zod` *and* the real Drizzle table objects (`documents`, `versions`, etc.) from `@batac/database`. It also imports smaller building-block schemas from `common.ts` (`UuidSchema`, `TimestampSchema`) — this is the reuse the shared package is supposed to enable: rather than every file re-describing "what a UUID looks like," there's one `UuidSchema` everyone imports.

Here's an enum, one of several in the file:

```typescript
export const LifecycleStateSchema = z.enum([
  'draft',
  'submitted',
  'in_workflow',
  'pending_mayor_action',
  'pending_panlalawigan_review',
  'completed',
  'released',
  'archived',
  'disposed',
  'cancelled',
  'superseded',
]);
export type LifecycleState = z.infer<typeof LifecycleStateSchema>;
```

`.enum([...])` takes an array of allowed string literals and gives you a schema that only accepts one of those exact values — the inferred type is a union of string literals (`'draft' | 'submitted' | ... | 'superseded'`), not a plain `string`. If you've read Chapter 0.2, you'll recognize these eleven values immediately: they're the document lifecycle states from the domain's own state machine — `Draft`, through the Mayor's review, through Panlalawigan review, to `Archived`. This is Zod directly encoding a piece of the real-world legislative process as a type the compiler can check.

Now the richest part — the actual `DocumentSelectSchema`:

```typescript
export const DocumentSelectSchema = z.object({
  ...createSelectSchema(documents).omit({
    cityId: true,
    numberSeriesId: true,
    draftedByEmployeeId: true,
    retentionScheduleId: true,
    tsv: true,
    deletedAt: true,
    deletedBy: true,
  }).shape,
  id: UuidSchema,
  documentTypeId: UuidSchema,
  documentType: DocumentTypeSummarySchema,
  title: z.string().min(1),
  lifecycleState: LifecycleStateSchema,
  classificationLevel: ClassificationLevelSchema,
  qrTrackingNumber: UuidSchema,
  preliminaryNumber: z.string().nullable(),
  finalNumber: z.string().nullable(),
  controlNumber: z.string().nullable(),
  originatingOfficeId: UuidSchema,
  originatingOffice: OfficeSummarySchema,
  ownedByOfficeId: UuidSchema,
  createdBy: UuidSchema,
  workflowInstanceId: UuidSchema.nullable(),
  versionNumber: z.number().int().min(1),
  metadata: z.record(z.string(), z.unknown()),
  supersededBy: UuidSchema.nullable(),
  supersededAt: TimestampSchema.nullable(),
  closureReason: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type DocumentSelect = z.infer<typeof DocumentSelectSchema>;
```

Let's go through what's actually happening here, method by method:

- **`z.object({...})`** describes an object shape — every key you list becomes a required property of the inferred type unless you mark it optional or nullable.
- **`...createSelectSchema(documents).omit({...}).shape`** is the drizzle-zod arrow from section B in action. `createSelectSchema(documents)` mechanically derives a Zod object schema from the real `documents` Drizzle table. `.omit({...})` strips out columns that should never leave this schema — `cityId` (internal multi-tenancy detail), `tsv` (a full-text-search column, not meaningful to a consumer), `deletedAt`/`deletedBy` (soft-delete bookkeeping). `.shape` unwraps the resulting schema back down to a plain object of field-schemas, so the spread (`...`) can merge it into the surrounding `z.object({...})` call.
- **Every field listed after that spread is a deliberate override**, re-declaring that field's Zod type by hand rather than accepting whatever drizzle-zod inferred. This is exactly the "narrowing / widening / constraining" pattern from section B: `documentType` and `originatingOffice` are widened fields — they're not real columns on the `documents` table at all, they're joined objects a resolver attaches before sending the response back. `title: z.string().min(1)` is a constraining override — tightening drizzle-zod's plain `z.string()` with a minimum-length rule.
- **`.nullable()`** appears on several fields — `preliminaryNumber`, `finalNumber`, `controlNumber`, `workflowInstanceId`, `supersededBy`, `supersededAt`, `closureReason`. This marks a field as allowed to be the JavaScript value `null`, distinct from being *absent*. If you look back at Chapter 0.2's domain material, this maps precisely onto reality: `preliminaryNumber` really can be `null` — it's cleared once a document gets its final number, and stays `null` for the rest of that document's life.
- **`z.record(z.string(), z.unknown())`** on `metadata` describes an object whose keys are strings and whose values could be anything — this is exactly right for a JSONB column holding document-type-specific metadata (a resolution's sponsors, an ordinance's penalty flag) whose exact shape varies by document type, and which the per-type schemas in `document-metadata.ts` narrow further downstream.
- **`z.infer<typeof DocumentSelectSchema>`** at the bottom is the same pattern from section A — the `DocumentSelect` TypeScript type is derived automatically from everything above it.

==One thing worth flagging specifically, because you'll see it throughout this file and the whole shared package: `UuidSchema` (imported from `common.ts`) is itself defined as `z.string().uuid()` — the **chained-method form**. Per Zod's own v4 docs, this method still works in v4 (it's not been removed), but it's officially deprecated in favor of the top-level `z.uuid()` function, which — also per Zod's own v4 docs — enforces stricter RFC 9562/4122 compliance on the UUID's variant bits than the older `.string().uuid()` form does. Likewise, `TimestampSchema` is `z.string().datetime({ offset: true })` rather than the newer `z.iso.datetime({ offset: true })`. This isn't a bug — v3-style method chains are fully functional on Zod 4.4.3 — but it does mean this codebase, as written today, leans on the deprecated compatibility surface of v4 rather than its newer idiomatic style. If you're extending this file, you can use either form; just don't be surprised that the existing code doesn't use the newest spelling.==

A second, real example worth seeing, because it shows a genuinely different Zod tool — `z.discriminatedUnion()` — used correctly. From `packages/shared/src/workflow/step-config.schema.ts`:

```typescript
export const WorkflowStepDefSchema = z.discriminatedUnion('step_type', [
  z.object({
    ...CommonStepDefFields,
    step_type: z.literal('action'),
    config: ActionStepConfigSchema,
  }),
  z.object({
    ...CommonStepDefFields,
    step_type: z.literal('approval'),
    config: ApprovalStepConfigSchema,
  }),
  // ... multi_referral, decision, notification, termination,
  //     parallel_split, parallel_join follow the same shape
]);
```

`z.discriminatedUnion('step_type', [...])` describes "this value is exactly one of these object shapes, and you can tell which one by looking at its `step_type` field." This directly encodes the workflow engine's step types from Chapter 0.2/H1 (`action`, `approval`, `multi_referral`, `decision`, `notification`, `termination`) as a type where TypeScript actually knows, for a step whose `step_type` is `'approval'`, that its `config` field must match `ApprovalStepConfigSchema` — and not, say, `MultiReferralStepConfigSchema`'s shape. That's a genuinely useful compile-time guarantee a plain `z.object()` union couldn't give you as precisely.

## D. From ZodError to a Useful API Error

When Zod validation fails, it doesn't just return `false` — it produces a `ZodError` object containing structured detail about exactly what went wrong and where. Left completely raw, that internal format is not something you'd want to hand to a frontend developer (or, worse, expose directly to an API consumer) — it's built for Zod's own internal use, not as a public contract.

Here is the real error formatter, in full, from `apps/server/src/trpc/trpc.ts`:

```typescript
// apps/server/src/trpc/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import type { Context } from '../modules/iam/iam.types.js';
import type { AppDb } from '../db.js';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';

export const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error, ctx }) {
    const isProduction = process.env['NODE_ENV'] === 'production';

    const domainError =
      error.cause instanceof AppError
        ? {
            code: error.cause.code,
            details: error.cause.details ?? null,
          }
        : null;

    const zodError = error.cause instanceof ZodError ? error.cause.flatten() : null;

    return {
      ...shape,
      data: {
        ...shape.data,
        traceId: ctx?.requestId ?? null,
        domainError,
        zodError,
        stack: isProduction ? undefined : shape.data.stack,
      },
    };
  },
});
```

Here's what's happening: tRPC lets you register an `errorFormatter` — a function that runs on *every* error a procedure throws, before that error goes out over the wire to the client. This one does two checks. First, `error.cause instanceof AppError` catches this project's own domain errors (things like `DOCUMENT_UNDER_LEGAL_HOLD` from `errors.ts`) and reshapes them into a small `{ code, details }` object. Second — the part we care about here — `error.cause instanceof ZodError` catches validation failures specifically, and calls `.flatten()` on them.

**`.flatten()` takes Zod's detailed, path-nested list of validation issues and collapses it into a shallow, easy-to-consume shape** — roughly, a top-level list of form-wide errors plus a per-field map of `{ fieldName: [error messages] }`. That's exactly the shape a frontend wants for showing "this field has this error" next to a form input, without the frontend needing to understand Zod's internal issue-code taxonomy at all. The final response the client actually sees has a `data.zodError` field carrying this flattened shape — never Zod's raw internal error format.

I do have to flag something here, because it's directly relevant to a v4-specific fact from section A: **per Zod's own v4 docs, `.flatten()` is deprecated in v4**, in favor of a new top-level function, `z.treeifyError()`. The official migration guide's exact words: *"The `.flatten()` method on `ZodError` has also been deprecated. Instead use the top-level `z.treeifyError()` function."* Deprecated does not mean removed — this code runs correctly on Zod 4.4.3 today, and `.flatten()`'s output shape is unchanged — but it means this is another spot (alongside `UuidSchema`'s `.string().uuid()` from section C) where the real codebase is using v4's backward-compatible v3-style surface rather than its newest recommended API. If you're asked to touch this file, it's worth knowing that `z.treeifyError()` is the forward-looking replacement, even though switching isn't urgent.

## E. The Same Schema, Reaching a React Form

Here's where the chain is supposed to close the loop: the same schema object that validates on the server should validate in the browser too, via `@hookform/resolvers/zod`'s `zodResolver` function. `zodResolver`'s job is simple to state: it takes a Zod schema and returns an object matching React Hook Form's own validation-resolver interface, so React Hook Form can call into Zod without knowing anything about Zod's API directly.

Here's real usage, from `apps/web/src/pages/documents/DocumentIntakePage.tsx`:

```tsx
// apps/web/src/pages/documents/DocumentIntakePage.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
// ...
import { IntakeFormSchema, type IntakeFormValues } from '@/lib/intake-schema';

export default function DocumentIntakePage() {
  // ...
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<IntakeFormValues>({
    resolver: zodResolver(IntakeFormSchema),
    defaultValues: {
      documentTypeId: '',
      title: '',
    },
  });
  // ...
}
```

Mechanically, this is exactly what section D's server-side flow was doing, run in the browser instead: `zodResolver(IntakeFormSchema)` wires validation into `useForm`, and from that point on, `form.handleSubmit(onSubmit)` will only ever call `onSubmit` with data that has already passed `IntakeFormSchema.parse()` successfully — `formState.errors` gets populated automatically with field-level messages if it hasn't.

The guarantee the chain diagram is actually making here isn't "the frontend team keeps a form schema in sync with the backend team's schema by writing careful code review comments." It's stronger than that: **it's the same schema object, imported by name, used twice** — once by React Hook Form in the browser for fast feedback, and once again by the server (as you saw with `.input()` calls in a tRPC procedure) because, as this codebase's own design documentation puts it, the client is never trusted. If someone bypasses the form entirely and calls the API directly, they hit the exact same validation rules, because it's the exact same schema doing the checking both times — not a second, independently-written copy of the rules that happens to currently agree with the first.

**That's the theory. Here's what I actually found when I went and checked whether this specific file follows it.**

`IntakeFormSchema` is imported from `@/lib/intake-schema` — a **local file inside `apps/web`**, not from `@batac/shared`. Here's that file, in full:

```typescript
// apps/web/src/lib/intake-schema.ts
import { z } from 'zod';

export const IntakeFormSchema = z.object({
  documentTypeId: z.string().min(1, { message: 'Please select a document type' }),
  title: z
    .string()
    .min(1, { message: 'Title is required' })
    .max(255, { message: 'Title is too long' }),
});

export type IntakeFormValues = z.infer<typeof IntakeFormSchema>;
```

This is a real, hand-written, two-field schema — not an import of `LogDocumentInputSchema` or `CreateDocumentInputSchema` from `documents.ts`, even though this exact page is the intake form for creating a document, and even though `documents.ts` already defines schemas covering this exact operation. It's a plausible-looking, overlapping schema that happens to check similar things (both require `documentTypeId` and `title`), but it is not the same object the backend actually validates against.

I checked this deliberately rather than assuming — I searched for every real `zodResolver` call across the entire `apps/web` codebase, not just this one file, to see whether this was a one-off or a pattern:

```
=== apps/web/src/pages/documents/ComplaintIntakeClerkAssistedPage.tsx ===
    resolver: zodResolver(ComplaintIntakeSchema),
=== apps/web/src/pages/documents/DocumentIntakePage.tsx ===
    resolver: zodResolver(IntakeFormSchema),
=== apps/web/src/pages/documents/DocumentRequestIntakeClerkAssistedPage.tsx ===
    resolver: zodResolver(DocumentRequestSchema),
```

All three real forms in this codebase define their own schema locally — `ComplaintIntakeSchema` and `DocumentRequestSchema` are both declared with a plain `z.object({...})` directly inside their respective page files, the same way `IntakeFormSchema` is. None of the three imports its validation schema from `@batac/shared`. I want to be precise about what this does and doesn't mean: the *server side* of these operations still validates independently (a tRPC procedure's own `.input()` schema doesn't disappear just because the form ahead of it used a different schema) — so a malicious or malformed request still gets caught. What's specifically not true, for these three real forms as they exist today, is the *identity* guarantee — "this is literally the same schema object" — that makes the "single source of truth" claim more than just "two schemas that happen to currently agree." Section F picks this up directly.

## F. What Breaks This Guarantee in Practice

Everything above is a fair description of how the chain is *supposed* to work, and parts of it — the drizzle-zod usage in `documents.ts`, the tRPC error formatter, the fundamental Zod mental model — are genuinely real and genuinely working as designed. But based specifically on what I read in the repository rather than what the design documents claim, here are the concrete ways this guarantee is weaker in practice than `tech-stack.md`'s diagram promises:

**1. The three real forms in `apps/web` don't import their validation schema from `@batac/shared` at all.** This is the most concrete finding in this chapter, and it's not an inference — I directly read all three files. `IntakeFormSchema`, `ComplaintIntakeSchema`, and `DocumentRequestSchema` are each hand-written, locally-scoped Zod schemas that happen to validate a similar (but not necessarily identical) shape to what the corresponding backend procedure actually enforces. This is precisely the failure mode G1's own "One-Way Rule" section warns against by name: *"Do not define an entity-shaped Zod schema in `/apps/web`... that doesn't correspond to an export in `/packages/shared`."* If a developer adds a new required field to `CreateDocumentInputSchema` on the backend, nothing about editing `apps/web/src/lib/intake-schema.ts` is forced by that change — there's no import relationship connecting them, so there's no compile error to propagate. The form will keep compiling fine, keep submitting fine from the frontend's point of view, and the failure (if there is one) will only surface as a runtime validation error from the server — exactly the "runtime contract surprise" the chain is supposed to prevent.

**2. `drizzle-zod`'s write-side generators aren't used anywhere, and even its read-side usage is confined to one file.** `createInsertSchema` and `createUpdateSchema` — both explicitly named in `tech-stack.md`'s diagram — return zero results in a repo-wide search. `createSelectSchema` is real, but only inside `documents.ts`; every other schema file in `/packages/shared` is entirely hand-written with no drizzle-zod involvement. This means the specific mechanism that would make "a DB schema change propagates as a compile error" mechanically true — a change to a Drizzle column automatically changing the shape `createSelectSchema` produces — only actually fires for the subset of tables `documents.ts` derives this way. For every Insert/Update operation, and for every schema outside that one file, the link between "what the database column actually is" and "what the Zod schema says it is" is currently maintained by a developer's attentiveness, not by the compiler.

**3. At least one code comment describing this exact risk is itself demonstrably stale.** This is worth calling out specifically because it's a good illustration of how "aspirational vs. real" isn't even a stable line — it can shift under you. `documents.ts` carries a comment on `DocumentSelectSchema`'s `lifecycleState` and `classificationLevel` fields, explicitly warning:

> "The underlying Drizzle column (`lifecycle_state`) is plain `text()` with the 11-value constraint living only in a raw SQL CHECK — Drizzle's type system has no way to derive an enum from that. This means TypeScript CANNOT catch it if this override key is ever misspelled, renamed, or dropped..."

I went and checked this against the actual `packages/database/schema/documents.schema.ts` file, and as of what's in this repository today, that's not accurate: `lifecycleState` is defined there as `lifecycleStateEnum('lifecycle_state').notNull().default('draft')` — a real, properly-typed Drizzle `pgEnum` column, not plain `text()`. The same is true for `classificationLevel`. I don't know whether this comment was written against an earlier version of the Drizzle schema before the enum was properly typed, or is simply inaccurate — I can only tell you what I found by reading both files side by side. But the practical lesson generalizes past this one comment: even a defensive, well-intentioned note explaining exactly where a type-safety gap exists can itself drift out of date, the same way any other part of the chain can. Don't treat a comment describing a known gap as a permanent, verified fact any more than you'd treat the diagram itself that way — check the actual current column definition if it matters for what you're doing.

None of this means the chain is fake or that the design documents are dishonestly written — `documents.ts`'s genuine drizzle-zod usage, the real tRPC error formatting, and the real (if locally-scoped) forms are all evidence that people are actively building toward exactly what `tech-stack.md` describes. What it does mean is that "single source of truth" is, right now, a goal the codebase is partway toward rather than a property you can rely on uniformly across every file. If you're relying on this chain to catch a mistake for you, the safest approach is the one G1's own review checklist recommends: check, for the specific schema you're touching, whether it's actually imported from `@batac/shared` by every consumer that should be using it — don't assume the diagram's promise holds just because the diagram exists.

---

# Chapter 1.3 — Fastify: The Framework Underneath Everything

You've spent 1.1 learning how Drizzle models the database, and 1.2 learning how Zod validates data shapes. This chapter is about the thing that actually *runs* — the HTTP server that receives a request, decides what to do with it, and hands it off to the tRPC and REST code you'll read about in later chapters. That server is built on **Fastify**, and specifically, on the version this project has pinned:

```json
"fastify": "^5.8.5"
```

That's the real number, read directly from `/apps/server/package.json` — not assumed. So everything in this chapter describes Fastify 5 behavior specifically. Also pinned in that same file, and relevant to this chapter: `"fastify-plugin": "^6.0.0"` (the `fp()` wrapper you'll see constantly) and `"fastify-type-provider-zod": "5.1.0"` (the bridge to your Chapter 1.2 material).

If you've used Express before, you already know what an HTTP framework does at a high level: routes, middleware, a request/response cycle. Fastify does the same job, but it makes two very deliberate, very opinionated choices that Express does not make — and this project leans hard on both of them. Understanding those two choices is really the whole chapter.

---

## A. Why This Project Chose Fastify Over Express

Go back to `docs/pre-development/tech-stack.md`, the "Stack Decisions" table. The row for this layer reads:

| Layer | Choice | Hard constraint |
|---|---|---|
| Backend framework | Fastify | **Schema-first routes; plugin scope enforces module encapsulation** |

That constraint sentence has two halves, and each half corresponds to something Express genuinely does not have a first-class answer for.

**Half one: "Schema-first routes."**

In Express, a route is a path plus a handler function. Validating the request body is something *you* bolt on — usually a middleware like `express-validator`, or you just write `if (!req.body.name) return res.status(400)...` by hand at the top of every handler. Nothing about Express's core design knows or cares what shape your data is supposed to be.

In Fastify, a route is a path, a handler, *and* a schema — and the schema isn't decoration, it's load-bearing. Fastify uses the schema to validate the incoming request **before your handler code runs at all**, and to serialize the outgoing response **before it's sent**. This project has told Fastify to use Zod schemas specifically for this (that's the whole point of `fastify-type-provider-zod`, which we'll get to in section C.2) — so the same Zod schema you learned about in Chapter 1.2 isn't just a TypeScript-time contract, it's the actual runtime gatekeeper for every request that hits a route.

**Half two: "Plugin scope enforces module encapsulation."**

This is the one Express really has no equivalent for, and it's worth slowing down on, because it's the mechanism the rest of this chapter is built around.

---

## B. The Fastify Plugin System, Conceptually

In Fastify, almost everything you'd register with the framework — a group of routes, a database connection, a shared service, a set of hooks — gets registered the same way: as a **plugin**, via `fastify.register(somePlugin)`.

A plugin is just an async function that receives the Fastify instance:

```typescript
async function myPlugin(fastify: FastifyInstance): Promise<void> {
  // do something with fastify here
}
```

You register it with:

```typescript
await fastify.register(myPlugin);
```

That much might feel familiar if you've used Express middleware (`app.use(someMiddleware)`) — you're handing the framework a function that gets to touch the app. But here's where Fastify diverges sharply from Express, and it's the single most important concept in this chapter:

**Every plugin gets its own encapsulated scope by default.**

Fastify lets you attach things to the instance using `fastify.decorate(name, value)` — this is how you make a database client, a service, anything, available as `fastify.whatever` for route handlers to use later. In Express, if middleware attaches something to `req` or `app`, it's visible everywhere downstream, forever, with no boundary. In Fastify, if you call `fastify.decorate('db', someDbClient)` *inside* a plugin, that decoration is only visible **inside that plugin and any plugins registered as children of it.** It is invisible to sibling plugins registered elsewhere, and invisible to the parent scope that registered this plugin in the first place.

Think of it like nested `let` scoping in JavaScript — a variable declared inside a block doesn't leak out of that block. Fastify's plugin registration works the same way, except the "block" is a plugin, and what leaks or doesn't leak is `fastify.decorate()` calls, `fastify.addHook()` calls, and routes.

This is deliberate, and it's *exactly* the mechanism behind "plugin scope enforces module encapsulation" from section A. If the `documents` module's plugin decorates `fastify.documentsRepository`, and Fastify's encapsulation were NOT there, then *any* other module — `workflow`, `tracking`, anything — could reach in and use `fastify.documentsRepository` directly, with no friction, no import, nothing stopping them. Module boundaries would exist only as a social convention ("please don't import across modules"), not as something the framework itself enforces.

So how does a module's own service become usable by *other* modules that are supposed to depend on it — because clearly `documents` needs `fastify.db`, and `workflow` needs `fastify.documentsService`? This is where `fastify-plugin` (the package you saw pinned as `^6.0.0`) comes in. Wrapping a plugin function with its `fp()` helper tells Fastify: *don't create a new encapsulated scope for this one — break out, and make its decorations visible to the parent scope (and everything registered after it in that parent scope).*

```typescript
// without fp — decorations stay trapped inside this plugin
async function myPlugin(fastify) { fastify.decorate('thing', x); }
await fastify.register(myPlugin);
// fastify.thing is NOT visible out here

// with fp — decorations escape to the parent scope
import fp from 'fastify-plugin';
export default fp(myPlugin);
await fastify.register(myPlugin);
// fastify.thing IS visible out here, and to every sibling plugin
// registered after this one
```

That's the whole mechanism. **Encapsulation is the default; `fp()` is the explicit, visible opt-out.** A module that wants its service to be usable by other modules must deliberately choose to break its own walls down — and the fact that it has to be deliberate is precisely what makes "module encapsulation" an enforced property of the system rather than a hope. If a plugin author forgets `fp()`, the app doesn't quietly work with a leaky boundary — it breaks loudly, because the sibling plugin that expected the decoration to exist will hit `fastify.documentsService` being `undefined`.

Hold onto this mechanism — encapsulation by default, `fp()` as the explicit escape hatch — because the entire rest of this chapter is one long worked example of it in action.

---

## C. Walking Through the Real `app.ts`, Top to Bottom

This is the file everything in this chapter anchors to: `/apps/server/src/app.ts`, 267 lines, confirmed by direct read. Its own header comment tells you exactly what it's for and — just as importantly — what it deliberately does *not* do:

> ```
> * app.ts — constructs and fully wires the Fastify application instance.
> *
> * Owns: the health route, all infrastructure/module plugins (database →
> * event-bus → audit → iam → ...future modules), and the merged tRPC
> * adapter (registered last, after every module's decorations exist, so
> * `createContext` and the IAM auth preHandlers can rely on `fastify.db` /
> * `fastify.iamService` / etc. already being present).
> *
> * Deliberately does NOT call `.listen()` — that remains src/index.ts's job,
> * alongside process-level bootstrap concerns unrelated to the HTTP plugin
> * tree (starting PgBoss, registering background jobs).
> ```

That split matters and is worth internalizing before anything else: `app.ts` builds and fully wires a Fastify instance and hands it back — it never calls `.listen()`. That's `index.ts`'s job (confirmed at 103 lines, matching what I was told to expect), along with starting PgBoss and registering background jobs. The reason for the split, straight from `index.ts`'s own header comment, is testability: `buildApp()` can be imported and exercised directly (e.g., with Fastify's `.inject()` for tests) without ever going through PgBoss or an actual open network port.

### C.1 — Constructing the Fastify Instance

```typescript
const fastify = Fastify({
  ...(loggerConfig ? { loggerInstance: loggerConfig } : { logger: false }),
  genReqId: () => `req_${nanoid(12)}`,
  ...fastifyOpts,
});
```

Two things worth pulling apart here.

`genReqId` is Fastify's hook for customizing how each incoming request gets its unique ID (used in every log line for that request, and returned to clients via a response header). By default, Fastify just increments an integer per request. This project overrides that with `nanoid(12)` — a random, URL-safe, 12-character ID, prefixed with `req_`. If you've used Express, this is the rough equivalent of manually generating a `X-Request-Id` in middleware and stuffing it onto `req` yourself — except here it's a first-class Fastify option, and Fastify automatically threads that ID through its own logger for you on every log line, with no extra wiring.

The `loggerConfig` variable feeding into this is built by a much longer block above it (lines 92–194) that's worth understanding even though it's more about Pino (Fastify's built-in logger) than about Fastify itself. It branches on `env.LOG_DESTINATION` (`stdout`, `stderr`, or a real file path) and `env.LOG_PRETTY`, assembling an array of Pino transport `targets` — one for the human-readable console (via `pino-pretty`, only in dev), one for the actual destination, and always one shipping logs to OpenObserve via OTLP. The comment sitting right above this block documents a real, previously-hit footgun:

> ```
> * [Fixed — see docs/development-findings-log.md, LOG-0108] Pino does not
> * allow both `opts.transport` and a second positional `dest` argument to
> * be pino.destination(...) at the same time: when opts.transport is set,
> * Pino builds its stream entirely from `opts.transport` and silently
> * ignores whatever `dest` was also passed — no error is thrown, but
> * LOG_DESTINATION's actual value (stdout vs. stderr vs. a file) has no
> * effect whenever LOG_PRETTY is true.
> ```

This is a genuinely useful thing to notice as a new-to-Fastify reader: not every bug you'll read about in this codebase's comments is a *Fastify* bug — this one is entirely about Pino's own transport API silently ignoring a config value. The fix (folding everything into one `targets` array so there's only ever one `transport` option, never a competing `dest`) has nothing to do with Fastify's plugin system at all. It's just adjacent to Fastify because Fastify happens to accept a full Pino instance via `loggerInstance`.

### C.2 — Where Zod Schemas Actually Become Fastify Validation

Right after the instance is constructed:

```typescript
fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);
```

Two lines, and they are the single most direct link between this chapter and Chapter 1.2. Here's what's actually happening.

Fastify's route schemas aren't hardcoded to any one validation library. Internally, when you register a route with a `schema` option, Fastify needs to turn that schema into two things: a function that validates the incoming request against it, and a function that serializes the outgoing response against it. By default, Fastify assumes those schemas are JSON Schema and uses `ajv` to compile them. `setValidatorCompiler` and `setSerializerCompiler` are the extension points that let you swap that assumption out entirely.

`validatorCompiler` and `serializerCompiler`, imported from `fastify-type-provider-zod`, are exactly that swap: they teach Fastify how to take a **Zod schema** — the same `z.object({...})` schemas you built in 1.2 — sitting in a route's `schema` field, and use it directly for request validation and response serialization. Combined with the `ZodTypeProvider` type import (also visible in `app.ts`'s imports), this is also what gives you full TypeScript inference on `request.body`, `request.query`, etc., inside a route handler — the same type-safety chain `tech-stack.md` describes as flowing from Drizzle schemas through `drizzle-zod` into `/packages/shared`, and from there into Fastify route validation specifically.

So when a later chapter shows you a route that looks like:

```typescript
fastify.withTypeProvider<ZodTypeProvider>().post('/documents', {
  schema: { body: createDocumentSchema },
  handler: async (request) => { /* request.body is fully typed */ },
}, ...);
```

— `createDocumentSchema` is a plain Zod schema, and these two lines in `app.ts` are the entire reason Fastify knows what to do with it.

### C.3 — Registration Order, and Why It's Not Arbitrary

This is the heart of the file, and app.ts's own header comment states the rule directly:

> ```
> * Registration order: database, event-bus, and audit are prerequisites of
> * iam (TASK-IAM-014 prerequisites: TASK-IAM-006…013, TASK-AUDIT-003) and of
> * each other transitively (event-bus needs database for
> * DeadLetterRepository; audit needs database + event-bus).
> ```

And here's the actual sequence of `fastify.register(...)` calls, in order, exactly as they appear in the file:

```typescript
// Wave B infrastructure + module plugins, in dependency order.
await fastify.register(databasePlugin);
await fastify.register(eventBusPlugin);
await fastify.register(mailerPlugin);
await fastify.register(auditPlugin);
await fastify.register(iamPlugin);

// Must be decorated before organizationPlugin registers — see the Bug B
// note above. If `boss` is not supplied, organizationPlugin still
// registers, but `fastify.boss` will be undefined within it, exactly as
// before this fix (callers that don't need delegation-grant creation are
// unaffected either way).
if (boss) {
  fastify.decorate('boss', boss);
}
await fastify.register(organizationPlugin);
await fastify.register(documentsPlugin);
await fastify.register(trackingPlugin);
await fastify.register(workflowPlugin);
```

Why can't this order be arbitrary? Because of exactly the encapsulation mechanism from section B. Each of these plugins is wrapped with `fp()` (you'll verify this yourself in section D), which means each one's decorations become visible to everything registered *after* it — but not before. `iamPlugin` reads `fastify.auditService` while it's registering (it needs it to log auth events), so `auditPlugin` must have already run. `documentsPlugin` reads `fastify.eventBus`, `fastify.auditService`, and (as you'll see below) `fastify.delegationService` — so `eventBusPlugin`, `auditPlugin`, and `organizationPlugin` must all have already registered by the time `documentsPlugin`'s turn comes.

Fastify doesn't magically know this dependency graph — it enforces it because each plugin's `fp()` wrapper *declares* it, via a `dependencies` array (covered fully in section D), and Fastify throws a startup error if a named dependency hasn't registered yet. But the order you see written out in `app.ts` is the human-readable source of truth — the thing a person reads to understand *why* the machine-checked order is what it is.

### C.4 — A Real Ordering Bug: "Bug B"

Right above the registration block sits one of the most useful things in this entire file for a newcomer to Fastify — a fully documented, real bug caused by exactly the kind of ordering dependency just described:

> ```
> * [Confirmed — see docs/development-findings-log.md, Bug B] `organizationPlugin`
> * reads `fastify.boss` synchronously during its own registration (to build
> * `delegationService`'s deps). Previously, `index.ts`'s `main()` called
> * `buildApp()` (which registers `organizationPlugin`) BEFORE constructing
> * PgBoss and decorating `fastify.boss` — so `fastify.boss` was `undefined`
> * the entire time `organizationPlugin` ran, on every real boot.
> * `createDelegationGrant`'s Step 7 (`deps.boss.send(...)`) would throw at
> * runtime the first time it was actually invoked.
> ```

Walk through what actually happened here, because it's a genuinely instructive failure mode in *any* plugin-based system, not just Fastify. `organization.plugin.ts` builds its `delegationService` like this (confirmed directly in the real file):

```typescript
const delegationService = createDelegationService({
  db: fastify.db,
  orgRepository,
  auditService: fastify.auditService,
  eventBus: fastify.eventBus,
  policyEvaluator: fastify.policyEvaluator,
  boss: fastify.boss,
} as any);
```

`fastify.boss` gets read and copied into `delegationService`'s dependency object the instant `organizationPlugin` registers — synchronously, no `await`, no "wait until later." Nothing about that line looks dangerous on its own. The danger is entirely about *timing relative to something outside this file*: `fastify.boss` isn't decorated by any plugin in the registration chain above — it was, before this fix, only decorated later, inside `index.ts`, after `buildApp()` had already returned a fully-built app (with `organizationPlugin` already having run and already having captured `undefined` for `boss`). The bug didn't crash immediately — `boss: undefined` is a perfectly legal JavaScript value to assign. It only surfaced the first time some code path actually called `deps.boss.send(...)`, at which point it would throw `Cannot read properties of undefined`.

This is a genuinely common shape of bug in any system built from independently-registered plugins: a plugin *reading* a decoration that technically exists as a key in the type system (because someone wrote `declare module 'fastify' { interface FastifyInstance { boss: PgBoss } }` somewhere) but that hasn't actually been *populated* yet at the point this particular plugin's registration function runs. TypeScript's type checker has no way to catch this — from its perspective, `fastify.boss` is typed as `PgBoss`, full stop; it has no concept of "already decorated by the time we get here" versus "declared for the future."

The fix is `BuildAppOptions`:

```typescript
export interface BuildAppOptions extends FastifyServerOptions {
  boss?: PgBoss;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const { boss, ...fastifyOpts } = opts;
  // ...
```

`buildApp()` now optionally *accepts* an already-constructed `PgBoss` instance from its caller, and decorates it onto the Fastify instance at exactly the right moment — right before `organizationPlugin` registers, and nowhere else:

```typescript
if (boss) {
  fastify.decorate('boss', boss);
}
await fastify.register(organizationPlugin);
```

And on the calling side, `index.ts` was changed to construct and start PgBoss *first*, then pass it in:

```typescript
console.log('Starting PgBoss...');
const boss = new PgBoss(env.DATABASE_URL_APP);
await boss.start();

const app = await buildApp({ boss });
```

Notice the `boss` parameter is optional, and its absence is handled gracefully rather than treated as an error — `buildApp()` can still be called with zero setup at all (useful for tests that don't need PgBoss), it just means `fastify.boss` will be `undefined` inside `organizationPlugin`, exactly as it always silently was before this fix, for any caller that genuinely doesn't need delegation-grant creation. The fix doesn't make `fastify.boss` mandatory — it makes it possible to supply it at the *correct* moment, for callers that do need it.

### C.5 — Why the tRPC Adapter Registers Last

By the time you reach the bottom of the registration block, every module plugin (`documents`, `tracking`, `workflow`, and everything before them) has already run. This is not incidental — it's the whole reason tRPC registers dead last:

> ```
> * Owns: ... the merged tRPC adapter (registered last, after every module's
> * decorations exist, so `createContext` and the IAM auth preHandlers can
> * rely on `fastify.db` / `fastify.iamService` / etc. already being present).
> ```

`createContext` (the function tRPC calls to build the context object every procedure receives) and the IAM auth `preHandler`s both need to read decorations like `fastify.db`, `fastify.iamService`, `fastify.auditService` — every one of these only exists on the instance because its owning plugin already ran. If tRPC registered *before*, say, `iamPlugin`, then `createContext` would be reading `fastify.iamService` before it exists — the exact same class of bug as Bug B above, just against a different decoration. Registering tRPC last sidesteps the entire category of "is this decoration ready yet" question, because by definition, everything is ready by then.

### C.6 — The Nested tRPC Sub-Scope

The actual tRPC registration is not a flat `fastify.register(fastifyTRPCPlugin, {...})` call. It's this:

```typescript
await fastify.register(async (trpcApp) => {
  await trpcApp.register(rateLimit, {
    max: env.RATE_API_MAX,
    timeWindow: env.RATE_API_WINDOW_MS,
  });

  const { authMiddlewarePlugin } = await import('./modules/iam/iam.middleware.js');
  await trpcApp.register(authMiddlewarePlugin);

  await trpcApp.register(fastifyTRPCPlugin, {
    prefix: '/api/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError: ({ error, path }: { error: unknown; path?: string }) => {
        trpcApp.log.error({ err: error, path }, 'tRPC error');
      },
    },
  });
});
```

This is Fastify's pattern for giving a *group* of registrations their own child scope, rather than registering them one by one against the top-level `fastify` instance. `fastify.register(async (trpcApp) => {...})` with an inline async function creates a fresh encapsulated scope (`trpcApp`), and everything registered *inside* that callback — `rateLimit`, `authMiddlewarePlugin`, `fastifyTRPCPlugin` — becomes a child of that scope rather than a direct sibling of `databasePlugin`, `documentsPlugin`, and so on up above.

Why is this the right structure here, rather than just calling `fastify.register(rateLimit, ...)`, `fastify.register(authMiddlewarePlugin)`, and `fastify.register(fastifyTRPCPlugin, ...)` one after another at the top level? Because these three things are logically one unit: "the tRPC surface's own middleware stack." Rate-limiting here is specifically scoped to tRPC traffic (`env.RATE_API_MAX` / `env.RATE_API_WINDOW_MS`), not a global rate limit applied to every route in the app — nesting it inside `trpcApp` rather than registering it at the top level is what makes that scoping real rather than just implied by where the code happens to sit. Same for the auth middleware: its `preHandler` hooks (verifying the access token, loading delegation context, setting DB session variables for RLS, and so on) need to apply to the tRPC routes registered right after it in this same scope — and because `trpcApp.register(authMiddlewarePlugin)` and `trpcApp.register(fastifyTRPCPlugin, ...)` are siblings within the *same* `trpcApp` scope, the hooks added by the first naturally apply to the routes added by the second.

One subtlety worth calling out explicitly, because it can look like a contradiction at first glance: `authMiddlewarePlugin` (defined in `iam.middleware.ts`) is *also* wrapped with `fp()`:

```typescript
export const authMiddlewarePlugin = fp(
  async function authMiddlewarePluginFn(fastify: FastifyInstance): Promise<void> {
    fastify.addHook('preHandler', verifyAccessToken);
    fastify.addHook('preHandler', loadDelegationContext);
    fastify.addHook('preHandler', setDatabaseSessionVars);
    fastify.addHook('preHandler', updateLastActivity);
    // ...
```

You might expect, from section B, that `fp()` is a "module plugin" thing and route-level registrations should skip it. But `fp()`'s actual job — breaking encapsulation so a registration's effects are visible to its *parent* scope and later siblings — is exactly what's needed here too, just at a smaller scale. If `authMiddlewarePlugin` did *not* use `fp()`, its `addHook('preHandler', ...)` calls would be trapped inside its own tiny sub-scope and would never actually apply to `fastifyTRPCPlugin`'s routes, registered as its sibling in the same `trpcApp` scope right after it. `fp()` isn't a rule that only applies to top-level module plugins — it's a general tool for "make this registration's effects reach beyond its own immediate scope," and here it's being used to make auth hooks reach sideways to a sibling registration, not just upward to a parent.

---

## D. The Documented Pattern vs. What the Real Files Actually Do

J1 §4 ("Module Plugin Pattern") and J4 §3.2 both describe a specific canonical shape for every `{module}.plugin.ts` file: instantiate the service, decorate it with `fastify.decorate()`, attach the tRPC router, and register REST routes in a **nested, non-`fp` sub-scope** — all wrapped in an outer `fp()` call with an explicit `name` and `dependencies` array. J1's own Rules section states this as a hard requirement ("Every module plugin must be wrapped with `fp()`... Omitting `fp()` wrapping on a module plugin" is listed under Prohibitions), so it's worth checking honestly rather than assuming.

**On the `fp()` wrapper itself: full compliance, no exceptions found.** A repo-wide search for every file importing `fastify-plugin`, cross-checked against every `.plugin.ts` file that exists, turns up nine plugin files total — and every single one of them imports `fp` and uses it in the documented `export default fp(pluginFn, { name: ..., dependencies: [...] })` shape:

```
database.plugin.ts     → fp(databasePlugin, { name: 'database' })
event-bus.plugin.ts    → fp(eventBusPlugin, { name: 'event-bus', dependencies: ['database'] })
mailer.plugin.ts       → fp(mailerPlugin, { name: 'mailer' })
audit.plugin.ts        → fp(auditPlugin, { name: 'audit', dependencies: ['database', 'event-bus'] })
iam.plugin.ts          → fp(iamPlugin, { name: 'iam', dependencies: ['database', 'event-bus', 'audit'] })
organization.plugin.ts → fp(organizationPlugin, { name: 'organization', dependencies: [...] })
documents.plugin.ts    → fp(documentsPlugin, { name: 'documents', dependencies: [...] })
tracking.plugin.ts     → fp(trackingPlugin, { name: 'tracking-plugin', dependencies: ['documents'] })
workflow.plugin.ts     → fp(workflowPlugin, { name: 'workflow', dependencies: [...] })
```

No plugin is missing the wrapper. This is a genuinely consistent codebase on the specific "did you remember `fp()`" question the documentation is most worried about.

**But there IS one real, concrete inconsistency, and it's worth naming precisely: `tracking.plugin.ts` names itself `'tracking-plugin'`, while every other file names itself after its bare module folder** (`'database'`, `'audit'`, `'documents'`, `'iam'`, `'organization'`, `'workflow'` — no other file appends `-plugin` to its name). J1's own Rules section is explicit about why this matters: *"The `name` string must match the string used in other plugins' `dependencies` arrays exactly."* A search across every `dependencies: [...]` array in the codebase currently shows nothing declares `'tracking'` (or `'tracking-plugin'`) as a prerequisite of itself — so as things stand today, this naming mismatch causes no active failure. But it's a live landmine for the future: if a new plugin were added that needed to depend on `tracking`, and its author followed the naming convention every *other* module uses (folder name = registered name) rather than checking this file specifically, they would write `dependencies: ['tracking']`, and Fastify's dependency check would fail to find a plugin named exactly `'tracking'` — because the one that actually registered is named `'tracking-plugin'`. This is precisely the failure mode the documentation itself flags as a Prohibition, just not the one you'd expect (the wrapper is present; it's the internal `name` string that's inconsistent with its siblings).

**On the nested REST-route sub-scope: absent from `documents.plugin.ts`, but not incorrectly so.** The canonical example in both J1 and J4 shows step 4 of the pattern as registering REST routes in a nested `fastify.register(async (scopedInstance) => {...}, { prefix: '/api/v1' })` block. The real `documents.plugin.ts` has no such block anywhere — no `fastify.register()` call for routes, no `/api` prefix, nothing. Rather than treat this as a violation, it's worth checking what's actually true: a search of the `documents` module shows several `.router.ts` files (`documents.router.ts`, `signatures.router.ts`, `complaints.router.ts`, and others) — these are **tRPC routers**, matching J4's own §3.8 naming (`{module}.router.ts` = tRPC Router, distinct from §3.9's `{module}.routes.ts` = REST Routes). There is no `documents.routes.ts` file anywhere in the codebase, and no REST-route-registration function for documents exists at all. So the honest finding is: at this point in the project, the `documents` module exposes its functionality through tRPC only, and its plugin correctly has no REST-route sub-scope because there is genuinely no REST surface yet to nest — not because a required step was skipped. If and when a REST surface for documents gets built, that's exactly where the nested-scope pattern from J1/J4 would need to show up.

The lesson for you, reading this as someone new to the codebase: documentation describes the *intended shape* a fully-built module eventually takes. A real file at a real point in a project's timeline is allowed to be a partial instance of that shape — what matters is whether the parts that *are* built follow the pattern correctly (they do, uniformly, on the `fp()` question) and whether any genuine naming/consistency slip exists (it does, in exactly one file, in a way that's currently dormant but worth fixing before it bites someone).

---

## E. The Security and Observability Plugins Registered Directly in `app.ts`

Three plugins are registered straight in `app.ts` rather than living in `/infrastructure` or `/modules` — because they're cross-cutting HTTP concerns, not domain logic.

**`@fastify/helmet`:**

```typescript
await fastify.register(helmet, {
  xFrameOptions: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
});
```

Helmet sets a batch of security-related HTTP response headers. The three options configured here each address a specific, named attack:

- **`xFrameOptions: { action: 'deny' }`** — sets the `X-Frame-Options: DENY` header, which tells browsers to refuse to render this site inside an `<iframe>` on any other page, anywhere. This mitigates **clickjacking**: without it, an attacker could embed this app in an invisible iframe on their own malicious page, overlay fake buttons, and trick a logged-in user into clicking something in the real app (approving a document, changing a setting) while believing they're clicking something else entirely.
- **`referrerPolicy: { policy: 'no-referrer' }`** — controls what the browser sends in the `Referer` header when a user navigates *away* from this app to another site. `no-referrer` means: send nothing at all. For a government platform handling citizen documents, this matters because URLs in this app may contain sensitive-context information (a document ID, a tracking reference) — without this policy, that URL fragment could leak to whatever external site a user clicks through to next.
- **`strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true }`** — sets the `Strict-Transport-Security` header (HSTS), instructing browsers to *only* ever connect to this domain (and, with `includeSubDomains`, all its subdomains) over HTTPS for the next `maxAge` seconds (31,536,000 = one year), even if a user explicitly types `http://` or clicks an old plain-HTTP link. This mitigates **man-in-the-middle downgrade attacks**, where an attacker on an insecure network (a public café Wi-Fi, say) intercepts a plain-HTTP request before it can be upgraded to HTTPS and reads or tampers with it in transit.

**`@fastify/rate-limit`:**

You've already seen this one — it's registered inside the nested tRPC sub-scope (section C.6), not globally, with `env.RATE_API_MAX` and `env.RATE_API_WINDOW_MS` bounding how many requests a client can make to the tRPC surface within a time window. Its role is straightforward: slow down brute-force and abuse patterns (credential-stuffing against login, scraping, denial-of-service attempts) by rejecting requests past a threshold rather than letting the server absorb unlimited load from any single source.

**`@fastify/cors`:**

```typescript
await fastify.register(cors, {
  origin: env.CORS_ALLOWED_ORIGINS,
  credentials: true,
});
```

`origin` is the strict origin allowlist `tech-stack.md`'s Stack Decisions table calls for — `env.CORS_ALLOWED_ORIGINS` is parsed from a comma-separated environment variable into an array of exact origin strings via a Zod transform, so only requests from explicitly listed origins are allowed to make cross-origin requests to this API at all.

`credentials: true` is the detail worth pausing on. By default, browsers strip cookies from cross-origin requests unless both sides opt in: the client's request must be made with `credentials: 'include'`, *and* the server's CORS response must include `Access-Control-Allow-Credentials: true` — which is exactly what setting `credentials: true` here makes `@fastify/cors` do. This matters specifically because `tech-stack.md`'s Authentication Architecture section states this project's auth tokens are delivered via **HTTP-only cookies**, never `localStorage`. If `credentials: true` were absent here, the browser would silently refuse to send the auth cookie on any cross-origin request from `/web` to this API — login would appear to "work" in the sense that no error is thrown, but every subsequent authenticated request would arrive at the server with no cookie attached at all. (The full mechanics of how those cookies get verified once they *do* arrive — token rotation, the IAM `preHandler`s you saw registered in section C.6 — belong to a later IAM chapter; the connection to flag here is just that this one CORS option is a prerequisite for cookie-based auth to function across origins at all.)

---

## F. How to Add a New Module's Plugin to This System

Say you're wiring up a brand-new `records` module (or `notifications` — neither exists yet as a plugin; a check of `/apps/server/src/modules/` today shows only `audit`, `documents`, `iam`, `organization`, `tracking`, and `workflow`). Following the exact pattern `app.ts` and its sibling plugin files already establish, here's concretely what you'd do:

**1. Create `/apps/server/src/modules/records/records.plugin.ts`.**

Follow the shape you've now seen repeated nine times across this codebase: a plain async function taking `FastifyInstance`, doing its setup and `fastify.decorate(...)` calls, exported wrapped in `fp()`:

```typescript
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
// ...imports for your service, repository, etc.

async function recordsPlugin(fastify: FastifyInstance): Promise<void> {
  const repository = new RecordsRepository(fastify.db);
  const service = createRecordsService({
    db: fastify.db,
    eventBus: fastify.eventBus,
    auditService: fastify.auditService,
    // whatever this module genuinely needs from already-registered plugins
  });

  fastify.decorate('recordsService', service);
  fastify.decorate('recordsTrpcRouter', createRecordsRouter(service));
}

export default fp(recordsPlugin, {
  name: 'records',
  dependencies: ['database', 'event-bus', 'audit'], // whatever it genuinely needs
});
```

Note the `name` — call it `'records'`, matching the bare folder name, exactly like `database`, `audit`, `documents`, `iam`, `organization`, and `workflow` all do. (Not `'records-plugin'` — you now know exactly why that would be a mistake to copy from `tracking.plugin.ts`.)

**2. Decide the module's dependency position.**

Look at what `records` genuinely needs to read from `fastify` during its own registration, and list exactly those plugin names in `dependencies`. If `records` needs to look up documents (plausible, given the module name), it needs `documents` registered first, which transitively means `database`, `event-bus`, `audit`, and `organization` are already satisfied too (since `documentsPlugin` itself depends on all of them). If it only needs `fastify.db` and `fastify.eventBus`, its dependency list can be as short as `['database', 'event-bus']` — don't over-declare dependencies you don't actually read from.

**3. Add the TypeScript augmentation.**

Wherever your module's own type file lives (e.g. `records.types.ts`), declare what you're decorating:

```typescript
declare module 'fastify' {
  interface FastifyInstance {
    recordsService: RecordsService;
    recordsTrpcRouter: RecordsTrpcRouter;
  }
}
```

**4. Add the import and the registration call to `app.ts`, in the correct position.**

`app.ts` already has a comment marking exactly where this goes:

```typescript
// organization, documents, workflow, tracking, notifications: add
// `await fastify.register(...)` below, after iamPlugin and before the tRPC
// registration, when each module's own plugin-wiring task completes.
```

So: add the import alongside the existing module imports —

```typescript
import recordsPlugin from './modules/records/records.plugin.js';
```

— and add the registration call in the main sequence, positioned according to what you declared in `dependencies`. If `records` depends on `documents`, it goes *after* `await fastify.register(documentsPlugin);` and *before* the tRPC block starts (`const { fastifyTRPCPlugin } = await import(...)`):

```typescript
await fastify.register(organizationPlugin);
await fastify.register(documentsPlugin);
await fastify.register(trackingPlugin);
await fastify.register(workflowPlugin);
await fastify.register(recordsPlugin);   // ← new module, after its real dependencies
```

Fastify's own `dependencies` check will throw a clear startup error if you get this position wrong relative to what you declared — but getting the human-readable order right in `app.ts` is still the point, exactly the same way `database → event-bus → mailer → audit → iam → organization → documents → tracking → workflow` reads as a comprehensible dependency chain to a person, not just a machine-verified one.

**5. If `records` needs a REST surface, register it in a nested scope — inside your plugin, not in `app.ts`.**

This is the one piece J1/J4 document that `documents.plugin.ts` doesn't currently need (because it has no REST routes yet, per section D). If `records` genuinely needs REST endpoints, add that inside `records.plugin.ts` itself, nested and un-wrapped by `fp`:

```typescript
await fastify.register(async (scopedInstance) => {
  await registerRecordsRoutes(scopedInstance, service);
}, { prefix: '/api/v1' });
```

— placed inside `recordsPlugin`, right after the `fastify.decorate(...)` calls, exactly where J1's canonical example places it. This keeps any route-specific hooks (auth guards, rate limits specific to these routes) from leaking to sibling plugins registered after `records` — the same encapsulation principle from section B, just applied one level deeper.

That's the whole procedure. Nothing here is generic advice — every step traces back to a real file, a real comment, or a real dependency array you've now read directly.

---

# Chapter 1.4: tRPC — Where the Type System Crosses the Network

You've now seen three pieces of this stack in isolation. Drizzle gives you a database schema as TypeScript types. Zod v4 gives you runtime validation that also produces TypeScript types. Fastify 5 gives you a server that can serve requests and, via `fastify-type-provider-zod`, validate them against those same Zod schemas. What you haven't seen yet is how the *frontend* knows any of this exists — how a React component calling a data-fetching hook knows, at the moment you're typing it, exactly what shape of data is coming back, without you having told it anything.

That's what this chapter is about. It's the piece of the stack that will feel least like anything you've used before if your prior experience is REST or GraphQL, and it's the piece `batac-dms` leans on hardest for its actual day-to-day developer experience. Take this chapter slowly.

## Confirming what's actually installed

Before touching any documentation — official or otherwise — here's what's pinned in this repository right now:

- `apps/server/package.json` → `"@trpc/server": "^11.18.0"`
- `apps/web/package.json` → `"@trpc/client": "^11.18.0"` and `"@trpc/react-query": "^11.18.0"`
- `apps/web/package.json` (devDependencies) → `"@trpc/server": "^11.18.0"`

That's tRPC v11 across the board, consistent everywhere it appears. One detail worth pointing out because it's actually a clue about how this whole chapter works: `@trpc/server` shows up in `apps/web/package.json`, but only as a **devDependency**. The web app never runs any server-side tRPC code — it doesn't need `@trpc/server` at runtime. It's there so the frontend's TypeScript compiler can resolve a *type* that's defined using `@trpc/server`'s types. You'll see exactly what that type is in a few sections.

tRPC v11 is a meaningful jump from v10 — specifically, the React Query integration was substantially rewritten (more on that in the client section) — so everything below is checked against the current, official v11 docs at trpc.io rather than pattern-matched from older tRPC experience. Every concrete example, though, comes from the actual files in this repository, not from the docs' own sample code.

## A. What tRPC actually is, and the specific problem it solves

Here's the core idea, stated as plainly as possible: **there is no schema file between your backend and your frontend, and there is no code-generation step.** The frontend imports the backend's actual TypeScript type — one specific exported type, called `AppRouter` — directly from the backend's source. Once it has that type, the frontend gets full autocomplete and full compile-time type-checking on every single API call, for every procedure the backend exposes, automatically.

Compare this to what you're used to. With REST, you write an endpoint, and separately you write (or generate) a client that knows the shape of that endpoint's request and response — an OpenAPI spec, a Postman collection, hand-written fetch calls with `any` sprinkled through them, or a generated client from a tool that reads that spec. With GraphQL, you write a schema, and a code-generator reads that schema and produces typed hooks. In both cases, there are two independent descriptions of the API's shape — the backend's actual implementation, and whatever artifact the frontend is consuming — and those two things can drift apart. You change a backend field, forget to regenerate the client or update the spec, and nothing tells you until a request fails at runtime, possibly in production, possibly weeks later.

tRPC removes the second description entirely. The frontend's "client" isn't generated from anything — it's the backend's own router type, imported straight across the package boundary via a `workspace:*` dependency inside this monorepo (you saw `apps/web/package.json` list `"server": "workspace:*"` — that's the actual mechanism). Because it's a `type`-only import (you'll see the `import type` keyword explicitly, later in this chapter, in the real file that does this), the import is completely erased at build time. None of the backend's actual runtime code — its database queries, its business logic, its secrets — ships to the browser. Only the *shape* travels.

### Walking through what happens when a backend input changes

This is worth making completely concrete, because "type safety" is an abstract phrase until you've watched it happen. Say a backend procedure currently accepts:

```typescript
z.object({ sessionId: z.string().uuid() })
```

and a teammate changes it to also require a reason:

```typescript
z.object({ sessionId: z.string().uuid(), reason: z.string().min(1) })
```

Here is the literal sequence of events, step by step, assuming no manual sync step of any kind:

1. Your teammate edits the `.input()` schema on that procedure inside `/apps/server`, and pushes.
2. You pull. You haven't touched the frontend file that calls this procedure.
3. The next time TypeScript re-checks your frontend project — which, if you're using an editor with TypeScript language-server integration (VS Code, most JetBrains IDEs), is *as you're viewing the file*, not on some later build step — the call site that used to pass `{ sessionId }` now shows a red squiggle directly under the argument you're passing to `.mutate(...)`. The error is `Property 'reason' is missing in type '{ sessionId: string; }' but required in type '{ sessionId: string; reason: string; }'`, or similar, depending on your TypeScript version's exact phrasing.
4. It shows up in exactly that file, on exactly that line, at the exact call site — because that call site's type is *derived live* from the backend type on every check, not frozen at some earlier point.
5. Nothing needs to be regenerated. No command needs to be run. No spec file needs updating. The error simply exists the moment the types stop matching, and disappears the moment you fix the call site to match.

This is what "no manual sync step" means in practice. The type isn't a snapshot taken at some point in the past that can go stale — it's live, because it's the *same* type, not a copy of it.

## B. Why this project doesn't use tRPC everywhere

Given how good that story is, you might reasonably ask: why not use tRPC for the public portal too? Or for a future mobile client? `tech-stack.md`'s "tRPC Architecture (Hybrid)" section states the rule directly:

> **Rule:** tRPC is used exclusively for `/web` (internal app) ↔ `/server`. The public portal and any external-facing interface use REST only.
>
> ```
> /web  ──tRPC──▶  /server (Fastify)  ──REST/OpenAPI──▶  /portal, mobile, third-party
> ```
>
> - tRPC procedures are defined in `/server`, consumed in `/web` with full type inference via TanStack Query (tRPC v11 uses TanStack Query as its data layer).
> - REST routes are defined in `/server` with `@fastify/swagger` generating an OpenAPI 3.0 spec from route schemas.
> - Both live in the same Fastify process; they are separated by plugin scope.

This isn't an arbitrary rule, and understanding *why* it's the correct rule (rather than just memorizing it) matters, because it's the direct consequence of what you just learned in Section A. tRPC's entire value proposition — the thing that made Section A's walkthrough work — depends on one specific fact: **the consumer imports the producer's actual TypeScript source type.** That only works when the consumer is *also a TypeScript codebase, inside the same package graph*, capable of resolving that import.

`/web` qualifies: it's TypeScript, it lives in this same monorepo, and it can literally do `import type { AppRouter } from 'server/src/trpc/root.js'` because `server` is a workspace package it depends on. The public portal, in this hybrid architecture, might not even be a TypeScript project at all — and even if it currently is, the whole point of a public-facing or third-party interface is that you don't control what's calling it. A future mobile app might be Swift or Kotlin. A third-party government integration partner is never going to `npm install` your backend as a workspace dependency to get its types. None of those consumers can resolve a TypeScript `import type` from your server, so tRPC's central trick — no separate schema, just import the real type — simply has nothing to attach to. You'd be forced to write and maintain a separate, hand-synchronized description of the API anyway, at which point you've lost tRPC's actual advantage and gained its unusual, RPC-shaped calling convention for no benefit.

REST + OpenAPI, by contrast, is built for exactly the situation where the consumer is unknown and heterogeneous — that's the entire reason an OpenAPI spec exists as an artifact: it's a language-agnostic contract two parties who don't share a codebase can both build against independently. So the hybrid split isn't two competing philosophies bolted together awkwardly. It's using each tool for the one situation it was actually designed to solve: tRPC where the compiler can enforce the contract for free, REST/OpenAPI where it can't.

## C. Reading `trpc.ts` — where tRPC gets initialized

Every tRPC backend has exactly one file where the tRPC instance itself gets created, once. In this repository, that's `/apps/server/src/trpc/trpc.ts`, and — because it's foundational and everything else in this chapter builds on it — here it is in full:

```typescript
import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import type { Context } from '../modules/iam/iam.types.js';
import type { AppDb } from '../db.js';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';

export function createContext({ req, res }: CreateFastifyContextOptions): Context {
  return {
    auth: (req as any).auth || null,
    db: (req.server as any).db as AppDb,
    req: req as any,
    requestId: req.id,
  };
}

export const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error, ctx }) {
    const isProduction = process.env['NODE_ENV'] === 'production';

    const domainError =
      error.cause instanceof AppError
        ? {
            code: error.cause.code,
            details: error.cause.details ?? null,
          }
        : null;

    const zodError = error.cause instanceof ZodError ? error.cause.flatten() : null;

    return {
      ...shape,
      data: {
        ...shape.data,
        traceId: ctx?.requestId ?? null,
        domainError,
        zodError,
        // Strip stack trace in production
        stack: isProduction ? undefined : shape.data.stack,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.auth) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource.',
    });
  }
  return opts.next({
    ctx: {
      ...opts.ctx,
      auth: opts.ctx.auth,
    },
  });
});
```

Let's go through this piece by piece.

### `createContext` and the Fastify adapter

tRPC v11 has first-class server adapters for the popular Node.js frameworks — Express, Fastify, Next.js, and a few others — and Fastify's adapter shape follows the general convention across all of them: you write a `createContext` function that runs *once per incoming request*, and its job is to build the object every procedure in that request will see as `ctx`. The Fastify adapter's version of this function receives `{ req, res }` — a `CreateFastifyContextOptions` object — giving you the actual Fastify request and reply for that call.

In this repository, `createContext` builds a `Context` object with four fields: `auth` (pulled off `req.auth`, populated earlier in the request lifecycle by Fastify middleware — `null` if the request isn't authenticated), `db` (the Drizzle database instance, decorated onto the Fastify server instance and pulled off `req.server`), `req` (the raw Fastify request, kept around so individual procedures can reach things like `req.server.someService` — you'll see this pattern constantly once you start reading real routers), and `requestId` (Fastify's own per-request ID, which becomes the trace ID you've been wiring through OpenObserve).

### `initTRPC.context<Context>().create({ errorFormatter })`

This line is the actual initialization — it can only happen once per backend, and this file is where it happens. `initTRPC.context<Context>()` tells tRPC what shape `ctx` will be for every procedure built from this instance (that `Context` type is the same one `createContext` returns — they have to agree, and TypeScript enforces that they do). `.create({...})` then configures the instance, and the one piece of configuration this project supplies is an `errorFormatter`.

This is where Chapter 1.2 comes back. Every error a procedure throws — whether it's a manual `throw new TRPCError(...)`, an unhandled exception, or a Zod validation failure from a `.input()` parser rejecting bad data — flows through `errorFormatter` before it becomes the actual JSON that goes over the wire to the browser. This project's formatter does two specific, deliberate things with that opportunity:

- **`error.cause instanceof AppError`** — `AppError` is this project's own custom error class. When a procedure (or something it calls) throws an `AppError`, the formatter pulls its `.code` and `.details` out and attaches them as a `domainError` field on the response, so the frontend can distinguish "this failed because of a specific, named business rule" from a generic failure.
- **`error.cause instanceof ZodError`** — this is the exact same `ZodError` class you worked with in Chapter 1.2. When a procedure's `.input()` schema rejects the incoming payload, tRPC's own validation machinery throws a `TRPCError` whose `.cause` is that `ZodError`. This formatter calls `.flatten()` on it — the same Zod method you used before — and attaches the result as a `zodError` field, so the frontend gets field-by-field validation messages, not just "bad request."

Both are layered on top of `...shape.data`, tRPC's own default error shape, and the formatter also injects `traceId: ctx?.requestId ?? null` (tying every error response back to the observability work you've been doing) and strips the stack trace entirely when `NODE_ENV === 'production'`.

### The procedure builders: `publicProcedure` and `protectedProcedure`

`export const router = t.router;` and `export const publicProcedure = t.procedure;` are just aliases — `t.router` and `t.procedure` are the two things every tRPC file needs constantly, so this project re-exports them under shorter names rather than importing `t` everywhere. This matches the standard tRPC convention of keeping initialization, routers, and procedure helpers separated to avoid circular imports — you'll see `router` and `publicProcedure`/`protectedProcedure` imported into every router file in this codebase, never `t` itself.

`protectedProcedure` is where tRPC v11's **middleware chaining** pattern shows up concretely, and it's worth reading slowly because it's genuinely elegant. `t.procedure.use(async (opts) => {...})` takes the base procedure builder and attaches a middleware function that runs *before* any procedure built from `protectedProcedure` executes. This specific middleware does exactly one thing: it checks `opts.ctx.auth`. If it's falsy (meaning `createContext` set it to `null` because the request had no valid auth), it throws `new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be logged in to access this resource.' })` — the request never reaches the procedure's actual resolver logic at all.

If `auth` *is* present, the middleware calls `opts.next({ ctx: { ...opts.ctx, auth: opts.ctx.auth } })`. That re-spread of `auth` looks redundant at first glance — it's the same value going back in — but it's doing real work for the type system: `Context.auth` is typed as `AuthContext | null`, but by the time you're inside this `else` branch, you've already checked it's not null. Re-including it explicitly in the object passed to `next()` lets TypeScript narrow the *type* it hands to every procedure built on top of `protectedProcedure`, from `AuthContext | null` down to just `AuthContext`. Practically, this means: anywhere you write `protectedProcedure.query(async ({ ctx }) => { ... ctx.auth.userId ... })`, TypeScript already knows `ctx.auth` can't be `null` — you never have to write a null check or an `!` non-null assertion for it, because the middleware already proved it for you, and the type system carries that proof forward.

One honesty note, since accuracy matters more than a tidy story: the pre-implementation design document for this API (`e1-trpc-router-and-procedure-catalog.md`) states, in its Global Conventions section, that "there is no `publicProcedure` in this router set" — the assumption at design time was that `/web` is fully authenticated, full stop. The actual code doesn't quite hold that line: `publicProcedure` is exported here and genuinely used at least once, in `iamRouter.redeemPasswordResetToken` — which makes sense on reflection, since redeeming a password reset token is, by definition, something a logged-out user needs to be able to do. It's a small, sensible piece of drift between an early design spec and the shipped implementation, and it's the kind of thing worth noticing when you're reading a codebase: a doc written before the code existed can be a great map, but the code is still the territory.

## D. Reading `root.ts` — where every module becomes one API

If `trpc.ts` is where tRPC gets configured, `root.ts` is where your actual API gets assembled. Here it is, in full — it's short:

```typescript
import { router } from './trpc.js';
import { iamRouter } from '../modules/iam/iam.router.js';
import { createDocumentsAppRouter } from '../modules/documents/index.js';
import { createTrackingRouter } from '../modules/tracking/tracking.router.js';
import { workflowRouter } from '../modules/workflow/workflow.router.js';
import { sessionRouter } from '../modules/workflow/session.router.js';

import { createOrgRouter } from '../modules/organization/organization.router.js';
import { createAuditTrpcRouter } from '../modules/audit/audit.router.js';

export const appRouter = router({
  iam: iamRouter,
  documents: createDocumentsAppRouter(),
  tracking: createTrackingRouter(),
  workflow: workflowRouter,
  session: sessionRouter,
  organization: createOrgRouter(),
  audit: createAuditTrpcRouter(),
});

export type AppRouter = typeof appRouter;
```

Every module in this backend — IAM, Documents, Tracking, Workflow, Session, Organization, Audit — builds its own router independently, in its own module folder. `root.ts` is the single place where all seven of those get pulled together and merged into one object, `appRouter`, under a namespaced key. This is exactly why calling a procedure from the frontend looks like `trpc.iam.getCurrentUser` or `trpc.documents.list` — the first segment after `trpc.` is literally the key you see above (`iam`, `documents`, `tracking`, and so on), and everything after that is whatever that module's own router defined.

Worth noticing, just as an observation rather than something to worry about: not every key is populated the same way. `iam`, `workflow`, and `session` are plain router values, imported and used directly. `documents`, `tracking`, `organization`, and `audit` are *factory function calls* — `createDocumentsAppRouter()`, `createTrackingRouter()`, and so on, invoked right there in the object literal. Both patterns produce the same thing — a router object, ready to be merged — this project just doesn't enforce one style universally across every module.

### The single most important line in this chapter

`export type AppRouter = typeof appRouter;`

Read that line as many times as it takes to feel obvious, because everything in Section A traces back to it. `typeof appRouter` takes the *value* `appRouter` — the actual merged router object, built at runtime by that `router({...})` call above — and produces its corresponding TypeScript *type*. That type, and specifically *only* that type (never the runtime value `appRouter` itself), is the thing that gets imported on the frontend. You'll see the literal import statement that does this in Section F.

This is worth sitting with, because it's genuinely unusual if you've only worked with REST or GraphQL before: `AppRouter` isn't a schema you wrote by hand, and it isn't generated by a build step reading some other artifact. It's TypeScript's own structural type inference, applied to a real object your backend actually builds. Every procedure name, every `.input()` shape, every return type — all of it is *already* present in the shape of `appRouter` as TypeScript understands it, because TypeScript has been tracking the type of every `router(...)`, `protectedProcedure.input(...).query(...)`, and merge you've read about in this chapter, the entire way through. `typeof appRouter` just names that already-inferred shape so it can be exported and imported elsewhere.

## E. Composition within a single module — the documents module has two different answers

Here's where it gets genuinely interesting, and where a naive assumption — "one module means one router file" — breaks down the moment you actually look at this codebase. Inside `/apps/server/src/modules/documents`, there isn't one router file. There are several: `documents.router.ts` (general CRUD — create, get, list, search, update, delete, and more), `complaints.router.ts`, `document-requests.router.ts`, `panlalawigan.router.ts`, and `signatures.router.ts`. Yet `root.ts` above shows exactly one key for the whole module: `documents: createDocumentsAppRouter()`. Something has to combine five files into one router before it ever reaches `root.ts` — and reading how it actually happens surfaces two genuinely different composition mechanisms, used at two different levels of the same module.

### Level 1: `documents.app.router.ts` merges whole routers

This file is only twelve lines, so here it is in full:

```typescript
import { t } from '../../trpc/trpc.js';
import { createDocumentsRouter } from './documents.router.js';
import { createComplaintsRouter } from './complaints.router.js';
import { createDocumentRequestsRouter } from './document-requests.router.js';

export function createDocumentsAppRouter() {
  return t.mergeRouters(
    createDocumentsRouter(),
    createComplaintsRouter(),
    createDocumentRequestsRouter(),
  );
}
```

`t.mergeRouters(...)` is a tRPC-provided function that takes multiple already-built router objects — each one produced by its own `router({...})` call somewhere else — and combines them into a single router. `createDocumentsRouter()`, `createComplaintsRouter()`, and `createDocumentRequestsRouter()` each independently call `router({...})` inside their own file (you can confirm this yourself: `complaints.router.ts` and `document-requests.router.ts` both open their factory function with `return router({`), producing three genuine, standalone router objects. `t.mergeRouters` flattens those three into one.

If you were to check what procedures the *merged* result exposes, they'd all sit at the same flat level — this merge doesn't create sub-namespaces. `complaints.createClerkAssisted` and `documents.create` both end up reachable as siblings on the merged router, which then becomes the single `documents` key in `root.ts`.

### Level 2: inside `documents.router.ts` itself, plain object spread

Now here's the part that's easy to miss unless you go looking: `panlalawigan.router.ts` and `signatures.router.ts` are **not** among the three files merged above. They're not siblings of `documents.router.ts` in the composition — they're consumed *inside* it. Near the top of `documents.router.ts`:

```typescript
import { createPanlalawiganProcedures } from './panlalawigan.router.js';
import { createSignatureProcedures } from './signatures.router.js';
```

and inside the `createDocumentsRouter` factory itself:

```typescript
export function createDocumentsRouter() {
  return router({
    ...createPanlalawiganProcedures(),
    ...createSignatureProcedures(),

    // ... documents.create, documents.get, documents.list, etc.
  });
}
```

That `...` is a plain JavaScript object spread — the same spread syntax you'd use to merge two ordinary objects, with no tRPC-specific API involved at all. And that's possible because `createPanlalawiganProcedures()` and `createSignatureProcedures()` don't return router objects the way `createComplaintsRouter()` does — if you look inside `panlalawigan.router.ts`, its factory function returns a *plain object literal* whose values happen to be tRPC procedure builders: `{ initiatePanlalawiganTransmittal: protectedProcedure.input(...).mutation(...), logPanlalawiganOutcome: protectedProcedure...., ... }` — never wrapped in a `router({...})` call of its own.

That distinction is the whole reason two different composition techniques exist side by side in this one module, and it's worth being precise about, because it's a real and useful thing to understand about how tRPC works under the hood: **a tRPC router's procedure map is, structurally, just a plain object.** `router({...})` takes such an object and turns it into a proper router (with its own type information, ready to be served or merged with `t.mergeRouters`). But *before* that final wrapping happens, while you're still building up the object you're about to pass to `router(...)`, you're free to use ordinary JavaScript object composition — spreading in procedures defined elsewhere — because at that stage, nothing tRPC-specific is involved yet. `t.mergeRouters` is for combining routers that already exist as routers. Plain spread is for combining procedure definitions before a router has been built from them at all. This module happens to use both, one level apart from each other, and neither is "more correct" than the other — they're solving composition at two different points in the construction process.

The practical upshot: when you go looking for where a documents-module procedure like `documents.recordSignature` lives, don't assume it's in `documents.router.ts` just because that's the file `documents.app.router.ts` names first. It might be spread in from `signatures.router.ts`. The final merged shape is flat regardless of which file originally defined each procedure — which is exactly the point of doing this composition at all.

## F. How the frontend consumes this

Here's `/apps/web/src/lib/trpc.ts`, in full:

```typescript
import { createTRPCReact, httpBatchLink } from '@trpc/react-query';

import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'server/src/trpc/root.js';
import { useSessionStore } from '@/stores';
import { logger } from './logger.js';

export const trpc = createTRPCReact<AppRouter>();
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function performSilentRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  isRefreshing = true;
  refreshPromise = fetch(`${import.meta.env.VITE_API_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
  return refreshPromise;
}

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${import.meta.env.VITE_API_URL}/api/trpc`,
      async fetch(url, options) {
        const fetchOptions = {
          ...options,
          credentials: 'include' as const,
        } as RequestInit;
        let response = await fetch(url, fetchOptions);

        let traceId: string | undefined;
        try {
          if (!response.ok) {
            const cloned = response.clone();
            const json = await cloned.json();
            if (Array.isArray(json)) {
              traceId = json[0]?.error?.json?.data?.traceId;
            } else {
              traceId = json?.error?.json?.data?.traceId;
            }
          }
        } catch {
          // Ignore parsing errors; we just want traceId if available
        }

        if (response.status === 401) {
          logger.warn('trpc_401_unauthorized', { url, traceId });
          const success = await performSilentRefresh();
          if (success) {
            logger.info('session_refresh_success', { url });
            response = await fetch(url, fetchOptions);
          } else {
            logger.error('session_refresh_failed_redirecting', { url, traceId });
            window.location.href = '/login';
          }
        }

        if (response.status === 423) {
          logger.error('session_locked', { url, traceId });
          useSessionStore.getState().setIsLocked(true);
          return new Response(
            JSON.stringify({
              error: {
                message: 'Session is locked',
                code: -32001,
                data: {
                  code: 'UNAUTHORIZED',
                  httpStatus: 401,
                },
              },
            }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return response;
      },
    }),
  ],
});
```

### The type-only import, made literal

`import type { AppRouter } from 'server/src/trpc/root.js';` — this is the moment Section A's story stops being abstract. `server` is this repository's Fastify backend, reachable here as a workspace package because `apps/web/package.json` lists `"server": "workspace:*"` as a dependency. This import pulls in exactly one thing: the `AppRouter` type you read the definition of in Section D — nothing else, no runtime code, because `import type` is erased entirely at build time. The `.js` extension on a path pointing at a `.ts` source file looks odd if you haven't seen it before; it's a standard convention for how modern ESM-style TypeScript resolves imports, and you don't need to think about it further than that.

`createTRPCReact<AppRouter>()` — from `@trpc/react-query`, which is tRPC v11's officially supported React integration — takes that type as a generic parameter and produces `trpc`: an object whose entire nested structure (`trpc.iam.getCurrentUser`, `trpc.documents.list`, all the way down) is generated purely from the shape of `AppRouter`. Nothing about `trpc` is hand-written; TypeScript derives its whole surface from the type you just imported. Underneath, `@trpc/react-query`'s `createTRPCReact` wraps TanStack Query — the same library you'd use directly for any other data-fetching in this app — so the hooks you get back (`.useQuery`, `.useMutation`) behave exactly like ordinary TanStack Query hooks, with tRPC handling only the "how do I turn this typed procedure call into an HTTP request" part underneath.

`RouterInputs` and `RouterOutputs`, built via `inferRouterInputs<AppRouter>` and `inferRouterOutputs<AppRouter>`, are two extra utility types this project derives from the same `AppRouter` type — useful anywhere you need to reference "the input type of procedure X" or "the output type of procedure Y" outside of a direct hook call, without writing that type out by hand.

`httpBatchLink` is the actual transport — it's what turns several procedure calls fired close together into a single batched HTTP request under the hood, reducing round trips. Its `url` points at `/api/trpc`, matching the prefix this backend's Fastify adapter registers its plugin under.

### The custom `fetch` override

Everything from `async fetch(url, options) {...}` onward is this project layering its own logic *underneath* tRPC's transport, by supplying a custom `fetch` implementation that `httpBatchLink` calls instead of the browser's native one. Two real, concrete situations are being handled here:

**The 401 branch — your access token quietly expired mid-session.** Access tokens don't last forever. When one has, the backend responds `401`. Rather than immediately kicking the user to a login screen — jarring, and often unnecessary, since a valid refresh token might still be sitting in a cookie — this code calls `performSilentRefresh()`, which `POST`s to `/api/auth/refresh` with `credentials: 'include'` (sending the refresh cookie along) and waits to see if the backend issues a fresh access token. If it does, the *original* failed request is silently retried, and — from the user's point of view — nothing happened at all; the thing they clicked just worked, maybe a beat slower than usual. Only if the refresh itself fails does the code give up and redirect to `/login`. `isRefreshing`/`refreshPromise` exist so that if several tRPC calls hit a `401` around the same moment, they don't each independently kick off their own refresh request — they share one in flight.

**The 423 branch — the session has been explicitly locked.** `423 Locked` is a distinct condition from an expired token: elsewhere in this backend, Fastify middleware checks `session.locked_at`, and if it's set, every request except the unlock endpoint gets a `423` instead of being processed at all — this is a deliberate lock state, not an expiry. When this frontend code sees a `423`, it calls `useSessionStore.getState().setIsLocked(true)` — a direct, synchronous write into a Zustand store, made from inside a network interceptor rather than from a React component's render — which is what actually flips the app into whatever "locked" UI state Chapter 1.6 covers (this chapter isn't the place to explain how that store itself works; just that this is the call site that trips it). Notice what happens next, though: instead of letting the raw `423 Locked` response pass through as-is, this code manufactures and returns a brand-new `Response`, shaped like a `401 UNAUTHORIZED` in the exact JSON-RPC-flavored envelope tRPC's client already knows how to parse. That's a deliberate translation step — tRPC's client-side error handling has expectations about the shape of error responses, and `423` isn't a status it has any built-in opinion about, so rather than let it hit tRPC's parsing logic as an unrecognized case, this code re-packages it into a shape tRPC already understands, while still making sure `useSessionStore` gets flipped first.

### Type inference at a real call site

Everything above is machinery. Here's what it buys you, in a real component. `/apps/web/src/pages/sysadmin/ActiveSessionsPage.tsx`:

```typescript
const sessionsQuery = trpc.iam.listAllActiveSessions.useQuery({ pageSize: 20 });
```

and, further down the same file, inside a row-level component:

```typescript
const terminateMutation = trpc.iam.forceTerminateSession.useMutation({
  onSuccess: () => {
    toast.success('Session terminated.');
    void utils.iam.listAllActiveSessions.invalidate();
    // ...
  },
  onError: (err) => toast.error(err.message || 'Failed to terminate identity.'),
});
```

Walk through everything you now get "for free" at these two lines, entirely because of what you learned in Section D.

`trpc.iam.listAllActiveSessions` exists as a *path* at all only because `root.ts` mounted the IAM module's router under the key `iam`, and that router — which you can go read directly in `iam.router.ts` — defines a procedure literally named `listAllActiveSessions`. Type `trpc.iam.` in your editor, and you'll see every procedure that router exports, autocompleted — you don't need to go read the backend file to know it's there.

`.useQuery({ pageSize: 20 })` — the argument you're allowed to pass here is checked directly against that procedure's `.input()` schema. If you tried `{ pageSize: '20' }` (a string instead of a number) or added a field that isn't in the schema, TypeScript would flag it right there, before you ever ran the app — because `listAllActiveSessions.useQuery`'s parameter type is derived from the exact same `paginationInput` Zod schema the backend procedure validates against at runtime. It's one schema, checked twice: once by TypeScript at your keyboard, once by Zod on the server when the request actually arrives.

`sessionsQuery.isPending`, `sessionsQuery.isError`, `sessionsQuery.data` — this is ordinary TanStack Query surface, arriving automatically because `@trpc/react-query`'s hooks are TanStack Query hooks underneath. Nothing special to learn here beyond what you already know from TanStack Query itself.

And then the interesting part: `sessionsQuery.data.items` — each item's fields (`s.userId`, `s.ipAddress`, `s.userAgent`, `s.lastActivityAt`, `s.active`, `s.id`, all visible in the JSX further down that file) are typed *exactly* as the real backend resolver returns them. That return type ultimately traces back through the `IamService.listAllActiveSessions` interface, which returns `SessionRow[]` — and `SessionRow` itself is `InferSelectModel<typeof sessions>`, a type inferred directly from the Drizzle table definition you worked with in Chapter 1.1. So the type you're autocompleting against in this component, right now, isn't hand-maintained anywhere — it's a straight, unbroken inference chain from the actual PostgreSQL `sessions` table, through Drizzle, through this service's return type, through the router, through `AppRouter`, into this hook call. Rename a column on that table, and — the same way Section A's walkthrough described — this component would show a compile error at `s.thatOldColumnName`, without anyone writing a single line of glue code to make that happen.

`utils.iam.listAllActiveSessions.invalidate()` — `trpc.useUtils()` gives you a handle into the underlying TanStack Query cache, and its shape mirrors the router's own namespacing exactly. This isn't just call sites that are typed; the cache-management API is generated from the same router shape too, which is why invalidating "the query behind `iam.listAllActiveSessions`" is spelled the same way as calling it.

## G. Adding a new tRPC procedure

Everything above is what happens when you *read* an existing procedure. Here's what actually changes when you add a brand new one, using everything this chapter has covered.

**1. Write the procedure inside the relevant `{module}.router.ts`,** built on `publicProcedure` or `protectedProcedure` from `../../trpc/trpc.js` — `protectedProcedure` for the overwhelming majority of cases in this app, since almost everything behind `/web` requires an authenticated session, and `publicProcedure` only for the rare case (like the password-reset redemption you saw in Section C) where the caller genuinely isn't logged in yet.

**2. Define its `.input()`** with a Zod schema. Following this codebase's established convention (visible throughout `documents.router.ts`, `iam.router.ts`, and every other router you'd read), that schema should live in `/packages/shared`, imported the same way you saw at the top of `documents.router.ts`:

```typescript
import { SomeInputSchema } from '@batac/shared/schemas/{module}';
```

not defined inline in the router file — this is the same shared-schema convention Chapter 1.2 covered, and it's what lets the exact same Zod schema validate the request on the backend *and* type the request on the frontend, with nothing duplicated between them.

**3. Implement the `.query()` or `.mutation()` resolver body.** Inside it, `ctx.auth` is already fully typed and guaranteed non-null (if you're on `protectedProcedure` — that's the middleware narrowing from Section C at work), and `input` is already validated and typed exactly as your Zod schema describes it — no manual parsing, no manual `if (!input.someField) throw ...` checks for shape, since Zod already rejected anything malformed before your resolver code ever runs.

**4. That's it on the backend — but there's one more step that isn't a step at all.** You do **not** need to touch anything on the frontend to make this new procedure reachable. No client regeneration, no separate type file to update, nothing. The moment your new procedure is added inside its router's `router({...})` call, it becomes part of that router's inferred type. Because that router eventually feeds into `root.ts`'s `appRouter`, and `export type AppRouter = typeof appRouter` re-derives itself from whatever `appRouter` currently contains, your new procedure is already present in `AppRouter` as soon as your backend file saves. The frontend's `trpc` object — built from `createTRPCReact<AppRouter>()` — picks it up automatically the next time TypeScript re-checks the project, which, if you're working with both the frontend and backend open in the same editor session, is essentially immediately. Go to any frontend file, type `trpc.{yourModule}.`, and your new procedure will simply be sitting there in the autocomplete list, fully typed, ready to call — because, as this entire chapter has tried to make concrete, it was never really "added" to the frontend at all. It was always going to be there the instant it existed on the backend, because the frontend was never looking at a copy of the API's shape. It was always looking at the shape itself.

---

# Chapter 1.5 — TanStack Query v5: The Cache Underneath Every tRPC Call

## Confirming what's actually installed

Same opening move as 1.4, for the same reason: check before assuming. `/apps/web/package.json` pins:

```json
"@tanstack/react-query": "^5.101.1",
```

and the lockfile resolves that range to exactly `5.101.1` — `@tanstack/react-query@5.101.1` with a matching `@tanstack/query-core@5.101.1` underneath it. So this chapter's every claim about defaults, hooks, and behavior is checked against the official v5 docs at `tanstack.com/query/v5`, not pattern-matched from v4 memory or general React-Query familiarity. That caveat matters more than it might sound: v5 changed real API shape from v4 — most visibly, every hook collapsed from several overloaded call signatures down to one, a single options object (`useQuery({ queryKey, queryFn, ...options })` instead of the old `useQuery(key, fn, options)` triple). If you've used React Query before and it was v4 or earlier, some of your instincts about calling conventions will be wrong here. Everything below reflects v5.

One more thing worth pinning down before we go further, because it's the whole reason this chapter exists as a *separate* chapter from 1.4 rather than a subsection inside it: `@trpc/react-query` is `^11.18.0`, and that package has `@tanstack/react-query` as a **peer dependency** — the lockfile shows `@trpc/react-query@11.18.0` resolved directly against `@tanstack/react-query@5.101.1`. tRPC doesn't ship its own caching layer. It depends on this one.

## A. What TanStack Query solves that tRPC alone doesn't

1.4 left you with a sentence that's easy to read past too quickly. Section F said it plainly: `createTRPCReact` **wraps TanStack Query** — "the hooks you get back (`.useQuery`, `.useMutation`) behave exactly like ordinary TanStack Query hooks, with tRPC handling only the 'how do I turn this typed procedure call into an HTTP request' part underneath." This chapter is about everything on the other side of that sentence — the part tRPC *isn't* handling.

Here's the distinction stated as plainly as 1.4 stated tRPC's: **tRPC gives you a type-safe way to call a procedure. TanStack Query gives you a client-side cache that decides whether that call needs to happen at all, and what to do with the result once it has.** These are genuinely two different jobs, done by two different libraries, and `@trpc/react-query` exists specifically to wire one into the other — not to replace either.

You can see this literally, not just conceptually, in how this app boots. `/apps/web/src/main.tsx`:

```typescript
<trpc.Provider client={trpcClient} queryClient={queryClient}>
  <QueryClientProvider client={queryClient}>
    ...
  </QueryClientProvider>
</trpc.Provider>
```

Two providers, nested, and — this is the part to notice — they share the exact same `queryClient` instance. `trpc.Provider` takes a `client` prop (the tRPC client from Chapter 1.4's `trpcClient`, which knows how to turn a procedure call into an HTTP request over `httpBatchLink`) *and* a `queryClient` prop (the TanStack Query cache). `QueryClientProvider` — TanStack Query's own provider, imported from `@tanstack/react-query` directly, nothing tRPC-specific about it — takes that same `queryClient` again. If tRPC were "just" a fetching library, there'd be nothing for it to hand a `QueryClient` to. The fact that it asks for one, explicitly, at the provider level, is the clearest possible evidence that these are two libraries being glued together, not one library with two names.

So what does that cache actually buy you that a raw `fetch` call — or a raw tRPC call with no React Query underneath — wouldn't? Four concrete things, all of which TanStack Query handles for *every* query in this app, tRPC-backed or not:

- **Deduplication of identical in-flight requests.** If two components on the same screen both call `trpc.documents.get.useQuery({ documentId })` for the same `documentId` at roughly the same moment, TanStack Query fires exactly one HTTP request and hands both components the same result. Without this layer, you'd get two identical network round trips for data you already know is the same.
- **Background refetching and stale-while-revalidate.** A component can show cached data *instantly* on mount — no loading spinner, no blank screen — while a fresh copy quietly fetches behind the scenes, and the UI updates seamlessly if the fresh data differs. tRPC alone has no concept of "cached data" at all; every call would be a fresh network round trip, every time.
- **A declarative way to say "this data is now stale."** This is `invalidateQueries` and its tRPC-specific cousin, `utils.*.invalidate()` — covered in full below. Without it, you'd need to manually track, in your own code, every place a piece of server data is displayed, and manually trigger a refetch at each of those places after every mutation that could have changed it.
- **Automatic retry, garbage collection of unused cache entries, and structural sharing** so a component doesn't re-render just because a fetch technically ran again but returned byte-for-byte identical data.

None of this is tRPC's job, and none of it would exist if `@trpc/react-query` only wrapped the transport. It exists because `@trpc/react-query`'s hooks *are* TanStack Query hooks — the same `useQuery`/`useMutation` you'd call directly against any other data source, just pre-wired to a tRPC procedure instead of a raw URL.

Worth a one-line cross-reference forward, not backward: `tech-stack.md`'s Stack Decisions table lists "Server state (frontend)" as TanStack Query's row, with a hard constraint of exactly three things — "**cache invalidation, background refetch, optimistic updates**." That's not a random phrase; it's the outline for the rest of this chapter. Sections B and C are about cache invalidation. Section D is about background refetch. Section E is about optimistic updates. The very next row in that same table, "UI state (frontend)," is Zustand's — with the constraint "not server state." You don't need the reasoning behind that split yet; 1.6 covers it in full once you've seen what "server state" actually *is* in practice, which is what the rest of this chapter is about.

## B. Query keys: the thing the whole cache is built around

Every piece of cached data in TanStack Query is addressed by a **query key** — and understanding what a key actually is, precisely, is the single most load-bearing idea in this chapter. Get this wrong and cache invalidation either does nothing (you invalidated a key nothing matches) or does too much (you invalidated a key that matches far more than you meant).

The official v5 docs state the rule in one sentence: a query key "has to be an Array at the top level," and can be "as simple as an Array with a single string, or as complex as an array of many strings and nested objects" — the only real requirement being that it's `JSON.stringify`-serializable and **unique to the query's data**. Two more rules from that same page matter for reading this project's code specifically:

- **Query keys are hashed deterministically for object contents, but array order matters.** `['todos', { status, page }]` and `['todos', { page, status }]` are the *same* cache entry — key order inside an object doesn't matter. `['todos', status, page]` and `['todos', page, status]` are *different* cache entries — position inside the array does matter. This distinction is why f3 (below) is so rigid about exactly where `input` sits in every key it defines.
- **If your query function depends on a variable, that variable belongs in the key.** This is the mechanism, not just a style preference: TanStack Query treats the key as the query's actual dependency list. Change a value that's baked into the key, and the library automatically treats it as a *different* query — a different cache entry, fetched independently, refetched on its own schedule.

That's the general v5 rule. This project has its own, considerably more specific rule on top of it, and it's not optional guidance — it's a **BLOCKING pre-development document**: `docs/pre-development/F-frontend-architecture/f3-tanstack-query-key-factory-specification.md`. Its opening paragraph states the stakes plainly, and it's worth reading exactly as written, because it's the reason this document exists at all:

> "Incorrect or missing invalidations produce stale data bugs that are among the hardest to reproduce: the data looks right on first load, appears correct in the network tab, and only reveals itself as wrong when a user acts on information that changed moments before they saw it."

### The three-tier key hierarchy

F3 defines every query key in this app at three levels of specificity, and — this is the part worth sitting with — every one of the three is independently a valid target for `invalidateQueries`, because `invalidateQueries` matches by **prefix**, not exact equality, unless you explicitly ask for exact matching. From f3's Conventions section:

**Router scope** — matches every query from a router, any procedure, any input:

```typescript
[['router']]
```

**Procedure scope** — matches every query from one procedure, any input. This is what you invalidate when you don't know (or don't want to enumerate) which specific filter permutation of a list might be stale:

```typescript
[['router', 'procedure']]
```

**Instance key** — matches exactly one cached result for one specific input:

```typescript
[['router', 'procedure'], { input: { ... }, type: 'query' }]
```

The reasoning behind "why three levels, not just one" is the exact stale-data problem f3 opens with. Say a mutation changes one specific document. You could invalidate just that document's instance key — cheap, precise, but it leaves every *list* view that might contain a summary of that document showing stale data, because a list query is a different cache entry entirely. Or you invalidate the whole `documents` router scope — safe, but it refetches things that have nothing to do with what actually changed (audit logs, retention schedules, anything else under that same router). The three-tier structure exists so you can pick the level that matches the actual blast radius of a given mutation, no more and no less.

### Why the shape mirrors tRPC's own auto-generated keys

Here's a detail that's easy to miss if you don't read f3's Conventions section closely, and it matters directly for Section C below: f3's key shape isn't arbitrary. It's a deliberate mirror of tRPC v11's own internal key-generation function, which f3 quotes directly:

```typescript
function getQueryKey(path: string[], input: unknown, type: 'query' | 'infinite' | 'any') {
  return input === undefined
    ? [[...path], { type }]
    : [[...path], { input, type }];
}
```

This is exactly the "cache-management API is generated from the same router shape" idea 1.4 pointed at when it explained `utils.iam.listAllActiveSessions.invalidate()`. tRPC doesn't invent its own separate key scheme — it generates keys in *this* shape automatically, for every procedure, from the router path plus the input. f3's factory functions produce keys in the identical shape by hand. That's not a coincidence; it's the entire point, stated directly in f3's own text: "This means the factory keys are compatible with both direct `queryClient` calls and tRPC's own utility methods." A hand-written `documentKeys.detail(documentId)` and tRPC's auto-generated key for `trpc.documents.get.useQuery({ documentId })` resolve to the *same array*, so either mechanism can invalidate what the other cached.

### A concrete factory, read in full

f3 defines eleven of these factories, one per router. Here's `documentKeys` — the largest one, and a good one to internalize since `documents` is the module you'll touch most:

```typescript
export const documentKeys = {
  all: () => [['documents']] as const,

  details: () => [['documents', 'get']] as const,
  detail: (documentId: string) =>
    [['documents', 'get'], { input: { documentId }, type: 'query' as const }] as const,

  lists: () => [['documents', 'list']] as const,
  list: (input: { cursor?: string | null; pageSize?: number; /* ...more filters */ }) =>
    [['documents', 'list'], { input, type: 'query' as const }] as const,

  // ...ocrText, scanQuality, versionHistory, adminMetadata, search — same pattern
} as const;
```

Notice the naming convention this follows exactly as f3 states it: `details()` — plural, no arguments, procedure scope — versus `detail(documentId)` — singular, takes the input, instance key. That's not a one-off choice for `documents`; every parameterized procedure in every factory gets this exact plural/singular pair. Void-input procedures (nothing to parameterize) collapse to one function — `iamKeys.currentUser()` is the whole entry, no plural/singular split, because there's no filter dimension to distinguish "all instances" from "one instance."

f3's own worked example makes the practical payoff concrete: a document's `title` changes via `documents.update(documentId)`. You invalidate `documentKeys.detail(documentId)` — the one cached record that actually changed — *and* `documentKeys.lists()` — every cached list view, regardless of which filters produced it, because any of them might currently be displaying that document's old title in a row. You do **not** need to invalidate `documentKeys.all()`, which would also blow away cached OCR text and version history that this particular mutation had nothing to do with. That's the three-tier structure doing real work, not just organizational tidiness.

## C. What real code actually does with this — and where it diverges from f3

Everything in Section B is the documented contract. Now the honest part: does the real code in `/apps/web/src` actually follow it? The answer is genuinely mixed, and it's worth being precise about exactly how, file by file, rather than rounding up to either "yes, consistently" or "no, ignored" — neither is accurate.

### The idiomatic case: `utils.*.invalidate()`, matching f3's own preferred style

f3's Mutation Invalidation Matrix section states its own preference directly: "Prefer `utils.*` calls from the tRPC context (`trpc.useUtils()`) in mutation callbacks. Use factory scope keys directly only when invalidating across multiple procedures or routers in one call." The reasoning connects straight back to Section B's mirror-structure point — since `utils`' shape is generated from the same router shape as the auto-generated keys, `utils.workflow.getInstance.invalidate({ instanceId })` and `queryClient.invalidateQueries({ queryKey: workflowKeys.detail(instanceId) })` invalidate the identical cache entry. `utils.*` is just less to type.

This is exactly what `/apps/web/src/pages/workflow/panels/MultiReferralPanel.tsx` does, consistently, across all three of its mutations:

```typescript
const submitReportMutation = trpc.workflow.submitCommitteeReport.useMutation({
  onSuccess: () => {
    toast.success('Committee report submitted.');
    void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
  },
  onError: (err) => toast.error(err.message || 'Failed to submit report.'),
});
```

`GenericApprovalPanel.tsx`, `GenericActionPanel.tsx`, `MayorDecisionPanel.tsx`, and `DocketingPanel.tsx` — every mutation-bearing file in `workflow/panels/` — follow the identical shape: `utils.workflow.getInstance.invalidate({ instanceId })`, called from `onSuccess`, one line, matching f3's stated preference exactly.

### ==A gap worth naming precisely: same pattern, incomplete blast radius==

Here's where "follows the pattern" and "does what f3's matrix says this specific mutation should do" turn out to be two different claims. f3's Workflow Mutations table lists `submitCommitteeReport`'s invalidation targets as `workflowKeys.detail(instanceId)`, `workflowKeys.forDocument(documentId)`, *and* `workflowKeys.mySteps()` in the same-module column, plus `sessionKeys.orderOfBusinesses()` cross-module — because, as f3's own Committee Report Status Chain note explains, the Order of Business view is a derived computation over both the `documents` and `workflow` schemas, and "TanStack Query has no way to know it is stale without an explicit invalidation signal."

`MultiReferralPanel.tsx`'s real code invalidates exactly one of those four: `workflowKeys.detail`, via `utils.workflow.getInstance.invalidate(...)`. It does not touch `mySteps()` or `orderOfBusinesses()`. Every sibling file in that same directory shows the identical narrowing — one `getInstance` invalidation, nothing broader — even for mutations like `approveStep` that f3's matrix says should additionally invalidate `documentKeys.lists()` because "lifecycle state may change." The practical consequence, if this is genuinely the current state and not something covered elsewhere: a user's "My Assigned Steps" inbox (`workflowKeys.mySteps()`, the exact query backing `MyAssignedStepsPage.tsx`) may keep showing a step as pending after that step has actually been completed from a different panel, until something else — a full remount, a window refocus, the 5-minute garbage-collection window — happens to trigger a fresh fetch. That's precisely the "looks right on first load... only reveals itself as wrong later" failure mode f3's own opening paragraph warns about.

### ==A different pattern entirely: `refetch()` instead of `invalidate()`==

`/apps/web/src/pages/documents/DocumentDetailPage.tsx` takes a genuinely different approach — not a smaller version of the `utils.*` pattern, a different mechanism altogether. It does declare `const utils = trpc.useUtils();` at the top of the component. But across all twelve of its mutations, `utils` is used for cache invalidation exactly **zero** times. Instead, every mutation's `onSuccess` calls the `refetch` function returned directly by a sibling `useQuery` call:

```typescript
const {
  data: document,
  refetch: refetchDocument,
} = trpc.documents.get.useQuery({ documentId: documentId! }, { enabled: !!documentId });

// ...

const submitMutation = trpc.documents.submit.useMutation({
  onSuccess: () => {
    toast.success('Document submitted');
    void refetchDocument();
  },
  onError: (e) => toast.error(e.message),
});
```

`refetch()` and `invalidate()` are not the same operation, and the difference matters for anything beyond this one component. `refetch()` re-fetches *this specific query instance, right here, in this component* — it has no effect on any other cached copy of that same data elsewhere in the app. `invalidate()` marks the cache entry itself as stale; every currently-mounted component subscribed to that key refetches, and any component that mounts later gets a fresh fetch on its next mount too, regardless of whether it's the same component that triggered the invalidation. Inside `DocumentDetailPage.tsx`, where the query and every mutation that should affect it live in the same component, `refetch()` produces a visually identical result to what `invalidate()` would have — the one place this data is shown updates. It's only a real problem the moment some *other* screen also has that same document cached (a list row, a different tab, a dashboard summary) and needs to know it changed too. `documentKeys.lists()` — the query key f3's matrix says `documents.submit` should invalidate alongside the instance — never gets touched by this file at all.

The `utils` object's single real use in this file is instructive on its own, and it's a case f3 anticipated directly:

```typescript
const result = await utils.tracking.printQrCoverSheet.fetch({
  documentIds: [documentId],
  layout: 'single',
});
```

`printQrCoverSheet` is typed as a `query` in the router but returns a short-lived presigned PDF URL — f3's own note on this exact procedure says "Configure `staleTime: 0` and `gcTime: 0`... Do not use this key for `setQueryData` — the URL expires and caching it is harmful." Calling `.fetch()` through `utils` here — an imperative one-shot fetch, bypassing `useQuery` and its cache entirely — is precisely the right tool for data that shouldn't be cached at all. This is the one place in the file where `utils` gets used, and it's used correctly, for exactly the case f3 flagged as an exception to normal caching.

### ==A third pattern: named helper functions wrapping `invalidate()`==

`/apps/web/src/pages/organization/OrganizationPage.tsx` shows a third variant — not a different mechanism this time, but a different way of organizing the same `utils.*.invalidate()` call so it isn't repeated inline at every call site:

```typescript
const invalidateHierarchy = () => {
  void utils.organization.getOfficeHierarchy.invalidate();
};
const invalidateEmployees = () => {
  void utils.organization.listEmployees.invalidate();
};

const createOffice = trpc.organization.createOffice.useMutation({
  onSuccess: () => {
    toast.success('Office created');
    setOfficeDialog(null);
    invalidateHierarchy();
  },
  onError: (e) => toast.error(`Failed: ${e.message}`),
});
```

`updateOffice` and `deactivateOffice` reuse the same `invalidateHierarchy()`; `createEmployee` and `updateEmployee` reuse `invalidateEmployees()`. This is the same underlying `utils.*.invalidate()` call as the workflow panels, just named once and called from several `onSuccess` handlers instead of repeated inline — a reasonable pattern for a component with several mutations that share an invalidation target.

But this file also has a genuine, checkable gap, distinct from the workflow panels' *incomplete* invalidation: two of its mutations invalidate **nothing at all**.

```typescript
const createPosition = trpc.organization.createPosition.useMutation({
  onSuccess: () => {
    toast.success('Position created');
    setPositionDialog(false);
  },
  onError: (e) => toast.error(`Failed: ${e.message}`),
});
```

f3's Organization Mutations table lists `organization.createPosition`'s same-module invalidation target as `orgKeys.officeHierarchy()` — the exact query this component already has open, and already has a named helper (`invalidateHierarchy`) sitting right there ready to call. It just isn't called here. `assignEmployeeToPosition` has the identical gap; f3 lists it as needing both `orgKeys.officeHierarchy()` *and* `iamKeys.userDirectory()`, and the real mutation's `onSuccess` only closes its dialog. The user-facing consequence: create a new position, and the office hierarchy tree — the same tree `getOfficeHierarchy` renders — won't show it until something unrelated triggers a refetch (a window refocus, a full page remount), even though the mutation itself clearly succeeded and the toast confirms it.

### So which is it — auto-generated defaults, or f3's custom factory?

This is the question the prompt for this chapter asked directly, and now you have the file-level evidence to answer it precisely: **neither exclusively.** Every real `useQuery`/`useMutation` call site reads `trpc.<module>.<procedure>.useQuery(...)` — none of them import a key factory function directly or pass a hand-constructed array as a `queryKey`. That means every query's key is tRPC's own auto-generated default, produced by the exact `getQueryKey` function f3 quotes and mirrors. Nobody is bypassing that, because there's no reason to — `@trpc/react-query`'s hooks generate the key for you automatically from the procedure path and input, matching f3's documented shape by construction.

What varies — and this is where the real divergence lives — is what happens on the *invalidation* side, in mutation `onSuccess` handlers, where three different approaches coexist in the same codebase: `utils.*.invalidate()` used correctly but narrowly (workflow panels), `refetch()` used instead of `invalidate()` (`DocumentDetailPage.tsx`), and `utils.*.invalidate()` used correctly where it's called at all, but simply not called for two specific mutations (`OrganizationPage.tsx`). f3's factory functions themselves — the actual `documentKeys`, `workflowKeys`, `orgKeys` objects — don't appear to be imported anywhere in the mutation-handling code this chapter's research covered; every invalidation call site goes through `utils.*` instead, which f3 itself says is the preferred style for single-router invalidation. The factory's real, current job in this codebase is closer to a design reference and a target for `queryClient`-style calls than something actively imported line-by-line — which is a legitimate use for a specification document, just worth being precise that it's not (yet, in the files this chapter covers) wired in as literal imported code everywhere f3 describes.

## D. A real query and a real mutation, walked through in full

### The query: `organization.getOfficeHierarchy`

```typescript
const { data: hierarchy, isLoading: hierarchyLoading } =
  trpc.organization.getOfficeHierarchy.useQuery();
```

Void input — no arguments to `.useQuery()` at all, matching f3's `orgKeys.officeHierarchy()` void-input pattern from Section B. What actually triggers a refetch of this query, once it's mounted? The official v5 "Important Defaults" page states the baseline directly, and nothing in this codebase overrides it for this particular call: cached data is considered stale immediately (`staleTime` defaults to `0`), and stale queries refetch automatically in the background under exactly three conditions — **a new instance of the query mounts, the browser window regains focus, or the network reconnects after being offline.** No custom `staleTime`, `refetchOnWindowFocus`, or `gcTime` appears anywhere on this call site — and, having checked, nowhere in the entire `/apps/web/src` tree does *any* `useQuery` call override those three specific options. This app's global `QueryClient`, defined in `/apps/web/src/lib/query-client.ts`, only customizes one thing:

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (isTRPCClientError<AppRouter>(error) && error.data?.code === 'UNAUTHORIZED') {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});
```

A custom `retry` function — skip retrying entirely on a tRPC `UNAUTHORIZED` error (since that's handled separately, by the 401-refresh logic in `trpc.ts`'s custom `fetch` you read about in 1.4), otherwise fall back to `failureCount < 3`, which is just the v5 default of three retries, written out explicitly. `staleTime`, `gcTime`, and the three refetch triggers are all left completely untouched, application-wide. So the honest, complete answer for `getOfficeHierarchy`: it refetches on mount, on window refocus, and on network reconnect — because that's what every query in this app does by default, and nobody has customized this one.

### The mutation: `organization.createOffice`

```typescript
const invalidateHierarchy = () => {
  void utils.organization.getOfficeHierarchy.invalidate();
};

const createOffice = trpc.organization.createOffice.useMutation({
  onSuccess: () => {
    toast.success('Office created');
    setOfficeDialog(null);
    invalidateHierarchy();
  },
  onError: (e) => toast.error(`Failed: ${e.message}`),
});
```

Walk through exactly what happens after a successful `createOffice.mutate(...)` call, end to end. First, `onError` doesn't fire — this is a success path — so skip straight to `onSuccess`. Three things happen, in the order they're written: a success toast appears; the create-office dialog closes (`setOfficeDialog(null)`); and `invalidateHierarchy()` runs, which is `void utils.organization.getOfficeHierarchy.invalidate()`. That call marks the `getOfficeHierarchy` cache entry stale — the exact same query this section just walked through above. Because this component still has an active, mounted `useQuery` subscription to that same key (the `hierarchy` variable is still in scope, still rendering the tree in this same component), TanStack Query's official invalidation behavior kicks in immediately: per the v5 docs, invalidation does two things — "it is marked as stale," and "if the query is currently being rendered via `useQuery`... it will also be refetched in the background." So the observable, real user-facing behavior is: the office you just created appears in the tree, automatically, without a manual page refresh, moments after the success toast — because the same invalidation call that you'd reach for to update a *different* screen also, as a side effect, refreshes the screen you're already looking at.

That last point is worth being explicit about, because it's easy to under-appreciate: `invalidateHierarchy()` isn't specifically "refresh this component's data" — it's "mark this cache entry stale, wherever it's used." In this component, since the query and the mutation happen to live in the same place, that produces the same visible result a `refetch()` call would have. The difference only becomes visible the moment a *second* screen also has `getOfficeHierarchy` mounted — a dashboard summary card, say, showing office count. `invalidateHierarchy()` refreshes both, automatically, because both are subscribed to the identical key. `refetchDocument()`, the pattern `DocumentDetailPage.tsx` uses instead, would only ever have refreshed the one component that called it.

### A customized default, for comparison: `useScanQualityPolling`

Everything above assumed default behavior. Here's a real file that deliberately overrides it — `/apps/web/src/hooks/useScanQualityPolling.ts`, in full:

```typescript
export function useScanQualityPolling(versionId: string | undefined) {
  return trpc.documents.getScanQualityIndicator.useQuery(
    { versionId: versionId! },
    {
      enabled: !!versionId,Optimistic updates: documented as a target, not yet used
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data || data.scanQualityCategory === null) {
          return 3000;
        }
        return false;
      },
    },
  );
}
```

Two customizations, both deliberate. `enabled: !!versionId` disables the query entirely until a real `versionId` exists — a genuinely common pattern for a query whose input depends on data another query hasn't returned yet (in this hook's actual caller, `DocumentDetailPage.tsx`, `versionId` comes from `versions`, itself the result of a separate `getVersionHistory` query that has to resolve first). And `refetchInterval` — normally absent by default, meaning "never poll" — is set here as a *function*, not a static number: it receives the query object, checks whether `scanQualityCategory` is still `null` (OCR hasn't finished), and returns `3000` (poll again in three seconds) if so, or `false` (stop polling entirely) once a real category has arrived. This matches, closely but not identically, the exact pattern f3's OCR Processing Poll Pattern note describes — f3 recommends `refetchInterval: 2000` and a condition of `!data?.scanQualityCategory`; the real hook uses `3000` and `!data || data.scanQualityCategory === null`. Functionally equivalent — both stop polling the instant a non-null category shows up — but not a byte-for-byte match to what f3 wrote, worth knowing if you're the one updating either document later and expect them to agree exactly.

## E. ==Optimistic updates: documented as a target, not yet used==

f3 mentions `setQueryData` in passing, in the context of instance keys ("Use with `queryClient.setQueryData` for optimistic updates"). The official v5 docs describe the mechanism in detail: `onMutate` runs *before* the mutation's network request resolves, gets a chance to snapshot the current cache value, write an optimistic value directly into the cache with `setQueryData`, and return that snapshot so `onError` can roll back to it if the mutation ultimately fails.

Having checked directly — `grep`ing for `onMutate` and `setQueryData` across every file in `/apps/web/src` — neither term appears anywhere in this codebase. There is no optimistic update implemented in this application, in any module, as of the files this chapter covers. That's stated plainly rather than worked around, because f3 and `tech-stack.md` both name optimistic updates as a stated hard constraint for this layer, and the honest state is: it's a documented target, not yet a built feature. If you go looking for one and don't find it, that's not something you missed.

It's worth understanding *why* this technique exists at all, and — genuinely useful for the kind of app this is — where it would and wouldn't make sense to reach for it here, if and when someone does. The core idea: instead of waiting for the server to confirm a mutation before updating what the user sees, you update the cache immediately, optimistically assuming success, and only reconcile with the real server response afterward (rolling back if it turns out you were wrong). The payoff is purely about perceived speed — the UI feels instant, because it doesn't wait on a network round trip before reflecting the action.

For a government-workflow application specifically, that trade-off cuts differently depending on what the action *is*. Something like marking a notification as read, or toggling a UI-only filter that happens to be server-persisted — low stakes, high frequency, no legal weight if a rollback occasionally has to correct a flicker — is a reasonable candidate: `notifications.markAsRead`, say, could plausibly update its cached "unread" badge count instantly rather than waiting on a round trip. But this app's actual mutation surface is dominated by the opposite case: `workflow.approveStep`, `workflow.mayorSign`, `workflow.mayorVeto`, `documents.submit` — actions that are, by this project's own domain (Chapter 0.2), legally significant state transitions, each one appended to an audit trail that this project's tech-stack document treats as non-negotiable (append-only, hash-chained, HMAC-signed). Showing a mayor's veto as "applied" in the UI a half-second before the server has actually validated and recorded it — and then having to silently *un-apply* it in the UI if the server rejects it — isn't a minor visual glitch in this context; it's a UI momentarily lying about the state of an official government action. The honest reasoning cuts the other way from most consumer apps: the mutations here that would benefit most from optimistic updates in terms of raw perceived speed are, for the most part, exactly the ones where waiting for real server confirmation is the correct behavior, not an inconvenience to be optimized away.

## F. Adding data-fetching to a new page

Pulling everything above into one concrete sequence — what you'd actually do, step by step, wiring up a brand-new page.

**1. Call the query directly through the `trpc` client object**, the same object from 1.4 — `trpc.<module>.<procedure>.useQuery(input)`, with whatever input shape that procedure's `.input()` schema requires (checked at compile time, exactly as 1.4's Section F walked through). If the procedure takes no input, call `.useQuery()` with no arguments, the same way `getOfficeHierarchy` does above.

**2. Know what key that call just generated, without having to think hard about it.** Per Section B and C: it's tRPC's auto-generated default, in the exact shape `[[module, procedure], { input, type: 'query' }]` (or `[[module, procedure], { type: 'query' }]` for void input) — the same shape f3's factory mirrors by hand for exactly this reason. You don't need to construct this key yourself; it happens automatically the moment you write the `.useQuery()` call. What you *do* need to know, before writing any mutation that should affect this page, is which factory-scope this key falls under — check f3's entry for your module and procedure to see whether it's a `details()`/`detail()` pair, a `lists()`/`list()` pair, or a void-input single function, since that tells you whether a future mutation should invalidate one specific instance or the whole procedure's cached results.

**3. If this page also needs a mutation that should update its own query afterward, follow Section D's `createOffice` pattern, not `DocumentDetailPage.tsx`'s `refetch()` pattern.** Get a handle on `trpc.useUtils()` at the top of the component — `const utils = trpc.useUtils();` — and in the mutation's `onSuccess`, call `utils.<module>.<procedure>.invalidate(input?)`, matching the shape of the query you set up in step 1. If the input matters (an instance key, like `workflowKeys.detail(instanceId)`), pass it: `utils.workflow.getInstance.invalidate({ instanceId })`. If you're invalidating every cached result for a list procedure regardless of filters, call it with no argument: `utils.organization.getOfficeHierarchy.invalidate()`, exactly as `invalidateHierarchy()` does above. Check f3's Mutation Invalidation Matrix for your specific mutation before writing this line — Section C showed real, working examples that stopped one invalidation short of what the matrix actually specifies, and the gap only shows up later, on a screen you weren't looking at when you wrote the mutation.

**4. If the mutation's effects reach outside this page** — a different module's cached data, not just this query — that's the cross-module column in f3's matrix, and it's the one case f3 itself says to reach for a factory scope key directly rather than `utils.*`: `queryClient.invalidateQueries({ queryKey: sessionKeys.orderOfBusinesses() })`, alongside whatever `utils.*` calls handle the same-module side. This is exactly the shape of gap Section C found real, working code missing more than once — worth getting right the first time on a new page, rather than joining that pattern.

---

# Chapter 1.6 — Zustand: Where Client State Lives (and Why It's Not Where You Think)

**Pinned version confirmed:** `apps/web/package.json` lists `"zustand": "^5.0.14"` — matches expectation.

## A. The Distinction This Whole Chapter Is About

You've now spent all of Chapter 1.5 learning TanStack Query, and if that chapter did its job, you can already answer one question fluently: "is this document approved yet?" That answer lives in Postgres. A tRPC procedure fetches it. TanStack Query caches it, invalidates it, refetches it in the background, and hands your component a `data`/`isLoading`/`error` triple. You never touch that answer directly — you ask the server, and TanStack Query manages the asking.

This chapter is about the other kind of question, and the project's own stack documentation draws the line with almost no room for misreading. Here's the actual table from `tech-stack.md`:

| Layer | Choice | Hard constraint |
|---|---|---|
| Server state (frontend) | TanStack Query | Cache invalidation, background refetch, optimistic updates |
| UI state (frontend) | Zustand | Modals, sidebar, multi-step form state — not server state |

Sit with that second row's constraint column for a second: *"not server state."* That's not a throwaway clarification — it's the entire design principle for this store layer, stated as a negative space. Zustand isn't defined by what it does; it's defined by what it's explicitly forbidden from doing.

So here's the concrete version, using two real questions this project actually has to answer:

- **"Is this specific document approved yet?"** — this has a row in the `documents` table (or wherever the workflow state lives). It exists whether or not anyone's browser tab is open. If the SP Secretary approves it from their desk and you refresh your own tab three states away, you'll see the new status. That's **server state**. It's fetched via tRPC + TanStack Query, exactly as Chapters 1.4–1.5 covered.
- **"Is the create-document modal currently open?"** — this has no row anywhere. Postgres has never heard of it. If you refresh the page, it's gone — not because anything failed, but because there was never anything to fail; the "true" value only ever existed in your browser's memory. That's **client state**. It's Zustand's entire job.

The tell is always the same: *does this have a server counterpart?* If yes — even if it's slow-changing, even if it's a boolean — it's server state, and putting it in Zustand means you now have two sources of truth that can silently disagree. If no — if the concept literally cannot exist without a browser tab open — it's client state, and putting it in TanStack Query means fetching, caching, and invalidating something that was never fetched from anywhere to begin with.

You'll see this framing repeat through the rest of this chapter, because every store you're about to read only makes sense once you're asking "what would this field even *mean* on a server?" and getting the answer "nothing."

## B. What Zustand Actually Is

If you've used React Context before, here's the mental model shift: **a Zustand store is just a hook.** Not a hook wrapped in a Provider you have to remember to mount somewhere near the root of your tree — a plain hook, importable from anywhere, callable from any component, with no wrapping step at all.

Contrast that directly with Context, since it's the thing you've probably already reached for:

```tsx
// Context: you need a Provider component wrapping your tree
<MyContext.Provider value={someState}>
  <App />
</MyContext.Provider>

// Then, deep in the tree:
const value = useContext(MyContext);
```

If you forget the `<Provider>`, `useContext` either throws or silently returns a default you didn't want. It's an easy thing to get wrong, and it couples your state to *where* you mounted the provider in the tree.

Zustand skips that step entirely:

```typescript
// Zustand: this call itself creates the store. No provider, ever.
export const useShellStore = create<ShellState & ShellActions>((set) => ({
  sidebarCollapsed: false,
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
```

That `create(...)` call *is* the store. The `useShellStore` it returns is a hook like any other — any component, anywhere, imports it and calls it:

```tsx
const { sidebarCollapsed, toggleSidebar } = useShellStore();
```

No provider. No "did I mount this correctly" bug class. That's the whole mental model: a store is a hook that happens to hold shared state instead of local state, and — as you'll see in section D — it also happens to expose a second, non-hook way to read and write that same state from outside React entirely. That second capability is something Context genuinely cannot do, and it's going to matter a lot in this project.

Why did this project pick Zustand over Redux specifically? The tech-stack.md rationale is short and it's worth reading literally rather than summarizing: *"Modals, sidebar, multi-step form state — not server state."* Redux was built for an era before anything like TanStack Query existed, when *all* app state — server-fetched data included — had to be managed by hand, with actions, reducers, and manual cache invalidation. Once TanStack Query owns server state (Chapter 1.5), what's actually left for a client-state library to manage is small, numerous, and mostly independent: is this modal open, is that sidebar collapsed, what's the current field value on step 3 of a form nobody's submitted yet. Redux's action/reducer/dispatch ceremony is heavy machinery for that job. Zustand's `create(() => ({ ... }))` is proportionate to it.

## C. `session.store.ts` — The Most Architecturally Significant Store

Here's the real file, in full:

```typescript
import { create } from 'zustand';

// Mirrors the identity payload from AuthResponseSchema (E3 Part 2)
// plus the role/office data resolved after login.
// Deviation from F2: added `committeeIds` to prevent regression of LOG-0085.
export interface ActiveUserIdentity {
  userId: string; // UUID
  username: string;
  displayName: string; // computed from employee first+last, or username fallback
  sessionId: string; // UUID from AuthResponseSchema
  expiresAt: string; // ISO 8601; used to detect expiry client-side
  roleCodes: string[]; // e.g. ["sp_secretary"], ["dept_encoder"], etc.
  officeScopeId: string | null; // UUID of the office this role is scoped to
  officeCode: string | null; // e.g. "SP_SEC", for display in headers
  committeeIds: string[]; // Added explicitly per TASK-WF-FE-006 (see LOG-0085)
}

interface SessionState {
  identity: ActiveUserIdentity | null; // null = unauthenticated
  isHydrated: boolean; // true once the store has checked initial session
  isLocked: boolean; // true when session is locked due to inactivity
}

interface SessionActions {
  setIdentity: (identity: ActiveUserIdentity) => void;
  clearIdentity: () => void;
  setHydrated: () => void;
  setIsLocked: (locked: boolean) => void;
}

export const useSessionStore = create<SessionState & SessionActions>((set) => ({
  identity: null,
  isHydrated: false,
  isLocked: false,

  setIdentity: (identity) => set({ identity }),
  clearIdentity: () => set({ identity: null, isLocked: false }),
  setHydrated: () => set({ isHydrated: true }),
  setIsLocked: (locked) => set({ isLocked: locked }),
}));
```

Walking through every field and action:

- **`identity: ActiveUserIdentity | null`** — the decoded auth payload, or `null` if nobody's logged in. This is the one deliberate exception to the "no server counterpart" rule from section A — more on that below.
- **`isHydrated: boolean`** — starts `false`, flips to `true` exactly once, on app mount, after the initial "am I logged in?" check completes. Its whole reason for existing: route guards must not run before this is `true`, or every page load would briefly redirect an actually-logged-in user to `/login` before the check finishes — a "flash of unauthenticated" bug.
- **`isLocked: boolean`** — you'll trace this one fully in section D. It's `true` when the session has been forcibly locked (inactivity timeout, or a server-side 423 response), and it's the field that gates the lock screen you saw rendered in `AuthenticatedLayout.tsx`.
- **`setIdentity`**, **`clearIdentity`**, **`setHydrated`**, **`setIsLocked`** — one action per state transition. Note `clearIdentity` also resets `isLocked` to `false` in the same `set()` call — logging out clears the lock along with the identity, so a locked session doesn't survive into the next login.

That "one deliberate exception" for `identity` deserves unpacking, because it's the kind of thing that looks like it violates section A's rule until you look closer. `identity` *does* originate from the server — it's decoded from the login response. So why isn't it in TanStack Query? Because once decoded, ABAC route guards need to read it **synchronously**, with no network round-trip, on every route transition. TanStack Query's model is asynchronous by design — `data` starts `undefined` and arrives later. A guard that needs `hasRole(identity, 'sp_secretary')` to answer instantly, before the first paint, can't tolerate that. So `identity` isn't a *cache* of server state the way a document list is — it's the single decoded representation of the session, held in Zustand specifically because synchronous access is the requirement, not because it stopped being server-derived.

### The `roleCodes` shape decision (ADR-UI-012)

The `roleCodes: string[]` field looks unremarkable — a flat array of strings like `["sp_secretary"]`. But the shape it settled on was an actual decision point, recorded in ADR-UI-012, and it's worth understanding both what was chosen and what was rejected, because the reasoning generalizes past this one field.

The underlying role data in this system is not naturally flat. It exists as `RoleAssignmentSelectSchema[]` — a richer, normalized shape carrying role id, office scope, position, and more. The open question ADR-UI-012 resolved was how that richer shape should reach the frontend's session store:

- **Option A (chosen):** extend `AuthResponseSchema` so the *backend* computes and returns a flat `roleCodes: string[]` directly in the login response — a server-side `.map()` over the role assignments the backend already had to load to authenticate the user in the first place. One network round-trip, done.
- **Option B (rejected):** keep `AuthResponseSchema` as-is, and have the frontend make a *second* call after login (something like `iam.getMyRoles`) to resolve roles separately.

Why does the flat shape win? The ADR's own rationale is precise about the failure mode Option B would have introduced: a second call means there's a real window — however short — where `identity` is already set but `roleCodes` is still empty or stale. Any component calling `hasRole()` during that window gets a **false negative**: a user who genuinely has the `sp_secretary` role gets treated as if they don't, purely because of request timing, not because of anything actually wrong with their session. Worse, `isHydrated` would either have to fire before roles are known (reintroducing exactly the "flash of unauthorized" bug it exists to prevent) or the store would need a third state — `hydrated-but-roles-pending` — that every single ABAC-gated guard in the route map would then have to account for.

Option A sidesteps all of it: `roleCodes` arrives atomically, in the same response as everything else `identity` needs, computed by the backend from data it was already loading. No race window, no extra state, no second round-trip. The cost — extending one schema, once — is small, one-time, and paid entirely on the backend.

**A precise, honest note on where the real code has already diverged from this design:** the `session.store.ts` file above adds a field neither F2 nor ADR-UI-012 describes — `committeeIds: string[]`, with a comment reading `// Added explicitly per TASK-WF-FE-006 (see LOG-0085)`. This isn't a mistake or an unexplained drift; it's a documented fix. The project's findings log records `LOG-0085`: the frontend's identity shape had `roleCodes` and `officeScopeId` but nothing representing which *committees* a session's user belonged to, which meant a specific ABAC-adjacent UI decision (whether to show a committee-scoped control to an `sp_member`) couldn't be made client-side at all. `TASK-WF-FE-006` closed that gap by adding the field directly to the store. It's a small, clean illustration of something worth internalizing early: a design doc like F2 describes an intended shape at a point in time, but the actual store is allowed to evolve past it when a real, traceable need shows up — and a good deviation says so in a comment, the way this one does, rather than silently drifting.

## D. Calling a Store Outside of React — the `.getState()` Pattern

Everything so far has been a component calling `useSessionStore()` as a hook, inside a render. Now here's the pattern that makes Zustand more than "Context without the Provider ceremony": **a store's state and actions are also reachable from plain functions that aren't components at all**, without ever calling the hook or being inside a render.

The real, concrete case for this is sitting in `apps/web/src/lib/trpc.ts`. This file configures the tRPC client's HTTP transport, and it overrides the low-level `fetch` function that every tRPC call goes through:

```typescript
export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${import.meta.env.VITE_API_URL}/api/trpc`,
      async fetch(url, options) {
        const fetchOptions = { ...options, credentials: 'include' as const } as RequestInit;
        let response = await fetch(url, fetchOptions);

        // ... 401 handling omitted for brevity ...

        if (response.status === 423) {
          logger.error('session_locked', { url, traceId });
          useSessionStore.getState().setIsLocked(true);
          return new Response(
            JSON.stringify({
              error: { message: 'Session is locked', code: -32001, data: { code: 'UNAUTHORIZED', httpStatus: 401 } },
            }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return response;
      },
    }),
  ],
});
```

Stop and look at what kind of function `fetch` is here: it's `async fetch(url, options) { ... }`, defined as a plain object property inside `httpBatchLink({...})`. It is not a React component. It's not a hook. It's not called during a render — it's called by the tRPC/HTTP plumbing every time any request goes out. Nothing about its call site has any relationship to React's component tree.

And yet, on line `useSessionStore.getState().setIsLocked(true)`, it needs to trigger a UI-wide change: the moment the server responds with HTTP 423 (locked) on *any* request, every part of the app needs to know the session is locked *right now*, so the lock screen can render over whatever the user was doing. How does a bare async function, with no props, no context, and no idea what component tree is currently mounted, make that happen?

This is exactly what `.getState()` is for. `useSessionStore` — the same value you'd normally call as a hook — also carries a static `.getState()` method, available directly on the hook itself, that returns a plain snapshot of the store's current state *and* its actions, with no React involved at all. `useSessionStore.getState().setIsLocked` is the exact same `setIsLocked` function every component gets when they call the hook — it's just being reached through a different door. Calling `.setIsLocked(true)` on it updates the shared store state immediately, exactly as if a component had called it via the hook.

Once that call lands, the *hook* side of the store — every component currently subscribed via `useSessionStore((s) => s.isLocked)` — re-renders with the new value on its next tick, because it's genuinely the same underlying store. You already saw where that lands: back in `AuthenticatedLayout.tsx`,

```tsx
const isLocked = useSessionStore((s) => s.isLocked);
// ...
{isLocked && <SessionLockScreen />}
```

So the full path is: a plain async `fetch` override, running entirely outside React, calls `.getState().setIsLocked(true)` → the shared store updates → every component reading `isLocked` via the normal hook re-renders → `<SessionLockScreen />` appears, unconditionally, wherever the user happens to be in the app. No callback was threaded through any prop chain to make that happen. No component needed to know in advance that `trpc.ts` might someday need to talk to it.

This isn't a one-off either — `useAuthActions.ts` uses the identical pattern at both ends of the lock lifecycle: `useSessionStore.getState().setIsLocked(true)` when explicitly locking, and `useSessionStore.getState().setIsLocked(false)` when a successful unlock clears it. Same non-hook access, same reasoning: these are async functions responding to user actions or server responses, not components mid-render, and `.getState()` is how they reach shared state anyway.

This is the practical reason this pattern matters, stated plainly: **any plain JS/TS code — a fetch interceptor, an event listener, a WebSocket handler, a setTimeout callback — can read and mutate Zustand state without being, or being inside, a React component.** That's a capability React Context flatly does not offer; `useContext` only works inside components in the tree under the relevant Provider. Zustand's store being "just a hook" for components, while *also* being a plain JS object underneath that any function can reach via `.getState()`, is what makes this cross-boundary trigger possible at all.

## E. `shell.store.ts` and `ui.store.ts` — The Straightforward Ones

These two are much simpler, which is itself the point: most of what belongs in Zustand really is exactly this plain.

### `shell.store.ts`

```typescript
export const useShellStore = create<ShellState & ShellActions>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      sidebarCollapsed: false,
      activeNavItem: null,
      // ...
      toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      // ...
    }),
    {
      name: 'batac-dms:layout',
      version: 1,
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }) as any,
    },
  ),
);
```

`sidebarCollapsed` and `activeNavItem` are the textbook case from section A: neither has any meaning outside a browser tab. There's no `sidebar_collapsed` column in Postgres, and there never will be — it's not data, it's a rendering decision.

The one real consumer in the whole app is `AuthenticatedLayout.tsx`:

```tsx
const { sidebarCollapsed, toggleSidebar } = useShellStore();
// ...
<AppShell sidebarCollapsed={sidebarCollapsed} onSidebarToggle={toggleSidebar} ... >
  <Sidebar ... collapsed={sidebarCollapsed} onToggle={toggleSidebar} ... />
```

That's the full loop: read `sidebarCollapsed` out of the store, pass it down as a prop to control rendering; pass `toggleSidebar` down as the callback that writes back to the store when the user clicks. Nothing else in the codebase currently calls `useShellStore` — it's a small, single-purpose store with exactly one consumer.

**One precise, worth-flagging discrepancy:** the design docs' persistence table (F2 §16) specifies `sessionStorage` for `sidebarCollapsed`, and the `persist` config's comment even says `// Persist ONLY sidebarCollapsed, per F2 Persistence Rules` — but the actual `persist(...)` call above passes no `storage:` option at all. Zustand's `persist` middleware defaults to `localStorage` when `storage` isn't specified, so as written, this preference genuinely survives closing the browser entirely, not just the tab — a real difference from the documented intent, worth keeping in mind if you ever go looking for why a "session-scoped" preference outlived a session.

### `ui.store.ts`

This file is worth pausing on for a different reason: **it doesn't appear anywhere in F2's file structure.** F2 describes a stack-based `useModalStore` (a discriminated union of 17 named modal payloads, push/pop semantics) as one file, and a separate `useNotificationDrawerStore` as another. What's actually in the repo is neither of those — it's a single, flat `ui.store.ts` with independent boolean+ID pairs per surface:

```typescript
interface UIState {
  sheetOpen: boolean;
  sheetDocId: string | null;
  dialogOpen: boolean;
  dialogDocId: string | null;
  paletteOpen: boolean;
  idleWarningOpen: boolean;
  toast: ToastState;
  // ...
}
```

No stack, no discriminated union — just one flag per concern. That's a materially different implementation choice than F2 sketched, and it's worth registering rather than assuming the design doc and the code agree just because they're both real files in the same repo.

The field with a real, traceable consumer is `idleWarningOpen`. It's read and written in exactly the read-and-write loop you'd expect. `useIdleTimer.ts` is the *writer* — a background timer fires and calls `openIdleWarning()`:

```typescript
warningTimerRef.current = window.setTimeout(() => {
  openIdleWarning();
}, WARNING_AT_MS); // defaults to 25 minutes
```

`IdleWarningModal.tsx` is the *reader* — it subscribes to the same flag to control a Dialog:

```tsx
const idleWarningOpen = useUIStore((state) => state.idleWarningOpen);
const closeIdleWarning = useUIStore((state) => state.closeIdleWarning);
// ...
<Dialog open={idleWarningOpen} onOpenChange={(open) => { if (!open) closeIdleWarning(); }}>
```

Same loop as `shell.store.ts`: one place writes, another place reads and renders off the same value.

**Being precise about the rest of the file:** `sheetOpen`, `dialogOpen`, `paletteOpen`, and the `toast` actions (`showToast`/`dismissToast`) are all fully defined in `ui.store.ts`, but as of this snapshot of the codebase, none of them have any actual consumer anywhere in `apps/web/src` — no component reads or calls them. They're scaffolded, presumably for surfaces that haven't been wired up yet, not currently-active state. Worth knowing the difference between "defined in the store" and "actually driving something on screen" when you're reading a file like this cold.

## F. SSE and ADR-UI-015 — What's Documented vs. What's Actually There

The real-time notifications row in `tech-stack.md` reads: **Server-Sent Events (SSE) — "One-directional push; no WebSocket infrastructure needed."** SSE, in short, is a lightweight, HTTP-based mechanism for a server to push events *to* a client over a single long-lived connection, one direction only — the browser never needs to send anything back over that connection, which is why it needs no WebSocket handshake or infra. In this project, it's what's meant to deliver notification events (a document routed to you, a step assigned to you, and so on) to a connected client in near-real-time.

ADR-UI-015 documents a specific, careful reconnection strategy for this, because an SSE connection can and will drop — network blips, laptop sleep/wake, a server restart. The decision has two layers:

1. **Primary: native `EventSource` replay.** The browser's built-in `EventSource` API — the standard way to consume SSE — already auto-reconnects on its own. If the server includes an `id:` field on every emitted event, `EventSource` automatically sends that last-seen id back as a `Last-Event-ID` header on reconnect, and a server that honors it can resume from exactly where the client left off, rather than only emitting events going forward. No custom client-side reconnect logic is needed for this — it's native browser behavior, paired with a small server-side addition.
2. **Backstop: unconditional refetch on drawer open.** Independent of whether replay actually worked in a given case, whenever the notification drawer is opened, a fresh `notifications.listMine` TanStack Query fetch runs regardless. The ADR is explicit that the ephemeral `newArrivalCount` badge is treated purely as a *hint*, never as a source of truth — the drawer's real list is always correct on open because it re-fetches from the server directly, independent of whatever the SSE connection did or didn't deliver in the meantime.
3. **Explicitly rejected: a continuous background poll.** A poll running every N seconds "just in case," for every connected session, was considered and turned down — the failure mode being guarded against (a badge undercounting by a few until the next event or drawer open) is cosmetic, not data loss, and doesn't justify constant server load for the entire user base.

Now, the honest part, and it's exactly the kind of check worth doing rather than assuming: **does this reconnection logic actually live in one of the four real store files, just because ADR-UI-015 happens to be filed under the "Zustand store design" folder?**

It doesn't. A repo-wide search across `apps/web/src` for `EventSource`, any SSE-named file, and `Last-Event-ID` handling returns nothing at all. There's no notification-drawer store in the real codebase (recall from section E — `ui.store.ts` has no `newArrivalCount` or `lastIncomingEvent` field of any kind), and there's no separate SSE hook file either. As far as this snapshot of the repository goes, the reconnection strategy ADR-UI-015 carefully specifies doesn't appear to be built yet, anywhere — not in a store, not in a hook, not in a component.

That's not actually a contradiction of the ADR, if you reread its own "Consequences" section closely — it states plainly that `useNotificationDrawerStore` (the store F2 imagined for this) "requires no shape change," and that the drawer-open refetch backstop is explicitly "a component/hook-level concern... not a store concern." The ADR was never claiming this logic *belongs* in a store file to begin with — it was scoping the decision correctly even before any code existed. What you're seeing here is simply that the corresponding store, hook, and wiring haven't landed in the codebase yet, which is worth knowing plainly rather than assuming a document living in a folder means the thing it describes is built.

## G. Zustand vs. TanStack Query — A Decision Checklist for Your Own Work

When you're about to add a new piece of state to this app and you're not sure where it belongs, run it through these in order:

1. **Does it have a row somewhere in Postgres, even indirectly?** If yes → TanStack Query. If the concept could be answered by a SQL query, it's server state, full stop — even if it feels small (a boolean column is still server state).
2. **Would it survive a page refresh, and *should* it?** Server state survives a refresh by definition — you just refetch it. If a value resets to some default on refresh and that's *correct behavior*, not a bug, that's a strong signal it's client state (an open modal, a scanner overlay, an unsaved form draft that hasn't hit `sessionStorage`).
3. **Does a route guard or synchronous check need to read it before any network round-trip could possibly complete?** This is the identity exception from section C — data that's server-sourced but needs synchronous access belongs in Zustand precisely because TanStack Query's async model can't serve that requirement, not because it stopped being "real" data.
4. **Does something outside a React component — a fetch interceptor, an event listener, a timer — need to read or set it?** If yes, Zustand's `.getState()` is doing real work you can't easily replicate with TanStack Query or Context; section D's `trpc.ts` example is the reference case.
5. **Is it a UI-only concern — open/closed, current step index, which sub-panel is active, upload-progress percentage?** Straight into Zustand, and it's fine for it to be as flat and boring as `ui.store.ts`'s boolean pairs. You don't need a stack or a discriminated union unless you actually have the complexity that justifies one — this repo's own real `ui.store.ts` chose *not* to build what F2 sketched, and that was a legitimate call, not a shortcut.
6. **If you're staging several changes before one batched submit** (the Order-of-Business pattern from F2 §13, even though it's not one of the four files here) — that buffer of *pending, not-yet-committed* changes is client state until the moment it's actually sent; the server has no idea any of it exists until then.

And the one-line version to keep taped above your monitor: **if Postgres has never heard of it, it's Zustand's; if Postgres is the source of truth for it, it's TanStack Query's — and the only exception is data that needs synchronous, pre-network access, which still gets fetched by TanStack Query mechanisms elsewhere and merely gets *mirrored* into Zustand for that one purpose.**

---

# Chapter 1.7 — The Event Bus: How Modules Talk Without Touching Each Other

Everything up to this chapter has been about a single module's own internals — how it validates, stores, and serves its own data. This chapter is about the wiring *between* modules. And unlike Fastify, Zod, or Drizzle, there is no npm package to look up here. The event bus is genuinely hand-rolled — a `EventBus` class living in `/packages/shared/src/event-bus.ts`, 135 lines, written by this project's own team for this project's own needs. There's no external documentation to link you to. This chapter *is* the documentation, built entirely from reading the real source, the architecture decision records that justify its design, and the catalog that governs what flows through it.

---

## A. The Problem: How Does Audit Find Out Without Querying Another Module's Tables?

The root `README.md` states the project's architecture in five numbered, non-negotiable rules. The first two matter most here:

> ```
> 1. Each module owns its own PostgreSQL schema. No cross-schema foreign keys.
> 2. Modules talk to each other only through the event bus or a published module API — never by reaching into another module's tables directly.
> ```

This project is what's called a **modular monolith**: multiple logical modules — `iam`, `organization`, `documents`, `workflow`, `tracking`, `audit`, and more still to come — but all of them deployed as *one process*, from *one codebase*, at runtime. This is a deliberate contrast with **microservices**, where each of those modules would instead be its own independently-deployed service, talking over a network. A modular monolith gets you most of the organizational benefit of separated modules (clear boundaries, independent reasoning, testable units) without the operational cost of running and coordinating a dozen separate deployments — which matters a great deal for a platform meant to run on-premise, on a government VPS, for a ten-plus-year lifespan, without a dedicated platform-engineering team to babysit a service mesh.

But "one process" creates an obvious temptation: if `documents` and `audit` are just two folders in the same running Node process, sharing the same PostgreSQL connection pool underneath, what's stopping the audit module from just running `SELECT * FROM documents.documents WHERE ...` directly? Nothing, technically — the database driver doesn't care which module's code issued the query. Rule 1 (each module owns its own schema, no cross-schema foreign keys) makes that *harder*, but rule 2 is the one that makes it *forbidden*: modules are only allowed to learn about each other through the event bus, or through a module's own published API — never by reaching into another module's tables.

So here's the concrete question this chapter answers: **when the Documents module creates a new document, how does Audit find out?** It didn't call anything on Audit. It isn't allowed to query Audit's tables, or the reverse. And yet — as you'll see directly in section F — a tamper-evident audit log entry does get written, every time. The event bus is the entire answer to that question.

ADR-API-001 (the decision record that settled *how* to build this mechanism) frames the same idea slightly differently, and is worth quoting because it names the actual candidates that were considered and rejected:

> The two candidate approaches considered:
> 1. **Typed wrapper around Node's built-in `EventEmitter`.** No new runtime dependency. Requires a thin typing layer on top since `EventEmitter` itself is untyped.
> 2. **A minimal third-party typed pub/sub library** (e.g. `mitt`, `eventemitter3`, or similar). Slightly more ergonomic typing out of the box, at the cost of an added dependency to vet, pin, and keep patched for the lifetime of a 10+ year deployment.

The decision: **build the typed wrapper yourself, on top of Node's own built-in `EventEmitter`.** If you haven't used it directly before, `EventEmitter` is a class built into Node.js (`import EventEmitter from 'node:events'`) that implements the most basic possible publish/subscribe pattern: you call `.on(name, handler)` to register interest in something, and `.emit(name, data)` to fire it — every registered handler for that name gets called, synchronously, with whatever you passed. It has existed in Node since the beginning and underlies huge parts of Node's own standard library (streams, HTTP servers, and so on). But it is **completely untyped** — `emitter.on('anything', (whatever) => {})` compiles no matter what string or handler shape you pass. Zero new runtime dependencies, but zero compile-time safety either. Everything in this chapter is about the layer this project built *on top of* that primitive to fix exactly that gap — without reaching for a third-party library to do it.

---

## B. The Real `event-bus.ts`, Layer by Layer

The class's own docblock states its job in one place, and it's worth reading before the code itself, since every line below exists to deliver on exactly this:

> ```
> * EventBus — typed in-process domain event bus.
> *
> * INFRA-owned singleton. Wraps Node's built-in EventEmitter with:
> *   - Full TypeScript type safety: emit/on are constrained to EventPayloadMap keys.
> *   - Per-handler isolation: a throwing subscriber never propagates to the emitter.
> *   - Dead-letter routing: failed handlers produce a row in shared.event_bus_dead_letters.
> *   - Pino error logging per failing handler.
> ```

Three things layered on top of `EventEmitter`. Let's take them one at a time, against the real code.

### B.1 — Full Type Safety via `EventPayloadMap`

```typescript
on<K extends keyof EventPayloadMap>(
  eventType: K,
  handler: (envelope: DomainEvent<EventPayloadMap[K]>) => void | Promise<void>,
  moduleName: string,
): void {
  this.moduleNames.set(handler as AnyHandler, moduleName);
  this.emitter.on(eventType as string, handler as AnyHandler);
}
```

```typescript
emit<K extends keyof EventPayloadMap>(
  eventType: K,
  envelope: DomainEvent<EventPayloadMap[K]>,
): void {
  // ...
}
```

This is genuinely elegant, and worth slowing down on if you haven't seen this exact TypeScript pattern before. `K extends keyof EventPayloadMap` is a **generic constraint**: it says "whatever type `K` ends up being, it must be one of the keys of `EventPayloadMap`" — the master type registry you'll read in full in section E. Because `eventType: K` appears as a parameter, TypeScript infers `K` from whatever string literal you actually pass at the call site. If you write:

```typescript
bus.emit('document.created', envelope);
```

TypeScript infers `K = 'document.created'`, checks that this is genuinely a key of `EventPayloadMap` (it is), and then — this is the payoff — uses `EventPayloadMap[K]` (i.e., `EventPayloadMap['document.created']`) to determine exactly what shape `envelope.payload` is required to have. If you instead wrote:

```typescript
bus.emit('document.craeted', envelope); // typo
```

`'document.craeted'` is not a key of `EventPayloadMap`. This is not a "might fail at runtime" situation — **it will not compile.** TypeScript rejects the call before you ever run the code. The same protection applies to `.on()`: subscribing to an event name that doesn't exist in the map is a compile error, and subscribing to a real event name with a handler whose `envelope.payload` type doesn't match what that event actually carries is *also* a compile error. This is the entire point of ADR-API-001's implementation requirement #2 — "This makes an attempt to emit or subscribe to an unregistered `eventType`, or with a mismatched payload shape, a compile-time error rather than a runtime surprise" — made concrete in eleven lines of generic method signatures.

### B.2 — Per-Handler Isolation: If Handler A Throws, Does Handler B Still Run?

This is the part of the file most worth reading character by character, because it's answering a genuinely important operational question: if the Documents module emits an event, and one of the three subscribers to that event has a bug, does that bug take down Documents' own request? Does it take down the *other* two subscribers?

Here is `emit()` in full:

```typescript
emit<K extends keyof EventPayloadMap>(
  eventType: K,
  envelope: DomainEvent<EventPayloadMap[K]>,
): void {
  const listeners = this.emitter.rawListeners(eventType as string) as AnyHandler[];

  for (const handler of listeners) {
    const mod = this.moduleNames.get(handler) ?? 'unknown';
    try {
      const result = handler(envelope as DomainEvent<unknown>);
      if (result instanceof Promise) {
        result.catch((err: unknown) =>
          this.onHandlerFailure(envelope as DomainEvent<unknown>, mod, err),
        );
      }
    } catch (err) {
      this.onHandlerFailure(envelope as DomainEvent<unknown>, mod, err);
    }
  }
}
```

Notice what this method does *not* do: it does not call `this.emitter.emit(...)`. If it did, it would be handing control straight to Node's own `EventEmitter`, which invokes every registered handler in one internal loop, and — crucially — if any one handler throws synchronously, that exception propagates straight back up to whoever called `.emit()` in the first place, and every handler *after* the one that threw simply never runs. That's the built-in, default behavior of the primitive this class is wrapping, and it's exactly the failure mode this class exists to prevent.

Instead, `emit()` grabs the raw list of registered handlers via `this.emitter.rawListeners(...)`, and manually loops over them itself, one at a time, in a plain `for` loop. Each iteration of that loop wraps its call to `handler(envelope)` in its **own, independent** `try`/`catch`. Walk through what this buys you:

- **If `handler` throws synchronously** — a plain `throw new Error(...)` inside the handler body — the surrounding `catch (err)` on line "catches" it, right there, for *that specific handler only*. The `for` loop then simply continues to its next iteration and calls the *next* handler, completely unaffected.
- **If `handler` is `async` and its returned Promise rejects** — this is a different code path in JavaScript, because a rejected Promise doesn't throw synchronously; it fails later, asynchronously. The code checks `if (result instanceof Promise)` and attaches a `.catch(...)` directly onto that specific handler's returned Promise. If it rejects, that `.catch` fires — again, scoped to only that one handler's Promise — and the loop has already long since moved on to calling the next handler regardless.

Either way — thrown synchronously, or rejected asynchronously — the failure lands in the same place: `this.onHandlerFailure(envelope, mod, err)`. And critically, **`emit()` itself never re-throws, and never returns a rejected Promise of its own.** Its own return type is `void`. The method that emitted the event has no way to observe that a subscriber failed at all, by design — which is exactly the guarantee ADR-API-001 describes: *"The emitting module's call to `emit()` always resolves successfully once all handlers have been attempted, regardless of individual handler outcomes."* A bug in a `notifications` subscriber, three modules downstream of where an event was fired, can never crash the Documents module's own write path. That's the whole point of "per-handler isolation," made concrete: not one shared try/catch around the whole batch, but one distinct try/catch *per handler*, inside a manual loop that deliberately bypasses `EventEmitter`'s own all-or-nothing `.emit()`.

### B.3 — Dead-Letter Routing: What Happens to a Failed Handler's Event?

A failure that's silently swallowed is still a failure — just an invisible one. This is where `onHandlerFailure` comes in, and it's the method every failure path above ultimately calls:

```typescript
private onHandlerFailure(envelope: DomainEvent<unknown>, moduleName: string, err: unknown): void {
  this.logger.error(
    { err, eventId: envelope.eventId, eventType: envelope.eventType, moduleName },
    '[event-bus] subscriber failure — routing to dead-letter table',
  );

  // ADR-API-001 §4: "priority alert" for the Audit module handler specifically.
  // Sentry SDK is a stub in Phase 1; the call site is preserved for Phase 2 wiring.
  if (moduleName === 'audit') {
    // Sentry.captureException(err, { extra: { envelope, moduleName } });
  }

  // Fire-and-forget dead-letter insert. If the write itself fails, log and move on —
  // the emitter must not block or throw under any circumstances.
  void this.deadLetterRepo
    .insert({
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      payload: envelope.payload as Record<string, unknown>,
      failedModule: moduleName,
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    .catch((dlErr: unknown) =>
      this.logger.error(
        { dlErr, envelope },
        '[event-bus] dead-letter write also failed — event permanently unrecoverable',
      ),
    );
}
```

Two things happen here, every time any handler fails, for any reason. First: a structured Pino error log line, with the exact message `'[event-bus] subscriber failure — routing to dead-letter table'` — you'll come back to this exact string in the next section. Second: the failure is written as a permanent row via `this.deadLetterRepo.insert(...)` — not "logged and forgotten," but persisted, so a human or a retry job can act on it later. Notice the call is fire-and-forget (`void ... .catch(...)`, not `await`ed) — this method itself is synchronous and must never block the caller, which is consistent with `emit()`'s own contract of never blocking or throwing back to the emitting module. And notice the code is honest about its own worst case: if the dead-letter *write itself* fails, that gets logged too, with a distinctly more alarming message — `'[event-bus] dead-letter write also failed — event permanently unrecoverable'` — rather than assuming the safety net can't itself fail.

One honest, precise note on the Audit branch: the `if (moduleName === 'audit')` check is real and does run, but the actual Sentry call inside it is commented out. The comment explains why plainly — "Sentry SDK is a stub in Phase 1; the call site is preserved for Phase 2 wiring." So as of right now, an Audit-handler failure gets exactly the same logging and dead-letter treatment as any other module's failure; the *scaffolding* for treating it as a distinct, higher-priority alert exists and is deliberately placed, but it isn't live yet. Worth knowing precisely, rather than assuming the "priority alert" language from the ADR describes current runtime behavior.

---

## C. The `moduleNames` Map: Whose Handler Just Failed?

You've now seen `moduleNames` referenced twice above — once when a handler is registered, once when one fails. Here's the field itself, with its own comment:

```typescript
/**
 * Tracks the registering module name for each handler so the dead-letter row
 * can record which module failed. Module names are caller-supplied strings
 * (e.g. 'audit', 'notifications') — they are not validated against an enum in
 * Phase 1 because the set of modules is still growing.
 */
private readonly moduleNames = new Map<AnyHandler, string>();
```

It's a `Map` whose *keys* are handler functions themselves, and whose *values* are plain strings — the module name that registered that handler. Look back at `.on()`:

```typescript
on<K extends keyof EventPayloadMap>(
  eventType: K,
  handler: (envelope: DomainEvent<EventPayloadMap[K]>) => void | Promise<void>,
  moduleName: string,
): void {
  this.moduleNames.set(handler as AnyHandler, moduleName);
  this.emitter.on(eventType as string, handler as AnyHandler);
}
```

`.on()` doesn't just take an event type and a handler — it takes a third, required `moduleName` argument, a plain caller-supplied string like `'audit'` or `'workflow'`. That string gets stored in the `Map`, keyed by the handler function reference itself, *before* the handler is registered on the underlying `EventEmitter`.

Why does this matter? Look at `emit()` again — specifically this one line inside the loop:

```typescript
const mod = this.moduleNames.get(handler) ?? 'unknown';
```

When a handler fails, `emit()` needs to know *whose* handler it was, so that the dead-letter row and the log line can say something more useful than "some handler somewhere failed." Since the `EventBus` doesn't otherwise have any concept of "which module owns this function" — a plain JavaScript function has no built-in name-of-its-registering-module property — `moduleNames` is the bridge: given the handler function that just threw, look up which module registered it. That's exactly why `onHandlerFailure`'s log line looks like this:

```typescript
this.logger.error(
  { err, eventId: envelope.eventId, eventType: envelope.eventType, moduleName },
  '[event-bus] subscriber failure — routing to dead-letter table',
);
```

`moduleName` in that structured log object is the exact string that came out of the `moduleNames.get(handler)` lookup a few lines earlier. So when this line actually appears in production logs, it isn't just "a subscriber failed" — it's a structured record that says precisely which event (`eventType`, `eventId`) failed in which module's (`moduleName`) handler, with the underlying `err` attached. That's the entire reason this Map exists: to make `'[event-bus] subscriber failure — routing to dead-letter table'` an actionable log line rather than an anonymous one, and to make the dead-letter table's `failedModule` column meaningful when someone queries it later.

---

## D. `IDeadLetterRepository`: Depending on an Interface, Not a Database

Look again at the `EventBus` constructor:

```typescript
constructor(
  private readonly logger: IEventBusLogger,
  private readonly deadLetterRepo: IDeadLetterRepository,
) {
  this.emitter.setMaxListeners(50);
}
```

`deadLetterRepo` is typed as `IDeadLetterRepository` — an **interface**, imported from `./dead-letter-repository.interface.js`, not a concrete class. This is a real, deliberate application of **dependency inversion**: the `EventBus` class (the "high-level" piece of logic — deciding *when* and *what* to persist on failure) depends only on an abstract contract, and has no idea what actually implements that contract underneath. It could be a real PostgreSQL-backed repository. It could be an in-memory fake used in a test. `EventBus` doesn't care, and its own source code contains zero imports from Drizzle, `postgres`, or any database-specific package.

ADR-INFRA-023-01 records exactly why this interface exists, and — worth being precise about — its primary stated motivation is not really about testability first; it's about **monorepo layering.** The problem it describes:

> The TASK-INFRA-023 specification shows `EventBus` (in `/packages/shared/src/event-bus.ts`) importing `DeadLetterRepository` directly from `../../apps/server/src/infra/dead-letter.repository`. This creates a `packages/shared → apps/server` dependency direction, which violates the standard monorepo layering rule: **packages may not depend on app code.**
>
> If `packages/shared` imported from `apps/server`, any consumer of `@batac/shared` would transitively pull in the Fastify server's concrete infrastructure classes — including their own dependencies (drizzle-orm, postgres, etc.) — into contexts that have no need for them (e.g. frontend packages, test harnesses, or a future standalone CLI).

In other words: `packages/shared` is meant to be importable from *anywhere* in this monorepo — the `/web` frontend, a future CLI, test harnesses — with zero assumption that a real Postgres connection or Fastify instance exists. If `EventBus` imported the concrete `DeadLetterRepository` class directly, then importing `@batac/shared` from the frontend would transitively drag in Drizzle and `postgres` — packages the frontend has no business depending on at all. The fix: define `IDeadLetterRepository` *in* `packages/shared`, have `EventBus` depend only on that, and let the concrete class — which genuinely does need Drizzle — live in `apps/server`, where it's allowed to have that dependency:

```typescript
// Fastify bootstrap:
const deadLetterRepo = new DeadLetterRepository(db);
const bus = new EventBus(logger, deadLetterRepo);
```

The concrete class is only ever constructed at the one place that's allowed to know about databases — Fastify's own startup sequence — and handed to `EventBus` as an already-built object satisfying the interface. `EventBus` never imports it by name.

The ADR does also name the testability benefit your prompt guessed at, just as a secondary, additional positive rather than the main driver: *"The interface contract is explicit and testable — any test can provide a mock `IDeadLetterRepository` to the `EventBus` without standing up a database."* Both things are true and both are real, stated benefits — it's just worth being precise that the ADR's *primary* problem being solved is the dependency-direction violation, with easier testing as a welcome, secondary consequence of the same fix.

You can see the real interface, confirmed directly against the file:

```typescript
// /packages/shared/src/dead-letter-repository.interface.ts
export interface IDeadLetterRepository {
  insert(row: {
    eventId: string; eventType: string; payload: Record<string, unknown>;
    failedModule: string; errorMessage: string;
  }): Promise<void>;
  fetchPending(opts: { maxRetries: number }): Promise<PendingDeadLetter[]>;
  markRetried(id: string): Promise<void>;
  incrementRetry(id: string, backoffSeconds: number): Promise<void>;
  markExhausted(id: string): Promise<void>;
}
```

And the concrete implementation — `apps/server/src/infrastructure/dead-letter.repository.ts` — genuinely `implements` it, with real Drizzle queries against a real `shared.event_bus_dead_letters` table:

```typescript
export class DeadLetterRepository implements IDeadLetterRepository {
  constructor(private readonly db: AppDb) {}

  async insert(row: { /* ... */ }): Promise<void> {
    await this.db.insert(eventBusDeadLetters).values({ /* ... */ });
  }
  // fetchPending, markRetried, incrementRetry, markExhausted follow, each
  // backed by a real Drizzle query against shared.event_bus_dead_letters
}
```

This is a clean, textbook instance of the pattern: an abstraction defined where it's shared, a concrete implementation where the real dependencies live, and the two wired together at exactly one point — application startup — which you can see for yourself in `event-bus.plugin.ts`:

```typescript
async function eventBusPlugin(fastify: FastifyInstance): Promise<void> {
  const deadLetterRepo = new DeadLetterRepository(fastify.db);
  // fastify.log is typed as FastifyBaseLogger, which matches IEventBusLogger structurally.
  const eventBus = new EventBus(fastify.log, deadLetterRepo);

  fastify.decorate('eventBus', eventBus);
}
```

This is the one moment where the abstract `EventBus` class becomes a real, running object — constructed with Fastify's own Pino logger (which happens to already satisfy `IEventBusLogger`'s shape, per the comment) and a genuinely Drizzle-backed `deadLetterRepo` — and decorated onto the Fastify instance as `fastify.eventBus`, exactly once, for every module to share for the app's entire lifetime.

---

## E. `EventPayloadMap`: The Master Type Registry — and Where It Genuinely Drifts From the Catalog

Every event name and payload shape this system recognizes lives in one file: `/packages/shared/src/events/event-payload-map.ts`. ADR-API-001 states the enforcement mechanism this file exists to provide: *"Every new `eventType` added to the Master Event Bus Registry in B2 must have a corresponding entry added to `EventPayloadMap` in the same PR, or the build fails at compile time."* This file is the reason "did we register this new event type correctly" is a compiler question, not a code-review hope.

But this file is also a genuinely useful lesson in reading real code skeptically rather than trusting its own comments blindly — because its docblock is, itself, out of date:

> ```
> * EventPayloadMap — Phase 1 Master Event Bus Registry
> *
> * 18 typed entries covering all domain events confirmed in B2 §"Master Event
> * Bus Registry".
> ```

Counting the actual keys inside the `EventPayloadMap` interface directly — not trusting the comment — gives **36**, exactly double what the docblock claims. This is a harmless drift (a stale comment, not a type error — TypeScript doesn't check comments), but it's exactly the kind of thing worth verifying rather than citing on faith, and a good first small example of "documentation and code can quietly diverge even inside one single file."

The more substantial drift is worth walking through carefully, because it connects directly to something the catalog itself already flags. Recall from b3's own §0 ("Naming Discrepancies — Resolve Before Implementation") that three source documents historically used different names for the same events, and the catalog exists specifically to reconcile them into one canonical set — for example, ratifying `workflow.step.started` (B4's dot-notation name) over `workflow.step_assigned` (B2's underscore name), and `document.created` over an even older `document.logged`. That reconciliation is *already resolved*, on paper, in b3 v1.3.

What the real `EventPayloadMap` shows, though, is that **both the old and new names are present simultaneously, as separate, live map entries**:

```typescript
'workflow.step_assigned': Stub;
'workflow.step_completed': WorkflowStepCompletedPayload;
'workflow.step.started': WorkflowStepStartedPayload;
// ...
'workflow.step.completed': {
  instanceId: string; stepInstanceId: string; stepId: string;
  stepType: string; outcome: string; comment: string | null;
};
```

This isn't a case of the code failing to catch up with a documented rename — it's a case of the code carrying *both* the pre-reconciliation name and the post-reconciliation name as independently typed, independently usable keys, with genuinely different payload shapes attached to each (`WorkflowStepCompletedPayload`, defined earlier in the same file with fields `documentId`, `instanceId`, `stepId`, `stepType`, `fromOfficeId`, `toOfficeId`, `actorId`, `actionDescription`, `cityId`, is a materially different shape from the inline object type given to `'workflow.step.completed'`). And this isn't theoretical — you already read `audit.event-consumer.ts` subscribing specifically to `'workflow.step_assigned'` and `'workflow.step_completed'` (the old names), while — as you'll see directly in the next section — real emitters elsewhere in `workflow.router.ts` are calling `emit('workflow.step.completed', ...)` (the new name). Both names are live, typed, and in active use at different call sites in the same running system.

There's a second, sharper piece of drift worth reporting plainly, since it's directly checkable against a real emit call site rather than just a map entry. b3 §7.22 documents this event, fully reconciled, as:

> `workflow.panlalawigan.deemed_approved` — **Emitter:** `workflow` — **Consumers:** `notifications` · `audit` — payload: `stepInstanceId`, `legalBasis`, `transmissionDate`, `deadlineWas`.

The actual `EventPayloadMap`, however, contains no `workflow.panlalawigan.deemed_approved` key at all. What it *does* contain is:

```typescript
'document.panlalawigan.deemed_approved': {
  documentId: string;
  transmittedAt: Date;
  cityId: string;
};
```

Different prefix (`document.`, not `workflow.`), and a different payload shape entirely. And this is genuinely, verifiably backed by a real call site — `documents.plugin.ts`'s scheduled `pg-boss` job emits exactly this:

```typescript
fastify.eventBus.emit('document.panlalawigan.deemed_approved', {
  eventId: crypto.randomUUID(),
  eventType: 'document.panlalawigan.deemed_approved',
  occurredAt: now.toISOString(),
  cityId: review.cityId,
  schemaVersion: 1,
  payload: {
    documentId: review.documentId,
    transmittedAt: review.transmittedAt!,
    cityId: review.cityId,
  },
});
```

Meanwhile, there's a *second*, entirely separate real mechanism for what appears to be the same underlying legal event (the Panlalawigan 30-day statutory deadline), inside the `workflow` module's own scheduled job (`evaluate-panlalawigan-timers.ts`), which writes to workflow's own internal event-history table using the catalog's canonical name and exact documented payload shape:

```typescript
await deps.workflowRepository.createWorkflowEvent({
  instanceId: instance.id,
  eventType: 'workflow.panlalawigan.deemed_approved',
  actorType: 'scheduler',
  actorId: null,
  payload: {
    stepInstanceId: stepInstance.id,
    legalBasis: 'RA 7160 Section 56(d)',
    transmissionDate: context['panlalawigan_transmission_date'],
    deadlineWas: deadlineStr,
  },
}, tx);
```

This second call is worth being precise about: it's a write to workflow's own internal history table via `workflowRepository`, **not** a call to `fastify.eventBus.emit(...)` at all. So the honest, complete finding is: there appear to be two independently built mechanisms for the same 30-day statutory deadline, using two different names, on two structurally different code paths — and of the two, only the `documents`-module one (`document.panlalawigan.deemed_approved`) is actually wired onto the shared `EventBus`/`EventPayloadMap` that other modules can subscribe to. The catalog's fully-specified, canonical version of this event, under its documented name, does not currently appear to reach the bus at all.

The lesson to take from this, as someone learning to read a real, evolving codebase rather than a textbook example: a well-governed type registry and a careful, self-correcting documentation catalog are both genuinely valuable — but neither one is a guarantee that every real call site has been reconciled against the other yet. Trusting the compiler to catch typos in event names (section B.1) is a real, strong guarantee. Trusting that the *name itself* is the one the documentation settled on is a separate question, and — as shown here — one worth actually checking rather than assuming.

---

## F. Watching One Real Event Flow End to End: `document.created`

Time to watch this actually happen, using a genuinely real, clean example. Section A asked: when Documents creates a new document, how does Audit find out? Here's the complete, real answer, traced through the actual files.

**The emission.** Inside `documents.router.ts`'s `documents.submit` tRPC procedure — after the document's ABAC permissions are checked, a QR tracking number and preliminary series number are assigned, and the document's lifecycle state is transitioned to `'submitted'` — the very last thing that happens before the procedure returns is:

```typescript
// Emit document.created event per acceptance criteria
ctx.req.server.eventBus.emit('document.created', {
  eventId: crypto.randomUUID(),
  eventType: 'document.created',
  occurredAt: new Date().toISOString(),
  cityId: document.cityId,
  schemaVersion: 1,
  payload: {
    documentId: document.id,
    documentTypeId: document.documentTypeId,
    ownedByOfficeId: document.ownedByOfficeId,
    actorId: subject.userId,
    cityId: document.cityId,
  },
});
```

`ctx.req.server` is the Fastify instance itself (tRPC's `createContext` hands the request handler access to it), and `.eventBus` is exactly the decorated singleton you saw constructed in section D. This call fully builds the envelope by hand — a fresh `eventId`, the current timestamp as `occurredAt`, the document's `cityId`, `schemaVersion: 1` — matching the envelope shape from `DomainEvent<TPayload>` exactly. The `payload` object's shape — `documentId`, `documentTypeId`, `ownedByOfficeId`, `actorId`, `cityId` — matches `DocumentCreatedPayload` in `EventPayloadMap` exactly, which is precisely what makes this call compile at all under the `K extends keyof EventPayloadMap` constraint from section B.1.

At the moment this line executes, `.emit()` runs its per-handler loop (section B.2) against every function currently registered for `'document.created'`. There are, per b3's Master Event Registry, three: `tracking`, `workflow`, and `audit`. You've now read the real registration code for two of them.

**Subscriber one: `workflow`.** Inside `workflow.plugin.ts`, registered at Fastify startup:

```typescript
fastify.eventBus.on(
  'document.created',
  (event) => {
    const run = async () => {
      const activeDef = await workflowRepository.getActiveDefinitionForDocumentType(
        event.payload.documentTypeId,
      );
      if (!activeDef) {
        fastify.log.info(
          { documentId: event.payload.documentId },
          'No active workflow definition found; skipping instance creation.',
        );
        return;
      }
      // ...proceeds to create a workflow instance for this document
```

Workflow reacts to the exact same event by looking up whether this document's *type* has an active workflow definition, and — if one exists — creating a brand-new workflow instance for it. Documents never called Workflow directly. Workflow simply subscribed to something it cares about.

**Subscriber two: `audit`.** Inside `audit.event-consumer.ts`, registered at the same startup sequence, via a small factory function (`makeHandler`) that's called once per event type this consumer cares about:

```typescript
function makeHandler<K extends keyof EventPayloadMap>(
  eventType: K,
  toInput: (envelope: DomainEvent<EventPayloadMap[K]>) => AuditEventInput,
) {
  bus.on(
    eventType,
    async (envelope) => {
      try {
        await writeService.writeEvent(toInput(envelope));
      } catch (err) {
        logger.error(
          { err, envelope, eventType },
          '[audit] Failed to write audit event — routing to dead-letter',
        );
        throw err; // re-throw so EventBus dead-letter routing fires
      }
    },
    'audit',
  );
}

// ...
makeHandler('document.created', (e) => ({
  eventType: 'document.created',
  actorId: getString(e.payload, 'creatorId', 'actorId'),
  targetId: getString(e.payload, 'documentId'),
  targetType: 'document',
  resourceOfficeId: getString(e.payload, 'officeId'),
  payload: e.payload as unknown as Record<string, unknown>,
  cityId: e.cityId,
}));
```

This registers `'audit'` as the third argument to `bus.on(...)` — precisely the string that gets stored in the `moduleNames` Map from section C. The handler converts the incoming `document.created` envelope into a generic `AuditEventInput` shape (`actorId`, `targetId`, `targetType`, `resourceOfficeId`, the raw `payload`, `cityId`) and calls `writeService.writeEvent(...)` — which, per `AuditWriteService`'s own documented contract, performs a genuinely transactional write: it generates a UUID and timestamp, computes a SHA-256 hash chained against the previous row (under a `FOR UPDATE` lock to serialize concurrent writers), signs it with HMAC, and `INSERT`s a brand-new, tamper-evident row. No `UPDATE`, no `DELETE` — ever, from this path.

One precise, small detail worth noticing: the handler's `toInput` function reads `getString(e.payload, 'creatorId', 'actorId')` — trying a field called `creatorId` first, falling back to `actorId`. The real emitted payload only ever has `actorId`, never `creatorId` — so this resolves correctly via the fallback every time, it's just leaning on a fallback for a primary key name that, in practice, is never actually the one present.

And notice, too, the `try`/`catch` *inside* this handler, ending in `throw err;`. This is a second, deliberate layer on top of everything `EventBus.emit()` already does for you: the audit consumer catches its own failure first, purely to log it with audit-specific context and a distinct message (`'[audit] Failed to write audit event — routing to dead-letter'`), and then re-throws on purpose — the comment says exactly why: *"re-throw so EventBus dead-letter routing fires."* If it swallowed the error here instead, `EventBus`'s own `onHandlerFailure` (section B.3) would never see it, and no dead-letter row would ever get written for a failed audit write specifically. Re-throwing hands the failure back up to the exact mechanism designed to catch it.

That's the whole path, real and complete: one `emit()` call, inside one tRPC mutation, in one module — fanning out, entirely independently, to a workflow-instance creation in one module and a tamper-evident log write in another, with neither of those two modules calling each other, and neither one known by name to the module that started it all.

---

## G. The Audit Trail Dependency: Why Event-Driven, Not `auditService.log(...)` Everywhere

You now have enough evidence to answer the question this chapter has been building toward directly: is this project's audit trail built by having every mutation site call something like `auditService.writeEvent(...)` directly, at every point where something changes? Or is it built by having Audit subscribe to events that other modules emit, with no direct calls at all?

The evidence says clearly: **event-driven, and this is a deliberate, explicitly documented architectural choice, not an implementation accident.** Section §1 of b3 states it structurally — `audit` is listed as one of exactly three **consumer-only** Phase 1 modules (alongside `tracking` and `notifications`), while the Phase 1 **emitting** modules are `iam`, `organization`, `documents`, `workflow`. Audit never emits domain events of its own; it only ever listens. And the Master Event Registry (b3 §8) confirms this concretely at scale: every single one of the catalog's 42 rows — save the one explicitly removed event — lists `audit` in its Consumers column. Not most rows. All of them. b3's own Rule 1 states this as policy, not observation: *"All events must have Audit subscription... No exceptions."* And it traces back to an even more specific stated law, quoted directly in b3 §0.2: *"Any new domain event added to the bus must be registered with the Audit Event Consumer in the same PR that introduces the event. No event may ship without an Audit subscription."*

And you've now read the real code confirming this isn't just a rule on paper. `documents.router.ts`'s own `cancel` procedure contains a comment that states the actual policy plainly, in the codebase itself:

> ```
> // Audit event: transitionState() emits a `document.state_changed`
> // domain event ... audit.event-consumer.ts persists that as the
> // audit-log entry ... This procedure deliberately does not call
> // auditService.writeEvent directly: apps/server/src/modules/audit/index.ts
> // documents that direct writeEvent callers are limited to two confirmed
> // call sites (Records bulk-op handler and disposition service, per B2
> // Module 8); Documents is not one of them, so the event-bus path is the
> // correct, already-covered mechanism here.
> ```

This is worth being precise about, because the honest picture is slightly more nuanced than an absolute rule: there genuinely are two named, narrow exceptions elsewhere in the system (a Records bulk-operation handler and a disposition service) where direct `writeEvent` calls are the confirmed, correct pattern. But for the Documents module specifically — and, per the Master Registry, for essentially every module currently implemented — the pattern is unambiguously emit-and-let-audit-subscribe. `documents.service.ts` even carries a vestigial, unused `auditService?: any` field in its own dependency type — declared, but never actually called anywhere in that file. The real audit trail for a document's entire lifecycle flows exclusively through `document.created`, `document.state_changed`, and `document.number_assigned` events, picked up entirely by `audit.event-consumer.ts`'s own subscriptions — never through Documents reaching over and invoking Audit's service directly.

Why does this distinction actually matter, architecturally, rather than being a stylistic preference? Think about what a direct-call model (`auditService.writeEvent(...)` scattered at every mutation site across every module) would require: **every single module that ever changes state would need to remember, correctly, every single time, to make that call** — and to make it with the right fields, in the right place relative to its own transaction boundary. Miss one call site in one module, in one code path, and that mutation simply has no audit trail — silently, with no mechanism to ever notice the gap, short of a human manually re-reading every mutation site in the codebase.

The event-driven model inverts where that responsibility sits. A module doesn't need to know anything about auditing at all — it only needs to correctly emit the domain events that describe what it did, which it already has every reason to do regardless of Audit's existence (Workflow needs `document.created` too, remember). Audit, meanwhile, is a *single*, centralized point where every event this system defines gets registered — and because `EventPayloadMap` makes "define a new event" and "the build fails if you forget to register a handler for it" into a compiler-checked pair (per ADR-API-001's stated follow-on requirement), the systemic risk of "we shipped a new mutation and forgot to audit it" moves from "depends on every individual developer remembering, at every call site, forever" to "depends on one centralized file being kept in sync with one type registry, enforced by the compiler." That's the real architectural difference — not merely "fewer function calls scattered around," but a fundamentally different, more centralized place where the guarantee "every state change gets audited" actually lives and gets enforced.

---

# Chapter 1.8: File Storage — S3-Compatible, Vendor-Independent, Never Touching the App Server

Documents are the reason this system exists. Every one of them has bytes somewhere — a scanned PDF, a signed DOCX, a spreadsheet — and this chapter is about exactly how and where those bytes live, how they get there, and how they come back. The short version, which this whole chapter exists to make concrete: this project never writes a file to its own server's disk, never imports a cloud-vendor-specific SDK, and never lets a user-supplied filename anywhere near a storage key. Each of those is a stated rule in this project's own architecture document. This chapter checks each one against the actual code.

## The rules, stated plainly

`tech-stack.md`'s "File Storage Strategy" section states the provider plan first:

| Phase | Provider | Reason |
|---|---|---|
| Phase 1 (cloud) | Cloudflare R2 | No egress fees; S3-compatible API; straightforward setup |
| On-premise / future | MinIO | Full S3-compatible API; self-hostable; migration = endpoint URL change only |

and then six non-negotiable rules underneath it:

- Use the S3-compatible API exclusively. No Cloudflare-specific or MinIO-specific SDK imports are permitted anywhere in the codebase. The only allowed import is an S3-compatible client (e.g., `@aws-sdk/client-s3` pointed at the configured endpoint).
- File keys are UUIDs only — never original filenames. Original filename stored as metadata in PostgreSQL.
- S3 object versioning enabled on the bucket.
- Files are streamed directly between client and storage — they never touch the application server's local disk.
- Switching providers requires only an environment variable change (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`). No code changes.
- Supported formats: PDF, DOCX, XLSX, PNG, JPG. Maximum file size: 25 MB per file (configurable via env).

This chapter goes through all six, in roughly this order, checking each against what's actually implemented — not assuming the document and the code agree just because one describes the other.

## A. Vendor independence — checked against the real client

The reasoning behind the provider table above is straightforward once you see it stated: R2 and MinIO are chosen specifically *because* they both speak the same S3-compatible API. Phase 1 runs on Cloudflare R2 because it has no egress fees and is easy to set up in the cloud; a future on-premise deployment can run MinIO instead, self-hosted, with — per the rule — no code change required, only an environment variable pointing somewhere else. The entire reason this is possible at all is that "S3-compatible API" isn't marketing language — Amazon's S3 protocol (the specific set of HTTP operations: `PutObject`, `GetObject`, bucket creation, and so on) became enough of a de facto standard that many storage vendors, R2 and MinIO included, implement the same wire protocol. A client library built to speak that protocol doesn't know or care which vendor is answering on the other end.

That's the claim. Here's whether the real code backs it up. Searching this backend for every place an `S3Client` actually gets constructed turns up four sites — `documents.plugin.ts`, `documents.router.ts`, `tracking.plugin.ts`, and `tracking.router.ts` — and all four build the client identically:

```typescript
const s3Client = new S3Client({
  region: env.S3_REGION || 'ap-southeast-1',
  endpoint: env.S3_ENDPOINT,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY || '',
    secretAccessKey: env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true,
});
```

The claim checks out directly: `endpoint: env.S3_ENDPOINT` — the address the client talks to is read from an environment variable, not hardcoded to `r2.cloudflarestorage.com` or any other vendor's domain. `credentials.accessKeyId` and `.secretAccessKey` likewise come from `env.S3_ACCESS_KEY` / `env.S3_SECRET_KEY`. Nowhere in this construction (or anywhere else this chapter found) does an `@cloudflare/*` or MinIO-specific package get imported. The only S3-related import across all four construction sites is `@aws-sdk/client-s3` — which brings up a naming quirk worth addressing directly, since it's confusing the first time you see it: despite the "aws-sdk" name, this package is not exclusive to Amazon's actual S3 service. It's an implementation of the S3 *protocol* client — a set of HTTP request builders and signing logic for the S3 API shape — and it works against any endpoint that speaks that same protocol, which is exactly why it's the one import the non-negotiable rule explicitly names as allowed. Pointing it at R2 today and MinIO tomorrow is not a workaround or a hack; it's the intended, designed-for use of the package, which is also why the rule frames it the way it does — "the only allowed import is an S3-compatible client... pointed at the configured endpoint," full stop.

One real, worth-naming gap in this story, though, and it's small: `.env.example` documents `S3_FORCE_PATH_STYLE=true`, and this variable has its own entry in the server's environment schema (`S3_FORCE_PATH_STYLE: booleanFromString('false')`, defaulting to `false` at the schema level). But none of the four construction sites above actually read `env.S3_FORCE_PATH_STYLE` — they all hardcode `forcePathStyle: true` directly. The variable exists, is documented, and has a schema-validated type, but it isn't wired to the thing it appears to configure. In practice this happens not to matter much *today*, because `true` is also the value `.env.example` sets — but it does mean that if someone changed `S3_FORCE_PATH_STYLE=false` in their own `.env` expecting different client behavior, nothing would actually change, since the code never looks at it.

`forcePathStyle` itself is worth explaining, since it's directly part of the vendor-independence story: S3-style requests can address a bucket in two different URL shapes — "virtual-hosted style" (`https://my-bucket.s3.amazonaws.com/my-key`, with the bucket name baked into the hostname) or "path style" (`https://s3.amazonaws.com/my-bucket/my-key`, with the bucket name as the first path segment). Real AWS S3 has been steering away from path style for years, but many S3-compatible servers — MinIO very much included, especially when addressed by a bare IP or a Docker-internal hostname like `http://minio:9000` rather than a real DNS name — only work correctly with path style, because there's no meaningful per-bucket subdomain to route on. Setting `forcePathStyle: true` is itself part of what makes this client portable across providers with different addressing expectations, which makes it a slightly ironic place for the one hardcoded, not-actually-configurable value to live — though a defensible one, since forcing path style unconditionally is also simply the safer default across every provider this project targets.

## B. Files never touch the app server's disk — the presigned URL round trip

### What "stateless" means here

A stateless server, in a deployment sense, is one where any running instance can handle any incoming request, because no instance is holding onto anything that only *it* knows about. If your app has three server processes behind a load balancer, statelessness is what lets any of the three answer any request interchangeably — restart one, and nothing is lost, because nothing important was ever sitting only in that one process's memory or disk. It's also what makes horizontal scaling straightforward: adding a fourth server instance under load doesn't require migrating anything, because there was never anything instance-specific to migrate.

The moment an application server starts buffering uploaded files to its own local disk — even temporarily, even just to relay them onward to permanent storage — it stops being fully stateless in that sense. A file mid-upload becomes something only *that* process, on *that* disk, currently has. If that instance restarts or the load balancer routes the next request to a different instance, the in-progress upload is in trouble. This project's non-negotiable rule — "files are streamed directly between client and storage; they never touch the application server's local disk" — is a direct response to that failure mode.

### How a presigned URL achieves this

A presigned URL is how you let a specific action (a `GET`, a `PUT`) happen against your storage bucket without your server ever being in the request path for that action's actual data transfer. The server, which does hold real S3 credentials, uses those credentials to *sign* a URL — cryptographically stamping it with permission to perform one specific operation on one specific object, valid only until a short expiry — without the server itself performing that operation. The browser (or whatever client holds the presigned URL) then talks to the storage endpoint directly, using that URL as its authorization. The file's bytes flow straight between the browser and R2/MinIO/S3; the app server's own process is never a waypoint for them at any point.

This project uses exactly this pattern, on both the upload and download sides, and — genuinely, on inspection — it isn't split evenly across the files the reading order for this chapter first pointed at. `documents.service.ts` turns out to hold only the *download* half; the *upload* half lives one file over, in `documents.router.ts`. Both are worth reading in full, because together they show the complete round trip.

**Download — `documents.service.ts`'s `getAttachmentRefs`:**

```typescript
const command = new GetObjectCommand({
  Bucket: deps.env.S3_BUCKET,
  Key: version.fileKey,
});
const url = await getSignedUrl(deps.s3Client, command, { expiresIn: expiry });
```

For every version and attachment tied to a document, this method builds a `GetObjectCommand` describing "read this exact key from this exact bucket," and hands that description — never the file itself — to `getSignedUrl` from `@aws-sdk/s3-request-presigner`, which is the actual "aws-sdk" export the tech-stack.md rule was gesturing at when it said "e.g., `@aws-sdk/client-s3` pointed at the configured endpoint": the presigner is the sibling package that does the signing math against whatever S3-compatible client you hand it. The result is a `presignedUrl` string, returned to whoever's asking for these attachment refs. The app server itself never issues a `GET` against the object and never reads its bytes into its own memory or disk — it only ever proves, cryptographically, that the browser holding this particular URL is allowed to fetch that particular object for the next few minutes.

**Upload — `documents.router.ts`'s two-procedure handshake:**

Uploading works the same way in reverse, but it needs two round trips to the backend instead of one, because the backend has to be told the upload happened — it can't watch the browser's direct `PUT` to storage.

*Step one, `requestUploadUrl`,* runs before any bytes move at all:

```typescript
const s3Key = crypto.randomUUID();
const command = new PutObjectCommand({
  Bucket: env.S3_BUCKET || 'batac-dms',
  Key: s3Key,
  ContentType: input.mimeType,
});

const uploadUrl = await getSignedUrl(getS3Client(), command, {
  expiresIn: env.S3_SIGNED_URL_EXPIRES_S || 900,
});

return { s3Key, uploadUrl };
```

This generates a fresh key, describes an intended future `PutObject` operation, signs it, and sends the resulting `{ s3Key, uploadUrl }` pair back to the browser. Nothing has been written anywhere yet. The browser then performs its own direct `PUT` request straight to `uploadUrl`, carrying the actual file bytes — that transfer is entirely between the browser and the storage endpoint; the Fastify server has no part in it and never sees the payload.

*Step two, `confirmUpload`,* runs only after the browser has already finished that direct `PUT`:

```typescript
const version = await repo.insertVersion({
  cityId: subject.cityId,
  documentId: input.documentId,
  versionNumber: newVersionNumber,
  fileKey: input.s3Key,
  originalFilename: input.originalFilename,
  mimeType: input.mimeType,
  fileSizeBytes: input.fileSizeBytes,
  createdBy: subject.userId,
  // ...
});
```

This is where the round trip finally reaches PostgreSQL — a metadata row gets written recording that this key, under this document, is now version N. The file itself was already sitting in the bucket before this call was ever made; this step is purely bookkeeping, plus kicking off the async OCR job (covered under its own chapter) now that there's something for OCR to work on.

Notice the request/response bodies flowing through the tRPC layer in both procedures are tiny — a key, a URL, some metadata fields, never file bytes — which is exactly why this pattern keeps the app server stateless. tRPC (Chapter 1.4) is carrying instructions about a transfer, not the transfer itself.

## C. UUID keys, never filenames — checked against the real schema

The rule states this precisely: "File keys are UUIDs only — never original filenames. Original filename stored as metadata in PostgreSQL." You've already seen the generation half of this, in `requestUploadUrl`:

```typescript
const s3Key = crypto.randomUUID();
```

— the key a file will live under in the bucket is manufactured server-side, with no relationship to whatever the browser called the file locally. The `originalFilename` the user actually typed or dragged in doesn't enter the picture until `confirmUpload`, and there, it goes somewhere entirely different from the storage key.

Here's the real Drizzle table definition, from `packages/database/schema/documents.schema.ts`'s `versions` table, which is the authoritative source of truth for what actually lands in Postgres:

```typescript
fileKey: uuid('file_key').notNull(),
originalFilename: text('original_filename'),
mimeType: text('mime_type').notNull(),
```

This is about as direct a confirmation as a rule like this can get. `fileKey` is a genuine Postgres `uuid`-typed column — not a `text` column that merely happens to hold UUID-shaped strings by convention, but one the database itself will reject non-UUID values for — and it's `NOT NULL`, so a version row can't exist without a storage key. `originalFilename` sits right next to it as a separate `text` column, nullable, holding whatever the file was actually called before it ever reached this system. The two are stored side by side, as siblings on the same row, exactly as the rule describes: one is the storage identity, the other is descriptive metadata about it.

Why this separation earns "non-negotiable" status, in plain terms:

- **Path-traversal-style risk.** If a filename a user controls (`../../etc/passwd`, or something less dramatic but still adversarial, like a name containing slashes or null bytes) were ever used *directly* as part of a storage key or a filesystem path, that string becomes something an attacker gets to partially script. A server-generated UUID is never attacker-influenced at all — it's produced by `crypto.randomUUID()`, with no relationship to anything the request body contained.
- **Collisions.** Two different users, or the same user twice, can easily upload files both named `report.pdf`. If the storage key *were* the filename, the second upload would either silently overwrite the first or need some ad hoc disambiguation scheme bolted on. A random UUID for every single version, by construction, essentially never collides.
- **Decoupling the storage layer from anything user-controlled.** The bucket doesn't need to know or care what a file was called, what characters that name contained, how long it was, or whether it changed — because none of that ever reaches the bucket. The storage key's only job is to be a unique, stable identifier; the filename's only job is to be a nice thing to show a human. Splitting those two concerns onto two different columns is what lets each one just do its own job.

## D. Reading the client construction, in full

Since this project has four separate places that each independently construct an `S3Client`, and — worth saying plainly — none of them import from a single shared module to do it, here's the version inside `documents.plugin.ts`, read as the representative example (all four are functionally identical):

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';

// ...

const s3Client = new S3Client({
  region: env.S3_REGION || 'ap-southeast-1',
  endpoint: env.S3_ENDPOINT,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY || '',
    secretAccessKey: env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true,
});
```

`region` — S3-compatible providers generally still want *some* region value even when the concept doesn't mean the same thing it does for real AWS (where region determines physical data-center placement); this project's env schema (`config/env.server.ts`) defaults `S3_REGION` to `'auto'` at the Zod-validation level, and the `|| 'ap-southeast-1'` fallback you see here in the client-construction code is a secondary safety net that, in practice, should rarely if ever actually trigger, since the env schema will already have supplied `'auto'` before this code runs.

`endpoint` and `credentials` are the two fields doing the actual vendor-independence work covered in Section A — the URL and the key pair are both wholly determined by environment configuration, with nothing provider-specific baked into this file.

`forcePathStyle: true` — covered in Section A's discussion of path-style vs. virtual-hosted-style addressing; unconditionally `true` here regardless of what `S3_FORCE_PATH_STYLE` is actually set to.

Once built, this same `s3Client` instance is passed by dependency injection into `createDocumentsService({ ..., s3Client, ... })` — which is how `documents.service.ts`'s `getAttachmentRefs`, covered in Section B, ends up with an `S3Client` to hand to `getSignedUrl` without constructing its own. It's also reused, a few lines further down the same plugin file, wrapped in a tiny adapter object (`{ putObject: (params) => s3Client.send(new PutObjectCommand(params)) }`) and handed to `OcrService` — so the OCR pipeline writing generated preview images back to the bucket goes through this exact same client too, rather than standing up a second one for itself.

The duplication across the four sites is worth naming honestly rather than glossing over, since this chapter's whole purpose is checking claims against what's really there: there's no single canonical "build the S3 client" function anywhere in this codebase for the other three sites to call. `documents.router.ts` and `tracking.router.ts` each maintain their own module-level `_s3Client` singleton via a `getS3Client()` getter function; `documents.plugin.ts` and `tracking.plugin.ts` each construct their own separate instance directly inline, as shown above. All four use identical configuration, so this doesn't currently cause any behavioral inconsistency between them — but it does mean that a change to how this client should be configured (say, adding a retry policy, or actually wiring up `S3_FORCE_PATH_STYLE`) would need to be made in four places by hand to take effect everywhere, rather than in one.

## E. The full round trip, end to end

Pulling Sections B, C, and D together into one linear walkthrough — what actually happens, in order, from a user selecting a file to that file existing as a UUID-keyed object with metadata in Postgres:

1. **Frontend calls `documents.requestUploadUrl`**, passing `documentId` and the file's `mimeType`. tRPC (Chapter 1.4) validates that input against `RequestUploadUrlInputSchema`, which — this matters for Section G below — constrains `mimeType` to a fixed, small set of allowed values before the resolver even runs.
2. **Backend checks authorization** — tenant isolation (`document.cityId !== subject.cityId`) and an ABAC check (`guard.canCreateVersion(...)`) — *before* touching storage at all. A request that shouldn't be allowed to add a version to this document never gets far enough to generate a key or a URL.
3. **Backend generates a fresh key** via `crypto.randomUUID()`, builds a `PutObjectCommand` naming that key and the target bucket, and signs it with `getSignedUrl`, producing a time-limited `uploadUrl`. Nothing has been written to storage yet — this step only produces a description of a future write, plus permission to perform it.
4. **Backend returns `{ s3Key, uploadUrl }`.** The Fastify process's involvement in this particular file's journey is, at this point, already essentially finished for the "receiving bytes" part.
5. **Browser performs its own direct `PUT` to `uploadUrl`,** sending the actual file bytes. This request goes straight from the browser to R2/MinIO — whichever `S3_ENDPOINT` currently points at — and back. The app server is not a party to it in any way.
6. **Frontend calls `documents.confirmUpload`**, passing the `s3Key` it was given in step 4, plus `originalFilename`, `mimeType`, and `fileSizeBytes` describing the file that was just uploaded. This input is validated against `ConfirmUploadInputSchema`, re-checking the same `mimeType` constraint and adding a hard `fileSizeBytes` ceiling.
7. **Backend re-checks authorization** (the same tenant and ABAC checks as step 2, run independently — `requestUploadUrl` and `confirmUpload` are two separate requests, and neither one trusts that the other already verified anything).
8. **Backend inserts a `versions` row**, via `repo.insertVersion(...)`, writing `fileKey` (the UUID from step 3), `originalFilename`, `mimeType`, and `fileSizeBytes` onto one row together — this is the exact moment Section C's key/filename split becomes a real database write.
9. **Backend enqueues an OCR job** referencing this version's new key, and returns `{ versionId }` to the frontend.

At no point in this nine-step sequence does the Fastify process read the file's bytes into its own memory, write them to its own disk, or relay them onward from one connection to another. Steps 1–4 and 6–9 are all small JSON payloads over tRPC; step 5, the only step where the actual file content moves, happens entirely outside the app server's process.

## F. Local development — what MinIO and `minio-init` are actually doing

Running this stack locally doesn't require real R2 credentials, because `compose.yml` stands up a local, S3-compatible server in Docker instead. This is the entire reason MinIO exists in this project's toolkit at all in Phase 1, even though Phase 1's real deployment target is R2: MinIO is a drop-in implementation of the same S3-compatible API, so code written and tested against a local MinIO container behaves the same way it will against the real R2 endpoint later — which is, again, only true *because* of Section A's vendor-independence discipline. If the application code ever imported something R2-specific, testing against local MinIO wouldn't actually prove anything about how the app behaves against R2.

The `minio` service itself:

```yaml
minio:
  image: minio/minio:latest
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: ${S3_ACCESS_KEY:-minio}
    MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY:-minio123456}
  ports:
    - '9000:9000'
    - '9001:9001'
  volumes:
    - minio_data:/data
  healthcheck:
    test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live']
    # ...
```

runs the actual MinIO server, persisting its data into a named Docker volume so it survives container restarts (though not, notably, a full `docker compose down -v`). Its root credentials are set *from the same env vars* the application itself will later use as its S3 access key and secret — `${S3_ACCESS_KEY:-minio}` and `${S3_SECRET_KEY:-minio123456}` — which is exactly why `.env.example`'s `S3_ACCESS_KEY`/`S3_SECRET_KEY` placeholder values work at all: they're not simulating some external credential, they're the actual root login this same compose file is about to create.

The `minio-init` service is a separate, one-shot job, and its job is exactly what you'd guess from its name — provisioning the bucket(s) MinIO needs to have ready before the app can use them, since a freshly started MinIO server has no buckets at all:

```yaml
minio-init:
  image: minio/mc:latest
  restart: no
  depends_on:
    minio:
      condition: service_healthy
  environment:
    S3_ACCESS_KEY: ${S3_ACCESS_KEY:-minio}
    S3_SECRET_KEY: ${S3_SECRET_KEY:-minio123456}
    S3_BUCKET: ${S3_BUCKET:-batac-documents}
    S3_BACKUP_BUCKET: ${S3_BACKUP_BUCKET:-batac-backups}
  entrypoint: >
    /bin/sh -c "
      mc alias set local http://minio:9000 $$S3_ACCESS_KEY $$S3_SECRET_KEY &&
      mc mb --ignore-existing local/$$S3_BUCKET &&
      mc mb --ignore-existing local/$$S3_BACKUP_BUCKET &&
      mc anonymous set none local/$$S3_BUCKET &&
      mc version enable local/$$S3_BUCKET &&
      echo '[minio-init] Buckets ready.'
    "
```

It runs the MinIO *Client* image (`minio/mc`, a small CLI tool — distinct from the MinIO *server* image the `minio` service runs), and only starts once `minio`'s own healthcheck reports healthy, via `depends_on: minio: condition: service_healthy`. `restart: no` (with an explanatory comment in the file itself) keeps it from endlessly retrying once it's finished — this container is meant to run its script exactly once per fresh environment and then exit for good.

The script itself, line by line: `mc alias set local http://minio:9000 ...` registers the local MinIO server under the nickname `local` so every following command has something short to address it by; `mc mb --ignore-existing local/$S3_BUCKET` creates the primary documents bucket, idempotently, so re-running this on an environment that's already been set up doesn't error out; a second `mc mb` does the same for a completely separate backup bucket; `mc anonymous set none local/$S3_BUCKET` explicitly locks the primary bucket down against any anonymous or public access, meaning the only way to read anything out of it is through the app's own presigned-URL mechanism from Section B — there's no bare, unsigned bucket URL a browser could hit directly; and `mc version enable local/$S3_BUCKET` is where the "S3 object versioning enabled on the bucket" non-negotiable rule actually gets satisfied — at least for local development, where this compose file is the thing responsible for setting it up. (One small syntax note if you're reading this file yourself and wondering why it's `$$S3_BUCKET` rather than `$S3_BUCKET`: Docker Compose's own variable interpolation would otherwise try to consume a single `$` at compose-file-parse time, before the container even starts; doubling it tells Compose to pass a literal `$S3_BUCKET` through untouched, for the container's own shell to resolve at runtime from the `environment:` block above it.)

Two buckets, two separate credential sets: `.env.example` documents `S3_BACKUP_BUCKET`, `S3_BACKUP_ACCESS_KEY`, and `S3_BACKUP_SECRET_KEY` as distinct from the primary bucket's own `S3_ACCESS_KEY`/`S3_SECRET_KEY` — a deliberate separation meaning the credentials the running application uses day-to-day are not, by themselves, sufficient to touch whatever backups end up in the backup bucket.

## G. Supported formats and size limits — enforced, but not quite where you'd expect

The rule: "Supported formats: PDF, DOCX, XLSX, PNG, JPG. Maximum file size: 25 MB per file (configurable via env)." Here's exactly what's real, checked against actual code rather than assumed from the documentation alone.

**Format enforcement is real.** `RequestUploadUrlInputSchema` and `ConfirmUploadInputSchema`, in `packages/shared/src/schemas/documents.ts`, both type their `mimeType` field as `AllowedMimeTypeSchema`, defined in `packages/shared/src/schemas/common.ts`:

```typescript
export const AllowedMimeTypeSchema = z.enum([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
]);
```

That's PDF, DOCX, XLSX, PNG, and JPEG, matching the documented list exactly, and it's a genuine Zod enum — a `requestUploadUrl` or `confirmUpload` call carrying any other MIME type fails tRPC's input validation before the resolver body ever runs. This is real, load-bearing enforcement, not just documentation.

**Size enforcement is real too, and it's exactly 25 MB.** Both of those same two schemas constrain `fileSizeBytes` with `z.number().int().positive().max(26_214_400)` — and `26,214,400` is precisely `25 × 1024 × 1024`, so the stated 25 MB ceiling is genuinely enforced, not aspirational.

**The "configurable via env" half, though, doesn't quite hold up.** The server's environment schema (`config/env.server.ts`) does define both `S3_UPLOAD_MAX_SIZE_MB` (defaulting to `25`) and `S3_ALLOWED_MIME_TYPES` (defaulting to a comma-separated string that, once parsed, resolves to the same five MIME types as the hardcoded enum above) — both are validated, typed, and genuinely present in `.env.example`. But searching the rest of the server codebase for actual reads of either variable turns up nothing beyond their own definitions: neither `S3_UPLOAD_MAX_SIZE_MB` nor `S3_ALLOWED_MIME_TYPES` is consulted anywhere the actual size or format check happens. The values that really govern what gets accepted are the hardcoded `26_214_400` literal and the hardcoded `AllowedMimeTypeSchema` enum, both living in `packages/shared` — a different layer of the codebase from the env variables that appear to promise configurability.

Concretely, this means: today, changing `S3_UPLOAD_MAX_SIZE_MB=50` in a real `.env` file would have no effect at all on what the upload procedures actually accept, because nothing reads that value at the point of enforcement. The limit is real and it works — 25 MB and exactly those five formats are genuinely rejected or accepted correctly — it just isn't wired to the environment variables that were seemingly put in place to make it adjustable without a code change. There's a nice piece of corroborating evidence for how deliberate the 25 MB figure itself was, even so: the `versions` table's own Drizzle schema comment, next to the `fileSizeBytes` column, explains that byte counts are stored in a plain JavaScript `number` rather than a `BigInt` specifically *because* "the platform caps uploads at 25MB... well within `Number.MAX_SAFE_INTEGER`" — so this constraint was clearly a conscious, load-bearing design decision throughout the schema, documentation, and validation layers alike. It just currently lives as a constant in three separate places (the Zod `.max()`, the Zod enum, and that schema comment) rather than as a single value read from configuration at runtime.

---

# Chapter 1.9 — Observability: OpenTelemetry and OpenObserve

Two names in this chapter's title, and if neither means anything to you yet, that's the right starting point. Nothing in this chapter assumes you've touched observability tooling before. We'll build the concepts up from nothing, then look at exactly how this project wires them together — including one real discrepancy in the project's own documentation that's worth understanding precisely rather than smoothing over.

## A. What "Observability" Actually Means: Traces, Spans, and OTLP

Start with the problem observability tools exist to solve. A request comes into your server. Somewhere inside handling that request, something is slow, or something throws an error. You have logs — individual timestamped lines saying things like "query started" or "query failed." But logs, on their own, don't tell you the *shape* of the request: which operations happened inside which other operations, how long each one took relative to the whole, or which one specifically was the slow part.

That's what tracing gives you. Here's the concept in plain terms, drawn directly from OpenTelemetry's own conceptual documentation:

A **trace** is the full journey of one request through your system — the whole path, start to finish, wrapped up as one identifiable unit.

A **span** is one named, timed unit of work *within* that trace. A span has a name, a start time, an end time, and — critically — a **parent span ID**. If a span has no parent, it's the *root span*: the very beginning of the trace. If it has a parent, it's a child of whatever operation started it. This parent/child structure is what turns a pile of individual timed operations into one coherent trace: every span in the trace shares the same `trace_id`, and the `parent_id` field on each one tells you exactly how they nest.

Concretely, for this project: a single HTTP request into the Fastify server — say, a request to fetch a document's detail page — might generate one trace containing several spans:

- A root span for the HTTP request itself (started when the request arrives, ended when the response is sent)
- A child span for the database query that fetches the document row
- A child span for an S3 call that generates a pre-signed URL for the document's file
- Possibly more child spans nested under any of those, if those operations themselves call out to something else

All of these spans share one `trace_id`. Looking at the whole trace, you can see exactly how the total request time broke down: was it mostly the database query? Was the S3 call slow? Did something happen sequentially that could have happened in parallel? That's the entire value proposition of tracing — not "did this fail," which a log line can tell you, but "where, specifically, did the time go, and how did the pieces relate to each other."

Here's a detail worth sitting with, because it's easy to assume tracing is only useful once you have multiple separate services talking to each other over a network — what people usually mean by "microservices." That's not the whole story. OpenTelemetry's own docs make this point directly: tracing is valuable "whether your application is a monolith with a single database or a sophisticated mesh of services." This project is a single-process modular monolith — one Fastify server, not a constellation of independently-deployed services — and tracing is still genuinely useful here, for exactly the reason above: it shows you the *internal* shape of how one request's time was spent, even when everything happened inside one process. You don't need a network hop between services to benefit from knowing "this request spent 340ms total, and 310ms of that was one specific database call."

Now, how does a span actually get from your running code to somewhere you can look at it? That's what **OTLP** — the **OpenTelemetry Protocol** — is for. OTLP is the standardized wire format OpenTelemetry defines for encoding and transporting telemetry data — traces, and as you'll see shortly, logs too — from an instrumented application to a backend. It's vendor-neutral by design: any tool that speaks OTLP on the sending side can talk to any tool that speaks OTLP on the receiving side, over HTTP or gRPC. That neutrality is exactly what lets this project's exporters not care about the specific backend they're talking to beyond a URL and some headers — which is a detail that's going to matter a great deal once we look at this project's actual configuration.

## B. What OpenObserve Is, and Why This Project Self-Hosts It

If OpenTelemetry is the *standard* for producing and shipping telemetry, OpenObserve is the *destination* — the actual system that receives what OpenTelemetry sends and lets a developer look at it. OpenObserve is an open-source observability platform that unifies logs, metrics, and traces into one system with one query interface, and — the detail that matters most for this project — it can be **self-hosted**, run as your own service rather than only available as someone else's cloud SaaS product. It natively speaks OTLP for ingestion, which means an OpenTelemetry-instrumented application can send data to it with no translation layer in between.

This project's own `tech-stack.md` states the choice and its rationale directly, in the Logging row of its stack decisions table:

| Layer | Choice | Hard constraint |
|---|---|---|
| Logging | Pino (built into Fastify) + OpenTelemetry → OpenObserve (self-hosted, OSS) | Structured JSON; natively ingested via OTLP; full trace correlation |

**"Structured JSON; natively ingested via OTLP; full trace correlation"** — three separate, deliberate properties, and each one earns its place: structured JSON means log lines are machine-parseable, not just human-readable text; natively ingested via OTLP means no adapter or translation step is needed between what the app emits and what OpenObserve accepts; full trace correlation is the payoff you'll see explained precisely in section F — logs and traces sharing the same identifiers so you can pivot between them.

This is worth connecting to a theme you've now seen repeat across this series. Chapter 1.8 covered this project's S3-compatible file storage — chosen specifically to avoid locking into one cloud vendor's proprietary API, with the explicit rule that switching providers should be an endpoint URL change, not a code change. `tech-stack.md`'s OCR row makes the identical argument in different words: OCR must be "self-hostable; no cloud-vendor dependency," because of an on-premise deployment constraint and data-sovereignty requirements under the Philippines' Data Privacy Act. The observability choice sits in exactly that same lineage. A cloud-hosted SaaS APM (application performance monitoring) tool would work technically, but it would mean sending this project's request-level telemetry — which, depending on what gets logged, could include details about citizen document requests — to a third-party vendor's servers, and it would mean the LGU's ability to see its own system's behavior depends on a vendor's continued willingness to host it. Self-hosting OpenObserve keeps the observability data on infrastructure the LGU actually controls, matching the same on-premise, no-vendor-lock-in posture you've now seen applied to file storage, OCR, and audit-log cryptography alike.

There's also a genuinely concrete story behind this choice, not just a policy preference, and it's worth knowing because it shows the decision wasn't made in the abstract. The project's own findings log — the same governance mechanism Chapter 0.1 introduced, where discoveries made mid-task get written down rather than lost — has an entry, `LOG-0107`, titled "Observability stack shifted to OpenObserve with OpenTelemetry." It records that the original plan named Sentry for error tracking and a generic log aggregator for the Pino JSON output separately. While investigating an unrelated login failure (`LOG-0106`), it became clear that Sentry's free-tier event limits (5,000 events per month) and its lack of unified trace correlation made it a poor fit for this codebase specifically — and OpenObserve was chosen instead, precisely because it could unify logs and traces in one self-hosted platform rather than requiring two separate tools stitched together. That's the concrete reasoning behind the `tech-stack.md` row above; the row states the conclusion, the findings log entry is where you can see the actual investigation that led to it.

This also explains the "Open decision" framing on the very next row of the stack table:

| Layer | Choice | Hard constraint |
|---|---|---|
| Error tracking | **Open decision** — OpenObserve RUM (active choice) or Sentry (future) | OpenObserve unified with logs/traces; Sentry remains an option if specific issue-grouping UX is later needed |

"RUM" here means Real User Monitoring — client-side telemetry from actual browsers, as distinct from the server-side traces and logs this chapter otherwise focuses on. OpenObserve RUM is the *active* choice precisely because it stays inside the same unified platform; Sentry is explicitly kept as a live option, not ruled out, in case OpenObserve's error-grouping UX later proves insufficient for a specific need. That's an honestly-labeled open decision, not a settled one — the table doesn't pretend more certainty exists than actually does.

Concretely, in this project's local development setup, OpenObserve runs as its own Docker service. Here's the real service block from `compose.yml`:

```yaml
# OpenObserve — local observability stack (logs, metrics, traces, RUM)
# Dashboard/API: http://localhost:5080
openobserve:
  image: public.ecr.aws/zinclabs/openobserve:latest
  restart: unless-stopped
  ports:
    - '5080:5080'
  environment:
    # Default credentials for local dev
    ZO_ROOT_USER_EMAIL: admin@batac.gov.ph
    ZO_ROOT_USER_PASSWORD: ComplexPassword123!
  volumes:
    - openobserve_data:/data
  healthcheck:
    test: ['CMD', '/openobserve', 'node', 'status']
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 15s
```

That's the whole self-hosted footprint: one container image, one exposed port (`5080`, serving both the dashboard UI and the ingestion API), a named volume for persistence, and a healthcheck using the binary's own status subcommand. No external account, no vendor dashboard, no per-seat pricing — just a service running alongside the rest of this project's local stack (Postgres, MinIO, Meilisearch), on infrastructure this project already owns.

## C. `instrumentation.ts` — A Genuinely Minimal, Order-Sensitive File

Here's the file in full — all 42 lines:

```typescript
// NOTE: This file's imports are deliberately minimal. Anything
// imported here that transitively pulls in this project's own
// application code (app.ts, fastify, pino, etc.) risks forcing
// that code to load and evaluate before sdk.start() below runs —
// which silently defeats FastifyInstrumentation/PinoInstrumentation,
// since by the time sdk.start() executes, the target modules are
// already cached and unpatched. This file should only ever import
// from @opentelemetry/* packages, Node built-ins, and genuinely
// leaf, dependency-free local files (like ./config/otlp-headers.js
// and ./config/env.js).
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { env } from './config/env.js';
import { parseOtlpHeaders } from './config/otlp-headers.js';

const headers = parseOtlpHeaders(env.OTEL_EXPORTER_OTLP_HEADERS);

// OTLPTraceExporter expects the full endpoint for traces.
// We append /v1/traces to the base endpoint as required by OpenObserve.
const traceExporter = new OTLPTraceExporter({
  url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
  headers,
});

const sdk = new NodeSDK({
  traceExporter,
  instrumentations: [
    new FastifyInstrumentation(),
    new PinoInstrumentation({
      // The instrumentation automatically injects trace_id and span_id into log records.
    }),
  ],
});

try {
  sdk.start();
  console.log('OpenTelemetry initialized.');
} catch (error) {
  console.error('Error initializing OpenTelemetry', error);
}
```

Let's take that header comment (lines 1–10) seriously as the primary teaching text it is, because it's explaining a genuinely subtle bug class, not a style preference.

The instrumentations being used here — `FastifyInstrumentation` and `PinoInstrumentation` — are examples of what OpenTelemetry calls **auto-instrumentation** (or "zero-code" instrumentation): rather than you manually writing code to create a span every time a request comes in or a log line gets written, these instrumentation libraries automatically wrap Fastify's and Pino's own internal functions to create spans and inject correlation data on your behalf. The mechanism by which they do that is called **monkey-patching**: at the moment `new FastifyInstrumentation()` and `new PinoInstrumentation()` run (inside `sdk.start()`), OpenTelemetry reaches into the actual `fastify` and `pino` modules that are currently loaded in memory and replaces certain of their internal functions with wrapped versions that also emit telemetry.

Here's the gotcha, stated exactly as the comment states it: this patching only works on modules that are patched *before* anything else has already imported and cached the original, un-patched versions. In Node.js, once a module is imported, it's cached — subsequent imports of the same module return the *same* cached object, not a fresh copy. So if the application's actual code — anything that imports `fastify` or `pino`, which in this project means `app.ts` and everything downstream of it — loads and runs *before* `sdk.start()` executes, then by the time `sdk.start()` finally does run and tries to patch `fastify`/`pino`, the damage (or rather, the missed opportunity) is already done: the modules `app.ts` is actually using are the original, unpatched ones, sitting in Node's module cache, immune to a patch applied afterward. The comment's own words: this "silently defeats FastifyInstrumentation/PinoInstrumentation" — silently, because nothing throws an error. The application would run completely normally. It would simply never produce any spans, and you'd have no obvious signal that anything was wrong, only an empty OpenObserve dashboard where you expected traces.

That's why the fix isn't "call `sdk.start()` early" in some general sense — it's a hard rule about what this specific file is allowed to import: "only ever import from `@opentelemetry/*` packages, Node built-ins, and genuinely leaf, dependency-free local files." Checking the two local files it actually imports confirms this holds up in practice, not just in the comment's self-description. `./config/env.js` is a small file whose only real work is loading `dotenv/config`, pulling in a `loadDockerSecrets` helper, and validating `process.env` against a Zod schema — no `fastify`, no `pino`, nothing that would transitively load the application code this file needs to avoid. `./config/otlp-headers.js` is even more explicit about *why* it's built this way — its own header comment states it directly:

```
Deliberately isolated in its own dependency-free file: both
app.ts (for the Pino log-shipping transport) and instrumentation.ts
(for the trace exporter) need this function, and instrumentation.ts
must be importable without pulling in app.ts's own dependency tree
(fastify, pino, etc.) — see instrumentation.ts's own top-of-file
comment for why that ordering matters.
```

So the rule is genuinely being followed, not just stated as an intention.

Now — does the actual loading order in this project respect what the comment requires? This is checkable, not something to assume. Here's the relevant part of `index.ts`, the process's actual entrypoint:

```typescript
import './instrumentation.js'; // Must be first to instrument everything

import PgBoss from 'pg-boss';
import { env } from './config/env.js';
import { buildApp } from './app.js';
// ...more imports follow
```

`import './instrumentation.js';` is the literal first line of executable code in the file — before `pg-boss`, before `buildApp` from `./app.js`, before anything else. Import statements execute in the order they're written at the top of a module, so `instrumentation.ts`'s side-effecting code — everything down to and including `sdk.start()` — genuinely finishes running before `app.js` (and, through it, `fastify`, `pino`, and the rest of the application) is imported and evaluated at all. The ordering the header comment warns about is, in fact, respected here, and the developer clearly knew exactly why: the inline comment on that same line, `// Must be first to instrument everything`, is a direct, deliberate restatement of the constraint `instrumentation.ts` itself documents in detail.

## D. One Configuration, Two Kinds of Telemetry

Here's something worth making fully explicit, because it's an elegant piece of design that's easy to walk past if you're reading `instrumentation.ts` and `app.ts` as two unrelated files.

This project sends **both** traces and logs to OpenObserve, over the **same** OTLP protocol, to the **same** OpenObserve endpoint, using the **same two environment variables** for both. Traces go out via `instrumentation.ts`'s `OTLPTraceExporter`, and you already saw exactly where: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`. Logs go out via a Pino transport target configured inside `app.ts`'s logger setup — you'll see the full block in the next section, but here's the piece that matters for this point:

```typescript
targets.push({
  target: 'pino-opentelemetry-transport',
  level: env.LOG_LEVEL,
  options: {
    loggerName: 'batac-server',
    serviceVersion: env.APP_VERSION,
    resourceAttributes: { 'service.name': 'batac-server' },
    logRecordProcessorOptions: {
      recordProcessorType: 'batch',
      exporterOptions: {
        protocol: 'http/protobuf',
        protobufExporterOptions: {
          url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`,
          headers: parseOtlpHeaders(env.OTEL_EXPORTER_OTLP_HEADERS),
        },
      },
    },
  },
});
```

Same `OTEL_EXPORTER_OTLP_ENDPOINT`, with `/v1/logs` appended instead of `/v1/traces`. Same `OTEL_EXPORTER_OTLP_HEADERS`, run through the exact same `parseOtlpHeaders` function imported from the exact same `otlp-headers.ts` file. The code comment directly above this block in `app.ts` even says so plainly: this ships log content to OpenObserve "using the same `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_EXPORTER_OTLP_HEADERS` env vars already declared for the trace exporter in `instrumentation.ts`."

This is exactly why `parseOtlpHeaders` had to be pulled out into its own dependency-free file in the first place, as its own header comment told you in section C: both `app.ts` and `instrumentation.ts` genuinely need the identical parsing logic, and `instrumentation.ts`'s strict import rule means that shared logic has to live somewhere that neither file's constraints conflict with.

Step back and appreciate what this buys the project: one endpoint URL, one set of auth headers, configured once as two environment variables — and both traces and logs, from two different exporters, living in two different files, with two different underlying libraries (`@opentelemetry/exporter-trace-otlp-http` for traces; `pino-opentelemetry-transport` for logs), both point at the same destination without any duplicated configuration. If the OpenObserve endpoint ever moves, or its auth token rotates, it's a two-variable change — not a hunt through multiple files for hardcoded URLs.

## E. Inside `app.ts`'s Logger Construction — a Real, Documented Pino Bug Fix

Now the fuller picture: the actual logger-construction block in `app.ts`, which does considerably more than just ship logs to OpenObserve — it also decides where logs go locally (stdout, stderr, or a file) and whether they're pretty-printed for a human or left as raw JSON.

Here's the relevant block, quoted at length because the comments genuinely are the best explanation available for what's going on:

```typescript
let loggerConfig: any = false;

if (env.LOG_LEVEL !== 'silent') {
  // Resolve the primary destination (stdout / stderr / file path) as a
  // pino/file transport target rather than a separate `dest` argument.
  // [Fixed — see docs/development-findings-log.md, LOG-0108] Pino does not
  // allow both `opts.transport` and a second positional `dest` argument to
  // be pino.destination(...) at the same time: when opts.transport is set,
  // Pino builds its stream entirely from `opts.transport` and silently
  // ignores whatever `dest` was also passed — no error is thrown, but
  // LOG_DESTINATION's actual value (stdout vs. stderr vs. a file) has no
  // effect whenever LOG_PRETTY is true. This was confirmed by direct
  // reproduction: constructing pino({ transport }, pino.destination('/tmp/x.log'))
  // and logging a line writes nothing to /tmp/x.log; the line goes to
  // stdout via pino-pretty instead. Folding the primary destination into
  // the same `targets` array as every other transport (pino-pretty, the
  // OTLP log shipper below) avoids this footgun entirely, since there is
  // then only ever one `transport` option and no separate `dest` argument.
  let destinationTarget: { target: string; options: Record<string, unknown> };
  if (env.LOG_DESTINATION === 'stdout') {
    destinationTarget = { target: 'pino/file', options: { destination: 1 } };
  } else if (env.LOG_DESTINATION === 'stderr') {
    destinationTarget = { target: 'pino/file', options: { destination: 2 } };
  } else {
    // Fail loudly at startup if the configured path can't actually be
    // opened for writing, rather than silently falling back to stdout —
    // a swallowed misconfiguration here would recreate the exact
    // "declared but not doing what you think" problem this file's own
    // logging setup exists to fix.
    try {
      pino.destination(env.LOG_DESTINATION).end();
    } catch (err) {
      throw new Error(
        `Invalid LOG_DESTINATION configuration: ${env.LOG_DESTINATION}. Failed to open for writing: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    destinationTarget = {
      target: 'pino/file',
      options: { destination: env.LOG_DESTINATION, mkdir: true },
    };
  }

  const targets: Array<{ target: string; options: Record<string, unknown>; level?: string }> = [];

  if (env.LOG_PRETTY) {
    const prettyDestination =
      env.LOG_DESTINATION === 'stdout' ? 1 : env.LOG_DESTINATION === 'stderr' ? 2 : 1;
    targets.push({
      target: 'pino-pretty',
      options: { colorize: true, destination: prettyDestination },
    });
    if (env.LOG_DESTINATION !== 'stdout' && env.LOG_DESTINATION !== 'stderr') {
      targets.push(destinationTarget);
    }
  } else {
    targets.push(destinationTarget);
  }

  // (the pino-opentelemetry-transport target from section D goes here)
  targets.push({ target: 'pino-opentelemetry-transport', /* ... */ });

  loggerConfig = pino({
    level: env.LOG_LEVEL,
    redact: env.LOG_REDACT_PATHS,
    transport: { targets },
  });
}
```

The bug the comment describes, in plain terms: Pino's `pino()` constructor can accept a `transport` option (which describes one or more destinations/formatters as "targets"), and it can *separately* accept a positional `dest` argument — typically something built with `pino.destination(...)`, pointing directly at a file descriptor or path. The bug is that these two configuration mechanisms don't compose the way you'd expect. If you set `transport`, Pino builds its output stream entirely from that `transport` configuration and **silently ignores** whatever `dest` you also passed — no warning, no thrown error, just quiet non-effect. The comment states the exact reproduction that confirmed this: constructing `pino({ transport }, pino.destination('/tmp/x.log'))` and writing a log line produces *nothing* in `/tmp/x.log` — the line goes to stdout via `pino-pretty` instead, because that's what `transport` described, and the separately-passed `dest` was never consulted at all.

The fix, once you see the bug clearly, is almost obvious: don't use both mechanisms. Fold the "where do the primary logs go" decision — stdout, stderr, or a file path — into the *same* `targets` array that every other output (the pretty-printer, the OpenObserve OTLP shipper) also lives in. That way there's only ever one `transport` configuration in play, built entirely from one array, and the footgun of a `transport`/`dest` combination that silently discards one of the two simply can't occur, because `dest` is never used at all.

Notice, too, the same "fail loudly, don't silently misbehave" instinct shows up a second time in this same block, for a related but distinct reason. When `LOG_DESTINATION` is neither `'stdout'` nor `'stderr'`, the code treats it as a file path — but before committing to that path, it actually tries opening it for writing (`pino.destination(env.LOG_DESTINATION).end()`) inside a try/catch, and throws a clear, specific error at startup if that fails. The comment explains why this extra step exists: "a swallowed misconfiguration here would recreate the exact 'declared but not doing what you think' problem this file's own logging setup exists to fix." Having just fixed one silent-failure mode, the code deliberately avoids introducing a second one via an unwritable file path being quietly ignored.

**Now, a precise thing worth reporting honestly rather than glossing over.** The comment cites its source as `[Fixed — see docs/development-findings-log.md, LOG-0108]`. Checking that against the actual findings log: `LOG-0108` is a real, existing entry — but it's titled *"Zod major-version split between `packages/shared` (v3) and `apps/web` (v4)"*, and its content is entirely about a Zod schema version mismatch between two packages. It has nothing to do with Pino, `transport`, or `dest`. A thorough search of the entire findings log — every entry with "pino" anywhere in it, plus every entry near LOG-0108 by number, plus direct searches for phrases like "silently ignor" and "pino.destination" — turns up no entry anywhere that actually documents this specific Pino bug. The closest genuinely-Pino-related entries are `LOG-0019` (a TypeScript type-compatibility issue between `fastify.log` and Pino's `Logger` type — a different problem entirely) and `LOG-0107` (the OpenObserve adoption story from section B, which mentions Pino only in passing).

So the fix itself is real, well-explained, and — as far as the actual behavior it describes — entirely credible on its own technical merits. But the specific citation attached to it doesn't check out: `LOG-0108` in the real findings log is about something else. This is worth knowing precisely for what it is: not evidence the fix is wrong, but a mismatched reference — the kind of small provenance error that's genuinely useful to notice as a habit, since a comment's citation is only as trustworthy as it is when you actually go look.

## F. Trace Correlation — Why Running Both Exporters Together Pays Off

Go back to this small but important detail from `instrumentation.ts`:

```typescript
new PinoInstrumentation({
  // The instrumentation automatically injects trace_id and span_id into log records.
}),
```

Here's what that comment means in practice, and why it's the actual payoff of running the trace exporter and the log exporter together rather than treating them as two unrelated features.

When `PinoInstrumentation` is active — which, per section C, it genuinely is, because the loading order is correct — every log line Pino writes, anywhere in the request-handling path, automatically gets two extra fields attached: `trace_id` and `span_id`, taken from whatever span is currently active at the moment that log line was written. You don't have to manually thread a trace ID through your logging calls, or remember to attach it — the instrumentation does it for every log line, for free, because it's watching Pino's own internals at the point where log records get constructed.

The practical consequence: every log line and every span, for the same request, share the same `trace_id`. That means a developer looking at OpenObserve isn't stuck choosing between "look at the trace" and "look at the logs" as two separate, disconnected investigations. They can find a specific slow or failing request's trace first — see which span took the time, or which span carries an error status — and then pivot *directly* to the exact log lines that request produced, by searching OpenObserve for that same `trace_id`. Not "logs from around the same time," which is the best you can do without correlation — the *exact* log lines from *that* request, no matter how many other requests were happening concurrently on the same server at the same time.

This is precisely the "full trace correlation" phrase from `tech-stack.md`'s Logging row constraint, made concrete: it isn't a marketing phrase, it's this specific mechanism — one instrumentation library injecting one shared identifier into two otherwise-separate telemetry streams, so that a human debugging a problem can cross from one to the other without any manual correlation work.

## G. How You'd Actually Use This While Debugging

Put all of the above together into what a developer would concretely *do* if something went wrong in production.

Say a citizen's document request is failing, or a specific page is loading unusually slowly. Here's the path:

1. **Open OpenObserve** — in this project's setup, that's the dashboard at `http://localhost:5080` in local development (per `compose.yml`), or wherever the production instance is deployed. Log in with the configured root credentials.
2. **Search by `trace_id`.** If you already have a trace ID — and you very well might, because of a loop this closes across two different chapters of this series: Chapter 1.4 covered how this project's tRPC error formatter surfaces a `traceId` field directly on error responses sent to the client, as `data.traceId`. If a request failed and the client-side error included a `traceId`, that's the exact same identifier `PinoInstrumentation` and the trace exporter are both using — search for it directly in OpenObserve.
3. **Find the relevant trace.** OpenObserve, having received both the trace data (via `instrumentation.ts`'s `OTLPTraceExporter`, hitting `/v1/traces`) and the log data (via `app.ts`'s `pino-opentelemetry-transport` target, hitting `/v1/logs`) — both sent using the identical `OTEL_EXPORTER_OTLP_ENDPOINT`/`OTEL_EXPORTER_OTLP_HEADERS` configuration from section D — has everything needed to show you the full trace: the root HTTP span, and every child span nested underneath it (a database query, an S3 call, whatever else that request touched).
4. **See which span was slow, or which span carries an error status.** This is the entire point of section A's example made real: instead of guessing, you can see directly that, say, the database query span took 4 seconds while everything else took milliseconds, or that a specific child span has an error status attached to it.
5. **Pivot to correlated logs for more detail.** Once you know *which* span is the problem, use that same `trace_id` (shared across every span and every log line for this request, per section F) to pull up the actual log lines produced during that request — the structured JSON detail a span's summary view won't show you, like the specific query parameters, an error message's full stack trace, or whatever else got logged along the way.

That's the whole workflow, and it's only possible because of everything this chapter walked through: `instrumentation.ts` loading first and actually patching Fastify and Pino successfully (section C); both traces and logs genuinely reaching the same self-hosted OpenObserve instance over the same shared OTLP configuration (sections B and D); and `PinoInstrumentation` stitching the two together with a shared `trace_id` on every log line (section F). Each piece, on its own, is a small mechanism. Together, they turn "something's wrong somewhere in this request" into a direct, traceable path from a client-visible error identifier all the way down to the exact database query or S3 call that caused it.

---

# Chapter 1.10 — The Whole Stack, Alive on Your Machine: Docker Compose

Every chapter since 1.1 has taken one piece of this stack and opened it up on its own: Postgres and its three database roles, Drizzle, Zod, Fastify, tRPC, Zustand, MinIO, OpenObserve. You now know what each piece is and why it was chosen. What you haven't seen yet is all of them running *at the same time*, on your machine, talking to each other — which is the only way any of it actually does anything.

That's this chapter. Nothing here is a new concept. It's the same pieces, wired together, and the wiring is worth understanding in its own right — because the wiring is where "I read the docs" and "I read the actual file" start to diverge, and by the end of this chapter you'll have seen a few real, verified examples of exactly that.

## A. What Docker Compose Actually Is

A single YAML file — `compose.yml` — describes a set of **services**. Each service is one container: an image to run, the environment variables it needs, the ports it should expose to your machine, and any storage it needs to persist between restarts (a **volume**). One command, `docker compose up`, reads that file and brings every service up together, on a shared internal network where — this matters later, in sections D and E — each service can reach every other service by its **service name**, the same way you'd reach a website by domain name. `postgres` is a hostname other containers on the same compose file can resolve; so is `minio`; so is `server`, once it exists.

That's the whole concept. The rest of this chapter is what this project actually put into that file.

## B. Every Service in `compose.yml`

Six services are defined. Here's each one, in the order they appear, with what you already know from earlier chapters folded in rather than repeated.

### `postgres`

```yaml
postgres
  image: postgres:16-alpine
  restart: unless-stopped
  environment:
    POSTGRES_DB: ${DB_NAME:-batac_lgu}
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: ${DB_SUPERUSER_PASSWORD:-postgres}
    DB_APP_PASSWORD: ${DB_APP_PASSWORD:-app_devpassword}
    DB_AUDIT_PASSWORD: ${DB_AUDIT_PASSWORD:-audit_devpassword}
    DB_MIGRATE_PASSWORD: ${DB_MIGRATE_PASSWORD:-migrate_devpassword}
    TZ: Asia/Manila
  ports:
    - '${DB_PORT_EXPOSED:-5432}:5432'
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./tools/db/init:/docker-entrypoint-initdb.d:ro
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U postgres -d ${DB_NAME:-batac_lgu}']
    interval: 5s
    timeout: 5s
    retries: 10
    start_period: 15s
```

This is Chapter 1.1's Postgres, running as a single `postgres:16-alpine` instance — no replication locally, that's a production concern (section C). Two things worth noticing that Chapter 1.1 didn't need to cover, because they're specifically about *how this container boots*, not about the schema design:

The three `DB_*_PASSWORD` variables aren't consumed by Postgres itself — Postgres doesn't know what `batac_app` is. They're passed through so a script can read them and create those roles, which is the second bind mount: `./tools/db/init:/docker-entrypoint-initdb.d:ro`. Section F walks through exactly what that script does.

The healthcheck runs `pg_isready` against the actual database name, not just a bare connection check, with a 15-second `start_period` — enough slack for Postgres to finish initializing on a genuinely empty volume before the healthcheck starts counting failures against it.

### `minio` and `minio-init`

```yaml
minio:
  image: minio/minio:latest
  restart: unless-stopped
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: ${S3_ACCESS_KEY:-minio}
    MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY:-minio123456}
    TZ: Asia/Manila
  ports:
    - '9000:9000'
    - '9001:9001'
  volumes:
    - minio_data:/data
  healthcheck:
    test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live']
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 15s

minio-init:
  image: minio/mc:latest
  restart: no
  depends_on:
    minio:
      condition: service_healthy
  environment:
    S3_ACCESS_KEY: ${S3_ACCESS_KEY:-minio}
    S3_SECRET_KEY: ${S3_SECRET_KEY:-minio123456}
    S3_BUCKET: ${S3_BUCKET:-batac-documents}
    S3_BACKUP_BUCKET: ${S3_BACKUP_BUCKET:-batac-backups}
  entrypoint: >
    /bin/sh -c "
      mc alias set local http://minio:9000 $$S3_ACCESS_KEY $$S3_SECRET_KEY &&
      mc mb --ignore-existing local/$$S3_BUCKET &&
      mc mb --ignore-existing local/$$S3_BACKUP_BUCKET &&
      mc anonymous set none local/$$S3_BUCKET &&
      mc version enable local/$$S3_BUCKET &&
      echo '[minio-init] Buckets ready.'
    "
```

This is Chapter 1.8's MinIO, standing in for Cloudflare R2 locally — same S3 API either way, so the application code never knows which one it's talking to; only `S3_ENDPOINT` changes.

`minio-init` is worth pausing on because it's a pattern you'll see again in section D: a container whose entire job is to run once, do a small setup task, and exit. `restart: no` means Compose won't try to bring it back up after it finishes — there's nothing to keep alive. `depends_on: minio: condition: service_healthy` means it waits for MinIO's own healthcheck to pass before it runs at all, not just for the container to *start* (a container can be running long before the service inside it is actually ready to accept connections — `service_healthy` is the stronger, correct condition to wait on). Once it runs, it uses the MinIO Client (`mc`) to point at `http://minio:9000` — the service name again — set up an alias, and create two buckets: `batac-documents` and `batac-backups`, both via `mc mb --ignore-existing`, which is what makes this safe to run every time you `docker compose up` without erroring on a bucket that's already there. It also locks down anonymous access and turns on object versioning for the main bucket.

One syntax detail worth explaining rather than skipping past: `$$S3_ACCESS_KEY` inside that `entrypoint` string, not `$S3_ACCESS_KEY`. Docker Compose does its own variable interpolation on this file *before* the container ever starts, and a bare `$VAR` here would get consumed at that parse stage rather than surviving into the shell script that actually runs inside the container. Doubling the `$` escapes it from Compose's interpolation so the *shell inside the container* is the one that reads it, at runtime, from the `environment:` block just above.

### `mailpit`

```yaml
mailpit:
  image: axllent/mailpit:latest
  restart: unless-stopped
  ports:
    - '1025:1025'
    - '8025:8025'
  healthcheck:
    test: ['CMD', 'wget', '--no-verbose', '--spider', 'http://localhost:8025']
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 5s
```

This one's new, so here's the concept fresh: Mailpit is a fake SMTP server. It listens on port `1025` the same way a real mail server would, accepts anything sent to it, and — instead of actually delivering it anywhere — holds onto it and shows it to you in a web UI at `http://localhost:8025`. Every email your app "sends" locally shows up there instead of in an inbox.

This works cleanly with the stack's actual email choice specifically *because* of how that choice was made. `tech-stack.md` picked Nodemailer for exactly one stated reason: it "works with any SMTP provider including LGU mail server." Nodemailer doesn't have a concept of "Mailpit" versus "a real mail server" — it just speaks SMTP to whatever `SMTP_HOST`/`SMTP_PORT` point at. Locally that's Mailpit on `localhost:1025`; in production it's whatever the LGU's actual mail infrastructure turns out to be. The application code is identical either way — only `.env` changes. `.env.example` sets `SMTP_REJECT_UNAUTHORIZED=false` and `SMTP_SECURE=false` specifically because Mailpit doesn't speak TLS, so those flags need to be off for local dev in a way they presumably wouldn't be against a real mail server.

### `meilisearch`

```yaml
meilisearch:
  image: getmeili/meilisearch:latest
  restart: unless-stopped
  profiles:
    - search
  environment:
    MEILI_MASTER_KEY: ${SEARCH_MEILISEARCH_MASTER_KEY:-meilisearch-dev-key-changeme}
    MEILI_NO_ANALYTICS: 'true'
    MEILI_ENV: development
    TZ: Asia/Manila
  ports:
    - '7700:7700'
  volumes:
    - meilisearch_data:/meili_data
  healthcheck:
    test: ['CMD', 'wget', '--no-verbose', '--spider', 'http://localhost:7700/health']
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 20s
```

`tech-stack.md`'s Search Strategy table is explicit about why this one exists but isn't running by default:

| Phase | Tool | Reason |
|---|---|---|
| Phase 1 | PostgreSQL FTS (`tsvector`/`tsquery`) | Zero extra infra; sufficient for initial document volume |
| Phase 2+ | Meilisearch (Docker, self-hosted) | Typo tolerance for Filipino names; faceted filtering; synced from PostgreSQL |

This project is in Phase 1. `.env.example` backs that up directly: `SEARCH_PROVIDER=postgres` and `FEATURE_MEILISEARCH_ENABLED=false` are the defaults. Running a Meilisearch container by default would mean starting a service nothing is currently configured to talk to — pure overhead for local dev.

That's what `profiles: - search` is doing here, and it's worth explaining as a concept since this is the one place in the file you'll actually see it: a **Docker Compose profile** is a tag you can put on a service. A plain `docker compose up` starts every service that has *no* profile at all, and skips every service that has one — until you explicitly ask for that profile with `docker compose --profile search up -d`. It's how one compose file can describe both "what Phase 1 needs" and "what Phase 2 will need," without Phase 2's infrastructure costing anything until you actually opt into it.

### `openobserve`

```yaml
openobserve:
  image: public.ecr.aws/zinclabs/openobserve:latest
  restart: unless-stopped
  ports:
    - '5080:5080'
  environment:
    ZO_ROOT_USER_EMAIL: admin@batac.gov.ph
    ZO_ROOT_USER_PASSWORD: ComplexPassword123!
  volumes:
    - openobserve_data:/data
  healthcheck:
    test: ['CMD', '/openobserve', 'node', 'status']
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 15s
```

This is Chapter 1.9's OpenObserve, seeded with a root email and password directly in the compose file. Those two values aren't just decorative — `.env.example` sets `OTEL_EXPORTER_OTLP_HEADERS` to a base64-encoded HTTP Basic Auth string, and decoding it gives you back exactly `admin@batac.gov.ph:ComplexPassword123!`. That's not a coincidence: it's the credential the Fastify server uses to authenticate when it pushes traces to OpenObserve's OTLP ingest endpoint at `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:5080/api/default`. Section D shows exactly where that push gets wired up in code, and it's earlier than you'd probably guess — before the server even finishes starting.

```yaml
volumes:
  postgres_data:
    driver: local
  minio_data:
    driver: local
  meilisearch_data:
    driver: local
  openobserve_data:
    driver: local
```

Four named volumes at the bottom of the file, one per service that needs to remember something across a restart. Mailpit and `minio-init` don't get one — Mailpit's caught emails are meant to be disposable, and `minio-init` never had state to begin with.

## C. `compose.yml` vs. `compose.prod.yml` — What Actually Changes

The production file is a different shape entirely, not just a tuned version of the dev one. Here's what's actually different, checked directly against both files rather than assumed.

### The database gets a standby

Local dev runs one `postgres:16-alpine` container. Production runs `postgres-primary` and `postgres-standby`, both on `bitnami/postgresql:16` — a different vendor image, chosen specifically because it exposes streaming replication through environment variables (`POSTGRESQL_REPLICATION_MODE: master` / `slave`) instead of requiring hand-written `pg_hba.conf` and recovery config, which is what ADR-INF-002 confirms explicitly: the official image stays in dev "where its simplicity is the correct trade-off," and Bitnami is used in production because the replication setup is "already written" and "declarative and well-tested" through env vars alone. Same PostgreSQL major version, same engine, same RLS/JSONB behavior either way — only the container's bootstrap process differs.

### The application gets containerized — because it deliberately isn't, locally

Neither `server` nor `web` appear in `compose.yml` at all. That's not an omission; it's the whole point of Chapter 1.1 through 1.9 running on your machine via `pnpm dev` directly on the host rather than inside Docker — hot reload works, and rebuilding a Docker layer on every file save would slow down exactly the loop you're using this stack for. Production has no such concern, so it containerizes both:

```yaml
web-build:
  image: ${REGISTRY:-ghcr.io/batac}/web:${IMAGE_TAG:-latest}
  restart: 'no'
  volumes:
    - web_static:/app/dist
  command: ['sh', '-c', 'cp -r /app/dist/* /shared/ 2>/dev/null || true']
```

`web-build` is the same "run once, do a task, exit" pattern as `minio-init`, but there's a subtlety here worth being precise about rather than glossing over: the command copies from `/app/dist` to `/shared`, but `/shared` is never mounted anywhere in this service — only `web_static:/app/dist` is. The command as written can't actually do what it looks like it's doing, and `|| true` means it fails silently. What actually gets the built site into the `web_static` volume is a Docker behavior, not this command: when a container mounts a brand-new, empty named volume over a directory that already has content baked into the image at that exact path, Docker copies the image's existing content into the volume the first time. Since the web image's production stage (section D) is built with the compiled site sitting at `/app/dist`, and `web_static` is empty on first run, Docker seeds the volume automatically — the explicit `cp` line is, as written, not the mechanism actually doing the work.

### Nginx enters the picture

`nginx` doesn't exist in local dev at all — Vite's own dev server handles that locally. In production it's the single ingress point, and section E walks through its config directly.

### Secrets and credentials — and a real gap between the ADRs and the shipped file

Local dev's credentials are plain environment variables with hardcoded fallback defaults baked right into the compose file — `${DB_SUPERUSER_PASSWORD:-postgres}`, `${S3_SECRET_KEY:-minio123456}`, and so on. That's fine for a throwaway local database; it would not be fine in production, and production doesn't do it that way.

Here's where it's worth being exact rather than assuming the pattern you'd expect. ADR-INF-005 (TLS provisioning) and ADR-INF-006 (production secrets management) both state their decision plainly, more than once: *only* the TLS certificate and key should be handled through Docker `secrets:`; every other production secret — `DATABASE_URL_APP`, `AUTH_JWT_ACCESS_SECRET`, S3 keys, the SMTP password, the backup encryption key — should travel through a plain `.env.production` file via `env_file:`, managed by the LGU IT Office, accepting that rotating any of them means a container restart.

The actual `compose.prod.yml` does close to the reverse of that. Its `secrets:` block lists twelve entries:

```yaml
secrets:
  db_replication_password: { file: ./secrets/db_replication_password.txt }
  db_superuser_password: { file: ./secrets/db_superuser_password.txt }
  jwt_access_secret: { file: ./secrets/jwt_access_secret.txt }
  jwt_refresh_secret: { file: ./secrets/jwt_refresh_secret.txt }
  audit_hmac_secret: { file: ./secrets/audit_hmac_secret.txt }
  database_url_app: { file: ./secrets/database_url_app.txt }
  database_url_audit: { file: ./secrets/database_url_audit.txt }
  s3_access_key: { file: ./secrets/s3_access_key.txt }
  s3_secret_key: { file: ./secrets/s3_secret_key.txt }
  smtp_password: { file: ./secrets/smtp_password.txt }
  backup_encryption_key: { file: ./secrets/backup_encryption_key.txt }
  meilisearch_master_key: { file: ./secrets/meilisearch_master_key.txt }
```

— which is exactly the category of string secrets the ADRs said should go through `.env.production` instead. Meanwhile TLS, the one thing the ADRs specifically wanted in `secrets:`, shows up only as a plain named volume mounted read-only into nginx:

```yaml
nginx:
  volumes:
    - tls_certs:/etc/nginx/certs:ro
# ...
volumes:
  tls_certs: { driver: local }
```

with no `secrets:` entry for it anywhere, and no service in the file that populates that volume — getting a real certificate and key into it is left as a step that happens outside this file entirely. I'm reporting this plainly rather than guessing at why it diverged from the ADRs: the ADRs are the documented decision, this is what the file actually does, and if you're the one deploying this, that gap is worth resolving deliberately rather than discovering at deploy time.

### Everything else that's different

- **Image pinning is more nuanced than "prod pins, dev floats."** `nginx:1.27-alpine` is genuinely pinned. `server` and `web` use `${IMAGE_TAG:-latest}` — a default meant to be overridden by CI with a real tag or commit SHA, not left as `latest` in a real deploy. But `minio/minio:latest` and `getmeili/meilisearch:latest` are unpinned in *both* files, and `bitnami/postgresql:16` floats on the minor version in the production file too — which ADR-INF-002 explicitly calls out as something to fix "before production deployment," an action item that, per this file, hasn't happened yet.
- **MinIO in production is opt-in, not default.** It's gated behind `profiles: - onpremise`. `tech-stack.md`'s File Storage Strategy table explains why: Phase 1 cloud production points at Cloudflare R2 directly (an external service, not something this compose file runs at all); MinIO only comes into play for a self-hosted, on-premise deployment.
- **Network exposure narrows.** `server` binds to `127.0.0.1:3000:3000` and `minio` to `127.0.0.1:9000`/`9001` — loopback only, reachable from the host machine for debugging but not from outside it. Nginx, on `80`/`443` with no host restriction, is the only genuinely public surface. Local dev has no such restrictions on anything, because "anything" is just your own machine.
- **Resource limits appear only in production** — `deploy.resources.limits` (CPU and memory ceilings) on `postgres-primary`, `postgres-standby`, and `server`. Dev sets none.
- **Healthchecks are, honestly, uneven in production.** Dev gives every single service one. Production gives `postgres-primary`, `server`, and `nginx` a healthcheck, but not `postgres-standby`, `minio`, or `meilisearch` — worth knowing if you're ever debugging why `depends_on: condition: service_healthy` isn't blocking on one of those three the way you'd expect.
- **No Mailpit, no OpenObserve, in production, at all.** Neither service appears in `compose.prod.yml`. Consistent with Mailpit's whole purpose being local-only email interception — production SMTP just points `SMTP_HOST` at a real provider — though the file itself doesn't tell you what OpenObserve's production equivalent is, if there is one; that's simply outside what this file defines.
- **The project name changes** — `name: batac-dev` versus `name: batac-prod` — which is how Compose namespaces containers and networks so the two stacks can't collide if you somehow ran both on the same machine.

## D. The Real Dockerfiles

### `apps/server/Dockerfile`

```dockerfile
FROM node:22-alpine AS pruner
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune --scope=server --docker

FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY --from=pruner /app/out/full/ .
RUN pnpm --filter @batac/shared build && \
    pnpm --filter @batac/database build && \
    pnpm --filter server build

FROM node:22-alpine AS production
RUN apk add --no-cache wget dumb-init
RUN corepack enable
WORKDIR /app

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/server/dist           ./apps/server/dist
COPY --from=builder /app/packages/shared/dist       ./packages/shared/dist
COPY --from=builder /app/packages/database/dist     ./packages/database/dist
COPY --from=builder /app/packages/database/migrations ./packages/database/migrations
COPY --from=builder /app/packages/database/scripts/post-migrate-grants.sql \
                    ./packages/database/scripts/post-migrate-grants.sql

COPY apps/server/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

ENV TZ=Asia/Manila
ENV TESSDATA_PREFIX=/app/tessdata
RUN mkdir -p /app/tessdata && \
    wget -q -O /app/tessdata/eng.traineddata.gz \
      https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_best/eng.traineddata.gz && \
    wget -q -O /app/tessdata/fil.traineddata.gz \
      https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_best/fil.traineddata.gz && \
    gunzip /app/tessdata/*.gz && \
    chown -R node:node /app/tessdata

USER node
EXPOSE 3000
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["./entrypoint.sh"]
```

Four named stages, and each exists for a specific reason:

**`pruner`** copies the *entire* monorepo in and runs `turbo prune --scope=server --docker`. That command produces two trimmed folders: `out/json/` (just `package.json` manifests, no source) and `out/full/` (actual source), containing only what `server` and its real dependencies (`@batac/shared`, `@batac/database`) need — nothing from `apps/web` or `apps/portal` follows through. Every later stage works from this pruned output, not the original `COPY . .`.

**`deps`** starts a *fresh* `node:22-alpine` — a new stage means a new filesystem, which is why `corepack enable` runs again — and copies in only the manifests and lockfile from `pruner`, not source. That's deliberate layer-caching: this layer only rebuilds when dependencies change, not on every source edit, which is most of what makes a monorepo Docker build fast to iterate on.

**`builder`** builds `FROM deps`, reusing the already-installed `node_modules`, then copies in the real source (`out/full/`) and compiles three packages in a specific order: `@batac/shared`, then `@batac/database`, then `server` — that order isn't arbitrary, since `server` imports compiled output from the other two.

**`production`** starts from `node:22-alpine` fresh again — deliberately *not* `FROM builder` — so none of the builder stage's TypeScript compiler, dev dependencies, or source ever end up in the shipped image. It installs only production dependencies (`--prod`), copies in nothing but the compiled `dist/` output plus the migration SQL files and `post-migrate-grants.sql` (needed at runtime — section F explains why), and adds the entrypoint script.

**Two ADRs are directly visible here.** `FROM node:22-alpine` in every stage is ADR-INF-007: Node 20 entered Maintenance LTS in April 2026, so this project deliberately started on Node 22, the Active LTS line, instead. And `RUN corepack enable` on every stage relies on the root `package.json`'s `packageManager` field — confirmed as `"pnpm@9.15.4+sha512..."`, pinned with a full integrity hash — which is ADR-INF-008's whole point: without that field, `corepack` would resolve *some* pnpm version, possibly a different one on a different machine or CI run, which is exactly the non-reproducible-build risk the ADR was written to close off.

A third ADR explains an *absence*: there's no `apk add python3 make g++` anywhere in this file, which might be surprising for a Node app doing password hashing — Argon2 implementations have historically needed a native compiler. ADR-INF-001 is why: the decision was to drop the `argon2` package (which needs `node-gyp` compilation, and carries real musl-vs-glibc binary compatibility risk on Alpine) for `@node-rs/argon2`, which ships a prebuilt `linux-x64-musl` binary and needs no compiler at all — hence no build tools in this Dockerfile. Worth flagging plainly, though: `apps/server/package.json` still lists plain `"argon2": "^0.43.0"` as the actual installed dependency, confirmed against the lockfile, not `@node-rs/argon2`. The Dockerfile reflects the ADR's decision; the dependency it was written for hasn't landed yet.

**The OCR block** unconditionally bundles English and Filipino Tesseract language packs into the image at build time, rather than fetching them at runtime — ADR-INF-003's reasoning is that this platform has to work in two deployment targets, a cloud VPS and an on-premise City Hall installation with no guaranteed internet, and a single image that works in both beats maintaining two.

**`USER node`** runs the process as the unprivileged `node` user built into the official image, rather than root. **`ENTRYPOINT ["/usr/bin/dumb-init", "--"]`** makes `dumb-init` PID 1 instead of the shell script — a real Node process running directly as PID 1 doesn't handle OS signals (like the `SIGTERM` a `docker stop` sends) or reap zombie child processes correctly; `dumb-init`'s entire job is doing that properly and forwarding signals down to whatever it launches.

### `apps/server/entrypoint.sh`

```sh
#!/bin/sh
set -e

echo "[entrypoint] APP_ENV=${APP_ENV}"
echo "[entrypoint] DB_HOST=${DB_HOST:-localhost}"

echo "[entrypoint] Running database migrations..."
node ./packages/database/dist/migrate.js
echo "[entrypoint] Migrations complete."

if [ "$APP_ENV" = "development" ] || [ "$APP_ENV" = "staging" ]; then
  echo "[entrypoint] Seeding database (${APP_ENV})..."
  node ./packages/database/dist/seed.js
  echo "[entrypoint] Seed complete."
else
  echo "[entrypoint] Skipping seed (APP_ENV=${APP_ENV})."
fi

echo "[entrypoint] Starting server on port ${APP_PORT:-3000}..."
exec node --import @opentelemetry/instrumentation/hook.mjs --import ./apps/server/dist/apps/server/src/instrumentation.js ./apps/server/dist/apps/server/src/index.js
```

Three steps, always in this order: **migrate**, then **seed** (development and staging only — never production, guarded by an explicit `if`), then **start**. The migrate step runs `packages/database/dist/migrate.js`, which — as section F covers in detail — both applies Drizzle's pending migrations and runs `post-migrate-grants.sql` against the database, using the `batac_migrate` connection. Because this runs on *every* container start, both steps have to be idempotent: Drizzle tracks which migrations it's already applied, and the grants SQL is written to be safely re-run.

The last line does two things worth calling out precisely, because it's more specific than a simpler "just start the server" line would be. First, `exec` — not just `node ...` — replaces the shell process outright rather than running Node as a child of it, which matters because it means `dumb-init`'s signal forwarding reaches the actual Node process directly, with no shell in between to get in the way of a graceful shutdown. Second, and this is the detail that ties the whole chapter together: those two `--import` flags register OpenTelemetry instrumentation *before* `index.js` runs at all. That's the other end of the wire from section B's OpenObserve entry — the credential you saw decoded there, the `OTEL_EXPORTER_OTLP_ENDPOINT` pointing at `localhost:5080`, and this instrumentation hook are the same mechanism. And it's not only in the production entrypoint: `apps/server/package.json`'s own `dev` script is `tsx watch --import @opentelemetry/instrumentation/hook.mjs --import ./src/instrumentation.ts src/index.ts` — the identical pattern. Which means once you bring OpenObserve up locally in section G and run `pnpm dev`, your local server is already exporting traces to it, using the exact same code path production uses.

### `apps/web/Dockerfile`

```dockerfile
FROM node:22-alpine AS pruner
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune --scope=@batac/web --docker

FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY --from=pruner /app/out/full/ .

ARG VITE_APP_NAME="Batac City LGU"
ARG VITE_API_URL
ARG VITE_APP_URL
ARG VITE_SENTRY_DSN
ARG VITE_SENTRY_ENVIRONMENT

ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_URL=$VITE_APP_URL
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT

RUN pnpm --filter @batac/shared build && \
    pnpm --filter @batac/ui build && \
    pnpm --filter @batac/web build

FROM alpine:3.20 AS production
COPY --from=builder /app/apps/web/dist /app/dist
```

Same pruner/deps pattern as the server (this one uses `--scope=@batac/web` — the web package really is scoped, `@batac/web`, unlike the server package's bare name). The builder stage is where it diverges meaningfully: five `ARG`/`ENV` pairs for `VITE_*` variables. This is a genuinely different injection mechanism from everything the server uses. Vite compiles these directly into the JavaScript bundle at `build` time, because `/web` is a static single-page app with no server process behind it at runtime — there's nothing running later to read an environment variable from. Once this image is built, `VITE_API_URL` is frozen into the shipped JS; changing it means rebuilding the image, not restarting a container.

The production stage is the most minimal thing in either Dockerfile: `FROM alpine:3.20`, not even a Node base image, because this image never runs anything — its only job is to hold the compiled `dist/` output at a known path so `compose.prod.yml`'s `web-build` service (section C) can copy it out into the shared volume nginx serves from.

## E. The Real Nginx Config

```nginx
server {
    listen 80;
    server_name _;
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name ${APP_DOMAIN};

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols             TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache         shared:SSL:10m;
    ssl_session_timeout       1d;

    root  /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|woff2?|ttf|eot|svg|png|ico)$ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    location ~* \.html$ {
        add_header Cache-Control "no-cache, must-revalidate";
    }

    location = /health {
        proxy_pass http://server:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }

    location /api/ {
        proxy_pass         http://server:3000;
        proxy_http_version 1.1;
        proxy_set_header Host               $host;
        proxy_set_header X-Real-IP          $remote_addr;
        proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto  $scheme;

        proxy_set_header   Connection    '';
        proxy_buffering    off;
        proxy_cache        off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 10s;
    }

    gzip            on;
    gzip_vary       on;
    gzip_proxied    any;
    gzip_comp_level 6;
    gzip_types
        text/plain text/css text/javascript application/javascript
        application/json application/x-javascript image/svg+xml;
}
```

Nginx has exactly the two jobs the README describes: serve `/web`'s compiled static files, and reverse-proxy API calls to Fastify. Both server blocks here are doing real, specific work.

The first block is a plain HTTP-to-HTTPS redirect on port 80. The second, on 443, is where the substance is:

`root /usr/share/nginx/html` plus `try_files $uri $uri/ /index.html` is the standard single-page-app fallback: if a requested path doesn't match a real file, serve `index.html` instead of a 404, so client-side routing inside `/web` can take over and render the right screen itself.

The next two `location` blocks are a deliberate pair, not two unrelated rules. Vite's default build output hashes filenames (a new build produces `app.a1b2c3.js`, not `app.js`), so it's *safe* to tell browsers to cache those files aggressively and immutably for a full year — a stale cached copy can never collide with a new deploy, because a new deploy has a new filename. `index.html` is the opposite: `no-cache, must-revalidate` means the browser re-fetches it every time, which is exactly how it discovers the *new* hashed filenames after a deploy in the first place.

`location = /health` and `location /api/` both `proxy_pass` to `http://server:3000` — and that's the Fastify server, reached by its Compose service name, the same mechanism section A introduced. The `/api/` block carries three settings specifically for Server-Sent Events, which is this project's real-time notification mechanism: `proxy_set_header Connection ''` strips any `Connection: upgrade` header nginx might otherwise pass through (SSE is a plain long-lived HTTP response, not a protocol upgrade, so there's nothing to negotiate); `proxy_buffering off` stops nginx from holding onto response chunks until its buffer fills, which — left on — would turn a live notification stream into one that arrives in stalled bursts instead of instantly; and `proxy_read_timeout 3600s` / `proxy_send_timeout 3600s` keep that connection open for an hour instead of nginx's much shorter default, so it doesn't get cut mid-stream.

Nginx itself can't read `${APP_DOMAIN}` from the environment — it has no built-in mechanism for that in its config files — so the domain is injected a different way, at container start:

```sh
#!/bin/sh
set -e
envsubst '${APP_DOMAIN}' < /etc/nginx/templates/batac.conf.template \
  > /etc/nginx/conf.d/batac.conf
exec nginx -g 'daemon off;'
```

`envsubst` does a find-and-replace pass over the template and writes the result to the file nginx actually loads. The explicit `'${APP_DOMAIN}'` argument matters more than it looks: leaving it off would make `envsubst` replace *every* `$something` it finds in the file — including nginx's own variables like `$host`, `$request_uri`, `$scheme`, and `$proxy_add_x_forwarded_for`, all of which appear directly in this config, and all of which would be silently corrupted (replaced with empty strings) if `envsubst` weren't told to leave them alone.

## F. The Database Roles — What's Actually in the Init Script

Chapter 1.1 already told you why this project uses three separate database roles instead of one, and even told you there are really five roles total, not three — `batac_app`, `batac_audit`, `batac_migrate` as the ones that log in directly, plus `batac_it_admin` and `batac_readonly` as `NOLOGIN` roles reached via `SET ROLE`. This section isn't re-deriving any of that. It's showing you exactly where that design becomes real, mechanically, the first time you run `docker compose up`.

`compose.yml`'s `postgres` service bind-mounts `./tools/db/init:/docker-entrypoint-initdb.d:ro`. Every script the official Postgres image finds in that directory runs once — in filename order — the very first time the container initializes against a genuinely empty data volume, and never again after that, even across restarts, as long as the volume already has data in it. That's the entire trigger condition, and it's why `docker compose down -v` (which deletes the volume) is what you'd use if you ever needed these scripts to run again from scratch.

The real script, `tools/db/init/01-create-roles.sh`, does exactly what Chapter 1.1 described conceptually, and adds detail worth having now that you're looking at the actual mechanism:

```bash
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'batac_migrate') THEN
    CREATE ROLE batac_migrate WITH LOGIN;
  ELSE
    ALTER ROLE batac_migrate WITH LOGIN;
  END IF;
  ALTER ROLE batac_migrate PASSWORD '${DB_MIGRATE_PASSWORD:-migrate_devpassword}';
  GRANT ALL PRIVILEGES ON DATABASE "${POSTGRES_DB:-batac_lgu}" TO batac_migrate;
  GRANT CREATE ON SCHEMA public TO batac_migrate;
  -- ...batac_app, batac_audit follow the same IF NOT EXISTS / ELSE pattern...
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'batac_it_admin') THEN
    CREATE ROLE batac_it_admin WITH NOLOGIN;
  ELSE
    ALTER ROLE batac_it_admin WITH NOLOGIN;
  END IF;
  GRANT pg_monitor TO batac_it_admin;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'batac_readonly') THEN
    CREATE ROLE batac_readonly WITH NOLOGIN;
  ELSE
    ALTER ROLE batac_readonly WITH NOLOGIN;
  END IF;
END
\$\$;
```

Two mechanics worth having, that the design-level discussion in 1.1 didn't need to get into. First: PostgreSQL has no `CREATE ROLE ... IF NOT EXISTS`, so idempotency here comes from a `DO $$ ... $$` block that checks `pg_roles` directly and branches between `CREATE` and `ALTER` — the standard pattern for making role creation safe to reason about even outside the strict once-only trigger. Second: each role's password is set with a separate `ALTER ROLE ... PASSWORD ...` statement, deliberately not embedded inside the `CREATE ROLE` statement itself, per the script's own comment, so the credential doesn't sit in the same statement text a query log might capture.

The `GRANT CREATE ON SCHEMA public TO batac_migrate` line has a real story behind it, and it's a clean example of the exact mechanism the README describes for `docs/development-findings-log.md` — a place implementation-time findings get recorded when no pre-development document had the answer. Entry `LOG-0012`, dated 2026-06-30: running migrations against a genuinely fresh database failed with `permission denied for schema public`, because PostgreSQL 15 changed the default and revoked `CREATE` on the `public` schema from `PUBLIC` — and `batac_migrate` owns a shared trigger function, `public.fn_set_updated_at()`, that lives in that schema. The original init script had never granted that privilege explicitly, so it worked in some already-provisioned environments and failed on a truly clean one. The fix landed directly in this file, as the line you're looking at.

What this script does *not* do is create any schemas, tables, or fine-grained per-schema grants — at the moment it runs, none of that exists yet. That happens later, from `packages/database/scripts/post-migrate-grants.sql`, run by `packages/database/scripts/migrate.ts` over the `batac_migrate` connection, immediately after Drizzle's migrations create the schemas — which is also why this script runs once ever, while the grants file is written to be safely re-applied on every single migration run:

```sql
GRANT USAGE ON SCHEMA audit TO batac_app, batac_audit;
GRANT INSERT ON ALL TABLES IN SCHEMA audit TO batac_app, batac_audit;
REVOKE UPDATE, DELETE ON ALL TABLES IN SCHEMA audit
  FROM batac_app, batac_audit;
```

That's the append-only guarantee from Chapter 1.1 made concrete at the grant level: insert is allowed, update and delete are explicitly revoked from both roles that can touch the audit schema at all — a second, database-enforced line of defense underneath whatever the application code does or doesn't do correctly.

## G. Getting Started, Verified

Here's the README's five steps, each with what's actually happening underneath it, checked against the real files rather than assumed.

**`pnpm install`** — `pnpm-workspace.yaml` defines the workspace as `apps/*`, `packages/*`, and `tools/*`. `tech-stack.md` states the reason pnpm specifically was chosen for this, not npm or yarn: "symlink isolation enforces dependency boundaries — a package cannot accidentally consume another package's undeclared deps." In practice, this means every workspace package gets its own `node_modules` populated only with what it actually declared as a dependency, symlinked in — `@batac/web` can't accidentally import something only `@batac/database` happens to have installed, the way a single flat `node_modules` might quietly allow.

**`cp .env.example .env`** — Docker Compose automatically loads a file named exactly `.env` from the directory you run it in; that's not something the compose file has to ask for explicitly. `.env.example`'s own header is explicit that `.env` itself should never be committed.

**`docker compose -f compose.yml up -d`** — Worth knowing that `-f compose.yml` here is actually optional: `compose.yml` is Compose's default filename, resolved automatically with no flag at all, specifically so that running plain `docker compose up` can never accidentally target `compose.prod.yml` instead. This step starts `postgres`, `minio` → `minio-init` (waiting on MinIO's healthcheck first), and `mailpit`. Meilisearch, on its `search` profile, does not start — you'd need `docker compose --profile search up -d` for that, which is worth knowing since the README's own comment on this step lists Meilisearch alongside the others as if it starts by default.

**`pnpm --filter @batac/database db:migrate` then `pnpm db:seed`** — These resolve to real, different scripts than they might look like. `@batac/database`'s `db:migrate` is `tsx scripts/migrate.ts` — the same migrate logic the Docker entrypoint runs, just invoked directly against your host-run code instead of inside a container. The root `db:seed` script is `pnpm --filter server db:seed`, which resolves to `apps/server`'s own script, `tsx src/database/seeds/orchestrator.ts` — living inside `apps/server`, not inside `packages/database` the way the migrate step does, which is exactly the ambiguity the README's own parenthetical ("check packages/database for the exact script name") was hedging against for `db:migrate`, and it turns out that hedge would have been more useful pointed at `db:seed` instead.

**`pnpm dev`** — The root `dev` script is `turbo run dev`, and `turbo.json` marks that task `cache: false, persistent: true` — meaning Turborepo doesn't try to cache a dev server's output (there isn't one to cache) and knows this task isn't supposed to exit on its own. It runs `apps/web`'s `dev` script (plain `vite`) and `apps/server`'s `dev` script in parallel. And `apps/server`'s `dev` script carries the identical OpenTelemetry `--import` wiring the production entrypoint uses — so by the time this step finishes starting up, and given OpenObserve is already running from step three, your local server is already exporting traces to `http://localhost:5080`, the same OpenObserve dashboard from Chapter 1.9, using the same code path production does. That's the whole stack, genuinely alive, on your machine, at once.

One correction to the assumption behind this section: `INSTALL.sh` is not a more automated version of any of this. It's a design-system setup script — installing shadcn/ui components and their dependencies into `packages/ui` and `apps/web` (`pnpm dlx shadcn@latest add --cwd packages/ui button card input ...`), plus manual notes for wiring up a toast provider and a tooltip provider. It doesn't touch Postgres, Docker, or any of the five steps above, and there's no meaningful line-by-line comparison to draw against them.

---

# Chapter 2.1 — INFRA and AUDIT: Wave A and Wave B, Made Concrete

## A. What "INFRA" Actually Means as a Module

Chapter 0.1 introduced the vocabulary this chapter now puts to work. `A1-AGENTS.md` — the file governing how the project's Master Phased Task List was generated — defines a strict dependency ordering across the platform's modules, and it states that ordering as plainly as a piece of documentation gets:

> Wave A — no prerequisites (run in parallel):
>   INFRA, UI
>
> Wave B — needs INFRA task IDs (run in parallel):
>   IAM, AUDIT

Everything in this chapter sits inside those two lines. `INFRA` is Wave A: it depends on nothing else in the system. `AUDIT` is Wave B: it depends on `INFRA` and nothing else — not `IAM`, not `ORG`, not any domain module. This chapter is the first chapter of Arc 2 precisely because it's the first wave: the two modules a reader has to understand before any domain module (`DOCS`, `WF`, `TRACK`, and so on, arriving in later waves) makes sense, because every one of those later modules is built assuming `INFRA` and `AUDIT` already exist underneath it.

It's worth being precise about what kind of thing `INFRA` is, because it's easy to misread it as "just another module" sitting alongside `IAM` or `DOCS` in the wave list. It isn't. `infra.md` — the task list document that was itself generated for the `INFRA` module — says this about its own scope, and the wording is worth reading closely:

> the consolidated reference's Phase 1 "Included" list (Part 13) names `INFRA` only as a single trailing line item — "Infrastructure" — with no enumerated sub-capabilities of its own, since `INFRA` is not one of the 11 schema-owning domain modules

Every other module in the wave order — `IAM`, `ORG`, `DOCS`, `WF`, and the rest — owns a slice of the domain. `IAM` owns users and roles. `DOCS` owns documents. Each of those modules has its own Drizzle schema file describing tables that model something in the real world of Batac City's legislative process. `INFRA` owns none of that. It has no domain concept of its own — no "infra entity" analogous to a document or a workflow step. What it owns instead is the machinery every domain module needs before it can do anything at all: a validated database connection, a validated set of environment variables, the typed event bus other modules will publish and subscribe through, the Docker images the whole thing runs in, and the backup/DR procedures that protect all of it once it's running. `infra.md`'s own accounting of its Phase 1 scope lists nine deliverable areas — monorepo tooling, environment validation, local dev infrastructure, migration tooling, production container images, the health-check endpoint, the production Compose stack, CI/CD, and the full backup/DR runbook set — and not one of them is a table describing a real-world entity. They're all plumbing.

That's exactly why `INFRA` sits at Wave A with zero prerequisites, and why that placement isn't an arbitrary scheduling choice: everything else in the system needs a database connection before it needs anything else, needs validated configuration before it can trust any of its own settings, and needs the event bus before any two modules can talk to each other. `INFRA` needs none of that back. It's the floor the rest of the building sits on, and a floor has nothing to depend on beneath it.

## B. A Guided Tour of `/apps/server/src/infrastructure/`

Six files live in this directory. Here's what each one does, in the order you'd naturally encounter them if you traced a request through the running server.

### `database.plugin.ts` — where Chapter 1.1's Drizzle client actually gets built

Chapter 1.1 taught you Drizzle ORM as a concept: what a schema file is, how the append-only audit pattern and Row-Level Security fit together, why the project uses three separate database roles instead of one. This file is where that concept becomes a running object. Its top-of-file comment states its job plainly:

> `database.plugin.ts` — decorates `fastify.db` with an AsyncLocalStorage-aware proxy around the Drizzle ORM client for the `batac_app` PostgreSQL role.

The construction itself is short:

```typescript
async function databasePlugin(fastify: FastifyInstance): Promise<void> {
  const client = postgres(env.DATABASE_URL_APP);
  const baseDb: AppDb = drizzle(client);
  // ...proxy wiring...
  fastify.decorate('db', db);
}
```

Two things are worth noticing here that Chapter 1.1 didn't yet have code in front of it to show you. First: `env.DATABASE_URL_APP`, not a bare string — the connection string this plugin uses to construct the Drizzle client came from the validated environment schema this chapter's Section C is about to walk through in full, not from a raw `process.env` read. Second: this is specifically the `batac_app` role's connection, not `batac_audit`'s — you'll see in a moment that the audit module builds its own, entirely separate Drizzle instance, on its own connection pool, because the two roles have genuinely different privileges in Postgres.

The file goes further than a bare Drizzle client, though — it wraps `baseDb` in a `Proxy` that checks a module-level `AsyncLocalStorage` instance (`rlsStore`) on every method call, and delegates to a request-scoped transaction handle when one is active instead of the base client. The comment explains why: `SET LOCAL` GUC values used by Row-Level Security policies (the mechanism Chapter 1.1 covered under "which tables actually have it, precisely") only persist within a single Postgres transaction, so if a request's queries didn't all run inside the same transaction, RLS context set at the top of a request could silently stop applying partway through. The proxy exists to make "run this request's queries in the request's own transaction, transparently, without every call site having to know about it" actually true.

### `event-bus.plugin.ts` — where Chapter 1.7's event bus gets instantiated

Chapter 1.7 walked you through the shared `EventBus` class conceptually: the typed wrapper around Node's `EventEmitter`, per-handler isolation, and the dead-letter table for failed subscribers. This file is where a single, live `EventBus` instance gets constructed and attached to the running Fastify server:

```typescript
async function eventBusPlugin(fastify: FastifyInstance): Promise<void> {
  const deadLetterRepo = new DeadLetterRepository(fastify.db);
  const eventBus = new EventBus(fastify.log, deadLetterRepo);
  fastify.decorate('eventBus', eventBus);
}

export default fp(eventBusPlugin, {
  name: 'event-bus',
  dependencies: ['database'],
});
```

Notice the `dependencies: ['database']` array — this is Fastify's own plugin system (which Chapter 1.3 introduced) enforcing, at the framework level, exactly the ordering the wave-order concept describes at the architecture level. The event bus genuinely cannot construct itself without `fastify.db` already existing, because `DeadLetterRepository` needs a working Drizzle client to write failed-handler rows into `shared.event_bus_dead_letters`.

There's a precise, worth-reading-carefully note in this file's own top-of-file comment about where the `EventBus` class itself actually lives:

> Note this file deliberately does NOT use the `TypedEventBus` / `apps/server/src/infrastructure/event-bus.ts` shape shown in J1 ("Domain Event Pattern"). That shape is superseded by what `TASK-INFRA-023` actually built: a single `EventBus` class living in `packages/shared`

I checked, and this is accurate as stated: there is no `event-bus.ts` file anywhere in `/apps/server/src/infrastructure/`, under any name. The comment isn't describing a file that was deleted or a leftover reference to dead code — it's a candid note that an earlier planning document (`J1`) sketched one shape for this class, and the actual generated task (`TASK-INFRA-023`, which you read in `infra.md`) built a different one, at a different location (`packages/shared/src/event-bus.ts`, not under `apps/server` at all), and this comment is flagging that divergence honestly rather than silently. This is exactly the kind of thing Chapter 0.1 told you to expect: downstream planning documents can be superseded by what actually got built, and the discipline here is to say so plainly rather than pretend the two always agreed.

### `dead-letter.repository.ts` — the `IDeadLetterRepository` interface, concretely implemented

Chapter 1.7's tour of the event bus included a section on `IDeadLetterRepository` as an interface the `EventBus` class depends on rather than a concrete database class — precisely so `packages/shared` (which the `EventBus` lives in) never needs to import anything from `apps/server`. This file is the concrete implementation on the other side of that interface:

```typescript
export class DeadLetterRepository implements IDeadLetterRepository {
  constructor(private readonly db: AppDb) {}

  async insert(row: { /* ... */ }): Promise<void> {
    await this.db.insert(eventBusDeadLetters).values({ /* ... */ });
  }
  // fetchPending, markRetried, incrementRetry, markExhausted...
}
```

One method is worth quoting for a small, specific reason. `incrementRetry` needs to do column-relative arithmetic (`retry_count + 1`) and interval arithmetic (advance `failed_at` by a variable number of seconds), and Drizzle's fluent `.update()` builder doesn't support either directly — so this method drops down to a raw SQL template:

```typescript
async incrementRetry(id: string, backoffSeconds: number): Promise<void> {
  await this.db.execute(
    sql`
      UPDATE shared.event_bus_dead_letters
      SET
        retry_count = retry_count + 1,
        failed_at   = NOW() + (${backoffSeconds} * interval '1 second')
      WHERE id = ${id}
    `,
  );
}
```

This is a small, honest illustration of something Chapter 1.1 mentioned about Drizzle in general: it's a thin, typed wrapper over real SQL, not a full abstraction that hides SQL away — and when the fluent builder genuinely can't express something (arithmetic against a column's own current value), dropping to `sql\`...\`` is the documented, expected escape hatch, not a workaround.

### `mailer.plugin.ts` and `mailer.service.ts` — real infrastructure, no dedicated task

These two files decorate `fastify.mailer` with a `MailerService` wrapping `nodemailer`, configured entirely from the validated env schema (`env.SMTP_HOST`, `env.SMTP_PORT`, and so on — all fields you'll see cataloged in Section C). The service validates recipient addresses with a small Zod schema before ever calling `sendMail`, and there's a genuinely thorough unit test file (`mailer.service.test.ts`) covering both the validation-failure paths and the successful send path.

This is worth flagging precisely, because it's a real finding this chapter's brief specifically asked for: **there is no dedicated task for this plugin anywhere in `infra.md`.** I checked. `infra.md`'s only mention of the word "mailer" is a single parenthetical, inside `TASK-INFRA-008`'s description of what the server's Dockerfile bundles into one process — "node-cron, OCR, QR/PDF generation, Nodemailer, all in one process" — and nothing else. There's no `TASK-INFRA-XXX` whose deliverable is `mailer.plugin.ts` or `mailer.service.ts`, and no entry in the development findings log naming it either. The code is real, working, and registered in `app.ts` right alongside the other infrastructure plugins — it's simply undocumented as a discrete task. Section G returns to this.

## C. Environment and Config Validation: What the Real Code Actually Validates

Chapter 1.2 taught you Zod's shape as a validation library. Here's where it gets applied to the single most consequential validation job in the whole server: making sure the process refuses to start at all if its own configuration is broken. `tech-stack.md` — the tier-2, confirmed source in Chapter 0.1's hierarchy — states the rule this whole section is about in one table row:

> Env config | dotenv + Zod schema | **Fail fast on missing required vars at startup**

### The real validation entry point

`/apps/server/src/config/env.ts` is short enough to read in full:

```typescript
import 'dotenv/config';
import { loadDockerSecrets } from './load-docker-secrets.js';
import { serverEnvSchema } from './env.server.js';

loadDockerSecrets();

const result = serverEnvSchema.safeParse(process.env);

if (!result.success) {
  console.error('\n[FATAL] Environment variable validation failed at startup:');
  console.error(result.error.flatten().fieldErrors);
  console.error('\nThe application cannot start with an invalid configuration.');
  process.exit(1);
}

export const env = result.data;
```

This is a `safeParse`, not a `parse` — the code deliberately captures the failure case rather than letting Zod throw, so it can print a structured, actionable error (which fields failed, and why) before calling `process.exit(1)`. Every other file this chapter has quoted so far — `database.plugin.ts`, `event-bus.plugin.ts`, `mailer.service.ts` — imports `env` from this exact module and trusts its contents completely, because by the time any of that code runs, this file has already guaranteed the shape is valid or the process never got this far.

One addition beyond what the documented spec (`L1`'s §21.3) described: the real file calls `loadDockerSecrets()` before parsing. That function — `/apps/server/src/config/load-docker-secrets.ts` — reads a fixed set of Docker-mounted secret files (`/run/secrets/jwt_access_secret`, `/run/secrets/audit_hmac_secret`, and so on) into `process.env` if they exist and the corresponding env var isn't already set. I compared it against `L1`'s own documented version of this exact file, and it's a verbatim match — same `SECRET_MAPPING` object, same nine entries, same logic. This is the concrete implementation of `L1` §23.3's "Docker Secrets Integration" strategy, correctly wired into the actual startup sequence.

### The real Zod schema, compared field-for-field against `L1`

`env.server.ts` builds `serverEnvSchema` as one large `z.object({...})` with a `.superRefine()` for cross-field rules, following the exact same structure `L1`'s §21.2 documents and `TASK-INFRA-002`'s AI Prompt specifies verbatim. The bulk of it is a faithful, field-by-field match: every section — Core, Database, Authentication, Argon2id, Audit Log, S3 Storage, SMTP, OCR, Search, SSE, Sentry, Background Jobs, Cron Expressions, Rate Limiting, QR & Document Numbering, i18n, Feature Flags, Disaster Recovery, Backup, Portal, SMS — appears in the real file with the same variable names, the same Zod validators, and the same defaults as `L1` documents them. The four `superRefine` cross-field checks (Meilisearch URL required when the feature flag is on, TSA URL required when TSA export is enabled, backup encryption key required when backups are enabled, and the session-warning-must-be-shorter-than-timeout rule) are present in the real code, worded identically to `L1`'s version.

Where it diverges is small, specific, and worth reporting exactly rather than glossing as "mostly matches." I diffed every top-level variable name in the real `serverEnvSchema` against every variable name in `L1` §21.2's documented schema. Two categories of difference showed up:

**Two variables the real schema validates that `L1`'s §21.2 code listing omits — but `L1` documents them correctly elsewhere.** `LOG_DESTINATION` and `HEALTH_CHECK_PATH` are both present in the real `env.server.ts`, and both are genuinely documented — with a name, type, and default — in `L1` §13.2 and §13.3 respectively. They're simply missing from `L1`'s own §21.2 schema code block. This isn't a real code-vs-documentation gap; it's an internal inconsistency inside `L1` itself, and it's one `infra.md`'s Module Summary already caught and resolved during the generation phase:

> `[Inference]`-resolved internal inconsistency (not a cross-document conflict): L1 §13.2 and §13.3 document `LOG_DESTINATION` and `HEALTH_CHECK_PATH` respectively, with unambiguous name/type/default, but both are absent from L1 §21.2's own schema code listing. `TASK-INFRA-002` includes both fields, sourced from §13, to avoid breaking `TASK-INFRA-011`'s health endpoint. A human should reconcile L1 §21.2 against §13 directly.

The real code follows that resolution exactly — both fields are present, with the defaults `L1` §13 specifies (`stdout` and `/health` respectively). This is a documented gap that got closed correctly, not an unresolved one.

**Five variables the real schema validates that appear nowhere in `L1` at all.** `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OPENOBSERVE_QUERY_URL`, `OPENOBSERVE_QUERY_USER`, and `OPENOBSERVE_QUERY_PASSWORD` are all real, required-or-defaulted fields in `env.server.ts`, and I confirmed by direct search that none of the five appears anywhere in `L1`'s roughly 1,500 lines — not in §21.2, not in any other section, not in the Master Variable Catalog at the end. These aren't a documentation oversight of the same shape as the `LOG_DESTINATION` case above; `L1` simply predates them entirely. They belong to the OpenTelemetry/OpenObserve observability stack Chapter 1.9 covered as its own topic, and they're genuinely load-bearing in the real system — `OPENOBSERVE_QUERY_URL`, `_USER`, and `_PASSWORD` specifically back a real tRPC procedure (`audit.queryRuntimeLogs`, which Section G returns to) that queries OpenObserve for system logs. They're present and correctly filled in the repository's actual `.env.example` file too, so this isn't dead configuration — it's live, working, and simply never made it back into `L1`'s catalog.

No variable documented in `L1` §21.2 is missing from the real schema — the divergence runs in one direction only: real code validates more than `L1` catalogs, not less.

### The client schema

`/apps/web/src/config/env.client.ts` matches its documented counterpart (`L1` §21.4) essentially exactly — the same five `VITE_`-prefixed fields, the same defaults, reading only from `import.meta.env`, never `process.env`. This confirms the rule Chapter 1.2's end-to-end type safety material and `L1`'s own note both state: Vite only exposes `VITE_`-prefixed variables to the browser bundle, and nothing here reads a secret through that prefix.

## D. What "AUDIT" Concretely Means, and Why It's Wave B

If `INFRA` is the floor, `AUDIT` is the first thing built directly on top of it — and only on top of it. `audit.md`'s own document header states this precisely, in a sentence that ties directly back to `A1-AGENTS.md`'s wave definition from Section A:

> Generated per `A1-AGENTS.md` §6 "Step 2 — Module passes," for the `AUDIT` module (Wave B — depends on INFRA task list).

`AUDIT`'s Phase 1 capability list, as `audit.md` states it, is the tamper-evident, append-only log for every consequential thing that happens in the system: user logins and logouts, role assignments and revocations, delegation grants and expirations, document creation and state changes, workflow step assignments, completions, lapses, escalations — eighteen distinct event types in total, spanning `IAM`, `Organization`, `Documents`, and `Workflow`. And here's the detail that explains its wave placement precisely, rather than just asserting it: `AUDIT` needs `INFRA`'s event bus to exist before it can do its actual job, because its actual job is subscribing to events other modules haven't been built yet to emit. `TASK-AUDIT-004`'s AI Prompt states this directly:

> The audit event consumer is the Audit module's primary write path: it subscribes to every domain event on the shared in-process EventBus and writes each event to the audit log

And the rule governing every future module that gets built after `AUDIT` is explicit, too:

> Rule (B2 Module 8, enforced by ADR-API-001): Any new domain event added to the event bus MUST be registered with the Audit Event Consumer in the same PR that introduces the event. No event type may ship without an Audit subscription.

This is the concrete reason `AUDIT` sits at Wave B rather than somewhere later in the wave order, waiting until the domain modules that actually generate interesting events (`IAM`, `Documents`, `Workflow`) exist first. If `AUDIT` waited for those modules, every one of them would have to be built once without audit coverage and then retrofitted — exactly the "silent gap in the tamper-evident log" the audit consumer's own subscriber-isolation comment worries about. Building `AUDIT` early, right after `INFRA`, means that by the time `IAM`'s first `user.login` event ever fires for real, something is already listening.

## E. A Guided Tour of `/apps/server/src/modules/audit/`

Twelve non-test files live here (plus five test files under `__tests__/`, for the seventeen the reading list anticipated). Here's the real implementation, file by file, tracing the same path Chapter 1.1's `audit.schema.ts` walkthrough already gave you the target schema for.

### `audit.crypto.ts` — the real SHA-256 chain and HMAC

This is the pure-crypto foundation everything else in the module builds on, and it's worth quoting close to in full, because it's short and every line matters:

```typescript
export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export function canonicalizePayload(payload: unknown): string {
  if (payload === undefined) return '';
  const replacer = (_key: string, value: unknown) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const sortedObj: Record<string, unknown> = {};
      Object.keys(value).sort().forEach((k) => {
        sortedObj[k] = (value as Record<string, unknown>)[k];
      });
      return sortedObj;
    }
    return value;
  };
  return JSON.stringify(payload, replacer) ?? '';
}

export function computeChainHash(previousHash: string, payload: string): string {
  const hash = createHash('sha256');
  hash.update(previousHash);
  hash.update(payload);
  return hash.digest('hex');
}

export function signHmac(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

export function verifyHmac(payload: string, secret: string, signature: string): boolean {
  if (typeof signature !== 'string' || signature.length !== 64) return false;
  const expected = signHmac(payload, secret);
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}
```

`computeChainHash` is exactly `SHA-256(previousHash + payload)`, computed via two sequential `.update()` calls rather than a manual string concatenation — functionally identical to `TASK-AUDIT-002`'s documented `createHash('sha256').update(previousChainHash + canonicalPayload)`. `verifyHmac` uses `timingSafeEqual`, matching the documented spec's explicit instruction to avoid timing attacks, and it correctly guards the length check before the buffer comparison so a malformed signature can't throw instead of just returning `false`.

Two real, worth-naming precisely divergences from the documented spec:

**`GENESIS_HASH` is a hardcoded literal, not read from `AUDIT_GENESIS_HASH`.** `TASK-AUDIT-002`'s documented implementation reads `process.env.AUDIT_GENESIS_HASH ?? '0'.repeat(64)` — meaning the env var, which both `L1` §7 and `env.server.ts`'s own Zod schema (`AUDIT_GENESIS_HASH: z.string().length(64).default('0'.repeat(64))`) validate and document as configurable, is meant to actually control the genesis value. The real `audit.crypto.ts` never reads `process.env` at all here — `GENESIS_HASH` is simply `export const GENESIS_HASH = '000...'` (I confirmed it's exactly 64 characters, matching the required format). The practical consequence: `AUDIT_GENESIS_HASH` is validated at startup, is documented as configurable by both `L1` and the Zod schema itself, and has zero effect on the actual value used anywhere in the audit module.

**`canonicalizePayload` sorts recursively across the whole object, rather than using a fixed, explicit field order.** `TASK-AUDIT-002`'s documented spec explicitly serializes seven named fields (`eventType`, `actorId`, `targetId`, `targetType`, `payload`, `cityId`, `occurredAt`) in a fixed key order via a literal object construction. The real implementation instead accepts `unknown`, recursively walks any object structure via `JSON.stringify`'s replacer function, and alphabetically sorts every object's keys at every level of nesting — including inside `payload` itself, whose contents vary per event type. Both approaches achieve the acceptance criterion the task asked for ("the same fields in different input object key orders produce identical output strings") — the real approach is actually more general, since it guarantees determinism for arbitrarily-shaped payloads, not just the seven top-level fields the documented version explicitly listed. It's a different design than what was specified, not a broken one — but it is a genuine implementation choice the documented AI Prompt didn't anticipate.

### `audit.db.ts` — the separate connection, made concrete

This is where Chapter 1.1's "three database roles, not one" material gets its own dedicated connection pool:

```typescript
export function createAuditDb(databaseUrlAudit: string) {
  const pg = postgres(databaseUrlAudit, { max: 2, idle_timeout: 30 });
  return drizzle(pg, { schema: auditSchema });
}
```

The comment above it states the reasoning directly: `batac_app` has no `SELECT` on `audit.events`, so a Drizzle client built against `DATABASE_URL_APP` genuinely could not read the audit log even if application code accidentally tried. `Max: 2` connections is deliberate too — audit writes are serialized against each other (you'll see exactly how in a moment), so this pool never needs to be large.

### `audit.repository.ts` and `audit.write-service.ts` — where the grant-level restriction shapes the application code itself

`AuditWriteService.writeEvent()` is the single write path into the audit log, and it runs entirely inside one transaction:

```typescript
async writeEvent(input: AuditEventInput): Promise<void> {
  await this.repo.db.transaction(async (tx) => {
    const id = randomUUID();
    const occurredAt = new Date();
    const canonical = canonicalizePayload({ ...input, occurredAt: occurredAt.toISOString() });
    const prevHash = await this.repo.fetchPreviousChainHash(tx);
    const chainHash = computeChainHash(prevHash, canonical);
    const hmac = signHmac(canonical, this.env.AUDIT_HMAC_SECRET);
    await this.repo.insertEvent(tx, { id, cityId: input.cityId, eventType: input.eventType, /* ...remaining fields... */ chainHash, hmac, hmacKeyVersion: CURRENT_KEY_VERSION, occurredAt });
  });
}
```

The file's own comment states the boundary this whole chapter has been building toward, quoted verbatim from `ADR-API-002` and reproduced word-for-word in the real code:

> Note: The audit log is tamper-evident, not tamper-proof. A sufficiently privileged attacker holding both DB write access and the HMAC secret could insert records that pass validation.

`tech-stack.md`'s own phrasing of the same boundary is worth sitting with, since it says precisely what this means and doesn't mean:

> **Claim boundary:** The audit log is **tamper-evident, not tamper-proof.** Evidence of tampering can be detected. Prevention of tampering by a sufficiently privileged attacker (one who has both the DB write access and the HMAC secret) is outside the scope of this implementation.

The distinction is exact, and it's worth being precise about it rather than letting it blur. "Tamper-evident" means: if someone edits a row in `audit.events` after the fact — changes a `payload` field, alters an `actorId` — the chain hash for every subsequent row was computed against the *original* content of that row, so recomputing the chain on read will produce a mismatch and the system will report `chainValidationStatus: 'broken'`. The tampering leaves a detectable mark. It does not mean the tampering is *prevented* — nothing stops someone with sufficient database privileges from executing a raw `UPDATE` at the SQL level if the grant system allowed it (Section F is about exactly how the grant system doesn't allow it, for the ordinary path). And critically, it does not mean tampering is undetectable to a sufficiently resourced attacker: someone holding *both* direct database write access *and* the `AUDIT_HMAC_SECRET` value could, in principle, edit a row and recompute a valid HMAC and a valid forward chain from that point on, and the system would have no way to distinguish that from a legitimate record. That specific, narrow scenario — both the database and the secret compromised simultaneously — is the one case this design explicitly does not claim to defend against. It's why the HMAC secret is never stored in the database (Section C's env catalog confirms `AUDIT_HMAC_SECRET` lives only in the environment), and it's why the monthly RFC 3161 export exists at all: an external, independent timestamp anchor closes exactly this gap for any tampering that happens to bulk-delete or bulk-rewrite records *between* two monthly export points, since a comparison against the externally-timestamped snapshot would reveal the discrepancy even if the on-chain validation had been made to look "intact" by an attacker who also had the secret.

The concurrency mechanism in `fetchPreviousChainHash` is where the database-role restriction visibly shapes the application code itself, rather than staying an abstract policy:

```typescript
async fetchPreviousChainHash(tx: AuditTx): Promise<string> {
  // We cannot use .for('update') because the batac_audit role does not
  // have UPDATE privileges on audit.events (Security Invariant #3).
  await tx.execute(sql`SELECT pg_advisory_xact_lock('audit.events'::regclass::integer)`);
  const result = await tx
    .select({ chainHash: auditEvents.chainHash })
    .from(auditEvents)
    .orderBy(desc(auditEvents.sequenceNumber))
    .limit(1);
  return result[0]?.chainHash ?? GENESIS_HASH;
}
```

Two concurrent `writeEvent()` calls need to be serialized against each other — otherwise two transactions could both read the same "latest" `chain_hash` and compute two different rows that both claim to chain from it, corrupting the sequence. The conventional Postgres tool for this is `SELECT ... FOR UPDATE`, which places a row-level lock. But acquiring a `FOR UPDATE` lock requires the `UPDATE` privilege on the table — and `batac_audit`, as you'll see precisely in Section F, has that privilege explicitly revoked. So the real code reaches for a different Postgres primitive entirely — `pg_advisory_xact_lock`, a transaction-scoped advisory lock keyed on the table's OID — specifically because the row-lock approach isn't available to this role. This is a genuine, load-bearing example of a database grant decision reaching up and determining an application-layer implementation choice, not just gating what SQL statements are permitted.

### `audit.query-service.ts` — on-read chain validation, matching the documented four-step algorithm

`AuditQueryService.queryEvents()` implements exactly the four-step validation `TASK-AUDIT-005` specified: re-canonicalize each row's stored fields, verify its HMAC, resolve the expected previous hash, and recompute the chain hash for comparison. The real canonicalization on read explicitly includes every field the write path includes, with a comment explaining why nulls matter:

```typescript
// Null fields: AuditEventInput may contain null values for optional fields
// (e.g. resourceOfficeId: null). The write path includes those nulls in the
// canonical object — JSON.stringify serializes null as "null", not omitted.
// We must replicate that exactly: include all stored fields, including nulls.
```

This is worth a specific note: the write path canonicalizes the spread of the full `AuditEventInput` object plus `occurredAt`, while the read path hand-lists eight named fields explicitly. I checked whether these two approaches could actually diverge — and they can't, in practice, because `AuditEventInput` (defined in `index.ts`) has exactly those eight fields and no others: `eventType`, `actorId`, `targetId`, `targetType`, `resourceOfficeId`, `payload`, `cityId`, plus `occurredAt` added at write time. The two call sites are field-equivalent by construction, even though they're written in visibly different styles. `AUDIT_CHAIN_VERIFY_ON_READ=false` correctly bypasses the whole validation pass and returns `'intact'` unconditionally, exactly as documented.

### `audit.event-consumer.ts` — all eighteen subscriptions, present and accounted for

`registerAuditEventConsumer` builds one typed handler per event type via a `makeHandler` helper, exactly matching the documented pattern's structure. I counted: all eighteen event types from `TASK-AUDIT-004`'s table are present — `user.login`, `user.logout`, `session.terminated`, `role.assigned`, `role.revoked` under IAM; `delegation.granted`, `delegation.expired`, `delegation.revoked` under Organization; `document.created`, `document.state_changed`, `document.number_assigned` under Documents; and `workflow.step_assigned`, `workflow.step_completed`, `workflow.lapsed`, `workflow.escalated`, `workflow.certified_urgent_applied`, `workflow.manually_advanced`, `workflow.completed` under Workflow. Each handler follows the documented `resourceOfficeId` rule precisely — `null` for session and delegation events (no single owning office), the payload's `officeId` for document and workflow events. A small `getString` helper handles the reality that different upstream modules' event payloads use slightly different key names for "who did this" (`userId` vs `actorId` vs `grantorId` vs `completerId`), with a documented fallback-key pattern rather than assuming one universal shape.

### `audit.plugin.ts` and `index.ts` — the public API and the Fastify wiring

`index.ts` defines `AuditPublicAPI`, the module's public contract, with `writeEvent`, `queryEvents`, and a deliberately-named `_internal` escape hatch:

```typescript
export interface AuditPublicAPI {
  writeEvent(event: AuditEventInput): Promise<void>;
  queryEvents(filter: AuditQueryFilter): Promise<AuditQueryResult>;
  _internal: {
    repo: AuditRepository;
    writeService: AuditWriteService;
  };
}
```

The comment above `writeEvent` is specific about who's allowed to call it directly rather than going through the event bus, and it's worth noting since it constrains real code elsewhere in the system: "Confirmed callers: `Records.bulkOpHandler`... `Records.dispositionSvc`... Any additional direct caller must be documented in B2 Module 8 before merging." The `_internal` block is explicitly scoped to background jobs like the TSA export — not a general-purpose backdoor, but a deliberate, named exception for the one place (Section G will return to a second, less deliberate use of it) that genuinely needs lower-level access than the public interface exposes.

`audit.plugin.ts` wires all of this together — constructs the audit-specific Drizzle instance, builds the module via `createAuditModule`, decorates `fastify.auditService` and `fastify.auditTrpcRouter`, and registers the event consumer, all inside one `fp`-wrapped plugin declaring `dependencies: ['database', 'event-bus']`. One small inconsistency worth naming precisely: this plugin reads `process.env['DATABASE_URL_AUDIT']` and `process.env['AUDIT_HMAC_SECRET']` directly, with its own manual `if (!x) throw` guards, rather than importing the already-validated `env` object from `config/env.js` the way `database.plugin.ts` and `mailer.service.ts` both do. Functionally the outcome is nearly identical — the process still fails fast if either is missing — but it duplicates a validation check the top-level `env.ts` startup sequence already performs, rather than trusting it.

### `tsa.interface.ts`, `tsa.stub.ts`, `audit.tsa-export.ts` — matching the documented spec almost exactly

These three files are close to a verbatim match against `TASK-AUDIT-007`. `RfcTsaClient`'s single `timestamp(digest: Buffer)` method, `StubTsaClient`'s no-op console-warning implementation, and the monthly pgboss job (`audit:monthly-tsa-export`, cron `0 0 1 * *`) that compiles a snapshot, hashes it, submits to the (stub) TSA client, and records the export itself as an `audit_log_exported` event — all present, all matching. The one addition is a single `await boss.createQueue(TSA_JOB_NAME);` call before scheduling, which the documented spec doesn't mention but which is simply a newer pg-boss API requirement (explicit queue creation before scheduling work against it), not a substantive divergence in behavior.

## F. Append-Only Enforcement at the Grant Level, Not Just Convention

Chapter 1.1 introduced the three-role model conceptually: `batac_migrate` for DDL, `batac_app` for ordinary application reads and writes, `batac_audit` for the audit schema specifically. This section is where that model's teeth become visible in real SQL.

`TASK-INFRA-005`'s `post-migrate-grants.sql` — the script applied after every migration run — contains the exact statements that make `batac_audit`'s restriction real at the database level, not merely something application code has agreed to respect:

```sql
GRANT USAGE ON SCHEMA audit TO batac_audit;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA audit TO batac_audit;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit
  GRANT SELECT, INSERT ON TABLES TO batac_audit;
REVOKE UPDATE, DELETE ON ALL TABLES IN SCHEMA audit
  FROM batac_audit;
```

And `batac_app` — the role every other module's Drizzle client connects through — receives no grant on the `audit` schema at all. Not a restricted grant. No `USAGE`, no `SELECT`, no `INSERT`. `infra.md`'s Module Summary documents this as a corrected defect, worth reading because the correction itself is instructive:

> the original draft of `TASK-INFRA-005`'s `post-migrate-grants.sql` incorrectly granted `USAGE ON SCHEMA audit` and `INSERT ON ALL TABLES IN SCHEMA audit` to `batac_app`... **`batac_app` has zero access to the `audit` schema** — removed from all audit grants; aligns with C1 Part 12, B2 Prohibited Pattern P3

Now consider precisely what this means for the distinction between "a bug in application code" and "a bug that can actually corrupt the audit log." Suppose, hypothetically, a future developer working on the `Documents` module made a mistake — imported the wrong Drizzle client, or wrote a stray `UPDATE audit.events SET ...` somewhere it shouldn't be, believing they were touching a different table. If audit's append-only guarantee were enforced only by application-layer convention — "we just don't write UPDATE statements against this table, by policy" — that mistake would succeed. The database has no opinion about which TypeScript file a query originated from; it only has an opinion about which role issued it. Because `batac_app`'s connection has zero grants on the `audit` schema whatsoever, that hypothetical stray `UPDATE` doesn't get executed and then quietly succeed — it fails at the database with a permission-denied error, the moment it's attempted, regardless of what the calling code intended or how the bug got there.

And even for `batac_audit` itself — the one role that legitimately needs to touch this schema — the `REVOKE UPDATE, DELETE` statement means the write service you read in Section E literally cannot issue a successful `UPDATE` or `DELETE` against `audit.events`, even if a future change to `AuditWriteService` tried to. You saw this constraint's downstream effect directly in `fetchPreviousChainHash`'s use of `pg_advisory_xact_lock` instead of `SELECT ... FOR UPDATE` — that wasn't a stylistic choice, it was this exact `REVOKE` statement making the conventional approach unavailable and forcing a different one.

This is the categorical difference the chapter's brief asked for, stated precisely: application-layer convention is a promise the code makes to itself, and a bug can break a promise. A database grant revoked at the role level is not a promise — it's a permission that doesn't exist. The distinction between "tampering via a bug in application code" and "tampering via violating an application convention" collapses into the same failure mode when enforcement lives only in the application layer, because both are just "code that runs and does something unintended." When enforcement lives in the grant system instead, a bug in application code produces a `permission denied for schema audit` error at the database, not a silent, successful mutation of history.

## G. Documented Task Lists vs. Real Code: Concrete Findings

Section 0.1 of this material described the findings-log discipline — proposed, evidence-based, not silently patched — and this section applies the same discipline directly to what this chapter found. Here's a precise accounting, in both directions.

### Real capabilities not described in either task list

**A working `mailer.plugin.ts` / `mailer.service.ts` infrastructure plugin exists with no dedicated `infra.md` task.** As Section B noted, the only mention anywhere in `infra.md` is a single parenthetical inside `TASK-INFRA-008`. There's no findings-log entry for it either, and I confirmed `tech-stack.md` never names it as a discrete deliverable. The code itself is solid — a Zod-validated recipient check, a real unit test suite — but as a matter of the project's own documentation discipline, it's an undocumented deliverable.

**Five OpenTelemetry/OpenObserve environment variables are validated in real code and used by a real feature, with zero mention anywhere in `L1`.** `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OPENOBSERVE_QUERY_URL`, `OPENOBSERVE_QUERY_USER`, `OPENOBSERVE_QUERY_PASSWORD` — all five are in `env.server.ts`'s real schema, all five are populated in the shipped `.env.example`, and the three `OPENOBSERVE_QUERY_*` variables specifically back a real tRPC procedure. This connects to the next finding directly.

**The real `audit.router.ts` implements ten tRPC procedures where `TASK-AUDIT-006` documented exactly one.** `TASK-AUDIT-006`'s deliverable was `audit.queryEvents`, restricted to `sys_admin` and `auditor`. The real file has that procedure (retained and explicitly labeled "legacy, kept for backward compat"), plus nine more: `listOwnActions`, `listOwnOfficeDocumentActions`, `listFullLog`, `validateChainIntegrity`, and `exportEvents` — all attributed in the file's own comments to something called "TASK-PRE-03 (Path A, 2026-07-11)," a task ID that appears nowhere in `audit.md` — plus `queryRuntimeLogs`, `getDatabasePerformanceSnapshot`, `listSecurityLedger`, and `getSecurityLedgerEventTypes`, none of which carry any task attribution comment at all. The first five of these nine extend the *audit-log-reading* surface with genuinely more granular, role-differentiated procedures than the original single endpoint — `listOwnActions` for the ten operational roles reading their own history, `listOwnOfficeDocumentActions` for office-scoped ABAC reads keyed on the `resource_office_id` column Chapter 1.1's schema walkthrough covered, `listFullLog` and `exportEvents` restricted specifically to `auditor`, `validateChainIntegrity` walking the entire chain on demand rather than page by page. The last four are a different thing altogether: `queryRuntimeLogs` and `getDatabasePerformanceSnapshot` are gated on `ctx.auth.isItAdmin` rather than any audit role, and query OpenObserve (the Chapter 1.9 stack) for operational system logs and database performance data — not audit-log data at all. `getDatabasePerformanceSnapshot` is worth quoting because it's honest about its own incompleteness in a way that mirrors the findings-log discipline exactly:

```typescript
// [LOG-0132] Finding: There is no batac_it_admin-scoped connection path available.
throw new TRPCError({
  code: 'NOT_IMPLEMENTED',
  message: 'Blocking finding (LOG-0132): The required batac_it_admin-privileged connection path does not exist.',
});
```

`getSecurityLedgerEventTypes` also reaches past the `AuditPublicAPI` interface directly, via the `_internal.repo.db` escape hatch Section E described — its own comment explains why: "We bypass the AuditPublicAPI interface here to avoid modifying the core domain interfaces for a UI-specific dropdown requirement." None of this is inherently wrong — the `_internal` block exists precisely as a documented exception for exactly this kind of narrow, internal need — but it's real functionality substantially beyond what `audit.md` describes, built to support IT-Admin-facing system observability features that don't appear anywhere in the AUDIT module's Phase 1 capability list.

### Documented deliverables verified as present in real code

Not every finding runs in the direction of "undocumented addition" — it's worth being equally precise about what matches cleanly, since a report that only lists gaps would misrepresent how much of the documented spec actually landed correctly.

**`audit.schema.ts` is a near-exact match against `TASK-AUDIT-001`'s DDL.** Every column, every index (including the partial index on `resource_office_id`), both check constraints on `chain_hash` and `hmac`, and the complete absence of any `REFERENCES` clause or soft-delete columns — all present, all matching. The `resource_office_id` column specifically confirms that `[CONFLICT 1 → RESOLVED]` — the documented D-ABAC-04 resolution — was actually carried through into the shipped schema, not just resolved on paper.

**`load-docker-secrets.ts` is a verbatim match against `L1` §23.3.** Same nine-entry `SECRET_MAPPING`, same logic, no deviation.

**`tsa.interface.ts` and `tsa.stub.ts` match `TASK-AUDIT-007` almost exactly**, as Section E noted — the one difference (`boss.createQueue()`) is a pg-boss API-version detail, not a spec deviation.

**The `post-migrate-grants.sql` audit-schema grants match the corrected version documented in `infra.md`'s Module Summary**, including the specific `REVOKE UPDATE, DELETE` and the `batac_app`-has-zero-access rule Section F relied on directly.

### `L1` §5.1's own database table describes `DATABASE_URL_AUDIT` slightly differently than `TASK-INFRA-005` implements it

One more small, precise discrepancy, entirely within the documentation rather than between documentation and code: `L1` §5.1's connection-variable table describes `DATABASE_URL_AUDIT` as granting `batac_audit` "**`INSERT` only** on the `audit` schema." But `TASK-INFRA-005`'s actual grants — which Section F quoted, and which the real `post-migrate-grants.sql` matches — give `batac_audit` `SELECT, INSERT`, not `INSERT` alone. This isn't a code-vs-documentation gap; it's `infra.md`'s own Module Summary catching and correcting exactly this point during generation, for a concrete functional reason:

> a related defect was found: `batac_audit` was never granted `SELECT` on `audit.events`, which would have caused `fetchPreviousChainHash()` and `queryEvents()` to fail with a permission-denied error at runtime.

`L1` §5.1's table simply wasn't updated to reflect that correction — it still describes the pre-fix, INSERT-only version. The real code follows the corrected, `SELECT`-inclusive version, which is the only version that could actually work, given that `fetchPreviousChainHash` and `queryEvents` both genuinely need to read the table.

### A comment worth reading precisely, not glossing over

Finally, one small thing in `app.ts` itself, since re-reading it with this chapter's specific question in mind is exactly what the reading list asked for. Line 213's comment reads: `// Wave B infrastructure + module plugins, in dependency order.` — and it labels the five plugins registered directly below it (`databasePlugin`, `eventBusPlugin`, `mailerPlugin`, `auditPlugin`, `iamPlugin`) as a single group under that one "Wave B" label. But per `A1-AGENTS.md`'s actual wave definition — the one this chapter opened with — `databasePlugin`, `eventBusPlugin`, and `mailerPlugin` are `INFRA` deliverables, which is Wave A. Only `auditPlugin` and `iamPlugin` are genuinely Wave B. The comment's label is loose, not the registration order itself — the order (`database` → `event-bus` → `mailer` → `audit` → `iam`) is exactly right, and is in fact the clearest piece of real evidence in the whole codebase that the wave dependency is being honored in practice. But the label above it blurs a distinction this chapter has spent its whole length trying to keep sharp.

---

# Chapter 2.2: IAM — Authentication, Tokens, and the ABAC Engine

Chapter 2.1 covered INFRA and AUDIT — the module that receives events and writes an append-only, hash-chained log of what happened. This chapter covers the module that decides *who* is allowed to make something happen in the first place. IAM is the smallest-sounding name for the largest single concentration of security-critical logic in this codebase: password hashing, JWTs, refresh-token rotation, session locking, and the ABAC engine that every other module's permission checks ultimately run through.

You've already met pieces of IAM without knowing it. Chapter 1.4 showed `trpc.ts`'s `createContext` reading `req.auth` into a `Context` object, and showed `apps/web/src/lib/trpc.ts` reacting to a `423` response by flipping a Zustand store into a locked state. Chapter 1.7 showed the event bus's `EventPayloadMap` and traced `document.created` from Documents through to Audit's subscriber. This chapter is where both of those threads get their source: the `Context` type Chapter 1.4 read from is defined in `iam.types.ts`; the `423` Chapter 1.4's frontend code translated into a fake `401` is emitted by IAM's own middleware.

## A. The Authentication Flow, End to End

### Password hashing: Argon2id, with a specific, resolved parameter set

The b5 architecture document treats password storage as a genuinely deferred decision (`D-AUTH-02`) rather than an assumed default, and ADR-AUTH-002 is where it gets resolved. The adopted parameters are exact, not approximate:

> Adopt the proposed starting values — `m=65536 (64 MB), t=2, p=1` — as the Phase 1 default, exposed via environment variables (`ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM`) rather than hardcoded.

The rationale given is specific: these are OWASP's own published Argon2id baseline, not a value this team derived independently, and the ADR is explicit that this is a starting point rather than a final answer — it states plainly that "these values **must be benchmarked on the actual target server hardware** before production traffic. Benchmarking is not optional." The acceptance bar it names is concrete too: ≥19ms per hash on production-equivalent hardware, without unacceptable login latency under expected concurrent load. As of the b5 document's own closing section, that benchmarking is still an open item — the parameters are a real, principled default, not yet a verified one.

In the real code, this shows up in `apps/server/src/modules/iam/iam.service.ts`'s login flow as a direct call: `argon2.verify(credential.passwordHash, password)`. The `argon2` package here is `node-argon2`, a native binding to the reference Argon2 implementation — not a JavaScript reimplementation — and Argon2id specifically (rather than plain Argon2i or Argon2d) is the current OWASP-recommended variant because it combines Argon2i's resistance to side-channel timing attacks with Argon2d's resistance to GPU cracking, at the cost of being deliberately slow and memory-hungry. That's the entire point: a 64 MB memory cost means an attacker trying to brute-force a stolen hash can't cheaply parallelize the attack across many cheap machines, because each guess needs 64 MB of *fast* memory, not just CPU cycles.

Now for something I want to flag precisely rather than smooth over, because it's a real, checkable inconsistency and this is a security-critical module where "checkable" matters more than usual. I looked for every place in `iam.service.ts` where a *new* password actually gets hashed (as opposed to verified), and found three call sites with three different behaviors:

1. `changeOwnPassword` calls `argon2.hash(input.newPassword, { memoryCost: env.ARGON2_MEMORY_COST ?? 65536, timeCost: env.ARGON2_TIME_COST ?? 3, parallelism: env.ARGON2_PARALLELISM ?? 4, hashLength: env.ARGON2_HASH_LENGTH ?? 32 })` — explicit parameters, reading from the environment.
2. `createUserAccount` calls `argon2.hash(randomBytes(32).toString('hex'))` — no options object at all, for a temporary placeholder credential the user can never actually use (they must redeem a password-reset link before the account is usable).
3. `redeemPasswordResetToken` calls `argon2.hash(input.newPassword)` — also no options object, but this one *is* the real, user-chosen password protecting the account going forward.

Case 2 is low-stakes, since that hash never gates real access. Case 3 is worth pausing on: it means a password set via the reset-link flow — which, per `iam.md`, is also how every account gets its *first* real password, since `createUserAccount` never sets one directly — is hashed using `node-argon2`'s own bare library defaults, not this project's configured `ARGON2_MEMORY_COST`/`ARGON2_TIME_COST`/`ARGON2_PARALLELISM` values.

And even case 1's explicit fallbacks are worth checking rather than trusting at face value. I checked `apps/server/src/config/env.server.ts` directly, and the actual configured Zod schema defaults are:

```typescript
ARGON2_MEMORY_COST: positiveInt.default(65536),
ARGON2_TIME_COST: positiveInt.default(3),
ARGON2_PARALLELISM: positiveInt.default(1),
ARGON2_HASH_LENGTH: positiveInt.default(32),
```

`ARGON2_TIME_COST` defaults to `3`, not the `t=2` that ADR-AUTH-002 resolved and the b5 document's D-AUTH-02 row states. The `changeOwnPassword` call site's own inline `?? 3`/`?? 4` fallbacks would only ever fire if the environment variable resolved to literally `undefined`, which the Zod schema's `.default()` already prevents — those inline fallbacks are effectively dead code, and the number that actually governs `t` in practice is the schema's `3`, not the ADR's `2`. I want to be precise about what this is and isn't: it's not evidence that Argon2id is misconfigured to the point of being insecure — `t=3` is *more* hashing rounds than `t=2`, which is the safer direction to drift in, not the dangerous one, and `m=65536`/`p=1` both match the ADR exactly. But it is a genuine, verifiable gap between "what the ADR resolved" and "what the code actually runs," and it's exactly the kind of thing this project's own conventions (the append-only findings log, the explicit `[Inference]`/`[RESOLVED]` labeling throughout every architecture document) are designed to surface rather than paper over. If you're extending this module, checking the *actual* configured value rather than assuming the ADR's number is still current is a five-minute `grep` well spent.

### Access tokens: short-lived, RS256-signed JWTs

The access token lifetime is a range in the architecture doc — "15–60 minutes — configurable per environment via `JWT_ACCESS_TTL_SECONDS`" — narrowed to a specific default at the code level via `AUTH_JWT_ACCESS_EXPIRES_IN`, parsed by `iam.service.ts`'s own `parseExpiresInSeconds()` helper into a concrete second count used for both the JWT's `expiresIn` option and the cookie's `Max-Age`.

The signing algorithm is a genuinely interesting example of a decision that looks arbitrary until you read its ADR. ADR-AUTH-001 frames the choice as RS256 (asymmetric — a private key signs, a public key verifies) versus HS256 (symmetric — the same secret both signs and verifies):

> The team has confirmed SSO integration is a near-term priority, not a "someday" migration. **RS256** is selected.

The reasoning is specific to this project's stated intentions, not a generic "RS256 is more secure" claim: SSO means external relying parties will eventually need to *verify* tokens this server issues, without ever being trusted to *sign* new ones — which is exactly what asymmetric signing is for, and exactly what HS256 can't offer, since anyone who can verify an HS256 token also holds the same key needed to forge one. The ADR is honest that this decision has zero functional impact in Phase 1 itself, since no external party verifies tokens yet — it's purely a forward-compatibility bet, paid for now so it doesn't have to be re-litigated later.

In the real code, `iam.middleware.ts`'s `verifyJwt()` function reads `env.AUTH_JWT_ALGORITHM` and passes it straight into `jwt.verify(token, secret, { algorithms: [algorithm] })` — the algorithm is configurable rather than hardcoded to RS256, which is a sensible piece of flexibility (HS256 is genuinely easier for local development, where key-pair generation is friction with no corresponding benefit) as long as production configuration actually sets it to RS256, which is outside what any of the files I read can confirm from the code alone.

The claims themselves split into two groups, and the private-claims table in b5 §1.1 is worth reading closely because two of its fields resolve a real design tension. `oid` (primary office) and `is_ita`/`is_pa` (IT Admin / Platform Admin flags) are all baked into the token at issue time — not looked up fresh on every request — which matters because it means a role change doesn't take effect until the user's *next token refresh*, not immediately. b5 states this explicitly as a timing model, not an oversight: "Role changes that must take effect immediately (e.g., employee termination, emergency revocation) require a forced session termination." I confirmed this against the real `iamRouter`'s `assignRole`/`revokeRole` procedures, whose doc comments say the same thing verbatim: *"Role changes take effect on the next token refresh... If instant permission enforcement is required, use the force-terminate session functionality."* The `oid` claim also has a real, resolved nullability story worth knowing: not every `iam.users` row resolves to an office (an `organization.employees` row is nullable by design, and in Phase 1 the ORG module didn't exist at all when IAM shipped), so `oid` is typed `string | null` rather than defaulting to an empty string — a genuine bug that was caught and fixed, since `''` isn't a valid UUID and would throw when a Row-Level Security policy tried to cast it.

### Refresh tokens: opaque, server-side, and *rotated on every use*

This is the part of the architecture worth slowing down on, because "rotation" is a specific mechanism, not just a synonym for "the token eventually expires."

A refresh token here is not a JWT — it's 32 cryptographically random bytes (`crypto.randomBytes(32)`, base64url-encoded), stored server-side in `iam.refresh_tokens` as a SHA-256 hash with a per-token salt, never as the raw value. ADR-AUTH-004 is worth reading for *why* this table uses fast SHA-256 rather than the slow, deliberately-expensive Argon2id used for passwords — it's a genuinely good contrast case for understanding what Argon2id is actually protecting against:

> A 32-byte (256-bit) cryptographically random token has no guessing-feasible search space; an attacker who has obtained the `token_hash` column gains no practical advantage from the hash being fast versus slow, because brute-forcing a 256-bit random value is infeasible regardless of hash speed... Using Argon2id here would add meaningful CPU cost to every refresh-token validation... for no corresponding security benefit.

The distinction is entropy. Argon2id earns its cost specifically against low-entropy secrets — human-chosen passwords, which live in a search space small enough that a fast hash makes brute-forcing feasible. A 256-bit random token has no such weakness to compensate for; SHA-256 is already computationally infeasible to reverse for a value that random, and spending extra CPU making it *artificially* slower buys nothing, while genuinely costing something — this endpoint is rate-limited to 20 requests per minute per session specifically because refresh happens far more often than login.

Now, rotation itself. Set the refresh token lifetime aside for a moment — ADR-AUTH-003 resolved it at 14 days, a deliberate lengthening from the architecture document's original 7-day starting point, on the stated basis that infrequent staff access made re-login friction a bigger practical cost than the marginal security loss. Rotation is the mechanism that makes that 14-day window survivable. Every time the refresh endpoint is called, the presented token is marked used (`used_at = NOW()`) and a *brand-new* token is issued in its place, sharing the same `family_id` but carrying a new ID, new hash, new salt. The old token is now permanently spent — presenting it again isn't just declined, it's treated as a security incident.

I read this reuse-detection logic directly in `iam.service.ts`'s `refresh()` method, and it's worth walking through precisely, because the security property it delivers is genuinely elegant: **a stolen refresh token becomes useless after its next legitimate use.** Say an attacker somehow copies a valid refresh-token cookie value off a victim's machine. Two outcomes are possible, and both work in the defender's favor:

- If the attacker uses it *before* the legitimate user does, the attacker gets a fresh token pair, and the legitimate user's next refresh attempt — presenting the now-already-used original — trips the reuse check.
- If the legitimate user refreshes first (which happens automatically and often, since the frontend's silent-refresh logic from Chapter 1.4 fires on every `401`), the original token is marked used and rotated away *before the attacker ever gets to try it*. The attacker's later attempt to use the stolen (now-stale) token trips the same reuse check.

Either way, whoever uses the token *second* triggers detection — and detection here isn't a quiet log line. The real code:

```typescript
if (tokenRow.usedAt !== null) {
  await db.transaction(async (tx) => {
    const txRepo = createIamRepository(tx);
    await txRepo.revokeRefreshTokenFamily(tokenRow.familyId, 'reuse_detected');
    const session = await txRepo.findSessionById(tokenRow.sessionId);
    if (session && session.active) {
      await txRepo.terminateSession(session.id, 'reuse_detected', null);
    }
  });
  void auditService.writeEvent({ eventType: 'token_reuse_detected', /* ... */ });
  throw Object.assign(new Error('Session security event detected'), {
    code: 'UNAUTHORIZED', statusCode: 401,
  });
}
```

The entire *family* of tokens is revoked — not just the one presented — and the session itself is terminated. This is the "family-wide revocation on reuse" language from b5 §1.2 made concrete: rotation alone would only invalidate the one stolen token, leaving the family's *next* token (which the attacker might also have obtained, or might obtain next) still usable; family-wide revocation kills the whole chain in one move.

One more thing worth reporting honestly, because it's a genuinely careful piece of engineering the docs don't mention anywhere: the real code has a *second*, independent reuse check, past the one quoted above. Between the moment `refresh()` first checks `usedAt` and the moment it actually performs the rotating UPDATE, a small window exists where two concurrent requests could both pass the initial check. The repository's `markRefreshTokenUsed` guards against exactly this by making the UPDATE itself conditional:

```typescript
markRefreshTokenUsed: async (id, replacedById) => {
  const updated = await db
    .update(refreshTokens)
    .set({ usedAt: new Date(), replacedBy: replacedById })
    .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.usedAt)))
    .returning();
  return updated.length > 0;
},
```

If a concurrent request already claimed the token between the check and this UPDATE, `isNull(refreshTokens.usedAt)` is now false, the UPDATE matches zero rows, and `wasMarkedUsed` comes back `false` — at which point `iam.service.ts` runs the *exact same* family-revocation and session-termination logic as the main reuse-detection branch. This is documented nowhere in the architecture docs — it's a race condition the docs don't anticipate — but the code handles it correctly, with one honestly-flagged gap: the code's own comment on this branch reads *"Note: audit event intentionally omitted from this branch. Add follow-up audit write here if coverage for this race path is needed"* — a real, narrow, acknowledged gap rather than a silent one.

### Delivery: HTTP-only, Secure, SameSite=Strict cookies — and why not localStorage

Both tokens travel exclusively as cookies, never in a response body and never accessible to any JavaScript running on the page:

| Cookie | Name | Path | Attributes |
|---|---|---|---|
| Access token | `batac_at` | `/` | `HttpOnly; Secure; SameSite=Strict` |
| Refresh token | `batac_rt` | `/api/auth/refresh` | `HttpOnly; Secure; SameSite=Strict` |

If your prior experience is putting a JWT in `localStorage` and attaching it to requests via an `Authorization` header, it's worth being concrete about why this project deliberately avoids that, because "HTTP-only cookies are more secure" is a claim that's easy to accept without understanding *what* it actually protects against.

The core fact is this: JavaScript running on a page — including a script an attacker managed to inject via a Cross-Site Scripting (XSS) vulnerability, say through an unescaped user-supplied field rendered somewhere in the app — can read absolutely everything in `localStorage`. `localStorage.getItem('accessToken')` works identically whether the code calling it is your own React component or a malicious `<script>` tag smuggled in through a comment field that wasn't properly sanitized. If your access token lives there, one successful XSS injection anywhere in your entire frontend is enough to exfiltrate it, full stop.

An `HttpOnly` cookie is categorically different. The `HttpOnly` flag is a browser-level instruction that says: this cookie's value is attached to outgoing requests automatically, but `document.cookie` and every other JavaScript API simply cannot read it. Not "shouldn't" — *cannot*. Even a fully successful XSS payload, with complete run-of-the-page JavaScript execution, hits a wall it cannot get past: it can see that a cookie named `batac_at` exists, but never its value. This is precisely why b5 §2.1 states the attribute rationale as plainly as it does: *"Cookie is inaccessible from JavaScript. XSS attacks cannot read the token."*

The other two attributes close different gaps. `Secure` means the cookie is only ever transmitted over HTTPS — it's simply never sent in plaintext over an unencrypted connection, which matters against network-level eavesdropping rather than XSS. `SameSite=Strict` means the browser won't attach the cookie to a request originating from a different site at all — b5 is explicit that this attribute alone provides CSRF protection "without requiring a separate CSRF token on any endpoint," since a malicious site trying to forge a request to `batac-dms`'s API on a logged-in victim's behalf simply never gets the cookie attached to that cross-site request in the first place.

And the refresh cookie's `Path=/api/auth/refresh` scoping is a smaller but genuinely deliberate piece of defense-in-depth: the browser only attaches `batac_rt` to requests that literally go to that one path. Every other endpoint — including ones that might be more exposed to some future vulnerability class — never even sees the refresh token exists, narrowing its blast radius to exactly the one endpoint that's supposed to consume it.

## B. ABAC vs. RBAC — and a Real Policy Read Side by Side With Its Code

If you already know RBAC, you know the shape: a role grants a fixed set of permissions, and authorization is "does this user's role include this permission." It's simple to reason about and simple to configure — but it can't express a rule that depends on *which specific resource* is being accessed, only on the abstract action being attempted.

ABAC (Attribute-Based Access Control) generalizes this. A decision under ABAC can depend on attributes of the *subject* making the request, the *resource* being acted on, and — though this system's Phase 1 design doesn't lean on it heavily — the *environment* the request is happening in. b5 §5.1 states the specific limitation that motivates the switch directly:

> RBAC cannot express office-scoped access rules. The rule "a user may approve a document only if it is owned by their office and currently at a step assigned to their office" requires evaluating resource attributes (`document.office_id`, `step.assignee_office_id`) against subject attributes (`user.office_id`). This is a native ABAC concern.

Put plainly: RBAC alone can tell you "SP Secretary can approve documents" as an abstract capability. It cannot tell you "*this specific* SP Secretary can approve *this specific* document, because they both belong to the SP Secretariat" — that requires comparing an attribute of the person to an attribute of the thing, at the moment of the request, not at the moment a role was defined. This is exactly the "same office as the document" example the assignment framing anticipated, and it's the entire reason this system doesn't stop at RBAC.

The architecture isn't ABAC *instead of* RBAC, though — it's ABAC with RBAC as the entry point, and the distinction matters. RBAC answers a coarse first question ("does any role this person holds grant this abstract action at all?"); ABAC then *refines* that answer using resource attributes. b5 calls this two-layer split out explicitly: "RBAC defines which abstract actions a role may perform... ABAC policies in code enforce the attribute refinements." Platform Administrators configure the RBAC layer through an admin UI (Tier 2 in b5's authorization-tier model); the ABAC refinements are hardcoded logic, not configurable by anyone through the UI — which is itself a deliberate security property, since it means no misconfiguration through the admin panel can accidentally weaken an ABAC invariant like tenant isolation.

### The worked example: `document:read`, from spec to code

i1's policy specification for `document:read` (metadata) is a genuinely good complete example, because it exercises office scoping, an explicit cross-office grant mechanism, and a committee-membership carve-out all in one policy. Here's the spec, in full:

```
ALLOW IF:
  (
    -- Own office: any authenticated non-system role
    document.office_id ∈ subject.effective_office_ids
    AND subject.roles ∩ {
      'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
      'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
      'records_officer', 'auditor'
    } ≠ ∅
  )
  OR (
    -- Cross-office read: roles with explicit cross-office metadata access
    subject.roles ∩ { 'records_officer', 'sp_secretary', 'sp_presiding_officer',
                       'mayor', 'auditor' } ≠ ∅
    AND document.classification_level IN ('public', 'internal')
    AND has_cross_office_read_grant(subject, document.office_id) = true
  )
  OR (
    -- SP Members: documents in their assigned committees or SP sessions
    subject.roles CONTAINS 'sp_member'
    AND (
      document is assigned to a workflow step whose assignee_office_id
      matches a committee in subject.committee_ids
      OR document has been read into an SP session
    )
  )
  OR (
    -- Public classification: all authenticated users + unauthenticated portal users
    document.classification_level = 'public'
  )
```

Notice what's genuinely ABAC about this, beyond just checking a role: the first branch compares `document.office_id` — an attribute of the *resource* — against `subject.effective_office_ids` — an attribute of the *subject*, and the two only match if the person's own office happens to line up with the document's owning office. That comparison is the whole mechanism; there's no role anywhere that unconditionally grants "read any document" independent of this office match.

The second branch is worth a closer look, because it's a real, resolved piece of design (`D-ABAC-03`) with its own SQL function, `has_cross_office_read_grant()`:

```sql
CREATE FUNCTION has_cross_office_read_grant(
  p_user_id UUID,
  p_target_office_id UUID
) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization.cross_office_grants g
    WHERE g.user_id = p_user_id
      AND (g.office_id = p_target_office_id OR g.office_id IS NULL)
      AND g.revoked_at IS NULL
      AND (g.expires_at IS NULL OR g.expires_at > now())
  );
$$;
```

i1 is explicit that this function only answers "can this person read across offices at all" — a boolean grant/no-grant, not "at what level of detail." The document is upfront that a second dimension (`access_level`, distinguishing metadata-only from full-content cross-office access) exists in the underlying `organization.cross_office_grants` table's schema but isn't yet enforced by this function, and flags that as a known, deliberately-not-built-out limitation rather than a silent gap — the kind of honesty about what's actually finished versus merely scaffolded that runs through this whole documentation set.

Now, the code side. I went looking for this policy's implementation in `iam.policy.ts`, and here's the honest, complete finding: **it isn't there.** `iam.policy.ts`'s `PolicyEvaluator` only has two registered resource handlers at construction — `session` and `delegation_grant`. There's no `document` handler in the IAM module at all, and that's actually correct rather than a gap: b5 §5.5's own implementation note says the evaluator is "a single service callable from both Fastify `preHandler` hooks and tRPC procedure guards," and `PolicyEvaluator.registerResourceHandler()` exists specifically so that *other* modules can register their own resource-specific policy logic against the same shared evaluator instance. Document-shaped policies belong to, and presumably live in, the Documents module — outside what this chapter's reading list covers directly, and I'm not going to claim to have verified code I haven't read.

What IAM *does* own directly, and what I can walk through completely side by side with its spec, is the `session` resource handler — and it's a genuinely clean match. Here's i1 §12's specification, in full:

```
12.1 session:read_own    → ALLOW IF session.user_id = subject.user_id
12.2 session:read_all    → ALLOW IF subject.is_ita = true
12.3 session:force_terminate →
  ALLOW IF subject.is_ita = true AND mandatory_reason field is non-empty
  REQUIRED: reason stored in iam.sessions.termination_reason
            AND audit_event 'forced_logout' emitted with actor_id,
            target_user_id, session_id, and reason
```

And here's the real handler, `sessionResourceHandler`, from `iam.policy.ts`:

```typescript
function sessionResourceHandler(
  subject: SubjectContext,
  resource: ResourceDescriptor,
  action: string,
  context?: Record<string, unknown>,
): EvaluationResult {
  switch (action) {
    case 'read_own':
      if (resource.userId === subject.userId) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'session_action_not_permitted' };

    case 'read_all':
      if (subject.isItAdmin) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'session_action_not_permitted' };

    case 'force_terminate': {
      const reason = context?.['reason'];
      if (subject.isItAdmin && typeof reason === 'string' && reason.length > 0) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'session_action_not_permitted' };
    }

    default:
      return { allowed: false, reason: 'session_action_not_permitted' };
  }
}
```

Line for line, this is the spec: `read_own` compares a resource attribute (`resource.userId`) to a subject attribute (`subject.userId`) — genuinely ABAC in miniature, not just a role check; `read_all` and `force_terminate` both gate on `subject.isItAdmin`, matching `subject.is_ita` in the spec's own notation (the private-claims table earlier in this chapter already told you why the field is spelled `isItAdmin` in code versus `is_ita` in the raw JWT — this is the same claim, read through the `AuthContext` shape rather than the wire format); and `force_terminate` specifically checks that `context.reason` is a non-empty string before allowing, matching the spec's "mandatory_reason field is non-empty" condition exactly.

There's a bonus here worth reporting, since it wasn't something the assignment specifically asked me to find: `iam.policy.ts` also registers a `delegationGrantResourceHandler`, sourced (per its own comment) from `TASK-ORG-005` rather than an IAM task — meaning this handler was added by the ORG module's own work, reaching into IAM's shared `PolicyEvaluator` the same way `registerResourceHandler` is designed for. Its `create` action matches i1 §11.1's rule (`subject.roles CONTAINS 'sp_secretary'`) and its `revoke_early` action matches §11.2's two-branch rule almost exactly — the delegating party may always revoke their own grant, or the SP Secretary may revoke it *only* given a documented written instruction, checked via a `context.writtenInstructionReference` field that must be a non-empty string. It's a good second confirmation that this project's policy specs and policy code stay in genuine sync, at least for the resource types I was able to check directly.

## C. `iam.middleware.ts`: Turning a Cookie Into `ctx.auth`

Chapter 1.4 showed you `trpc.ts`'s `createContext` reading `auth: (req as any).auth || null` and handing it into every tRPC procedure as `ctx.auth`. This section is where `req.auth` actually gets populated — the other end of that same wire.

`iam.middleware.ts` implements four Fastify `preHandler` hooks, registered together as `authMiddlewarePlugin`, and run in this order on every protected route:

**Hook 1 — `verifyAccessToken`.** This is the one that actually does the cryptographic work. It pulls the raw cookie header, manually parses out the `batac_at` value (no cookie-parsing library — just a `split(';').map(trim).find(...)`), and calls `jwt.verify(token, secret, { algorithms: [algorithm] })`. If the cookie is missing or the signature/expiry check throws, the request is rejected with a `401` before anything else runs. If it passes, the hook loads the session row by the JWT's `sid` claim and checks `session.active` — a JWT can be cryptographically perfect and still correspond to a session that's been terminated, which is exactly the "immediate revocation" property a stateless-only JWT scheme can't offer on its own. Then, and this is the moment that matters most for this chapter's later sections, the **locked-session check**:

```typescript
if (session.locked_at !== null && request.url !== '/api/auth/unlock') {
  return reply.code(423).send({ code: 'SESSION_LOCKED', message: 'Session is locked' });
}
```

That's the exact `423` Chapter 1.4's `trpc.ts` catches and rewrites into a fake `401` before Zustand ever sees it. Right after that comes the inactivity check — if `Date.now() - session.lastActivityAt.getTime()` exceeds `AUTH_SESSION_INACTIVITY_TIMEOUT_MS` (30 minutes by the documented default), the session is terminated, its refresh tokens are revoked, both cookies are cleared, and the request is rejected — a real, server-side enforcement of the 30-minute rule b5 §4.4 describes, independent of whatever an idle timer in the browser thinks is happening. Only after all of this passes does the hook build the actual `AuthContext` object and assign it to `request.auth` — this is the literal moment `req.auth`, the field `trpc.ts`'s `createContext` reads, becomes non-null.

**Hook 2 — `loadDelegationContext`.** If the JWT's `dg` claim is non-null, this hook calls `fastify.iamService.resolveActiveDelegationGrant(...)` and — if the grant is still valid — expands `auth.effectiveOfficeIds` and `auth.effectiveRoles` to include the delegation's scope. If the grant resolver comes back `null` (not found, expired, or revoked), the hook clears `delegationGrantId` on the auth object rather than letting a stale reference flow downstream into an ABAC check that might trust it. Worth noting explicitly: this is where `subject.effective_office_ids` — the field the `document:read` policy spec compares against `document.office_id` — actually gets its final shape for the request. Hook 1 alone only gives you the primary office; Hook 2 is what makes delegation-extended office scope real.

**Hook 3 — `setDatabaseSessionVars`.** This one is doing something considerably more involved than its name suggests, and it's worth understanding precisely because it's the actual mechanism connecting the ABAC layer to the Row-Level-Security layer b5 §6 describes as a second, independent enforcement backstop. The hook opens a genuine PostgreSQL transaction and, inside it, runs `set_config('app.current_user_id', ..., true)` for five separate GUC (Grand Unified Configuration) variables — user ID, office ID, city ID, role tier, and the IT-Admin/Platform-Admin flags — using `SET LOCAL` semantics (the `true` third argument), meaning these values are scoped to the transaction and automatically cleared when it ends. This is precisely what lets an RLS policy like `USING (city_id = current_setting('app.city_id', true)::uuid)` work at all: the database itself, independent of any application code, can see who's asking.

The file's own comments document a real, fixed bug worth knowing about if you're reading this code for the first time: an earlier version ran `SET LOCAL` in an auto-committed implicit transaction, which meant the GUC values were discarded before any subsequent query in the same request could ever observe them — a bug serious enough to get its own fix task (`TASK-IAM-041`) and its own findings-log entry. The current version keeps the transaction genuinely open for the request's entire lifetime via a "split-wait Promise bridge" — one promise resolves once the GUCs are set (letting Hook 3 return so the rest of the request can proceed), a second stays pending until an `onResponse` hook fires at the very end, committing on success or rolling back on any response ≥ 400. It's a subtle piece of async plumbing, but the property it buys is exactly right: every query issued anywhere during that request — by any hook, any procedure, any repository call — runs inside the same transaction and sees the same session variables, and a failed request rolls back cleanly rather than leaving partial writes behind.

One detail this hook gets specifically right, worth calling out because b5's own documentation flags it as a real historical bug: when `auth.officeId` is `null` (a user with no resolved primary office, the expected case for essentially every Phase 1 login before the ORG module existed), `set_config('app.current_office_id', null, true)` sets the GUC to genuine SQL `NULL`, not the three-character string `'null'`. That distinction matters enormously for any RLS policy that casts the setting `::uuid` — casting real `NULL` evaluates the comparison to `NULL` (which PostgreSQL treats as "no match, exclude this row" in a `WHERE` clause), while casting the *string* `'null'` throws `invalid input syntax for type uuid` and breaks the request outright. The comment in the code cites `LOG-0025` in the findings log as the origin of this fix — a genuine example of the append-only-log mechanism you read about in Chapter 0.1 doing exactly its intended job.

**Hook 4 — `updateLastActivity`.** The simplest of the four: one `UPDATE iam.sessions SET last_activity_at = NOW()`, on every authenticated request, which is what the inactivity check in Hook 1 measures against on the *next* request.

After all four hooks succeed, the route handler finally runs with a fully-populated `request.auth` — and because `trpc.ts`'s `createContext` reads exactly that field (`auth: (req as any).auth || null`), every `protectedProcedure` in the tRPC layer receives it, already typed non-null, already carrying every attribute the ABAC evaluator needs. The loop back to Chapter 1.4 closes precisely here: `protectedProcedure`'s middleware you already read checks `if (!opts.ctx.auth) throw UNAUTHORIZED` — and it can only ever see a non-null `auth` because these four Fastify hooks ran first and put it there.

## D. Session Locking — the Same 423 From the Other Side

Chapter 1.4 showed you the frontend's reaction to a `423`. This section is the mechanism that produces it, and — since this is a feature that spans a real UX decision, a database column, and one specifically resolved ADR — it's worth walking through what "locking" actually means in this system before getting to the code.

Locking is explicitly **not** logging out. b5 §4.6 describes it in plain UX terms: a "Switch User / Lock Screen" action — the kind of thing a clerk might trigger before stepping away from a shared office terminal — that suspends the session rather than ending it. The mechanism is a single nullable timestamp column, `iam.sessions.locked_at`. Setting it locks; clearing it unlocks. While it's set, `iam.middleware.ts`'s Hook 1 rejects every route except the unlock endpoint itself with a `423 Locked` — the exact status this project's frontend, per Chapter 1.4, catches and repackages into a fake `401` before handing control to `useSessionStore.getState().setIsLocked(true)`.

The interesting design question — the one ADR-AUTH-010 exists to answer — is what happens when the access token *expires while the session is locked*. Someone locks their screen, steps away for forty minutes (longer than the JWT's lifetime but nowhere near the refresh token's 14-day one), comes back, and enters their password to unlock. Does that fail because the access token underneath has technically expired?

ADR-AUTH-010's answer is no, and its reasoning is worth reading closely because it's a genuinely well-argued piece of security design, not just a convenience shortcut:

> **Silent refresh on unlock**, gated only on the existing refresh-token validity check already described in Section 1.2 of B5 (not found / already used / revoked / expired)... The user is not separately asked to do anything about token expiry; it's invisible to them... A full re-login is required only if the refresh token itself is invalid per those existing checks, not merely because the access token expired while locked.

The key move here is recognizing that **re-entering the password at unlock time already *is* the security control** — asking the person to additionally deal with token expiry would be demanding a second proof of identity for something the first one already covers. The refresh token, meanwhile, has been quietly rotating in the background throughout the lock, specifically so it's still valid whenever the person returns — b5 §4.6 states this rotation-during-lock behavior exists precisely "to maintain token freshness when the user unlocks," and ADR-AUTH-010 is explicit that it's simply using the mechanism the architecture already built for this exact purpose, not introducing new behavior.

The real implementation, `unlockSession()` in `iam.service.ts`, matches this precisely. It first verifies the session is still active and locked (returning early, idempotently, if it's already unlocked), then requires a correct password via `argon2.verify(...)` — failing this leaves `locked_at` untouched, which the code is careful about, since a wrong-password attempt must never accidentally clear the lock. Only *after* the password check succeeds does it branch on `isAccessTokenExpired`:

```typescript
if (isAccessTokenExpired) {
  const latestRt = await iamRepo.findLatestActiveRefreshTokenForSession(sessionId);
  if (!latestRt || latestRt.expiresAt < new Date() || latestRt.revokedAt !== null) {
    throw Object.assign(new Error('Your session has expired. Please log in again.'), {
      code: 'REFRESH_REQUIRED', statusCode: 401,
    });
  }
  // ... full token rotation: mark old used, insert new, sign new JWT, build new cookies
} else {
  await iamRepo.updateLastActivity(sessionId);
}
```

If the access token was still valid, unlocking is just a lockout-clear plus an activity-timestamp bump — no new cookies at all. If it had expired, the code looks for a still-valid refresh token for that session and, if one exists, performs the *exact same* rotation logic used by the standalone `/api/auth/refresh` endpoint — new random token, new hash, new salt, same `family_id`, a freshly-signed JWT via the same `buildAccessTokenClaims()` helper login and refresh both use. Only if no valid refresh token can be found does the code return `401` with `code: 'REFRESH_REQUIRED'`, forcing a genuine full re-login — and that's the *only* condition ADR-AUTH-010 says should trigger one. Token expiry alone, while locked, is invisible housekeeping; refresh-token invalidity is the real line.

Worth naming precisely, since it's a fair question a careful reader might ask: doesn't this mean a stolen-but-locked workstation could theoretically be revived by anyone who learns the password, any time within a 14-day window? ADR-AUTH-010 doesn't dodge this — it states it as a deliberate, understood consequence of combining this decision with the 14-day refresh lifetime from ADR-AUTH-003, and explicitly considers and rejects introducing a separate, shorter "maximum session age" ceiling as a fix, on the grounds that doing so would directly undercut the entire reason ADR-AUTH-003 chose 14 days in the first place (minimizing re-login friction for staff with infrequent access). If a stricter policy is ever wanted, the ADR says plainly that it would need its own deliberate decision — it isn't smuggled in by default here. The password re-entry, again, is treated as the real control; the token machinery underneath is just plumbing.

## E. Account Lockout — Progressive Delay, Not a Hard Lockout

This is the other place `iam.md` and ADR-AUTH-007 pointed to a specific, resolved policy with exact values, and it's worth understanding the *reasoning* before the table, because the obvious-seeming alternative (lock the account after N failures) has a real, specific flaw this design was chosen to avoid.

ADR-AUTH-007 states it directly:

> A hard account lockout after N failures is itself a denial-of-service vector: an attacker who only wants to lock a privileged account out of legitimate use... can do so by deliberately triggering the lockout.

Think through what that means concretely: if five wrong passwords locked an account for an hour, an attacker with zero interest in actually breaking in could deny a legitimate Mayor or SP Secretary access to the system simply by typing wrong passwords at their username, five times, from anywhere. The fix this project adopted instead is a **progressive delay** — the account is never fully locked, but each additional failure makes the *next* attempt take longer to even receive a response:

| Failures (this account, any IP) | Response |
|---|---|
| 1–5 | Normal response time |
| 6 | 30-second delay |
| 7 | 60-second delay |
| 8 | 2-minute delay |
| 9 | 5-minute delay |
| 10+ | 15-minute delay (repeats, does not escalate further) |

A legitimate user who's simply mistyped their password five or six times in a row experiences, at worst, a noticeably slower login — never a hard wall. An attacker attempting to brute-force a password faces the same escalating cost curve real brute-forcing always needs to defeat, without ever gaining the ability to lock someone else out entirely.

The real implementation lives in `iam.service.ts` as `computeLockoutUntil()`, and it's a direct, line-for-line match to the table above:

```typescript
function computeLockoutUntil(newFailureCount: number): Date | null {
  let delaySec: number | null = null;
  if (newFailureCount === 6) delaySec = 30;
  else if (newFailureCount === 7) delaySec = 60;
  else if (newFailureCount === 8) delaySec = 120;
  else if (newFailureCount === 9) delaySec = 300;
  else if (newFailureCount >= 10) delaySec = 900;
  if (delaySec === null) return null;
  return new Date(Date.now() + delaySec * 1000);
}
```

The state this needs — a per-account failure counter and a lockout deadline — is real, checkable schema, not a placeholder: `iam.users` carries both `loginFailureCount` (integer, default 0) and `loginLockedUntil` (nullable timestamp) as genuine columns, confirmed directly against `packages/database/schema/iam.schema.ts`. Login's step 5 checks `user.loginLockedUntil !== null && new Date() < user.loginLockedUntil` and, if so, rejects with a `429` carrying a `Retry-After` header computed from the remaining seconds — the person gets told *how long* to wait, not just that they're blocked. A wrong password increments the counter and recomputes the delay via `computeLockoutUntil`; a *successful* login calls `iamRepo.resetLoginFailure(user.id)`, zeroing both fields back out.

One piece ADR-AUTH-007 leaves genuinely, honestly open rather than guessing at: the threshold for firing an administrator-facing alert once repeated failures cross some volume. The ADR states plainly that this number "depends on expected legitimate failure-rate volume... which has not been measured," and recommends it be set from real post-launch traffic data rather than invented now — a good example of this project's discipline about not fabricating a number just to fill in a table. Every failure is still audit-logged regardless (I confirmed `login_failed` events carry `attempted_identifier_hash`, the SHA-256 of the attempted username — never the plaintext, matching b5 §10.3's audit-payload table exactly); it's specifically the *alerting threshold* on top of that logging that remains an open, deliberately-deferred value.

## F. The Published API Surface — Checking `index.ts` Against the Documented Rule

Chapter 0.1/J4 described a documented rule for every module's `index.ts`: it's supposed to be a pure barrel file, exporting only the module's Published API interface and the public types callers need — explicitly *not* service implementations, repository implementations, or Fastify plugin registrations. The assignment for this chapter asked me to check IAM's real `index.ts` against that rule directly, rather than assume the prior research holds. Here is the entire file:

```typescript
export type { AuthContext, IamPublicAPI } from './iam.types.js';
export type { ResourcePolicyHandler, ResourceDescriptor, EvaluationResult } from './iam.policy.js';
export { PolicyGuard, PolicyEvaluator } from './iam.policy.js';
export { authMiddlewarePlugin } from './iam.middleware.js';
```

Going through it against J4's rule line by line: the first two lines are entirely `export type` statements — `AuthContext`, `IamPublicAPI`, and three policy-related type aliases — which is exactly what the rule permits. The last two lines are where it diverges. `export { PolicyGuard, PolicyEvaluator }` re-exports two real classes — implementation, not types — and J4's own "Must not contain" list names "Service factory functions or implementations" explicitly. `export { authMiddlewarePlugin }` is even more directly named in that same list: "Fastify plugin registration." I confirmed independently, by reading `iam.middleware.ts` directly, that `authMiddlewarePlugin` genuinely is a Fastify plugin — it's built with `fp(iamPlugin, { name: 'auth-middleware', dependencies: ['iam'] })`, the same `fastify-plugin` wrapper every other plugin in this codebase uses.

So the honest answer, checked fresh rather than assumed: **IAM's `index.ts` is closer to the documented pattern than the two lines it violates might suggest — it doesn't leak repository implementations or Drizzle schema references, which are the more severe violations J4 warns about — but it is not a clean, rule-following barrel file.** Two of its four exports are exactly the two categories the rule most explicitly names as forbidden.

What made this worth verifying further, rather than stopping at "the file has a couple of stray exports," is checking whether this file is even the mechanism other modules actually *use* to reach IAM — and here the finding sharpens considerably. I searched every real cross-module import site in the server app, and not one of them goes through `modules/iam/index.ts`:

- `apps/server/src/trpc/trpc.ts` imports `Context` from `../modules/iam/iam.types.js` — directly, bypassing the barrel.
- `apps/server/src/trpc/root.ts` imports `iamRouter` from `../modules/iam/iam.router.js` — directly.
- `apps/server/src/app.ts` imports the default-exported `iamPlugin` from `./modules/iam/iam.plugin.js`, and separately dynamically imports `authMiddlewarePlugin` from `./modules/iam/iam.middleware.js` — both directly, even though `authMiddlewarePlugin` is one of the two things `index.ts` already re-exports.
- `apps/server/src/modules/documents/documents.policy.ts` imports `AuthContext` from `../iam/iam.types.js` directly — notable specifically because `AuthContext` *is* one of the two types `index.ts` legitimately exports, and the Documents module still reaches past the barrel to get it from the source file.

Put together, this means `iam/index.ts` isn't just imperfectly compliant with the documented rule — as far as the real code I was able to search shows, it appears to be **effectively unused** as an integration point. Every real consumer of IAM's surface, inside and outside the module, imports from the specific internal file that actually defines what it needs, rather than from the barrel that's supposed to be the one sanctioned door in. I want to be precise about the limits of this finding: I searched the server app's source tree exhaustively for import statements referencing IAM, and found none going through the barrel — but I can't rule out a consumer I didn't think to search for, or a future one that hasn't been written yet. What I can say with confidence is that the barrel, as it stands today, both deviates from J4's stated rule in two of its four lines and doesn't appear to be the thing doing the actual work of gatekeeping cross-module access, which is the entire reason that rule exists in the first place.

## G. `iam.events.ts` and the Real Path to Audit

Here's the entire file:

```typescript
export const IAM_EVENTS = {
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  SESSION_TERMINATED: 'session.terminated',
  ROLE_ASSIGNED: 'role.assigned',
  ROLE_REVOKED: 'role.revoked',
  USER_CREATED: 'user.created',
  PASSWORD_CHANGED: 'password.changed',
  SESSION_LOCKED: 'session.locked',
  SESSION_UNLOCKED: 'session.unlocked',
  PASSWORD_RESET_TOKEN_GENERATED: 'password_reset_token.generated',
  PASSWORD_RESET_COMPLETED: 'password_reset.completed',
} as const;

export function registerIamEventSubscriptions(): void {
  // Stub function to register event subscriptions
}
```

Eleven named event constants, and a `registerIamEventSubscriptions` function that its own comment admits is a stub. This is worth checking carefully rather than assuming all eleven are wired onto the real bus, because — as it turns out — they aren't.

I searched `iam.service.ts` for every actual `eventBus.emit(...)` call, and found exactly six of the eleven constants used: `ROLE_ASSIGNED`, `ROLE_REVOKED`, `PASSWORD_CHANGED`, `USER_CREATED`, `PASSWORD_RESET_TOKEN_GENERATED`, and `PASSWORD_RESET_COMPLETED`. Each of these is emitted with a complete `DomainEvent` envelope — `eventId`, `eventType`, `occurredAt`, `cityId`, `schemaVersion`, and a `payload` — matching the shape Chapter 1.7's `EventBus.emit()` expects.

The other five constants — `USER_LOGIN`, `USER_LOGOUT`, `SESSION_TERMINATED`, `SESSION_LOCKED`, `SESSION_UNLOCKED` — are defined but never once passed to `eventBus.emit()` anywhere in the module. That's not because these moments go unrecorded; it's because IAM's authentication and session-lifecycle events reach Audit through a completely different path than the event-bus mechanism Chapter 1.7 described. Searching `iam.service.ts` for where `login_success`, `login_failed`, `session_replaced`, `session_locked`, `session_unlocked`, and `forced_logout` actually get recorded turns up calls like this, over and over:

```typescript
void auditService.writeEvent({
  eventType: 'session_locked',
  actorId: userId,
  targetId: sessionId,
  targetType: 'session',
  cityId: BATAC_CITY_ID,
  payload: { user_id: userId, session_id: sessionId },
});
```

This is `auditService.writeEvent()` — a **direct, synchronous call into the Audit module's own service** — not `eventBus.emit()`. Chapter 1.7 already told you this direct-call path exists, but described it as narrow: `AuditPublicAPI.writeEvent`'s own doc-comment, which I read directly in `apps/server/src/modules/audit/index.ts`, states its confirmed callers explicitly — *"Records.bulkOpHandler... Records.dispositionSvc... Any additional direct caller must be documented in B2 Module 8 before merging. All other modules reach the audit log via the event bus."* I cross-checked this against the real `b2-module-boundary-and-internal-api-contracts-v1.1.md` document directly, not just the code comment, and it states the identical rule, with the identical two-caller list.

IAM's own login, logout, lock, unlock, and forced-logout flows are calling `writeEvent()` directly — and, as far as the documents I read confirm, IAM does not appear on that named list of approved direct callers. I want to be exactly as careful here as this project's own conventions ask: I'm not asserting this is a bug that breaks anything — the audit entries genuinely get written either way, hash-chained and HMAC-signed the same as any event-bus-sourced one, since they all funnel through the same `AuditWriteService.writeEvent()` underneath. What I can say precisely is that it's a real, checkable divergence between what B2's documented contract says is allowed and what the shipped code actually does, in a security-relevant module, that I was able to verify independently against two separate sources (the code's own doc-comment, and the architecture document it claims to summarize) rather than assert on the strength of one.

Whether Audit *plausibly* subscribes to the six events IAM genuinely does put on the bus — `role.assigned`, `role.revoked`, `password.changed`, `user.created`, `password_reset_token.generated`, `password_reset.completed` — is a question I want to answer as honestly as the evidence allows rather than assert past what I've actually checked. Chapter 1.7 showed you the real shape of an audit subscription: `audit.event-consumer.ts` registers a handler per event type via a `makeHandler()` factory, calling `bus.on(eventType, handler, 'audit')`, where the event-type string has to be a literal key of the shared `EventPayloadMap` for the call to even compile. I have not read `audit.event-consumer.ts` in this pass — it wasn't part of this chapter's reading list, and Chapter 1.7's own account of it, while thorough, was written against `document.created` and workflow events specifically, not IAM's dot-notation event names (`role.assigned`, `password.changed`, and so on, which — worth noting — use a different naming convention than the `document.created`/`workflow.step.completed` style Chapter 1.7's `EventPayloadMap` walkthrough was built around). I can't respons­ibly assert a specific emit→subscribe pairing for these six events without having actually read the subscribing side and confirmed these exact string literals appear as registered keys — so, honestly: I can't confirm this connection from the files I've read for this chapter. If Chapter 2.1 traced `audit.event-consumer.ts` in more depth, that's the place to check whether `role.assigned` and its five siblings show up as literal, compiling subscriptions — not a gap this chapter can responsibly paper over with a plausible-sounding guess.

---

# Chapter 2.3 — The Organization Module: Offices, Committees, and the Delegation Grant

You've just come from IAM and AUDIT — the two Wave B modules that ORGANIZATION depends on. This chapter is Wave C's first stop, and it's a useful one to slow down on, because ORGANIZATION is where the software stops being abstract plumbing and starts being a direct model of the people you read about in Chapter 0.2: the SP Secretariat, the councilors, the Mayor's Office. This chapter reads `/apps/server/src/modules/organization/`'s nine real, non-test source files in full, plus the database schema, the shared Zod schemas, the relevant architecture documents, and the ADR that settled one of this module's genuinely tricky design questions. It also finishes a story Chapter 1.3 started — a real ordering bug in this module's own plugin — and it's honest about a couple of places where the plan on paper and the code that actually shipped don't quite line up.

## A. What This Module Actually Models

Go back to Chapter 0.2, section A, for a moment. You already met the SP Secretariat, the 12 SP members, the 22 standing committees mentioned there, the Mayor's Office. ORGANIZATION is the schema that turns those real people and real departments into rows in a database. Concretely, it owns seven tables: `offices`, `positions`, `employees`, `assignments`, `delegation_grants`, `committees`, and `committee_memberships` — plus an eighth, `cross_office_grants`, which is a security-configuration table rather than an organizational one (it's the mechanism behind ADR-AUTH-009's cross-office read grants, not something this chapter needs to dwell on).

**Offices** are the real departments. TASK-ORG-009's resolved spec gap gives the actual, final list the seed data uses: 13 offices in total — OOM (Office of the Mayor), OVM (Office of the Vice Mayor), SP (Sangguniang Panlungsod itself), SPS (SP Secretariat, a child of SP), plus the city's administrative departments: CAO (City Accounting), BO (Budget), CEO (City Engineer's), CHO (City Health), CHMO (City Human Resources Management), CLO (City Legal), CPDO (City Planning and Development), CTO (City Treasurer's), and EXT (External, presumably a catch-all for anything outside the LGU proper). The schema itself (`organization.schema.ts`) confirms `offices` is self-referencing — a `parentOfficeId` column pointing back at `offices.id` — which is exactly how SPS ends up nested under SP rather than sitting as its own top-level department, mirroring the real relationship Chapter 0.2 described between the Secretariat and the Council it serves.

**Committees** are the 7th SP's standing committees, and here I can point you at something concrete: the actual scanned source document, `docs/requirements-gathering/scanned-documents/standing-committees/standing-committees.md`, lists the real committee names with their real Chairman/Vice Chairman/Member assignments — Committee on Laws, Rules, Ethics & Privileges (the default co-reviewer Chapter 0.2 mentioned, chaired by Juan Paulo P. Flojo); Committee on Peace and Order & Public Safety & Dangerous Drugs; Committee on Appropriations and Finance & Ways and Means; and so on, all the way through to Committee on Youth & Sports Development. I counted that source document directly rather than trusting a secondhand figure, and it lists **23** committees, not 22 — a small discrepancy from what Chapter 0.2 stated, worth knowing about if you ever need the exact number rather than assuming either figure without checking. TASK-ORG-009's own resolved-spec-gap note independently confirms 23 as the number the seed data actually uses. The `committees` table in the real schema matches the real-world structure directly: a `chairedByEmployeeId` column (NOT NULL — every committee has a chair), and a separate `committee_memberships` table with a `committeeRole` column constrained to exactly `'chairman' | 'vice_chairman' | 'member'` — the same three-person structure you saw in the scanned document.

**Employee-to-office assignments** are the `assignments` table, and this is where the module earns its keep for the rest of the platform. An `assignment` row links an `employee` to a `position` (which itself belongs to an `office`), with a `startDate`, an optional `endDate`, and an `isActive` flag. Section B below is entirely about one more column on this table that turned out to need its own architecture decision.

One thing worth flagging honestly, since the module's own comments flag it too: `organization.employees` is deliberately decoupled from IAM's user accounts. The schema comment on `employees.userId` reads "Not every employee has a platform (IAM) account" — this table exists to hold real city staff, some of whom will never log into this software at all, alongside the subset who do.

## B. The Primary Flag — ADR-AUTH-011

Here's the real-world question this section answers: can one Batac City LGU employee hold more than one active position assignment at the same time? And if so, when the system needs to answer "what office does this person belong to" — for something like a login response, or a JWT claim — which one wins?

ADR-AUTH-011 exists because the honest answer to the first question turned out to be yes, and the original schema had no way to represent that cleanly. The ADR's own Context section lays out the problem directly: `organization.assignments` had no constraint preventing two simultaneous `is_active = true` rows for the same employee, which directly contradicted an earlier architecture document's claim that "every user has a primary record in `organization.assignments` linking them to one office." Three options were on the table. Option (a) was a hard database constraint — flatly forbid more than one active assignment per employee. Option (b) was an implicit tie-break rule, like picking whichever assignment has the earliest start date. Option (c), the one that was actually adopted, was an explicit `is_primary` boolean column.

The reason option (a) got ruled out is the interesting real-world fact: the project owner confirmed, on 2026-06-26, that concurrent active assignments genuinely happen for Batac City LGU staff — the ADR's own example is "an officer temporarily filling a vacancy in a second office while retaining their primary assignment." A hard one-assignment-only constraint would have blocked something that actually occurs. And option (b) got ruled out for a more subtle reason: an implicit rule based on, say, start date produces non-deterministic results when two assignments share a date, and — more importantly — it can quietly declare the *wrong* assignment primary from the employee's own point of view, with no way for anyone to see or correct that. The ADR's own words on why an explicit flag won out: "An explicit flag is transparent and auditable — both the user and the system can determine which assignment is primary without inspecting derived orderings."

So the decision, quoted directly:

> **Option (c) adopted:** add an explicit `is_primary BOOLEAN NOT NULL DEFAULT false` column to `organization.assignments`. The application layer is responsible for maintaining the invariant that exactly one `is_primary = true` row exists per `employee_id` among active, non-deleted assignments. A partial unique index provides a database-level safety net.

That's a two-layer enforcement pattern you'll recognize from elsewhere in this codebase: application logic is trusted to maintain the invariant day to day, and the database carries a partial unique index as a backstop in case it doesn't. Here's that index, straight from the real `organization.schema.ts`:

```typescript
uniqueIndex('uq_assignments_one_primary_per_employee')
  .on(table.employeeId)
  .where(sql`is_primary = true AND is_active = true AND deleted_at IS NULL`),
```

And the application-layer half of the contract is a dedicated, transactional "set primary" operation, not something a generic update is allowed to do casually. The real `organization.repository.ts` implements exactly the two-step sequence the ADR specifies — unset whatever was primary before, then set the new one:

```typescript
setPrimaryAssignment: async (employeeId, targetAssignmentId, tx) => {
  // Step 1: unset all current primary assignments for this employee
  await tx
    .update(assignments)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(
      and(
        eq(assignments.employeeId, employeeId),
        eq(assignments.isPrimary, true),
        isNull(assignments.deletedAt),
      ),
    );
  // Step 2: set the new primary
  await tx
    .update(assignments)
    .set({ isPrimary: true, updatedAt: new Date() })
    .where(eq(assignments.id, targetAssignmentId));
},
```

Both updates run against the same transaction handle (`tx`), which matters — if step one succeeded and step two failed, you'd genuinely end up with zero primary assignments for that employee, so the two have to commit or roll back together.

And here's where the flag actually gets consumed, in `organization.service.ts`'s `getPrimaryOfficeForUser` — the real implementation behind the B2 Published API method IAM's login flow calls to resolve a user's `officeScopeId`/`officeCode`:

```typescript
async getPrimaryOfficeForUser(
  userId: string,
): Promise<{ officeId: string; officeCode: string } | null> {
  const db = deps.db;
  const rows = await db
    .select({
      officeId: assignments.officeId,
      officeCode: offices.code,
    })
    .from(employees)
    .innerJoin(assignments, eq(assignments.employeeId, employees.id))
    .innerJoin(offices, eq(offices.id, assignments.officeId))
    .where(
      and(
        eq(employees.userId, userId),
        eq(assignments.isPrimary, true),
        eq(assignments.isActive, true),
        isNull(assignments.deletedAt),
        isNull(employees.deletedAt),
        isNull(offices.deletedAt),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;
  return rows[0] || null;
}
```

That's the ADR's decision made concrete: filter on `is_primary = true AND is_active = true`, and if nothing matches — an employee with active assignments but no primary one flagged — return `null` rather than guessing. This is a genuinely small piece of code, but it's exactly the kind of thing that's easy to get subtly wrong without a document like ADR-AUTH-011 settling the tie-break rule first; without it, whoever wrote this query would have had to invent their own answer to "which row wins," and the next person to touch it might invent a different one.

## C. ABAC in Practice — and an Honest Correction

You saw one worked ABAC policy example in Chapter 2.2, for IAM. The natural place to look for a second one in this module is the committee-management procedures — something like "can this user assign a new chairperson to this committee" has the shape of a classic ABAC question. But I need to tell you plainly: that's not actually how committee management is gated in the real code, and it's worth understanding exactly why, because the reason is itself instructive.

`organization.router.ts` opens with a long comment block explaining, in detail, that every procedure in this file — including `createCommittee`, `updateCommittee`, and `assignCommitteeMembership` — is authorized with a **direct role check against `ctx.auth`**, not a call to `ctx.policyEvaluator.evaluate(subject, resource, action)`. Here's the actual gate on `createCommittee`, and it's about as simple as authorization code gets:

```typescript
createCommittee: protectedProcedure
  .input(s.CreateCommitteeInput)
  .mutation(async ({ ctx, input }) => {
    requirePlatformAdmin(ctx);
    // ...
```

Where `requirePlatformAdmin` is just:

```typescript
function requirePlatformAdmin(ctx: { auth: { isPlatformAdmin: boolean } }): void {
  if (!ctx.auth.isPlatformAdmin) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Platform Administrator access required.',
    });
  }
}
```

That's RBAC — a flat boolean check — not ABAC. `assignCommitteeMembership` (the closest real analogue to "assign a new chairperson") is gated the identical way. So why does this router accept `policyEvaluator` as a dependency at all, if it never calls `evaluate()` on it? The router's own header comment gives a specific, code-verified reason, and it's worth reading because it's a genuinely useful thing to notice as a pattern, not just a fact about this one file:

> `PolicyGuard`'s Gate 3 (`apps/server/src/modules/iam/iam.policy.ts`, `PLATFORM_ADMIN_ALLOWED_ACTIONS`) hard-denies any subject with `isPlatformAdmin=true` unless `action` is exactly one of 16 specific strings... The RBAC permission rows actually seeded for ORG in `apps/server/src/database/seeds/iam.seed.ts` use a *different* set of action strings (`organization:create_office`, `organization:edit_office`, ..., `platform:manage_committees`) that don't overlap with Gate 3's allowlist at all.

In plain terms: two separate parts of IAM — the hard-coded allowlist that governs what a Platform Admin is permitted to do at all, and the actual permission strings seeded into the database for this module — were built with two different naming conventions, and nobody had reconciled them by the time this router was written. Calling `evaluate()` for any ORG action, with either naming scheme, would always be denied — not because the subject genuinely lacks permission, but because of a mismatch between two already-implemented pieces of IAM that this router has no ability to fix from where it sits. So the router sidesteps it, matching the same direct-`ctx.auth`-check pattern already proven to work in `iam.router.ts`, and leaves `policyEvaluator` threaded through the type signature (so the TASK-ORG-008 instruction is honored "at the type level," in the comment's own words) without ever calling it.

So where does real ABAC — an actual `policyEvaluator.evaluate(...)` call — live in this module? Inside `delegation.service.ts`, on the write paths. Here's `createDelegationGrant`'s Step 1, and this is a genuine, worked ABAC example, just not the committee one you might expect:

```typescript
const policySubject = {
  userId: subject.userId,
  sessionId: '',
  officeId: null,
  cityId: subject.cityId,
  roles: subject.roles,
  permissions: ['delegation_grant:create'], // RBAC pre-checked: the caller holds this route
  committeeIds: [],
  delegationGrantId: null,
  effectiveOfficeIds: [],
  effectiveRoles: subject.roles,
  isItAdmin: false,
  isPlatformAdmin: false,
};

const policyResource = {
  type: 'delegation_grant',
  id: 'new',
  cityId: subject.cityId,
};

const evaluation = await deps.policyEvaluator.evaluate(
  policySubject,
  policyResource,
  'create',
);

if (!evaluation.allowed) {
  throw new PolicyDeniedError({
    reason: evaluation.reason,
    action: 'delegation_grant:create',
  });
}
```

What's being checked here, concretely: `policySubject.roles` — does the caller hold `sp_secretary`, per I1 §11.1's rule that only the Secretariat may log a delegation grant? — against `policyResource.type: 'delegation_grant'`, `action: 'create'`. The real-world question this answers is exactly the one Chapter 0.2 and section D below describe: "is this person the SP Secretary, who is the only role permitted to formally log a Designation into the system." If the evaluation comes back denied, the caller gets a `PolicyDeniedError`, which the router (in its `createDesignationGrant` procedure) catches and maps to `TRPCError({ code: 'UNAUTHORIZED', ... })`. That's the second worked ABAC example this chapter promised — it's just delegation-shaped rather than committee-shaped, because that's genuinely where the real code puts its ABAC logic.

## D. The Delegation Grant — What It Models, Then How It Works

### The real-world concept, before any code

Go back to Chapter 0.2's discussion of Designations: formal documents by which the Mayor or Vice Mayor temporarily hands their own authority to someone else, most commonly the Vice Mayor being designated Acting Mayor while the Mayor is traveling — something that happens routinely, more than ten times in a recent two-year span. B2's own description of this module states the same fact independently, in almost the same words, calling delegation "a high-frequency first-class operation (confirmed: 10+ Acting Mayor designations per year)." A **delegation grant** is this module's database representation of exactly that: a temporary, time-boxed handoff of one employee's authority to another.

Why does the software need to represent this at all, rather than just leaving it as a paper Designation document sitting in a filing cabinet? Because of a problem you've already seen the shape of in Chapter 0.2: the software's whole job is answering "who is responsible for the next step, right now" — and if the Mayor is traveling and the Vice Mayor is Acting Mayor, then a workflow step routed to "the Mayor" needs to land on the Vice Mayor's desk instead, automatically, for exactly as long as that designation is in effect. B2's own doc-comment on the Published API method that does this, `resolveCurrentHolder`, states the real-world scenario directly:

> This is the primary call from the Workflow module when routing a step: "Who is currently the SP Secretary?" accounts for the case where an Administrative Officer II is designated as OIC. "Who is currently the Mayor?" accounts for the Vice Mayor serving as Acting Mayor.

You can see this "delegated-to wins" rule implemented plainly in the real `organization.service.ts`. `resolveCurrentHolder` checks for an active delegation covering the position first, and only falls back to the direct assignment if none exists:

```typescript
async resolveCurrentHolder(positionId: string, asOf?: Date): Promise<UserSummary | null> {
  // ...
  // 1. Find active delegation covering positionId (delegated-to wins)
  const delegations = await db
    .select({ /* ... */ })
    .from(delegationGrants)
    .innerJoin(employees, eq(delegationGrants.delegatedToEmployeeId, employees.id))
    .where(/* isActive, not revoked, not deleted, startDate <= asOf <= endDate */)
    .limit(1);

  if (delegations.length > 0 && delegations[0]?.userId) {
    return { userId: delegations[0].userId, displayName: /* ... */ };
  }

  // 2. Fall back to active assignment for positionId
  // ...
}
```

That's the entire mechanism, in about a dozen lines: check the delegation table first, fall through to the ordinary assignment table if nothing's there.

Two things about *who* can create one of these, straight from TASK-ORG-005's spec (and confirmed as the actual gate, since section C above just walked through the real code enforcing it): the delegating authority has to genuinely be the person handing off real power — the Mayor, for executive-branch scope, or the Vice Mayor (as "SP Presiding Officer," per Chapter 0.2's naming), for legislative-branch scope. But the person who actually *creates* the grant in the system is the SP Secretary, not the Mayor or Vice Mayor directly — the Secretariat logs the Designation document once it's received, it doesn't independently originate one. And notably: no Platform Administrator confirmation step is required. The grant takes effect the moment the Secretary logs it, matching B2's description of this as immediate, no-friction, high-frequency administrative business rather than something that needs a second layer of sign-off.

One invariant worth naming explicitly, since it shows up at three separate layers of this codebase: at most one active delegation grant per delegatee at any time — the same "primary" concept from section B, but stricter, since here there's no "is_primary flag lets you have several" escape hatch; a person can only be the *recipient* of one active delegation at once. You can see this enforced at the database level in the real schema —

```typescript
uniqueIndex('uq_delegation_one_active_per_delegatee')
  .on(table.delegatedToEmployeeId)
  .where(sql`is_active = true AND deleted_at IS NULL`),
```

— and again, redundantly, at the application layer, as a pre-check inside `createDelegationGrant` before the insert even happens (this is what throws `ActiveDesignationExistsError`, which the router maps to a `CONFLICT` response). Two independent enforcement points for the same rule, exactly the pattern ADR-AUTH-011 used for the primary-assignment invariant in section B.

### PgBoss, and what this specific call queues

Now the code that actually needed all that setup. `delegation.service.ts`'s `createDelegationGrant` is a real, seven-step function (the file's own comments number it as seven steps of enforcement logic, with the actual database and side-effect work landing across what the code itself labels Steps 3 through 8). Steps 1 and 2 are the ABAC check and the designation-document presence check you already saw in section C. Step 3 is the Invariant #16 pre-check just mentioned. Step 4 inserts the row. Steps 5 and 6 resolve the employee IDs into user IDs and emit a `delegation.granted` domain event on the event bus (this is what tells the Workflow module to go re-route any steps currently sitting with the original authority). Step 7 writes an audit event. And then there's Step 8:

```typescript
// ── Step 8: Schedule expiry job ─────────────────────────────────────────
await deps.boss.send(
  'delegation.expire',
  { delegationGrantId: grant.id },
  { startAfter: grant.endDate },
);
```

This is where PgBoss enters the picture, and it's worth pausing to explain what that actually is, since this is the first time you've needed to know. `tech-stack.md`'s own summary of the project's scheduling choices describes it as "node-cron (simple) + pgboss (durable)." The distinction that phrase is drawing is this: `node-cron` runs entirely in the Node.js process's memory — if the server restarts, anything it was tracking is gone, and you'd need some other mechanism to reconstruct what it should be doing. **PgBoss is different: it's a job queue backed directly by PostgreSQL.** A job you hand to PgBoss is written as a row in a database table, not held only in memory. That means if the server crashes or restarts an hour before a scheduled job is supposed to fire, the job is still sitting there in Postgres when the server comes back up, and PgBoss will still run it. For a platform whose whole job is honoring statutory deadlines — you've already met two of them in Chapter 0.2, the Mayor's 10-day lapse window and the Panlalawigan's 30-day review clock — that durability isn't a nice-to-have. A delegation grant's end date is exactly this kind of deadline: it has to actually fire, even if the server happened to restart at some point during the delegation's lifetime.

So, precisely, what does this call queue? A job named `'delegation.expire'`, carrying `{ delegationGrantId: grant.id }` as its payload, with a `startAfter` option set to `grant.endDate` — meaning PgBoss won't even attempt to run this job until that date arrives. In plain English: the moment a delegation grant is created, this line tells PgBoss "come back and auto-expire this specific grant on the exact day it's scheduled to end." You can confirm this is exactly what happens on the receiving end, in the real `delegation-expiry.job.ts`:

```typescript
await boss.work('delegation.expire', async ([job]) => {
  if (!job) return;
  const { delegationGrantId } = job.data as { delegationGrantId: string };

  await db.transaction(async (trx) => {
    // 1. Deactivate the row
    const result = await trx
      .update(delegationGrants)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(delegationGrants.id, delegationGrantId),
          eq(delegationGrants.isActive, true),
          isNull(delegationGrants.deletedAt),
        ),
      )
      .returning();

    if (result.length === 0) {
      // Already revoked or deleted — no-op; do not throw (idempotent)
      return;
    }
    // ... resolve user IDs, emit delegation.expired, write audit event
  });
});
```

Worth noticing: this handler is written to be idempotent — if the grant was already manually revoked before its scheduled end date (a real, separate operation covered by `revokeEarlyDelegationGrant`), the `WHERE is_active = true` clause matches nothing, `result.length` is zero, and the handler simply returns without throwing or double-processing anything. That matters for a durable queue specifically: PgBoss's whole guarantee is that the job *will* run, so the handler has to behave sensibly even if something else already made the change it was about to make.

One small, honest discrepancy worth flagging if you go looking at TASK-ORG-007's original spec text: the AI Prompt described this mechanism using `boss.schedule(name, runAt, data)`. The real, shipped code uses a different PgBoss method, `boss.send(name, data, options)`, with the timing expressed via the `startAfter` option instead. Both achieve the same real-world effect — "run this job no earlier than this date" — but they're genuinely different calls in PgBoss's own API, and the code that actually shipped isn't the exact one the task spec sketched. This is a minor deviation, not a bug, but it's the kind of thing worth checking against the real file rather than assuming the spec and the implementation always agree word for word — which is exactly the discipline the next section is about, at much higher stakes.

## E. Bug B, From Organization's Own Side

You met the outline of this bug in Chapter 1.3, reading `app.ts`. This chapter is where you get to see it from the other end — the file where the dangerous line actually lives, and a genuinely messy, honest look at what "the fix" turns out to mean once you check every place that claims to describe it.

### The setup

`organizationPlugin` — the real Fastify plugin, `organization.plugin.ts` — needs to construct `delegationService` the moment it registers, because that service gets decorated onto the Fastify instance for the rest of the app to use. And `delegationService` needs a PgBoss instance, because you just read the exact line, Step 8 of `createDelegationGrant`, that calls `deps.boss.send(...)`. So somewhere, something has to hand a real `PgBoss` instance to this plugin.

Here's the line that does it, exactly as it sits in the real file today:

```typescript
const delegationService = createDelegationService({
  db: fastify.db,
  orgRepository,
  auditService: fastify.auditService,
  eventBus: fastify.eventBus,
  policyEvaluator: fastify.policyEvaluator,
  boss: fastify.boss,
} as any);
```

That last line — `boss: fastify.boss` — reads `fastify.boss` and copies whatever it currently holds into the object passed to `createDelegationService`. This runs synchronously, during plugin registration, with no `await`, no deferral, nothing waiting for anything else to happen first.

### What went wrong

Now recall Chapter 1.3's mechanism for how Fastify decorations work: something only exists as `fastify.someProperty` once the specific plugin that decorates it has actually registered and run. Before this bug was fixed, `index.ts`'s startup sequence called `buildApp()` — which registers `organizationPlugin`, among everything else — *before* it had constructed a `PgBoss` instance and decorated it onto the Fastify instance. So on every real server boot, by the time the line above ran, `fastify.boss` simply didn't exist yet. It evaluated to `undefined`.

Here's the part that makes this bug genuinely interesting rather than just "a typo": **assigning `undefined` to an object property is not an error.** `{ boss: undefined }` is a perfectly ordinary, valid JavaScript object. TypeScript's type checker has no way to catch this either, and for a specific, sharp reason: from TypeScript's point of view, `fastify.boss` is declared as type `PgBoss`, full stop — the type system has no concept of "this decoration exists once some other plugin has already registered, but not before." It just sees a property with a `PgBoss` type and moves on. Add to that the `as any` cast wrapping the whole object literal on this line, and there's a second layer of suppression on top of the first — even a structural mismatch here wouldn't have been flagged by `pnpm typecheck`.

So the bug doesn't crash the server. It doesn't crash at plugin registration. It sits there, completely silent, for as long as nobody actually tries to create a delegation grant. The first time some real request reaches `createDelegationGrant`'s Step 8 — the exact `deps.boss.send(...)` call you just read in section D — `deps.boss` is `undefined`, and calling `.send(...)` on `undefined` throws `TypeError: Cannot read properties of undefined`.

I want to be precise about one small thing here, because the brief for this chapter specifically asked me to check it against the real code rather than assume: the comment block you're about to read (in `app.ts`) describes this as throwing at "`createDelegationGrant`'s Step 7." Reading the real, current `delegation.service.ts` directly, its own inline comments number this exact call as **Step 8**, not Step 7 — you can see that numbering in the code quoted in section D above. That's a small, genuine drift between what the comment says and what the file's own step-numbering says today, most likely because a step was added to the function at some point after this particular comment was last touched. It doesn't change the substance of the bug at all — it's still the delegation-grant-creation code path, it's still the `boss.send(...)` call, it still throws a `TypeError` — but it's worth knowing the comment and the code don't quite agree on the step number, since that's exactly the kind of small discrepancy this whole series has trained you to check for rather than assume away.

### The fix — where it actually lives

Chapter 1.3 already showed you `app.ts`'s own account of the fix, quoted directly from the real file, and it's worth repeating here since this is where it pays off:

> ```
> * [Confirmed — see docs/development-findings-log.md, Bug B] `organizationPlugin`
> * reads `fastify.boss` synchronously during its own registration (to build
> * `delegationService`'s deps). Previously, `index.ts`'s `main()` called
> * `buildApp()` (which registers `organizationPlugin`) BEFORE constructing
> * PgBoss and decorating `fastify.boss` — so `fastify.boss` was `undefined`
> * the entire time `organizationPlugin` ran, on every real boot.
> * `createDelegationGrant`'s Step 7 (`deps.boss.send(...)`) would throw at
> * runtime the first time it was actually invoked.
> ```

The actual fix, confirmed by direct read of `app.ts`, is a `BuildAppOptions.boss` parameter that lets a caller hand `buildApp()` an already-constructed `PgBoss` instance, decorated onto the Fastify instance at exactly the right moment — right before `organizationPlugin` registers, and nowhere else:

```typescript
if (boss) {
  fastify.decorate('boss', boss);
}
await fastify.register(organizationPlugin);
```

And on the calling side, `index.ts` now constructs and starts PgBoss *first*, then passes it in:

```typescript
const boss = new PgBoss(env.DATABASE_URL_APP);
await boss.start();

const app = await buildApp({ boss });
```

That's a genuinely clean fix for the bug as diagnosed: `organizationPlugin`'s own read of `fastify.boss` didn't need to change at all — it's still that exact same synchronous `boss: fastify.boss` line inside `organization.plugin.ts`. What changed is *when* `fastify.boss` gets populated relative to when `organizationPlugin` registers, and that timing question was never something `organization.plugin.ts` could fix from inside itself — it had to be settled by whoever calls `buildApp()` in the first place, which is exactly why the fix landed in `app.ts` and `index.ts`, not in the organization module's own files.

### The part worth being honest about

Here's where this gets genuinely more interesting than a tidy "and then it was fixed" ending, and it's worth walking through carefully rather than smoothing over.

Searching `docs/development-findings-log.md` for "boss" and "organizationPlugin" turns up two real, matching entries, both dated 2026-07-07, both from `task_id: TASK-DOCS-018`:

> ### [LOG-0038] `organizationPlugin` instantiation passed `repository` instead of `orgRepository`
>
> During TASK-DOCS-018, it was discovered that `organization.plugin.ts` was passing its repository instance under the key `repository` to `createDelegationService`, whereas the `DelegationServiceDeps` interface explicitly requires `orgRepository: OrganizationRepository`.
>
> [Tested]: Fixed in `organization.plugin.ts` by explicitly using `orgRepository: repository`.

That's a real, different bug — a wrong key name, not a timing issue — and it matches, almost word for word, the "Bug A" comment you can read directly above the `createOrgService`/`createDelegationService` calls in the real `organization.plugin.ts` today. Good: that one lines up cleanly between the log and the live code. But the very next entry is the one that matters here:

> ### [LOG-0039] `fastify.boss` undefined during synchronous plugin registration
>
> `organization.plugin.ts` attempted to construct `createDelegationService` synchronously during the plugin body execution, expecting `fastify.boss` to be available. However, in `index.ts`, `pgboss` is decorated onto `fastify` *after* `organizationPlugin` is registered, resulting in `boss` being undefined.
>
> [Tested]: Fixed by deferring the service instantiation inside `fastify.after(...)` in `organization.plugin.ts` to guarantee all prior registrations (including `pgboss`) are complete.

Read that last line again against what you just saw in the real, current `organization.plugin.ts` file in section D and above: there is no `fastify.after(...)` wrapper anywhere in that file. The `createDelegationService(...)` call sits directly in the plugin body, completely unwrapped, exactly the way LOG-0039 itself describes the *bug*, not a fix for it. The fix that's actually live in the codebase today — the `BuildAppOptions.boss` parameter and the conditional decoration in `app.ts`, quoted above — is a different mechanism entirely, living in a different file, changing a different thing (the *caller's* decoration timing, not the *plugin's* own read timing).

So which is true? Both entries carry `status: proposed` and `resolved_in: none`. Go back to the findings log's own header rules, which govern exactly this situation: every entry an agent appends starts as `proposed`, and only a human reviewer is permitted to mark one `confirmed` or `superseded` — an agent that later determines a prior entry was wrong is instructed to append a *new* entry noting that, not edit the old one, since "the log is append-only for humans too; corrections are new information, not erasures." I searched specifically for any later entry carrying a `supersedes: LOG-0039` reference, and for any mention of `BuildAppOptions` or `fastify.after` anywhere else in the log, and found neither. So here's the honest state of things: a `proposed` finding exists, describing a fix that — as far as I can tell by reading the file that's actually in the repository right now — was never the fix that shipped. Nothing in the log has been marked to correct or withdraw that claim. It's possible a human reviewer looked at LOG-0039, decided the `fastify.after()` approach described there wasn't the direction to take, and implemented the `BuildAppOptions` approach instead without looping back to add a superseding log entry — the review-and-reconcile step the log's own rules ask for evidently didn't happen here, or hasn't yet. I don't know which, and I'd rather tell you that plainly than guess at a tidy explanation.

What this leaves you with, concretely, if you're the one picking this codebase up next: trust the code you can read directly over a `proposed`, unconfirmed log entry whenever the two disagree — which is exactly what this whole series has been training you to do since Chapter 0.1. The bug itself, and the mechanism of the fix that's actually live in `app.ts` today, are both things you can verify by reading real files. The log entry describing a *different* candidate fix is real too, as a historical record of one path that was considered — it's just evidently not the path the code took.

## F. The Barrel File — A Third Data Point

You've now seen this pattern checked twice before: does a module's `index.ts` stick to being a pure barrel — re-exports only, no logic — the way J4's documented convention asks for? Here's ORGANIZATION's own answer, and it's genuinely the most substantial deviation of the three you've seen so far.

The original scaffold spec, TASK-ORG-002, described exactly eight stub functions for `index.ts`, each one a one-line `Promise.resolve(...)` placeholder standing in for a real Published API method: `resolveCurrentHolder`, `getActiveDelegationForUser`, `getOfficeById`, `getOfficeHierarchy`, `getEmployeeByUserId`, `getPrimaryOfficeForUser`, `getCommitteeIdsForUser`, and `getDelegationGrantById`. That's the pure-barrel version — eight functions, each a thin pass-through, no state of its own.

The real, current `index.ts` genuinely re-exports all eight of those — but it also does considerably more:

```typescript
export * from './organization.types.js';
export { createOrgService } from './organization.service.js';
export { createDelegationService } from './delegation.service.js';

let orgService: ReturnType<typeof createOrgService> | null = null;
let delegationService: ReturnType<typeof createDelegationService> | null = null;

export function initializePublishedAPI(
  db: DbClient,
  auditService?: AuditPublicAPI,
  policyEvaluator?: PolicyEvaluator,
  boss?: PgBoss,
) {
  const repo = createOrgRepository(db);
  orgService = createOrgService({ db, orgRepository: repo } as any);
  delegationService = createDelegationService({
    db,
    orgRepository: repo,
    eventBus: undefined as any, // overridden by plugin at startup; stubs in tests inject directly
    auditService: auditService as AuditPublicAPI,
    policyEvaluator: policyEvaluator as PolicyEvaluator,
    boss: boss as PgBoss,
  });
}
```

There's a wildcard re-export of the entire types module. There are direct re-exports of the two factory functions, `createOrgService` and `createDelegationService`, not just the things they produce. And, most substantially, there are two module-level singleton variables, `orgService` and `delegationService`, plus an `initializePublishedAPI(...)` function whose whole job is populating them, plus a `createDelegationGrant` re-export that wasn't in TASK-ORG-002's original eight-method list at all. That's real stateful lifecycle logic — a genuine singleton pattern — sitting inside a file whose documented purpose, per the earlier chapters that introduced J4's barrel convention, was supposed to be pure re-export plumbing.

Put this next to what you've already seen elsewhere in the series: one barrel file that held the line cleanly, one that drifted a little, and now this one, which drifts considerably further — real module-level state and a real initialization function, not just an extra export or two. Three data points isn't enough to declare a verdict on how strictly this rule is followed across the whole codebase, and that's rather the point of walking through a third one rather than stopping at two: you now have enough real examples in front of you to start forming that judgment yourself, rather than taking either "the rule is followed" or "the rule is ignored" on anyone's word — including mine.

---

# Chapter 2.4 — The DOCUMENTS Module: JSONB Metadata, Two-Stage Numbering, and a Real `index.ts` Problem

You've reached the module this platform is named after. Everything in Arc 1 — the database layer, Zod, Fastify, tRPC, TanStack Query, Zustand, the event bus, file storage, observability, and Docker Compose — exists to support modules like this one: DOCUMENTS (DOCS in this project's task-list shorthand), Wave D, the single most feature-dense module after Workflow. This chapter covers document creation, the JSONB metadata design, the two-stage numbering system, OCR, and three domain-distinct citizen-facing features that all happen to live in this module's PostgreSQL schema.

It also covers something less comfortable: a real, present conflict between what this project's own architecture document says `index.ts` should contain and what a related test file actually does with it. Section F is the pedagogical heart of this chapter, and it's worth saying up front that the finding there is more nuanced — and more interesting — than "the code violates the spec." Read it slowly.

## A. Why `documents.metadata` Is JSONB, Not a Wide Table of Typed Columns

Start with a concrete question: an SP Resolution needs to record who sponsored it and what committee it was introduced by. A Citizen Complaint needs a complainant's name, an optional respondent, and an incident narrative. A Document Request Form needs a list of which documents someone is requesting copies of and how many pages each one is. None of these fields make sense on all three document types. If `documents.documents` had to store all of them as real typed columns, you'd end up with a table where nearly every column is `NULL` for nearly every row, depending on which document type that row happens to be — and every time the SP Secretariat needed to track one new fact about one document type, you'd need a schema migration.

`tech-stack.md` states the platform-wide reasoning directly, listing this alongside Row-Level Security and the append-only audit log as one of the "PostgreSQL Non-Negotiables" — features the project chose PostgreSQL specifically to get:

> **JSONB** — Admin-configurable document metadata (variable fields per document type). Use GIN indexes. Query with `@>` operator and `->>` accessors.

"Admin-configurable" is the load-bearing phrase. The intent isn't just "JSONB is flexible" in the abstract — it's that a Platform Administrator should be able to add a new document type, or a new metadata field on an existing type, without a developer writing a migration. H2 (`h2-document-type-catalog-with-jsonb-metadata-schemas-v1.1.md`) is the document that makes this concrete: it defines a JSON Schema (draft-07) for each of the eight Phase 1 document types, and that schema is what gets stored in the `metadata_schema` JSONB column on `documents.document_types` — a schema describing a schema, which is exactly the mechanism that makes "admin-configurable" literal rather than aspirational.

But JSONB isn't a free pass to shove everything into one blob column. H2 is explicit about the boundary, in a section titled "What Is Not in `documents.metadata` JSONB": every column that's the same *kind* of fact regardless of document type — `id`, `title`, `lifecycle_state`, `classification_level`, `qr_tracking_number`, `preliminary_number`, `final_number`, `control_number`, `originating_office_id`, `created_by`, `version_number`, and so on — stays a real typed column on `documents.documents`, shared by every document type. Only the fields that genuinely *vary by type* go in `metadata`. You can see this split enforced in the real schema, `packages/database/schema/documents.schema.ts`: the `documents` table declares `lifecycleState`, `qrTrackingNumber`, `preliminaryNumber`, `finalNumber`, and `controlNumber` as first-class typed columns (lines 219–227), and then, separately, one `metadata: jsonb('metadata')` column (line 236) for everything else.

Here's H2's schema for `SP_RESOLUTION`, the flagship legislative type, showing what actually lives in that JSONB column for one specific document type:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["sponsors", "subject_matter", "certified_urgent"],
  "additionalProperties": false,
  "properties": {
    "sponsors": {
      "type": "array",
      "description": "Councilors and Vice Mayor associated with this measure...",
      "items": {
        "type": "object",
        "required": ["person_id", "display_name", "role"],
        "properties": {
          "person_id": { "type": "string", "format": "uuid" },
          "display_name": { "type": "string" },
          "role": { "type": "string", "enum": ["author", "co_author", "introduced_by"] }
        }
      }
    },
    "subject_matter": {
      "type": "object",
      "required": ["general"],
      "properties": {
        "general": { "type": "string" },
        "specific": { "type": ["string", "null"] }
      }
    },
    "certified_urgent": {
      "type": "boolean",
      "description": "True when a Certification of Urgency has been logged for this measure...",
      "default": false
    }
  }
}
```

None of `sponsors`, `subject_matter`, or `certified_urgent` would make sense as a column on `documents.documents` — a Citizen Complaint has no sponsors, a Document Request has no subject matter classification. But they're not arbitrary either: H2 marks `certified_urgent` as required and explains exactly why it needs to be queryable fast — it drives real workflow routing (a certified-urgent measure bypasses committee referral and collapses two reading sessions into one). That's why the real schema pairs the flexible column with a targeted expression index: `idx_documents_metadata_certified_urgent` on `(metadata->>'certified_urgent')` (schema line 256). JSONB gives you schema flexibility; the expression index gives you back the query performance you'd have gotten from a real column, for the one or two fields you actually filter or sort on.

You can see the same pattern one document type over. SP Ordinance's JSONB schema adds a field resolutions don't have — `has_penalty_provision`, a boolean that determines whether the ordinance needs full-text newspaper publication before it's considered fully processed. H2 explains this is set at document creation or confirmed at Second Reading, and the real schema has a matching expression index, `idx_documents_metadata_has_penalty` on `(metadata->>'has_penalty_provision')` (schema line 257) — direct evidence that this specific JSONB field was important enough to index deliberately, not just stored and forgotten. A fourth index, `idx_documents_metadata_outcome_state` (line 258), does the same thing for Citizen Complaint's `outcomeState` field, which you'll meet again in section E. Each of these three targeted indexes traces back to a specific type's JSON Schema in H2 — the flexible column stays flexible, and the specific fields that actually need to be searched fast get pulled out as expression indexes without ever becoming real typed columns.

## B. The Two-Stage Numbering System: Draft, Then Final

Legislative documents in this platform don't get one series number — they get two, assigned at two different points in the document's life, and this isn't an implementation detail so much as it's a faithful model of how the SP Secretariat actually works. ADR-GEN-009 states the reason directly:

> **Stage 1 — Preliminary number** (at secretariat logging): A "Draft" series number is assigned when the document first enters the system... **Stage 2 — Final number** (after last reading vote, before VP signs): The final series number is assigned by the Secretariat after the last reading vote... The final number reflects the order in which documents complete their last reading vote, not the order in which they were introduced. If Document A was introduced before Document B but Document B's last reading vote passes first, Document B receives the lower final number.

That's the operational problem two-stage numbering solves: at the moment a resolution is logged, nobody — not the Secretariat, not the system — can know what order documents will finish their votes in. A document introduced first might get delayed in committee while a document introduced second sails through. If you assigned one immutable number at intake, you'd be locking in a number that has to be wrong the moment approval order diverges from introduction order. So the Secretariat assigns a provisional "Draft" number early (useful for the Order of Business and early workflow steps) and a real, final number only once the approval order is actually known.

H3 (`h3-numbering-series-configuration-specification.md`) gives the exact format strings for the three legislative types — `SP_RESOLUTION`, `SP_ORDINANCE`, and `SP_APPROPRIATION_ORDINANCE` — which all share the same rendering pattern:

| `series_id` | `preliminary_format` | `final_format` |
|---|---|---|
| `sp_resolution` | `Draft 7SP {YEAR}-{NN}` | `7SP {YEAR}-{NN}` |
| `sp_ordinance` | `Draft 7SP {YEAR}-{NN}` | `7SP {YEAR}-{NN}` |
| `sp_appropriation_ordinance` | `Draft 7SP {YEAR}-{NN}` | `7SP {YEAR}-{NN}` |

ADR-GEN-009's own worked example: a resolution might be assigned `Draft 7SP 2026-02` at logging. If a different resolution, `Draft 7SP 2026-01`, finishes its Second Reading vote first, *that* document gets promoted to `7SP 2026-01` as its final number — sequence order at the preliminary stage doesn't bind the final order. Once the "Draft" prefix is dropped, the number is done: immutable, no override path for any role.

Now trace this against the real `numbering.service.ts`. The file's own header comment states the invariant plainly: it is "the ONLY code path that assigns series numbers to documents" — no other file is permitted to write to `documents.numbers` or the `preliminary_number`/`final_number`/`control_number` columns directly. `assignPreliminaryNumber` and `assignFinalNumber` are separate methods, each wrapped in its own `db.transaction(...)` call, and each follows the exact same three-step atomic pattern the file's header describes:

```typescript
async assignPreliminaryNumber(
  documentId: string,
  seriesKey: string,
  cityId: string,
  actorId: string,
): Promise<NumberAssignmentResult> {
  return this.db.transaction(async (trx) => {
    const repo = new DocumentsRepository(trx);

    // Guard: no duplicate preliminary number for same document
    const existing = await repo.findCurrentNumber(documentId, 'preliminary');
    if (existing) {
      throw new Error('preliminary number already assigned');
    }

    const series = await repo.findNumberSeriesByKey(seriesKey, cityId);
    if (!series) {
      throw new Error(`number series not found: ${seriesKey}`);
    }

    const year = new Date().getFullYear();

    // Step 1: call fn_get_next_sequence_value
    const { sequenceValue, wasCreated } = await this.callSequenceFunction(trx, seriesKey, year);
    if (wasCreated) {
      this.logger.warn(
        { seriesKey, year },
        '[numbering] On-demand year sequence created -- operational log only, NOT an audit event',
      );
    }

    // Step 2: render the formatted number
    const numberValue = renderNumber(series, year, Number(sequenceValue), series.preliminaryFormat);
    const now = new Date();

    // Step 3a: insert documents.numbers ledger row
    const numberRow = await repo.insertNumber({
      documentId, numberSeriesId: series.id, cityId,
      numberType: 'preliminary', numberValue,
      sequenceYear: year, sequenceNumber: Number(sequenceValue),
      isCurrent: true, assignedBy: actorId, assignedAt: now,
    });

    // Step 3b: update denormalised column on the document
    await repo.updateDocumentNumbering(documentId, { preliminaryNumber: numberValue });

    return { numberValue: numberRow.numberValue, /* ... */ };
  });
}
```

Every step traces back to something you've already read. Step 1 calls `documents.fn_get_next_sequence_value` — the same PostgreSQL function TASK-DOCS-001 defines as `SECURITY DEFINER`, atomically incrementing (and, on first use in a new year, silently creating) the sequence for that series and year. Step 2 formats the raw integer into the human-readable string using `series.preliminaryFormat` — literally the `Draft 7SP {YEAR}-{NN}` template from H3, with `{YEAR}` and `{NN}` substituted by `renderNumber`'s template replacement. Step 3 does the two writes the ADR requires happen together: append a row to the `documents.numbers` ledger (an append-only history — you can always ask "what was this document's preliminary number as it appeared in an earlier Order of Business," because the old row is never edited, just eventually superseded), and separately update the denormalized `preliminaryNumber` column on `documents.documents` itself, for fast reads that don't need to join the ledger.

`assignFinalNumber` mirrors this shape but adds the two things ADR-GEN-009 requires of finalization: it guards against re-assignment (`if (doc.finalNumber !== null) { throw new Error('final number already assigned'); }`), and it explicitly *retires* the preliminary number as part of the same transaction — `repo.supersedePreliminaryNumber(documentId, now)` flips the old preliminary ledger row's `is_current` to `false`, and the final `updateDocumentNumbering` call both sets `finalNumber` and clears `preliminaryNumber: null` in the same statement. That's the code-level enactment of "the removal of the 'Draft' prefix constitutes promotion to final status" — not a rename of one field, but a coordinated write across two tables that leaves exactly one authoritative number where there used to be two.

One thing worth flagging honestly: H3 Implementation Note 1 raises a real forward-looking concern — that `7SP`'s `7` is the ordinal of the *current* Sangguniang Panlungsod, and "changes with each administration," suggesting `{SP_NUMBER}` should ideally be a separate configurable column rather than baked into the `prefix` string. Reading the real schema, `numberSeries` does have a distinct `spOrdinal: text('sp_ordinal')` column (schema line 177) separate from `prefix` — so this concern was heeded at the schema level. The `renderNumber` fallback logic in `numbering.service.ts` (used only when a series has no format template) builds the string from `series.spOrdinal ?? ''` plus `series.prefix ?? ''` plus the delimiter, confirming the separation is real in code, not just in the schema comment.

## C. Why the QR Code Comes Before the Preliminary Number

If you've been following section B closely, a question should already be forming: the document row also carries a `qr_tracking_number` — a UUID, `NOT NULL`, unique — and per H2's "What Is Not in JSONB" table, it's "Assigned at secretariat logging, before preliminary number." Why would a document need *two* identifiers assigned within moments of each other at intake? Why not just use the preliminary number as the tracking code?

ADR-GEN-007 answers this directly, and the reasoning is entirely about a different job the QR code has to do. Its purpose isn't legislative record-keeping — it's physical tracking. The moment a paper document arrives at the Secretariat, a QR label gets printed and physically affixed to it, and every subsequent office it passes through scans that label to record the transfer. That process needs to start the instant the document is logged — well before anyone can determine which series it belongs to, let alone what its final approval order will be.

The ADR is explicit that tying the QR code to the preliminary number would create a real operational problem, not a hypothetical one:

> If the QR code were tied to or dependent on the series number, it would either need to be regenerated when the series number changes, or would not exist during the early stages of the document's life — both are unacceptable.

Remember from section B: the preliminary number is *designed to change*. A resolution logged as `Draft 7SP 2026-02` might not keep that exact number all the way to finalization — and the final number, once assigned, is a completely different string with the "Draft" prefix stripped. If the physical QR label encoded the preliminary number, every renumbering event would mean reprinting a label that's already stuck to a piece of paper somewhere in a filing cabinet or an office in-tray. ADR-GEN-007 rejects this explicitly under "Alternatives Considered" — assigning the QR code at the same moment as the preliminary number is "operationally close to the chosen approach but creates conceptual coupling," and using the series number *as* the QR code's content directly is rejected for the same reason: "Series numbers change... using them as QR content would require reprinting labels whenever the number changes. The UUID's immutability is the point."

The decision, stated plainly: the QR tracking number is a system-generated UUID v4, assigned as the *first* database write in the secretariat logging transaction — before the preliminary number, before any metadata, before anything else — and it never changes for the rest of the document's life. H3's own Implementation Note 7 corroborates this from the numbering-specification side of the project: "The QR tracking number is not managed by the `number_series` table. It is generated directly as a UUID at document creation, before any numbering event fires." Two independent documents, written for two different purposes, agree on the same sequencing.

What this buys the Secretariat, per the ADR's stated consequences: physical routing can be tracked from the moment a document enters the building, through committee referral, through both preliminary and final numbering, through VP and Mayor signing, through Panlalawigan review, all the way to archival — without a single label ever needing to be reprinted because a number underneath it changed. The QR code and the series numbers are deliberately decoupled identifiers doing deliberately different jobs: one is a permanent physical-tracking key, the other is the legal document number. A staff member scanning a QR code sees the *current* series number (whichever one currently applies) displayed as metadata alongside the scan result — but the UUID itself, per the ADR, is "never the primary display identifier shown to citizens." It's plumbing, not the thing anyone is meant to read off a page.

## D. OCR — What the Spec Left Open, and What the Code Actually Does

`tech-stack.md`'s OCR Strategy section is unusually candid about being unfinished. It states plainly that OCR is a confirmed Phase 1 requirement — every uploaded document is scanned automatically, and a quality indicator is always shown — but then flags the library choice as an open decision, with a stated evaluation order:

> 1. **`tesseract.js`** — Pure Node.js; no native system dependencies; self-hostable; no cloud vendor required. Preferred given the on-premise deployment constraint...
> 2. **Self-hosted cloud OCR alternative** — Only if `tesseract.js` accuracy is found to be insufficient after testing against real SP Secretariat document samples. Must still be self-hostable with no external API calls...

And regardless of which library eventually wins that evaluation, the document states one non-negotiable architectural requirement:

> **Architectural requirement regardless of library chosen:** The OCR processing call must be wrapped behind a service interface in `/server` so the underlying library is swappable without touching call sites. Do not call the OCR library directly from upload handlers.

So there are two separate questions to check against the real code: which library did the team end up choosing, and — independently of that — did they actually build the swappable-interface requirement the spec demanded regardless of the choice?

The answer to the first question is neither. Reading `ocr.service.ts`, the real, currently-shipped interface and implementation are:

```typescript
export interface OcrProvider {
  extractTextFromS3Key(
    s3Key: string,
    mimeType: string,
  ): Promise<{
    text: string;
    confidenceScore: number;
  }>;
}

export class StubOcrProvider implements OcrProvider {
  async extractTextFromS3Key(): Promise<never> {
    throw new Error('OCR provider not configured -- set OCR_PROVIDER in environment');
  }
}
```

This isn't `tesseract.js`, and it isn't a cloud OCR alternative either — it's a stub that throws when called. A search across the entire repository confirms there's no `tesseract.js` dependency installed anywhere in any `package.json`, and `StubOcrProvider` is the *only* class in the codebase that implements `OcrProvider`. And this isn't just an unused fallback sitting dormant behind a real implementation — `documents.plugin.ts`, the file that actually wires the module together at startup, constructs the live `OcrService` with it directly:

```typescript
const ocrService = new OcrService(
  (fastify as any).boss,
  new StubOcrProvider(),
  new StubPreviewProvider(),
  ocrS3Client,
  env.S3_BUCKET || 'batac-dms-assets',
  db,
);
```

There's no conditional here — no `env.OCR_ENGINE === 'tesseract' ? new TesseractOcrProvider() : new StubOcrProvider()` branch. `StubOcrProvider` is what runs, unconditionally, today. Which means: right now, in this repository, uploading a document and triggering OCR will enqueue the pgboss job correctly, but the moment a worker actually calls the provider to extract text, it throws `'OCR provider not configured -- set OCR_PROVIDER in environment'`. This tracks exactly with what the task list's own Module Summary recorded as an open item — SPEC-GAP-DOCS-01, "OCR library choice open" — and its stated resolution: "TASK-DOCS-010 stubs the OcrProvider interface to be library-agnostic... When the library is chosen, implement the production OcrProvider class (e.g., `TesseractOcrProvider`, `AwsTextractOcrProvider`) and inject it in TASK-DOCS-019 (plugin wiring)." That production class doesn't exist yet.

There's a smaller, more specific wrinkle worth knowing about, because it's the kind of thing that's easy to trip over later: `apps/server/src/config/env.server.ts` *does* declare an env var for this decision —

```typescript
const OcrEngine = z.enum(['tesseract', 'service']);
// ...
OCR_ENGINE: OcrEngine.default('tesseract'),
```

— but a repository-wide search confirms `OCR_ENGINE` is read nowhere else in the codebase. It's validated by the env schema and then never consulted by any code path, including `documents.plugin.ts`'s hardcoded `new StubOcrProvider()` above. If you're working in this module and you set `OCR_ENGINE=service` in your `.env` expecting it to switch anything, nothing will happen — the variable is real, typed, and validated, but it isn't wired to a decision point yet. It's scaffolding for a choice the team anticipated making, not a working switch.

Now the second, independent question — did the team meet the "wrapped behind a service interface... swappable without touching call sites" requirement, even without having picked a library yet? Here, the answer is genuinely yes, and it's worth giving the code credit for it. `OcrService`'s constructor takes an `OcrProvider` as an injected dependency, not as something it constructs internally:

```typescript
export class OcrService {
  constructor(
    private readonly pgBoss: PgBoss,
    private readonly ocrProvider: OcrProvider,
    private readonly previewProvider: PreviewProvider,
    private readonly s3: S3Client,
    private readonly bucket: string,
    private readonly db: AppDb,
  ) { /* ... */ }
```

Nothing in `enqueueOcrJob`, `processOcrCallback`, or any other method reaches for a specific OCR library by name — they all call `this.ocrProvider.extractTextFromS3Key(...)` through the interface. When a real `TesseractOcrProvider` (or a cloud-alternative provider) eventually gets written, the only change needed is the single line in `documents.plugin.ts` that currently reads `new StubOcrProvider()` — every other line in `ocr.service.ts`, and every call site elsewhere in the module, stays exactly as it is. That's precisely the shape `tech-stack.md` asked for. The library decision is genuinely still open — but the seam the eventual decision needs to slot into was actually built correctly, on the first pass, without needing to know which library would eventually fill it. It's a good example of a spec's "regardless of which choice you make" requirement being honored even while the choice itself remains unmade.

## E. Three Routers, Three Distinct Real-World Processes, One Schema

Chapter 1.4 already walked you through *how* `complaints.router.ts`, `document-requests.router.ts`, and `panlalawigan.router.ts` get composed into the single `documents` tRPC namespace — two different mechanisms, `t.mergeRouters` for the first two and plain object spread for the third, at two different points in the module's router-construction process. This section isn't re-deriving that. It's answering a question Chapter 1.4 deliberately left aside: *why does the domain need three separate files here at all*, rather than one `documents.router.ts` with more procedures in it?

The answer is that these three files aren't alternate ways of doing the same thing to documents — they're three genuinely different real-world processes that a citizen or a councilor would describe completely differently, and that only share infrastructure because of a Phase 1 storage decision, not because they're conceptually the same feature.

**A citizen complaint** is someone reporting a grievance — a problem with a tricycle driver, a neighbor dispute, whatever falls under the SP's jurisdiction — that then needs routing to the right committee and eventually a resolution. Reading `complaints.router.ts`, the shape of the data reflects that: a `complainant` object, an optional `respondent`, `incidentDetails` with a narrative, and an `outcomeState` that moves through `pending_hearing → received_seen → dismissed | resolved`. There's no numbering series involved at all — H2's catalog explicitly marks `CITIZEN_COMPLAINT`'s `number_series_id` as `NULL`, with a footnote noting "Citizen Complaint and Document Request Form have no control number managed by the `number_series` system." The document doesn't move through the legislative reading-and-voting pipeline; it moves through committee assignment and an outcome decision. `logAndAssign` — sp_secretary only — is where a complaint gets routed to a specific office, because per the task spec, "Secretariat decides routing, no fixed path." That's a fundamentally different workflow shape than anything else in this module.

**A document request** is the opposite direction entirely: not someone reporting a problem, but someone asking for a *copy* of something that already exists — a certified copy of a resolution, say. Reading `document-requests.router.ts`, the metadata shape reflects a completely different concern: a `requester`, an array of `documentsRequested` (each with a title, an optional linked `documentId`, page count), and — distinctively — a two-step approval gate before release, modeled with `vm_approved`/`sp_approved` fields on the metadata (with an explicit `TODO(WF-INTEGRATION)` comment noting these are a Phase 1 stand-in for real Workflow Engine steps, per ADR-EVT-001). `approveAsSecretary` won't proceed unless `vm_approved` is already true, throwing `PRECONDITION_FAILED` otherwise — a real business rule enforced in code, "Presiding officer approval required first." And critically, per the task spec's Q-D04 note: payment is optional and does *not* block release. A requester can walk away with their copy before the payment system (deferred to Phase 2) even exists. None of this — the dual-approval gate, the optional-payment nuance, the requested-documents array — has any equivalent in the complaints flow. They're not variations on a theme; they're different features that happen to both be "something a citizen interacts with via the SP Secretariat."

**Panlalawigan review** is different again, and arguably the most operationally distinct of the three. This isn't citizen-facing at all — it's the SP Secretariat tracking a legal obligation under Section 54 of the Local Government Code: every SP Resolution, Ordinance, and Appropriation Ordinance passed has to be transmitted to the Sangguniang Panlalawigan (the Provincial Council) for review, which then has exactly 30 days to respond before the measure is *deemed approved by operation of law* — automatically, with no further action from anyone. `panlalawigan.router.ts` reflects this with a dedicated table, `documents.panlalawigan_reviews`, not just a metadata blob — because this data has its own lifecycle (`transmitted_at`, `action_deadline`, `outcome`, `days_elapsed`) that's worth first-class columns and its own unique constraint (`uq_panlalawigan_reviews_document`, one review per document). And it has a rule the other two routers don't: `logPanlalawiganOutcome` explicitly forbids a human from ever setting the `deemed_approved` outcome —

```typescript
if (input.outcome === 'deemed_approved') {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'deemed_approved is set by the system only',
  });
}
```

— because that outcome isn't a decision anyone makes; it's a legal consequence of *time passing without a response*, and it's only ever set by the nightly `panlalawigan.checkDeemedApproved` scheduled job you can see registered in `documents.plugin.ts` (running at 6 AM Philippine time, checking for reviews where `transmitted_at + 30 days <= now()` with no outcome yet recorded). No citizen ever touches this flow; no complaint ever gets "deemed approved." It's a genuinely separate concern operating on genuinely separate infrastructure — pgboss scheduling, a dedicated table — that simply happens to reference the same `documents.documents` row the other two features also touch.

That's the actual organizing principle behind the file split: not "these are all document operations, so let's group them by CRUD verb," but "these are three distinct things a person outside the Secretariat would never confuse with each other — filing a complaint, requesting a copy, and legally-mandated provincial oversight — that this project happens to implement against one shared schema boundary because of a Phase 1 storage decision documented in the task list as CONFLICT-DOCS-01" (E1's spec called for separate `portal.complaints` and `portal.citizen_requests` tables; C1's actual DDL doesn't create a `portal` schema in Phase 1 at all, so both features live as `documents.documents` rows distinguished only by `document_type_code`, with `portal.*` deferred to Phase 3). The file boundary follows the feature, not the storage location — which is exactly why, when you go looking for "how does a citizen complaint work," you go to `complaints.router.ts` and find a complete, self-contained answer, rather than hunting through a monolithic `documents.router.ts` for the complaint-shaped procedures mixed in among everything else.

## F. The `index.ts` Question — What the Architecture Document Says, and What the Real File Actually Does

This is the section this chapter asked you to read most critically, so read the evidence in the order it's presented, because the honest answer here turns out to be more interesting than a simple pass/fail.

### What J4 says `index.ts` is for

J4 (`j4-module-structure-template.md`) is this project's normative reference for what every module's files are supposed to contain. Its document header carries a conflict note worth quoting in full, because it directly concerns the exact file this section is about:

> **Conflict note — `index.ts` role:** The J4 scope brief assigned "Fastify plugin registration" to `index.ts`. This conflicts with two source documents. B2 (Enforcement Mechanisms) states that `index.ts` is the Published API barrel file: it "exports **only** the Published API interface. Internal files, services, and repositories are not re-exported." J1 (§4 Module Plugin Pattern) places Fastify plugin registration in `{module}.plugin.ts`. This document follows J1 and B2. If the intent is to merge plugin registration into `index.ts`, that is a deviation and requires an ADR before implementation.

In other words: even before you get to the file-by-file rules, the document is already flagging that there was disagreement about what `index.ts` should hold, and stating explicitly which side it comes down on — the barrel-only interpretation — while leaving the door open for a deliberate, documented deviation.

Section 3.1 then states the rule for `index.ts` in full:

> **Role:** The module's only permitted export point for other modules. Exports the Published API interface and the cross-module types callers need to consume it. Contains no implementation code.
>
> **Key rules:**
> - Exports **only** the Published API interface and associated public types. Internal files, services, repositories, and schemas are never re-exported from this file.
> - The automated coupling test suite rejects any import of `modules/documents/src/...` in another module's source. The only permitted cross-module import path is `modules/documents/index.ts`. (B2 — Prohibited Pattern P2)
> - Any new type added to the Published API surface must be declared in `documents.types.ts` and re-exported here.
>
> **Must not contain:**
> - Service factory functions or implementations
> - Repository factory functions or implementations
> - Drizzle schema references
> - Fastify plugin registration
> - Module-private types that have no Published API use

And Section 8, the Deviation Policy, lists exactly this kind of change among the examples that require an ADR before implementation: "Changing `index.ts` to export internal implementation details."

### What the real file actually contains

Here is `apps/server/src/modules/documents/index.ts`, in full — all 24 lines, verified against the file on disk in this session rather than recalled from any prior read:

```typescript
export * from './documents.types.js';
export { createDocumentsRouter } from './documents.router.js';
export { createComplaintsRouter } from './complaints.router.js';
export { createDocumentRequestsRouter } from './document-requests.router.js';
export { createDocumentsAppRouter } from './documents.app.router.js';
export type {
  SubjectContext as DocumentsSubjectContext,
  CreateDocumentAttrs,
  ReadMetadataAttrs,
  UpdateDocumentAttrs,
  SoftDeleteDocumentAttrs,
  SubmitDocumentAttrs,
  CancelDocumentAttrs,
  AssignPreliminaryNumberAttrs,
  AssignFinalNumberAttrs,
  CertifyUrgentAttrs,
  ArchiveDocumentAttrs,
  PublishPortalAttrs,
  ContentReadAttrs,
  CreateVersionAttrs,
  ScanQualityAttrs,
} from './documents.policy.js';
export { DocumentPolicyGuard } from './documents.policy.js';
```

Now do the comparison J4 §3.1 asks for, line by line, against its own "Must not contain" list:

- **Service factory functions or implementations** — not present. `createDocumentsService` is never imported or re-exported here.
- **Repository factory functions or implementations** — not present. `DocumentsRepository` is never imported or re-exported here.
- **Drizzle schema references** — not present. Nothing from `@batac/database/schema/documents.schema.js` is touched.
- **Fastify plugin registration** — not present. `documents.plugin.ts` (the file that actually calls `fp(documentsPlugin, {...})`) is never imported here at all.

So, checked against what J4 §3.1 explicitly forbids, this file doesn't violate any of the five listed prohibitions. What it *does* export, beyond a strict single-`DocumentsPublicAPI`-interface reading of "Published API barrel," is real but narrower than the prohibition list: four tRPC router factory functions (`createDocumentsRouter`, `createComplaintsRouter`, `createDocumentRequestsRouter`, `createDocumentsAppRouter`) and the `DocumentPolicyGuard` class plus its associated ABAC attribute types. Whether router factories and a policy guard class belong in a barrel whose stated role is "exports **only** the Published API interface... Contains no implementation code" is a real, fair question — a router factory is arguably implementation, not interface — but it's a materially different and smaller gap than a barrel exporting the service factory, the repository class, or the plugin outright. None of J4's five explicitly named forbidden exports are the ones actually present.

### The automated coupling test — does it exist?

J4 §3.1 makes a specific, checkable factual claim: "The automated coupling test suite rejects any import of `modules/documents/src/...` in another module's source." This is the kind of claim you shouldn't take on faith — it's either true of the repository or it isn't, and it's worth checking directly rather than assuming either way.

A search across every `.test.ts` and `.spec.ts` file in this repository for the word "coupling" — case-insensitive, no path restriction — returns zero matches. Not in the `documents` module's `__tests__` directory, and not anywhere else in the codebase. No test suite anywhere asserts that importing from `modules/documents/documents.service.ts` (or any other module's internal file) directly, bypassing `index.ts`, should fail.

More than that: one existing test in this exact module actively demonstrates the opposite of what such a test would assert. `apps/server/src/modules/documents/__tests__/documents.scaffold.test.ts` opens like this:

```typescript
import { createDocumentsService } from '../documents.service.js';
import { DocumentsRepository } from '../documents.repository.js';
import { createDocumentsRouter } from '../index.js';

describe('Documents Module Scaffold', () => {
  it('exposes the factory functions and repository class', () => {
    expect(createDocumentsService).toBeDefined();
    expect(createDocumentsRouter).toBeDefined();
    expect(DocumentsRepository).toBeDefined();
  });
```

This test imports `createDocumentsService` straight from `'../documents.service.js'` and `DocumentsRepository` straight from `'../documents.repository.js'` — both bypassing `index.ts` entirely — and its own name is "exposes the factory functions and repository class." That's not a coupling test failing to catch a violation; it's a test whose explicit purpose is to confirm these things *are* directly importable. It's worth being precise about what this test is and isn't inside this module: it's the module's own test file importing its own module's internals, which TypeScript's module system always permits regardless of any barrel convention — it says nothing by itself about whether a *different* module could do the same thing. But it does mean the specific artifact J4 describes — an automated suite that rejects this pattern — is not present anywhere in this repository, inside this module or otherwise. If such a test exists, it isn't visible from a straightforward search of the entire test suite by name.

### What this means for a developer working in this module today

Put the three pieces together plainly: the real `index.ts` doesn't export the five things J4 §3.1 explicitly names as forbidden, so measured strictly against that prohibition list, it isn't in violation. But the enforcement mechanism J4 cites as the backstop for the whole barrel convention — the automated coupling test that would reject a *different* kind of violation, a cross-module direct import bypassing `index.ts` altogether — does not appear to exist in this codebase, in this module or in any other. That second fact matters more than the first, because it means the barrel convention, whatever its exact current shape, is currently enforced by nothing except developer discipline and code review.

This is not a hypothetical concern or a minor stylistic quibble, and it shouldn't be treated as one. If tomorrow a change to, say, the Workflow module needed something from inside `documents.service.ts` that isn't currently re-exported through `index.ts`, there is nothing in this repository today — no test, no lint rule (confirmed independently in section G below), no build-time check — that would stop a developer from writing `import { createDocumentsService } from '../documents/documents.service.js'` directly and having it work exactly as if it were sanctioned. J4 describes this as a "Prohibited Pattern," but a prohibition with no enforcement mechanism behind it is a convention, not a guarantee — and treating it as a guarantee when you're reasoning about whether this module's boundary is actually safe to depend on would be a mistake.

The right move here, and the one J4's own Section 8 explicitly makes room for, is not to assume either that the barrel currently gatekeeps cross-module imports or that it's abandoned entirely. It's to treat "does this module's `index.ts` actually enforce anything today" as an open question that needs a decision — either write the ADR J4's Deviation Policy calls for, formally documenting the barrel's current, narrower scope (router factories and the policy guard, alongside the public API types) as the accepted pattern, or build the automated coupling test J4 already claims exists, so the convention becomes something the repository actually enforces rather than something only this document asserts. Either resolution is fine. Leaving it unresolved, and assuming the boundary holds because a document says it should, is the one option that isn't.

## G. So — What's the Practical Risk Today?

Given everything in section F, here's the honest, checked-rather-than-assumed answer to what happens if another module reaches past `documents/index.ts` for something it shouldn't.

Section F already established there's no test anywhere in the repository — in the `documents` module or elsewhere — that would catch this at the test-suite level. The remaining question is whether a lint rule catches it instead, which the task explicitly asked to verify by searching `/packages/config/` directly rather than assuming.

`/packages/config/` contains exactly one ESLint-related file: `eslint.base.js`. Reading it, the top of the file imports and registers `eslint-plugin-boundaries` — a real ESLint plugin specifically built for exactly this kind of module-boundary enforcement:

```javascript
const boundariesPlugin = require('eslint-plugin-boundaries');
// ...
plugins: {
  '@typescript-eslint': tsPlugin,
  import: importPlugin,
  boundaries: boundariesPlugin,
  jsdoc: jsdocPlugin,
},
```

But scanning the `rules` object in that same file — every rule from `@typescript-eslint/no-explicit-any` through `no-restricted-syntax` — there is not one single `boundaries/*` rule turned on. The plugin is imported, registered under the `boundaries` key, and then never used. A repository-wide search for the literal string `boundaries/` across every JS, CJS, and JSON config file in the codebase returns zero matches. Whatever rule this plugin was brought in to eventually enforce — presumably something like the exact "only import via a module's `index.ts`" rule J4 describes — it was never actually configured.

It gets more specific still. `eslint.base.js` is a shared base config; something has to actually load and run it against a given package for any of its rules, active or not, to matter. Searching the whole repository for ESLint entry-point files finds exactly one flat config anywhere: `apps/web/eslint.config.cjs`, which extends the base config and layers on React-specific rules — and that file governs the `apps/web` frontend package, not `apps/server`, where the `documents` module actually lives. There is no `eslint.config.cjs`, `eslint.config.js`, or any `.eslintrc*` file anywhere under `apps/server` at all.

Checking whether this even matters in practice: every workspace package's `package.json` was checked for a `lint` script, since that's what `pnpm lint` (which resolves to `turbo run lint`) actually fans out to. Across the entire monorepo — every app and every package — exactly one package defines one: `apps/web`, with `"lint": "eslint ."`. `apps/server/package.json` has no `lint` script at all. Turborepo simply has nothing to run for a package that doesn't define the task, so running `pnpm lint` at the root today does not invoke ESLint against `apps/server/src/modules/documents` — or against any other server-side module — under any configuration, active rules or not.

So, stacking all three findings together: even in the world where `boundaries/*` rules eventually get configured in `eslint.base.js`, there's currently no ESLint config file wiring that base config into `apps/server` at all, and no `lint` script that would invoke ESLint against that package even if there were. The plugin import in `eslint.base.js` reads as clear intent — someone brought in exactly the right tool for this job — but intent isn't the same as a working check, and right now there's a three-part gap between the two: no active rule, no config file applying the base config to the server app, and no script that would run it if there were.

The practical risk, then, is real but bounded by what it actually takes to trip: nothing mechanical stops a cross-module direct import from `apps/server/src/modules/documents/documents.service.ts` today — not a test (section F), not a lint rule (this section) — which means the module boundary currently depends entirely on developers reading and following J4 by hand, and on code review catching it if they don't. That's a materially different (and weaker) guarantee than "the coupling test suite rejects this," which is what J4's own text currently claims. Given `eslint-plugin-boundaries` is already sitting in the dependency tree, unconfigured, closing this gap looks less like new infrastructure and more like finishing wiring that was already started — which is exactly the kind of finding worth writing up as a development-log entry or a small follow-on task, rather than something to assume is either already handled or hopelessly absent.

---

# Chapter 2.5 — The Workflow Module, Part One: Shape

## Before the steps: what this chapter is and isn't

The Workflow module is the largest thing in this codebase — 60 files, by the file-count research that opened this arc — and it is also the module with the deepest paper trail behind it. Before a single line of `apps/server/src/modules/workflow/` was written, three separate documents had to agree on what a "step" even is: `b4-workflow-engine-specification.md` (the engine's behavior contract), `d3-state-machine-diagrams.md` (the authoritative state machines, including four ADRs that rewrote parts of B4 after the fact), and `h1-phase-1-workflow-definitions-structured-data.md` (the actual seed data — real TypeScript constants — for the three legislative workflows Phase 1 ships). This chapter's job is to hand you the vocabulary those three documents built, checked against what actually landed in `packages/database/schema/workflow.schema.ts` and the real seed file, `packages/database/src/seeds/workflow/phase1-legislative.ts`.

What this chapter does *not* do is trace a document through the system. That's Chapter 2.6's job — one real SP Resolution, from `intake_logging` to a terminal step, step by step, using every term this chapter defines. If you try to read 2.6 first, you'll survive, but you'll be constantly stopping to ask "wait, what's the difference between a step *definition* and a step *instance* again?" This chapter exists so you don't have to stop.

One more thing worth knowing before you start: this chapter is going to show you a few places where the documentation and the real code disagree — not hand-wave past them, but name them precisely, because the disagreements themselves teach you something about how a spec-heavy, AI-agent-built project actually settles over time. None of them are dramatic. All of them are worth knowing before you read the actual TypeScript.

---

## A. The Step-Type Taxonomy

`workflow/index.ts` — the module's Published API barrel, the same pattern you saw in Chapter 2.4 — exports this union directly:

```typescript
export type WorkflowStepType =
  | 'action'
  | 'approval'
  | 'multi_referral'
  | 'decision'
  | 'notification'
  | 'termination'
  | 'parallel_split'
  | 'parallel_join';
```

Eight values. Six of them are real, executable step types in Phase 1. Two of them exist purely as names in an enum, reserved for a phase that hasn't been built yet. Here's each one, in B4's own terms, with what actually runs underneath it.

### `action` — someone does a thing, nothing branches

B4 §4.1 describes this as the type for "a task with no branching outcome" — the step records that something happened and who did it, and that's the whole job. Its outcome code is always `DONE`. In the real seed data, this is by far the most common step type: `intake_logging`, `order_of_business_scheduling`, `first_reading`, `amendments_logging`, `final_number_assignment`, `transmittal_letter_to_mayor`, `docketing`, `panlalawigan_transmission_logging`, `portal_publication`, `archive` — ten of SP Resolution's 28 steps are `action`. These are the Secretariat's bookkeeping moments: log the intake, record that First Reading happened, generate the transmittal letter. An `action` step can also be `auto_complete: true`, meaning the engine finishes it itself the instant it activates, with no human involved — useful for purely system-driven logging, though none of the real SP Resolution steps use this flag.

Two `action` steps carry a config field you won't find in B4 §4.1's own table at all: `triggers_mayor_lapse_timer` and `triggers_panlalawigan_timer`. H1 flags these honestly as `[Extension]` — fields the workflow-definitions document had to invent because B4's action-step contract never specified *how* the 10-day and 30-day clocks actually get started. The real seed data resolves this exactly as h1 proposed: `transmittal_letter_to_mayor` carries `triggers_mayor_lapse_timer: true`, and `panlalawigan_transmission_logging` carries `triggers_panlalawigan_timer: true`. When either step completes, the engine writes the corresponding deadline into the instance's context.

### `approval` — someone makes a decision, and the decision branches

B4 §4.2: "an actor reviews a document or action and makes a binary or ternary decision," and "the branching outcome determines the next workflow step." This is the type that carries almost every piece of domain vocabulary from Chapter 0.2. Look at B4's own outcome-code table and you'll recognize every term:

| Code | Meaning | Who sets it |
|---|---|---|
| `APPROVED` | Actor approves | Actor |
| `REJECTED` | Actor rejects | Actor |
| `RETURNED_FOR_REVISION` | Sent back for amendment | Actor |
| `SIGNED` | Document signed (VP or Mayor) | Actor |
| `VETOED` | Mayor vetoes | Actor |
| `LAPSED` | Mayor took no action within 10 days | **Scheduler only** |
| `OVERRIDE_SUCCEEDED` / `OVERRIDE_FAILED` | SP veto-override vote | Secretariat actor |
| `VALID` / `VALID_IN_PART` / `RETURNED` / `OPERATIVE_IN_ITS_ENTIRETY` | Panlalawigan outcomes | Secretariat actor |
| `DEEMED_APPROVED` | Panlalawigan 30-day lapse | **Scheduler only** |

That's `mayor_review`, `veto_override_vote`, and `panlalawigan_review` in the real seed data, each of them an `approval` step with `allowed_outcomes` matching this table almost verbatim. The two codes marked "scheduler only" get an explicit engine guard: B4 Invariant #3 states that `LAPSED` and `DEEMED_APPROVED` may only be submitted with `actor_type = system`, and a human actor attempting either is rejected with `FORBIDDEN`. This is the part of the system where a *human's silence* becomes a *machine's action* — the Mayor doesn't submit `LAPSED`, the scheduler does, on the Mayor's behalf, once the clock runs out.

One small, genuine wrinkle worth flagging here rather than smoothing over: the real seed file's `second_reading_vote` and `second_reading_amended_vote` steps carry `allowed_outcomes: ['APPROVED', 'AMENDED', 'RETURNED_FOR_REVISION', 'REJECTED']` and `['APPROVED', 'AMENDED', 'REJECTED']` respectively — with an `AMENDED` outcome code that appears in neither B4 §4.2's table nor H1 §2.3's outcome-code list. It isn't a bug — the real transition rules for both steps have a properly covering `outcome_filter: 'AMENDED'` rule routing to `final_number_assignment`, so nothing breaks — it's simply a small vocabulary addition the implementation made that the specification documents never caught up to recording. Worth knowing if you go looking for `AMENDED` in B4 and can't find it: you're not misreading the spec, the spec is just slightly behind the code on this one point.

### `multi_referral` — the committee-referral mechanism from Chapter 0.2, made concrete

Recall from Chapter 0.2 section A: most measures go to two committees at once — the subject-matter committee plus the Committee on Laws by default — and they produce one unified report, not two separate ones. B4 §4.3 is the step type that implements exactly that. It's the one step type whose completion condition isn't "one actor decides" but "every assigned committee contributes, and then the SP Secretary accepts the unified result." B4's engine invariant #2 makes this literal: a `multi_referral` step with `require_all_committee_signatures: true` cannot complete with `REPORT_ACCEPTED` unless every committee has a submission entry, *or* the SP Secretary has invoked manual advance.

Manual advance itself is worth naming precisely, because it's the one place the Secretariat can force a `multi_referral` step forward without full committee participation — and B4 is strict about the cost of doing so: `outcome_comment` must be non-empty, the engine marks any silent committee's submission entry as `missed: true`, and the whole action is audit-logged. This is the "gap gets visibly flagged so it isn't quietly forgotten" behavior Chapter 0.2 described for a missing co-referred committee, now given a concrete outcome code: `SECRETARY_ADVANCED`.

The real seed data's `committee_referral` step matches B4's config contract field-for-field: `default_committee_roles: [ROLE.COMMITTEE_LAWS]`, `thursday_cutoff_enabled: true`, `require_all_committee_signatures: true`, `allow_secretary_advance: true`. The Thursday-cutoff mechanism itself — which Tuesday a measure becomes eligible for Second Reading, based on whether all committees submitted before Thursday 23:59:59 PHT — is scheduling logic layered on top of this step type, not a separate step type of its own; B4 §6.2 covers the exact date math, and it's squarely Chapter 2.6 material once you're tracing a real instance through real time.

### `decision` — the system branches, nobody's asked

B4 §4.4: a system-evaluated branch, `auto_complete` always `true`, no user action possible even in principle. On activation, the engine evaluates a JSONLogic `condition_expression` against `instance.context` and routes based on whether it's truthy or falsy. B4 gives worked examples like `{ "==": [{ "var": "certified_urgent" }, true] }` — and it's explicit that this step type does *not* handle the 10-day/30-day timers directly; those are scheduler jobs that write context keys (`mayor_action = 'LAPSED'`), and a `decision` step downstream can then branch on that context value. In SP Resolution's real 28-step sequence, there's exactly one: `final_outcome_check`, near the very end, which reads `instance.context.panlalawigan_outcome` to decide whether the instance should terminate as a clean `APPROVED_AND_RELEASED` or as a `VALID_IN_PART_RESOLVED`.

### `notification` — fire-and-forget, always completes

B4 §4.5: the engine enqueues a notification and completes immediately; delivery failure doesn't affect the workflow at all. This is the cleanest of the six types precisely because it has no branching logic and no human dependency — it exists purely to tell someone something happened.

### `termination` — the workflow ends, and how it ends is data, not code

B4 §4.6 is where a workflow instance's life actually stops. A `termination` step's config carries an `outcome_code` (one of nine defined values — `APPROVED_AND_RELEASED`, `LAPSED_INTO_LAW`, `VETOED_OVERRIDE_FAILED`, `REJECTED_AT_VOTE`, `REPASSED`, and others) and a `final_document_status` telling the documents module what to do with the underlying document (`RELEASED`, `ARCHIVED`, or `CANCELLED`). SP Resolution's real workflow has five separate termination steps — `end_approved_and_released`, `end_valid_in_part_resolved`, `end_rejected_at_vote`, `end_vetoed_override_failed`, `end_repassed` — each one a distinct destination in the flow diagram, not five branches inside one generic "end" step. This matters because it makes every possible ending of a legislative document's life a first-class, separately named, separately auditable thing in the definition itself.

`REPASSED` is the one termination outcome that behaves nothing like the other eight, and it's worth sitting with, because it's the direct implementation of Chapter 0.2 section G's Panlalawigan `RETURNED` outcome. B4 §4.6 states it plainly: on `outcome_code = REPASSED`, the instance is **not** set to `completed`. Section D below covers exactly what does happen to it.

### Are `parallel_split` and `parallel_join` real?

No — not in the sense of "you can build a definition using them and run it." They're in the type union, they're in the database enum, and they're in the Zod schema, but they are unambiguously Phase 2 reserved. B4 §5 is direct about this: "these types are not executable in Phase 1." The reason they exist in the schema at all — rather than being added later — is that a future Phase 2 feature (the Barangay Budget workflow's four-office simultaneous preliminary review: Local Finance Committee, Budget Office, Treasury Office, CPDO) genuinely needs concurrent branching, and it's cheaper to reserve the enum slot now than to run a database migration later just to add two values.

The guard against actually using them is enforced twice, at two different moments, by two different pieces of real code — which is itself worth noticing as a pattern, because it's the same load-time-versus-runtime split this chapter comes back to in Section D:

- **At publish time**, `definition-validator.ts` checks every step in a definition and rejects publication outright if any step's `stepType` is `parallel_split` or `parallel_join`, with the error code `STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1`.
- **At instance-creation time**, `create-instance.ts` checks the *start* step specifically — in case a migrated or hand-edited definition somehow slipped past the first guard — and if the start step is one of the two reserved types, it sets the instance straight to `stuck`, writes a `workflow.step.failed` event, and throws.

So: two step types are named in the taxonomy, present in every layer of the schema, and completely inert. If you're reading a workflow definition and you see either of these types, either something has gone wrong, or you're looking at a Phase 2 sketch, not a real Phase 1 definition.

---

## B. Definition, Definition Version, Instance — Three Different Things Wearing Similar Names

This is the distinction Chapter 2.6 will assume you already have cold, so it's worth being unhurried about it here.

**A definition (`workflow.definitions`) is the abstract template.** It's "the SP Resolution process" as an idea — not any particular resolution's journey through it, just the fact that such a process exists and has a name. In the real schema, a `definitions` row is mostly identity and metadata: `name`, `description`, `document_type_id`, and `is_active`. There's a real database constraint worth knowing about here, enforced by a partial unique index: at most one definition can be `is_active = true` per document type at any moment. You can have old, deactivated definitions sitting around, but only one can be the live one for, say, `sp_resolution` at a time.

**A definition version (`workflow.definition_versions`) is a specific, immutable snapshot of that template.** This is the layer where "the actual steps and transition rules" live — or rather, where the *authoritative* copy of them lives, since (as Section C below explains) the individual `steps` and `transition_rules` rows are a derived, denormalized convenience on top of this row's `snapshot` JSONB column. B4 §2.2 states this precisely: "once published, a version cannot be modified; editing a definition creates a new version." The real Drizzle schema encodes this with a generated column — `status` computes to `'Draft'`, `'Published'`, or `'Deprecated'` purely from whether `published_at` and `deprecated_at` are null, so there's no separate status field to accidentally desync from the timestamps that actually determine it.

Why does versioning matter enough to be its own layer, rather than just letting a definition mutate in place? Because of a scenario that's completely ordinary in a legislative body: the SP Resolution process changes next year — maybe a new mandatory review step gets added — but there are real resolutions *right now*, mid-flight, partway through the *old* process. Those in-flight documents cannot be silently and retroactively subjected to a rule they were never told about when they started. B4 §7.1 states the rationale directly: "retroactively applying these changes to in-flight documents would be legally incorrect and auditorially unsound." A new definition version doesn't touch anything already running. It only affects instances created *after* it's published.

**An instance (`workflow.instances`) is one actual document's specific, live journey through one specific definition version.** This is the layer where "this particular resolution, right now" lives — its current `status`, its mutable `context` JSONB, its `sla_deadline`. The link back to a definition version isn't just a foreign key that happens to be there at creation and could drift later; it's architecturally locked. `workflow/index.ts` states this in the exact words of the real code comment:

```typescript
definitionVersionId: string; // pinned at creation; immutable except via migrateInstance
```

"Pinned at creation" is not a suggestion, it's an enforced invariant. B4 §9's invariant #1 is explicit about the enforcement mechanism: "no SQL update path exists outside `engine.migrateInstance`." You can verify this yourself in `create-instance.ts` — the function resolves the current published version for the target definition exactly once, at the very top, and writes it into the new instance row. Nothing downstream in that function, or anywhere else in the real engine code, ever writes to that column again through an ordinary code path.

So why does `migrateInstance` exist at all, if the whole point of pinning is "don't let in-flight documents get disrupted"? Because "never" is too strong a rule for the one scenario that genuinely needs an exception: a legally mandated change that has to apply even to documents already running. B4 §7.3 describes this as "a high-risk operation intended for exceptional circumstances only," and the preconditions make that seriousness concrete rather than just asserted: a newer published version must exist; a valid, unexpired City Administrator approval record must exist specifically for this migration (the real schema backs this with its own table, `workflow.admin_approval_grants` — an `approvedBy`, an `expiresAt`, a `usedAt`); the caller must be a Platform Administrator; the reason must be non-empty; and the instance must actually be `active`. Migration isn't a side door around the pin — it's a separate, heavily-gated, fully audited front door, deliberately built to be harder to walk through than ordinary instance creation. You'll meet the concrete mechanics of this — and the module that exposes it, `admin-operations.ts` — properly in Chapter 2.6; for now, the important thing to hold onto is *why* it has to be a distinct, exceptional path rather than just another way to update a column.

---

## C. Step Definition vs. Step Instance — The Same Distinction, One Level Down

Everything Section B just established about definitions and instances repeats, in miniature, at the level of an individual step.

**A step definition** is a row in `workflow.steps`, and it's part of the abstract template. "First Reading," as an abstract `action` step with a particular assignee-resolution expression and a particular `form_key` — that's a step definition. It exists once per definition version, it's immutable once that version is published, and it doesn't know or care about any particular document.

**A step instance** is a row in `workflow.step_instances`, and it's that specific step as it actually occurred (or is currently occurring) for one specific document's workflow instance. The real schema makes the relationship explicit: `stepInstances.stepId` is a foreign key to `steps.id` — always, per B4 §2.6's own note, "from the pinned definition version." A step instance carries the things that only make sense for one concrete occurrence: `assigned_to` (who this was actually resolved to, at this moment, for this document), `started_at`, `completed_at`, `outcome`, `outcome_comment`.

One detail worth being precise about, because it will matter directly in Chapter 2.6 when you watch a document get sent back for revision: step instances are not reused across attempts. D3 §3 states this explicitly — "if a step is returned and the workflow later re-enters that step position (revision loop), a new step instance is created for the next attempt." If `second_reading_vote` returns a resolution for amendments and, hypothetically, the workflow definition routed back through an earlier step again, you would not see the *same* step instance flip back to `active`; you'd see a brand-new row, with the old one left exactly as it was — permanently, as a historical record of what happened on that specific attempt. This is the same "immutable history, append-only trail" instinct you've seen elsewhere in this codebase (the event bus in Chapter 1.7, the audit schema in Chapter 1.1), applied at the step-execution grain.

---

## D. `definition-validator.ts` — What Gets Checked Before a Definition Can Run

This file answers a narrow, specific question: *is this definition version structurally sound enough to publish?* It is not the engine. It never runs an instance, never resolves an assignee, never evaluates a JSONLogic condition against real context. It runs once, at the moment someone tries to publish a definition version (or, in practice today, at the moment the seed script tries to seed one), and it either says yes or hands back a list of specific, named problems.

Reading the real 147-line file top to bottom, here's the full list of what it actually checks, in the order it checks them:

1. **Exactly one start step.** It filters for `isStart` and fails with `MISSING_START_STEP` if none exist, or `MULTIPLE_START_STEPS` if more than one does. This is the database-level invariant from B4 §2.3 ("exactly one step per definition version must have `is_start = true`") given a concrete, callable check.

2. **The Phase 1 parallel-type guard.** For every step, if its type is `parallel_split` or `parallel_join`, it fails with `STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1` — the same check Section A already described, applied here at the structural level rather than the runtime level.

3. **`MISSING_LAPSE_TRANSITION`.** For every `approval` step whose `allowed_outcomes` includes `LAPSED`, there must be at least one outgoing transition rule with `outcome_filter === 'LAPSED'`. If there isn't, the validator fails the definition — because otherwise you'd have a step where the scheduler *could* fire `LAPSED` at runtime and the engine would have nowhere to route the instance, which is exactly the "stuck" failure mode Section E's cousin machinery exists to catch.

4. **`MISSING_DEEMED_APPROVED_TRANSITION`.** The same check, symmetrically, for `DEEMED_APPROVED`.

5. **`MISSING_OUTCOME_TRANSITION`.** More generally: for *every* outcome code an `approval` step lists in `allowed_outcomes` (skipping the two scheduler-only codes already checked above), there must be a transition rule that either matches that exact outcome or is unconditional (`outcomeFilter === null`). This is the general form of B4 §4.2's own stated requirement: "every outcome code in `config.allowed_outcomes` must have at least one outgoing transition rule with a matching `outcome_filter`, or a default unconditional transition must exist."

6. **`MISSING_CERTIFIED_URGENT_TRANSITION`.** Every `multi_referral` step must have an outgoing rule with `outcome_filter === 'BYPASSED_CERTIFIED_URGENT'` — because if a Certified Urgent bypass fires against a `multi_referral` step that has no transition covering that specific outcome, the bypass mechanism itself (Section 6.1 of B4, and Chapter 0.2's whole account of Certified Urgent skipping committee referral) would have nowhere to send the instance.

7. **`MULTI_REFERRAL_INVALID_CONFIG`.** Every `multi_referral` step's config must have both `thursday_cutoff_enabled` and `require_all_committee_signatures` set to `true` — matching the "must be `true` per Part 8.3 confirmed" note h1 carries for this field.

8. **A cross-version transition guard**, `CROSS_VERSION_TRANSITION_REFERENCE`: no transition rule may reference a `from_step_id` or `to_step_id` belonging to a step outside the definition version being validated. This is B4 Invariant #12 given a concrete implementation.

None of these checks touch a database transaction, resolve an assignee, or evaluate context against real instance data — they're pure structural sanity checks on the *shape* of a definition, run once, well before any instance ever exists against it. That's precisely what distinguishes this file from the actual execution machinery: `transition-evaluation.ts`, for instance, is a genuinely separate 48-line file whose only job is to take a real `outcome` and a real instance `context`, run them through the `json-logic-js` library, and return a winning `to_step_id` — at runtime, for one specific instance, one specific step, one specific moment. The validator asks "could this structure ever work, for any instance?" The runtime engine asks "given this instance, right now, what happens next?" Those are different questions, asked at different times, by different code — and the real seed script makes the ordering concrete: `seedPhase1WorkflowDefinitions` inserts every step and every transition rule for a definition version, and only *then* calls `validateDefinitionForPublish` — the exact function from this file — before it will mark that version `publishedAt` and `isCurrent: true`. A definition that fails validation never gets marked live, full stop, even in the seed data.

---

## E. One Status Field, Two Audiences: `Active`/`Completed`/`Cancelled` vs. the Real Internal Enum

Recall from Chapter 0.1 and 2.4 the idea of a Published API barrel — a module's `index.ts` deliberately narrowing what other modules are allowed to see, rather than exposing its full internal richness. `workflow/index.ts`'s `WorkflowInstanceSummary` interface is a genuinely good example of this pattern, and it's worth reading its comment exactly as written:

```typescript
status: 'Active' | 'Completed' | 'Cancelled'; // B2 Published API surface; maps from internal DB enum ('Running'→'Active', 'Paused'→'Active', 'Stuck'→'Active')
```

The idea is straightforward: three other-module-facing states instead of five internal ones. Any workflow module consumer outside the Workflow module itself — the documents module deciding whether to show a resolution as "in progress," a dashboard widget counting open items — gets exactly one of `Active`, `Completed`, or `Cancelled`. It doesn't get told *why* something is active. A `Running` instance that's progressing normally and a `Stuck` instance that's silently broken and awaiting Platform Administrator intervention both collapse to the same externally-visible `Active`. That's a deliberate simplification, not an oversight: most consumers genuinely only need "is this thing still in flight, or is it done" — the distinction between "actively moving" and "paused" and "wedged" is Workflow's own internal operational concern, not something a downstream module should have to build conditional logic around.

Now for the honest complication, which is worth reporting precisely rather than smoothing over, because it's a real, checkable fact about the current state of the code rather than a matter of interpretation.

D3 (§2, and its Appendix B "B4 Reconciliation" table specifically) mandates a renaming: B4's original lowercase instance-status values — `active`, `suspended`, `stuck`, `completed`, `cancelled` — were supposed to be renamed to D3's authoritative capitalized set: `Running`, `Paused`, `Stuck`, `Completed`, `Cancelled`. `engine/types.ts` carries exactly that renamed set, with an explicit comment declaring it: `// Instance and step status enums (D3-authoritative)`.

But the real PostgreSQL enum, defined in `packages/database/schema/workflow.schema.ts`, is:

```typescript
export const workflowInstanceStatusEnum = workflowSchema.enum('workflow_instance_status_enum', [
  'active',
  'suspended',
  'stuck',
  'completed',
  'cancelled',
]);
```

Lowercase. B4's *original* naming, not D3's renamed one. And this isn't a stale read of an old schema file — the real repository code that queries this table, `workflow.repository.ts`, filters and compares against these exact lowercase string literals throughout (`eq(instances.status, 'active')`, `inArray(instances.status, ['active', 'suspended', 'stuck'])`), and `create-instance.ts` writes `status: 'active'` when it creates a new instance. The one and only migration that later touches these enums, `0007_slim_starfox.sql`, adds the lowercase value `'returned'` to the *step*-status enum — following D3's requirement to add a `Returned` state, but keeping the casing convention the rest of the schema already used, not the capitalized one D3 Appendix B specified.

So: the actual database, the actual repository, and the actual instance-creation code all genuinely run on B4's original lowercase five-state enum. The five *states themselves* — the shape D3 argued for, including the addition of `Stuck` as a visible rather than hidden error condition — did make it into the real system. What didn't fully land is the specific *renaming* D3 documented as still required. `engine/types.ts`'s `WorkflowInstanceStatus` type, with its "(D3-authoritative)" comment, appears to be the one place in the real codebase reflecting the renaming as already complete, while the layer that actually persists and queries that status uses the older names underneath it. It's a small, precise, honestly-reportable seam — not a functional bug (nothing observably breaks; the five states and their transitions all behave exactly as D3 specifies), just a naming layer that the reconciliation documented in Appendix B didn't fully propagate through every file that touches it.

One more small wrinkle in the same neighborhood, worth a single sentence rather than a deep dive: `packages/shared/src/workflow/step-config.schema.ts` defines its *own*, third, independent set of status enums — `WorkflowInstanceStatusSchema` (`pending`/`active`/`completed`/`cancelled`/`suspended`) and `StepInstanceStatusSchema` (`not_started`/`in_progress`/`pending_action`/`completed`/`skipped`/`bypassed`/`cancelled`) — that match neither B4's original values nor D3's renamed ones nor the real database enum, and, checked against the rest of the source tree, are never actually imported or used anywhere outside their own file. They're exported, unused vocabulary, not a live third disagreement — worth knowing about if you ever go looking for "the" instance-status type and find three candidates, only one of which anything actually runs on.

None of this changes the Published-API story this section opened with. The barrel's simplification — five internal states collapsing to three external ones — is real, deliberate, and exactly the kind of information-hiding Chapter 2.4 asked you to notice when a module gets it right, in contrast to documents' `index.ts` over-exposure in that same chapter. The naming-casing gap described above is a separate, smaller thing: not a failure of information-hiding, just an incompletely finished renaming, sitting one layer below the barrel that everything else in this section is actually about.

---

## F. Checking H1 Against the Real Seed File

H1 §5 documents a 28-step SP Resolution sequence in exhaustive detail — every step's key, type, `is_start` flag, `legally_mandated` flag, assignee, and config notes, plus all 39 transition rules. The real file living at the path h1 itself names — `packages/database/src/seeds/workflow/phase1-legislative.ts` — is the place to check whether that documented sequence actually became code. Walking through the first several steps side by side:

| # | H1's documented step | Real seed file | Match? |
|---|---|---|---|
| 1 | `intake_logging`, `action`, `is_start: true`, `legally_mandated: true`, assignee `SECRETARIAT_STAFF` | Identical key, type, `is_start`, `legally_mandated`; config fields match exactly | Yes |
| 2 | `order_of_business_scheduling`, `action`, not legally mandated | Identical | Yes |
| 3 | `first_reading`, `action`, `legally_mandated: true` | Identical | Yes |
| 4 | `committee_referral`, `multi_referral`, `legally_mandated: true`, `thursday_cutoff_enabled: true`, `require_all_committee_signatures: true` | Identical, field for field | Yes |
| 5 | `second_reading_vote`, `approval`, `allowed_outcomes: ['APPROVED', 'RETURNED_FOR_REVISION', 'REJECTED']` | Same step, same type, same position — but `allowed_outcomes` is `['APPROVED', 'AMENDED', 'RETURNED_FOR_REVISION', 'REJECTED']` | Match on structure; one outcome code added beyond what h1 documents |

Continuing further than the task's minimum: the same pattern holds all the way through at least step 15 (`panlalawigan_review`). Step keys, `step_type` values, `is_start` flags, `legally_mandated` flags, and `position` numbers all match h1's table precisely. The transition rules match too — the real file's first six transition rules (`intake_logging`→`order_of_business_scheduling`, then on through `committee_referral`'s three outgoing rules for `REPORT_ACCEPTED`/`SECRETARY_ADVANCED`/`BYPASSED_CERTIFIED_URGENT`) match h1's documented rules #1–6 exactly, including the priority ordering and even the human-readable `label` text.

Where the real code diverges from h1, the divergences are small, specific, and — this is the useful part — each one is *explained inline, in the real code, with a comment naming exactly what was wrong and why it was fixed*, rather than silently drifting:

- **The `AMENDED` outcome code** (Section A above) appears on both `second_reading_vote` and `second_reading_amended_vote` in the real file but not in h1's outcome-code table. It has a properly covering transition rule in every case, so it's a genuine, small vocabulary addition beyond what h1 or B4 documents — not a defect.

- **Role-resolution corrections.** The real file's `ROLE` constant carries dated, numbered correction comments. `SECRETARIAT_STAFF` and `SP_SECRETARY` both resolve to `role:sp_secretary`, with a comment explaining that "`secretariat_staff`" was never a real system role code — the consolidated reference only names one SP Secretary at the head of that office. `VICE_MAYOR` resolves to `delegation_aware:sp_presiding_officer`, not the `role:vice_mayor` string an earlier draft apparently used — corrected for both the wrong role code and, separately, for having lost delegation-awareness (the mechanism from B4 §3.5 that routes to an Acting Vice Mayor when a delegation grant is active) along the way.

- **A flagged, temporary stand-in for `LEGAL_OFFICER`.** The comment is direct about this one: `'legal_officer'` doesn't exist as a real role anywhere in IAM, and the City Legal Office has no seeded employees at all yet, so the real seed file points `LEGAL_OFFICER` at `role:sp_secretary` as an explicitly-labeled "temporary operational proxy," not a real fix.

- **`COMMITTEE_CHAIR` resolved, where h1 had flagged it `[Unverified]`.** Recall h1 §4 introducing `ROLE.COMMITTEE_CHAIR` as `"instance_aware:committee_chair_of_referred_committee"` — a placeholder string h1 itself admitted "has not been checked against B4's actual assignee-resolution grammar." The real seed file resolves this with a working, real expression instead: `actor_from_context:referred_committee_chair_id` — which matches B4 §3.5's genuinely defined `actor_from_context:<context_key>` resolution format, and the real `WorkflowContextSchema` in `packages/shared` carries exactly that key, `referred_committee_chair_id`, confirming the gap h1 flagged was closed by the time the code was actually written.

So: the sequence h1 documents is, structurally, the sequence that shipped. The differences that exist are the ordinary residue of a spec being translated into working code — a role that didn't exist yet, an outcome vocabulary that needed one more value, a placeholder resolution string swapped for a real one — each one small enough, and each one visibly commented, that reading the real seed file after h1 feels less like discovering contradictions and more like watching the last few open questions get closed out in the place where they'd actually matter.

---

## G. The Four ADRs, and Where Each One Lives in the Real Schema

D3's Iteration 1 draft left seven open questions in its own Appendix C. Four ADRs closed all seven. Each one is worth connecting to something concrete you can find in `workflow.schema.ts` today.

### ADR-WFL-001 — No distinct `Repassed` instance status

**The question:** when a `termination` step fires with `outcome_code = REPASSED`, what status does the *workflow instance* end up in? B4 had left this genuinely unspecified — "remains `Running` (or a dedicated `Repassed` status — pending team decision)."

**The decision:** no sixth status value gets added. The original instance's status is left completely untouched — it stays `Running`/`active` indefinitely, with no event fired against it as a *consequence* of the repass. A brand-new instance is created for the new, repassed document, starting fresh at the normal creation status. The only place "this instance's document is actually dead now" gets recorded is on the *document*, via `documents.superseded_by`, not on the instance at all.

**Where it lives in the schema:** you won't find a `repassed` value anywhere in `workflowInstanceStatusEnum` — that's the whole point, its absence *is* the implementation. What you will find is B4's Invariant #9, given a name in the real validator's neighboring runtime code: "a `termination` step with `outcome_code = REPASSED` must not set `instances.status = completed`." The termination handler enforces this by branching around the normal completion path entirely for this one outcome code.

**The honest cost, stated plainly in the ADR itself and worth repeating here rather than glossing over:** an instance left permanently `Running` after its document has been superseded is, on its face, a misleading signal if you query it in isolation. Anyone writing "count all `Running` instances" without also joining to the document and checking `superseded_by IS NULL` will count dead legislative attempts as live ones. The ADR doesn't claim this problem is solved — it calls it an accepted tradeoff, and says explicitly that any future dashboard or SLA report touching `status = 'Running'` as a proxy for "in-progress work" needs that join from now on, as a standing requirement, not something a developer will simply remember on their own.

### ADR-WFL-002 — Panlalawigan `RETURNED` → repass, modeled as document supersession

**The question:** Chapter 0.2 section G told you a `RETURNED` outcome "might mean modifying and repassing the measure." At the document-record level, what does "repassing" actually *do*? Does the same document row loop back through its own lifecycle? Does an entirely new, disconnected document start over? Something else?

**The decision:** a third option — supersession. The SP Secretary's repass action creates a genuinely new document record (fresh `document_id`, fresh preliminary "Draft" number, `previous_document_id` pointing back at the original for traceability). The original record gets `superseded_by` set to the new document's ID, plus `closure_reason` and `superseded_at`. And — the refinement that makes this more than a bookkeeping exercise — if and when the *new* document eventually clears all the way to `Completed`, it reuses the *original* document's final series number, rather than drawing a fresh one from the year's sequence. This required a formal, explicitly-scoped amendment to a previously-stated invariant ("final numbers: never reused, even if cancelled") — the ADR is direct that this is a narrow, one-case exception, not a general relaxation.

**Where it lives in the schema:** this ADR's mechanism lives mostly on the `documents` schema, not `workflow.schema.ts` — the four new columns (`superseded_by`, `previous_document_id`, `closure_reason`, `superseded_at`) belong to the document record, not the workflow instance. What you *do* find on the workflow side is the `end_repassed` termination step itself, real in the seed data, with `outcome_code: 'REPASSED'` and — matching what H1's type comments describe as the resolved value, not a placeholder — `final_document_status: null`, because tracking what happened to the document's lifecycle now genuinely lives on `documents.superseded_by`, not on this field at all.

### ADR-WFL-003 — Splitting `Pending Approval` into two states

**The question:** D3's earliest draft had a single document-lifecycle state, `Pending Approval`, covering two legally and operationally distinct waiting periods — the Mayor's 10-day window and the Panlalawigan's 30-day window. That's a real ambiguity for anyone building a dashboard: "Pending Approval" alone doesn't tell a viewer which of two very different external parties a document is currently waiting on.

**The decision:** split into `Pending Mayor Action` and `Pending Panlalawigan Review`, sequential and non-skippable — you cannot reach `Pending Panlalawigan Review` without having passed through `Pending Mayor Action` first, because (as Chapter 0.2 section G already told you) transmission to the Panlalawigan cannot happen before the Mayor has acted.

**Where it lives in the schema:** this is a `documents.documents.lifecycle_status` change, not a `workflow.instances.status` one — it's Document Lifecycle Machine 1, the one running in a completely different column from the workflow-instance machine this chapter has mostly been discussing. It's worth naming explicitly here because it's easy to conflate the two machines' vocabularies, and this ADR is the cleanest illustration of why they're kept conceptually separate: a document can be sitting in lifecycle status `Pending Mayor Action` while its underlying workflow *instance* status is simply `active`/`Running` — the instance doesn't know or care which specific external party the document is currently waiting on; that finer distinction lives one layer up, on the document record itself.

### ADR-WFL-004 — Error states, and what "instance creation" actually is

**The question:** three coupled, purely internal engineering questions. Should B4's `stuck` instance status, absent from D3's original draft, be kept or dropped? Should B4's `failed` step status, similarly absent, be kept or dropped? And should instance creation have its own discrete `Created` status, requiring a separate `INSTANCE_STARTED` event to leave it, or does the instance simply start life already `Running`?

**The decision:** keep both `Stuck` and `Failed`, decided together as a coupled pair — a step that internally fails is precisely the kind of event that leaves its parent instance with nowhere to route to, so modeling one without the other would leave a real gap. And drop `Created` entirely — collapse instance creation directly into the running status, with no separate pre-`Running` moment.

**The reasoning, stated in the ADR's own terms, is worth repeating because it's a genuinely good piece of engineering judgment:** the alternative to keeping `Stuck` visible is an instance that's actually broken continuing to report as ordinary, healthy `Running` status — which, for a system with a real legal obligation (RA 11032/ARTA) to track and report on processing-time compliance, means an error condition that *disguises itself as healthy*, silently accumulating SLA-clock time toward a breach nobody is watching for. The ADR calls that "a worse outcome than a marginally larger enum," which is exactly the right way to weigh it.

**Where it lives in the schema and the code:** both `stuck` and `failed` are real values sitting in `workflowInstanceStatusEnum` and `workflowStepStatusEnum` respectively, right now, in production schema. And `create-instance.ts` is the direct, checkable confirmation of the `Created`-collapse decision: the function that creates a new `workflow.instances` row and activates its first `workflow.step_instances` row does both, inside the same database transaction, with no intermediate state ever committed between them — exactly the "nothing can ever query an instance and find it sitting in `Created` for any meaningful duration" reasoning the ADR gives for removing that state from the enum altogether.

---

# Chapter 2.6 — The Workflow Module, Part Two: Tracing One Real Vote

## A. The moment we're about to watch

Go back to Chapter 0.2, section C. A councilor has drafted an SP Resolution. It's cleared First Reading, gone to committee, come back with a unified report the SP Secretary has accepted. It's now Tuesday. The SP is in session, and Second Reading — "where the real work happens," as Chapter 0.2 put it — is underway. The measure is debated. No amendments are proposed. The Council votes, and the outcome is a clean `APPROVED`.

One precise thing worth getting right before any code appears: the *step* in this software's model of that moment is called `second_reading_vote`, and its real seed-data config, from `phase1-legislative.ts`, looks like this:

```typescript
{
  step_key: 'second_reading_vote',
  step_type: 'approval',
  label: 'Second Reading — Vote',
  is_start: false,
  position: 5,
  legally_mandated: true,
  config: {
    assignee: ROLE.SP_SECRETARY,
    allowed_outcomes: ['APPROVED', 'AMENDED', 'RETURNED_FOR_REVISION', 'REJECTED'],
    require_comment_on: ['REJECTED'],
  },
},
```

Notice `assignee: ROLE.SP_SECRETARY`. The step isn't assigned to "a councilor" or to "the Council" collectively — twelve people don't each get their own row in `step_instances.assigned_to`. It's assigned to the SP Secretary, exactly the way Chapter 0.2 described the Secretariat's role throughout this whole process: it doesn't decide, doesn't vote, doesn't judge — but it's the office that touches nearly every step, and here specifically it's the office that *logs* what the Council, as a body, just did. So the scene this chapter traces isn't literally "a councilor clicks approve." It's the SP Secretary, sitting at the Secretariat's desk during or right after the session, opening this document's Second Reading task and recording the vote the Council just took in the room. That's the real-world action. Now let's watch what the software actually does with it.

## B. The entry point — `workflow.approveStep`

`workflow.router.ts` is a big file — 2,750 lines, 25 named procedures. Reading through the whole thing, one procedure is the clean, generic anchor for this exact action: `approveStep`, at line 931. (There's also a more *specific* procedure, `logSecretariatDecision`, which additionally checks that the assignee's office is literally the SP Secretariat — worth knowing about, since it's arguably the closer match to "the SP Secretary logs the vote," but `approveStep` is the plainer, more general version of the same mechanism, and it's the one this chapter will trace start to finish.)

Here it is, quoted exactly as it appears in the file, comment included:

```typescript
/**
 * `workflow.approveStep`
 *
 * Approves an `approval` step and advances the workflow instance.
 * ABAC: I1 §6.3 (role gate + assignment gate + Invariant #13).
 * Emits `workflow.step.completed` to the event bus for downstream audit.
 *
 * Source: E1 §927; I1 §6.3; I2 §6 ("Complete an assigned approval step (Approve)").
 */
approveStep: protectedProcedure
  .input(
    z.object({
      stepInstanceId: z.string().uuid(),
      comment: z.string().optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    if (!ctx.auth) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
    }

    const { stepInstanceId, comment = null } = input;

    const found = await fetchStepContext(stepInstanceId, ctx);
    if (!found) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
    }

    const { stepInstance, step, instance, stepAttrs } = found;

    // ABAC: role gate + assignment gate + Invariant #13 (encoder ≠ final approver).
    workflowPolicy.canApproveStep(ctx.auth, stepAttrs);

    const workflowRepository = new WorkflowRepository(ctx.db);
    const server = ctx.req.server as any;

    const deps = {
      db: ctx.db,
      workflowRepository,
      documentsService: server.documentsService,
      eventBus: server.eventBus,
      orgService: server.organizationService,
      delegationService: server.delegationService,
      iamService: server.iamService,
    };

    await ctx.db.transaction(async (tx) => {
      await submitStepApproval(
        instance,
        stepInstance,
        ctx.auth!.userId,
        'user',
        'APPROVED',
        comment,
        { ...deps, db: tx as any, workflowRepository: new WorkflowRepository(tx as any) },
        tx as any,
      );
    });

    if (server.eventBus) {
      server.eventBus.emit('workflow.step.completed', {
        eventId: randomUUID(),
        eventType: 'workflow.step.completed',
        occurredAt: new Date().toISOString(),
        cityId: ctx.auth.cityId,
        schemaVersion: 1,
        payload: {
          instanceId: instance.id,
          stepInstanceId,
          stepId: step.id,
          stepType: step.stepType,
          outcome: 'APPROVED',
          comment,
        },
      });
    }

    return { success: true as const };
  }),
```

You already know `protectedProcedure` from Chapter 1.4 — the middleware chain that throws `UNAUTHORIZED` if `ctx.auth` is null, and narrows the type for everything downstream so the rest of this function never has to handle a missing auth context. What you're seeing here is that middleware doing genuine, concrete work: the very next line after entering the resolver is still `if (!ctx.auth)`, which looks redundant given what `protectedProcedure` already guarantees — and it is a little redundant, defensively so — but the real payoff is everywhere else in this function, every place `ctx.auth!.userId` or `ctx.auth.cityId` appears without a null check, because the type system already knows, from Chapter 1.4's middleware, that it can't be null by the time execution reaches here.

The input schema is almost nothing: a `stepInstanceId` (a UUID — the specific `step_instances` row for this document's Second Reading), and an optional `comment`. That's it. No outcome field, notice — `approveStep` doesn't take an arbitrary outcome the caller could set to anything; the outcome is hardcoded as the literal string `'APPROVED'` a few lines down. If you wanted `REJECTED` or `RETURNED_FOR_REVISION`, you'd call a different, dedicated procedure (`rejectStep`, `returnStepForRevision` — both exist, both call the same underlying `submitStepApproval` with a different hardcoded outcome). This is a real design choice worth noticing: instead of one generic `submitOutcome(outcome: string)` procedure, this module has several narrow, outcome-specific procedures, each with its own doc comment naming its own I1 section. You get less flexibility per procedure, but each individual call site reads unambiguously — there's no way to misread what `approveStep` does from its name.

The body itself is short and does four things in sequence: fetch context, check policy, run the engine inside a transaction, emit an event. Let's take those one at a time, because two of them are where the real interesting work happens.

## C. `fetchStepContext` and the policy check — where ABAC actually lives, and whether it's checked twice

Before `approveStep` can decide anything, it needs to know what it's looking at. That's `fetchStepContext`, a shared helper near the top of `workflow.router.ts` that every mutation in this file calls. It's worth reading once, because it's doing something specific: it joins `step_instances` → `steps` → `instances` → `documents` in one query, then assembles a `StepInstanceAttrs` object — the exact shape `workflowPolicy`'s guard functions expect. Here's the piece that matters most for this chapter, the part that builds the assignment fields:

```typescript
// Extract assignee from JSONB array (first element, per policy guard contract).
// assigned_to is stored as [{ user_id?: string, office_id?: string }, ...]
const assignedTo =
  (stepInstance.assignedTo as Array<{ user_id?: string; office_id?: string }>) ?? [];
const assigneeUserId = assignedTo[0]?.user_id ?? null;
const assigneeOfficeId = assignedTo[0]?.office_id ?? null;
```

`assigned_to` is stored as a JSONB array, and both fields — `user_id` and `office_id` — are optional on each entry. Hold onto that; it matters in a few paragraphs.

With `stepAttrs` in hand, `approveStep` calls `workflowPolicy.canApproveStep(ctx.auth, stepAttrs)`. This is the ABAC check the assignment brief specifically asked me to investigate for duplication, so here's `canApproveStep` in full, from `workflow.policy.ts`:

```typescript
/**
 * I1 §6.3 `step_instance:approve` / `step_instance:reject` / `step_instance:return`.
 *
 * Evaluation order — the order is non-negotiable per I1 §6.3 and
 * acceptance criterion ("Invariant #11 is verified to run strictly AFTER
 * the role/assignment gate, not before"):
 *   1. Role gate + step type/status + assignment gate.
 *   2. Invariant #13 (encoder ≠ final approver) — strictly AFTER gate 1.
 *
 * A user who fails Gate 1 is denied before Invariant #13 runs. This mirrors
 * TASK-WF-007's approval handler validation order.
 *
 * Maps to: `approveStep`, `rejectStep`, `returnStepForRevision` procedures.
 */
canApproveStep(subject: SubjectContext, attrs: StepInstanceAttrs): void {
  // ── Gate 1a: Role ──────────────────────────────────────────────────────
  if (!rolesIntersect(subject.roles, APPROVAL_STEP_ROLES)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: 'approve_step_role_denied',
      message: 'Your role is not permitted to approve, reject, or return steps.',
    });
  }

  // ── Gate 1b: Step type ─────────────────────────────────────────────────
  if (attrs.stepType !== 'approval') {
    throw new TRPCError({ /* ... */ });
  }

  // ── Gate 1c: Step status ───────────────────────────────────────────────
  if (attrs.stepStatus !== 'pending' && attrs.stepStatus !== 'active') {
    throw new TRPCError({ /* ... */ });
  }

  // ── Gate 1d: Assignment ────────────────────────────────────────────────
  const isDirectAssignee = attrs.assigneeUserId === subject.userId;
  const officeMatch =
    attrs.assigneeOfficeId !== null &&
    subject.effectiveOfficeIds.includes(attrs.assigneeOfficeId);

  if (!isDirectAssignee && !officeMatch) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: 'approve_step_not_assigned',
      message: 'You are not assigned to this approval step.',
    });
  }

  // ── Gate 2: Invariant #13 — Encoder ≠ Final Approver ──────────────────
  // Checked strictly AFTER Gate 1 passes. [Confirmed — I1 §6.3; I1 §15]
  if (attrs.isFinalApprovalStep) {
    const isSameAsInstanceCreator = subject.userId === attrs.instanceCreatedBy;
    const isSameAsDocumentAuthor = subject.userId === attrs.documentCreatedBy;
    if (isSameAsInstanceCreator || isSameAsDocumentAuthor) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'encoder_final_approver_same_user_prohibited',
        message:
          'The encoder or submitter of a document cannot act as its final approver (Invariant #13).',
      });
    }
  }
}
```

The real-world question this asks, concretely: does the SP Secretary logged in right now actually hold a role permitted to approve steps at all (Gate 1a — `sp_secretary` is in `APPROVAL_STEP_ROLES`), is this genuinely an approval-type step in an actionable state (Gates 1b/1c), and — the part that matters most for this specific answer — *is this actually the person the step is assigned to* (Gate 1d)? Gate 1d checks two things and accepts either: a direct user-ID match, **or** an office match (the caller's `effectiveOfficeIds` includes the step's `assigneeOfficeId`).

Now — the assignment brief asked a specific, pointed question here: the approval handler *also* checks assignment later, so is the same check genuinely happening twice? I read both real files, and the honest answer is: **almost, but not quite the same check.** Here's `approval.handler.ts`'s own Check 4, the handler-side assignment check:

```typescript
// 4. Verify actorId in assigned_to
if (actorType !== 'scheduler') {
  const assignedUsers = (stepInstance.assignedTo as Array<{ user_id: string }>) || [];
  const isAssigned = assignedUsers.some((a) => a.user_id === actorId);
  if (!isAssigned) {
    throw new Error('FORBIDDEN: actor is not assigned to this step');
  }
}
```

Put the two side by side. The policy layer's Gate 1d is `isDirectAssignee || officeMatch` — a user-ID match *or* an office match, either one is sufficient. The handler's Check 4 is `assignedUsers.some(a => a.user_id === actorId)` — user-ID only, no office fallback at all. These are not the same rule. If a step's `assigned_to` ever carried only an `office_id` with no `user_id` — a genuinely valid shape per the field comment in `fetchStepContext` above, where both fields are marked optional — a caller whose office matched would sail through the router's ABAC gate and then hit a `FORBIDDEN: actor is not assigned to this step` error from the handler a few lines later, for a reason the router already told them was fine.

Is this a live bug or a harmless redundancy? I went looking for a comment or a test that would settle it either way, and found neither — nothing in `approval.handler.ts` explains why Check 4 is narrower, and the handler's own test file never exercises an office-only assignment case. But tracing one level further, into `assignee-resolution.ts` — the function that's actually responsible for populating `assigned_to` whenever the engine assigns a new step — settles the practical question, if not the design-intent one. Every single branch of `resolveAssignees` returns entries shaped as `{ user_id: string, resolved_via: string }`; there is no branch that ever produces an office-only entry. The one branch that theoretically *could* — `office_role:` — doesn't resolve anything at all:

```typescript
if (assigneeExpression.startsWith('office_role:')) {
  // Gap 2: Organization Published API currently lacks getUserByOfficeRole
  throw new Error(
    `NotImplemented: The Organization module does not currently support office-role lookups for '${assigneeExpression}'.`,
  );
}
```

So: as things stand today, for any step the engine assigns through its own real assignment machinery, `office_id` never gets populated — meaning the discrepancy between the two checks is currently latent rather than live. The office half of the policy layer's Gate 1d is, functionally, dead code given how assignment actually happens right now. That could change the moment `office_role:` gets implemented, at which point this gap would start mattering for real — but as of the code I read, it's a genuine, checkable design inconsistency between two files, currently harmless in practice, worth flagging rather than either dismissing or overstating.

So to directly answer the brief's question — is this deliberate belt-and-suspenders, or accidental redundancy? Neither, precisely. It's two checks that overlap in the common case (a user directly named in `assigned_to`) but diverge in an edge case (office-only assignment) that the current assignee-resolution code never actually produces. Not a bug you'd hit today. A seam worth knowing is there.

## D. The core walkthrough — `submitStepApproval`, check by check

`canApproveStep` passes. The router wraps the next step in a database transaction and calls `submitStepApproval` — the function this whole chapter has been building toward. Here it is, in full, exactly as it appears in `approval.handler.ts`:

```typescript
export async function submitStepApproval(
  instance: InstanceRow,
  stepInstance: StepInstanceRow,
  actorId: string,
  actorType: 'user' | 'scheduler',
  outcome: string,
  comment: string | null,
  deps: ApprovalHandlerDeps,
  trx?: DbTransaction,
): Promise<void> {
  // 1. Check status
  if (stepInstance.status !== 'active') {
    throw new Error('CONFLICT: step is not active');
  }

  const versionData = await deps.workflowRepository.getDefinitionVersionWithSteps(
    instance.definitionVersionId,
    trx as any,
  );
  if (!versionData) throw new Error('NO_ACTIVE_VERSION');

  const stepDef = versionData.steps.find((s) => s.id === stepInstance.stepId);
  if (!stepDef) throw new Error('Step definition not found');

  const config = (stepDef.config as Record<string, any>) || {};

  // 2. Verify outcome in config.allowed_outcomes
  const allowedOutcomes = (config['allowed_outcomes'] as string[]) || [];
  if (!allowedOutcomes.includes(outcome)) {
    throw new Error('VALIDATION_FAILED: outcome not allowed');
  }

  // 3. Scheduler-only guard
  if (outcome === 'LAPSED' && actorType !== 'scheduler') {
    const err: any = new Error('FORBIDDEN');
    err.cause = 'LAPSED_IS_SCHEDULER_ONLY';
    throw err;
  }
  if (outcome === 'DEEMED_APPROVED' && actorType !== 'scheduler') {
    const err: any = new Error('FORBIDDEN');
    err.cause = 'DEEMED_APPROVED_IS_SCHEDULER_ONLY';
    throw err;
  }

  // 4. Verify actorId in assigned_to
  if (actorType !== 'scheduler') {
    const assignedUsers = (stepInstance.assignedTo as Array<{ user_id: string }>) || [];
    const isAssigned = assignedUsers.some((a) => a.user_id === actorId);
    if (!isAssigned) {
      throw new Error('FORBIDDEN: actor is not assigned to this step');
    }
  }

  const context = (instance.context as Record<string, any>) || {};

  // 5. Encoder != final approver
  if (config['is_final_approval'] === true && actorId === context['created_by']) {
    throw new Error('ENCODER_CANNOT_BE_FINAL_APPROVER');
  }

  // 6. Comment requirements
  const requireCommentOn = (config['require_comment_on'] as string[]) || [
    'REJECTED',
    'RETURNED_FOR_REVISION',
  ];
  if (requireCommentOn.includes(outcome)) {
    if (!comment || comment.trim() === '') {
      throw new Error('VALIDATION_FAILED: comment is required');
    }
  }

  // 7. Override vote threshold
  if (outcome === 'OVERRIDE_SUCCEEDED') {
    const voteCount = context['veto_override_vote_count'] || 0;
    if (voteCount < 8) {
      throw new Error('VALIDATION_FAILED: insufficient votes for override');
    }
  }
  if (outcome === 'OVERRIDE_FAILED') {
    const voteCount = context['veto_override_vote_count'] || 0;
    if (voteCount >= 8) {
      throw new Error('VALIDATION_FAILED: override failed but vote count is >= 8');
    }
  }

  // 8. OPERATIVE_IN_ITS_ENTIRETY guard
  if (outcome === 'OPERATIVE_IN_ITS_ENTIRETY') {
    if (context['document_type'] !== 'appropriation_ordinance') {
      throw new Error('OUTCOME_NOT_VALID_FOR_DOCUMENT_TYPE');
    }
  }

  // State change on success
  const now = new Date();

  if (outcome === 'RETURNED_FOR_REVISION') {
    await deps.workflowRepository.updateStepInstance(
      stepInstance.id,
      { status: 'returned', completedAt: now, outcome, outcomeComment: comment },
      trx as any,
    );
  } else {
    await deps.workflowRepository.updateStepInstance(
      stepInstance.id,
      { status: 'completed', completedAt: now, outcome, outcomeComment: comment },
      trx as any,
    );
  }

  await deps.workflowRepository.createWorkflowEvent(
    {
      instanceId: instance.id,
      eventType: 'workflow.step.completed',
      actorType: actorType,
      actorId: actorType === 'scheduler' ? null : actorId,
      payload: {
        instanceId: instance.id,
        stepInstanceId: stepInstance.id,
        stepId: stepDef.id,
        stepType: stepDef.stepType,
        outcome,
        comment,
      },
    },
    trx as any,
  );

  const updatedStepInstance = await deps.workflowRepository.getStepInstanceById(
    stepInstance.id,
    trx as any,
  );
  if (!updatedStepInstance) throw new Error('Failed to retrieve updated step instance');

  await resolveNextStep(instance, updatedStepInstance, outcome, deps, trx);
}
```

144 lines. Everything downstream in this chapter builds on this function, so let's take every numbered check on its own terms — what it means, and where a real test proves it's actually enforced today, not just documented.

**1. Check status.** `stepInstance.status !== 'active'` throws `CONFLICT: step is not active`. In plain terms: you can't approve a step that's already been resolved, or one that hasn't started yet. This one is directly tested, twice, in `step-lifecycle.test.ts`:

> `STEP-V-02: step with status pending rejects submission` — sets `mockStepInstance.status = 'pending'`, expects the call to reject with `'CONFLICT: step is not active'`.
> `STEP-V-03: step with status completed rejects further submission` — same assertion, with `status = 'completed'`.

For our Second Reading vote specifically: the `second_reading_vote` step instance was set to `'active'` the moment `committee_referral` completed with `REPORT_ACCEPTED` (you'll see exactly how, in Section F). Before that moment, this check would have thrown. After the SP Secretary logs the vote and it completes, this same check would throw for anyone trying to submit to it a second time.

**2. Verify outcome in `allowed_outcomes`.** The step's own config — `['APPROVED', 'AMENDED', 'RETURNED_FOR_REVISION', 'REJECTED']` for `second_reading_vote` — is the actual source of truth for what outcomes are even legal here. `approveStep` hardcodes `'APPROVED'`, and `'APPROVED'` is in that list, so this passes. `approval.handler.test.ts` proves the negative case directly:

> `it('throws VALIDATION_FAILED if outcome not in allowed_outcomes', ...)` — configures `allowed_outcomes: ['APPROVED', 'REJECTED']`, submits `'UNKNOWN_OUTCOME'`, expects `rejects.toThrow('VALIDATION_FAILED: outcome not allowed')`.

**3. Scheduler-only guard.** This is the direct implementation of something Chapter 2.5 already told you about: `LAPSED` and `DEEMED_APPROVED` are the two outcome codes where a human's silence becomes a machine's action — the Mayor doesn't submit `LAPSED`, a scheduled job does, on the Mayor's behalf, once the 10-day clock runs out. This check is what actually enforces that a human can never submit either code directly. Both directions are tested in `approval.handler.test.ts`:

> `K2 RES-I10: LAPSED submitted with actor_type = user throws FORBIDDEN` — catches the thrown error, asserts `e.cause === 'LAPSED_IS_SCHEDULER_ONLY'`.
> `K2 RES-I11: DEEMED_APPROVED submitted with actor_type = user throws FORBIDDEN` — same pattern, asserts `e.cause === 'DEEMED_APPROVED_IS_SCHEDULER_ONLY'`.

Not relevant to our specific `APPROVED` submission — `actorType` here is `'user'` and the outcome is `'APPROVED'`, so this check simply doesn't fire — but it's the exact machinery that would guard the *next* step in this same document's life, `mayor_review`, if the Mayor's 10 days ever ran out silently.

**4. Verify actorId in `assigned_to`.** Already covered in detail in Section C above — this is the check whose narrower shape (user-ID only, no office fallback) diverges slightly from the router's own policy gate. For our trace: `second_reading_vote`'s assignee expression is `role:sp_secretary`, which resolves (Section G will show exactly how) to a specific user ID written into `assigned_to`. The SP Secretary logged in as that specific user passes this check directly. Real, passing test coverage for the failure case exists in `panlalawigan.test.ts`:

> `PANLA-08: user not in assigned_to → FORBIDDEN: actor is not assigned` — submits as `'user-unauthorized'` against a step assigned to someone else, asserts `rejects.toThrow('FORBIDDEN: actor is not assigned to this step')`.

**5. Encoder ≠ final approver.** This is the direct implementation of the same Invariant #13 the policy layer already checked at Gate 2 — but notice the *condition* here is different from what the policy layer checked. The policy layer's version compares against `instanceCreatedBy` and `documentCreatedBy`; the handler's version compares `actorId` against `context['created_by']` — a value living in the *instance's own JSONB context*, not the two DB columns the policy layer read. This is worth being precise about rather than assuming the two checks are testing the identical thing under different names: they're checking the same real-world rule (the person who originated a document can't also be the one who gives it final approval) against two different, separately-maintained pieces of data. `is_final_approval` isn't set on `second_reading_vote` in the real seed data, so this check is a no-op for our specific trace — but it's directly tested elsewhere:

> `K2 INV11-01a: vp_certification with is_final_approval = true and actorId === encoder throws` — sets `mockStepInstance.assignedTo = [{ user_id: 'user-encoder' }]`, submits as `'user-encoder'`, expects `rejects.toThrow('ENCODER_CANNOT_BE_FINAL_APPROVER')`.
> `K2 INV11-01b: is_final_approval = true and actorId !== encoder succeeds normally` — same config, different actor, succeeds and confirms `updateStepInstance` was called with `status: 'completed', outcome: 'APPROVED'`.

**6. Comment requirements.** `second_reading_vote`'s config sets `require_comment_on: ['REJECTED']` — only a rejection needs an explanatory comment; a clean `APPROVED` doesn't. Our trace's comment can be `null` or empty and this check simply passes it through. Test coverage for the requirement firing, from `step-lifecycle.test.ts`'s companion `RETURNED_FOR_REVISION` case:

> `STEP-V-04: RETURNED_FOR_REVISION sets step status to returned` — configures `require_comment_on: ['RETURNED_FOR_REVISION']`, submits with the comment `'needs work'` present, confirms it succeeds and the resulting `updateStepInstance` call carries `status: 'returned'`.

**7. Override vote threshold.** This is the direct code behind Chapter 0.2's "2/3 of 12 SP members" veto-override rule — mechanically two-thirds, but the real router comment states it plainly: "2/3 of 12 SP members = 8. Hardcoded per consolidated reference Part 4.1/4.2... not a judgment call, not configurable." The number `8` appears as a literal in the handler, not read from any config field. Not relevant to `second_reading_vote` at all — this only fires on the `veto_override_vote` step, much later in this same document's life, if the Mayor ever vetoes it and the Council tries to override. But it's directly, bidirectionally tested:

> `K2 RES-I12: OVERRIDE_SUCCEEDED with veto_override_vote_count < 8 throws` — sets the count to 7, expects `rejects.toThrow('VALIDATION_FAILED: insufficient votes for override')`.
> `K2 RES-I13: OVERRIDE_FAILED with veto_override_vote_count >= 8 throws` — sets the count to 8, expects the *opposite* outcome code to fail — you can't log `OVERRIDE_FAILED` if the vote count actually cleared the threshold. Both directions of the boundary are checked, not just one.

**8. `OPERATIVE_IN_ITS_ENTIRETY` guard.** This one is the direct implementation of a detail Chapter 2.5 flagged and this chapter's brief specifically asked about: this outcome code is restricted to appropriation ordinances specifically, because it's a Panlalawigan review outcome meaning "valid, and takes effect immediately without further conditions" — a determination that only makes sense for a budget-allocation ordinance, not a plain resolution or a general ordinance. Also not relevant to our trace (this fires only on `panlalawigan_review`, and only for the one document type it applies to), but real, tested, both directions, in `panlalawigan.test.ts`:

> `APP-I02a: OPERATIVE_IN_ITS_ENTIRETY on non-appropriation_ordinance → OUTCOME_NOT_VALID_FOR_DOCUMENT_TYPE` — leaves `context.document_type` at its default (`'resolution'`), expects rejection.
> `APP-I02b: OPERATIVE_IN_ITS_ENTIRETY on appropriation_ordinance → succeeds` — sets `context.document_type = 'appropriation_ordinance'`, expects success.

Every one of the eight numbered checks passes for our actual scene — an `APPROVED` vote, logged by the correctly-assigned SP Secretary, on an active step, with an outcome the step's own config permits, no comment required, none of the special-outcome guards triggered. The function falls through to the state change.

## E. What happens after the checks pass — and a discarded return value worth noticing

`outcome` is `'APPROVED'`, not `'RETURNED_FOR_REVISION'`, so the handler takes the `else` branch:

```typescript
await deps.workflowRepository.updateStepInstance(
  stepInstance.id,
  { status: 'completed', completedAt: now, outcome, outcomeComment: comment },
  trx as any,
);
```

Then it writes an audit-trail-style event to the database:

```typescript
await deps.workflowRepository.createWorkflowEvent(
  {
    instanceId: instance.id,
    eventType: 'workflow.step.completed',
    actorType: actorType,
    actorId: actorType === 'scheduler' ? null : actorId,
    payload: { /* ... */ },
  },
  trx as any,
);
```

Then this:

```typescript
const updatedStepInstance = await deps.workflowRepository.getStepInstanceById(
  stepInstance.id,
  trx as any,
);
if (!updatedStepInstance) throw new Error('Failed to retrieve updated step instance');

await resolveNextStep(instance, updatedStepInstance, outcome, deps, trx);
```

The brief for this chapter asked me to explain, in my own words, why the handler re-fetches the step instance immediately after updating it, rather than just using values it already has in memory — with a caveat to check the actual code and any comments for the real stated reason, rather than assuming a plausible-sounding one is correct. So I checked, specifically: does `updateStepInstance` even give the handler a fresh row it could have used directly? Here's the repository method:

```typescript
async updateStepInstance(
  id: string,
  data: Partial<InferInsertModel<typeof stepInstances>>,
  tx: AppDb = this.db,
): Promise<StepInstanceRow> {
  const [row] = await tx
    .update(stepInstances)
    .set(data)
    .where(eq(stepInstances.id, id))
    .returning();
  return row!;
}
```

It uses `.returning()`. The UPDATE statement itself returns the fully updated row, and the method's return type is `Promise<StepInstanceRow>` — a real, populated row, not `void`. Which means: back in `submitStepApproval`, the `await deps.workflowRepository.updateStepInstance(...)` call already had the updated row available as its return value — and the handler simply didn't capture it. No `const updated = await updateStepInstance(...)`. The result is discarded, and a few lines later the handler pays for a second, separate database round-trip (`getStepInstanceById`) to get essentially the same data back.

There's no comment anywhere in this file explaining the choice. The reason offered in this chapter's own brief — "to guarantee `resolveNextStep` operates on the true, post-write database state rather than a possibly-stale in-memory copy" — is a completely sensible thing to want, but it doesn't actually explain *this* re-fetch, because the discarded `.returning()` result would already have satisfied that goal without a second query. Both rows, inside the same open transaction, reflect the identical post-write state; there's no staleness for the second query to fix that the first one didn't already resolve. The most honest thing to say here is: this looks like it's either a defensive habit carried over from a part of the codebase where the update path *didn't* have `.returning()` available, or simply an extra step nobody removed once it stopped being necessary. Either way, it's real, working code — `resolveNextStep` gets a correct, fresh `StepInstanceRow` either way — it's just one database round-trip more than the code strictly needs, for a reason the code itself never states.

## F. `resolveNextStep` — how the engine decides what comes after Second Reading

`resolveNextStep` lives in `step-resolution.ts`, and it's the function that answers the question the previous section's last line poses: the current step just finished — now what? Here's the part that matters most for this trace:

```typescript
export async function resolveNextStep(
  instance: InstanceRow,
  currentStepInstance: StepInstanceRow,
  outcome: string | null,
  deps: StepResolutionDeps,
  trx?: DbTransaction,
): Promise<void> {
  const versionData = await deps.workflowRepository.getDefinitionVersionWithSteps(
    instance.definitionVersionId,
    trx as any,
  );

  if (!versionData) {
    throw new Error(`Definition version ${instance.definitionVersionId} not found.`);
  }

  const { steps, transitionRules } = versionData;
  const currentStep = steps.find((s) => s.id === currentStepInstance.stepId);
  if (!currentStep) {
    throw new Error(`Step ${currentStepInstance.stepId} not found in definition version.`);
  }

  const rulesForCurrentStep = transitionRules.filter((r) => r.fromStepId === currentStep.id);
  const context = (instance.context as Record<string, any>) || {};

  const nextStepId = evaluateTransitionRules(rulesForCurrentStep, outcome, context);

  if (!nextStepId) {
    await deps.workflowRepository.updateInstanceStatus(instance.id, 'stuck', undefined, trx as any);
    await deps.workflowRepository.createWorkflowEvent(
      { instanceId: instance.id, eventType: 'workflow.instance.stuck', /* ... */ },
      trx as any,
    );
    return;
  }
  // ...
```

The first line does exactly what Chapter 2.5 promised: `getDefinitionVersionWithSteps(instance.definitionVersionId, ...)`. That argument, `instance.definitionVersionId`, is the pinned version ID — set once, at instance creation, and never touched again except through the exceptional `migrateInstance` path Chapter 2.5 described. There's no "get the currently-published version for this document type" lookup here, no "latest" anything. It's a lookup by exact, specific, immutable version ID. If the SP Resolution definition gets a new published version tomorrow — a new mandatory step added, say — this specific document's in-flight instance won't see it, because this line asks for *this instance's own* version, not whatever's currently live. That's the invariant Chapter 2.5 described in the abstract, and this is the actual line of code that enforces it in the real execution path, every single time a step resolves.

`evaluateTransitionRules` — a separate, tiny, 48-line file — is what actually picks the next step. Here it is in full:

```typescript
export function evaluateTransitionRules(
  rules: TransitionRuleRow[],
  outcome: string | null,
  context: Record<string, any>,
): string | null {
  // 1. Filter: remove rules where outcome_filter is set but doesn't match
  const candidateRules = rules.filter((rule) => {
    if (rule.outcomeFilter !== null && rule.outcomeFilter !== outcome) {
      return false;
    }
    return true;
  });

  // 2. Sort remaining by priority ASC (lower value = higher priority)
  candidateRules.sort((a, b) => a.priority - b.priority);

  // 3. Evaluate condition expressions
  for (const rule of candidateRules) {
    if (rule.conditionExpression === null) {
      return rule.toStepId; // unconditional rule
    }

    try {
      const isMatch = jsonLogic.apply(rule.conditionExpression, context);
      if (isMatch) {
        return rule.toStepId;
      }
    } catch (err) {
      console.warn(`JSONLogic evaluation failed for rule ${rule.id}:`, err);
    }
  }

  // 4. No match found
  return null;
}
```

For our trace: `outcome` is `'APPROVED'`. Filter down to the transition rules whose `fromStepId` is `second_reading_vote`'s step ID and whose `outcomeFilter` is either `null` or exactly `'APPROVED'`. Sort by priority. The first one with no condition expression (or a truthy JSONLogic condition against `instance.context`) wins, and its `toStepId` — pointing at `final_number_assignment` in the real seed data — comes back out. This is a pure, synchronous function; it never touches the database itself. It reads whatever rules and context it's handed and returns a decision.

Back in `resolveNextStep`, a `nextStepId` came back, so the "stuck" branch above doesn't fire — that's reserved for the case where *nothing* matches, which Chapter 2.5's ADR-WFL-004 discussion already told you is a deliberate, visible failure state rather than a silent one. The function looks up the actual next-step row, and — since `final_number_assignment` isn't `parallel_split`/`parallel_join` (the second of the two Phase-1 guards Chapter 2.5 promised, right here at runtime, mirroring `definition-validator.ts`'s publish-time version) — creates the new step instance:

```typescript
const newStepInstance = await deps.workflowRepository.createStepInstance(
  { instanceId: instance.id, stepId: nextStep.id, status: 'active', startedAt: new Date() },
  trx as any,
);
```

`final_number_assignment` is now `active`, waiting for the SP Secretary to open it next and drop the "Draft" prefix from this resolution's preliminary number — the exact "final number assigned after Second Reading, before signatures" sequencing Chapter 0.2 described.

## G. `assignee-resolution.ts` — who gets the new step

Immediately after creating the new step instance, `resolveNextStep` does this:

```typescript
const config = (nextStep.config as Record<string, any>) || {};
let assignees = [];
if (config['assignee']) {
  assignees = await resolveAssignees(config['assignee'], context, deps);
  await deps.workflowRepository.updateStepInstance(
    newStepInstance.id,
    { assignedTo: assignees },
    trx as any,
  );
}
```

`final_number_assignment`'s own config carries `assignee: ROLE.SP_SECRETARY` — the exact same expression `second_reading_vote` used, since it's still Secretariat bookkeeping. `resolveAssignees` is the function from `assignee-resolution.ts` that turns that expression string into an actual, concrete list of user IDs. Its `role:` branch is what fires here:

```typescript
if (assigneeExpression.startsWith('role:')) {
  const roleCode = assigneeExpression.replace('role:', '');
  const matchedUsers = await deps.iamService.getUsersByRole(roleCode);
  return matchedUsers.map((u) => ({
    user_id: u.userId,
    resolved_via: assigneeExpression,
  }));
}
```

Strip the `role:` prefix, call IAM's Published API for every user currently holding `sp_secretary`, and return each one as `{ user_id, resolved_via: 'role:sp_secretary' }`. That's the concrete answer to who's assigned: whichever real employee currently holds the SP Secretary role in IAM, right now, at the moment the step activates — not a name baked into the workflow definition, but a live lookup against the organization's actual current staffing.

This is also where Chapter 2.3's material becomes directly relevant, in a way this specific step doesn't exercise but a neighboring one does. `second_reading_vote` and `final_number_assignment` both use the plain `role:` form — no delegation-awareness. But look a few steps further down this same document's path, at `vp_certification`'s assignee expression: `delegation_aware:sp_presiding_officer`. That's the branch of `resolveAssignees` that calls `deps.delegationService.getActiveDelegationForUser` for each base role-holder and substitutes the delegate if an active delegation grant exists — the exact "delegated-to wins" mechanism Chapter 2.3 walked through in `organization.service.ts`'s `resolveCurrentHolder`. Committee-referred steps go further still: `resolveValidInPart`, elsewhere in `workflow.router.ts`, calls `orgService.getCommitteeChair(primaryCommitteeId)` directly to resolve a committee chair by committee ID — the same Organization module method, doing the same real lookup against `organization.committees` and `organization.committee_memberships`, that Chapter 2.3 introduced. Different steps in the same document's life reach into Organization through different mechanisms — a plain role lookup, a delegation-aware role lookup, a direct committee-chair lookup — depending on what the step actually needs to know.

## H. What the sequence diagram says, versus what actually happens

`d2-sequence-diagrams.md`'s "1. SP Resolution — Standard Path" is the diagram that most closely matches this trace, and it includes the exact moment:

```
%% ── SECOND READING VOTE (no amendments) ─────────────────────────────────
Note over SPSec,ViceMayor: Tuesday SP Session — Second Reading
SPSec->>Web: Records vote outcome: APPROVED (no amendments)
Web->>Server: tRPC submitStepAction(second_reading_vote, APPROVED)
Server->>WF: engine.submitStepAction(...)
WF->>DB: UPDATE step_instances[second_reading_vote] status=completed, outcome=APPROVED
WF->>DB: INSERT step_instances[final_number_assignment] status=active
WF->>EventBus: emit workflow.step_assigned (SecStaff)
```

The high-level shape matches exactly, step for step: SP Secretary acts through the web client, the server calls into the engine, the current step gets marked completed with the right outcome, and a new step instance gets inserted for `final_number_assignment`. That's a genuine, verified match — the diagram's account of the *sequence of database effects* is accurate against the real code.

Two smaller things don't quite line up, and they're worth being precise about rather than folding into "broadly consistent."

First, the diagram's own label — `tRPC submitStepAction(second_reading_vote, APPROVED)` — names the wrong procedure. The real procedure for an approval-type step's approve outcome is `approveStep`, calling `submitStepApproval`; `submitStepAction` (no "approval" in the name) is the real, separate function this same file uses for plain `action`-type steps like `intake_logging` or `docketing`, which have no branching outcome at all. The diagram appears to be using `submitStepAction` as a generic stand-in label for "submit whatever this step needs," where the real code draws a sharper line between the two step types and gives each its own procedure and its own engine function.

Second, and more substantively: the diagram shows `WF->>EventBus: emit workflow.step_assigned (SecStaff)` — an event bus emission, right at the point a new step activates, specifically meant to notify the newly-assigned party. I checked whether the real code emits anything by this name anywhere in the module, and it doesn't. `step-resolution.ts` — the actual function that creates the new step instance and resolves its assignee — writes `workflow.step.started` (dot-separated, "started," not "assigned") to the database via `createWorkflowEvent`, and never calls `eventBus.emit` at all; the only outward-facing `eventBus.emit` call in this whole trace happens back in the router, after the transaction commits, and it's `workflow.step.completed` — about the step that just *finished*, not the one that just started. Checking the shared event-type registry turns up something that explains the gap precisely: `'workflow.step_assigned': Stub` is a real, declared entry in `event-payload-map.ts` — reserved, typed as a placeholder, sitting right next to both `'workflow.step_assigned'` and, separately, both an underscore-separated `'workflow.step_completed'` and a dot-separated `'workflow.step.completed'` as two distinct type entries. The diagram is describing a notification event that was planned for and reserved a type slot, but never actually got wired up on the emitting side.

## I. `engine/index.ts` — a file this chapter was supposed to check, and doesn't exist

The last thing this chapter's research asked me to confirm: does `workflow.router.ts` genuinely bypass `engine/index.ts`'s stub functions in favor of the real handler files this whole chapter just walked through? I need to report something more specific than a yes or no, because the premise itself needs correcting first.

**`engine/index.ts` does not exist anywhere in this repository's source tree.** I searched exhaustively — every case variant, every plausible path — and found nothing. What I did find, though, tells a cleaner and more complete story than "the file exists but is bypassed."

A compiled build artifact survives at `apps/server/dist/apps/server/src/modules/workflow/engine/index.js`, and its content is exactly what you'd expect from the file's description: seven exported functions — `createInstance`, `submitStepAction`, `bypassStep`, `cancelInstance`, `migrateInstance`, `evaluateTimers`, `evaluateSlaBreaches` — every one of them a one-line body that throws `NotImplementedError`. This file genuinely existed. It was the very first thing scaffolded for this module: `wf.md`'s own opening task, "Scaffold WF module file structure with typed stubs," lists it explicitly as a deliverable, seven typed stubs, each throwing `NotImplementedError` "at this stage" — a placeholder, deliberately, meant to be filled in later.

It was never filled in. Instead, real, working implementations of the same seven responsibilities landed in sibling files across the rest of `engine/` — every one of which this chapter has now walked through directly: `createInstance` in `create-instance.ts`, `submitStepAction` in `action.handler.ts`, `bypassStep`/`cancelInstance`/`migrateInstance` in `admin-operations.ts`. `submitStepApproval` — this entire chapter's centerpiece — was never even one of the original seven stub names; it's a function that only exists in the real, working code, in `approval.handler.ts`.

A cleanup task, `TASK-WF-BE-011` in `fix.md`, was written specifically to delete this now-vestigial file, with the exact language: "a full grep across the entire repository (both by import path and by each function name individually) confirms zero production files and zero test files import anything from this file, by any path." I confirmed that finding independently, myself, before reading this task — `grep -rn "engine/index"` across the whole repository returns nothing. The task even includes an honest, function-by-function mapping of what superseded each stub, including a careful note that `evaluateTimers` wasn't a clean one-to-one rename at all — it was split into three separate, more specific scheduled jobs (`evaluateMayorLapseTimers`, `evaluatePanlalawiganTimers`, `evaluateThursdayCutoffs`), each in its own file under `workflow/jobs/`, and the task explicitly instructs whoever executes it not to describe that as a simple rename in the PR description.

By the time this archive was packaged, that deletion task appears to have already run: the source file is gone, and only the compiled artifact — dated to a build that also compiled the real, working `admin-operations.ts` and `step-resolution.ts` in the same pass — remains as physical evidence it once existed.

So, restated precisely: this chapter's entire trace — `approveStep` → `canApproveStep` → `submitStepApproval` → `resolveNextStep` → `evaluateTransitionRules` → `resolveAssignees` — never touches, imports, or depends on anything from `engine/index.ts`, because there is nothing left to touch. If you're the next person working in this codebase and you go looking for "the workflow engine's main entry point" — a completely natural thing to look for, given the filename — you won't find a stub throwing `NotImplementedError` and wrongly conclude the engine isn't built. You won't find the file at all. What you'll find, if you follow the actual import lines the way this chapter did, is exactly what this chapter just spent nine sections proving: a fully working, thoroughly tested engine, spread across the sibling files whose names don't advertise themselves nearly as confidently as `index.ts` once did — and now doesn't.

---

# Chapter 2.7 — Tracking: The Small Module With the Legal Deadline

## A. What RA 11032 Actually Requires

Before opening a single file, it's worth knowing what "ARTA" means, because the consolidated reference leans on the term constantly without re-explaining it each time.

RA 11032 — the Ease of Doing Business and Efficient Government Service Delivery Act of 2018 — amended an earlier, narrower law (RA 9485, the original 2007 Anti-Red Tape Act) into something with real teeth. Its core mechanism, sometimes called the "3-7-20 rule," sets maximum processing times for government transactions: three working days for simple transactions, seven for complex ones, twenty for highly technical ones. Miss the deadline without a valid, documented reason, and a citizen can in principle invoke automatic approval and file a complaint with the Anti-Red Tape Authority, the body the law created to enforce it. The consolidated reference states these exact thresholds at §11.3 — "ARTA defaults: simple ≤ 3 working days; complex ≤ 7 working days; highly technical ≤ 20 working days" — and its compliance table at §11.19 is blunt about the stakes: "SLA tracking mandatory from Phase 1; configurable thresholds; legal requirement." This isn't a nice-to-have reporting feature. It's a statute with penalties attached to individual government employees.

Why would a legislative-document system need to care? Look back to Chapter 2.4's Document Request Form — a citizen-facing process with an actual turnaround-time obligation, unlike, say, the multi-week SP Ordinance readings-and-signatures pipeline, which is governed by RA 7160 procedural steps rather than an ARTA clock. Anywhere a citizen submits something and waits on the LGU to act, RA 11032's deadline applies, and the system has to know when that deadline is approaching (the 80% warning threshold) or has already passed (breach, triggering "notify supervisor + Records Officer" per §11.3). §11.15 adds a detail worth sitting with: "ARTA compliance obligations do not pause during system outages. SLA clock continues regardless of connectivity." A generator running out of fuel at City Hall doesn't buy the LGU more legal time — which is exactly the kind of requirement that turns into a real, always-on background job rather than a UI nicety.

## B. What tracking.schema.ts Actually Stores

TRACK's job is narrower than the name might suggest at first glance, and the real schema — `packages/database/schema/tracking.schema.ts` — makes the boundary precise. Three tables, all in the `tracking` PostgreSQL schema:

**`qr_codes`** holds two distinct identifiers that are easy to conflate but never should be: `trackingId`, a UUID encoded directly into the physical QR image (opaque, scanned, never shown to a human), and `trackingNumber`, a human-readable label like `DTS-2026-0001` shown on cover sheets. Both are assigned once, together, at secretariat logging — before the document's own preliminary number — and neither is ever regenerated. The schema file's own comment states the assignment sequence explicitly: "Councilor Draft → Secretariat Logs → QR assigned → Preliminary Draft number assigned," which matches §11.6 of the consolidated reference word for word.

**`tracking_records`** is the "where is this thing right now" table the prompt anticipated — one row per document, tracking `currentCustodianOfficeId` and `physicalLocation`. The schema comment is explicit about why this is a separate concern from Documents' own `lifecycle_state`: "current_status is intentionally free TEXT — not CHECK-constrained against documents.lifecycle_state. Physical custody is a separate state machine." A document can be `In-Workflow` digitally while its physical folder is sitting on someone's desk between offices — TRACK is the table that knows about the desk.

**`routing_entries`** is the append-only movement log — every hand-off recorded as `fromOfficeId`, `toOfficeId`, `actorId`, `actionDescription`, `occurredAt`. "Append-only" here isn't just a naming convention; it's enforced twice — once by simply never generating an `updateRoutingEntry` method in the repository, and again at the database grant level, where `UPDATE, DELETE` are explicitly revoked from `batac_app` on this one table. The migration file even has a comment pointing to a specific findings-log entry (LOG-0026) explaining why the revoke has to be repeated in both the migration *and* the generic post-migrate grants script — otherwise that script's per-schema loop would silently hand UPDATE back on the next `db:migrate` run.

Two things TRACK notably does *not* store: it has no `updated_at` column or trigger on any table (an explicit C1 §1.4 decision — `qr_codes` and `tracking_records` omit it by design, `routing_entries` is append-only by nature), and, as section D below will make precise, it has no SLA data whatsoever.

## C. The Pattern, One More Time — Faster This Time

By now the router → service → repository shape should need no re-introduction, so here's the tracking version end to end, using `tracking.getTrackingRecord` as the example.

The router layer (`tracking.router.ts`) does ABAC first, business logic second — but with a wrinkle worth flagging: the comment at the top of the file explains that ABAC here is enforced *inline* rather than through the shared `PolicyEvaluator.evaluate()` call you saw in earlier chapters, "because the tracking_record resource type has no registered handler in PolicyEvaluator — only session and delegation_grant are registered." So the procedure resolves the underlying document's office and classification directly, then calls a local helper, `canReadTrackingRecord()`, that implements the two-branch rule from I1 §7.1 by hand: own-office read is unconditional for a defined role set, cross-office read is allowed only for a smaller role set *and* only when the document's classification is `public` or `internal`.

```typescript
if (!canReadTrackingRecord(ctx, officeId, classificationLevel)) {
  throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not authorised to view this tracking record.' });
}
const record = await trackingService.getTrackingRecordForDocument(input.documentId);
```

Past the ABAC gate, the router calls straight into the service layer — `tracking.service.ts` — which is about as thin as this pattern gets anywhere in the codebase:

```typescript
export function createTrackingService(repository: TrackingRepository): TrackingPublicAPI {
  return {
    async getTrackingRecordForDocument(documentId: string) {
      return repository.findTrackingRecordByDocumentId(documentId);
    },
    // ...
  };
}
```

No IAM calls, no business rules — just delegation, exactly as the task list specified: "The service layer performs NO authorization... callers are responsible for ABAC before calling." Then the repository (`tracking.repository.ts`) does the actual query, an inner join between `tracking_records` and `qr_codes` filtered on `documentId`, returning `null` on a miss rather than throwing. What's specific to tracking's own domain here, versus the generic pattern you've now seen three times: the repository's `getRoutingHistory` method does something the earlier examples didn't need — a double `leftJoin` against `organization.offices` (aliased twice, once as `from_office` and once as `to_office`) to resolve human-readable office names alongside the raw UUIDs, because a routing history that just showed office IDs wouldn't be very useful to a records officer reading it.

## D. The Wrinkle: Where ARTA SLA Logic Actually Lives

Here's the part of this chapter that's worth slowing down for, because it's a genuinely good example of checking a design boundary against reality rather than assuming it.

`sla.service.ts` and `evaluate-sla-breaches.ts` both live inside `apps/server/src/modules/workflow/` — the WORKFLOW module's own folder — not inside `tracking/`. Given that ARTA SLA tracking is the exact thing this chapter opened by explaining, and given that "Tracking" is the module whose name most obviously matches "SLA tracking," it's a fair question to ask: is this an accident?

`sla.service.ts` itself is small — 79 lines, three methods, no database access at all. It's pure calendar arithmetic: `computeSlaDeadline()` walks forward from a start date N business days, skipping weekends and a (currently stubbed, empty) holiday list, and `elapsedWorkingDays()` counts business days backward from now. It has no opinion about documents, tracking records, or routing — it just knows how to count working days, which is exactly the primitive RA 11032's 3-7-20 rule needs.

`evaluate-sla-breaches.ts` is the job that actually uses that primitive at scale, running two passes — once over active workflow *steps*, once over active workflow *instances* — checking each against three thresholds: 80% elapsed (warning), past deadline (breach), 150% elapsed (critical). For each threshold it hasn't already fired, it opens a transaction, row-locks the record (`lockStepInstanceForUpdate` / `lockInstanceForUpdate`), writes a `workflow_events` row, updates the `slaWarningSentAt` / `slaBreachedAt` / `slaCriticalSentAt` columns, and — only after the transaction commits — emits a domain event through the shared event bus (`workflow.sla.breached`, `workflow.instance.sla.critical`, and so on). The test file confirms this precisely: `mockWorkflowRepository.createWorkflowEvent` is asserted first, `mockEventBus.emit` second, so a breach genuinely produces **both** a durable DB record and an event-bus notification, not one or the other.

So — deliberate, or drift? I checked both TRACK's own code and TRACK's own task list for any SLA reference at all, and found none. `tracking.repository.ts`, `tracking.service.ts`, the schema — nothing. Then I checked where the SLA-bearing columns actually live: `slaDeadline`, `slaBreachedAt`, `slaWarningSentAt`, and `slaCriticalSentAt` are all defined directly on `workflow.instances` and `workflow.step_instances`, with a dedicated partial index (`idx_instances_sla_active`, filtered to active/suspended/stuck instances) purpose-built for this job's polling query. That's not the shape of an accident — someone indexed for this specific access pattern.

The decisive evidence, though, is in B2 itself — the module boundary document TRACK's own task-generation header cites as a load-bearing source. Module 4 (Workflow)'s responsibility line states plainly that workflow "Manages Mayor 10-day lapse, Panlalawigan 30-day review, and ARTA SLA timers." B2 goes further and defines a Published API method, `getWorkflowSLAData()`, returning records typed with `slaClassification: 'simple' | 'complex' | 'highly_technical' // per RA 11032 ARTA` — for a documented future consumer, the Reporting module's ARTA compliance reporter (Phase 2, not yet built, and marked `[Inference — method signature proposed]` in the doc itself). There's even a dedicated `workflow.escalated` domain event named specifically for ARTA breach notification.

So the honest answer is: this is architecture as designed, not architecture as drifted. "Tracking" tracks physical custody and QR identity — that's its literal Phase 1 scope per its own nine-task list. "SLA tracking" happens to share a word with the module's name, but the actual legal-deadline clock is workflow-step timing, which is why it was built as workflow's concern from the start. The one place reality *does* diverge slightly from the docs: both tech-stack.md and B2 describe workflow's SLA timers as running "via pgboss" (the durable scheduler), but the real `evaluate-sla-breaches.ts` runs on `node-cron` instead — the simpler of tech-stack.md's two stated scheduling options, not the one the architecture docs specifically named for this job. Small, and not consequential the way Chapter 2.4's finding was — but worth knowing the actual mechanism rather than the documented one, which is exactly what the next section covers.

## E. How the Job Actually Runs

`registerSlaMonitorJob()` is short enough to show in full:

```typescript
export function registerSlaMonitorJob(deps: EvaluateSlaBreachesDeps) {
  cron.schedule('*/15 * * * *', async () => {
    try {
      await evaluateSlaBreaches(deps);
    } catch (err) {
      console.error('[SLA Monitor] Failed to evaluate SLA breaches:', err);
    }
  }, { timezone: 'Asia/Manila' });
}
```

Every 15 minutes, Asia/Manila time, `node-cron` — the "simple" half of tech-stack.md's stated `node-cron (simple) + pgboss (durable)` scheduling split, confirmed by the literal `import cron from 'node-cron'` at the top of the file. If the job throws, it's caught and logged; it doesn't crash the process, and it doesn't retry mid-cycle — it just waits for the next 15-minute tick, which is a meaningfully different failure mode than a pgboss job would have (pgboss gives you durable retry and dead-lettering; a caught-and-logged cron tick means a single missed run is silently absorbed until the next one).

On a genuine breach, the answer to "does it write to the DB or emit an event" is both, in a specific order: the DB write happens first, inside the locked transaction, and only commits-and-then-emits — so a crash between the two would leave the DB correctly marked as breached with no corresponding event fired, rather than the reverse. That ordering is a small but real reliability choice: it favors the durable record of the breach over the notification about it, which fits a legal-compliance job better than the other way around.

## F. index.ts — The Fourth Data Point

TRACK's barrel file is small and clean. It exports the plugin default, three service classes (`TrackingRepository`, `QrCodeService`, `createTrackingService`), and the two Published API types the task list specified: `TrackingPublicAPI` (with exactly the two methods B2 defines — `getTrackingRecordForDocument`, `getRoutingHistory`), `TrackingRecordSummary`, and `RoutingEntry`. Compared against what TASK-TRACK-002 originally specified for these two types, the real interfaces picked up small, sensible additions along the way: `TrackingRecordSummary` gained an `id` field (the underlying `tracking_records.id`, needed once the event consumer had to resolve it for `appendRoutingEntry` — exactly the adjustment TASK-TRACK-005's own prompt text anticipated might be necessary), and `RoutingEntry` gained `fromOfficeName` / `toOfficeName` alongside the office IDs, matching the office-name resolution you saw in section C's repository join. Following the same barrel-only-exports discipline you've now checked in Documents and Workflow, nothing here reaches past the barrel — every cross-module caller (Documents' cover sheet generator, the router's own procedures) goes through `index.ts`'s exported surface, not into `tracking.repository.ts` directly. Four modules in, and the pattern is holding.

One small, low-stakes footnote in the same spirit as this investigation: two `[Inference]` comments inside the tracking module cite specific findings-log entries by number — LOG-0038 in `tracking.qr-service.ts` for the series-number fallback logic, LOG-0037 in `tracking.router.ts` for why `remarks` returns `null` in Phase 1. Checking those numbers against the actual log shows both are mis-citations to real but unrelated entries (LOG-0038 is an organization-module bug, LOG-0037 a Designation-logging trigger issue); the entries that actually document these two tracking decisions are LOG-0042 and LOG-0044. The reasoning in the code is sound either way — it's just a reminder that a comment pointing at a source is a claim like any other, worth a quick check rather than automatic trust.

---

# Chapter 2.8 — The Frontend, Assembled: Routing, Bootstrap, and One Real Page, End to End

Every chapter in Arc 1 taught you one piece of the frontend stack in isolation. Chapter 1.4 showed you tRPC's type-only import and `trpc.iam.listAllActiveSessions.useQuery(...)`. Chapter 1.5 showed you TanStack Query's cache, `getOfficeHierarchy`'s auto-generated key, and `utils.organization.getOfficeHierarchy.invalidate()`. Chapter 1.6 showed you `useSessionStore`, `useShellStore`, and the `.getState()` pattern that lets plain JavaScript reach into a Zustand store from outside React entirely. Every backend module chapter since then — Documents in 2.4, Workflow in 2.5 and 2.6 — explained what data exists and how it's shaped once it reaches the API boundary.

None of those chapters showed you a URL. None of them showed you what actually renders when a person opens a browser tab and goes to `/workflow/steps`. That's this chapter's whole job: take everything Arc 1 taught you about the pieces, and everything the backend chapters taught you about the data, and show you the one thing that was still missing — how a real page in `apps/web` assembles all of it into something a person can click on.

This chapter checks three real documents against the real filesystem — `f1-application-route-map-v2.md`, its ten ADRs, and `f4-component-hierarchy-specification.md` — the same way earlier chapters checked B4 against `workflow.schema.ts` or H2 against `documents.schema.ts`. Section B is where that checking gets literal: not "does the frontend generally match the docs," but file by file, directory by directory, using the project's own README as the starting claim and the actual `apps/web/src/pages/` tree as the thing that either confirms or corrects it.

## A. The Route Map: From a URL to a Component

### The documented shape

`f1-application-route-map-v2.md` — the pre-development document that proposed this app's URL structure before any of it was code — organizes every Phase 1 route into one master table: path, hosting app, component name, required role(s), and primary data dependency. It's a draft, and it says so on its own first page — every route path and component name in it is the document's own proposed synthesis, not confirmed architecture, until an ADR resolves a specific open question. Ten such questions got resolved, tracked in `f1-application-route-map-adrs/`, and two of them matter enough to this chapter to walk through directly.

**ADR-UI-001 decided which app hosts the public portal.** The original monorepo plan put `/apps/portal` (Next.js) at Phase 3, with SSG chosen specifically for SEO on citizen-facing document lookups. But the requirements kept describing Phase 1 citizen behavior — tracking-number lookup, document preview, the Document Request Form — with no app assigned to serve it. ADR-UI-001 resolved the tension by pulling `/apps/portal` forward to Phase 1 rather than serving those routes as unauthenticated paths inside `/apps/web`, reasoning that a separate app gives a cleaner auth boundary between public-facing code and the internal SPA, and that paying Next.js's setup cost once now beats paying it twice. This chapter is about `/apps/web` specifically — the internal, tRPC-backed, always-authenticated SPA — and everything from here on stays inside that boundary. `/apps/portal` is REST-consumed and, per the project's `README.md`, still a routing-and-fonts scaffold rather than a working app; it's out of this chapter's scope on both counts.

**ADR-UI-010 decided what the workflow-step detail URL keys on**, and this one is worth sitting with, because you're about to watch its reasoning play out in real code in Section D. `f1` originally proposed `/workflow/steps/:instanceId` while flagging that the alternative, `:stepInstanceId`, was equally plausible and left open. The ADR settled it by checking a real procedure signature rather than guessing: `workflow.getInstance` — the procedure that loads the detail page — takes `{ instanceId: z.string().uuid() }` as its input, and returns `currentStepInstanceId` as a *field within* that response, not as the top-level lookup key. Meanwhile, `workflow.listMyAssignedSteps` — the task-inbox listing that links *into* the detail page — returns rows carrying both `stepInstanceId` and `instanceId` as sibling fields. Both identifiers exist and are genuinely different things (one names a step-execution row, the other names the parent document's workflow instance), but only one of them is what the detail page's own data-loading call actually expects. Routing on `instanceId` means the page loads with one read call, and every subsequent write action can take `currentStepInstanceId` straight from that same response — no second lookup required. The ADR's own stated consequence: "where a task-inbox listing links into this detail route, the link should use the row's `instanceId` field, not its `stepInstanceId` field, even though both are present on each list-row object." Hold onto that sentence — Section D shows you the exact line of real code that does precisely this, with a comment naming the ADR directly.

### The master table, condensed to what this chapter needs

You don't need every row of `f1`'s table memorized, but a few entries matter for what follows:

| Path | Component | Required role(s) | Primary data dependency |
|---|---|---|---|
| `/secretary` | `SecretaryDashboardPage` | SP Secretary only | `workflow.listMyAssignedSteps`, `documents.list` (filtered), `session.getOrderOfBusiness`, `workflow.getSlaComplianceData` |
| `/workflow/steps` | `MyAssignedStepsPage` | 10 operational roles (see Section D) | `workflow.listMyAssignedSteps` |
| `/workflow/steps/:instanceId` | `WorkflowStepActionPage` | Varies by rendered panel | `workflow.getInstance`, plus a panel-specific write mutation |
| `/organization` | `OrganizationPage` | View: most internal roles; Manage: Platform Administrator | `organization.getOfficeHierarchy` (read); create/update/deactivate/assign procedures (manage) |
| `/admin/committees` | `CommitteeManagementPage` | Platform Administrator | `organization.listCommittees`, `createCommittee`, `updateCommittee`, `assignCommitteeMembership` |
| `/admin/roles` | `RoleAssignmentPage` | Platform Administrator | `iam.listUserDirectory`, `assignRole`, `revokeRole`, `editUserAccount` |
| `/sysadmin/sessions` | `ActiveSessionsPage` | System Administrator only | `iam.listAllActiveSessions`, `forceTerminateSession` |

`f4-component-hierarchy-specification.md` — the follow-on document that turns `f1`'s flat table into an actual parent/child tree — draws the nesting explicitly:

```
├── MyAssignedStepsPage                                     [/workflow/steps]
│   └── WorkflowStepActionPage                              [/workflow/steps/:instanceId]
│       ├── GenericActionPanel
│       ├── GenericApprovalPanel
│       ├── SecretariatDecisionPanel
│       ├── VpCertificationPanel
│       ├── MayorDecisionPanel
│       ├── MayorLapseConfirmationPanel
│       ├── VetoOverrideRecordingPanel
│       ├── MultiReferralPanel
│       ├── DocketingPanel
│       ├── PanlalawiganOutcomePanel
│       └── PublicationDatePanel
```

The distinction `f4` draws matters: solid nesting means the parent route renders the child via an `<Outlet />` and the child has its own URL. The eleven panels underneath `WorkflowStepActionPage` are different — they're sub-components rendered conditionally inside one route, not a route each. `f1` states the reasoning for that choice directly: the page renders exactly one of eleven panels, selected by `currentStepType` and `step.stepKey` from the loaded instance, "not a route per step type." You'll see in Section D that the real code implements this choice with a slightly different mechanism than the one documented — same outcome, one layer moved.

### Checking the route map against the real router

`f1` and `f4` are proposals. The thing that actually decides what renders at a given URL is `/apps/web/src/main.tsx` — and in this codebase, that one file does double duty as both the router configuration *and* the app's bootstrap entry point, which is why Sections A and C end up pointing at the same file. Here's the router registration, trimmed to the routes this chapter is tracing:

```typescript
const router = createBrowserRouter([
  {
    element: <RouteTracker />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      {
        path: '/',
        element: (
          <RequireAuth>
            <AuthenticatedLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <HomePage /> },
          { path: 'organization', element: <OrganizationPage /> },
          { path: 'admin', element: <PlatformAdminHomePage /> },
          { path: 'admin/committees', element: <CommitteeManagementPage /> },
          { path: 'admin/roles', element: <RoleAssignmentPage /> },
          { path: 'sysadmin', element: <SystemAdminHomePage /> },
          { path: 'sysadmin/sessions', element: <ActiveSessionsPage /> },
          { path: 'sysadmin/users', element: <UserAccountManagementPage /> },
          { path: 'workflow/steps', element: <MyAssignedStepsPage /> },
          { path: 'workflow/steps/:instanceId', element: <WorkflowStepActionPage /> },
          { path: 'mayor', element: <MayorDashboardPage /> },
          { path: 'secretary', element: <SecretaryDashboardPage /> },
          { path: 'sessions', element: <SessionAttendanceOverviewPage /> },
          { path: 'sessions/:sessionDate', element: <SessionAttendanceDetailPage /> },
          { path: 'order-of-business', element: <OrderOfBusinessPage /> },
          // ...documents, complaints, document-requests follow the same shape
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      // ...
    ],
  },
]);
```

This confirms ADR-UI-010 at the level that actually matters — not the pre-development document's proposal, but the literal string in the router array: `path: 'workflow/steps/:instanceId'`. And it confirms the `f4` tree's nesting claim precisely: `workflow/steps` and `workflow/steps/:instanceId` are two separate entries in the *same* `children` array, both nested one level under the `RequireAuth`-gated root — which is `react-router-dom`'s way of expressing exactly the "true route nesting" `f4` described, without a literal `<Outlet />` written inside `MyAssignedStepsPage.tsx` itself (you'll see in Section D that the page doesn't need one — it just renders links, and the router's own nested-array structure handles the rest).

One divergence worth naming while you're looking at this array: `main.tsx` also registers four `sysadmin/*` paths — `sysadmin/database-performance`, `sysadmin/audit-ledger`, `sysadmin/environment`, `sysadmin/logs` — that appear in neither `f1`'s master table nor `f4`'s component tree. You'll meet the pages behind them in the next section; they're a case of the real codebase growing past what the pre-development documents anticipated, not a contradiction of anything either document claims.

## B. What's Actually Built: The README's Claim, Checked Against the Filesystem

`README.md`'s Status section makes a specific, checkable claim about the frontend:

> "The frontend has its core flows built — secretary dashboard, assigned-steps queue, complaints intake, document requests, role assignment, committee management — with several admin and dashboard views (Mayor dashboard, `/sysadmin`, `/organization`, `/order-of-business`, `/sessions`) still outstanding."

That's a prose summary, and prose summaries are exactly the kind of claim worth checking against the thing they're summarizing rather than trusting on the strength of the rest of the document being reliable. So: `ls apps/web/src/pages/`, file by file.

**The "core flows built" half checks out completely.** `workflow/SecretaryDashboardPage.tsx` (16K), `workflow/MyAssignedStepsPage.tsx`, `documents/ComplaintsListPage.tsx` and `ComplaintIntakeClerkAssistedPage.tsx`, `documents/DocumentRequestsListPage.tsx` and `DocumentRequestDetailPage.tsx` (28K), `iam/RoleAssignmentPage.tsx` (16K), `organization/CommitteeManagementPage.tsx` (12K) — every one of these exists as a real, substantial file, not a stub.

**The "still outstanding" half does not.** Every single item the README names as outstanding has a real, wired-up component behind it:

| README claims outstanding | What's actually in `apps/web/src/pages/` |
|---|---|
| Mayor dashboard | `workflow/MayorDashboardPage.tsx` — 248 lines, 2 tRPC calls |
| `/sysadmin` | `sysadmin/` — **seven** files: `SystemAdminHomePage`, `ActiveSessionsPage`, `UserAccountManagementPage`, plus `DatabasePerformancePage`, `EnvironmentConfigPage`, `SecurityAuditLedgerPage`, `SystemLogsPage` |
| `/organization` | `organization/OrganizationPage.tsx` — 896 lines, 10 tRPC calls, the largest single page file in the app |
| `/order-of-business` | `workflow/OrderOfBusinessPage.tsx` — 767 lines, 4 tRPC calls |
| `/sessions` | `workflow/SessionAttendanceOverviewPage.tsx` and `SessionAttendanceDetailPage.tsx` (300 lines, 3 tRPC calls) |

And `main.tsx`'s router confirms every one of these is actually reachable — `path: 'organization'`, `path: 'sysadmin'`, `path: 'sysadmin/sessions'`, `path: 'sysadmin/users'`, `path: 'mayor'`, `path: 'sessions'`, `path: 'order-of-business'` are all real entries in the array you read in Section A, not orphaned files sitting unrouted. This isn't a case of the README being wrong about whether code exists somewhere in the repo — it's wrong about whether these specific pages are reachable from a URL, which is a stronger and more specific claim than "the file exists," and the router settles it. Best explanation: the Status section is a snapshot that predates a chunk of frontend work landing, and nobody has gone back to update the prose since. Worth flagging rather than repeating, and worth remembering the next time any document's summary paragraph is the only thing you've checked.

**The four `sysadmin/*` pages absent from both `f1` and `f4` are real, not placeholders — with one honest exception.** `EnvironmentConfigPage.tsx`, `SecurityAuditLedgerPage.tsx`, and `SystemLogsPage.tsx` each call a real backend procedure (`iam.getEnvironmentConfigMatrix`, `audit.getSecurityLedgerEventTypes` plus an infinite `audit.listSecurityLedger` query, and `audit.queryRuntimeLogs` respectively) and render real data. `DatabasePerformancePage.tsx` is different, and it's worth reading past the surface: it calls a real procedure, `audit.getDatabasePerformanceSnapshot`, polling every ten seconds — but the table body that would render rows is empty, with a comment reading `// Table layout implemented but unreachable due to backend blocking finding`. That's not a vague excuse; `docs/development-findings-log.md` entry **LOG-0132** confirms it precisely: no working connection path exists for the required `batac_it_admin` database role, so rather than silently falling back to the app's ordinary connection (which the task's own instructions explicitly forbade), the procedure was scaffolded to return a `501 NOT_IMPLEMENTED` error reporting the gap, and the frontend was deliberately built to render that error state gracefully rather than pretend the feature works. That's a genuinely different situation from a stub — it's a page that correctly reflects an honest, logged backend limitation, which is arguably more useful to a reader than either a working page or a silently missing one.

**`/admin` is genuinely thinner than `f1`/`f4` proposed, but not empty.** `f4`'s tree lists five children under `PlatformAdminHomePage`: `CommitteeManagementPage`, `PlatformConfigPage`, `NotificationDeliveryLogsPage`, `RoleAssignmentPage`, `AnnouncementManagementPage`. Checking each by its actual export name across the whole `pages/` tree — not just inside `pages/admin/`, since a component doesn't have to live under the directory matching its route prefix — turns up two real matches (`RoleAssignmentPage` in `pages/iam/`, `CommitteeManagementPage` in `pages/organization/`) and three that don't exist anywhere: `PlatformConfigPage`, `NotificationDeliveryLogsPage`, `AnnouncementManagementPage`. That absence isn't a documentation gap — it's the confirmed, current state of ADR-UI-002 and ADR-UI-006, both of which pulled these capabilities into Phase 1 *scope* without claiming they were built yet. ADR-UI-002's own consequences section says as much directly: "a config-screen spec sufficiently detailed to design these procedures against... must now be produced before this work can proceed. This ADR does not itself supply that spec." `main.tsx`'s router agrees — `admin/config`, `admin/delivery-logs`, and `admin/announcements` never appear as path entries, only `admin`, `admin/committees`, and `admin/roles` do. So: `pages/admin/` really is thin, exactly one file (`PlatformAdminHomePage.tsx`, a pure navigation shell with zero tRPC calls), but the two of its five documented children that *are* built simply live one directory over from where the spec proposed — `RoleAssignmentPage` sits with the rest of IAM's frontend, `CommitteeManagementPage` sits with the rest of Organization's, both places arguably making more sense than a directory named purely for who's allowed to see the page.

## C. `main.tsx`: Where Everything Gets Wired Together

You've already seen `main.tsx`'s router array in Section A. This section is about the other half of the same file — the part that makes `trpc.<module>.<procedure>.useQuery(...)` possible to call *anywhere* in the component tree in the first place.

Here's the actual render call, in full:

```typescript
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <SessionHydrator />
          <TooltipProvider delayDuration={500}>
            <RouterProvider router={router} />
            <Toaster position="bottom-right" duration={5000} toastOptions={{ /* ... */ }} />
          </TooltipProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </>
  </React.StrictMode>,
);
```

Walk through this from the outside in, because the nesting order is not arbitrary and it's worth being precise about which library wraps which — this is the exact opposite of how Chapter 1.4 described the relationship in the abstract, and the real file is the source of truth, not the earlier chapter's prose.

**`trpc.Provider`** is outermost. `trpc` here is the object Chapter 1.4 walked you through building in `lib/trpc.ts` — `createTRPCReact<AppRouter>()`, the thing whose entire nested shape (`trpc.workflow.getInstance`, `trpc.organization.getOfficeHierarchy`, all the way down) is inferred purely from the backend's own router type. `trpc.Provider` takes two props here: `client={trpcClient}` — the actual `httpBatchLink`-configured client from that same file, complete with its custom `fetch` override handling 401 silent-refresh and 423 session-lock — and, notably, `queryClient={queryClient}`, the *same* `QueryClient` instance that `QueryClientProvider` below it also receives. That's `@trpc/react-query`'s v11 integration doing exactly what Chapter 1.5 described: tRPC's hooks are TanStack Query hooks underneath, and both providers here are pointed at one shared cache, not two separate ones that happen to coexist.

**`QueryClientProvider`** wraps everything below it with that same `queryClient` — the one Chapter 1.5 traced to `lib/query-client.ts`, whose only customization on top of TanStack Query's v5 defaults is a `retry` function that skips retrying on a tRPC `UNAUTHORIZED` error (since Chapter 1.4's silent-refresh logic in `trpc.ts` already handles that case) and otherwise falls back to three retries.

**`SessionHydrator`** sits directly inside `QueryClientProvider`, as a sibling to everything else — not wrapping anything, not wrapped by anything, just mounted once. This is worth stopping on, because it's a second, independent real instance of the exact `.getState()`-outside-React pattern Chapter 1.6 taught you using `trpc.ts`'s 423 handler. Here's `SessionHydrator.tsx` in full, minus its error branches:

```typescript
export function SessionHydrator() {
  useEffect(() => {
    async function hydrate() {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      // ...
      const envelope = await response.json();
      useSessionStore.getState().setIdentity({ /* ... */ });
      useSessionStore.getState().setHydrated();
    }
    void hydrate();
  }, []);

  return null; // Invisible mount-once component
}
```

It renders nothing — `return null` — and exists purely for its `useEffect`'s side effect: on mount, it `POST`s to `/api/auth/refresh` to check whether a valid refresh-token cookie already represents a logged-in session, and either way — success or failure — it calls `useSessionStore.getState().setHydrated()` exactly once. That single call is what eventually flips `isHydrated` from `false` to `true` in `session.store.ts`, the flag Chapter 1.6 explained exists specifically to prevent a "flash of unauthenticated" redirect. You can see the other end of that same flag doing its job in `RequireAuth.tsx`, the component wrapping every authenticated route in the router array:

```typescript
export function RequireAuth({ children }: { children?: React.ReactNode }) {
  const identity = useSessionStore((s) => s.identity);
  const isHydrated = useSessionStore((s) => s.isHydrated);

  if (!isHydrated) {
    return <div className="flex min-h-screen w-full items-center justify-center">Loading...</div>;
  }
  if (!identity) {
    return <Navigate to="/login" replace />;
  }
  return <>{children ?? <Outlet />}</>;
}
```

This is the actual sequence, start to finish, the moment someone opens `/organization` in a browser: React renders, `SessionHydrator` mounts and fires its refresh request, `RequireAuth` sees `isHydrated === false` and renders a loading state instead of either the page or a redirect, the refresh request resolves and calls `.getState().setIdentity(...)` and `.getState().setHydrated()`, `RequireAuth` re-renders — because it's subscribed to `isHydrated` via the ordinary hook, not `.getState()` — sees `isHydrated === true` and a real `identity`, and only *then* renders `<AuthenticatedLayout />` with `<Outlet />` inside it, which is what finally lets `OrganizationPage` mount and make its first `trpc.organization.getOfficeHierarchy.useQuery()` call. Every step of that sequence depends on the provider nesting from this section existing above it in the tree — there is no path by which `OrganizationPage` could call `trpc.*.useQuery` successfully if `trpc.Provider` and `QueryClientProvider` weren't already wrapping it, and no path by which `RequireAuth` could correctly gate the route if `SessionHydrator` weren't mounted somewhere that runs before it needs an answer.

**`TooltipProvider`** and **`RouterProvider`** come last — Radix's tooltip context (needed because several `packages/ui` components use Radix tooltips internally) and the actual router object from Section A, doing the path-matching this whole chapter has been building toward.

## D. One Real Page, Traced Completely: `MyAssignedStepsPage.tsx`

This is the page the README names directly — "assigned-steps queue" — and it's the natural pairing with `WorkflowStepActionPage`, the page it links into, which lets this section also close the loop on ADR-UI-010 from Section A. Here it is, trimmed to its structure:

```typescript
const PAGE_ALLOWED_ROLES = [
  'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
  'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
  'records_officer', 'auditor',
] as const;

export function MyAssignedStepsPage() {
  const identity = useSessionStore((s) => s.identity);
  if (!hasRole(identity, ...PAGE_ALLOWED_ROLES)) {
    return <div>...</div>; // "You do not have permission to view this page."
  }
  return <MyAssignedStepsContent />;
}

function MyAssignedStepsContent() {
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const currentCursor = cursorHistory[cursorHistory.length - 1] || undefined;

  const { data, isLoading } = trpc.workflow.listMyAssignedSteps.useQuery({
    cursor: currentCursor,
    limit: 20,
  });

  const table = useReactTable({ data: data?.items ?? [], columns, getCoreRowModel: getCoreRowModel() });
  // ...loading state, empty state, then the actual <Table> render
}
```

### The role gate, and a genuinely interesting piece of self-correcting documentation

`PAGE_ALLOWED_ROLES` has ten entries, including `auditor`. That number matters because it doesn't match what you'd get from reading `f1` §8.1 or `f4` §5.3 casually — both currently list ten roles too, but a code comment sitting directly above the constant tells you why that agreement isn't an accident:

```typescript
// The 10-role set is sourced from workflow.router.ts lines 429-439
// (ground truth). F1 §8.1, E1, I2, and F4 previously listed 9 (omitting
// auditor) — that discrepancy is tracked in development-findings-log.md
// LOG-0069 and is being resolved separately. We build against the code.
```

Checking this against the actual findings log confirms it precisely: LOG-0069, `status: confirmed`, records that the real backend router (`workflow.listMyAssignedSteps`) always permitted ten roles including `auditor`, three pre-development documents originally said nine, the project owner directly confirmed `auditor` visibility was correct as coded, and — this is the part worth noticing — `f1`, `e1`, and `i2` were all subsequently *updated* to match the code, which is exactly why reading `f1` §8.1 today already shows you the correct ten-role list rather than a stale nine-role one. The comment's own line-number citation (429-439) is mildly stale relative to where `listMyAssignedSteps`'s real role check sits today (line 601 in the current file) — files grow, and comments citing specific line numbers drift the same way any pointer does — but the substantive claim checks out exactly against the real procedure: `apps/server/src/modules/workflow/workflow.router.ts`'s `allowedOperationalRoles` set is the identical ten roles, same order, backend-enforced independently of this frontend gate. This is worth sitting with for a second, because it's a small, complete demonstration of something this whole documentation corpus has been modeling since Chapter 0.1: a spec document is not a fixed oracle you defer to forever — it's a claim that can be wrong, that gets corrected once, and that a comment in the code can then correctly cite as *more* authoritative than an older draft of itself, because "the code" and "the document" converged into agreement rather than staying in permanent tension.

The gate itself is client-side only, and the comment above the whole block says so directly: "the server also enforces this — the client gate is a UX measure only." That's the same two-layer relationship you saw formalized as ABAC in Chapter 2.2 — the frontend's `hasRole` check exists so an unauthorized person sees a clean "you don't have permission" message instead of a page that loads and then fails, not because the frontend check is what's actually keeping them out.

### The query, and what its cache key actually is

`trpc.workflow.listMyAssignedSteps.useQuery({ cursor: currentCursor, limit: 20 })` is an ordinary tRPC-through-TanStack-Query call, exactly the shape Chapter 1.4 Section F walked through. Per Chapter 1.5 Sections B and F, you don't need to construct this call's cache key by hand to know what it is — it's tRPC's own auto-generated default, in the shape `[['workflow', 'listMyAssignedSteps'], { input: { cursor, limit }, type: 'query' }]`, which means changing `currentCursor` (as `handleNext`/`handlePrev` do) genuinely produces a *different* cache entry per cursor value, not a mutated version of the same one — each page of results, once fetched, stays cached independently.

There's no explicit `staleTime`, `gcTime`, or `refetchOnWindowFocus` override on this call, which — per the same reasoning Chapter 1.5 applied to `getOfficeHierarchy` — means it inherits the app-wide defaults untouched: stale immediately, refetches on mount, window refocus, and network reconnect. That's a genuinely reasonable default for a task inbox specifically: if someone completes a step from a different browser tab or a colleague finishes a step assigned jointly, refocusing this tab is enough to show the current state, with no manual refresh and no custom polling logic needed.

This page has no mutations of its own — it's read-only, a pure listing. So there's no `onSuccess` invalidation callback to check here; that's Section D's next stop, on the page this one links into.

### Zustand: one read, and a page-local `useState` that correctly isn't one

The only Zustand read on this page is `useSessionStore((s) => s.identity)`, feeding the role gate above. Everything else — `cursorHistory`, the pagination stack — lives in a plain `useState` inside `MyAssignedStepsContent`, and per Chapter 1.6's own decision checklist, that's the right call, not an oversight: "would it survive a page refresh, and *should* it?" A citizen or staff member refreshing this page landing back on page one of their task inbox, rather than resuming three pages deep into wherever they'd clicked to, is correct behavior, not a bug to fix by promoting this into a shared store. If Postgres has never heard of "which page of results this browser tab happened to be looking at a moment ago" — and it hasn't — `useState` is exactly where that belongs.

### `packages/ui` composition: Tier 1 underneath Tier 3

The page imports `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `EmptyState`, and `Button`, all from one barrel: `import { ... } from '@batac/ui'`. That single import path works because `packages/ui/src/index.ts` re-exports every component — Tier 1 primitives and Tier 3 domain components alike — from one flat file, so nothing about the import site tells you which tier a given component belongs to; you have to go look.

`Table` and its siblings are Tier 1 — direct shadcn/ui primitives, thin wrappers around plain HTML elements:

```typescript
const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn('hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors', className)}
      {...props}
    />
  ),
);
```

`cn()` — imported from `@batac/ui/lib/utils` — is `twMerge(clsx(inputs))`: `clsx` composes conditional class strings together, `tailwind-merge` then resolves any conflicts between them (so a caller passing `className="p-2"` correctly overrides a default `"p-4"` rather than producing invalid CSS with both present). Every shadcn/ui component in this package follows this exact shape: `React.forwardRef`, spread `...props` onto the real DOM element, `cn()` to merge the caller's `className` with the component's own defaults. This is the literal, checkable meaning behind `tech-stack.md`'s "owned source code, not a black-box dependency" — `table.tsx` isn't hiding behind a package boundary you'd have to eject to modify; it's forty lines sitting directly in this repo, and if you needed to change how every table row in this app highlights on hover, you'd edit this exact file.

`EmptyState`, the component rendered when `data?.items.length === 0`, is Tier 3 — a domain-specific composition, not a raw primitive:

```typescript
export function EmptyState({ icon: Icon, heading, body, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-4 text-center', className)}>
      <Icon className="h-12 w-12 text-neutral-300" aria-hidden="true" />
      <div className="flex flex-col items-center gap-1">
        <h3 className="text-text-secondary text-lg font-semibold">{heading}</h3>
        <p className="text-text-muted text-sm">{body}</p>
      </div>
      {action && <Button variant="default" className="mt-2" onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
```

This is Tier 3 built directly on Tier 1, in one file: `EmptyState` imports `Button` from `'../ui/button'` rather than reimplementing a button, which is exactly the layering `f4`'s component hierarchy assumes throughout. The call site in `MyAssignedStepsPage.tsx` — `<EmptyState icon={ClipboardList} heading="No assigned steps" body="You have no workflow steps currently assigned to you." />` — passes no `action`, and the component's own `{action && ...}` guard means that's a legitimate, supported way to use it, not a missing prop.

Neither of these two files reaches for Radix directly — that pattern is easiest to see in a component like `dialog.tsx`, elsewhere in the same package:

```typescript
import * as DialogPrimitive from '@radix-ui/react-dialog';
const Dialog = DialogPrimitive.Root;
const DialogOverlay = React.forwardRef</* ... */>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn(/* ... */, className)} {...props} />
));
```

Same shape, one layer deeper: Radix supplies the unstyled, accessible primitive (`DialogPrimitive.Overlay` — focus trapping, ARIA attributes, portal rendering all handled correctly out of the box), and this package's own file supplies exactly the styling `cn()` merges in, nothing more. `Table` doesn't need this layer because an HTML `<table>` has no complex interaction behavior Radix would need to supply; `Dialog` does, because getting focus management and screen-reader announcements right for a modal is exactly the kind of thing worth not reimplementing by hand.

### Composing the row, and where ADR-UI-010 becomes one real line of code

The table's actual columns live in a sibling file, `workflow/columns.tsx`, and this is where Section A's ADR stops being a pre-development decision and becomes a decision you can point at directly:

```typescript
type AssignedStepRow = RouterOutputs['workflow']['listMyAssignedSteps']['items'][number];

export const columns: ColumnDef<AssignedStepRow>[] = [
  {
    accessorKey: 'documentTitle',
    header: 'Document',
    cell: ({ row }) => {
      // Route key is instanceId per ADR-UI-010: the detail page's loader
      // (workflow.getInstance) takes { instanceId } — routing on instanceId
      // allows the future detail page to load with a single read call.
      return (
        <Link to={`/workflow/steps/${row.original.instanceId}`} className="text-primary font-medium hover:underline">
          {row.getValue('documentTitle')}
        </Link>
      );
    },
  },
  // ...stepType badge, assignedAt, dueAt columns follow
];
```

`AssignedStepRow` is `RouterOutputs['workflow']['listMyAssignedSteps']['items'][number]` — a real, live instance of the exact utility type Chapter 1.4 Section F introduced: not a hand-written interface someone keeps in sync by hand, but a type *derived* from the actual backend procedure's return shape, at whatever it currently is. And the `Link to={...}` is the ADR's consequence section made literal: the row has both `stepInstanceId` and `instanceId` available on `row.original` — you saw both fields land in the backend's `select` clause in Section B's verification — and this line deliberately reaches for `instanceId`, with a comment naming the ADR by ID and restating its exact reasoning at the one call site where the decision actually matters.

### Following the link: `WorkflowStepActionPage`, and a design decision that moved server-side

Click that link, and `/workflow/steps/:instanceId` renders `WorkflowStepActionPage`:

```typescript
export function WorkflowStepActionPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const { data: instance, isLoading, error } = trpc.workflow.getInstance.useQuery(
    { instanceId: instanceId! },
    { enabled: !!instanceId },
  );
  // ...loading and error states
  const renderPanel = () => {
    switch (instance.panelHint) {
      case 'generic_action':
        return hasRole(identity, /* ... */) ? <GenericActionPanel instance={instance} /> : /* fallback */;
      case 'multi_referral':
        return hasRole(identity, 'sp_secretary', 'sp_member') ? <MultiReferralPanel instance={instance} /> : /* fallback */;
      // ...nine more cases, one per documented panel
    }
  };
  return (/* ... */);
}
```

`{ enabled: !!instanceId }` is the same `enabled` pattern Chapter 1.5 walked through via `useScanQualityPolling` — the query genuinely shouldn't fire before `useParams` has resolved a real `instanceId` from the URL, and this is the ordinary, idiomatic way to express that.

Here's the divergence worth naming precisely, in the same spirit as Chapter 2.4's `index.ts` finding and Chapter 2.5's naming-casing gap: `f1` §8.2 and `f4` §5.3.1 both document the panel selection as something the *frontend* derives, switching on `currentStepType` and `step.stepKey` from the loaded instance. The real code switches on one single field instead — `instance.panelHint` — and that field is computed on the *backend*, inside `workflow.router.ts`'s `computePanelHint()` function, which the router calls before the response ever leaves the server:

```typescript
function computePanelHint(status, currentStepType, currentStep, instance, spsOfficeId):
  | 'multi_referral' | 'vp_certification' | 'mayor_decision' | 'mayor_lapse_confirmation'
  | 'veto_override_recording' | 'docketing' | 'panlalawigan_outcome' | 'publication_date'
  | 'secretariat_decision' | 'generic_action' | 'generic_approval' | null {
  if (status !== 'Active' || !currentStep) return null;
  const { stepKey } = currentStep;
  if (currentStepType === 'multi_referral') return 'multi_referral';
  else if (stepKey === 'vp_certification') return 'vp_certification';
  else if (stepKey === 'mayor_review' || stepKey === 'mayor_signature') return computeMayorPanelHint(/* ... */);
  else if (stepKey === 'veto_override_vote') return 'veto_override_recording';
  // ...
}
```

This is the same decision table `f1` §8.2 documents, condition for condition — `multi_referral` still maps to the Multi-Referral Panel, `stepKey === 'vp_certification'` still maps to VP Certification — the design intent is faithfully preserved. What moved is *where* that mapping gets computed: instead of `WorkflowStepActionPage` re-deriving the panel choice from raw `currentStepType`/`step.stepKey` fields on every render, the backend pre-computes one clean enum value and hands it over ready-to-switch-on. The frontend's `renderPanel()` function is consequently simpler than either pre-development document anticipated — a `switch` over one string, rather than a chain of conditions checking two separate fields — and the two documents' descriptions remain a completely reasonable account of *what* the page does, just not quite of *which layer* does it.

You can also watch ADR-UI-010's payoff land concretely one level further in, inside `GenericActionPanel.tsx` — the component this switch renders for the most common step type:

```typescript
export function GenericActionPanel({ instance }: { instance: RouterOutputs['workflow']['getInstance'] }) {
  const utils = trpc.useUtils();
  const completeMutation = trpc.workflow.completeActionStep.useMutation({
    onSuccess: () => {
      toast.success('Action step completed successfully.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      navigate('/workflow/steps');
    },
  });
  // ...
  <Button onClick={() => completeMutation.mutate({
    stepInstanceId: instance.currentStepInstanceId,
    comment: comment || undefined,
  })} />
}
```

This is Chapter 1.5's idiomatic `utils.*.invalidate()` pattern, matching exactly the shape the workflow panels chapter used as its reference case — one `onSuccess` handler, one instance-scoped invalidation, no broader blast radius than the mutation actually changed. And `stepInstanceId: instance.currentStepInstanceId` is the ADR's whole argument, realized: the mutation needs a `stepInstanceId`, and it gets one directly from the *response* of the query that loaded on `instanceId` — no second round trip to resolve one identifier from the other, because `workflow.getInstance`'s output already carried both.

## E. Building a New Page, Grounded in Files You Now Know How to Find

Pulling every section above into the steps you'd actually take, wiring up a page nobody's built yet — say, the still-missing `PlatformConfigPage` for `/admin/config`, which Section B confirmed is real ADR-approved scope with no component behind it yet.

**1. Add the route entry.** Open `apps/web/src/main.tsx`, find the `children` array under the `RequireAuth`-wrapped root — the same array you read in Section A — and add `{ path: 'admin/config', element: <PlatformConfigPage /> }` alongside the existing `admin/committees` and `admin/roles` entries. Import the component at the top of the file, the same way every other page in that array is imported.

**2. Create the page component.** Following the pattern `pages/admin/PlatformAdminHomePage.tsx` and its Section D-traced neighbors both establish, this is a new file — `pages/admin/PlatformConfigPage.tsx` is the placement `f4`'s original tree proposed, and there's no filesystem obstacle to it living there even though this chapter found two of its siblings drifted elsewhere; drift isn't a rule, it's just what happened twice.

**3. Call the relevant `trpc.<module>.<procedure>` hooks.** ADR-UI-002 is explicit that the procedures backing this page's six Tier-2 config entities don't exist yet — this is a genuine case where the backend work has to land first. Once it does, follow `MyAssignedStepsPage.tsx`'s exact shape for the read side (`trpc.admin.listDocumentTypes.useQuery()`, or whatever the eventual procedure is named, with `isLoading`/empty-state handling matching Section D's pattern) and `GenericActionPanel.tsx`'s shape for any write side — `const utils = trpc.useUtils()` at the top, `utils.<module>.<procedure>.invalidate()` in each mutation's `onSuccess`, checked against `f3`'s Mutation Invalidation Matrix for the specific target rather than assumed.

**4. Compose it from `packages/ui`.** ADR-UI-002's own note that this will likely be "six sub-sections or tabs, one per config entity" points straight at `packages/ui/src/components/ui/tabs.tsx` for the outer structure, with `Table`/`Card`/`Button` from Section D's own imports for each tab's contents — no new primitive needed, this page is a composition problem, not a component-design one.

**5. Add page-local UI state only if the data doesn't already have a server-side home.** Which tab is currently active, whether a create-dialog is open — straight into a plain `useState` inside the page, exactly the reasoning Section D applied to `cursorHistory`. If this page turns out to need state that genuinely has to survive across route changes — a config-entity filter someone expects to still be set after navigating away and back — that's the point where you'd reach for `ui.store.ts`, following Chapter 1.6 Section G's checklist rather than reflexively adding a new store: check whether `ui.store.ts`'s existing flat, boolean-pair shape already fits before proposing a new file.

Every step above points at a file this chapter has actually opened and shown you — the router array, the role-gate pattern, the query/mutation shape, the Tier 1/Tier 3 composition, the `useState`-versus-Zustand judgment call. That's deliberate: this chapter's whole purpose was to stop being about any one piece of the stack, and start being about how you'd find your way through the real repository the next time you need to build something in it yourself.

---

# Chapter 3.1 — Consolidating the Drift: A Map and a Method

## A. Why This Chapter Exists

Every earlier chapter in this series has occasionally stopped mid-explanation to check something: does the real file actually say what the architecture document says it should? Most of the time, yes. A few times — the `documents/index.ts` question in Chapter 2.4, the vestigial `engine/index.ts` stub in Chapter 2.6, the tracking/workflow SLA question in Chapter 2.7, the missing `fe-handoff.md` in Chapter 0.1 — the answer was more complicated than yes or no, and each of those chapters worked through that specific case in the depth it deserved, in the place it came up.

This chapter's job is different. It's not going to introduce a new module or a new piece of the stack. It's going to go back to every one of those findings, re-verify each one against the files on disk today rather than against what an earlier chapter said about them, put them next to each other in one place, add a couple of checks the earlier chapters didn't have room for, and — the part that actually makes this chapter worth writing, rather than just a longer version of a changelog — teach you the procedure that produced all of it, so you can run it yourself in six months when this codebase looks different again.

Before any of that, it's worth being explicit about what this chapter is *not* trying to do, because it would be easy to misread a chapter that opens with "here's everything that doesn't match the docs" as an indictment.

This project was built with heavy AI-agent involvement, at real speed, across dozens of individually-prompted implementation tasks — the working reality Chapter 0.1 opened this whole series by describing: every task starts an agent with zero memory of the previous one, so the documents have to carry everything, every time. The person commissioning this series has described the practical consequence of that plainly: development moved faster than anyone's — human or agent's — standing understanding of exactly how everything was wired together could keep up with. That's not a criticism of the team. It's close to a law of the medium. A single architect holding an entire system's wiring in their head, making every file-boundary decision themselves, will drift far less over time than eleven modules' worth of barrel files, each written by a different task, each following the same architecture document, each interpreting "barrel-only" with slightly different judgment about what counts as "the Published API" versus "an implementation detail." Multiply that by real deadline pressure and the fact that a working `index.ts` that exports one extra thing doesn't *look* broken — the tests pass, the app boots, the feature ships — and drift isn't a failure mode. It's what happens by default, and the interesting engineering question is never "how do we prevent it entirely" but "how do we find it reliably and keep the map current."

So: this chapter's goal is not to assign blame, and it's genuinely not to argue the codebase is in bad shape — you'll see below that several of the six modules examined here hold the line cleanly, and even the ones that don't are, in every case, still functionally correct code that ships real features. The goal is to give you two things. First, a current, honest map of exactly where documentation and code disagree on one specific, well-scoped question — module structure and the `index.ts` barrel convention — consolidated in one place instead of scattered across four earlier chapters. Second, and more durable than any specific finding here: a method. The codebase will keep growing after this material is written. New modules will get added, existing ones will get touched by tasks that don't re-read J4 first, and some of today's clean modules will drift the way tracking and organization already have. The map in this chapter has a shelf life. The method in Section E does not.

## B. The Six-Module `index.ts` Comparison

J4 (`j4-module-structure-template.md`) is this project's normative reference for what belongs in each module's files, and its very first lines — before you even reach the file-by-file rules — carry a conflict note specifically about this file:

> **Conflict note — `index.ts` role:** The J4 scope brief assigned "Fastify plugin registration" to `index.ts`. This conflicts with two source documents. B2 (Enforcement Mechanisms) states that `index.ts` is the Published API barrel file: it "exports **only** the Published API interface. Internal files, services, and repositories are not re-exported." J1 (§4 Module Plugin Pattern) places Fastify plugin registration in `{module}.plugin.ts`. This document follows J1 and B2. If the intent is to merge plugin registration into `index.ts`, that is a deviation and requires an ADR before implementation.

Section 3.1 then states the rule in full, and it's worth having the "must not contain" list in front of you before the table, since every verdict below is checked against these five items specifically:

> **Role:** The module's only permitted export point for other modules. Exports the Published API interface and the cross-module types callers need to consume it. Contains no implementation code.
>
> **Must not contain:**
> - Service factory functions or implementations
> - Repository factory functions or implementations
> - Drizzle schema references
> - Fastify plugin registration
> - Module-private types that have no Published API use

And Section 8's Deviation Policy names this exact scenario as one of five examples requiring an ADR before implementation: "Changing `index.ts` to export internal implementation details."

Chapter 2.4 checked this rule against one module — `documents` — in real depth, and found a nuanced answer: no *explicitly forbidden* export was present, but the barrel exported router factories and a policy guard that weren't clearly "Published API interface" either. That chapter didn't have room to ask the same question of the other five modules that had already been covered by that point in the series. This section does. All six files below were re-opened fresh for this chapter — not recalled from any earlier chapter's quotes — and checked line by line against the same five-item list.

| Module | Exports plugin directly? | Exports service factory? | Exports repository class? | Overall verdict |
|---|---|---|---|---|
| **documents** | No | No | No | Cleanest of the six — no forbidden item present |
| **iam** | No (module plugin correctly excluded — a *different*, narrower plugin is exported instead) | No | No | Second cleanest — a real but smaller issue |
| **audit** | No (module plugin correctly excluded) | Defined inline in the file itself, not re-exported from elsewhere | No (imported and instantiated internally, not exported by name) | Third — plugin correctly kept out, but real implementation code lives in the barrel |
| **workflow** | **Yes** — `workflowPlugin`, the module's own `fp()`-wrapped registration plugin | **Yes** — `createWorkflowPublicAPI` | No (imported and instantiated internally) | Two of five forbidden categories, both direct |
| **organization** | No | **Yes, twice** — `createOrgService` and `createDelegationService` | No (imported and instantiated internally) | One forbidden category, doubled, plus ~90 lines of standalone implementation code in the file |
| **tracking** | **Yes** — the module's default plugin export | **Yes** — `createTrackingService` | **Yes** — `TrackingRepository`, exported by name | All three of the checkable forbidden categories, in one 42-line file |

Six short paragraphs, one per module, in the order the table ranks them:

**documents** holds the line most cleanly of the six. Its 24-line `index.ts` re-exports its own types, four tRPC router-factory functions (`createDocumentsRouter`, `createComplaintsRouter`, `createDocumentRequestsRouter`, `createDocumentsAppRouter`), and `DocumentPolicyGuard` plus its ABAC attribute types. None of that is a service factory, a repository class, a Drizzle reference, or the Fastify plugin — `documents.plugin.ts` is never imported here at all. Chapter 2.4 already made the fair point that router factories are *arguably* implementation rather than pure interface, and that's still true — but arguable is a different, and smaller, problem than explicit.

**iam**'s `index.ts` gets the module-registration plugin right: `iam.plugin.ts` — the file that actually does `fp(iamPlugin, {...})` — is never touched here. What the barrel exports instead is `authMiddlewarePlugin`, from `iam.middleware.ts`, and that file is also a genuine, `fp()`-wrapped Fastify plugin — just a different kind, a four-hook preHandler chain (`verifyAccessToken` → `loadDelegationContext` → `setDatabaseSessionVars` → `updateLastActivity`) meant to be registered on protected-route scopes by *other* modules' plugins, not IAM's own module-registration mechanism. Whether a cross-cutting middleware plugin is the same category of thing J4's "Fastify plugin registration" prohibition means is a genuinely fair question — it's not obviously the same violation as re-exporting your own module's registration plugin. What tips this into a real, checkable finding rather than a shrug: tracing who actually imports `authMiddlewarePlugin` shows the real consumer, `app.ts`, doesn't even use the barrel export — it reaches `iam.middleware.ts` directly with a dynamic `await import()`, bypassing `index.ts` entirely. The one thing this barrel export exists to provide isn't the path the codebase's own composition root actually takes.

**audit** also gets the module-plugin exclusion right — `audit.plugin.ts` exists as a separate file and is never re-exported. But `index.ts` itself contains `createAuditModule`, a complete ~20-line factory function that directly instantiates `new AuditRepository(...)`, `new AuditWriteService(...)`, and `new AuditQueryService(...)` and returns the composed `AuditPublicAPI` object. This is architecturally different from the other five modules in one respect worth naming precisely: audit has no single `audit.service.ts` file — the service layer is split into `audit.write-service.ts` and `audit.query-service.ts`, and `index.ts` is the file that composes them. `audit.plugin.ts` confirms this by importing `createAuditModule` from `'./index.js'` directly — the plugin *depends on* the barrel for its composition logic, which is close to the inverse of what a barrel is supposed to be. In practice this matters less than it might sound: tracing which other modules import from `audit/index.ts` shows every one of them (`iam`, `organization`, `documents`) takes only the `AuditPublicAPI` type, never `createAuditModule` itself. The forbidden pattern is present in the file, but nothing outside `audit.plugin.ts` currently reaches for it.

**workflow** is where the violations stop being arguable. Line 1 of its `index.ts` is `export { default as workflowPlugin } from './workflow.plugin.js'` — and `workflow.plugin.ts` is unambiguously the module's Fastify plugin: it opens with `import fp from 'fastify-plugin'`, and its own last two lines are `export default fp(workflowPlugin, { name: 'workflow', dependencies: [...] })`. That's the exact "Fastify plugin registration" item named on J4's forbidden list, exported by name, from the barrel, in the module's very first export line. Line 2 exports `createWorkflowPublicAPI`, which — reading `workflow.public-api.ts` — is a factory function that instantiates `new WorkflowRepository(db)` and `new SlaService()` internally and returns the module's Published API object. That's the "Service factory functions or implementations" item, also named explicitly, also exported directly. Two of five forbidden categories, both unambiguous, in a 51-line file that otherwise contains nothing but type declarations.

**organization**'s `index.ts` is worse in a different way: it isn't merely re-exporting forbidden things from other files, it *is* implementation code — around 90 of its 111 lines. Lines 21–22 export `createOrgService` and `createDelegationService` directly, doubling up the same forbidden category workflow has once. But the file goes further than a re-export: it holds module-level singleton state (`let orgService`, `let delegationService`), an `initializePublishedAPI()` function that constructs and assigns both, two `getOrgService()`/`getDelegationService()` guard functions that throw if called before initialization, and nine separate wrapper functions (`resolveCurrentHolder`, `getActiveDelegationForUser`, `getOfficeById`, and so on) each containing real delegation logic. Nothing here is a re-export of someone else's implementation — the implementation lives in this file. J4's Role line says plainly "Contains no implementation code"; organization's `index.ts` is close to entirely implementation code with a thin type-export shell around it.

**tracking** is the only one of the six that trips all three checkable forbidden categories in a single, short file. Line 39 exports the plugin default (`tracking.plugin.ts`, confirmed as a genuine `fp()`-wrapped registration via the same check applied to workflow). Line 40 exports `TrackingRepository` — a repository class, by name, directly — which none of the other five modules do. Line 42 exports `createTrackingService`. Worth being precise about something here rather than letting it pass quietly: Chapter 2.7 described this exact file as "small and clean," said it "exports the plugin default, three service classes... and the two Published API types," and concluded "nothing here reaches past the barrel... the pattern is holding." That description of *what the file contains* was accurate — but Chapter 2.7 didn't run those contents through the same "must not contain" checklist Chapter 2.4 had already applied to documents two chapters earlier, so it read the plugin-and-service-and-repository exports as evidence the barrel discipline was intact, rather than as three separate, direct instances of exactly what that discipline forbids. Both things can be true at once — a small, readable file, and a file that violates the rule more directly than any other module examined here — and this chapter is the first point in the series where the two get checked against each other explicitly.

## C. Searching for Other Vestigial Stubs

Chapter 2.6 found something specific: `engine/index.ts`, seven functions, every one a one-line `throw new NotImplementedError(...)` — genuinely scaffolded early in the module's life, never filled in, superseded entirely by real implementations in sibling files, and left behind as a landmine for anyone who went looking for "the workflow engine's entry point" by its most obvious name. This chapter's brief asked for a repository-wide sweep: is that an isolated case, or does the same pattern exist elsewhere, undiscovered?

A search for the literal string `NotImplementedError` across the entire `apps/server/src` tree, tests included, returns exactly one match: the class's own definition, in `apps/server/src/errors/not-implemented.ts`. Nowhere else in the current source tree is this error thrown. A repository-wide search, not limited to `apps/server/src`, turns up the expected historical artifact and nothing more: the compiled `apps/server/dist/apps/server/src/modules/workflow/engine/index.js` — the dead build output of the file Chapter 2.6 already traced — plus mentions in the task-list documents (`wf.md`, `fix.md`) that specified and then retired it, and this series' own earlier chapter describing it.

That's the honest, complete answer to research step 2: **there is no second `engine/index.ts` sitting in this codebase today.** The specific failure mode Chapter 2.6 found — a confidently-named file that would mislead the next person who trusted its name over its content — was a real, one-time thing, and it's already been cleaned up. `TASK-WF-BE-011` in `fix.md`, the cleanup task Chapter 2.6 quoted, appears to have actually run: the source file this archive contains has no `engine/index.ts` at all, only the compiled trace of one that used to exist.

This is worth stating as plainly as any of the findings that follow it: sometimes the answer to "did you find more of this" is genuinely no, and reporting a clean sweep honestly is exactly as valuable as reporting a new problem — it's the difference between "this pattern might be everywhere" and "this pattern was one, isolated, already-resolved case," and only the search tells you which.

One adjacent, smaller thing worth carrying forward rather than treating as a separate new finding: `assignee-resolution.ts`'s `office_role:` branch — the one Chapter 2.6 already traced as the reason the router-versus-handler assignment-check discrepancy is currently harmless — is still, today, exactly what that chapter found: `throw new Error('NotImplemented: The Organization module does not currently support office-role lookups...')`. It doesn't use the `NotImplementedError` class (it's a plain `Error` with a string prefix), which is why it didn't surface in this section's search — but it's the same category of thing, still genuinely open, unchanged since Chapter 2.6. Its sibling branch, `role:`, is not open anymore; Section D below covers exactly what changed there and when.

## D. Three Direct Checks

**Is `fe-handoff.md` still absent?** Yes, definitively. A filename search across the entire repository, every case variant, turns up nothing — the file does not exist under any name, anywhere in this archive. And it's still actively cited as though it does: `AGENTS.md`'s own routing table still names it by section ("Office-Scoping Pattern," "Workflow Engine — Outcome Handling"), `fe.md` still cites it four separate times with specific technical content attached to those citations, and the findings log's `LOG-0085` still lists `fe-handoff.md (Office-Scoping Pattern)` in its `tagged_documents` field. Nothing about this situation has changed since Chapter 0.1 first flagged it. If you're the reader picking this up after that chapter, this is exact reconfirmation, not new information — but the brief for this chapter asked for it to be checked "definitively, one more time," and it has been, with the same result.

**Does the findings log contain entries the team itself already logged about module-boundary drift?** Reading `development-findings-log.md` in full — all 115 entries, not just the header — and filtering for any `affects` field naming B2, J4, or J1 turns up three matches. One (`LOG-0017`) concerns missing plugin-dependency infrastructure files, a real finding but about a different problem than the barrel-content question this chapter is asking. A second (`LOG-0131`) is a false match on document-ID shorthand — it references "B1" and "B2" as *use-case IDs* from an entirely unrelated diagram document, not the Module Boundary architecture document. The third, `LOG-0118`, is genuinely relevant, and worth being precise about what it does and doesn't cover: it documents a human decision to add `getUsersByRole` to `IamPublicAPI` after `assignee-resolution.ts`'s `role:` branch was found throwing the same kind of `NotImplemented` error its sibling `office_role:` branch still throws today. The fix was real and is live — reading `assignee-resolution.ts` fresh confirms the `role:` branch now calls `deps.iamService.getUsersByRole(roleCode)` exactly as the log entry describes, while `office_role:` right below it is unchanged. This entry is still sitting at `status: proposed`, meaning — per the exact distinction Chapter 0.1 established — it's informative and worth knowing, but not yet a human-reviewed, settled fact the way a `confirmed` entry or a Group B–L document would be.

Beyond those three, a targeted search of the log's body text (not just its `affects` fields) for the specific export names this chapter's Section B found — `workflowPlugin`, `createOrgService`, `createDelegationService`, `TrackingRepository`, `createTrackingService`, `createAuditModule` — turns up nothing directly on point, but does surface real, relevant texture about `organization`'s fragility specifically: two separate entries (`LOG-0039`, about `fastify.boss` being undefined during synchronous plugin registration because pgboss decorates onto Fastify *after* the organization plugin registers, and `LOG-0088`, a static-read finding, not yet confirmed, that `organization.plugin.ts` may construct its tRPC router with an `orgRepository` key silently missing from the dependency object) both describe `organization.plugin.ts` behaving unreliably around exactly the kind of deferred, singleton-based service construction this chapter's Section B found living inside `organization/index.ts`. Neither entry addresses the barrel-export question directly, and neither is `affects`-tagged to J4 or B2 — but they're honest evidence that this module's plugin-and-barrel wiring has already produced two other, adjacent bugs the team found through separate investigations. That's a pattern worth knowing about even though it isn't the same finding.

So the honest summary: **no findings-log entry directly addresses "does this module's `index.ts` violate J4's barrel-only rule" for any of the six modules examined in Section B.** That question, as asked here, appears to be genuinely new synthesis — not something the team has already logged and is quietly planning to fix. `LOG-0118` is the one item in this chapter that should be read with a slightly different posture than everything else: it's evidence the team is *already* aware of drift in this general neighborhood (a stub in the exact same file Chapter 2.6 examined) and has already partially resolved it, even though it hasn't touched the specific barrel-export question this chapter raises.

**Does any ESLint or automated tooling currently enforce J4's module-boundary rules, anywhere in the repo?** No — and this chapter re-checked the claim more thoroughly than Chapter 2.4 had room to, across the whole `packages/config/` package rather than a documents-specific spot check, and the answer holds up exactly the same way. `packages/config/` contains exactly one ESLint-related file, `eslint.base.js`. It imports and registers `eslint-plugin-boundaries` — a real plugin purpose-built for module-boundary enforcement — under the `boundaries` key in its `plugins` object. Scanning every rule actually turned on in that file's `rules` object, and then searching the entire repository for the literal string `boundaries/` in any JS, CJS, or JSON file, returns zero matches anywhere. The plugin is present and unused.

It gets more specific than that, though, and this chapter checked the full chain rather than stopping at "the rule doesn't exist." A repository-wide search for ESLint entry-point files (`eslint.config.*`, `.eslintrc*`) finds exactly one: `apps/web/eslint.config.cjs`, which extends the base config and layers on React-specific rules — governing the frontend, not `apps/server`, where every module in Section B's table actually lives. There is no ESLint config file of any kind under `apps/server`. And checking every workspace `package.json` for a `lint` script — all six packages, not a sample — finds exactly one that has one: `apps/web` (`"lint": "eslint ."`). `apps/server/package.json` has none, and neither does `packages/config`, `packages/database`, `packages/shared`, or `packages/ui`. Root `pnpm lint` resolves to `turbo run lint`, and Turborepo's `lint` task simply fans out to whichever workspace packages define that script — which, today, is only `apps/web`.

One more link worth closing that Chapter 2.4 didn't have reason to check: does CI catch this some other way, even if local `pnpm lint` wouldn't? No. `.github/workflows/ci.yml`'s `lint-typecheck` job runs `pnpm turbo run lint typecheck db:lint` — the identical Turborepo `lint` task, resolving through the identical, empty-for-`apps/server` fan-out. Whatever runs on every pull request against this repository today would not catch a single one of the six findings in Section B's table, because the mechanism that would need to catch them was never wired up to run against the code where they live.

## E. The Method

Everything in Sections B through D above has a shelf life. Six months from now, some of today's clean modules may have drifted, some of today's violations may have been fixed, and new modules that don't exist yet will need the same question asked of them for the first time. What doesn't expire is the procedure that produced this chapter's findings — and it's genuinely just seven repeatable steps, each one demonstrated concretely somewhere in this series already.

**1. Pick a documented architectural rule.** Something specific and checkable, stated in one of the Group B–L documents — not a vague impression of "how things are usually done," but an actual sentence you can quote. This chapter used J4 §3.1's "index.ts is a barrel only" rule, with its explicit five-item forbidden list, precisely because a numbered list is unambiguous to check against. A vaguer rule ("keep modules loosely coupled") would leave too much room for the checker's own judgment to substitute for the document's.

**2. Identify every real file the rule should apply to.** For this chapter, that meant every module's `index.ts` — six files, all of them, not a sample. It's tempting to check the module you're already curious about and stop; the value of a consolidated pass specifically comes from checking *all* of them, because (as Section B showed) the pattern doesn't distribute evenly. Two modules were essentially clean, one had a narrow issue, and three had direct, unambiguous violations — you wouldn't know that shape existed if you'd only checked one.

**3. Read each one and check it against the rule literally, not against your impression of the rule.** This is where Chapter 2.7's earlier pass on tracking's `index.ts` and this chapter's pass on the same file genuinely diverged, despite both being accurate about the file's contents. Reading a file and forming a general impression ("this looks like a clean barrel") is a different act from opening the specific document's specific list and checking each item off, one at a time, against what's actually on the page. The second is slower. It's also the only one that reliably catches a plugin export sitting in plain sight in a 42-line file.

**4. For anything that looks unused or dead, verify by checking who actually imports it — don't assume presence means active use.** This is the exact technique Chapter 2.6 used on `engine/index.ts` (grep the whole repository, both by file path and by each exported function's name, before concluding a file is genuinely superseded) and the same technique this chapter used repeatedly in Section B: confirming that `iam.middleware.ts`'s barrel export isn't even the path `app.ts` actually uses, and that `audit/index.ts`'s `createAuditModule` factory has exactly one real caller (`audit.plugin.ts` itself) despite being exported for anyone to reach.

**5. Check the findings log for whether the team has already logged the same discovery.** Read the whole log, not just the header or a keyword search limited to the exact document ID you expect — this chapter's search for "B2, J4, J1" in `affects` fields alone would have missed `LOG-0039` and `LOG-0088`, both genuinely relevant texture on `organization`'s fragility, because neither was tagged to those specific document IDs. A body-text search using the actual export names or function names involved caught what the `affects`-field search alone would have missed. And when you find a match, check its `status` field before treating it as settled — a `proposed` entry, per this project's own rules, is informative but not yet endorsed.

**6. Check for automated enforcement that would have caught the drift.** Not "is there a rule that *could* catch this" but "does something, today, actually run and check this on every change." Section D's answer here — plugin imported, zero rules configured, zero config files reaching the affected package, zero lint scripts there, CI running the identical toothless chain — took four separate checks stacked together to answer completely. Any one of those four being different (an active rule, a config file, a lint script, a CI step that ran something else) would have changed the practical risk assessment entirely. This step tells you something the first five don't: whether a finding like this is likely to recur, or whether — once someone builds the missing piece — it would start catching itself.

**7. If you find a genuine, new drift, decide what it needs.** J4's own Section 8 Deviation Policy is explicit that some changes need an ADR before implementation — "Changing `index.ts` to export internal implementation details" is one of its five named examples, and that's precisely what four of the six modules in Section B's table have already done, without one. Others might only warrant a findings-log entry: something worth recording as a known gap, without necessarily requiring a human to sit down and write a formal decision record before anyone can proceed. The distinction generally comes down to scale and risk — a single narrow export like `authMiddlewarePlugin` sitting unused in a barrel is a findings-log-sized observation; `organization/index.ts` holding ninety lines of stateful implementation logic that the rest of the codebase depends on is closer to ADR territory, because reversing it later means touching every caller, not just editing one export line.

Run these seven steps against a different rule — say, J1's transaction-and-event-ordering pattern, or B2's Published-API-surface completeness for a module that hasn't shipped yet — and you'll get a different map, using the same method. That's the actual payoff of a chapter like this one: not that the six rows in Section B's table stay accurate forever, but that the procedure that produced them doesn't go stale the way the table will.

## F. What I'd Flag First — And Why This Is a Judgment Call, Not a Fact

Everything above this section is a finding: something checked against a real file or a real document, with the evidence shown. What follows is different in kind — my own prioritization of which of today's findings deserves attention first, based on the evidence gathered, but not itself extracted from any document. Treat it as one reasonable reading of the evidence, not as something you'd find written down anywhere else in this repository.

**First: the `tracking/index.ts` and `workflow/index.ts` barrel violations, together, ahead of anything else in this chapter.** Not because either one is currently causing a bug — nothing in this chapter's research found one — but because Section D established something that changes how much weight to put on "it's just a convention violation": the automated safety net J4 itself claims exists for exactly this problem doesn't actually operate anywhere in this repository, for any server-side module, today. J4 §3.1 states as a fact that "the automated coupling test suite rejects any import of `modules/documents/src/...` in another module's source" — Chapter 2.4 already showed that claim doesn't hold even for the one module it names specifically. This chapter's Section D showed the same is true structurally, for the whole `apps/server` app, at the tooling level: no lint rule, no config file, no CI step, would catch any of these six barrel violations even if a developer wrote a seventh one tomorrow. A documented rule with a described-but-nonexistent enforcement mechanism is exactly the situation where a human is most likely to *assume* the boundary is safe to build against, because the architecture document says it's guarded — right up until someone reaches past `workflow/index.ts` for something that was never meant to be a stable public surface, and it works, because nothing stops it.

Between the two, tracking edges out workflow for me, marginally: it's the only one of the six that trips all three checkable categories in one place, and it's the one place in this series where an earlier chapter's own characterization ("small and clean") needs a direct correction rather than just an addition. That's not a bigger practical risk than workflow's — it's a bigger gap between what a reader of this series would currently believe about the file and what's actually true of it, and closing that gap is part of what this chapter is for.

**Second: `organization/index.ts`'s implementation code.** This one I'd flag for a different reason than the first two — not primarily because it's unguarded (it shares that problem with everything in Section B), but because of what Section D's adjacent findings-log search turned up: `organization.plugin.ts` already has two independently-discovered, real bugs (`LOG-0039`, `LOG-0088`) growing directly out of the same deferred-singleton-construction pattern that makes `organization/index.ts` hold implementation state instead of just re-exporting it. That's a module where the barrel-content violation and genuine, separately-logged fragility appear to share a root cause. Fixing the barrel-export question here might be the smaller part of a larger, worthwhile cleanup, rather than a purely cosmetic fix.

**Third, and lowest priority of the drift-shaped findings in this chapter: `iam`'s `authMiddlewarePlugin` and `audit`'s `createAuditModule`.** Both are real, checkable instances of the same underlying rule violation — but both are narrower in a way that matters practically: `iam`'s export isn't even the path the real caller uses, and `audit`'s factory has exactly one real caller, which is the module's own plugin file. Neither is currently doing load-bearing work for any *other* module the way tracking's and workflow's exports plausibly could be. I'd still write these up — a clean sweep is worth having — but I wouldn't reach for either before the three above.

**Explicitly not on this list, because it isn't a finding that needs resolving:** the tracking/workflow SLA-code placement question this chapter's brief specifically raised as a comparison point. Chapter 2.7 already ran this exact question to ground — checking TRACK's own task list, TRACK's own schema, and decisively, B2's own Module 4 responsibility line, which states plainly that Workflow "manages... ARTA SLA timers" — and concluded, correctly, that this is architecture as designed, not architecture as drifted. It only shares a word with "Tracking" the module name; the actual legal-deadline clock was always Workflow's concern, by the architecture document's own stated design. It's a useful example of why this method matters — a thing that *looks* like drift from the module names alone turns out, on inspection, not to be — but it isn't itself something to flag to a team, because there's nothing broken to fix.

And **not `fe-handoff.md`**, for a related but different reason: it's real and unresolved, but it's not this chapter's finding to prioritize — Chapter 0.1 already flagged it as something to raise with the team directly, and nothing in this chapter's re-confirmation changes that recommendation. Re-verifying it here was about confirming the map is still accurate, not about discovering something new to act on.

If I were the one taking this list to the team, I'd lead with the ESLint gap underneath everything in Section D, actually — not any single barrel violation, but the fact that the tool meant to catch all of them is sitting in the dependency tree, imported, configured for nothing, wired into no package that would ever run it. Every other item on this list is a symptom. That one is closer to the cause, and per this chapter's own Section E method, it's exactly the kind of thing worth checking again the next time someone runs this procedure — because if it ever does get wired up, several of today's findings should simply stop being possible to write.

---

# Chapter 3.4 — What's Actually Left: NOTIF, PORTAL, and Where You Go From Here

## Before the walkthrough: what this chapter is for

Every chapter before this one taught you how to read something — a database table, a tRPC procedure, an ABAC policy, a workflow engine transition, a task list's own internal jargon. This chapter doesn't teach you a new way of reading. It uses everything you already have to answer one plain question: **what's actually left to build, and in what order should you build it?**

That question has a real, checkable answer sitting in this repository right now. Not a guess, not a roadmap slide — an answer you can verify yourself, the same way you've verified everything else in this series, by opening files and reading what they actually say. This chapter walks through NOTIF's task list the way Chapter 3.2 walked through REC's, confirms the connection between NOTIF and the event bus material from Chapter 1.7, reports honestly on how minimal PORTAL genuinely is today, explains why PORTAL's own task list can't even be generated yet, and then gives you — clearly labeled as a judgment call, not a document quote — a recommended order for the remaining work. It closes by looking back at the whole series you've just finished.

---

## A. NOTIF's Current State — What `notif.md` Says Is Left to Build

`notif.md` is 1,131 lines and 14 tasks — proportionally lighter than the largest modules (`docs.md` runs past 3,400 lines, `wf.md` past 2,600), but a real, substantial module pass, not a thin one. It's the other not-yet-executed module in this repository besides REC, and its own header tells you exactly what it drew on to get built:

> **Source documents loaded (in order):**
> 1. `a1-skeleton.md` — structural contract
> 2. `a1-tasks/wf.md` — prerequisite module task list (TASK-WF IDs)
> 3. `h4-notification-event-and-template-catalog.md` — event/template domain catalog
> 4. `c1-full-database-schema-ddl-v3.md` §notifications — DDL
> 5. `e1-trpc-router-and-procedure-catalog.md` §notifications — tRPC procedures
> 6. `b2-module-boundary-and-internal-api-contracts-v1.1.md` — Module 7 boundary contract
> 7. `b3-internal-domain-event-catalog-v1.3.md` — Master Event Registry, §4/§6/§7 payload schemas

The 14 tasks break down cleanly by concern: TASK-NOTIF-001 through -005 build the foundation — schema, repository, SSE delivery infrastructure, the core dispatch service, and a seed script for nine starter templates. TASK-NOTIF-006 through -011 are six event-consumer files handling eight distinct event types. TASK-NOTIF-012 builds the tRPC router. TASK-NOTIF-013 wires everything into a Fastify plugin at startup. TASK-NOTIF-014 is the test suite.

### A representative task: a documented correction, applied before a line of code exists

TASK-NOTIF-001 is worth reading closely because it's a clean example of exactly the kind of document-reconciliation work you've watched happen across this whole series — except this time, you're watching it happen *before* implementation, not after. The base DDL for `notifications.notification_events` names its recipient column `recipient_employee_id`, with a logical FK to `organization.employees`. TASK-NOTIF-001 overrides that, in its own AI Prompt, with a fully justified correction:

> **CORRECTION APPLIED — read before implementing:** C1 Part 9's literal DDL names the recipient column `recipient_employee_id`... This is corrected to `recipient_user_id` (logical FK → `iam.users.id`) above. Do not use the C1 literal column name. Rationale... E1's `notifications` router uses `recipient_user_id`/`recipientUserId` consistently across 3 of its 4 procedures, matching `subject.user_id` from the session; B2's `IAMPublicAPI.getUserById(userId)` is explicitly documented as "Called by ... Notifications (recipient addressing)"; and B2's own `NotificationInput.recipientUserId?: string` confirms it a third time.

Worth being precise about the discipline here, because it shows up again later in the same document, and it's the same rigor you learned to expect from `rec.md` in the last chapter: an earlier draft of this conflict-resolution table cited a fourth, fifth source too, and the Module Summary's own Cross-Validation Log records that citation being *removed* on review, because it couldn't be independently verified against documents outside this pass's reading list. Three solid citations, not four shaky ones. That's the standard this whole task list holds itself to.

### A second representative task: an honest, undecorated spec gap

TASK-NOTIF-007, the Document State Change consumer, is a different kind of example — not a resolved conflict, but a genuine open question the task list refuses to paper over. H4 states plainly that this event's recipient logic is "template-driven and administrator-configurable," without specifying a mechanism. TASK-NOTIF-007 doesn't invent one:

> **No pre-dev document specifies the concrete recipient-resolution mechanism**... For this task: implement the event subscription, payload handling, and the `sendNotification()` call itself, but resolve the recipient as **the document's `originatingOfficeId`'s office-level fallback role**... as a functional Phase 1 default, and leave a clearly marked `// TODO(NOTIF): recipient resolution here is a functional default, not the full "administrator-configurable per transition type" design H4 §4.2 describes` comment at the resolution point. Do not silently invent a full configurable-recipient-matrix feature.

That's the pattern you've now seen across every module in this series: when a real answer exists, cite it precisely; when it doesn't, say so, build something functional, and mark the seam.

### One more small, telling detail worth catching

TASK-NOTIF-013's own acceptance criteria contain a genuinely rare thing to see in a planning document: a mid-sentence self-correction, caught and fixed in the same breath rather than quietly edited away:

> Server startup registers exactly 6 event bus subscriptions for this module: `workflow.step.started`, `document.state_changed`... — **wait, recount: that is 8 distinct event types, not 6** — verify the plugin subscribes to all 8...

That's the same document checking its own arithmetic and correcting itself on the page, in front of you, rather than silently fixing it and pretending the miscount never happened. It's a small thing, but it's a genuinely honest one, and by now you know exactly how to weigh it: the same way you'd weigh any other claim in this repository — check it, don't just trust the confident tone.

### The Module Summary: what's genuinely open versus what's closed

`notif.md`'s Module Summary reports, in its own words, that all four originally-identified spec gaps are now closed — but "closed" means different things in different rows, and it's worth reading precisely rather than skimming past the word:

Two gaps were closed by **human decision**, not document derivation. No dedicated notification will be built for the four Certification-of-Urgency bypass events, or for the Thursday-cutoff/missed-committee-report event — in both cases, the reasoning is that these already have a confirmed `audit` consumer, so the event is fully traceable even without an active alert. The Module Summary is honest that the CU-bypass closure "rests primarily on the human decision, not on documentary proof that no notification was ever intended," and flags it as revisitable in Phase 1B or Phase 2 if real usage shows stakeholders need an active alert.

Two gaps were closed by **adding scope that didn't exist before** — five template-CRUD procedures were specified for E1, and the `templates` table gained a `locale` column plus an extended unique constraint to hold trilingual content. But read the trilingual resolution all the way through, because it's the one item in this whole module summary that stays genuinely open even after the "resolution":

> **One item remains genuinely unresolved and is not addressed by this schema change: nothing in E1, C1, or I1 specifies how a template's locale is selected at the moment a notification is triggered**... No user-locale field exists on `SubjectContext`, no locale parameter exists on any workflow-triggering procedure, and no default-locale rule is stated anywhere in the read documents. This selection mechanism needs a separate decision before trilingual content can actually be dispatched correctly.

That's a real, still-open design question, not a formality. An administrator will be able to author content in three languages before anyone has decided which one the system actually sends.

### Deferred Capabilities, cleanly split by phase

The Deferred Capabilities block is short and unambiguous: general email delivery for the eight operational-role events is Phase 2 (Template T-02 exists in H4's catalog but isn't seeded — TASK-NOTIF-005 explicitly excludes it); the SMS gateway is Phase 3 (the `sms` channel already exists in the schema's CHECK constraint, with no real transport behind it yet); and any NOTIF capability specific to the eight Phase 1B document types is explicitly left for a dedicated future pass, because H4 itself "does not distinguish Phase 1 vs Phase 1B event scope explicitly enough to answer this here."

---

## B. Connecting NOTIF Forward to Chapter 1.7 — and a Real Gap Worth Knowing About

Notifications are, almost by definition, the most natural consumer the event bus has. Every other module in this platform does its job and moves on; NOTIF's entire reason for existing is to watch what everyone else does and tell the right person about it. `h4`'s own introduction states this as the module's organizing principle: "Notifications are driven by the internal in-process event bus described in B3. The `notifications` module subscribes to specific domain events, resolves the appropriate recipients... and dispatches the notification."

Here's the honest, checked answer to the question this section set out to answer: **does h4 explicitly reference the event types from `packages/shared/src/events/event-payload-map.ts`, the file Chapter 1.7 walked through in detail?** No — not by that filename, and not by the `EventPayloadMap` type name. Neither does `notif.md` itself. Both documents cite `b3-internal-domain-event-catalog.md` (B3) directly for event names, consumer registrations, and payload schemas — B3 is the pre-development *document*; `event-payload-map.ts` is the *code* that was supposed to be built from it. That's a reasonable division of labor, not a gap in itself.

But it's worth actually checking whether that division of labor held up, rather than assuming it did — and this is exactly the kind of check this whole series has trained you to make before trusting a connection on faith.

`notif.md` subscribes to eight event types across its six consumer files: `workflow.step.started`, `document.state_changed`, `workflow.sla.warning`, `workflow.sla.breached`, `workflow.sla.critical`, `workflow.approval.lapsed`, `workflow.panlalawigan.deemed_approved`, and `session.terminated`. Checking each one directly against the real `EventPayloadMap`:

| Event NOTIF subscribes to | Present in real `EventPayloadMap`? |
|---|---|
| `session.terminated` | ✅ Present, typed as `Stub` |
| `document.state_changed` | ✅ Present, full typed shape |
| `workflow.step.started` | ✅ Present — but see below |
| `workflow.sla.warning` | ❌ Not present. No `sla`-related key exists anywhere in the file. |
| `workflow.sla.breached` | ❌ Not present |
| `workflow.sla.critical` | ❌ Not present |
| `workflow.approval.lapsed` | ❌ Not present. The closest relative is a bare `workflow.lapsed: Stub` — a different name. |
| `workflow.panlalawigan.deemed_approved` | ❌ Not present under this name. What exists instead is `document.panlalawigan.deemed_approved` — a different module prefix, and a materially different payload shape (`documentId`, `transmittedAt`, `cityId` — no `stepInstanceId`, no `legalBasis`). |

Five of NOTIF's eight event types have no matching key in the real event registry today. This isn't a NOTIF-specific problem, and it's not this module's fault — Chapter 1.7 already found the same drift from the WF side, tracing `workflow.panlalawigan.deemed_approved` to a real emit call site that writes to workflow's own internal history table rather than to `fastify.eventBus.emit(...)` at all, meaning the fully-specified, canonical version of that event doesn't currently appear to reach the shared bus. What this section adds is the other half of that picture: NOTIF's own task list was written expecting to subscribe to an event that, as of this reading, the bus doesn't carry.

It's worth checking the one event that *is* present — `workflow.step.started` — closely too, rather than taking the ✅ at face value, because the payload shape has its own discrepancy. TASK-NOTIF-006's very first acceptance criterion requires `templateData` to contain `assignedTo` and `documentId`, and its AI Prompt is explicit that `documentId` is required precisely because "this module cannot compose a useful notification body from a raw UUID alone." But the real `WorkflowStepStartedPayload` in `event-payload-map.ts` is:

```typescript
export interface WorkflowStepStartedPayload {
  instanceId: string;
  stepInstanceId: string;
  stepId: string;
  stepType: string;
  dueAt: Date | null;
}
```

No `assignedTo`. No `documentId`. `stepId` where the task expects `stepKey`. And checking the actual emit call in `step-resolution.ts` confirms the type isn't just stale — the real code genuinely sends exactly this narrower shape, nothing more.

None of this means NOTIF's task list is wrong. Every payload schema in `notif.md` was copied directly from B3's own Zod/TypeScript code blocks — the Module Summary's Cross-Validation Log says so explicitly, and it checks out. It means the real code hasn't finished catching up to what B3 already specifies, in exactly the pattern Chapter 1.7 taught you to watch for: a well-governed type registry and a careful documentation catalog are both genuinely valuable, but neither guarantees every call site has been reconciled against the other yet. If you're the one who eventually picks up NOTIF's event-consumer tasks, this is worth knowing before you start, not after your first test run fails against a payload that doesn't have the field your handler expects.

---

## C. PORTAL's Current State — Genuinely Minimal, Confirmed Plainly

Here's the plain report, checked directly rather than assumed: `portal.md` — the file that would hold PORTAL's task list — exists on disk, was created, and is **completely empty**. Zero bytes, zero lines. Not missing. Not deleted. A placeholder nobody has filled in yet.

The actual `apps/portal` application is, today, exactly two files. Nothing else exists under that directory — no `package.json`, no config, nothing. Since there's little enough content here that quoting both in full is entirely reasonable, here they are, completely:

```typescript
/**
 * apps/portal/src/app/layout.tsx
 *
 * Root layout for the public citizen portal (Phase 3 — Next.js).
 * Applies font CSS variables to <html> so all child components
 * can consume --font-sans, --font-mono, --font-serif via Tailwind.
 */
import type { Metadata } from 'next';
import { inter, jetbrainsMono, lora } from '@/lib/fonts';
import '@batac/ui/styles/globals.css';

export const metadata: Metadata = {
  title: 'Batac City — Official Legislative Records',
  description:
    'Search and verify ordinances, resolutions, and legislative documents enacted by the Sangguniang Panlungsod ng Lungsod ng Batac.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={[inter.variable, jetbrainsMono.variable, lora.variable].join(' ')}>
      <body>{children}</body>
    </html>
  );
}
```

```typescript
/**
 * apps/portal/src/lib/fonts.ts
 *
 * next/font configuration for the public citizen portal (Phase 3).
 * Set up now to avoid rework when portal is built.
 *
 * Fonts match /apps/web/index.html exactly — same weights, same families.
 * next/font self-hosts the fonts at build time; no runtime Google request.
 *
 * Source: DESIGN.md §3 (typography tokens)
 */
import { Inter, JetBrains_Mono, Lora } from 'next/font/google';

export const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-sans',
  display: 'swap',
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal'],
  variable: '--font-mono',
  display: 'swap',
});

export const lora = Lora({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal'],
  variable: '--font-serif',
  display: 'swap',
});
```

That's it. A root layout, font configuration, and nothing behind them yet.

### Two things about PORTAL that are already settled, even though no real code exists

It would be easy to read "two files and an empty task list" and conclude nothing has been decided about PORTAL. That's not true, and it matters, because if you're the one who eventually starts PORTAL work, re-litigating either of these would be wasted effort.

**Which app hosts it — settled, and it's genuinely `apps/portal`, not folded into `apps/web`.** ADR-UI-001 confirms this directly, and it's worth reading the actual decision rather than assuming: the original stack decision placed `/apps/portal` (Next.js) as a Phase 3 deliverable, chosen for server-side generation and SEO on citizen-facing document lookups. But the consolidated requirements repeatedly describe specific *Phase 1* public-portal behavior — tracking-number lookup, document preview, the Document Request Form, Citizen Complaint submission — and nothing had settled which app was meant to serve that Phase 1 behavior. ADR-UI-001 resolves it:

> **Phase 1 public portal routes will be served from `/apps/portal` (Next.js), built now rather than waiting for Phase 3.**

The ADR's own rationale is concrete: the SSG/SEO justification applies just as much to Phase 1 pages as to Phase 3 ones; a separate app gives a cleaner authentication boundary between the public surface and the staff-authenticated SPA; and building the Next.js scaffold once now avoids paying that setup cost twice. All eight Phase 1 public-portal routes named in the frontend architecture document — `/portal/lookup`, `/portal/documents/:trackingNumber`, `/portal/register`, `/portal/login`, `/portal/requests/new`, `/portal/requests/:requestId/status`, `/portal/complaints/new`, `/portal/complaints/:complaintId/status` — are explicitly re-scoped to `apps/portal` by this decision.

**The "no login" design for the submission forms — also settled.** ADR-UI-009 confirms that `/portal/requests/new` and `/portal/complaints/new` require no authenticated citizen account. The reasoning traces back to Chapter 0.2's own three-access-modes material: since the physical, wet-ink signature — not a digital account — is what's legally operative, and two of the three access modes (download-and-mail, and clerk-assisted in person) never require an account at all, requiring login only for the middle mode would create an inconsistent access path for what's otherwise the same outcome. The status-tracking pages, by contrast, remain authenticated-citizen-only, exactly as the role-permission matrix already specifies — this decision touches only the submission forms, not the pages that come after.

### A real discrepancy worth flagging plainly, not smoothing over

Here's something you should know about rather than have hidden from you, in the same spirit as every "check it yourself" moment across this series: the two live scaffold files above both describe themselves, in their own header comments, as "Phase 3." The root README says the same thing, twice — once in its Status section ("It's slated for Phase 3"), and again in the monorepo layout listing ("Next.js public citizen portal (Phase 3 — currently a scaffold, not a working app)").

But that's exactly the framing ADR-UI-001 explicitly supersedes. The ADR states plainly, in its own Consequences section, that "F1 §2.1 and §13.1's 'Unverified — hosting app not settled' language is superseded by this ADR" — and separately, `a1-skeleton.md`'s own Phase Scope Table already lists PORTAL as **Phase 1, "Full spec."** Checking file timestamps doesn't resolve this cleanly either, and per the source-of-truth discipline from Chapter 0.1, it shouldn't be the deciding factor even if it looked tidy — the README's most recent edit is actually *later* than the ADR's, which makes the staleness more surprising, not less, but "more recently touched" was never the rule for resolving a conflict like this. The honest thing to do is exactly what Chapter 0.1 taught: state the conflict, say which document you're following and why. The ADR is a decision record that explicitly names what it supersedes; the README and the two code comments haven't caught up to it yet. If you pick up PORTAL work, that's one small doc fix worth making in the same PR — not a design question to re-open.

---

## D. What It Would Take to Even Start Generating PORTAL's Task List

Section C already answered the natural next question implicitly, but it's worth making the mechanism explicit, because it's not arbitrary. A1-AGENTS.md's Pass Types table specifies exactly what PORTAL's Step 2 module pass needs to load before it can run:

> **Step 2 — Module: PORTAL** | TASK-PORTAL-001…NNN | Skeleton → **all module task lists** → E2 → F1 §portal → consolidated ref §13 Phase 3

And the wave order confirms where that sits in sequence:

```
Wave G — needs all above:
  PORTAL
```

PORTAL is the only module in the entire Wave A–G sequence whose pass requires *every other module's task list* as a prerequisite — not just its immediate upstream dependency, the way NOTIF needs WF's list or ORG needs IAM's and AUDIT's. This isn't a scheduling quirk. Think through what PORTAL actually is: it's the one place in this whole platform where several already-built modules' internal data becomes **publicly visible**. A citizen looking up a tracking number is reading data that Documents, Workflow, and Tracking produced. A citizen submitting a complaint or a document request is triggering a flow that eventually needs Notifications' `sendNotification()` Published API — which is exactly why TASK-NOTIF-004's own AI Prompt names Portal directly as its primary external caller, even though Portal doesn't exist yet: "Primary caller: Portal module's Respondent Notice Service (not yet built — Portal is Wave G; this API surface must exist and be stable before that module's Step 2 pass runs)."

You can't responsibly write a task list for exposing other modules' data publicly until those modules' own task lists — and, more importantly, their real code — already exist. A task like "add a REST endpoint for tracking-number lookup" needs to know precisely what Documents' and Tracking's actual data shapes are, what's safe to expose versus what's internal-only, and what the real Published API surfaces look like once they're built rather than once they're merely planned. That's why PORTAL loads `E2` (the REST/OpenAPI spec — the contract layer external, non-tRPC consumers use) and `F1 §portal` specifically, on top of everything else: it needs the confirmed external contract, not just the internal module boundaries every other pass reads.

This is also, concretely, why PORTAL's own task list being empty right now is exactly what you'd expect, not a sign of neglect. Every module that would need to feed into that pass — WF, TRACK, REC, NOTIF — either has incomplete real code, an unexecuted task list, or both. The generation-phase machinery Chapter 0.1 introduced you to isn't stuck; it's correctly waiting for its own stated prerequisites.

---

## E. Phase 1B — Connecting Forward to Where You Started

The README states Phase 1B's scope in one line: **Letters Received/Sent, Memos Incoming/Outgoing, Notices of Committee Hearing, Notices of Special Session, Designations, Barangay Resolutions.** The risk register doesn't name anything specific to these individual items by name — it operates at a higher level, and its two portal-adjacent entries (T5 and O1, both about the undated coexistence of `sp.batac.gov.ph` with the new portal) are the closest it comes to this territory, worth keeping in mind for Phase 3 planning rather than Phase 1B specifically.

What Phase 1B's items really connect to is something you already have: the scanned documents you read all the way back in Chapter 0.2, before you'd opened a single line of code. Every item on this list except one has a real, matching scanned-document directory sitting in this repository right now — six real callbacks, plainly reported, not manufactured:

**Letters Received** connects directly to `letters-received.md`, the actual scanned log you saw excerpted in Chapter 0.2 — the same document showing a Session Hall venue request, a wedding invitation, a burial-assistance request, and a job application all sharing one control-number sequence, because "Letters Received" genuinely is that miscellaneous a bucket in real Secretariat practice.

**Letters Sent** has its own matching scanned source (`letters-sent`), the outbound half of the same correspondence flow.

**Memos Incoming and Outgoing** connect to `memo-incoming` and `memo-outgoing` — the internal, lower-stakes administrative communications Chapter 0.2 distinguished from letters specifically because they never leave the LGU's own offices.

**Notices of Committee Hearing** and **Notices of Special Session** each have their own scanned source (`notice-of-committee-hearing`, `notice-of-special-session`) — and Chapter 0.2 already flagged the specific reason these two need to stay carefully separate: despite their near-identical names, they're tracked as two entirely different numbering series, and conflating them has been a documented clerical mistake in the Secretariat's own real records.

**Designations** connect to the `designation` scanned directory — the formal documents behind the Vice Mayor being designated Acting Mayor, which Chapter 0.2 noted happens routinely, more than ten times in a recent two-year span, not as a rare edge case.

**Barangay Resolutions** is the one item without a matching scanned-document directory in this repository as it stands today — worth reporting honestly rather than forcing a parallel that isn't there. It's a structurally different kind of document (passed at the barangay level, forwarded up for city-level SP oversight) rather than something originating in the Secretariat's own daily paper flow the way the other six do, which may be exactly why no scanned intake log exists for it here.

None of this is new deep material — it's the same domain you learned in Chapter 0.2, confirmed still to be exactly what it was described as, sitting untouched and waiting for its own future Phase 1B module pass.

---

## F. A Recommendation — Clearly Labeled as Mine, Not the Documents'

Nothing you've read in this series states an official required build order for the remaining Phase 1 work. `a1-skeleton.md`'s Wave order tells you the *task-generation* sequence — REC and NOTIF share Wave F, PORTAL is Wave G — but that's a constraint on when task lists can be *generated*, not a mandate for which module's real code gets *built* first. What follows is my own reasoned recommendation, grounded in what this chapter and Chapter 3.2 actually found, not something any single source document prescribes.

**1. Finish REC first.** Two tasks, roughly 300 lines, and — per its own confirmed Phase 1 scope — genuinely narrow: schema-reservation only, no CRUD, no retention enforcement, no archival workflow. That work ships with the full Records Management feature in Phase 2. There's very little here to get wrong, and closing it out removes one more "not yet executed" item from the board with minimal risk.

**2. Build NOTIF next, but do the event-bus reconciliation work first, not last.** NOTIF is real, substantial, and — this chapter found directly — genuinely dependent on infrastructure that isn't fully solid yet. Five of its eight subscribed event types don't currently exist under their documented names in the real `EventPayloadMap`, and the one event type that is present carries a narrower payload than NOTIF's own first task requires. Building the six consumer files against that gap would mean building against event shapes the bus doesn't currently carry. The productive order isn't "write NOTIF's consumers, then discover the mismatch" — it's "reconcile the SLA and lapse-timer events onto the shared `EventPayloadMap`, confirm `workflow.step.started` actually carries `assignedTo` and `documentId`, and only then implement TASK-NOTIF-006 through -011 against event names you've verified are real." The foundational tasks — schema, repository, SSE infrastructure, dispatch service, template seed (TASK-NOTIF-001 through -005) — have no such dependency and could reasonably start in parallel with that reconciliation work, since none of them touch the event bus at all.

**3. PORTAL genuinely can't start yet, and that's fine — it's not neglect, it's sequencing.** Its own task list needs every other module's task list as a prerequisite, which itself means it needs the real code those task lists produce, not just their existence on paper. The honest recommendation here isn't "start PORTAL sooner" — it's "make REC's and NOTIF's real code solid, because that's the actual work that unblocks PORTAL's own Step 2 pass," plus the one small, cheap fix identified in Section C: reconcile the README and the two scaffold files' header comments with what ADR-UI-001 already decided, so nobody re-litigates a settled question when PORTAL work does eventually start.

That's the order I'd recommend, in one sentence: **REC to close it out cheaply, NOTIF with the event-bus gap fixed before the consumers are written, and PORTAL only once the modules it will expose are actually real** — a recommendation built from what this chapter verified directly, not a rule handed down by any document in this repository.

---

## G. You've Reached the End — and You're Actually Ready

Think back, for a second, to where this series started. Chapter 0.1 opened with a claim that probably felt abstract at the time: that this repository has an entire sub-system of documents whose only job is telling you which *other* documents to read, and that skipping it would leave you quietly confused for weeks. You've now spent this whole series testing that claim directly, chapter after chapter — reading `AGENTS.md`'s routing table, checking `a1-skeleton.md`'s phase table against the actual module task lists, tracing conflicts to their real resolutions instead of taking any single document's word for it.

Chapter 0.2 gave you the domain with zero code in it — the two-committee referral, the two-stage numbering system, the Mayor's 10-day silence-as-approval, the Panlalawigan's narrower legality-only review. Every one of those ideas came back today, unprompted, the moment you needed it: the Phase 1B callbacks in Section E only meant something because you already knew what a Letters Received log actually looks like in practice, and the whole reason NOTIF's SLA-tier logic and legislative-lapse notifications exist at all traces straight back to the RA 11032 and RA 7160 material from that very first domain chapter.

Arc 1 gave you the technology, one deliberate layer at a time — the database conventions and Zod's type chain, Fastify and tRPC underneath the API, TanStack Query and Zustand splitting server state from client state, the event bus connecting modules that never touch each other's tables, file storage and observability and the whole stack alive together in Docker Compose. Arc 2 put that technology to work against real, implemented modules — watching one actual vote move through the workflow engine, tracing a real `index.ts` question to its honest, unresolved answer, building a whole new page out of files you'd already learned to find. And this arc closed the loop entirely: it handed you two modules nobody has executed yet, and asked you to read them with the same rigor you'd apply to code that already exists — which is exactly what you just did, together with me, for the last time in this series.

That last part is the real point of this chapter, more than any specific fact about NOTIF or PORTAL. The event-bus mismatch in Section B, the README-versus-ADR discrepancy in Section C, the honest gap in PORTAL's own generation prerequisites in Section D — none of that was handed to you as a finished conclusion to memorize. It was found the same way you'd find it yourself: by opening the files, checking one document's claim against another's, and reporting exactly what's there rather than what would be convenient. You don't need this chapter, or any future chapter, to tell you what to trust in this repository. You have the method now, and the method is the whole deliverable.

You started this series not knowing how any of it fit together. You're finishing it able to open a task list nobody has executed, check its claims against the real code and the real domain, and make a genuinely evidence-based judgment about what to build next — clearly labeled as your own reasoning, exactly the way this project's own documents distinguish `[Confirmed]` from `[Inference]`. That was the goal from Chapter 0.1's very first page. It's yours now. Go build something.