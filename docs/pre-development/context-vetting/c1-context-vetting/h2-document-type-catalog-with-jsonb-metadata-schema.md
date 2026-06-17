## Document Type Catalog with JSONB Metadata Schemas — C1 Filtered Extract

**Document:** H2 (C1 Filtered) **Platform:** Batac City LGU Platform **Status:** BLOCKING — `documents.document_types` seed must run before the `number_series` seed (H3) and before any workflow definition is published (B4). **Last Updated:** June 2026 **Audience:** C1 DDL author **Filter purpose:** Retains only content needed to produce the Full Database Schema DDL for Phase 1 schemas. Seed data bodies (full JSON Schema per document type), application-layer handler logic, and non-DDL implementation notes are excluded.

---

### What Is Not in `documents.metadata` JSONB

The following columns are present on **all** `documents.documents` rows regardless of document type. They are not redefined per type and must not appear inside `documents.metadata`. This table defines the required columns for the `documents.documents` DDL.

|Column|Type|Notes|
|---|---|---|
|`id`|UUID PK|`gen_random_uuid()` [Confirmed — Part 11.9]|
|`document_type_id`|UUID NOT NULL|FK → `documents.document_types.id`|
|`title`|TEXT NOT NULL|Full display title of the document|
|`lifecycle_state`|TEXT NOT NULL|Draft → Submitted → In-Workflow → Pending Approval → Completed → Released → Archived → Disposed; Cancelled is a terminal state reachable from any active state [Confirmed — Part 11.4]|
|`classification_level`|TEXT NOT NULL|PUBLIC \| INTERNAL \| CONFIDENTIAL \| RESTRICTED [Confirmed — Part 11.4]|
|`qr_tracking_number`|UUID NOT NULL|Assigned at secretariat logging, before preliminary number. Immutable for document lifetime. [Confirmed — Part 11.6]|
|`preliminary_number`|TEXT NULLABLE|Nullable and mutable. Only present for types with two-stage numbering. Removed when final number is assigned. [Confirmed — Part 5.2]|
|`final_number`|TEXT NULLABLE|Immutable once assigned. [Confirmed — Part 5.2]|
|`control_number`|TEXT NULLABLE|Secretariat's tracking reference. Nullable for types with deferred assignment (Letters Received). [Confirmed — Part 4.8; Part 5.2]|
|`number_series_id`|UUID NULLABLE|FK → `documents.number_series.id`. NULL for document types with no standalone number.|
|`originating_office_id`|UUID NOT NULL|FK → `organization.offices.id`. SP Secretariat for SP workflow documents; external sender office for SPR letters. [Confirmed — Q-B03]|
|`owned_by_office_id`|UUID NOT NULL|FK → `organization.offices.id`|
|`created_by`|UUID NOT NULL|FK → `iam.users.id`|
|`workflow_instance_id`|UUID NULLABLE|FK → `workflow.instances.id`. NULL until a workflow is started.|
|`retention_schedule_id`|UUID NOT NULL|FK → `records.retention_schedules.id`|
|`version_number`|INTEGER NOT NULL|Increments on each new version; previous versions are retained [Confirmed — Part 11.4]|
|`city_id`|UUID NOT NULL|Tenant isolation [Confirmed — Part 11.9]|
|`deleted_at`|TIMESTAMPTZ NULLABLE|Soft delete [Confirmed — Part 11.9]|
|`deleted_by`|UUID NULLABLE|FK → `iam.users.id`|
|`created_at`|TIMESTAMPTZ NOT NULL||
|`updated_at`|TIMESTAMPTZ NOT NULL||

**Items managed in other schemas — not in document JSONB:**

|Data|Schema|
|---|---|
|Workflow step data, committee assignment, submission tracking|`workflow.step_instances.metadata`|
|Mayor action, Panlalawigan outcome, veto override, publication operational tracking|`workflow.instances.context`|
|Routing and custody history|`tracking` schema|
|File attachments|`documents.attachments`|

---

### Catalog Summary Table

`document_type_id` values are [Inference — proposed stable slugs]. Generate actual UUID v4 values once using `gen_random_uuid()` and pin them to the seed script. Do not regenerate. `number_series_id` slug references match the `series_id` values defined in H3 Table 1.

