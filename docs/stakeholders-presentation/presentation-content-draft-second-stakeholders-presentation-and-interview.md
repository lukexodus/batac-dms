# Discovery Review and Design Alignment

**Batac City LGU Platform — Second Stakeholder Meeting | June 2026**

> Design system note (for builder): Continue with the established design system. Primary green: #06943d / #109f3c. Secondary blue: #0046e4. Light mode, modern and readable. Header-only topbar (as in previous presentation). Topbar left: "SP Office — Batac City" | Topbar right: "Discovery Review & Design Alignment". No footer. But has a small overlay of the page number / total at the bottom right.

---

## Slide 01 — Title

> Layout: Hero/minimal — large centered title, supporting metadata below

**Discovery Review and Design Alignment** Second Stakeholder Meeting

Sangguniang Panlungsod — Batac City, Ilocos Norte Batac City LGU Platform June 2026

---

## Slide 02 — Today's Agenda

> Layout: Minimal — three numbered items, generous whitespace

This meeting has three parts:

1. **What we confirmed** from our first meeting — verifying that we understood your processes correctly
2. **How we've designed the system** around those processes — showing our current design decisions
3. **Questions we need your guidance on** — specific points where your answers directly shape how we build the system

---

## Slide 03 — Key Facts We Confirmed from Our First Meeting

> Layout: Card grid (2 columns × 3 rows) — each card is a confirmed fact

**7th Sangguniang Panlungsod — Composition and Voting** 12 members. 7 votes required to pass a measure. 8 votes (2/3 majority) required to override a mayoral veto. No proxy voting.

**Phase 1 Focus** The system will first deliver full digital support for SP Resolutions and SP Ordinances — the documents with the highest public value and the most complex legislative process.

**Panlalawigan Review Covers Both** Both Resolutions and Ordinances are transmitted to the Sangguniang Panlalawigan after the Mayor acts. The 30-day provincial review rule applies to both types.

**Barangay Officials in Phase 1** Barangay officials do not have their own system login in Phase 1. When a barangay submits a document to the SP Secretariat, secretariat staff logs it on their behalf.

**Physical Documents Remain the Legal Source of Truth** Wet-ink signed originals remain the legally binding documents. The system is the operational source of truth — for tracking, routing, status, and retrieval. This is not a paperless initiative.

**Current Tools** LMITS (the previous system) is no longer active. Daily workflow currently relies on physical logbooks and MS Word. Historical records will need to be migrated into the new system.

---

## Slide 04 — Why We're Starting with Legislative Documents

> Layout: Minimal — prominent quote as visual anchor, supporting text below

> "Digitalization is just for convenience so that people do not have to go in person."

This framing from our first meeting directly shaped our Phase 1 decision. The most immediate public value is giving citizens access to approved resolutions and ordinances — without needing to visit City Hall.

**Phase 1 is designed around exactly this:** complete digital lifecycle for SP Resolutions and SP Ordinances, ending with a searchable, downloadable public portal.

> Callout: Does this scope match your expectation? Please let us know during today's discussion.

---

## Slide 05 — Phase 1 vs. Phase 1B: What Goes When

> Layout: Comparison — Left column (Phase 1, green accent), Right column (Phase 1B, neutral)

**Phase 1 — Full End-to-End Lifecycle**

- SP Resolutions — complete process from draft to archive and public portal
- SP Ordinances — same as resolutions, plus the Mayor's 10-day review period
- Franchise Ordinances — same legislative process, separate numbering series
- QR code tracking for all of the above
- Panlalawigan 30-day automated timer
- SP Secretary dashboard and Mayor dashboard
- Public portal for approved legislation

**Phase 1B — Added Shortly After Phase 1**

- Letters Received and Letters Sent
- Memos Incoming and Memos Outgoing
- Notices of Committee Hearing
- Notices of Special Session
- Designations
- Barangay Resolutions
- Citizen Complaints (Transportation)

---

## Slide 06 — What Phase 1 Delivers

> Layout: Numbered list (8 items), each a brief headline + one-line explanation

