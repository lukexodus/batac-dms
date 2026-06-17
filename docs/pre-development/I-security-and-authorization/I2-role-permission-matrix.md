# I2 — Role-Permission Matrix

**Batac City LGU Platform**
Status: Pre-Development Baseline | June 2026
Audience: Development team — IAM configuration reference

---

## How to Read This Matrix

| Symbol | Meaning |
|--------|---------|
| ✅ | **Allow** — role may perform this action unconditionally |
| ❌ | **Deny** — role may never perform this action |
| 🔶 | **Conditional** — allowed subject to the stated condition (see footnotes) |
| — | **Not applicable** — the action category does not apply to this role |

**Scope rule:** All permissions are additionally bounded by office scope via ABAC. A Department Approver who has Allow on "Approve document" can only approve documents belonging to their own office. The matrix states the permission category; ABAC policies enforce the scope constraint at request time. PostgreSQL Row-Level Security enforces isolation at the database layer as a second line of defense.

**Role precedence:** A user holding multiple roles accumulates permissions; the most permissive applicable rule wins within a given office scope. The exception is the Platform Administrator role, which cannot be combined with any document-processing role (architectural invariant #12).

**Conditional notes are numbered** (e.g., ¹) and listed in full in the Conditional Notes section at the end.

---

## Roles Reference

| # | Role | Primary Scope |
|---|------|---------------|
| 1 | System Administrator | Infrastructure; no document content access |
| 2 | Platform Administrator | Configuration; no document processing |
| 3 | Records Officer | Archiving, retention, disposition |
| 4 | Department Encoder | Create and submit documents for their office |
| 5 | Department Approver | Approve documents at their office level |
| 6 | SP Secretary | Full SP legislative document lifecycle |
| 7 | SP Member | Review, comment, vote on legislative documents |
| 8 | SP Presiding Officer | Certify SP legislative output |
| 9 | Mayor | Highest executive approval authority |
| 10 | Barangay Encoder | Submit documents on behalf of a barangay |
| 11 | Barangay Captain | Approve and sign barangay-originated documents |
| 12 | Auditor | Read-only: finalized documents and audit logs |
| 13 | Citizen | Public portal; own submitted requests and complaints only |

---

## Section 1 — Identity and Access Management (IAM)

| Permission | Sys Admin | Plat Admin | Rec Officer | Dept Encoder | Dept Approver | SP Secretary | SP Member | SP Presiding | Mayor | Brgy Encoder | Brgy Captain | Auditor | Citizen |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Create user accounts | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit user accounts (name, contact, office) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Deactivate / reactivate user accounts | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assign roles to users | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Revoke roles from users | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View user directory (name, office, role) | ✅ | ✅ | ✅ | 🔶¹ | 🔶¹ | ✅ | 🔶¹ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| View own profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit own profile (non-security fields) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Change own password | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Enroll / manage own MFA (Phase 2) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Force-terminate any user session | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View active sessions (own) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View active sessions (all users) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Register citizen account (self) | — | — | — | — | — | — | — | — | — | — | — | — | ✅ |
| Register citizen account (clerk-assisted) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Section 2 — Organization Structure

| Permission | Sys Admin | Plat Admin | Rec Officer | Dept Encoder | Dept Approver | SP Secretary | SP Member | SP Presiding | Mayor | Brgy Encoder | Brgy Captain | Auditor | Citizen |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Create / edit office records | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Deactivate office records | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create / edit position records | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create / edit employee records | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assign employees to offices and positions | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View organization chart (all offices) | ✅ | ✅ | ✅ | 🔶² | 🔶² | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Create designation grant | ❌ | ❌ | ❌ | ❌ | ❌ | 🔶³ | ❌ | ❌ | 🔶³ | ❌ | ❌ | ❌ | ❌ |
| Revoke active designation grant early | ❌ | ❌ | ❌ | ❌ | ❌ | 🔶⁴ | ❌ | 🔶⁴ | 🔶⁴ | ❌ | ❌ | ❌ | ❌ |
| View active designations | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| View designation history | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |

---

## Section 3 — Platform Configuration

| Permission | Sys Admin | Plat Admin | Rec Officer | Dept Encoder | Dept Approver | SP Secretary | SP Member | SP Presiding | Mayor | Brgy Encoder | Brgy Captain | Auditor | Citizen |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Create / edit document type definitions | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Publish / deprecate document type definitions | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create / edit numbering series | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create / edit workflow definitions | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Publish / deprecate workflow definitions | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create / edit role definitions and permissions | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create / edit SLA thresholds and escalation targets | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create / edit notification templates | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create / edit retention schedules | ❌ | ✅ | 🔶⁵ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create / edit document type public visibility rules | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create / edit standing committee definitions | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Access system health and infrastructure metrics | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage encryption keys and secrets | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Execute database schema migrations | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Trigger backup and restore operations | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Section 4 — Document Creation and Submission

| Permission | Sys Admin | Plat Admin | Rec Officer | Dept Encoder | Dept Approver | SP Secretary | SP Member | SP Presiding | Mayor | Brgy Encoder | Brgy Captain | Auditor | Citizen |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Create new document (draft) — own office | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit document in Draft state — own office | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | 🔶⁶ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete document in Draft state (soft delete) — own office | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Submit document (Draft → Submitted) — own office | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Upload file attachment to document — own office | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | 🔶⁶ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Remove file attachment (soft delete) — own office | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create document on behalf of another user (clerk-assisted) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assign preliminary series number (Draft prefix) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assign final series number (remove Draft prefix) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Cancel document (from any active state) — own office | ❌ | ❌ | ❌ | 🔶⁷ | ✅ | ✅ | ❌ | ✅ | ✅ | 🔶⁷ | ✅ | ❌ | ❌ |
| Log Certification of Urgency (attach to measure) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Log Designation document (extract scope, enter in system) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Generate transmittal letter (SPS) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Generate Order of Business | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Section 5 — Document Viewing and Search

| Permission | Sys Admin | Plat Admin | Rec Officer | Dept Encoder | Dept Approver | SP Secretary | SP Member | SP Presiding | Mayor | Brgy Encoder | Brgy Captain | Auditor | Citizen |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| View document metadata — own office | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View document metadata — all offices (Internal classification) | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| View document file content — own office (Internal classification) | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View document file content — all offices (Internal classification) | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | 🔶⁸ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| View document file content — Confidential / Restricted | ❌ | ❌ | 🔶⁹ | ❌ | ❌ | 🔶⁹ | ❌ | ❌ | 🔶⁹ | ❌ | ❌ | ❌ | ❌ |
| View document version history | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Download document file — own office | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Download document file — all offices (Internal) | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | 🔶⁸ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Full-text search across documents | ❌ | ❌ | ✅ | 🔶¹⁰ | 🔶¹⁰ | ✅ | 🔶¹⁰ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| View Public-classification documents | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔶¹¹ |

---

## Section 6 — Workflow Execution

| Permission | Sys Admin | Plat Admin | Rec Officer | Dept Encoder | Dept Approver | SP Secretary | SP Member | SP Presiding | Mayor | Brgy Encoder | Brgy Captain | Auditor | Citizen |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Initiate a workflow instance | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Complete an assigned action step | ❌ | ❌ | ❌ | 🔶¹² | ✅ | ✅ | ✅ | ✅ | ✅ | 🔶¹² | ✅ | ❌ | ❌ |
| Complete an assigned approval step (Approve) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Complete an assigned approval step (Reject) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Complete an assigned approval step (Return for revision) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Log Secretariat decision (Approve / Reject / Amended) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Record First Reading referral to committee | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | 🔶¹³ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Submit committee report (multi-referral step) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | 🔶¹⁴ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manually advance multi-referral step (override missing report) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Record SP session vote outcome | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Certify document (SP Presiding Officer step) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Sign / approve document (Mayor step) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Veto document (Mayor step) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Log 10-day Mayor lapse (system-triggered; manual confirmation) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Record veto override vote | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Log docketing step completion | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Record Panlalawigan review outcome | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Confirm Panlalawigan 30-day deemed-approved lapse | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Record newspaper publication date (penalty ordinances) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Migrate in-flight workflow instance to new definition version (Option B) | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View workflow instance status and routing history | ❌ | ✅ | ✅ | 🔶¹⁰ | 🔶¹⁰ | ✅ | 🔶¹⁰ | ✅ | ✅ | 🔶¹⁰ | 🔶¹⁰ | ✅ | ❌ |

---

## Section 7 — Document Tracking (DTS)

| Permission | Sys Admin | Plat Admin | Rec Officer | Dept Encoder | Dept Approver | SP Secretary | SP Member | SP Presiding | Mayor | Brgy Encoder | Brgy Captain | Auditor | Citizen |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Generate QR code for document | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Print QR cover sheet | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Log physical routing entry (forward to / receive from) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Scan QR code (authenticated in-app scan) | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Scan QR code (public portal — unauthenticated) | — | — | — | — | — | — | — | — | — | — | — | — | ✅ |
| View full routing history — own office | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View full routing history — all offices | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| View physical custody status | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Lookup document by tracking number (public) | — | — | — | — | — | — | — | — | — | — | — | — | ✅ |

---

## Section 8 — Session Attendance and Order of Business

| Permission | Sys Admin | Plat Admin | Rec Officer | Dept Encoder | Dept Approver | SP Secretary | SP Member | SP Presiding | Mayor | Brgy Encoder | Brgy Captain | Auditor | Citizen |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Create / manage session records | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Record session attendance (who is absent, reason) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View session attendance record | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| View Order of Business (current session) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Schedule document for first reading (add to Order of Business) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Enter committee hearing date (from committee communication) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View attendance statistics and graphs | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |

---

## Section 9 — Signature Recording

| Permission | Sys Admin | Plat Admin | Rec Officer | Dept Encoder | Dept Approver | SP Secretary | SP Member | SP Presiding | Mayor | Brgy Encoder | Brgy Captain | Auditor | Citizen |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Upload scanned signature image for own document actions | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Flag scanned-back document for manual verification | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Accept scanned-back signed document as official copy | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View signature records for a document | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## Section 10 — Records Management (RMS)

| Permission | Sys Admin | Plat Admin | Rec Officer | Dept Encoder | Dept Approver | SP Secretary | SP Member | SP Presiding | Mayor | Brgy Encoder | Brgy Captain | Auditor | Citizen |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Promote document to official record status | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Apply / change retention schedule on a record | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Apply / change classification level on a record | ❌ | ❌ | ✅ | ❌ | ❌ | 🔶¹⁵ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Archive document (move to inactive → archived) | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Initiate authorized disposition of a record | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Place a record under legal hold | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Remove a legal hold from a record | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Bulk archive (Records Officers only, with confirmation + dry-run) | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Bulk search records | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Bulk export records (bounded by classification) | ❌ | ❌ | 🔶¹⁶ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View retention schedules list | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Process citizen RA 10173 PII erasure request | ❌ | ❌ | 🔶¹⁷ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Section 11 — Notifications

| Permission | Sys Admin | Plat Admin | Rec Officer | Dept Encoder | Dept Approver | SP Secretary | SP Member | SP Presiding | Mayor | Brgy Encoder | Brgy Captain | Auditor | Citizen |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Receive in-app notifications (assigned steps, SLA alerts) | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| Receive escalation notifications (SLA breach) | — | — | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | — | — |
| Receive complaint respondent notification (email or phone) | — | — | — | — | — | — | — | — | — | — | — | — | 🔶¹⁸ |
| Mark notifications as read (own) | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Configure own notification preferences | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View delivery logs (all notifications) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Section 12 — Citizen Complaints

| Permission | Sys Admin | Plat Admin | Rec Officer | Dept Encoder | Dept Approver | SP Secretary | SP Member | SP Presiding | Mayor | Brgy Encoder | Brgy Captain | Auditor | Citizen |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Submit complaint (self) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Submit complaint (clerk-assisted, in-person) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Log and assign complaint to committee / VM | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Enter committee report on complaint | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | 🔶¹⁴ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Set complaint outcome state (Dismissed / Resolved) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View own submitted complaint and status | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View all complaints (SP Secretariat only) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | 🔶¹⁴ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View complaint as respondent | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🔶¹⁸ |

---

## Section 13 — Document and Records Request

| Permission | Sys Admin | Plat Admin | Rec Officer | Dept Encoder | Dept Approver | SP Secretary | SP Member | SP Presiding | Mayor | Brgy Encoder | Brgy Captain | Auditor | Citizen |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Submit document request (self, via portal) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Generate printable document request form | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Log / enter clerk-assisted document request | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve document request (Vice Mayor step) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve document request (SP Secretary step) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Release copy to requester (after payment) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View all document requests | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View own document request status | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Section 14 — Public Portal Access

| Permission | Sys Admin | Plat Admin | Rec Officer | Dept Encoder | Dept Approver | SP Secretary | SP Member | SP Presiding | Mayor | Brgy Encoder | Brgy Captain | Auditor | Citizen |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| View published document title and first page (public) | — | — | — | — | — | — | — | — | — | — | — | — | ✅ |
| Lookup document status by tracking number (public) | — | — | — | — | — | — | — | — | — | — | — | — | ✅ |
| Publish document to public portal | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Unpublish document from public portal | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Post announcement on public portal | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Section 15 — Audit Log

| Permission | Sys Admin | Plat Admin | Rec Officer | Dept Encoder | Dept Approver | SP Secretary | SP Member | SP Presiding | Mayor | Brgy Encoder | Brgy Captain | Auditor | Citizen |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| View audit log — own actions | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View audit log — own office documents | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| View audit log — all entries (full log) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Validate audit log hash chain integrity | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Export audit log (bounded by classification) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Write to audit log directly | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Note:** No role may write directly to the audit log. All audit writes are performed exclusively through the audit service (INSERT-only at DB permission level). This row is included as an explicit Deny-all to enforce the architectural invariant.

---

## Section 16 — Reporting and Dashboards

| Permission | Sys Admin | Plat Admin | Rec Officer | Dept Encoder | Dept Approver | SP Secretary | SP Member | SP Presiding | Mayor | Brgy Encoder | Brgy Captain | Auditor | Citizen |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| View SP Secretary dashboard (queue, pending, session calendar) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View Mayor dashboard (pending signatures, overdue items) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View own task inbox / assigned steps | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| View ARTA SLA compliance report | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| View Panlalawigan review tracking summary | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| View Index of Ordinances / Index of Resolutions | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Create / edit report definitions (Phase 2) | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Run saved report | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Export report output | ❌ | ✅ | 🔶¹⁶ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |

---

## Section 17 — OCR and File Processing

| Permission | Sys Admin | Plat Admin | Rec Officer | Dept Encoder | Dept Approver | SP Secretary | SP Member | SP Presiding | Mayor | Brgy Encoder | Brgy Captain | Auditor | Citizen |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| View OCR scan quality indicator for own upload | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Re-upload document after reviewing scan quality indicator | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Trigger manual re-OCR on existing file | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View OCR extracted text | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## Conditional Notes

**¹ User directory — limited view:** Department Encoders, Department Approvers, and SP Members may view the directory only to the extent needed to address or route documents — name, office, and position visible; sensitive account details (last login, credential status) not visible.

**² Organization chart — own office visible by default:** Department Encoders and Approvers see the full organization chart for read-only reference. They may not edit any record.

**³ Create designation grant:** The Mayor may create delegation grants within executive branch scope. The SP Presiding Officer (Vice Mayor) may create delegation grants within legislative branch scope (e.g., designating a Councilor as Acting Presiding Officer). The SP Secretary logs the Designation document issued by the designating authority; the Secretary does not independently create delegation grants. No Platform Administrator confirmation step is required — the grant takes immediate effect upon logging. (Architectural invariant #16: one active designation per person enforced.)

**⁴ Revoke designation grant early:** The designating authority (whoever created the grant: Mayor or Vice Mayor) may revoke it early. The SP Secretary may revoke a grant only at the explicit written instruction of the designating authority. Open-ended revocations (with no documented instruction) are not permitted.

**⁵ Retention schedules — Records Officer can propose:** Records Officers may draft changes to retention schedules, but final activation of a new schedule requires Platform Administrator action. Existing schedules may be applied by the Records Officer to individual records without Platform Administrator involvement.

**⁶ SP Member document editing:** SP Members may edit and upload attachments to documents they have personally authored (as the originating Councilor/drafter). They may not edit documents authored by another SP Member or entered by the Secretariat.

**⁷ Cancel document — Encoder scope:** A Department Encoder may cancel a document only while it is in Draft or Submitted state and has not yet entered an active workflow instance. Once a workflow instance is live, cancellation requires the Approver or SP Secretary. Similarly for Barangay Encoder.

**⁸ SP Member view across offices:** SP Members may view the file content and routing history of any document assigned to a committee they are a member of or that has been read into an SP session. They do not have general cross-office read access.

**⁹ Confidential / Restricted access:** Access to documents classified Confidential or Restricted is granted via an explicit role allowlist configured per document type by the Platform Administrator. The matrix rows for Mayor, SP Secretary, and Records Officer reflect that these roles are commonly included in such allowlists (particularly for Administrative Cases — see Part 4.13). Actual access is determined by the allowlist, not by this matrix alone.

**¹⁰ Workflow status and search — scoped:** Department Encoders, Approvers, SP Members, Barangay Encoders, and Barangay Captains may view workflow instance status and search documents only for documents belonging to their own office (or, for SP Members, documents in their assigned committees or SP sessions). ABAC policies enforce this scope at request time; PostgreSQL RLS enforces it at the database layer.

**¹¹ Citizen public document view:** Citizens (including unauthenticated visitors to the public portal) may view the title and first page of documents classified as Public. All subsequent pages are blurred. Full document access requires a Document Request Form, Vice Mayor and SP Secretary approval, and payment (payment processing deferred to a later phase).

**¹² Action step — Encoder scope:** Department Encoders may complete action steps only on documents they created or on documents explicitly assigned to them within their office's workflow. They do not have general action-step access across their office's queue. Barangay Encoders are similarly scoped to their own barangay's documents.

**¹³ Record First Reading referral — Presiding Officer:** The Vice Mayor (SP Presiding Officer) directs committee referral verbally during a session. The SP Secretary logs this referral in the system. The permission here reflects the Presiding Officer's ability to log the referral decision themselves if present at a terminal; in practice the Secretary performs this action.

**¹⁴ SP Member committee-scoped actions:** SP Members may submit committee reports, view complaints, and view documents only for committees of which they are a confirmed member (per the standing committee definitions in Part 6 of the domain context). They do not have blanket SP-wide access to these actions.

**¹⁵ SP Secretary classification change:** The SP Secretary may apply or change classification levels on SP-originated documents only (documents owned by the SP Secretariat). Documents owned by other offices require Records Officer action.

**¹⁶ Bulk export — classification boundary:** Export is bounded by the exporting user's maximum permitted classification level. No bulk export may include Confidential or Restricted documents unless the exporter is explicitly listed in that document type's allowlist. All bulk exports are individually logged in the audit trail.

**¹⁷ RA 10173 PII erasure:** A Records Officer may process a citizen erasure request only after receiving formal legal review clearance from the City Legal Office and/or the designated Data Privacy Officer. The Records Officer executes the action; they do not authorize it unilaterally. Each erasure creates a dedicated, permanently retained audit record (the audit record of the erasure itself is never erased).

**¹⁸ Complaint respondent / Citizen view as respondent:** A citizen who is a named respondent in a complaint receives formal written notification via email (if available) or phone. If the respondent has authenticated citizen portal access, they may view the complaint record to which they are a named party. They may not view other complaints. A citizen may view their own submitted complaint status at any time without restriction.

---

## Architectural Invariants Encoded in This Matrix

The following invariants from Part 12 of the consolidated reference are directly reflected in the matrix and must be enforced at the database layer, application layer, and code review policy — not only in the UI.

| Invariant | Matrix Enforcement |
|---|---|
| #3 — Audit log INSERT-only at DB role level | Section 15: "Write to audit log directly" is ❌ for all roles |
| #10 — IT admin (System Administrator) has no document content access | Section 5: System Administrator is ❌ on all document file content and search rows |
| #12 — Platform Administrator cannot be combined with operational roles | Enforced outside this matrix as a role assignment invariant; not expressible as a cell value |
| #13 — Encoder and final approver of same document cannot be the same user | Enforced at workflow engine constraint level; not expressible as a cell value |
| #16 — One active designation per person at any time | Conditional note ³; enforced via DB partial unique index on active `delegation_grants` per user |

---

*This matrix supersedes any implicit permission assumptions in prior architecture documents. Update this document whenever a new permission category is introduced or a role scope changes. Version this file alongside workflow definition changes.*