|`document_type_id` slug|`name`|`code`|`owning_module`|`number_series_id` ref|`preliminary_numbering`|`control_number_deferred`|`retention_schedule_id` ref|`classification_default`|`public_visibility_rule`|
|---|---|---|---|---|---|---|---|---|---|
|`dt_sp_resolution`|SP Resolution|`SP_RESOLUTION`|`workflow`|`sp_resolution`|Yes|No|`retention_permanent`|`INTERNAL`|`TITLE_AND_FIRST_PAGE_PUBLIC`|
|`dt_sp_ordinance`|SP Ordinance|`SP_ORDINANCE`|`workflow`|`sp_ordinance`|Yes|No|`retention_permanent`|`INTERNAL`|`TITLE_AND_FIRST_PAGE_PUBLIC` ¹|
|`dt_appropriation_ordinance`|Appropriation Ordinance|`SP_APPROPRIATION_ORDINANCE`|`workflow`|`sp_appropriation_ordinance`|Yes|No|`retention_permanent`|`INTERNAL`|`TITLE_AND_FIRST_PAGE_PUBLIC`|
|`dt_certification_urgency`|Certification of Urgency|`CERTIFICATION_OF_URGENCY`|`workflow`|NULL ²|No|No|`retention_permanent` ³|`INTERNAL`|`NOT_PUBLIC` ⁴|
|`dt_citizen_complaint`|Citizen Complaint|`CITIZEN_COMPLAINT`|`portal` ⁵|NULL ⁶|No|No|`retention_citizens_correspondence` ⁷|`INTERNAL`|`COMPLAINANT_RESTRICTED`|
|`dt_document_request`|Document Request Form|`DOCUMENT_REQUEST_FORM`|`portal` ⁵|NULL ⁶|No|No|`retention_citizens_correspondence` ⁷|`INTERNAL`|`REQUESTER_RESTRICTED`|
|`dt_transmittal_letter`|Transmittal Letter|`TRANSMITTAL_LETTER`|`workflow`|`letters_sent` ⁸|No|No|`retention_permanent` ³|`INTERNAL`|`NOT_PUBLIC`|
|`dt_designation`|Designation|`DESIGNATION`|`organization`|`designation`|No|No|`retention_permanent` ³|`INTERNAL`|`NOT_PUBLIC`|

**Table footnotes relevant to DDL:**

¹ Whether a given ordinance has a penalty provision is captured in the JSONB metadata (`has_penalty_provision`). [Confirmed — Part 4.2; Q-C04]

² Certification of Urgency has no standalone numbering series. [Confirmed — Q-B01] `number_series_id` is NULL on the `documents.documents` row for these records.

³ Retention for Certification of Urgency, Transmittal Letter, and Designation: [Inference — PERMANENT]. No specific retention rule is stated for these types in the reference document (Part 11.7). PERMANENT is assigned as the conservative default. Confirm with COA before Production Rollout.

⁴ Certification of Urgency is not listed independently in the public portal.

⁵ Phase 1 citizen-facing features (Citizen Complaint, Document Request Form) are created under the `portal` schema because Part 11.9 assigns `complaints` and `citizen_requests` to `schema: portal`. In Phase 1 the `portal` schema is partially initialized: only complaint and request tables are live.

⁶ Citizen Complaint and Document Request Form have no control number managed by the `number_series` system. [Inference — no numbering series is defined for these types in H3 or Part 5.1.]

⁷ Retention for citizen-facing documents: [Inference — 10–15 years]. Part 11.7 assigns 10–15 years to "correspondence with citizens."

⁸ Transmittal Letters are SPS (Letters Sent) documents. They consume from the shared `letters_sent` counter. [Confirmed — Part 4.9]

---

### Public Visibility Rule Definitions

These are the valid values for the `public_visibility_rule` column of `documents.document_types`. Required for the CHECK constraint on that column.