1. **Full legislative workflow** — from draft submission through all three readings, signing, and archiving
2. **Series number assignment at the right moment** — preliminary number at intake; final official number after the Mayor's signature, never at draft creation
3. **QR code for every document** — unique tracking code assigned at Secretariat intake; every routing movement recorded automatically
4. **Panlalawigan 30-day timer** — system tracks the provincial review period and notifies the SP Secretary automatically; no manual tracking required
5. **Public portal** — citizens search and download approved resolutions and ordinances online, without visiting City Hall
6. **SP Secretary dashboard** — complete work queue: pending items, session calendar, Panlalawigan status at a glance
7. **Mayor dashboard** — all documents awaiting the Mayor's signature, with time remaining shown clearly
8. **Complete audit trail** — every action recorded: who did what, in what capacity, and when; tamper-evident and permanent

---

## Slide 07 — SP Resolution: The Process We've Modeled

> Layout: Visual/SVG — wide horizontal flow diagram (simplified, stakeholder-readable)
> 
> SVG description: A left-to-right horizontal flow with labeled rounded-rectangle boxes connected by arrows. Color-code steps: blue for SP session steps, green for Secretariat steps, gold/amber for external review steps.
> 
> Main flow (top row, left to right): [Draft] → [Secretariat Receives] → [Order of Business] → [1st Reading] → [Committee Referral] → [Committee Report] → [2nd Reading] → [Print Final Copy] → [3rd Reading — Final Vote] → [Vice Mayor Signs] → [Mayor Signs] → [Final No. + Docketing] → [Panlalawigan Review — 30 days] → [Archive & Public Portal]
> 
> Branch indicators (smaller text, dashed arrows):
> 
> - From [1st Reading]: dashed bypass arrow labeled "Certified Urgent" pointing directly to [2nd Reading]
> - From [Committee Referral]: downward exit arrow labeled "Deferred / Archived"
> - From [2nd Reading]: downward exit arrow labeled "Voted Down / Archived"; backward loop arrow labeled "Amendments → Back to Committee"
> - From [Mayor Signs]: downward branch labeled "Veto" leading to small box "Override Vote (8 of 12)" with two exits: "Override Fails → Archived" and "Override Succeeds → Final No."
> 
> Below the diagram: small caption — "Based on the official legislative process flowchart provided during Interview 1. Please tell us if any step or path is missing or incorrect."

---

## Slide 08 — SP Resolution: Key Design Points

> Layout: Card grid (2 columns × 3 rows)

**Preliminary vs. Final Series Number** A series number is assigned when the Secretariat first receives a draft. A final official number is assigned only after the Mayor's signature at the docketing step. These are distinct events — we have a question about this later.

**Third Reading: Final Vote Only** The system will enforce that Third Reading is a vote on the final version. No debates are permitted at this stage; only minor formal amendments are accepted before the vote is called.

**Committee Referral to Two Committees** Most measures go to two committees simultaneously — the subject-matter committee and the Committee on Laws. The system assigns both at the same time. We have a question about how the reports come together — discussed shortly.

**Mayor's Veto and Override** The Mayor may veto a resolution. The system records the veto and opens the override step, which requires 8 of 12 votes. The outcome of the override vote is also recorded.

**Certified Urgent Path** When declared certified urgent, a measure skips committee referral and goes directly to Second Reading. We need your guidance on who can authorize this — addressed in the questions section.

**Panlalawigan Transmission** After the Mayor signs, the Secretariat transmits the resolution to the Sangguniang Panlalawigan. The 30-day review clock starts from the transmission date, tracked automatically by the system.

---

## Slide 09 — SP Ordinance: Same Process, Plus Lapse-into-Law

> Layout: Visual/SVG — two-part illustration
> 
> SVG description: Top portion shows a simplified node sequence (matching the Resolution flow from Slide 07) compressed into a single arrow labeled "Same process as SP Resolution through Third Reading & Vice Mayor signature."
> 
> Bottom portion expands the Mayor's review step into a prominent three-way branch box:
> 
> - Left: [Mayor Signs within 10 days] → "Ordinance takes effect immediately" → continues to Final Number + Docketing
> - Center: [Mayor does not act — Day 11] → amber/orange box: "Lapsed into Law — System auto-notifies SP Secretary" → continues to Final Number + Docketing
> - Right: [Mayor Vetoes] → "Returned to SP — Override vote: 8 of 12" → two exits: "Override Fails → Archived" and "Override Succeeds → Final Number + Docketing"
> 
> After docketing, a single arrow continues to: [Panlalawigan Review — 30 days] → [Archive & Public Portal]
> 
> Below: Two callout boxes — Callout 1 (green): "The ordinance takes effect the moment it is signed — or lapses. Panlalawigan review is provincial oversight after it is already in effect." Callout 2 (blue): "Franchise Ordinances follow this same process but use a separate continuous series: 7SP 0001-26R, 7SP 0002-26R, ..."

