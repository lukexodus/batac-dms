**Batac City LGU Platform — Stakeholder Briefing** _Terms of Reference v0.1 · Draft · June 2026_

---

**Slide 01 — Title** Hero slide introducing the platform as a "Digital Document Management Platform" — a digital operations layer for the SP, Mayor's Office, City Hall departments, and all 43 barangays of Batac City.

**Slide 02 — Current State: How Documents Move Today** Six problem cards: routing by physical presence, no real-time visibility, slow retrieval, ARTA compliance gap, version confusion, records at risk.

**Slide 03 — Legal Obligation, Not Just Efficiency** Four callouts explaining why the platform is necessary: RA 11032 (Ease of Doing Business Act) with its 3/7/20-day SLA limits, public accountability, operational scale (43 barangays, multiple offices), and COA retention compliance.

**Slide 04 — Physical & Digital Records Coexist** Two-column card explaining the dual source of truth: physical documents remain the legal source of truth; the platform is the operational source of truth. Callout: this is not a paperless initiative.

**Slide 05 — What Are We Building?** Table listing key project identity facts: platform name, type (LGU-wide operations platform, not narrow DMS), target LGU (Batac City, Ilocos Norte), scope (SP, Mayor, City Hall, 43 barangays, citizens), and the dual source-of-truth principle.

**Slide 06 — Phased Delivery** Numbered step list of the five module priority order: DMS (Phase 1), DTS (Phase 1), WMS (Phase 1 — SP workflows only), RMS (Phase 2), Government Portal (Phase 3).

**Slide 07 — Phase 1 Scope Decision** Two-column layout. Left: Phase 1 deliverables (SP Resolution + Ordinance full lifecycle, numbering, QR, Panlalawigan 30-day timer, public portal, dashboards, audit trail, SLA tracking). Right: Phase 1B deferred document types (letters, memos, notices, designations, barangay resolutions, citizen complaints) with a scope confirmation callout.

**Slide 08 — Section Break: Use Cases** Green section divider introducing the use cases section.

**Slide 09 — Use Case Diagram** SVG use case diagram showing the system boundary of the Batac City LGU DMP. Four actors (SP Secretary, Government Official, Records Officer, Platform Administrator) and eight use cases (UC01–UC04, UC07, UC10–UC12), with include relationships from UC01/UC02 to UC03 and UC02 to UC04.

**Slide 10 — Use Cases: Drafting, Routing & Approval** Two cards. UC1: Draft and Submit a Document — system assigns tracking number, version history, no series number until approval. UC2: Document Routing & Approval — four-step flow of task assignment, notification, action (approve/return/reject), and audit trail.

**Slide 11 — Use Cases: QR Tracking & SLA Monitoring** Two cards. UC3: Scan QR → resolve ID → show routing history (no login required for public docs). UC4: SLA monitoring per RA 11032 (3/7/20-day limits), with 80% warning and 100% auto-escalation.

**Slide 12 — Use Cases: Citizens & Barangay Officials** Two cards. UC5: Citizens submit and track requests via public portal (no City Hall visit needed; no login required for status lookup). UC6: Barangay officials submit documents digitally via mobile-first design (Phase 1 note: barangay officials have no system login yet — secretariat logs on their behalf).

**Slide 13 — Use Cases: Records, Search & Audit** Three cards. UC7: Records archiving with retention tiers (permanent, 10–15 yrs, 5 yrs) — no automatic deletion. UC9: Search and retrieve, scoped by role. UC10: Audit log review — hash-chained, INSERT-only, read-only for auditors.

**Slide 14 — Section Break: Legislative Workflows** Blue section divider introducing the SP Resolution and SP Ordinance lifecycle workflows.

**Slide 15 — SP Resolution — Full Legislative Lifecycle** Wide SVG flow diagram (left to right): Draft → Secretariat (prelim number) → Order of Business → 1st Reading → Committee (with deferred/archived exit) → 2nd Reading (with amendment loop back) → Print Final → 3rd Reading → Vice Mayor signs → Mayor signs/vetoes → Final number + docketing → Panlalawigan 30-day review → Publication → Archive → Public Portal. Key facts box below: prelim vs final number, no debates at 3rd Reading, Panlalawigan 30-day rule, 2/3 veto override, certified urgent bypass.

