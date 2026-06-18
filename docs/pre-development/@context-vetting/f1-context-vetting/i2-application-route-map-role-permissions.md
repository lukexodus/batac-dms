# F1. Application Route Map — Curated Source Context (Part 2: Role Permissions)

[Unverified] This document is a curation, not a new analysis. Every passage below is copied verbatim from `i2-role-permission-matrix.md`. Nothing here has been synthesized, summarized in different words, or used to infer route paths or component names that do not already appear in the source text. Markdown tables are reproduced exactly as they appear in source, including full role-column headers, so that no permission cell is silently dropped or misread when cross-referenced later.

**Purpose:** This is a companion to the earlier curation (`f1-route-map-source-context.md`, drawn from the stack-context and consolidated-requirements files). That document covered _what each of the 9 named F1 views does_. This document covers _who is allowed to access them_ — the "required role(s) to access" field for F1 — pulled from the one file in this project built specifically for IAM/role configuration.

**Source file:** `i2-role-permission-matrix.md`

[Inference] This matrix states permission _categories_ (e.g., "Complete an assigned action step"), not route paths or component names. Mapping a permission row to a specific F1 route still requires a judgment call about which row(s) correspond to which view — that mapping is not made explicit in source. Where the connection between a permission row and a named F1 view is reasonably direct, I've kept the row; where it required more inferential reach, I've noted that inline rather than silently including or excluding it.

---

## 1. How to Read the Matrix (needed to interpret every table below)

_Source: Section "How to Read This Matrix" (full)_

