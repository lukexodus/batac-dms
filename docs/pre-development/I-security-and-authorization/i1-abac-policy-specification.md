# I1 — ABAC Policy Specification

**Batac City LGU Platform** **Status:** Pre-Development Baseline — Blocking Document **Last Updated:** June 2026 **Audience:** Backend development team **Depends on:** I2 (Role-Permission Matrix), B5 (Authentication & Authorization Architecture), Consolidated Architecture & Requirements Reference (Iteration 3)

## Table of Contents

- [L77–L101] Document Notes — Definitions of status notation labels and cross-document specification relationships to B5, I2, and H2.
- [L102–L126] 1. Subject Attributes Reference — Schema sources, JWT caching rules, and refresh staleness limits for subject attributes including committee memberships.
- [L127–L219] 2. Global Cascade Gates — Pre-RBAC security checks covering multi-tenancy, IT and Platform Admin isolation invariants, classification allowlists, and soft-delete gates.
- [L220–L546] 3. Resource Type: `document`
  - [L224–L230] Subject Attributes Used — List of fields on the SubjectContext object referenced by document resource policy conditions.
  - [L231–L241] Resource Attributes Used — List of document-specific schema columns and logic fields evaluated in document policy rules.
  - [L242–L276] 3.1 `document:create` — Role permission rules for document drafting, including special originating office defaults for SP ordinances and resolutions.
  - [L277–L341] 3.2 `document:read` (metadata) — Access rules for document metadata, including committee-scoped access and the has_cross_office_read_grant database helper function definition.
  - [L342–L373] 3.3 `document:update` (non-state-change edits: title, metadata fields, attachments) — Direct update rules for drafts, restricting SP members to self-authored documents and locking direct edits post-submission.
  - [L374–L398] 3.4 `document:delete` (soft-delete only) — Soft-delete rules limiting encoder delete authority to pre-workflow states, and absolute prohibition of hard database deletes.
  - [L399–L420] 3.5 `document:submit` (Draft → Submitted) — Rules for submitting drafts, including the requirement of the SP Secretary role for SP workflow documents.
  - [L421–L448] 3.6 `document:cancel` (any active state → Cancelled) — Cancellation authority rules across lifecycle states, requiring mandatory audit-logged reasons for all cancellation actions.
  - [L449–L468] 3.7 `document:number_assign` (assign preliminary number) — Rules for assigning preliminary numbers to SP measures, restricted to the SP Secretary at secretariat logging.
  - [L469–L492] 3.8 `document:number_promote` (assign final number, remove Draft prefix) — Promotion rules from preliminary to final numbers after reading votes, enforcing immutability via database constraints.
  - [L493–L509] 3.9 `document:certify_urgent` (log Certification of Urgency) — Logging rules for certifications of urgency, restricting logging to the SP Secretary for active committee-stage measures.
  - [L510–L528] 3.10 `document:archive` (Completed/Released → Archived) — Archiving permissions for completed documents, restricted to Records Officers and SP Secretaries within their office scopes.
  - [L529–L546] 3.11 `document:publish_portal` (publish to public portal) — Portal publication rules for public or partially-visible SP measures, restricted to the SP Secretary.
- [L547–L653] 4. Resource Type: `document_version` and `document_attachment`
  - [L551–L557] Resource Attributes Used — List of document-specific schema columns and logic fields evaluated in document policy rules.
  - [L558–L597] 4.1 `document_version:read` / `document_attachment:read` (file content) — Access rules for document version and attachment files, inheriting document classification constraints and enforcing IT Admin content block.
  - [L598–L613] 4.2 `document_version:create` (upload new version / attachment) — Permissions for uploading new versions and attachments, restricting SP members to self-authored documents.
  - [L614–L632] 4.3 OCR Text Access — Access policies for OCR-extracted text, treated as document content and matching file version read permissions.
  - [L633–L653] 4.4 Scan Quality Indicator Access — Access rules for document scan and OCR quality metrics, limited to authoring and owning office users.
- [L654–L708] 5. Resource Type: `workflow_instance` — Read rules for workflow tracking, and migration authority of in-flight instances restricted to Platform Administrators.
- [L709–L896] 6. Resource Type: `workflow_step_instance`
  - [L713–L720] Resource Attributes Used — List of document-specific schema columns and logic fields evaluated in document policy rules.
  - [L721–L741] 6.1 `step_instance:read` (view assigned step) — Read access rules for pending and active steps, limited to assignee, owning office, or specific supervisor roles.
  - [L742–L766] 6.2 `step_instance:complete_action` (action step — encoder/operational) — Execution rules for action-type steps, restricting encoder roles to steps they created or are explicitly assigned.
  - [L767–L805] 6.3 `step_instance:approve` / `step_instance:reject` / `step_instance:return` — Approval step rules, including the final approver segregation check and the is_final_approval_step schema configuration definition.
  - [L806–L818] 6.4 `step_instance:certify` (VP certification step) — Certification step permissions restricted to the SP Presiding Officer or their explicitly delegated representative.
  - [L819–L834] 6.5 `step_instance:mayor_sign` / `step_instance:mayor_veto` — Executive review step actions restricted to the Mayor or their designated delegates under active authorization.
  - [L835–L851] 6.6 `step_instance:submit_committee_report` (multi-referral step) — Submission rules for committee reports, limited to SP Secretary and committee members cached via JWT claims.
  - [L852–L865] 6.7 `step_instance:advance` (manual override — skip missing committee report) — Manual override rules allowing the SP Secretary to bypass pending committee reports with mandatory audit-logged justifications.
  - [L866–L879] 6.8 Secretariat Decision Actions — Decision logging rules restricted to the SP Secretary for steps assigned to the SP Secretariat office.
  - [L880–L896] 6.9 Panlalawigan Review Actions — Outcome tracking rules for provincial review, including manual logging of deemed approval status by the SP Secretary.
- [L897–L987] 7. Resource Type: `tracking_record` and `routing_entry` — Permissions for tracking history, physical routing logs, QR code generation, and public versus authenticated QR scanning details.
- [L988–L1073] 8. Resource Type: `audit_event` — Write isolation invariants, read permissions for own-actions or office-scoped events, auditor export limits, and hash chain validation.
- [L1074–L1197] 9. Resource Type: `record` (RMS)
  - [L1078–L1085] Resource Attributes Used — List of document-specific schema columns and logic fields evaluated in document policy rules.
  - [L1086–L1102] 9.1 `record:promote` (document → official record) — Permissions for promoting completed documents to official records, restricted to Records Officers and SP Secretaries.
  - [L1103–L1111] 9.2 `record:apply_retention_schedule` — Authority rules for applying retention schedules to records, restricted to the Records Officer role.
  - [L1112–L1124] 9.3 `record:apply_classification` — Authority for applying classification levels to records, restricted to Records Officers and SP Secretariat staff.
  - [L1125–L1135] 9.4 `record:archive` — Archiving permissions for active or inactive records, restricted to Records Officers and blocked under legal holds.
  - [L1136–L1151] 9.5 `record:bulk_archive` — Safety rules for bulk archiving, including dry-run previews, classification allowlist checks, and individual audit logging.
  - [L1152–L1160] 9.6 `record:place_legal_hold` / `record:remove_legal_hold` — Legal hold control permissions restricted to Records Officers, preventing modifications to record retention periods.
  - [L1161–L1179] 9.7 `record:initiate_disposition` — Disposition rules for expired records, requiring manual Records Officer action and prohibiting hard database deletions.
  - [L1180–L1197] 9.8 `record:pii_erasure` (RA 10173) — PII erasure rules under RA 10173, requiring legal clearance and generating permanent, non-erasable audit entries.
- [L1198–L1282] 10. Resource Type: `citizen_complaint` — Creation, assignment, reading, and outcome resolution rules for complaints, covering citizens, Secretariat clerks, and committee members.
- [L1283–L1350] 11. Resource Type: `delegation_grant` — Designation creation constraints, early revocation procedures, read scopes, and the database unique active-designation index validation.
- [L1351–L1388] 12. Resource Type: `session` — Session read permissions and IT Admin authority to force terminate active sessions with mandatory audit logging.
- [L1389–L1445] 13. Resource Type: `document_request` — Request submission rules and sequential approval workflows requiring signatures from both the Vice Mayor and SP Secretary.
- [L1446–L1484] 14. Resource Type: `number_series` — Read and management permissions for number series configs, and internal sequence consumption rules for the numbering service.
- [L1485–L1633] 15. Architectural Invariants — Complete Formal Statement
  - [L1489–L1500] Invariant #2 — No Hard Deletes — Absolute system-wide prohibition of hard database deletes, enforcing soft-delete only across all resources and subjects.
  - [L1501–L1516] Invariant #3 — Audit Log Write Isolation — Enforcement of write access limits to the audit log, restricting write operations solely to the audit service.
  - [L1517–L1526] Invariant #8 — Tenant Isolation — Mandatory isolation check denying cross-city resource requests based on matching subject and resource city identifiers.
  - [L1527–L1539] Invariant #9 — Final Number Immutability — Absolute immutability of assigned final numbers, enforced via application checks and database-level constraints.
  - [L1540–L1556] Invariant #10 — IT Admin Document Content Isolation — Content isolation rules blocking IT Administrators from reading or exporting confidential/restricted document content, versions, or OCR text.
  - [L1557–L1585] Invariant #12 — Platform Administrator Role Exclusion — Trigger-enforced prohibition against combining Platform Administrator and operational document-processor roles, with noted acting-mayor delegation gaps.
  - [L1586–L1611] Invariant #13 — Encoder Cannot Be Final Approver — Segregation of duties rule preventing a document's creator or submitter from executing its final workflow approval step.
  - [L1612–L1633] Invariant #16 — One Active Designation Per Person — Uniqueness constraint preventing multiple concurrent delegation grants per user, enforced by database partial unique index.