**Slide 16 — SP Ordinance — Same Lifecycle + Lapse-into-Law** Wide SVG flow diagram same as Resolution through 3rd Reading, then: Vice Mayor signs → Mayor 10-calendar-day review box (three exit paths: signs, lapse, veto) → Final number + docketing → Panlalawigan → Publication → Archive → Public Portal. Key differences box: lapse-into-law auto-notification, ordinance effective immediately on signature/lapse, franchise ordinance separate numbering, VALID-IN-PART awaiting-action state, ordinance categories.

**Slide 17 — Sangguniang Panlalawigan Review** Two-column layout. Left: outcome types table (VALID, VALID-IN-PART, RETURNED, Referred to committee, Operative-in-entirety, blank/30-days = deemed approved per RA 7160 §56d). Right: system behavior callouts — 30-day auto-timer, VALID-IN-PART manual routing options (resolve/legal office/re-draft), RETURNED high-priority alert.

**Slide 18 — Confirmed Series Number Formats** Table listing all confirmed numbering formats across document types: SP Resolutions and Ordinances (`{SP_NUMBER}SP {YEAR}-{NN}`), Franchise Ordinances (`{SP_NUMBER}SP {SEQUENCE}-{YY}R`), Internal Memos, Letters Received, Letters Sent, NCH notices, and Designations. Callout on control number immutability rule.

**Slide 19 — Section Break: System Design** Green section divider introducing objectives, roles, document categories, dashboards, and tracking identity.

**Slide 20 — Project Objectives (1 of 2)** Five numbered objectives: digitize and centralize document storage; implement configurable workflows; provide real-time QR tracking; enforce role-based access controls; enable RA 11032 compliance.

**Slide 21 — Project Objectives (2 of 2)** Four more numbered objectives: public-facing citizen component; long-term records preservation (COA/DILG); transparency via tamper-evident audit trails; long-term digital foundation for growth.

**Slide 22 — Who Uses the Platform** Table of nine user roles: SP Secretary (full legislative lifecycle control), Mayor (highest approval authority), Vice Mayor (SP presiding, certifies), SP Members/Councilors (review, vote), Department Heads & Staff (office-scoped approvers/encoders), Barangay Officials (mobile, own barangay only), Records Officer (archiving), Auditor (read-only), Citizens (public portal only).

**Slide 23 — Three Tiers of Document Management** Three-column card layout. Category A (Full Workflow): SP Resolution, Ordinance, Barangay Resolution, Executive Order, Citizen Complaint. Category B (Administrative): Travel Orders, Leave Applications, Purchase Requests, DVs, Internal Memos. Category C (Archive): Final certified copies, session minutes, committee reports, historical records.

**Slide 24 — Every Document Gets a Tracking Identity** Five-step list: unique DTS tracking number assigned at registration → QR code generated (tracking number only, no content) → cover sheet printed → scan-to-lookup, no login for public docs → every movement recorded (from/to office, actor, timestamp, action).

**Slide 25 — Each User Sees What They Need to Act On** Four role-specific dashboard cards: SP Secretary (legislative queue, session calendar, Panlalawigan tracking), Mayor (pending signatures, 10-day countdown), Vice Mayor & SP Members (session materials, committee referrals, voting history), Department Heads (departmental inbox, SLA status).

**Slide 26 — Configurable Without Developer Involvement** Two-column layout. Left: what admins can configure (workflow steps, SLA thresholds, notifications, classification, user roles, delegation records) with versioning callout. Right: designation/authority transfer system — `delegation_grant` records, manual admin confirmation, high-frequency operation note, legally mandated steps are locked.

**Slide 27 — Phase 1 Minimum Viable Core — 10 Components** Two-column numbered list: (1) IAM, (2) Organization Module, (3) Document Core, (4) Workflow Engine (SP Reso + Ordinance), (5) Document Tracking with QR — and (6) In-App Notifications, (7) SP Secretary Dashboard, (8) Mayor Dashboard, (9) Audit Log (hash-chained, INSERT-only), (10) Infrastructure (PostgreSQL, S3, Docker, Terraform, backup).

**Slide 28 — Closing** Closing slide with document icon, "For Stakeholder Review" heading, disclaimer that all scope and requirements are subject to revision, phase pills (Phase 1 / Phase 1B / Phase 2–3), and document metadata footer.