|Rule|Meaning|
|---|---|
|`TITLE_AND_FIRST_PAGE_PUBLIC`|Document title and first page visible to the public via the portal. All other pages are blurred. Full copy requires a paid Document Request. [Confirmed — Part 4.15; Part 11.4]|
|`NOT_PUBLIC`|Not listed or accessible through the public portal. Internal access only.|
|`COMPLAINANT_RESTRICTED`|Status visible only to the authenticated complainant via the portal. Not publicly listed. [Inference — consistent with Part 4.14 outcome states]|
|`REQUESTER_RESTRICTED`|Status visible only to the authenticated requester via the portal. Not publicly listed. [Inference — consistent with Part 4.15]|

---

### Retention Schedule ID Definitions

These are the retention schedule slugs referenced in the catalog. Actual UUID values must be generated and pinned when the `records.retention_schedules` table is seeded. Required for `documents.documents.retention_schedule_id` FK context.

|`retention_schedule_id` slug|Retention Period|Source|
|---|---|---|
|`retention_permanent`|Permanent — no disposition|[Confirmed — Part 11.7: "SP Resolutions, Ordinances: Permanent"]|
|`retention_citizens_correspondence`|10–15 years|[Inference — Part 11.7: "Correspondence with citizens: 10–15 years"]|

---

### JSONB Metadata Fields — Per Document Type (DDL-Relevant Summary)

This section lists the top-level JSONB fields and their types for each document type. This is the authoritative field inventory for the `documents.document_types.metadata_schema` column definition and for GIN index design. Full JSON Schema bodies (draft-07 seed values for `metadata_schema`) are in the unfiltered H2 document.

#### 1. SP Resolution (`SP_RESOLUTION`)

|Field|JSON Type|Required|Notes|
|---|---|---|---|
|`sponsors`|array of objects|Yes|`person_id` (uuid), `display_name` (string), `role` (enum: author \| co_author \| introduced_by)|
|`subject_matter`|object|Yes|`general` (string, required), `specific` (string\|null)|
|`certified_urgent`|boolean|Yes|Default false. Permanent source of truth; B4 workflow context derives from this. [Confirmed — Part 4.17]|
|`certification_of_urgency_document_id`|uuid\|null|No|[Inference] Logical FK to CERTIFICATION_OF_URGENCY document. NULL when `certified_urgent` is false.|
|`transmittal_letter_document_id`|uuid\|null|No|[Inference] Logical FK to TRANSMITTAL_LETTER document. NULL until transmittal step completes.|
|`remarks`|string\|null|No|[Inference] SP Secretariat free-text remarks field.|

#### 2. SP Ordinance (`SP_ORDINANCE`)

|Field|JSON Type|Required|Notes|
|---|---|---|---|
|`sponsors`|array of objects|Yes|Same structure as SP Resolution.|
|`subject_matter`|object|Yes|Same structure as SP Resolution.|
|`certified_urgent`|boolean|Yes|Default false. Permanent source of truth. [Confirmed — Part 4.17]|
|`certification_of_urgency_document_id`|uuid\|null|No|[Inference] Logical FK to CERTIFICATION_OF_URGENCY document.|
|`has_penalty_provision`|boolean|Yes|Default false. Determines whether newspaper publication is required. [Confirmed — Part 4.2; Q-C04]|
|`publication`|object\|null|No|Required (non-null) when `has_penalty_provision` is true and publication step completes. Sub-fields: `newspaper_name` (string), `publication_date` (date).|
|`transmittal_letter_document_id`|uuid\|null|No|[Inference]|
|`remarks`|string\|null|No|[Inference]|

#### 3. Appropriation Ordinance (`SP_APPROPRIATION_ORDINANCE`)

|Field|JSON Type|Required|Notes|
|---|---|---|---|
|`sponsors`|array of objects|Yes|Same structure as SP Resolution.|
|`subject_matter`|object|Yes|Same structure as SP Resolution.|
|`certified_urgent`|boolean|Yes|Default false. Permanent source of truth. [Confirmed — Part 4.17]|
|`certification_of_urgency_document_id`|uuid\|null|No|[Inference]|
|`budget_period_year`|integer|Yes|[Inference] Fiscal year governed (e.g., 2026). Range: 2000–2100.|
|`is_supplemental`|boolean|Yes|[Inference] Default false. True for Supplemental Appropriation Ordinances. [Confirmed — Part 4.2]|
|`transmittal_letter_document_id`|uuid\|null|No|[Inference]|
|`remarks`|string\|null|No|[Inference]|