- [L1634–L1686] 16. Delegation Grant Scope Expansion — Scope expansion mechanics for designations, listing non-overridable constraints, auto-expiry behaviors, and Step 7d scope narrowing rules.
- [L1687–L1712] 17. State-Action Compatibility Matrix — Grid mapping valid actions per document lifecycle state, including numbering promotion rules and disposed document audit visibility.
- [L1713–L1729] 18. Deferred Decisions (Resolved This Revision) — Tracking table documenting the resolutions and document locations for six previously deferred design decisions (D-ABAC-01 through 06).
- [L1730–L1740] 19. Remaining Open Items — Table tracking unresolved items, specifically the delegation-exclusion trigger gap, along with its resolution urgency and impact.

---

---

## Document Notes

### Notation

|Label|Meaning|
|---|---|
|[Confirmed — source]|Present in a cited part of the Consolidated Architecture & Requirements Reference or stack documents|
|[Inference]|Logically derived from confirmed facts; not stated verbatim in the source. Requires team review before implementation.|
|[Unresolved]|Must be decided before the IAM module's first migration or relevant feature implementation. Tracked in Section 19.|
|[Resolved — D-XXX-NN] / [Decision — D-XXX-NN]|Formally decided in this revision for a previously [Unresolved] item. Recorded against the item's ID in Section 18. Where the decision required organizational/product judgment rather than pure schema design, it was confirmed with the development team lead before being recorded here, not assumed unilaterally.|

Policy condition expressions use a pseudo-code format intended to be language-agnostic. The implementer translates these into the TypeScript `PolicyEvaluator` service described in B5 §10.1–10.2. Exact attribute names follow the column names in the database schema where known; where the schema is not yet finalised, logical names are used and marked [Inference].

### Relationship to Other Documents

This document is the **implementation spec** that the `PolicyEvaluator` service is written from. It is the authoritative source for what the evaluator must check. Other documents it depends on:

- **B5** defines the evaluation cascade structure (steps 1–8) and the subject context object. This document fills in the concrete conditions for each resource type within that cascade.
- **I2** defines which roles hold which abstract permissions. This document defines the attribute refinements that constrain those permissions at runtime.
- **H2** defines document type codes and classification defaults. Those codes are referenced in policies below.

This document does **not** redefine the cascade structure from B5 §5.5. It assumes that structure and specifies what happens at each step for each resource type.

---

## 1. Subject Attributes Reference

Every policy evaluation receives a `SubjectContext` object populated by the `verifyAccessToken` and `loadDelegationContext` hooks (B5 §10.1). All policies below reference these attributes by name.

|Attribute|Type|Source|Notes|
|---|---|---|---|
|`subject.user_id`|UUID|JWT `uid` claim|Internal `iam.users.id`|
|`subject.office_id`|UUID|JWT `oid` claim|Primary office from `organization.assignments`|
|`subject.roles`|string[]|JWT `rid` claim (role codes)|Active role assignments at token issue time|
|`subject.permissions`|string[]|JWT `perm` claim|Resolved permission codes at token issue time|
|`subject.city_id`|UUID|JWT `city` claim|Always Batac City UUID in Phase 1|
|`subject.session_id`|UUID|JWT `sid` claim|Active `iam.sessions.id`|
|`subject.is_ita`|boolean|JWT `is_ita` claim|True when holding System Administrator role|
|`subject.is_pa`|boolean|JWT `is_pa` claim|True when holding Platform Administrator role|
|`subject.delegation_grant_id`|UUID \| null|JWT `dg` claim|Active `organization.delegation_grants.id`; null if none|
|`subject.effective_office_ids`|UUID[]|Loaded by `loadDelegationContext`|Includes delegation-extended offices; always includes `subject.office_id`|
|`subject.effective_roles`|string[]|Loaded by `loadDelegationContext`|Includes delegation-extended roles|
|`subject.committee_ids`|UUID[]|JWT `cid` claim|Active `organization.committee_memberships` rows for the subject at token issue time. **[Resolved — D-ABAC-06]**|

**Timing note:** `roles` and `permissions` are resolved at token issue time. Role changes during an active token's lifetime do not take effect until next refresh. Emergency revocations require forced session termination (B5 §4.5). [Confirmed — B5 §1.1]

**Timing note — `committee_ids`:** Cached into the JWT at token issue, following the same pattern as `roles` and `permissions`. A committee membership change (added or removed) does not take effect until the subject's next token refresh — identical staleness behavior to role changes. This keeps a single timing model for "things that can change while a token is live" rather than introducing a second, live-lookup model alongside it. Emergency removal from a committee for cause would use the same forced session termination path used for emergency role revocations (B5 §4.5). [Decision — D-ABAC-06]

---

## 2. Global Cascade Gates

These gates run **before** any resource-specific policy. They are hardcoded in the `PolicyGuard` service and are not configurable by any role. The first `DENY` terminates evaluation immediately. [Confirmed — B5 §5.5]

### Gate 1 — City Isolation

```
IF resource.city_id ≠ subject.city_id
  THEN DENY
  REASON: "tenant_isolation"
```