> |Symbol|Meaning|
> |---|---|
> |✅|**Allow** — role may perform this action unconditionally|
> |❌|**Deny** — role may never perform this action|
> |🔶|**Conditional** — allowed subject to the stated condition (see footnotes)|
> |—|**Not applicable** — the action category does not apply to this role|
> 
> **Scope rule:** All permissions are additionally bounded by office scope via ABAC. A Department Approver who has Allow on "Approve document" can only approve documents belonging to their own office. The matrix states the permission category; ABAC policies enforce the scope constraint at request time. PostgreSQL Row-Level Security enforces isolation at the database layer as a second line of defense.
> 
> **Role precedence:** A user holding multiple roles accumulates permissions; the most permissive applicable rule wins within a given office scope. The exception is the Platform Administrator role, which cannot be combined with any document-processing role (architectural invariant #12).
> 
> **Conditional notes are numbered** (e.g., ¹) and listed in full in the Conditional Notes section at the end.

[Inference] This section is included in full even though it isn't itself a permission row, because every 🔶 cell quoted below is meaningless without it — a route gated by a 🔶 condition needs both the symbol legend and the matching footnote (Section 9 below) to know the actual access rule.

---

## 2. Roles Reference (the full role list, needed for every "required role(s)" field)

_Source: Section "Roles Reference" (full)_

> |#|Role|Primary Scope|
> |---|---|---|
> |1|System Administrator|Infrastructure; no document content access|
> |2|Platform Administrator|Configuration; no document processing|
> |3|Records Officer|Archiving, retention, disposition|
> |4|Department Encoder|Create and submit documents for their office|
> |5|Department Approver|Approve documents at their office level|
> |6|SP Secretary|Full SP legislative document lifecycle|
> |7|SP Member|Review, comment, vote on legislative documents|
> |8|SP Presiding Officer|Certify SP legislative output|
> |9|Mayor|Highest executive approval authority|
> |10|Barangay Encoder|Submit documents on behalf of a barangay|
> |11|Barangay Captain|Approve and sign barangay-originated documents|
> |12|Auditor|Read-only: finalized documents and audit logs|
> |13|Citizen|Public portal; own submitted requests and complaints only|

[Unverified] This is a 13-role list. The previously curated context document (Section 11 of the prior file) listed an informal, non-exhaustive inventory of role-like terms found in the requirements file; that list did not match this one exactly (it included "City Administrator," "City Legal Office," and "IT Admin / IT Director" as separate items, and used "SP Secretariat" rather than distinguishing "SP Secretary" from "SP Member" from "SP Presiding Officer"). [Inference] This matrix is described as the IAM configuration reference, so where the two lists diverge, this 13-role list is likely the more authoritative one for F1's role-gating field — but that is not something either source file states explicitly, so it is flagged here rather than silently resolved.

---

## 3. Section 8 — Session Attendance and Order of Business

[Inference] Maps directly to two named F1 views: **Order of Business view** and **session attendance tracking**.

_Source: Section 8 (full)_

> |Permission|Sys Admin|Plat Admin|Rec Officer|Dept Encoder|Dept Approver|SP Secretary|SP Member|SP Presiding|Mayor|Brgy Encoder|Brgy Captain|Auditor|Citizen|
> |---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
> |Create / manage session records|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Record session attendance (who is absent, reason)|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |View session attendance record|❌|❌|❌|❌|❌|✅|✅|✅|✅|❌|❌|✅|❌|
> |View Order of Business (current session)|❌|❌|❌|❌|❌|✅|✅|✅|✅|❌|❌|✅|❌|
> |Schedule document for first reading (add to Order of Business)|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Enter committee hearing date (from committee communication)|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |View attendance statistics and graphs|❌|❌|❌|❌|❌|✅|✅|✅|✅|❌|❌|✅|❌|

[Inference] This section implies at least two distinct access levels exist within these two views (edit-capable: SP Secretary only; view-only: SP Secretary, SP Member, SP Presiding Officer, Mayor, Auditor) — meaning the Order of Business and session-attendance routes likely need to gate write actions and read access separately, not as a single role check per route. This is a reasonable reading of the table but is not stated as an explicit instruction anywhere in source.

---

## 4. Section 16 — Reporting and Dashboards

[Inference] Maps directly to two named F1 views: **SP Secretary dashboard** and **Mayor dashboard**. Also contains the only matrix row for a generic "task inbox" pattern that may apply to both dashboards and to workflow step action views.

_Source: Section 16 (full)_

> |Permission|Sys Admin|Plat Admin|Rec Officer|Dept Encoder|Dept Approver|SP Secretary|SP Member|SP Presiding|Mayor|Brgy Encoder|Brgy Captain|Auditor|Citizen|
> |---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
> |View SP Secretary dashboard (queue, pending, session calendar)|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |View Mayor dashboard (pending signatures, overdue items)|❌|❌|❌|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|
> |View own task inbox / assigned steps|❌|❌|✅|✅|✅|✅|✅|✅|✅|✅|✅|❌|❌|
> |View ARTA SLA compliance report|❌|❌|✅|❌|❌|✅|❌|✅|✅|❌|❌|✅|❌|
> |View Panlalawigan review tracking summary|❌|❌|✅|❌|❌|✅|✅|✅|✅|❌|❌|✅|❌|
> |View Index of Ordinances / Index of Resolutions|❌|❌|✅|❌|❌|✅|✅|✅|✅|❌|❌|✅|❌|
> |Create / edit report definitions (Phase 2)|❌|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |Run saved report|❌|✅|✅|❌|❌|✅|❌|✅|✅|❌|❌|✅|❌|
> |Export report output|❌|✅|🔶¹⁶|❌|❌|✅|❌|✅|✅|❌|❌|✅|❌|

[Inference] The first two rows are exclusive single-role gates (SP Secretary dashboard: SP Secretary only; Mayor dashboard: Mayor only) — this confirms each dashboard is a distinct route with a single required role, not a shared dashboard shell. "Create / edit report definitions" is explicitly Phase 2, so it's excluded from F1 routing despite appearing in this section (see Section 10, exclusions, below).

---

## 5. Section 4 — Document Creation and Submission

[Inference] Maps to the named F1 view **document intake form**, plus several Secretariat-specific document actions that may surface as part of the intake flow or an adjacent action view.

_Source: Section 4 (full)_

> |Permission|Sys Admin|Plat Admin|Rec Officer|Dept Encoder|Dept Approver|SP Secretary|SP Member|SP Presiding|Mayor|Brgy Encoder|Brgy Captain|Auditor|Citizen|
> |---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
> |Create new document (draft) — own office|❌|❌|❌|✅|✅|✅|✅|✅|✅|✅|✅|❌|❌|
> |Edit document in Draft state — own office|❌|❌|❌|✅|✅|✅|🔶⁶|✅|✅|✅|✅|❌|❌|
> |Delete document in Draft state (soft delete) — own office|❌|❌|❌|✅|✅|✅|❌|✅|✅|✅|✅|❌|❌|
> |Submit document (Draft → Submitted) — own office|❌|❌|❌|✅|✅|✅|✅|✅|✅|✅|✅|❌|❌|
> |Upload file attachment to document — own office|❌|❌|❌|✅|✅|✅|🔶⁶|✅|✅|✅|✅|❌|❌|
> |Remove file attachment (soft delete) — own office|❌|❌|❌|✅|✅|✅|❌|✅|✅|✅|✅|❌|❌|
> |Create document on behalf of another user (clerk-assisted)|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Assign preliminary series number (Draft prefix)|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Assign final series number (remove Draft prefix)|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Cancel document (from any active state) — own office|❌|❌|❌|🔶⁷|✅|✅|❌|✅|✅|🔶⁷|✅|❌|❌|
> |Log Certification of Urgency (attach to measure)|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Log Designation document (extract scope, enter in system)|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Generate transmittal letter (SPS)|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Generate Order of Business|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|

[Unverified] "Log Certification of Urgency," "Log Designation document," "Generate transmittal letter," and "Generate Order of Business" are SP-Secretary-exclusive actions that don't fit cleanly inside a generic "document intake form" — they may belong on the intake form, on a separate Secretariat action view, or on the workflow-step-action views instead. The source file does not state which. They are included here rather than moved to Section 6 (Workflow Execution) below, since they appear in the matrix's "Document Creation and Submission" section, but this placement is the matrix author's categorization, not a routing decision.

---

## 6. Section 6 — Workflow Execution

[Inference] Maps directly to the named F1 view **workflow step action views**. This is the largest and most directly relevant section for that view.

_Source: Section 6 (full)_

> |Permission|Sys Admin|Plat Admin|Rec Officer|Dept Encoder|Dept Approver|SP Secretary|SP Member|SP Presiding|Mayor|Brgy Encoder|Brgy Captain|Auditor|Citizen|
> |---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
> |Initiate a workflow instance|❌|❌|❌|✅|✅|✅|✅|✅|✅|✅|✅|❌|❌|
> |Complete an assigned action step|❌|❌|❌|🔶¹²|✅|✅|✅|✅|✅|🔶¹²|✅|❌|❌|
> |Complete an assigned approval step (Approve)|❌|❌|❌|❌|✅|✅|❌|❌|✅|❌|✅|❌|❌|
> |Complete an assigned approval step (Reject)|❌|❌|❌|❌|✅|✅|❌|❌|✅|❌|✅|❌|❌|
> |Complete an assigned approval step (Return for revision)|❌|❌|❌|❌|✅|✅|❌|❌|✅|❌|✅|❌|❌|
> |Log Secretariat decision (Approve / Reject / Amended)|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Record First Reading referral to committee|❌|❌|❌|❌|❌|✅|❌|🔶¹³|❌|❌|❌|❌|❌|
> |Submit committee report (multi-referral step)|❌|❌|❌|❌|❌|✅|🔶¹⁴|❌|❌|❌|❌|❌|❌|
> |Manually advance multi-referral step (override missing report)|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Record SP session vote outcome|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Certify document (SP Presiding Officer step)|❌|❌|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|
> |Sign / approve document (Mayor step)|❌|❌|❌|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|
> |Veto document (Mayor step)|❌|❌|❌|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|
> |Log 10-day Mayor lapse (system-triggered; manual confirmation)|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Record veto override vote|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Log docketing step completion|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Record Panlalawigan review outcome|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Confirm Panlalawigan 30-day deemed-approved lapse|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Record newspaper publication date (penalty ordinances)|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Migrate in-flight workflow instance to new definition version (Option B)|❌|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |View workflow instance status and routing history|❌|✅|✅|🔶¹⁰|🔶¹⁰|✅|🔶¹⁰|✅|✅|🔶¹⁰|🔶¹⁰|✅|❌|

[Inference] This is the single richest table for the "workflow step action views" entry in F1. It implies that "workflow step action views" is very likely not one route but a family of routes/components, each gated to a different role and a different step type — e.g., a Mayor-only sign/veto view, an SP-Presiding-Officer-only certify view, an SP-Secretary-only docketing/Panlalawigan-outcome view, and a shared approve/reject/return view for Department Approver, SP Secretary, Mayor, and Barangay Captain. [Speculation] Whether these become separate route paths (e.g., one per step type) or one parameterized route that renders differently per step type is a frontend architecture decision not addressed in either source file — flagging this explicitly so it isn't silently assumed one way when F1 is built.

"Migrate in-flight workflow instance to new definition version (Option B)" is Platform-Administrator-only and is therefore also relevant to the **Platform Administrator views** entry, not only workflow step actions — it's placed here rather than duplicated in Section 8 below, with this cross-reference noted instead.

---

## 7. Section 7 — Document Tracking (DTS) — workflow/public-portal-relevant rows only

[Inference] Most of this section is about QR/routing mechanics generally (already covered conceptually in the prior curation document). The rows kept here are the ones with a direct, distinct role gate relevant either to workflow step action views or the public portal subset; rows that simply restate "view routing history" with the same role pattern as Section 6 above are omitted to avoid duplicating an already-established pattern.

_Source: Section 7, rows directly bearing on public portal access or step-adjacent actions_

> |Permission|Sys Admin|Plat Admin|Rec Officer|Dept Encoder|Dept Approver|SP Secretary|SP Member|SP Presiding|Mayor|Brgy Encoder|Brgy Captain|Auditor|Citizen|
> |---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
> |Generate QR code for document|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Print QR cover sheet|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Log physical routing entry (forward to / receive from)|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|❌|
> |Scan QR code (authenticated in-app scan)|❌|❌|✅|✅|✅|✅|✅|✅|✅|✅|✅|✅|❌|
> |Scan QR code (public portal — unauthenticated)|—|—|—|—|—|—|—|—|—|—|—|—|✅|
> |Lookup document by tracking number (public)|—|—|—|—|—|—|—|—|—|—|—|—|✅|

[Inference] "Scan QR code (public portal — unauthenticated)" and "Lookup document by tracking number (public)" are the two clearest matrix-confirmed entries for unauthenticated/no-role-required routes in the Phase 1 public portal subset — both are marked "—" for every authenticated role and "✅" only for Citizen, with Citizen's own role description in Section 2 above noting "Public portal" scope.

---

## 8. Section 2 (admin rows), Section 3, Section 10 (activation row), Section 11 (delivery logs), Section 14 — Platform Administrator Views

[Inference] Maps directly to the named F1 view **Platform Administrator views**. These rows are pulled from five different matrix sections because Platform Administrator permissions are spread across the organization, configuration, records, notification, and portal sections rather than consolidated into one place in source.

_Source: Section 2, admin-only rows (Platform-Administrator-relevant excerpt — Roles, Designations, and the four CRUD rows preceding them omitted only where they duplicate the pattern already shown; full org-CRUD rows kept since they are central to this view)_

> |Permission|Sys Admin|Plat Admin|Rec Officer|Dept Encoder|Dept Approver|SP Secretary|SP Member|SP Presiding|Mayor|Brgy Encoder|Brgy Captain|Auditor|Citizen|
> |---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
> |Create / edit office records|❌|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |Deactivate office records|❌|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |Create / edit position records|❌|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |Create / edit employee records|❌|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |Assign employees to offices and positions|❌|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |View organization chart (all offices)|✅|✅|✅|🔶²|🔶²|✅|✅|✅|✅|❌|❌|✅|❌|

_Source: Section 3 — Platform Configuration (full)_

> |Permission|Sys Admin|Plat Admin|Rec Officer|Dept Encoder|Dept Approver|SP Secretary|SP Member|SP Presiding|Mayor|Brgy Encoder|Brgy Captain|Auditor|Citizen|
> |---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
> |Create / edit document type definitions|❌|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |Publish / deprecate document type definitions|❌|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |Create / edit workflow definitions|❌|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |Publish / deprecate workflow definitions|❌|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |Create / edit role definitions and permissions|❌|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |Create / edit SLA thresholds and escalation targets|❌|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |Create / edit notification templates|❌|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |Create / edit retention schedules|❌|✅|🔶⁵|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |Create / edit document type public visibility rules|❌|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |Create / edit standing committee definitions|❌|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |Access system health and infrastructure metrics|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |Manage encryption keys and secrets|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |Execute database schema migrations|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> |Trigger backup and restore operations|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|

_Source: Section 10, retention-schedule activation row_

> | View retention schedules list | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

_Source: Section 11, delivery-logs row_

> | View delivery logs (all notifications) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

_Source: Section 14, announcement-posting row_

> | Post announcement on public portal | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

[Inference] The last four Section 3 rows ("Access system health...", "Manage encryption keys...", "Execute database schema migrations", "Trigger backup and restore operations") are System-Administrator-only, not Platform-Administrator. They are included here because they sit in the same matrix section titled "Platform Configuration" and a reader building F1 might otherwise conflate the two distinct admin roles — keeping them visible alongside the Platform-Administrator rows makes the role distinction explicit rather than something that has to be inferred separately. [Speculation] Whether System Administrator needs its own dedicated views distinct from Platform Administrator views is not stated in F1's own task description (which only names "Platform Administrator views"), so this is flagged as an open question for whoever builds F1, not resolved here.

---

## 9. Section 15 — Audit Log

[Inference] Maps directly to the named F1 view **audit log viewer**.

_Source: Section 15 (full)_

> |Permission|Sys Admin|Plat Admin|Rec Officer|Dept Encoder|Dept Approver|SP Secretary|SP Member|SP Presiding|Mayor|Brgy Encoder|Brgy Captain|Auditor|Citizen|
> |---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
> |View audit log — own actions|❌|❌|✅|✅|✅|✅|✅|✅|✅|✅|✅|✅|❌|
> |View audit log — own office documents|❌|❌|✅|❌|✅|✅|❌|✅|✅|❌|✅|✅|❌|
> |View audit log — all entries (full log)|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|✅|❌|
> |Validate audit log hash chain integrity|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|✅|❌|
> |Export audit log (bounded by classification)|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|✅|❌|
> |Write to audit log directly|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|
> 
> **Note:** No role may write directly to the audit log. All audit writes are performed exclusively through the audit service (INSERT-only at DB permission level). This row is included as an explicit Deny-all to enforce the architectural invariant.

[Inference] This confirms the audit log viewer is very likely (at minimum) two distinct access levels/routes: a scoped "my actions / my office" view available to nearly every authenticated role, and a full-log view restricted to Auditor only (with System Administrator carved out separately for hash-chain validation specifically, not full-log viewing). "Write to audit log directly" has no relevance to any route (it's a universal Deny, included in source only to document the invariant) — flagged here, not excluded, since the prior curation's "Items Considered and Excluded" precedent was to note borderline calls rather than silently drop them.

---

## 10. Phase 1 Public Portal Subset — remaining sections (Citizen-facing rows)

[Inference] Maps to the named F1 view **Phase 1 public portal subset**, supplementing Section 7 above (QR scan / tracking lookup) with the citizen-facing rows from Sections 5, 12, 13, and 14 not already covered.

_Source: Section 5, public-viewing row only_

> | View Public-classification documents | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔶¹¹ |

_Source: Section 12 — Citizen Complaints, citizen-facing rows_

> |Permission|Sys Admin|Plat Admin|Rec Officer|Dept Encoder|Dept Approver|SP Secretary|SP Member|SP Presiding|Mayor|Brgy Encoder|Brgy Captain|Auditor|Citizen|
> |---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
> |Submit complaint (self)|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|✅|
> |View own submitted complaint and status|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|✅|
> |View complaint as respondent|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|🔶¹⁸|

_Source: Section 13 — Document and Records Request, citizen-facing rows_

> |Permission|Sys Admin|Plat Admin|Rec Officer|Dept Encoder|Dept Approver|SP Secretary|SP Member|SP Presiding|Mayor|Brgy Encoder|Brgy Captain|Auditor|Citizen|
> |---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
> |Submit document request (self, via portal)|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|✅|
> |Generate printable document request form|❌|❌|❌|❌|❌|✅|❌|❌|❌|❌|❌|❌|✅|
> |View own document request status|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|❌|✅|

_Source: Section 14 — Public Portal Access, citizen-facing rows_

> |Permission|Sys Admin|Plat Admin|Rec Officer|Dept Encoder|Dept Approver|SP Secretary|SP Member|SP Presiding|Mayor|Brgy Encoder|Brgy Captain|Auditor|Citizen|
> |---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
> |View published document title and first page (public)|—|—|—|—|—|—|—|—|—|—|—|—|✅|
> |Lookup document status by tracking number (public)|—|—|—|—|—|—|—|—|—|—|—|—|✅|

[Inference] "Generate printable document request form" is notable: it's marked ✅ for both SP Secretary and Citizen, meaning this single permission category spans both an internal Secretariat-facing route and a public-portal-facing route. [Speculation] This may mean the document-request-form component is shared/reused across the internal `/apps/web` and the public portal, or it may mean two separate components implement the same permission category — neither source file specifies which, and the F1 task description's framing ("All pages/views in `/apps/web`... and the Phase 1 public portal subset" as a single covered list) doesn't resolve this either, since it groups both under one document without clarifying app boundaries.

---

## 11. Conditional Notes Referenced Above

[Inference] Every 🔶 symbol quoted in Sections 3–10 above requires its corresponding footnote to be meaningful for a role-gating decision. Reproduced here are only the footnotes actually referenced by a 🔶 in the tables kept above (¹¹, ¹², ¹³, ¹⁴, ¹⁶, ¹⁸ are directly used; ², ⁵, ⁶, ⁷, ⁹, ¹⁰, ¹⁵, ¹⁷ also appear and are included for completeness since several recur across multiple kept tables).

_Source: Conditional Notes section, notes ² through ¹⁸ excluding ¹ and ⁴ and ³ and ⁸ (those four pertain only to IAM/Organization/Designation rows not kept above — see Section 12, exclusions)_

> **² Organization chart — own office visible by default:** Department Encoders and Approvers see the full organization chart for read-only reference. They may not edit any record.
> 
> **⁵ Retention schedules — Records Officer can propose:** Records Officers may draft changes to retention schedules, but final activation of a new schedule requires Platform Administrator action. Existing schedules may be applied by the Records Officer to individual records without Platform Administrator involvement.
> 
> **⁶ SP Member document editing:** SP Members may edit and upload attachments to documents they have personally authored (as the originating Councilor/drafter). They may not edit documents authored by another SP Member or entered by the Secretariat.
> 
> **⁷ Cancel document — Encoder scope:** A Department Encoder may cancel a document only while it is in Draft or Submitted state and has not yet entered an active workflow instance. Once a workflow instance is live, cancellation requires the Approver or SP Secretary. Similarly for Barangay Encoder.
> 
> **⁹ Confidential / Restricted access:** Access to documents classified Confidential or Restricted is granted via an explicit role allowlist configured per document type by the Platform Administrator. The matrix rows for Mayor, SP Secretary, and Records Officer reflect that these roles are commonly included in such allowlists (particularly for Administrative Cases — see Part 4.13). Actual access is determined by the allowlist, not by this matrix alone.
> 
> **¹⁰ Workflow status and search — scoped:** Department Encoders, Approvers, SP Members, Barangay Encoders, and Barangay Captains may view workflow instance status and search documents only for documents belonging to their own office (or, for SP Members, documents in their assigned committees or SP sessions). ABAC policies enforce this scope at request time; PostgreSQL RLS enforces it at the database layer.
> 
> **¹¹ Citizen public document view:** Citizens (including unauthenticated visitors to the public portal) may view the title and first page of documents classified as Public. All subsequent pages are blurred. Full document access requires a Document Request Form, Vice Mayor and SP Secretary approval, and payment (payment processing deferred to a later phase).
> 
> **¹² Action step — Encoder scope:** Department Encoders may complete action steps only on documents they created or on documents explicitly assigned to them within their office's workflow. They do not have general action-step access across their office's queue. Barangay Encoders are similarly scoped to their own barangay's documents.
> 
> **¹³ Record First Reading referral — Presiding Officer:** The Vice Mayor (SP Presiding Officer) directs committee referral verbally during a session. The SP Secretary logs this referral in the system. The permission here reflects the Presiding Officer's ability to log the referral decision themselves if present at a terminal; in practice the Secretary performs this action.
> 
> **¹⁴ SP Member committee-scoped actions:** SP Members may submit committee reports, view complaints, and view documents only for committees of which they are a confirmed member (per the standing committee definitions in Part 6 of the domain context). They do not have blanket SP-wide access to these actions.
> 
> **¹⁵ SP Secretary classification change:** The SP Secretary may apply or change classification levels on SP-originated documents only (documents owned by the SP Secretariat). Documents owned by other offices require Records Officer action.
> 
> **¹⁶ Bulk export — classification boundary:** Export is bounded by the exporting user's maximum permitted classification level. No bulk export may include Confidential or Restricted documents unless the exporter is explicitly listed in that document type's allowlist. All bulk exports are individually logged in the audit trail.
> 
> **¹⁷ RA 10173 PII erasure:** A Records Officer may process a citizen erasure request only after receiving formal legal review clearance from the City Legal Office and/or the designated Data Privacy Officer. The Records Officer executes the action; they do not authorize it unilaterally. Each erasure creates a dedicated, permanently retained audit record (the audit record of the erasure itself is never erased).
> 
> **¹⁸ Complaint respondent / Citizen view as respondent:** A citizen who is a named respondent in a complaint receives formal written notification via email (if available) or phone. If the respondent has authenticated citizen portal access, they may view the complaint record to which they are a named party. They may not view other complaints. A citizen may view their own submitted complaint status at any time without restriction.

---

## 12. Architectural Invariants Encoded in This Matrix (role-precedence rules that constrain route-gating logic itself)

_Source: Section "Architectural Invariants Encoded in This Matrix" (full)_

> |Invariant|Matrix Enforcement|
> |---|---|
> |#3 — Audit log INSERT-only at DB role level|Section 15: "Write to audit log directly" is ❌ for all roles|
> |#10 — IT admin (System Administrator) has no document content access|Section 5: System Administrator is ❌ on all document file content and search rows|
> |#12 — Platform Administrator cannot be combined with operational roles|Enforced outside this matrix as a role assignment invariant; not expressible as a cell value|
> |#13 — Encoder and final approver of same document cannot be the same user|Enforced at workflow engine constraint level; not expressible as a cell value|
> |#16 — One active designation per person at any time|Conditional note ³; enforced via DB partial unique index on active `delegation_grants` per user|

[Inference] Invariant #12 is the one most directly relevant to F1's "required role(s)" field for Platform Administrator views specifically: since a Platform Administrator account can never simultaneously hold a document-processing role, any route built for "Platform Administrator views" can assume that role is mutually exclusive with SP Secretary, Department Encoder/Approver, Mayor, etc. — a Platform Administrator user will never also need to see, e.g., a Mayor-dashboard role check pass simultaneously. This narrows the access-control design space for those routes but is not itself a route or a permission row.

---

## 13. Items Considered and Excluded as Not Needed for F1

[Inference] As with the prior curation document's exclusion log, the following sections/rows were read in full but excluded here because they describe IAM/account-management mechanics or backend invariants with no corresponding named F1 view, rather than because they were skipped or overlooked:

- Section 1 (IAM) rows on account creation, editing, deactivation, role assignment/revocation, MFA enrollment, session force-termination, and citizen self-registration — these are account-management actions with no named route in F1's list (F1 does not name a "user management" or "account settings" view)
- Section 2 (Organization Structure) rows on designation grant creation/revocation/history (rows beyond the org-chart-view row already kept in Section 8 above) — Designations are explicitly Phase 1B per the consolidated requirements file, not Phase 1
- Section 9 (Signature Recording) — describes signature-upload mechanics tied to existing workflow step actions (already covered conceptually via Section 6 above); no distinct named view in F1 for "signatures" as such
- Section 17 (OCR and File Processing) — describes OCR-related permissions (scan quality indicator, re-upload, re-OCR trigger, extracted-text viewing); [Speculation] this likely belongs inside the document intake form's role-gating once that form's specific fields are finalized, but since the prior curation document already covered OCR behavior in narrative form (Section 4 of that document), reproducing the permission rows here would duplicate rather than add new gating information — flagged rather than included to avoid redundancy
- Conditional notes ¹, ³, ⁴, ⁸ — note ¹ (user directory scope) and note ³/⁴ (designation grant creation/revocation) pertain only to excluded IAM/Designation rows; note ⁸ (SP Member cross-office document view) pertains to a Section 5 row not kept above because it restates a pattern already shown via the kept Section 5 row and Section 6's routing-history row

[Speculation] As before, some of these exclusions are debatable — OCR permission gating in particular could matter directly to the document intake form's role logic. If review later shows a gap, the original matrix file remains available to re-check.

---

**Correction check:** No claims above were generated without a quoted source; everything outside quotation marks is either a heading, a verbatim Markdown table reproduced from source, or a labeled [Inference]/[Speculation]/[Unverified] note explaining a judgment call in what to include, exclude, or flag as unresolved. This document, like its companion, does not itself constitute F1 — F1 still requires inventing route paths, component names, and tRPC procedure names not present in any source file reviewed so far.