#### 4. Certification of Urgency (`CERTIFICATION_OF_URGENCY`)

|Field|JSON Type|Required|Notes|
|---|---|---|---|
|`issuing_authority_user_id`|uuid|Yes|Logical FK to iam.users (Mayor). [Confirmed — Part 4.17]|
|`issuing_authority_display_name`|string|Yes|[Inference] Denormalized at time of logging.|
|`session_date`|date|Yes|[Inference] Session this Certification applies to. [Confirmed — Part 4.17; Q-B01]|
|`associated_measure_ids`|array of uuid (minItems: 1)|Yes|Logical FK references to all legislative measures covered. [Confirmed — Part 4.17; Q-B01]|
|`remarks`|string\|null|No|[Inference] Optional Secretariat notes.|

#### 5. Citizen Complaint (`CITIZEN_COMPLAINT`)

|Field|JSON Type|Required|Notes|
|---|---|---|---|
|`complainant`|object|Yes|Sub-fields: `name` (string, required), `address` (string\|null), `contact_number` (string\|null), `email` (string\|null), `citizen_user_id` (uuid\|null). [Confirmed — Part 4.14]|
|`subject_category`|string|Yes|Free-text. [Confirmed — Q-B04]|
|`violation_type`|string\|null|No|Free-text or enum. [Confirmed — Part 4.14]|
|`incident_details`|object|No|Sub-fields: `date` (date\|null), `time` (string\|null), `place` (string\|null), `narrative` (string\|null). [Confirmed — Part 4.14]|
|`respondent`|object\|null|No|Sub-fields: `name` (string\|null), `tricycle_number` (string\|null), `contact_number` (string\|null), `email` (string\|null), `notification_channel` (enum: email \| sms_in_person_claim \| null). [Confirmed — Part 4.14]|
|`access_mode`|string (enum)|Yes|`downloaded_form` \| `digital_form_printed` \| `in_person_clerk`. [Confirmed — Part 4.14; Part 4.15]|
|`routing_decision`|string\|null|No|[Inference] Secretariat's routing rationale. [Confirmed — Q-B04]|
|`outcome_state`|string (enum)|Yes|`pending_hearing` \| `received_seen` \| `dismissed` \| `resolved`. Default: `pending_hearing`. [Confirmed — Part 4.14; Q-B04]|

#### 6. Document Request Form (`DOCUMENT_REQUEST_FORM`)

|Field|JSON Type|Required|Notes|
|---|---|---|---|
|`requester`|object|Yes|Sub-fields: `name` (string, required), `agency_or_organization` (string\|null), `email` (string\|null), `contact_number` (string\|null), `id_type_presented` (string\|null), `citizen_user_id` (uuid\|null). [Confirmed — Part 4.15]|
|`documents_requested`|array of objects (minItems: 1)|Yes|Sub-fields per item: `document_id` (uuid\|null), `document_type_label` (string\|null), `document_title` (string, required), `document_number` (string\|null), `number_of_pages` (integer\|null). [Confirmed — Part 4.15]|
|`purpose`|string\|null|No|[Confirmed — Part 4.15]|
|`access_mode`|string (enum)|Yes|`downloaded_form` \| `digital_form_printed` \| `in_person_clerk`. [Confirmed — Part 4.15]|
|`payment`|object\|null|No|Sub-fields: `or_number` (string\|null), `collecting_officer` (string\|null), `amount_paid` (number\|null), `payment_date` (date\|null). [Confirmed — Part 4.15] All sub-fields null until payment system is implemented.|
|`notification_channel`|string\|null (enum)|No|`contact_number` \| `email` \| null. [Confirmed — Part 4.15]|
|`approval_status`|string (enum)|Yes|`pending` \| `approved` \| `rejected`. Default: `pending`. [Inference] 'approved' only when both VM and SP Secretary have approved. [Confirmed — Part 4.15]|
|`approved_by_vm`|boolean|No|[Inference] Default false. May be redundant if approval is modeled as workflow steps in B4 — confirm before implementing.|
|`approved_by_sp_secretary`|boolean|No|[Inference] Default false. Same caveat as above.|