Applies to every resource type in every schema. Cannot be overridden by any role or delegation grant. [Confirmed — Consolidated Reference Part 11.9, Invariant #8]

### Gate 2 — IT Admin Content Isolation

```
IF subject.is_ita = true
  AND resource.type IN (document_version, document_attachment)
  AND resource.parent_classification_level IN ('confidential', 'restricted')
  AND action IN ('read', 'download', 'export', 'bulk_export', 'scan_qr_content')
  THEN DENY
  REASON: "it_admin_content_isolation_invariant"
```

IT Administrators have zero access to document content — file bytes, OCR text, version blobs — when the owning document is classified Confidential or Restricted. Applies to document versions and attachments only. Document metadata (title, status, number) remains readable to IT Admin to support operational monitoring. Cannot be overridden by any configuration. [Confirmed — Consolidated Reference Part 12 Invariant #10; B5 §7]

**Extended to OCR text:** OCR-extracted text is treated as document content. An IT Admin may not read OCR text for Confidential or Restricted documents. [Inference — consistent with the invariant's rationale]

### Gate 3 — Platform Administrator Operational Exclusion

```
IF subject.is_pa = true
  AND action NOT IN (
    'manage_roles', 'manage_workflow_def', 'manage_document_types',
    'manage_number_series', 'manage_retention_schedules', 'manage_sla_config',
    'manage_notification_templates', 'manage_office_hierarchy',
    'manage_standing_committees', 'manage_public_visibility_rules',
    'read_org_structure', 'read_workflow_definitions', 'read_user_directory',
    'post_announcement', 'run_report', 'export_report'
  )
  THEN DENY
  REASON: "platform_admin_operational_exclusion_invariant"
```

Platform Administrators configure the system; they do not process documents, act on workflow steps, create or approve documents, assign numbers, or perform any operational document action. Cannot be overridden by role assignment or delegation. [Confirmed — Consolidated Reference Part 12 Invariant #12; Part 11.8 Tier 2; B5 §8]

### Gate 4 — Classification Gate

```
IF resource.classification_level IN ('confidential', 'restricted')
  AND subject does not appear in the explicit_allowlist for resource.document_type_id
  THEN DENY
  REASON: "classification_denied"

"appears in the explicit_allowlist" resolves to:
  EXISTS (
    SELECT 1 FROM documents.classification_allowlists a
    WHERE a.document_type_id = resource.document_type_id
      AND a.role_code = ANY(subject.roles)
  )
```

Explicit allowlists for Confidential and Restricted document types are configured per document type by the Platform Administrator. The default allowlist for Administrative Cases (the only confirmed Confidential type) includes SP Secretary and Mayor roles only. [Confirmed — I2 Conditional Note ⁹; Consolidated Reference Part 4.13]

**Allowlist schema — [Resolved — D-ABAC-02]:** `documents.classification_allowlists` is a role-membership table, not a JSONB field on the document type row:

```sql
CREATE TABLE documents.classification_allowlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id UUID NOT NULL REFERENCES documents.document_types(id),
  role_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES iam.users(id),
  UNIQUE (document_type_id, role_code)
);
```

A discrete row-per-(document_type, role) table was chosen over a JSONB array column on `document_types` for three reasons: (1) Gate 4 runs on every read/download/export of every Confidential/Restricted document, so the check should be a simple indexed `EXISTS` rather than a JSONB containment scan; (2) the Platform Administrator allowlist-management UI (Tier 2, Part 11.8) needs to add/remove single rows with individual `created_by`/`created_at` provenance, which a JSONB blob would not give without an extra audit layer on top; (3) every other permission-like check in this document is modeled as role-set membership (`subject.roles ∩ {...}`), so this keeps the same shape rather than introducing a second pattern. This is a schema-design decision made under the discretion granted for this item; it does not require further stakeholder confirmation but should be reviewed by the team alongside other `[Inference]`-derived schema choices before the Documents module migration is written.

### Gate 5 — Soft-Delete Gate

```
IF resource.deleted_at IS NOT NULL
  AND action NOT IN ('read', 'read_metadata', 'view_audit_trail')
  THEN DENY
  REASON: "resource_soft_deleted"
```

Soft-deleted resources remain readable by any role that could read them before deletion, to support audit and records investigation. No other action is permitted on a soft-deleted resource. Hard deletion is prohibited by all roles (Invariant #2). [Confirmed — Consolidated Reference Part 12 Invariant #2; Part 11.4]

---

## 3. Resource Type: `document`

A `document` resource corresponds to a row in `documents.documents`. Policies below apply to the document record itself — metadata, lifecycle state, and classification. Policies for file content (versions, attachments) are in Section 4.

### Subject Attributes Used

- `subject.office_id` / `subject.effective_office_ids`
- `subject.roles`
- `subject.user_id`
- `subject.is_ita`, `subject.is_pa`

### Resource Attributes Used

- `document.office_id` — owning office
- `document.originating_office_id` — originating office
- `document.classification_level` — PUBLIC | INTERNAL | CONFIDENTIAL | RESTRICTED
- `document.lifecycle_state` — Draft | Submitted | In-Workflow | Pending-Approval | Completed | Released | Archived | Disposed | Cancelled
- `document.document_type_id` / `document.document_type_code`
- `document.created_by` — UUID of the user who created the draft

---

### 3.1 `document:create`

```
ALLOW IF:
  subject.roles ∩ {
    'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
    'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain'
  } ≠ ∅

  AND subject.office_id ∈ subject.effective_office_ids
    (i.e. the user is creating a document for their own office or a
     delegation-extended office)

  AND document.document_type requires a workflow that the subject's office
    is permitted to originate
    [Inference: document type definitions carry an allowed_originating_office_types
     field; enforced at application layer]

SPECIAL RULE — SP workflow documents:
  For document_type_code IN ('SP_RESOLUTION', 'SP_ORDINANCE',
  'SP_APPROPRIATION_ORDINANCE'):
    originating_office_id is always set to SP Secretariat's office_id
    regardless of which user creates the record
    [Confirmed — H2 §Originating office rules; Q-B03]

    SP Members may create drafts of these types because Councilors author
    draft resolutions/ordinances; the SP Secretary then formally logs them.
    The SP Secretary role is additionally required for the formal submission
    step (see document:submit below).
```

**Negative:** Platform Administrators, System Administrators, Records Officers, Auditors, and Citizens may not create documents. [Confirmed — I2 Section 4]

---

### 3.2 `document:read` (metadata)

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
        [Resolved — D-ABAC-06: subject.committee_ids is the JWT-cached
         committee membership claim defined in Section 1]
      OR document has been read into an SP session
    )
    [Inference — consistent with I2 Conditional Note ⁸]
  )
  OR (
    -- Public classification: all authenticated users + unauthenticated portal users
    document.classification_level = 'public'
  )
```

**Negative — Confidential/Restricted:** Gate 4 blocks access unless the subject is on the explicit allowlist. IT Admin may read metadata (title, status, number) of Confidential/Restricted documents but not content (Gate 2 covers content). [Confirmed — B5 §7.3]

**`has_cross_office_read_grant()` — [Resolved — D-ABAC-03]:** This document's RLS policies call a function of this name; B5 §6.5 [as reported — not independently verified against B5 itself] resolved the underlying grant storage as `organization.cross_office_grants` (D-AUTH-09), with two named limitations carried forward there as non-blocking: non-"all" office scoping, and `access_level` not yet enforced. This document's contribution is the function signature that the policies above and the RLS layer actually invoke:

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
        -- NULL office_id = "all offices" grant; per B5's carried-forward
        -- limitation, non-"all" scoping beyond a single office_id is not
        -- yet modelled (e.g. "all offices in district X")
      AND g.revoked_at IS NULL
      AND (g.expires_at IS NULL OR g.expires_at > now())
  );
$$;
```

This signature takes `p_user_id` rather than the full `SubjectContext`, since it is called directly from a PostgreSQL RLS policy expression (which has access to `current_setting()`-derived user id, not the application-layer object) as well as from the `PolicyEvaluator` service. The pseudo-code call sites above (`has_cross_office_read_grant(subject, document.office_id)`) should be read as `has_cross_office_read_grant(subject.user_id, document.office_id)` at the application layer, and as the RLS-context equivalent inside PostgreSQL policies. **`access_level` enforcement (B5's second carried-forward limitation) is out of scope for this function as currently defined** — it returns a boolean grant/no-grant result only; if read access needs to be further restricted to a subset of fields once granted, that is a separate mechanism not yet designed, and is not introduced here as a guess.

---

### 3.3 `document:update` (non-state-change edits: title, metadata fields, attachments)

```
ALLOW IF:
  document.lifecycle_state = 'draft'
  AND document.office_id ∈ subject.effective_office_ids
  AND subject.roles ∩ {
    'dept_encoder', 'dept_approver', 'sp_secretary',
    'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain'
  } ≠ ∅

ADDITIONAL RULE — SP Members:
  SP Members may update (edit, attach files to) documents they personally
  authored (document.created_by = subject.user_id)
  [Confirmed — I2 Conditional Note ⁶]

  SP Members may NOT update documents authored by another SP Member or
  entered by the Secretariat, even if in Draft state.

ADDITIONAL RULE — In-Workflow:
  Once document.lifecycle_state transitions past 'draft', content edits
  are only permitted through explicit workflow step actions (amend, return
  for revision). Direct update of document fields is blocked in all states
  except 'draft'.
  [Inference — consistent with the workflow engine being the sole driver of
   state changes; Part 11.3]
```

**Negative:** Records Officers, Auditors, System Administrators, Platform Administrators, and Citizens may not update document content. [Confirmed — I2 Section 4]

---

### 3.4 `document:delete` (soft-delete only)

```
ALLOW IF:
  document.lifecycle_state IN ('draft', 'submitted')
  AND document.workflow_instance_id IS NULL
    (no active workflow instance has been started)
  AND document.office_id ∈ subject.effective_office_ids
  AND subject.roles ∩ {
    'dept_encoder', 'dept_approver', 'sp_secretary',
    'sp_presiding_officer', 'mayor', 'brgy_captain'
  } ≠ ∅

RESTRICTED ENCODER RULE:
  dept_encoder and brgy_encoder may soft-delete only while lifecycle_state
  IN ('draft', 'submitted') AND workflow_instance_id IS NULL.
  Once a workflow instance exists, deletion requires dept_approver or
  sp_secretary.
  [Confirmed — I2 Conditional Note ⁷]
```

**Hard-delete negative:** No role may hard-delete any document record. The `deleted_at` / `deleted_by` soft-delete pattern is the only permitted deletion mechanism. [Confirmed — Consolidated Reference Part 12 Invariant #2; Part 11.4]

---

### 3.5 `document:submit` (Draft → Submitted)

```
ALLOW IF:
  document.lifecycle_state = 'draft'
  AND document.office_id ∈ subject.effective_office_ids
  AND subject.roles ∩ {
    'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
    'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain'
  } ≠ ∅

SPECIAL RULE — SP workflow documents:
  For document_type_code IN ('SP_RESOLUTION', 'SP_ORDINANCE',
  'SP_APPROPRIATION_ORDINANCE'):
    Formal submission (triggering workflow instance creation and QR assignment)
    requires subject.roles CONTAINS 'sp_secretary'.
    SP Members may draft but the Secretariat formally submits.
    [Confirmed — Part 4.1; Part 11.6: QR assigned at secretariat logging]
```

---

### 3.6 `document:cancel` (any active state → Cancelled)

```
ALLOW IF:
  document.lifecycle_state NOT IN ('archived', 'disposed', 'cancelled')
  AND document.office_id ∈ subject.effective_office_ids
  AND (
    subject.roles ∩ {
      'dept_approver', 'sp_secretary', 'sp_presiding_officer',
      'mayor', 'brgy_captain'
    } ≠ ∅
    OR (
      subject.roles CONTAINS 'dept_encoder'
      AND document.lifecycle_state IN ('draft', 'submitted')
      AND document.workflow_instance_id IS NULL
    )
    OR (
      subject.roles CONTAINS 'brgy_encoder'
      AND document.lifecycle_state IN ('draft', 'submitted')
      AND document.workflow_instance_id IS NULL
    )
  )
```

Every cancellation is audit-logged with a mandatory reason. [Confirmed — Part 11.11]

---

### 3.7 `document:number_assign` (assign preliminary number)

```
ALLOW IF:
  document.document_type_code IN (
    'SP_RESOLUTION', 'SP_ORDINANCE', 'SP_APPROPRIATION_ORDINANCE'
  )
  AND document.lifecycle_state IN ('submitted', 'in_workflow')
    (specifically: at the secretariat logging step)
  AND subject.roles CONTAINS 'sp_secretary'
  AND document.preliminary_number IS NULL
    (preliminary number not yet assigned)
```

Preliminary numbers are assigned at secretariat logging, before QR code assignment. Format: `Draft 7SP {YEAR}-{NN}`. [Confirmed — Part 5.2; Q-A01]

**Negative:** No other role may assign preliminary numbers. Preliminary numbers are mutable until finalized. [Confirmed — Part 5.2]

---

### 3.8 `document:number_promote` (assign final number, remove Draft prefix)

```
ALLOW IF:
  document.document_type_code IN (
    'SP_RESOLUTION', 'SP_ORDINANCE', 'SP_APPROPRIATION_ORDINANCE'
  )
  AND (
    (document.document_type_code = 'SP_RESOLUTION'
      AND current workflow step = 'second_reading_vote_completed')
    OR (document.document_type_code IN ('SP_ORDINANCE', 'SP_APPROPRIATION_ORDINANCE')
      AND current workflow step = 'third_reading_vote_completed')
  )
  AND subject.roles CONTAINS 'sp_secretary'
  AND document.preliminary_number IS NOT NULL
  AND document.final_number IS NULL
```

Final number is assigned after the last reading vote, before VP and Mayor sign. [Confirmed — Part 5.2; Interview 2 supersedes Interview 1] Final numbers are immutable once assigned. [Confirmed — Part 5.2; Part 12 Invariant #9]

**Immutability enforcement:** Once `final_number` is set and `preliminary_number` is cleared, no role may modify either field. Enforced by application layer validation and a database check constraint. [Confirmed — Part 12 Invariant #9; Part 5.2]

---

### 3.9 `document:certify_urgent` (log Certification of Urgency)

```
ALLOW IF:
  subject.roles CONTAINS 'sp_secretary'
  AND certifying_document.document_type_code = 'CERTIFICATION_OF_URGENCY'
  AND all associated_measure_ids in the Certification's metadata reference
    documents of type SP_RESOLUTION, SP_ORDINANCE, or SP_APPROPRIATION_ORDINANCE
    whose lifecycle_state = 'in_workflow'
    AND current workflow step = 'committee_referral_pending'
      (i.e. not yet past the point where bypass applies)
```

The SP Secretary logs the Certification; the Mayor issues it. Secretariat does not create or authorize the Certification — they receive and record it. [Confirmed — Part 4.17; Part 11.3] A single Certification may cover multiple measures in the same session. [Confirmed — Q-B01]

---

### 3.10 `document:archive` (Completed/Released → Archived)

```
ALLOW IF:
  document.lifecycle_state IN ('completed', 'released')
  AND subject.roles ∩ { 'records_officer', 'sp_secretary' } ≠ ∅
  AND (
    subject.roles CONTAINS 'records_officer'
    OR (
      subject.roles CONTAINS 'sp_secretary'
      AND document.office_id = SP_SECRETARIAT_OFFICE_ID
    )
  )
```

[Confirmed — I2 Section 10; Conditional Note ¹⁵ for SP Secretary classification scope]

---

### 3.11 `document:publish_portal` (publish to public portal)

```
ALLOW IF:
  document.document_type_code IN (
    'SP_RESOLUTION', 'SP_ORDINANCE', 'SP_APPROPRIATION_ORDINANCE'
  )
  AND document.lifecycle_state IN ('released', 'archived')
  AND document.classification_level = 'public'
    OR (document.classification_level = 'internal'
        AND document_type.public_visibility_rule = 'TITLE_AND_FIRST_PAGE_PUBLIC')
  AND subject.roles CONTAINS 'sp_secretary'
```

[Confirmed — I2 Section 14; Part 4.15: "first page of uploaded documents visible publicly; body is blurred"]

---

## 4. Resource Type: `document_version` and `document_attachment`

Versions and attachments carry the actual file bytes (or the S3 UUID storage key that resolves to them). Policies here govern access to file content — distinct from document metadata policies in Section 3.

### Resource Attributes Used

- `parent_document.classification_level` — inherited from the owning document
- `parent_document.office_id` — inherited office scope
- `parent_document.lifecycle_state`
- `version.created_by` / `attachment.created_by`

### 4.1 `document_version:read` / `document_attachment:read` (file content)

```
ALLOW IF:
  -- Gate 2 passed (IT Admin + Confidential/Restricted already blocked globally)

  (
    -- Own-office access: all non-system roles with office match
    parent_document.office_id ∈ subject.effective_office_ids
    AND subject.roles ∩ {
      'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
      'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
      'records_officer', 'auditor'
    } ≠ ∅
  )
  OR (
    -- Cross-office content read: broader roles with Internal classification only
    subject.roles ∩ {
      'records_officer', 'sp_secretary', 'sp_presiding_officer',
      'mayor', 'auditor'
    } ≠ ∅
    AND parent_document.classification_level IN ('public', 'internal')
  )
  OR (
    -- SP Members: committee-scoped access
    subject.roles CONTAINS 'sp_member'
    AND (
      parent_document is in a committee the subject is a member of
      OR parent_document has been read into an SP session
    )
    AND parent_document.classification_level IN ('public', 'internal')
  )

NEGATIVE — IT Admin (repeated for clarity, covered by Gate 2):
  subject.is_ita = true
  AND parent_document.classification_level IN ('confidential', 'restricted')
  → DENY (invariant; three-layer enforcement)
  [Confirmed — Consolidated Reference Part 12 Invariant #10; B5 §7]
```

### 4.2 `document_version:create` (upload new version / attachment)

```
ALLOW IF:
  parent_document.office_id ∈ subject.effective_office_ids
  AND subject.roles ∩ {
    'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
    'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain'
  } ≠ ∅

SP Member restriction:
  subject.roles CONTAINS 'sp_member'
  → ALLOW only if parent_document.created_by = subject.user_id
  [Confirmed — I2 Conditional Note ⁶]
```

### 4.3 OCR Text Access

```
document_ocr_text:read

ALLOW IF:
  -- Same conditions as document_version:read
  -- PLUS: Gate 2 applies — IT Admin blocked from Confidential/Restricted OCR text
  -- [Inference — OCR text is document content; same access pattern]

  subject.roles ∩ {
    'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
    'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
    'records_officer', 'auditor'
  } ≠ ∅
  AND parent_document.office_id ∈ subject.effective_office_ids
    OR cross-office rule applies (same as version:read above)
```

### 4.4 Scan Quality Indicator Access

```
document_ocr_quality:read

ALLOW IF:
  subject.roles ∩ {
    'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
    'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
    'records_officer'
  } ≠ ∅
  AND (
    parent_document.created_by = subject.user_id
    OR parent_document.office_id ∈ subject.effective_office_ids
  )
```

[Confirmed — I2 Section 17]

---

## 5. Resource Type: `workflow_instance`

A `workflow_instance` corresponds to a row in `workflow.instances`. It tracks the running state of a document through its workflow definition version.

### Resource Attributes Used

- `instance.document_id` → resolves `document.office_id`, `document.classification_level`
- `instance.current_step_type`
- `instance.definition_version_id`
- `instance.status`

### 5.1 `workflow_instance:read` (view status, routing history)

```
ALLOW IF:
  (
    -- Own-office instances
    resolved_document.office_id ∈ subject.effective_office_ids
    AND subject.roles ∩ {
      'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
      'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
      'records_officer', 'auditor', 'plat_admin'
    } ≠ ∅
  )
  OR (
    -- SP Secretary: all instances for SP Secretariat scope
    subject.roles CONTAINS 'sp_secretary'
  )
  OR (
    -- Cross-office read: records_officer, auditor, mayor, sp_presiding_officer
    subject.roles ∩ {
      'records_officer', 'sp_presiding_officer', 'mayor', 'auditor'
    } ≠ ∅
    AND resolved_document.classification_level IN ('public', 'internal')
  )

SCOPED ACCESS:
  Encoders, Department Approvers, SP Members, Barangay Encoders/Captains:
  view only instances for documents in their own office scope (or committee
  scope for SP Members).
  [Confirmed — I2 Conditional Note ¹⁰]
```

### 5.2 `workflow_instance:migrate` (Option B — migrate in-flight instance to new definition version)

```
ALLOW IF:
  subject.roles CONTAINS 'plat_admin'
  AND subject.is_pa = true
```

Requires 2nd-level approval from City Administrator, 24-hour reversible window, and a dedicated audit event. [Confirmed — Part 11.3] This is a Tier 2 configuration action permissible to Platform Admin; it does not conflict with Gate 3 because it is on the allowed Platform Admin action list.

---

## 6. Resource Type: `workflow_step_instance`

A `workflow_step_instance` is one step execution within a running workflow instance. Most user-facing workflow actions (approve, reject, advance, submit committee report) target a specific step instance.

### Resource Attributes Used

- `step.assignee_office_id` — which office is responsible for this step
- `step.assignee_user_id` — specific user assigned (nullable; may be office-level)
- `step.step_type` — action | approval | multi_referral | decision | notification | termination
- `step.status` — pending | in_progress | completed | skipped | overridden
- `step.instance_id` → `instance.document_id` → `document.office_id`, `document.classification_level`

### 6.1 `step_instance:read` (view assigned step)

```
ALLOW IF:
  (
    step.assignee_office_id ∈ subject.effective_office_ids
    AND subject.roles ∩ {
      'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
      'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
      'records_officer', 'auditor'
    } ≠ ∅
  )
  OR step.assignee_user_id = subject.user_id
  OR subject.roles CONTAINS 'sp_secretary'
    (SP Secretary has full step visibility across the SP Secretariat scope)
  OR subject.roles ∩ { 'sp_presiding_officer', 'mayor', 'auditor' } ≠ ∅
    (cross-step visibility for senior roles)
```

[Confirmed — B5 §5.5 Step 7b; I2 Conditional Note ¹⁰]

### 6.2 `step_instance:complete_action` (action step — encoder/operational)

```
ALLOW IF:
  step.step_type = 'action'
  AND step.status = 'pending'
  AND (
    step.assignee_user_id = subject.user_id
    OR (
      step.assignee_office_id ∈ subject.effective_office_ids
      AND subject.roles ∩ {
        'dept_encoder', 'dept_approver', 'sp_secretary',
        'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain'
      } ≠ ∅
    )
  )

ENCODER RESTRICTION:
  subject.roles CONTAINS 'dept_encoder' OR 'brgy_encoder'
  → ALLOW only if step.assignee_user_id = subject.user_id
    OR the document was created by subject.user_id
  Cannot claim steps from the general office queue.
  [Confirmed — I2 Conditional Note ¹²]
```

### 6.3 `step_instance:approve` / `step_instance:reject` / `step_instance:return`

```
ALLOW IF:
  step.step_type = 'approval'
  AND step.status = 'pending'
  AND (
    (
      step.assignee_office_id ∈ subject.effective_office_ids
      AND subject.roles ∩ {
        'dept_approver', 'sp_secretary', 'sp_presiding_officer',
        'mayor', 'brgy_captain'
      } ≠ ∅
    )
    OR step.assignee_user_id = subject.user_id
  )
```

**Invariant #13 — Encoder cannot be final approver of same document:**

```
DENY IF:
  action IN ('approve', 'reject', 'return')
  AND step.is_final_approval_step = true
    [Resolved — D-ABAC-05]
  AND subject.user_id = resolved_document.created_by

DENY IF:
  action IN ('approve', 'reject', 'return')
  AND step.is_final_approval_step = true
  AND subject.user_id appears as the submitter in workflow.instances.submitted_by
```

This invariant is checked **after** the role-based check passes — an approver who is also the encoder of the same document is denied at this step. Enforced at both the application layer (workflow step completion handler checks `submitted_by ≠ subject.user_id` when completing a final approval step) and as a workflow engine constraint. [Confirmed — Consolidated Reference Part 12 Invariant #13; I2 §Architectural Invariants]

**`is_final_approval_step` — [Resolved — D-ABAC-05]:** Rather than the workflow engine computing "is this the last approval-type step" at enforcement time by traversing the definition graph, `is_final_approval_step BOOLEAN NOT NULL DEFAULT false` is a declared column on `workflow.steps` (the step _definition_, not the step instance), set explicitly by whoever authors the workflow definition. A workflow definition publish-time validation (already referenced generally in Section 6.3's enforcement note, and consistent with Part 11.3's "version pinning" and "hardcoded workflow constraints" sections) rejects any definition where: zero steps are marked `is_final_approval_step = true`, more than one step is marked true on a single linear path, or a step marked true is not of `step_type = 'approval'`.

This was chosen over leaving it inferred at runtime for two reasons: (1) the previous `[Inference]` defined "final" by reference to a transition to a `'completed'` lifecycle state, but Section 17's State-Action Compatibility Matrix and Section 3.10 (`document:archive`) both treat `'completed'` and `'released'` as related-but-distinct states reachable through different paths, so "the step that transitions to completed" is not actually an unambiguous graph property for every document type's workflow without first picking a side in that ambiguity — declaring the flag explicitly sidesteps needing to resolve that separately; (2) Invariant #13 is security-relevant (it is what prevents an encoder from rubber-stamping their own document), and a security invariant should not depend on the workflow engine correctly inferring graph topology — an explicit author-declared flag, checked at publish time, is the more defensible enforcement point. This does not change anything about _how_ Section 3.8 (`document:number_promote`) or Section 17's footnote ² identify the reading-vote-completion step for numbering purposes; those remain keyed to specific named workflow steps (`second_reading_vote_completed`, `third_reading_vote_completed`) rather than to `is_final_approval_step`, since numbering promotion and final-approval-for-encoder-exclusion are not necessarily the same step and this document does not assert that they are.

### 6.4 `step_instance:certify` (VP certification step)

```
ALLOW IF:
  step.step_type = 'approval'
  AND step.name = 'vp_certification'
  AND subject.roles CONTAINS 'sp_presiding_officer'
  AND step.assignee_user_id = subject.user_id
    OR (active delegation grants the sp_presiding_officer scope to subject)
```

[Confirmed — I2 Section 6; Part 4.1]

### 6.5 `step_instance:mayor_sign` / `step_instance:mayor_veto`

```
ALLOW IF:
  step.step_type = 'approval'
  AND step.name IN ('mayor_review', 'mayor_signature')
  AND subject.roles CONTAINS 'mayor'
  AND (
    step.assignee_user_id = subject.user_id
    OR subject holds an active delegation_grant whose scope includes
       the mayor role authority
  )
```

[Confirmed — I2 Section 6; Part 4.1; Part 4.2]

### 6.6 `step_instance:submit_committee_report` (multi-referral step)

```
ALLOW IF:
  step.step_type = 'multi_referral'
  AND step.status = 'pending'
  AND (
    subject.roles CONTAINS 'sp_secretary'
    OR (
      subject.roles CONTAINS 'sp_member'
      AND subject.committee_ids ∩ step.metadata.assigned_committee_ids ≠ ∅
         [Confirmed — I2 Conditional Note ¹⁴; lookup mechanism
          Resolved — D-ABAC-06]
    )
  )
```

### 6.7 `step_instance:advance` (manual override — skip missing committee report)

```
ALLOW IF:
  step.step_type = 'multi_referral'
  AND subject.roles CONTAINS 'sp_secretary'

REQUIRED: mandatory_comment MUST be provided and non-empty
REQUIRED: this action MUST be audit-logged with the comment
[Confirmed — Part 8.3; Part 11.3]
```

**Negative:** No other role may manually advance a multi-referral step. The SP Secretary is the sole authority for this override. [Confirmed — I2 Section 6]

### 6.8 Secretariat Decision Actions

```
step_instance:log_secretariat_decision
  (action codes: 'approve', 'reject', 'amended')

ALLOW IF:
  subject.roles CONTAINS 'sp_secretary'
  AND step.step_type IN ('action', 'approval')
  AND step.assignee_office_id = SP_SECRETARIAT_OFFICE_ID
```

[Confirmed — I2 Section 6; Part 11.4]

### 6.9 Panlalawigan Review Actions

```
step_instance:record_panlalawigan_outcome
step_instance:confirm_panlalawigan_deemed_approved
step_instance:record_panlalawigan_lapse

ALLOW IF:
  subject.roles CONTAINS 'sp_secretary'
  AND step.name = 'panlalawigan_review'
  AND step.status = 'pending'
```

30-day timer is system-managed. When it fires, SP Secretary manually confirms the "deemed approved" status. [Confirmed — Part 4.3; I2 Section 6]

---

## 7. Resource Type: `tracking_record` and `routing_entry`

Tracking records correspond to `tracking.tracking_records`. Each document has one tracking record. Routing entries are the movement log within it.

### Resource Attributes Used

- `tracking_record.document_id` → resolves `document.office_id`, `document.classification_level`
- `routing_entry.from_office_id`, `routing_entry.to_office_id`
- `routing_entry.actor_id`

### 7.1 `tracking_record:read` (view full routing history)

```
ALLOW IF:
  (
    -- Own-office routing history
    resolved_document.office_id ∈ subject.effective_office_ids
    AND subject.roles ∩ {
      'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
      'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
      'records_officer', 'auditor'
    } ≠ ∅
  )
  OR (
    -- Cross-office routing history
    subject.roles ∩ {
      'sp_secretary', 'sp_presiding_officer', 'mayor',
      'records_officer', 'auditor'
    } ≠ ∅
    AND resolved_document.classification_level IN ('public', 'internal')
  )
```

[Confirmed — I2 Section 7]

### 7.2 `routing_entry:create` (log physical routing — forward to / receive from)

```
ALLOW IF:
  subject.roles CONTAINS 'sp_secretary'
  AND tracking_record.document_id is an SP Secretariat document
    (ownership check)
```

Physical routing is logged exclusively by SP Secretariat staff in Phase 1. Other offices' physical routing logging is deferred to Phase 2 expansion. [Confirmed — I2 Section 7]

### 7.3 `tracking_record:scan_qr` — authenticated in-app scan

```
ALLOW IF:
  subject is authenticated (any non-citizen, non-system role)
  AND subject.roles ∩ {
    'records_officer', 'dept_encoder', 'dept_approver', 'sp_secretary',
    'sp_member', 'sp_presiding_officer', 'mayor', 'brgy_encoder',
    'brgy_captain', 'auditor'
  } ≠ ∅

RESULT:
  Returns: document type, remarks, full routing history from draft,
           first page only (other pages blurred), "Get a copy" button
  [Confirmed — Part 11.6; Part 11.4]
```

### 7.4 `tracking_record:scan_qr` — public unauthenticated portal scan

```
ALLOW IF:
  request is from the public portal (unauthenticated or citizen session)
  AND document.classification_level = 'public'
    OR document_type.public_visibility_rule = 'TITLE_AND_FIRST_PAGE_PUBLIC'

RESULT:
  Returns: document type, status, first page only (other pages blurred),
           "Get a copy" button
  Does NOT return: routing history actors by name (shows offices only),
                   internal remarks
  [Confirmed — Part 11.6; Part 4.15]
```

### 7.5 `qr_code:print` (print QR cover sheet)

```
ALLOW IF:
  subject.roles CONTAINS 'sp_secretary'
  AND the document to which the QR belongs is in the SP Secretariat's scope
```

QR codes are generated at secretariat logging, before the preliminary number is assigned. [Confirmed — Part 11.6; Q-02] QR tracking numbers are immutable for the document's lifetime. [Confirmed — Part 5.2]

---

## 8. Resource Type: `audit_event`

Audit events are rows in `audit.events`. The schema is append-only; the application DB role (`batac_app`) has INSERT only; UPDATE and DELETE are revoked at the PostgreSQL grant level. [Confirmed — Consolidated Reference Part 12 Invariant #3; Part 11.11; Stack Context]

### 8.1 `audit_event:write` (INSERT)

```
DENY for ALL application roles and all system roles.

ONLY the audit service itself may write to audit.events.
The audit service is called by all other modules; it is the sole writer.
No tRPC procedure, Fastify handler, or direct DB query from any application
code may write to audit.events except through the audit service interface.
[Confirmed — Part 12 Invariant #3; I2 Section 15]
```

### 8.2 `audit_event:read` (own actions)

```
ALLOW IF:
  audit_event.actor_id = subject.user_id
  AND subject.roles ∩ {
    'records_officer', 'dept_encoder', 'dept_approver', 'sp_secretary',
    'sp_member', 'sp_presiding_officer', 'mayor', 'brgy_encoder',
    'brgy_captain', 'auditor'
  } ≠ ∅
```

[Confirmed — I2 Section 15]

### 8.3 `audit_event:read` (own office documents)

```
ALLOW IF:
  audit_event.resource_office_id ∈ subject.effective_office_ids
  AND subject.roles ∩ {
    'records_officer', 'dept_approver', 'sp_secretary',
    'sp_presiding_officer', 'mayor', 'brgy_captain', 'auditor'
  } ≠ ∅
```

[Confirmed — I2 Section 15]

**`resource_office_id` schema — [Resolved — D-ABAC-04]:** `audit.events` carries `resource_office_id UUID NULL` as a denormalized column, populated by the audit service at write time from the resource's owning office at that moment — not resolved via a live join to `documents.documents.office_id` (or the equivalent owning table for other resource types) at read time. This is a deliberate choice, not the default option: the audit schema is INSERT-only and append-only (Invariant #3), and an audit record's purpose is to state what was true when the event happened. A live join would silently change historical audit results if a document's owning office were ever corrected or reassigned after the fact, which defeats the tamper-evidence goal stated for this schema elsewhere in this document (Section 8, Part 11.11). The column is nullable because not every audited resource type necessarily has a resolvable single owning office (e.g. a `session` resource, Section 12, is not office-scoped) — for those event types the column is left null and Section 8.3's filter naturally excludes them from office-scoped views without needing a special case in the policy itself. The audit service is the only writer to `audit.events` (Section 8.1), so it is also the only place responsible for populating this field correctly per resource type; this is implementation work for that service, not a further policy decision.

### 8.4 `audit_event:read_full_log` (all entries)

```
ALLOW IF:
  subject.roles CONTAINS 'auditor'

IMPLEMENTATION:
  Reads via a dedicated audit reader database role (separate from batac_app).
  The batac_app runtime role has no SELECT on audit.events.
  Full log access goes through a stored procedure that the audit reader role
  is granted. This is enforced at the PostgreSQL role level, not only in
  application code.
  [Confirmed — B5 §6.4; Part 11.11]
```

### 8.5 `audit_event:validate_chain` (verify hash chain integrity)

```
ALLOW IF:
  subject.roles ∩ { 'sys_admin', 'auditor' } ≠ ∅
```

[Confirmed — I2 Section 15]

### 8.6 `audit_event:export`

```
ALLOW IF:
  subject.roles CONTAINS 'auditor'

CONSTRAINT:
  Export is bounded by the auditor's classification clearance level.
  No export may include events referencing Confidential or Restricted
  documents unless the auditor is on the explicit allowlist for those types.
  All exports are individually logged in audit (the export action itself
  produces an audit record).
  [Confirmed — I2 Conditional Note ¹⁶]
```

---

## 9. Resource Type: `record` (RMS)

A `record` is a document promoted to official record status in `records.records`. Records Management is Phase 2; the policies below apply when RMS is activated.

### Resource Attributes Used

- `record.document_id` → inherits document classification and office
- `record.retention_schedule_id`
- `record.classification_level`
- `record.lifecycle_stage` — active | inactive | archived | under_legal_hold | pending_disposition | disposed
- `record.legal_hold` — boolean

### 9.1 `record:promote` (document → official record)

```
ALLOW IF:
  subject.roles ∩ { 'records_officer', 'sp_secretary' } ≠ ∅
  AND resolved_document.lifecycle_state IN ('completed', 'released')
  AND (
    subject.roles CONTAINS 'records_officer'
    OR (
      subject.roles CONTAINS 'sp_secretary'
      AND resolved_document.office_id = SP_SECRETARIAT_OFFICE_ID
    )
  )
```

[Confirmed — I2 Section 10]

### 9.2 `record:apply_retention_schedule`

```
ALLOW IF:
  subject.roles CONTAINS 'records_officer'
```

Records Officers apply retention schedules. Platform Administrators define them; Records Officers apply them to individual records. [Confirmed — I2 Conditional Note ⁵]

### 9.3 `record:apply_classification`

```
ALLOW IF:
  subject.roles CONTAINS 'records_officer'
  OR (
    subject.roles CONTAINS 'sp_secretary'
    AND resolved_document.office_id = SP_SECRETARIAT_OFFICE_ID
  )
```

[Confirmed — I2 Section 10; Conditional Note ¹⁵]

### 9.4 `record:archive`

```
ALLOW IF:
  subject.roles CONTAINS 'records_officer'
  AND record.lifecycle_stage IN ('active', 'inactive')
  AND record.legal_hold = false
```

[Confirmed — I2 Section 10]

### 9.5 `record:bulk_archive`

```
ALLOW IF:
  subject.roles CONTAINS 'records_officer'

REQUIRED GUARDS:
  1. Confirmation dialog before execution
  2. Dry-run preview showing affected records before commit
  3. Each individual record archived is logged separately in audit
  4. No bulk archive may include Confidential or Restricted records unless
     the Records Officer is on the explicit allowlist for those types

[Confirmed — Part 11.4; I2 Section 10]
```

### 9.6 `record:place_legal_hold` / `record:remove_legal_hold`

```
ALLOW IF:
  subject.roles CONTAINS 'records_officer'
```

Records under legal hold may not have their retention period shortened. [Confirmed — Part 11.7]

### 9.7 `record:initiate_disposition`

```
ALLOW IF:
  subject.roles CONTAINS 'records_officer'
  AND record.lifecycle_stage = 'archived'
  AND record.legal_hold = false
  AND record.retention_schedule_id IS NOT NULL
  AND retention schedule expiry date has passed
    [Inference — system checks retention schedule before allowing disposition]

NEGATIVE:
  No document may be permanently deleted by any user or role.
  Disposition creates an audit record; it does not delete the row.
  Disposition is not automated; it requires an explicit Records Officer
  action with a mandatory comment.
  [Confirmed — Part 11.7]
```

### 9.8 `record:pii_erasure` (RA 10173)

```
ALLOW IF:
  subject.roles CONTAINS 'records_officer'
  AND a formal legal review clearance exists from City Legal Office
    and/or DPO (stored as a reference in the erasure request record)
    [Confirmed — I2 Conditional Note ¹⁷]

REQUIRED:
  1. Legal clearance reference must be present before action proceeds
  2. Erasure creates a dedicated, permanently retained audit record
  3. The audit record of the erasure itself is never erased
  [Confirmed — Part 11.7; I2 Conditional Note ¹⁷]
```

---

## 10. Resource Type: `citizen_complaint`

Complaint records correspond to `portal.complaints` (partially initialized in Phase 1). [Confirmed — H2 §Citizen Complaint; Part 11.9]

### Resource Attributes Used

- `complaint.complainant_user_id` — citizen portal user who submitted
- `complaint.respondent_details.citizen_user_id` — linked respondent if known
- `complaint.outcome_state` — pending_hearing | received_seen | dismissed | resolved
- `complaint.assigned_office_id` — office/committee handling it

### 10.1 `complaint:create` (submit complaint — self)

```
ALLOW IF:
  subject.roles CONTAINS 'citizen'
  AND request is to create a complaint for subject.user_id as complainant
```

[Confirmed — I2 Section 12]

### 10.2 `complaint:create` (clerk-assisted, in-person)

```
ALLOW IF:
  subject.roles CONTAINS 'sp_secretary'
```

[Confirmed — I2 Section 12; Part 4.14]

### 10.3 `complaint:log_and_assign`

```
ALLOW IF:
  subject.roles CONTAINS 'sp_secretary'
```

Secretariat decides routing — no fixed routing rule. [Confirmed — Q-B04]

### 10.4 `complaint:read_own`

```
ALLOW IF:
  subject.roles CONTAINS 'citizen'
  AND complaint.complainant_user_id = subject.user_id
```

[Confirmed — I2 Section 12]

### 10.5 `complaint:read_as_respondent`

```
ALLOW IF:
  subject.roles CONTAINS 'citizen'
  AND complaint.respondent_details.citizen_user_id = subject.user_id
  AND complaint.outcome_state ≠ null
    (respondent access after complaint has been processed sufficiently)
  [Inference — consistent with I2 Conditional Note ¹⁸]
```

### 10.6 `complaint:read_all` (SP Secretariat view)

```
ALLOW IF:
  subject.roles ∩ { 'sp_secretary', 'sp_presiding_officer', 'auditor' } ≠ ∅
  OR (
    subject.roles CONTAINS 'sp_member'
    AND complaint.assigned_office_id ∈ subject.committee_ids
      [Resolved — D-ABAC-06]
  )
```

[Confirmed — I2 Section 12; Conditional Note ¹⁴]

### 10.7 `complaint:set_outcome` (Dismissed / Resolved)

```
ALLOW IF:
  subject.roles CONTAINS 'sp_secretary'
```

[Confirmed — I2 Section 12]

---

## 11. Resource Type: `delegation_grant`

Delegation grants are rows in `organization.delegation_grants`. They are created when a Designation document is logged. [Confirmed — Part 4.12; Part 11.13]

### Resource Attributes Used

- `grant.delegating_user_id`
- `grant.delegated_to_user_id`
- `grant.active`
- `grant.effective_from`, `grant.effective_until`
- `grant.scope` — `JSONB`, required shape `{ roles: [], office_ids: [], actions: [] }`. [Resolved in B5 §11 — D-AUTH-06, as reported; not independently re-verified against B5 itself in this document]

### 11.1 `delegation_grant:create`

```
ALLOW IF:
  subject.roles CONTAINS 'sp_secretary'
  AND the Designation document has been received and logged by subject
    (the Secretary logs, not independently creates)
  AND grant.delegating_user_id matches the issuing authority
    (Mayor for executive scope; Vice Mayor for legislative scope)
  [Confirmed — I2 Conditional Note ³; Part 4.12]

INVARIANT:
  IF an active delegation_grant already exists WHERE
     delegated_to_user_id = NEW.delegated_to_user_id
  THEN DENY (one active designation per person)
  [Confirmed — Part 12 Invariant #16]
  Enforced by DB partial unique index:
    CREATE UNIQUE INDEX idx_one_active_delegation_per_user
      ON organization.delegation_grants(delegated_to_user_id)
      WHERE active = true;
```

### 11.2 `delegation_grant:revoke_early`

```
ALLOW IF:
  subject.user_id = grant.delegating_user_id
    (the delegating authority may revoke their own grant)
  OR (
    subject.roles CONTAINS 'sp_secretary'
    AND a formal written instruction from the delegating authority exists
        (documented in the revocation request)
    [Confirmed — I2 Conditional Note ⁴]
  )

NEGATIVE:
  Open-ended revocations (with no documented instruction from the
  delegating authority) are not permitted.
  [Confirmed — I2 Conditional Note ⁴]
```

### 11.3 `delegation_grant:read` (active and historical)

```
ALLOW IF:
  subject.user_id IN (grant.delegating_user_id, grant.delegated_to_user_id)
  OR subject.roles ∩ {
    'sys_admin', 'plat_admin', 'sp_secretary',
    'sp_presiding_officer', 'mayor', 'auditor'
  } ≠ ∅
```

[Confirmed — I2 Section 2]

---

## 12. Resource Type: `session`

Sessions are rows in `iam.sessions`.

### 12.1 `session:read_own`

```
ALLOW IF:
  session.user_id = subject.user_id
```

[Confirmed — I2 Section 1]

### 12.2 `session:read_all`

```
ALLOW IF:
  subject.is_ita = true
```

[Confirmed — I2 Section 1]

### 12.3 `session:force_terminate`

```
ALLOW IF:
  subject.is_ita = true
  AND mandatory_reason field is non-empty

REQUIRED:
  Reason is stored in iam.sessions.termination_reason
  AND audit_event 'forced_logout' is emitted with actor_id,
      target_user_id, session_id, and reason
  [Confirmed — Part 11.17; B5 §4.5; I2 Section 1]
```

---

## 13. Resource Type: `document_request`

Document and Records Request Forms are rows in `portal.citizen_requests`.

### 13.1 `document_request:create` — self-service portal

```
ALLOW IF:
  subject.roles CONTAINS 'citizen'
```

[Confirmed — I2 Section 13]

### 13.2 `document_request:create` — clerk-assisted

```
ALLOW IF:
  subject.roles CONTAINS 'sp_secretary'
```

[Confirmed — I2 Section 13]

### 13.3 `document_request:approve` (Vice Mayor step)

```
ALLOW IF:
  subject.roles CONTAINS 'sp_presiding_officer'
  AND request is at the Vice Mayor approval step
```

[Confirmed — I2 Section 13; Part 4.15]

### 13.4 `document_request:approve` (SP Secretary step)

```
ALLOW IF:
  subject.roles CONTAINS 'sp_secretary'
  AND request is at the SP Secretary approval step
  AND Vice Mayor has already approved
    [Inference — sequential approval; both required before release]
```

[Confirmed — Part 4.15: "Approval requires both Vice Mayor AND SP Secretary signature"]

### 13.5 `document_request:release_copy`

```
ALLOW IF:
  subject.roles CONTAINS 'sp_secretary'
  AND request.approval_status = 'approved'
  AND payment confirmed (deferred to later phase; skip payment check
     until payment system is implemented)
  [Confirmed — Part 4.15; Q-D04]
```

---

## 14. Resource Type: `number_series`

Number series are rows in `documents.number_series`. They define counters and format strings for each document type. [Confirmed — H3; Part 5.2]

### 14.1 `number_series:read`

```
ALLOW IF:
  subject.roles ∩ {
    'plat_admin', 'records_officer', 'sp_secretary',
    'sys_admin', 'auditor'
  } ≠ ∅
```

### 14.2 `number_series:create` / `number_series:update`

```
ALLOW IF:
  subject.roles CONTAINS 'plat_admin'
  AND subject.is_pa = true
```

[Confirmed — I2 Section 3]

### 14.3 Number Sequence Consumption (system action — assign next number)

```
ALLOW IF:
  the call originates from the workflow engine or the numbering service
  acting on behalf of an sp_secretary action

  Not callable directly by any user-facing handler.
  [Inference — the sequence is consumed by the numbering service only,
   which is invoked by the workflow step completion handler when the
   number_assign or number_promote action is executed by sp_secretary]
```

---

## 15. Architectural Invariants — Complete Formal Statement

The following negative policies are absolute. They cannot be configured away, overridden by delegation, or bypassed by any combination of roles. They are encoded in `PolicyGuard` (hardcoded, pre-RBAC) and additionally enforced at the PostgreSQL layer.

### Invariant #2 — No Hard Deletes

```
FOR ALL resources, ALL subjects:
  action = 'hard_delete'
  → DENY unconditionally
  REASON: "hard_delete_prohibited"

Only soft-delete via deleted_at / deleted_by is permitted.
[Confirmed — Consolidated Reference Part 12 Invariant #2]
```

### Invariant #3 — Audit Log Write Isolation

```
FOR ALL subjects:
  resource.type = 'audit_event'
  AND action IN ('INSERT', 'UPDATE', 'DELETE')
  AND caller is any application handler, tRPC procedure, or direct DB query
  → DENY unconditionally
  REASON: "audit_write_isolation"

Only the audit service interface is a valid write path.
At the DB level: batac_app role has INSERT only on audit.events;
UPDATE and DELETE are revoked.
[Confirmed — Part 12 Invariant #3; Part 11.11]
```

### Invariant #8 — Tenant Isolation

```
FOR ALL resources, ALL subjects:
  resource.city_id ≠ subject.city_id
  → DENY unconditionally
  REASON: "tenant_isolation"
[Confirmed — Part 12 Invariant #8]
```

### Invariant #9 — Final Number Immutability

```
FOR ALL subjects:
  resource.type = 'document'
  AND action = 'update'
  AND field being updated = 'final_number'
  AND document.final_number IS NOT NULL (already assigned)
  → DENY unconditionally
  REASON: "final_number_immutable"
[Confirmed — Part 5.2; Part 12 Invariant #9]
```

### Invariant #10 — IT Admin Document Content Isolation

```
FOR ALL subjects WHERE subject.is_ita = true:
  resource.type IN ('document_version', 'document_attachment', 'document_ocr_text')
  AND parent_document.classification_level IN ('confidential', 'restricted')
  AND action IN ('read', 'download', 'export', 'bulk_export')
  → DENY unconditionally
  REASON: "it_admin_content_isolation_invariant"

Three enforcement layers:
  1. PolicyGuard (application, Gate 2)
  2. PostgreSQL RLS on documents.versions and documents.attachments
  3. batac_it_admin DB role revocations
[Confirmed — Part 12 Invariant #10; B5 §7]
```

### Invariant #12 — Platform Administrator Role Exclusion

```
FOR ALL subjects WHERE subject.is_pa = true:
  action NOT IN (Tier 2 platform admin action set)
  → DENY unconditionally
  REASON: "platform_admin_operational_exclusion"

At role assignment time:
  IF incoming role type = 'platform_admin'
    AND target user already holds any role WHERE iam.roles.type_code = 'document_processor'
  → DENY role assignment
  REASON: "platform_admin_combination_prohibited"

Enforced by:
  1. Application-layer validation in role assignment service
  2. PostgreSQL trigger trg_enforce_platform_admin_exclusion on
     iam.role_assignments (INSERT and UPDATE)
[Confirmed — Part 12 Invariant #12; B5 §8]
```

**`document_processor` role list — [Resolved, with one carried-forward gap — D-ABAC-01]:** The trigger checks `iam.roles.type_code = 'document_processor'`, not a hardcoded role-name list — `type_code` is a seeded classification column on `iam.roles`, and the trigger's logic does not change regardless of which literal roles are seeded with that type. For the seed data itself, the following roles — every role referenced as a document-processing subject anywhere in this document's policies (Sections 3, 6, 9, 10, 13) — are seeded with `type_code = 'document_processor'`:

`dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`

The following roles, also referenced throughout this document, are explicitly seeded with a different `type_code` (not `'document_processor'`) and are therefore compatible with holding a Platform Administrator role: `records_officer`, `auditor`, `sys_admin`, `citizen`. This matches how this document already treats those roles elsewhere — e.g. Section 3.1's negative note already excludes Platform Administrators, System Administrators, Records Officers, Auditors, and Citizens from `document:create`, which is consistent with only the first list being operational document-processors.

**Carried-forward gap, not resolved here:** This list does not resolve how **delegated** acting-capacity holds up against the trigger — specifically "Acting Mayor" and "OIC (any)" scenarios reached via `organization.delegation_grants` rather than a direct `iam.role_assignments` row. B5's own resolution of the equivalent item (D-AUTH-05) flagged the identical ambiguity and left it open rather than guessing: whether an Acting Mayor's `document_processor` exclusion should be enforced as a literal seeded role per office (e.g. a distinct `acting_mayor` role with its own `type_code`), or via some other mechanism that inspects the _delegation_grant.scope_ rather than a static role row. This document does not invent a different answer than B5 already left open — the gap is carried forward here in the same shape, for the same reason: the trigger as defined operates on `iam.role_assignments` rows, and a delegation grant is a separate table (`organization.delegation_grants`) that this trigger does not currently inspect. Whether that's the intended final behavior (i.e., a Platform Admin who later becomes Acting Mayor via delegation is _not_ caught by this trigger at all, only by whatever Section 16.2 already says delegation cannot override) or whether the trigger needs a second, delegation-aware enforcement path is the open question, identical in scope to B5's D-AUTH-05 follow-up. **This is not required before IAM seed data is written** (the seed list above is unaffected by it, exactly as B5 reasoned for its own version of this gap) but should be resolved before delegation grants for Mayor-equivalent authority go live in production.

### Invariant #13 — Encoder Cannot Be Final Approver

```
FOR ALL subjects:
  resource.type = 'workflow_step_instance'
  AND action IN ('approve', 'reject', 'return')
  AND step.is_final_approval_step = true
    [Resolved — D-ABAC-05: declared boolean column on workflow.steps,
     set by the workflow definition author and validated at publish time.
     See Section 6.3 for the full resolution.]
  AND (
    subject.user_id = resolved_document.created_by
    OR subject.user_id = workflow_instance.submitted_by
  )
  → DENY unconditionally
  REASON: "encoder_final_approver_same_user_prohibited"

Enforced by:
  1. Workflow step completion handler checks submitted_by ≠ subject.user_id
     before processing any step where is_final_approval_step = true
  2. Workflow engine constraint validated at workflow definition publish time:
     the definition must guarantee that the encoder role cannot be assigned
     to any step where is_final_approval_step = true, for the same document type
[Confirmed — Part 12 Invariant #13; I2 §Architectural Invariants]
```

### Invariant #16 — One Active Designation Per Person

```
FOR ALL subjects:
  resource.type = 'delegation_grant'
  AND action = 'create'
  AND an active delegation_grant already exists WHERE
      delegated_to_user_id = new_grant.delegated_to_user_id
  → DENY unconditionally
  REASON: "multiple_active_designations_prohibited"

Enforced by:
  1. Application layer validation in delegation logging handler
  2. PostgreSQL partial unique index:
     CREATE UNIQUE INDEX idx_one_active_delegation_per_user
       ON organization.delegation_grants(delegated_to_user_id)
       WHERE active = true;
[Confirmed — Part 12 Invariant #16; Part 4.12; B5 §5.7]
```

---

## 16. Delegation Grant Scope Expansion

When `subject.delegation_grant_id` is non-null, the `loadDelegationContext` hook expands the subject's effective scope before policy evaluation. The following rules govern what the expansion permits and what it cannot override.

### 16.1 What Delegation Can Extend

- `subject.effective_office_ids` — expanded to include offices within the delegation scope
- `subject.effective_roles` — expanded to include roles delegated (e.g., Acting Mayor gains Mayor role authority)
- `subject.office_id` — primary office does not change; effective_office_ids widens

### 16.2 What Delegation Cannot Override

Delegation cannot grant:

- Access past the IT Admin content isolation invariant (Invariant #10)
- Platform Administrator operational access (Invariant #12)
- Access to Confidential/Restricted documents not on the explicit allowlist (Gate 4)
- The ability to be the final approver of a document the delegatee submitted (Invariant #13)
- Any cross-city access (Invariant #8)

[Confirmed — B5 §5.7; Part 11.13]

### 16.3 Auto-Expiry

```
AT request time, if delegation_grant.effective_until < NOW():
  subject.delegation_grant_id is treated as null
  → delegation context is NOT loaded
  → subject's effective scope reverts to base office/roles
  [Confirmed — Part 4.12; Part 11.13]
```

### 16.4 Delegation Scope at Step 7d

```
Step 7d — DELEGATION SCOPE CHECK

IF subject.delegation_grant_id IS NOT NULL:
  delegation_grant = loaded by loadDelegationContext
  IF the requested (resource_type, action) is NOT within
     delegation_grant.scope:
    → DENY
    REASON: "outside_delegation_scope"

This check is additive — delegation scope narrows, never widens, the
permissions the delegatee would have had independently.
A delegation of Mayor authority does not allow the delegatee to do things
the Mayor could not do either.
[Confirmed — B5 §5.7]
```

---

## 17. State-Action Compatibility Matrix

This matrix defines which actions are valid for a document in a given `lifecycle_state`. An action attempted against a document in an incompatible state is denied at Gate 5 / Step 7c of the cascade.

|`lifecycle_state`|`create`|`read`|`update`|`submit`|`approve`|`reject`|`cancel`|`archive`|`dispose`|`number_assign`|`number_promote`|
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
|Draft|✅|✅|✅|✅|❌|❌|✅|❌|❌|❌|❌|
|Submitted|—|✅|❌|❌|❌|❌|✅|❌|❌|✅|❌|
|In-Workflow|—|✅|❌¹|❌|✅|✅|✅|❌|❌|✅|❌|
|Pending-Approval|—|✅|❌¹|❌|✅|✅|✅|❌|❌|❌|✅²|
|Completed|—|✅|❌|❌|❌|❌|✅|✅|❌|❌|❌|
|Released|—|✅|❌|❌|❌|❌|✅|✅|❌|❌|❌|
|Archived|—|✅|❌|❌|❌|❌|❌|❌|✅|❌|❌|
|Disposed|—|✅³|❌|❌|❌|❌|❌|❌|❌|❌|❌|
|Cancelled|—|✅|❌|❌|❌|❌|❌|❌|❌|❌|❌|

**Notes:**

¹ Content edits in In-Workflow and Pending-Approval states occur only through explicit workflow step actions (amend, return for revision). Direct field update is blocked.

² `number_promote` is valid when the document is at the Pending-Approval step that follows the last reading vote (Second Reading for Resolutions; Third Reading for Ordinances/Appropriation Ordinances). It fires before VP and Mayor sign. [Confirmed — Part 5.2]

³ Disposed documents remain readable for audit and legal investigation purposes. [Confirmed — Part 11.7]

---

## 18. Deferred Decisions (Resolved This Revision)

**Status as of this revision: 6 of 6 items in this section resolved; 1 (D-ABAC-01) carries a narrower follow-up that doesn't block the IAM module's first migration, mirroring how B5 treated its own D-AUTH-05.** Resolutions are recorded in the relevant body sections above, cross-referenced below. The fully-resolved items are listed here rather than left mixed with open items, for the same reason B5's Section 11 gave: this table's job is tracking what's been decided, and that's clearer when it isn't mixed with what's still open.

|ID|Item|Resolution|Recorded In|
|---|---|---|---|
|D-ABAC-01|Full list of `document_processor` role type codes for Invariant #12 trigger|**Resolved for direct role assignment:** `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain` seeded with `type_code = 'document_processor'`; `records_officer`, `auditor`, `sys_admin`, `citizen` seeded otherwise. **Delegated Acting-Mayor/OIC scenarios not resolved** — carried forward; see Section 19.|Section 15, Invariant #12|
|D-ABAC-02|Explicit allowlist structure for Confidential/Restricted document types|**Resolved:** `documents.classification_allowlists` table, one row per (`document_type_id`, `role_code`), queried via indexed `EXISTS` from Gate 4.|Section 2, Gate 4|
|D-ABAC-03|`has_cross_office_read_grant()` function definition|**Resolved:** SQL function signature defined, built on top of B5's `organization.cross_office_grants` table (D-AUTH-09, as reported). B5's two carried-forward limitations on that underlying table (non-"all" office scoping; `access_level` not enforced) are inherited here unchanged, not re-resolved.|Section 3.2|
|D-ABAC-04|Audit event `resource_office_id` field|**Resolved:** denormalized `resource_office_id UUID NULL` column on `audit.events`, populated by the audit service at write time (not a live join), nullable for resource types with no single owning office.|Section 8.3|
|D-ABAC-05|Definition of "final approval step" in workflow definition|**Resolved:** `is_final_approval_step BOOLEAN` declared on `workflow.steps` by the definition author, validated at publish time, rather than computed at runtime from lifecycle-state transitions.|Section 6.3; Section 15, Invariant #13|
|D-ABAC-06|SP Member committee membership lookup at policy evaluation time|**Resolved: JWT-cached.** `subject.committee_ids` added as a new claim (`cid`), following the same token-issue-time / refresh-gated staleness model already used for `roles` and `permissions`.|Section 1; Sections 3.2, 6.6, 10.6|

**Note on D-AUTH-06:** This document also referenced B5's D-AUTH-06 (`delegation_grant.scope` schema) at Section 11 as `[Unresolved]`. That reference has been corrected to reflect B5's actual resolution (`JSONB`, shape `{ roles: [], office_ids: [], actions: [] }`) — see Section 11. This was a stale cross-reference fix, not a decision made independently in this document.

---

## 19. Remaining Open Items

One item carries a narrower follow-up, identical in shape and severity to how B5 handled its own equivalent ambiguity. It does not block the IAM module's first migration, for the reason stated.

|Item|What's Open|Why It Doesn't Block the IAM Migration|Required Before|
|---|---|---|---|
|D-ABAC-01 follow-up|"Acting Mayor" and "OIC (any)" reached via `organization.delegation_grants` are not covered by `trg_enforce_platform_admin_exclusion`, which operates on `iam.role_assignments` rows only. Whether delegated acting-capacity should be caught by this same trigger (requiring a delegation-aware enforcement path) or is intentionally out of its scope (relying instead on Section 16.2's existing statement that delegation cannot grant Platform Administrator operational access) has not been decided. This mirrors B5's D-AUTH-05 follow-up exactly — same ambiguity, carried forward rather than guessed at twice.|The seed list for direct role assignment (the eight roles above) is unaffected by how this gets resolved, and the trigger as defined functions correctly against `iam.role_assignments` regardless.|Before delegation grants for Mayor-equivalent authority go live in production|

---

_This document is the authoritative implementation spec for the `PolicyEvaluator` service. All `[Inference]` items require team review. The Section 19 open item must be formally decided and recorded in an ADR before delegation grants for Mayor-equivalent authority go live in production. This document supersedes any implicit policy assumptions in prior architecture documents and must be updated whenever a new resource type or action is introduced._
