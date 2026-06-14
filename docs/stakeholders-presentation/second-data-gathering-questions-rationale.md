**A note on sourcing:** Q-01 through Q-04 each have a "Developer note" in the document that states the stakes directly — those four summaries are drawn straight from that text, so you can check them against the source. Q-05 through Q-19 have no such note. For those, the explanation below connects each question to other sections of the same document (often the document's own cross-references to "Q-INT-XX"), but the _architectural implication_ I'm drawing from that connection is my own reasoning, not something the document states outright. Each of those is marked **[Inference]**.

---

### 14.1 — Priority 1: Critical (blocks schema design or core workflow engine)

All three items here carry the document's own framing: the relevant table or engine behavior cannot be designed in a stable form until these are answered.

#### Q-01 — Preliminary vs. Final Series Number

The Developer note lays out two competing designs for the `document_numbers` table. One treats "preliminary number" as just another name for the QR tracking ID / control number that already exists in the design — no new column needed. The other treats it as a genuinely separate `7SP`-format identifier printed on draft documents, which would require a nullable `preliminary_number` column alongside a non-nullable `final_number` column. Since this table underpins the entire SP Resolution/Ordinance numbering system — the centerpiece of Phase 1 — the column structure has to be right before records start being created against it.

#### Q-02 — QR Code Assignment Timing

There's a direct conflict in the source material: interview notes say QR codes are attached "at draft stage," while the recommended architecture (11.6) assigns the QR at secretariat formal intake. The Developer note explains that if the real answer is "at physical receipt, before system logging," the architecture needs to support QR codes generated offline (e.g., printed by a Councilor's staff) and later synced to a system record — a different `tracking.tracking_records` schema plus an offline-sync flow. If the current assumption holds, none of that is needed. Since DTS is built around QR assignment and is a Phase 1 module, this determines whether an entire offline-generation capability has to be designed in from day one.

#### Q-03 — Mayor's Review of SP Resolutions (10-Day Lapse Rule)