#### 7. Transmittal Letter (`TRANSMITTAL_LETTER`)

|Field|JSON Type|Required|Notes|
|---|---|---|---|
|`associated_measure_id`|uuid|Yes|Logical FK to the SP Resolution, SP Ordinance, or Appropriation Ordinance this letter transmits. One Transmittal Letter per measure. [Confirmed — Part 4.1; Part 4.2]|
|`recipient_office_label`|string|Yes|[Inference] Display name of recipient office. Default: "Office of the Mayor".|
|`recipient_office_id`|uuid\|null|No|[Inference] Logical FK to organization.offices, if resolvable.|
|`purpose_text`|string|Yes|Standard cover letter purpose line. [Confirmed — Part 4.1; Part 4.2: "For appropriate action"]|
|`signed_by_user_id`|uuid\|null|No|[Inference] Logical FK to iam.users for signatory.|
|`signed_by_display_name`|string\|null|No|[Inference] Denormalized at time of signing.|
|`date_transmitted`|date\|null|No|[Inference] NULL until transmittal action step completes.|

#### 8. Designation (`DESIGNATION`)

|Field|JSON Type|Required|Notes|
|---|---|---|---|
|`delegating_authority_user_id`|uuid|Yes|Logical FK to iam.users (Mayor or Vice Mayor). [Confirmed — Part 4.12]|
|`delegating_authority_display_name`|string|Yes|[Inference] Denormalized at time of logging.|
|`designated_person_user_id`|uuid|Yes|Logical FK to iam.users. [Confirmed — Part 4.12]|
|`designated_person_display_name`|string|Yes|[Inference] Denormalized at time of logging.|
|`designated_position_title`|string|Yes|Position being designated (e.g., "Acting Mayor"). [Confirmed — Part 4.12]|
|`scope_description`|string|Yes|Textual scope of authority, manually extracted from physical document. [Confirmed — Part 4.12]|
|`effective_from`|date|Yes|Start date. Always explicit. [Confirmed — Part 11.13]|
|`effective_until`|date|Yes|End date. Always explicit. Auto-expiry at this date. [Confirmed — Part 4.12; Part 11.13]|
|`originating_document_reference`|string\|null|No|Originating authority's own memo/order number from the physical document. [Confirmed — Part 4.12: dual number system]|
|`legal_basis`|string\|null|No|Legal basis as extracted from physical document. [Confirmed — Part 4.12]|
|`delegation_grant_id`|uuid\|null|No|[Inference] Logical FK to organization.delegation_grants. Set by designation logging handler. NULL before handler completes.|

---

### Implementation Notes — DDL-Relevant Only

**1. Seed ordering**

`documents.document_types` seed must run **before** `documents.number_series` seed (H3), because H3 references `document_type_code` as a logical FK. No other intra-catalog dependency; the eight records are independent of each other.

**3. Shared `7SP` prefix across three legislative types**

SP Resolution, SP Ordinance, and Appropriation Ordinance all render as `7SP {YEAR}-{NN}`. A rendered number like `7SP 2026-05` does not identify its type. The application must display `document_types.name` alongside any rendered series number. [Confirmed — H3 Implementation Note 2]

**6. GIN indexes**

GIN indexes on `documents.metadata` are required. Minimum targets before Phase 1 goes live:

|Expression|Document type|Use case|
|---|---|---|
|`(metadata->>'certified_urgent')`|SP_RESOLUTION, SP_ORDINANCE, SP_APPROPRIATION_ORDINANCE|Certified Urgent queue; Order of Business filtering|
|`(metadata->>'has_penalty_provision')`|SP_ORDINANCE|Publication workflow trigger; Index of Ordinances export|
|`(metadata->>'outcome_state')`|CITIZEN_COMPLAINT|Complaint status dashboard|

[Inference — specific index expressions must be confirmed against final query patterns]

**7. `is_active` flag on `document_types`**

If `documents.document_types` includes an `is_active` boolean column (recommended), seed the Designation record with `is_active = false` and activate it when the Phase 1B Designation workflow definition is published. The Designation `document_type` seed record must still be present before Phase 1 deployment because the `organization` module references `document_type_id` on delegation grant records.