---

## Slide 10 — Panlalawigan Review: How the System Handles Each Outcome

> Layout: Card grid (2 columns × 3 rows) — each card is one outcome type

**VALID** Fully approved. The system records the Panlalawigan's resolution number and date, then sends notifications to the relevant offices (CPDO, Budget Office, City Engineer, etc.). Document is archived and published to the public portal.

**VALID-IN-PART** Some provisions were found inconsistent with law. The document is placed in a special queue for the SP Secretary, who selects one of three next actions: (1) Resolve as-is with a mandatory written comment; (2) Refer to City Legal Office for a written opinion; (3) Route back to committee to re-draft the affected provisions.

**RETURNED** The document was disapproved. The system raises a high-priority alert for the SP Secretary, the City Legal Office, and the Mayor's Office, requiring immediate coordinated action. The document status is clearly flagged.

**Referred to Committee** _(Panlalawigan's own committee)_ The 30-day provincial clock continues running. The system tracks and notifies the SP Secretary as the deadline approaches.

**No Panlalawigan Action for 30 Days** On Day 31, the system automatically transitions the status to "Deemed Approved" per Section 56(d) of RA 7160. The SP Secretary receives an immediate notification and confirms the transition. The legal basis is recorded automatically.

**Operative in its Entirety** _(for Appropriation Ordinances)_ Treated the same as VALID. Outcome recorded with the Panlalawigan's resolution number.

---

## Slide 11 — Document Series Numbers: Confirmed Formats

> Layout: Text-heavy with an embedded table and a key rules callout

Based on the documents and logbooks you shared with us, we have confirmed the following number formats. The system will assign and enforce these exactly.

|Document Type|Format|Example|
|---|---|---|
|SP Resolution|`7SP {YEAR}-{NN}`|`7SP 2025-35`|
|SP Ordinance (Regular)|`7SP {YEAR}-{NN}`|`7SP 2025-01`|
|SP Appropriation Ordinance|`7SP {YEAR}-{NN}`|`7SP 2025-02`|
|SP Franchise Ordinance|`7SP {SEQUENCE}-{YY}R`|`7SP 0001-26R`|
|Notice of Committee Hearing|`NCH {YEAR}-{NN}`|`NCH 2025-03`|
|Designation|`D {YEAR}-{NN}`|`D 2024-01`|
|Letters Received|`{YEAR}-{NN}`|`2026-01`|
|Letters Sent|`{YEAR}-{NN}`|`2026-01`|
|Memo Outgoing|`{YEAR}-{NN}`|`2025-01`|
|Memo Incoming|`{YEAR}-{NN}`|`2025-26`|

**Key rules the system will enforce:**

- A number is assigned only at the defined approval or certification step — never when a draft is first created
- Once a number is assigned, it cannot be edited. If an entry is wrong, the record must be deleted and a new one created — the same rule you follow in the physical logbooks
- Each document type has its own separate counter
- The `7SP` prefix will automatically change to `8SP` when the 8th SP begins its term

> Note: The numbering format for Notices of Special Session — whether it shares the NCH prefix or uses a separate NOSP prefix — is one of the topics we would like to clarify today.

---

## Slide 12 — Two Committees at Once: How We're Designing This

> Layout: Visual/SVG — split-and-rejoin illustration
> 
> SVG description: Vertical flow, top to bottom. Top box: [Measure — 1st Reading Complete] Arrow down to: [Committee Referral Step] From Committee Referral, a Y-split into two parallel downward paths: Left path: [Subject-Matter Committee] → box labeled "Committee Report A" Right path: [Committee on Laws] → box labeled "Committee Report B" Both paths rejoin at a merge diamond labeled "All Reports Submitted?" with a checkmark. Arrow from merge continues to: [2nd Reading]
> 
> Small annotation beside the split: "Standard practice for most measures" Small annotation beside the merge: "Checkpoint — SP Secretary confirms"

From the Notice of Committee Hearing logs you shared, we observed that the vast majority of measures are referred to two committees at the same time: the relevant subject-matter committee and the Committee on Laws. This is the standard process — not a special case.

**How the system handles this:**

- At the referral step, the system assigns the measure to both committees simultaneously
- Each committee schedules its hearing, reviews the matter, and submits its report through the system
- Once all assigned committees have submitted their reports, the matter is ready to advance to Second Reading
- The SP Secretary confirms that the matter is ready to proceed
- A Notice of Committee Hearing is generated for each assigned committee

> We have a specific question about this process — addressed in the questions section.

---

## Slide 13 — Acting Officials: A First-Class Feature

> Layout: Card grid (2 columns × 2 rows) with a highlighted note

From the Designation logs you shared, we found more than ten Vice Mayor-as-Acting-Mayor designations in 2023–2024. This is a routine, high-frequency operation — not an exception. The system treats it accordingly.

**When a Designation is logged, the system:** Creates an authority record with a specific start date and end date. All documents that would normally go to the Mayor — for signature or approval — are automatically re-routed to the Acting Mayor for the duration of the designation.

**During the delegation period:** Actions taken by the Acting Mayor are recorded with their name and the capacity they acted in: _"Acting Mayor — per Designation D 2026-01."_ The original authority and the acting person are always clearly identified in every record.

**When the end date arrives:** The delegation expires automatically. No manual cleanup or reassignment is needed. All routing returns to the original official.

**Confirming each delegation:** To prevent errors, the Platform Administrator reviews and formally confirms the scope of every delegation before it takes effect. The delegation is not activated simply by logging the document — it requires that confirmation step.

> Question for discussion: Can one person hold more than one active Designation simultaneously — for example, acting as both Acting Mayor and Acting SP Secretary at the same time?

---

## Slide 14 — [Section Break] Questions We Need Your Guidance On

> Layout: Section divider — full-bleed with centered text, green or blue accent

**Before we finalize the system design, we need your input on five specific points.**

Your answers today will directly determine how several core features are built.

There is no wrong answer — we are here to learn how things actually work.

---

## Slide 15 — Q1 — The Preliminary Series Number

> Layout: Card — question on left, "why this matters" on right (two-column)

When a draft resolution or ordinance first arrives at the Secretariat, our understanding is that a **preliminary series number** is assigned early in the process, and a **final official series number** is assigned after the Mayor's signature.

**We need your guidance on:**

- Is the preliminary number already in the `7SP` format (e.g., `7SP 2026-01`), or is it a different kind of internal reference — a logbook number, a control number, or something else?
- At exactly which step is the preliminary number assigned? When you first receive the draft? At First Reading? When it is logged into the system?
- If a measure is rejected or archived before it ever reaches the Mayor, what happens to its preliminary number? Is it recorded as cancelled, or is it simply not used?
- Does the preliminary number appear on the printed draft document itself, or is it only tracked in the Secretariat's records?

> Why this matters: This determines whether the system needs two separate number-assignment steps for the same document, and whether printed drafts carry an official-looking number before it becomes final.

---

## Slide 16 — Q2 — When Does the QR Code Get Attached?

> Layout: Minimal with four labeled options and a note

The QR code printed on a document is the system's way of tracking its physical movement through offices. Every action — received by, forwarded to, returned from — is recorded against that code.

**At what point does a document receive its QR code?**

**(A)** When Secretariat staff physically receive it from a Councilor — before any computer entry?

**(B)** When staff log it into the computer system — after it is received and being processed?

**(C)** Only after the preliminary series number is assigned?

**(D)** At a different point altogether?

**One additional question:** Can a Councilor's own staff generate and print a QR code for a document before they submit it to the Secretariat? Or is QR code generation always done by the Secretariat?

> Why this matters: If the QR code is created before the document is logged in the system, we need to design a process for that. If it is always created at system logging, the design is simpler and more reliable.

---

## Slide 17 — Q3 — Does the 10-Day Rule Apply to Resolutions?

> Layout: Comparison — Left: SP Ordinance (confirmed, green), Right: SP Resolution (open question, amber)

**SP Ordinance — Confirmed** After the Vice Mayor signs, the Mayor has 10 calendar days to sign, veto, or allow the ordinance to lapse into law automatically. If no action is taken in 10 days, the ordinance takes effect.

**SP Resolution — We Need Your Guidance** The official legislative flowchart confirms that the Mayor's signature is required for SP Resolutions — and that the Mayor can veto a resolution. However, it is not yet clear whether the same 10-calendar-day lapse rule also applies.

- Does the 10-day lapse rule apply to resolutions the same way it does to ordinances?
- Or does the Mayor's signature step for a resolution have no automatic deadline — the SP simply waits until the Mayor signs or vetoes, however long that takes?

> Why this matters: If the 10-day rule applies to resolutions, the system will run an automatic countdown on every resolution transmitted to the Mayor, and will transition to "Lapsed into Law" on Day 11. If it does not apply, the system notifies but waits indefinitely.

---

## Slide 18 — Q4 — When Two Committees Are Assigned: Who Must Report First?

> Layout: Card — question framed simply, sub-questions as a list

Most measures go to two committees simultaneously. We need to understand what happens at the point where their reports come together before Second Reading.

**The main question:** Does the measure advance to Second Reading only after **both** committees have submitted their reports — or does it advance as soon as the primary (subject-matter) committee reports, regardless of what the Committee on Laws has done?

**Follow-up questions:**

- If both reports are required, what happens when one committee is significantly slower than the other? Does the SP Secretary follow up directly with the committee, or does the system send an automatic reminder?
- Are there types of measures that are referred only to one committee — not co-referred to the Committee on Laws?
- When two committees hold hearings on the same matter, is one NCH issued covering both, or is a separate NCH issued per committee?

> This answer determines how the system decides when the measure is ready to move to Second Reading.

---

## Slide 19 — Q5 — Who Can Declare a Measure "Certified Urgent"?

> Layout: Card — question with context, sub-questions as list

The official flowchart shows a "Certified Urgent" path: when a measure is declared certified urgent, it bypasses committee referral entirely and proceeds directly to Second Reading.

**The main question:** Who has the authority to use this path?

- **The Mayor** — by sending a formal written certification to the SP before or at First Reading?
- **The Vice Mayor** (Presiding Officer) — by declaring it in the session itself?
- **The full SP** — by a vote of the majority at First Reading?

**Follow-up questions:**

- Is the certification a formal written document, or a verbal declaration made during the session?
- Can any type of measure — resolution or ordinance — be certified urgent, or only certain types?
- How often is this path used in practice? Roughly how many measures per year would go through the certified urgent path?

> We are not building the certified urgent path in the very first version — we want to confirm the rules before we do, to make sure the system enforces them correctly.

---

## Slide 20 — Additional Topics for Discussion

> Layout: Card grid (2 columns × 3 rows) — smaller cards, each a brief discussion item

**Document Search and OCR** When a scanned document is uploaded, should the system automatically make it searchable — or is that a step the Records Officer would trigger manually on documents they choose?

**Records from LMITS** What data needs to be brought over from the previous system? In what form does that data currently exist, and who has access to it now that LMITS is no longer active?

**Newspaper Publication** The Index of Ordinances shows some documents were published in Ilocos Times, others were not. Which types of ordinances and resolutions are legally required to be published? Who arranges the publication — the SP Secretariat, the Mayor's Office, or the implementing department?

**Panlalawigan 30-Day Tracking (Current Practice)** How is the 30-day review period currently tracked? Is there a manual log or calendar entry? Have there been situations where the Deemed Approved date passed without the Secretariat noticing?

**When the Panlalawigan Returns a Document Already in Effect** When the Panlalawigan marks a document RETURNED after the LGU has already started acting on it, what is the standard procedure? Who decides whether to challenge the objection? Has this situation come up before in Batac?

**NCH or NOSP for Notices of Special Session** Records from different years show both the `NCH` and `NOSP` prefixes used for Special Session notices. What is the current official convention the Secretariat follows?

---

## Slide 21 — What Happens After Today

> Layout: Numbered list — five steps

After this meeting, we will take the following steps:

1. **Record and integrate your answers** into the final design document — every answer and correction from today is documented
2. **Send you a written summary** of today's decisions and open items, for your review and any corrections
3. **Update the Terms of Reference** to reflect the confirmed scope, workflows, and design decisions
4. **Finalize the architecture** for Phase 1 development, based on what we confirm today
5. **Keep you informed as we build** — key design decisions that affect your daily work will be brought back to you before they are finalized

**Your involvement going forward:** You will have the opportunity to review the system before it goes live. Your team will be included in testing before production rollout.

---

## Slide 22 — Closing

> Layout: Hero/closing — centered, generous whitespace, no busy elements

**We want to build this system exactly the way you work.**

Every design decision in this presentation is based on your processes, your documents, and your team's daily operations. What you tell us today directly shapes what we build.

Thank you for your time and continued guidance.

_The floor is open — questions, corrections, and suggestions are welcome._

---

_Batac City LGU Platform — SP Office, Batac City, Ilocos Norte | June 2026_