The Developer note explains that the Mayor-signature step in the SP Resolution workflow has two fundamentally different possible shapes depending on the answer: a timed step with an automatic "Lapsed into Law" transition (if the rule applies to Resolutions, like it does for Ordinances), or an open-ended step that waits indefinitely for the Mayor to sign or veto. Since "Mayor signature" is one of the legally-mandated minimum steps for SP Resolutions (11.3's hardcoded constraints table), and the timing of that step also affects when the final series number gets assigned, the SLA/step-type configuration needs to be built one way or the other before the workflow engine schema is finalized.

---

### 14.2 — Priority 2: High (needed before Phase 1 development begins)

#### Q-04 — Multi-Committee Referral: Workflow Design Confirmation

**[Inference]** Part 8 already frames this as a "Key Architectural Finding" and states outright that the decision "must be made before the workflow engine schema is designed." Q-04's specific question — does the `multi_referral` step (Option B from Part 8) complete when the first committee reports, or only once all assigned committees report — determines the step-completion trigger for that step type. Because "most measures are referred to two committees simultaneously" (Part 6), this isn't an edge case for either Phase 1 deliverable — it's the default path every SP Resolution and Ordinance will take.

#### Q-05 — Certified Urgent Measures: Authorization Rules

**[Inference]** Part 11.3 already records the Phase 1 decision: store a "certified urgent" flag in the data model, keep committee referral mandatory for everyone, and defer the actual bypass branch to Phase 1B "after authorization rules are confirmed." But the SP Resolution/Ordinance step-graphs being built _now_, in Phase 1, are what that future branch will eventually attach to. Without at least a basic read on who can declare a measure urgent and for which document types, there's a risk the Phase 1 step-graph doesn't leave a clean attachment point — which would turn the Phase 1B addition into a structural change rather than an extension.

#### Q-06 — Phase 1 Scope Confirmation with SP Secretary

**[Inference]** Part 2's scope decision — Phase 1 covers SP Resolutions and Ordinances only — is explicitly attributed to "interview findings and stakeholder framing," specifically a Records Officer's comment and a general value statement (Part 7.1). Neither is directly attributed to the SP Secretary, who is the primary day-to-day user of the modules being built (the "SP Secretary dashboard" is a named Phase 1 deliverable). Part 2 itself flags "Scope confirmation required in next interview" with suggested wording. This question closes that gap before months of development are committed to a scope the office it's built around hasn't directly confirmed.

#### Q-07 — Designation: Authority Transfer Edge Cases

**[Inference]** Section 11.13 revises an earlier assumption: delegation via Designation documents isn't an occasional edge case but a "routine, high-frequency operation" (10+ Acting Mayor designations per year), and "must be designed as a first-class workflow feature." It explicitly lists "multiple active delegations" as unresolved and points to this question. Because `delegation_grant` records directly drive how the engine resolves step assignees — steps that would normally route to "Mayor" or "SP Secretary" get automatically reassigned to the designated person — the assignee-resolution logic that the Phase 1 SP Resolution/Ordinance workflows depend on needs to account for these edge cases from the start, not as a later patch to a core mechanism.

---

### 14.3 — Priority 3: Medium (needed before Phase 1 deployment / during development)

#### Q-08 — OCR Processing Policy

**[Inference]** Section 7.4 says full-text search across all documents, with all documents OCR-processed, "is desired," and flags the policy itself (automatic vs. manual, historical vs. new-only, failure handling) as unresolved. Phase 1's search is PostgreSQL FTS over stored text, but the LMITS historical migration (a Phase 1-adjacent activity per 7.3) will bring in scanned material with no extractable text unless OCR'd. The answer determines whether some OCR capability needs to be pulled forward from its Phase 4 slot, and how the migration pipeline should be built — which is why it matters during development even if it doesn't gate the initial schema.

#### Q-09 — Sangguniang Panlalawigan 30-Day Timer: Operational Confirmation

**[Inference]** Part 4.3 already specifies detailed automated behavior: an auto-tracked 30-day timer that transitions to "Deemed Approved" on silence, and a three-option flow for VALID-IN-PART outcomes, with the document itself noting that whether re-voting on invalid provisions matches "the SP's actual practice requires confirmation." This question checks the designed behavior against how the Secretariat actually operates — for instance, if the 30-day-no-action scenario "sometimes goes unnoticed" today, the system's automated notification is introducing a new capability rather than digitizing an existing one, which affects how prominently it needs to surface.

#### Q-10 — LMITS Migration: Scope and Format

**[Inference]** Section 7.4 confirms LMITS migration is required but its scope is "partially unresolved," noting LMITS "stored document titles only" while the Index of Ordinances (5.3) requires many more fields. Without knowing what fields actually exist in LMITS, what format the data is in, and whether CPDO — the office that managed it — still has access to extract it, the migration scripts can't be scoped or scheduled. This affects effort and timeline for the historical-records migration called out in 7.3.

#### Q-11 — Newspaper Publication Requirements

**[Inference]** Both 4.1 and 4.2 flag publication requirements as unresolved, and 5.3 lists "Publication" as a field the system must track for every ordinance. Both the SP Ordinance and SP Resolution flowcharts include a "Publication if required" step sitting just before Records archiving and Public Portal publication — both Phase 1 deliverables. The answer determines whether that step is enforced (with its own assignee and SLA, per the "who is responsible" sub-question) and can hold a document back from "Archived"/"Published," or whether it's just an optional metadata field recorded after the fact. Getting it wrong either stalls documents on a step nobody owns, or lets documents reach "Published" without a legally-required publication having happened.

#### Q-12 — Hearing Schedule: Input Rules

**[Inference]** The question is framed around enabling automatic NCH generation from the committee referral step — itself a Phase 2 item (Part 13) — but the referral step (`multi_referral`) it attaches to is a Phase 1 deliverable (Part 8/11.3). If the hearing-date field needs to exist on that step instance for Phase 2's auto-NCH feature, it's cheaper to include it (even unused) in the Phase 1 schema than to add it later. The "who can write this date" sub-question also has permission implications — Secretariat-only access is a different shape than giving committee chairs write access to a workflow step field.

#### Q-13 — NCH vs. NOSP Prefix Ambiguity

**[Inference]** Parts 4.11 and 5.1 both flag this as open due to a historical inconsistency (NOSP briefly in 2023, NCH afterward). Part 5.2's general rule is a separate sequence per document type per year, but Notice of Special Session is a borderline case — its own document type, or a variant sharing NCH's sequence? Since Notice of Special Session is a Phase 1B document type (Part 2), the relevant `number_series` record needs to be correct before Phase 1B goes live, but doesn't gate the Phase 1 schema.

#### Q-14 — Ordinance Effectiveness and Panlalawigan RETURNED Handling

**[Inference]** Part 4.2 confirms an ordinance takes effect immediately on Mayor signature, with Panlalawigan review happening afterward as "post-implementation oversight" — so a RETURNED outcome can land on an ordinance that's already in effect and possibly being implemented. Part 4.3's current system response to RETURNED is a high-priority alert plus a manual-review state. This question checks whether that's sufficient, or whether real practice involves additional formal steps (e.g., notifying the implementing department to pause) that should be modeled explicitly. Since RETURNED is one outcome among several the Phase 1 Ordinance workflow must already handle, and a manual-review fallback exists, this can be refined during development.

---

### 14.4 — Priority 4: Low (can be clarified during Phase 1B or Phase 2)

#### Q-15 — Memos Incoming/Outgoing Counter Independence

**[Inference]** Parts 4.6 and 4.7 already describe separate `{YEAR}-{NN}` counters for Memos versus Letters, and 4.7 even marks its distinguishing rule "[Confirmed by documentary evidence]." That Q-15 still asks for "explicit confirmation" suggests those earlier confirmations were inferred from scanned logs rather than stated directly by a stakeholder. Since Memos Incoming/Outgoing are Phase 1B document types (Part 2), getting the `number_series` configuration exactly right for them only needs to happen before Phase 1B, not before Phase 1 begins.

#### Q-16 — Franchise Ordinance: Workflow and Committee Assignment

**[Inference]** Part 4.2 confirms Franchise Ordinances "follow the same legislative workflow" as regular ordinances, differing only in numbering series. But the question notes the Panlalawigan reviewed 178 franchise ordinances in a single batch, and Part 3.3 shows the SP Secretariat has a distinct "Franchise Section" with several dedicated staff — both hinting at operationally different handling than the standard path. If franchise ordinances are in practice batch-processed or referred to a dedicated committee rather than the standard subject-committee-plus-Committee-on-Laws pairing, the Phase 1 SP Ordinance workflow definition may need a variant. This is low priority because the core (regular/appropriation) Ordinance workflow can be built first, with franchise-specific handling layered on once that foundation exists.

#### Q-17 — sp.batac.gov.ph Data Migration Scope

**[Inference]** Section 7.4 already notes that data which "can be easily generated from source documents does not need migration" for sp.batac.gov.ph, with the decision "deferred." This question operationalizes that — does the old site hold anything not recoverable from LMITS or the uploaded documents, and is there a go-live task to formally retire or redirect it. Since the site is already down and the Phase 1 portal subset (track-by-number + published documents) doesn't depend on it, this only needs answering before the migration/launch checklist is finalized.

#### Q-18 — Vice Mayor's Letter Review: Categorical Rules

**[Inference]** Part 4.8 explicitly states the routing rules for which letters require VM review versus going straight to the action queue are "to be confirmed in next interview." Letters Received is a Phase 1B document type, and its workflow's "decision" step needs concrete branching conditions before it can be configured — without these rules, the decision step has nothing to evaluate. Since Letters Received doesn't go live until Phase 1B, this can be settled during Phase 1B preparation.

#### Q-19 — In-Flight Documents at Administration Change: Confirmation

**[Inference]** Sections 11.3 and 11.13 already record the design: in-flight documents are reassigned to the incoming Mayor via office-level fallback rules, labeled "Inherited from prior administration," with no automatic cancellation or hold. This question checks that design against actual practice — whether the incoming administration simply continues acting on inherited items as designed, or whether real practice involves a more formal handover (e.g., a transition list) the system should support. Part 13 lists "Election-cycle bulk reassignment" as a Phase 2 feature, which is presumably where any refinements from this answer would land.

---

**[Inference]** Stepping back, the nineteen items cluster into a few recurring kinds of "why": Q-01, Q-02, Q-13, and Q-15 are about the shape of a numbering/tracking table that's costly to change once records exist; Q-03, Q-04, Q-05, Q-09, Q-11, Q-12, Q-14, Q-16, Q-18, and Q-19 are about how a workflow-engine mechanism — step completion, SLA timers, branching, assignee resolution — should behave for every document that passes through it; Q-08, Q-10, and Q-17 are migration scope/effort questions; and Q-06/Q-07 are closer to risk-mitigation, confirming the foundational scope and delegation model with the people most directly affected before either gets built around.