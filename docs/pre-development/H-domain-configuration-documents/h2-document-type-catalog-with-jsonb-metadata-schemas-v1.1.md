## Document Type Catalog with JSONB Metadata Schemas — Blocking

**Document:** H2 **Platform:** Batac City LGU Platform **Status:** BLOCKING — `documents.document_types` seed must run before the `number_series` seed (H3) and before any workflow definition is published (B4). Workflow definitions resolve `document_type_id` at publish time; number series records reference `document_type_code` as a logical FK. **Last Updated:** June 2026 **Audience:** Backend development team **Source documents:** Consolidated Architecture & Requirements Reference (Iteration 3) — Parts 4, 5, 11.4, 11.7, 11.21; Numbering Series Configuration Specification (H3); Workflow Engine Specification (B4)


## Table of Contents

- [L28–L39] Notation in This Document — Definitions for verification labels marking source-confirmed facts, logical inferences, and unverified parameters.
- [L40–L78] What Is Not in `documents.metadata` JSONB — Global document columns and external schema fields that must be excluded from the metadata JSONB object.
- [L79–L113] Catalog Summary Table — Initial seed values, naming codes, numbering series, and default classifications for the eight Phase 1 document types.
- [L114–L126] Public Visibility Rule Definitions — Initial public portal visibility rule definitions governing document and status accessibility for citizens and requesters.
- [L127–L137] Retention Schedule ID Definitions — Retention period rules mapping default document lifecycles to permanent or correspondence-based schedules.
- [L138–L940] JSONB Metadata Schemas — Per Document Type — Introduction to JSON Schema validation configurations for the metadata column of all document types.
  - [L146–L235] 1. SP Resolution (`SP_RESOLUTION`) — Sponsors, subject matter, and urgent certification links used for index reporting and workflow routing.
  - [L236–L334] 2. SP Ordinance (`SP_ORDINANCE`) — Sponsor and subject fields, plus newspaper publication details required for ordinances containing penalty provisions.
  - [L335–L417] 3. Appropriation Ordinance (`SP_APPROPRIATION_ORDINANCE`) — Budget period year and supplemental budget flags used to identify and distinguish fiscal appropriation measures.
  - [L418–L483] 4. Certification of Urgency (`CERTIFICATION_OF_URGENCY`) — Mayor issuance details, target session dates, and atomic writes mapping urgency to associated measures.
  - [L484–L620] 5. Citizen Complaint (`CITIZEN_COMPLAINT`) — Complainant, respondent, incident details, physical signature modes, and complaint-specific resolution outcome states.
  - [L621–L773] 6. Document Request Form (`DOCUMENT_REQUEST_FORM`) — Requester info, requested document arrays, fee-based payment placeholders, and `notification_channel`. Dual VM/SP-Secretary approval tracked via Workflow Engine, not JSONB `[ADR-B3-1]`.
  - [L774–L838] 7. Transmittal Letter (`TRANSMITTAL_LETTER`) — Mayor transmittal letters containing references to the associated measure, recipient office, and SP Secretary signatory.
  - [L839–L940] 8. Designation (`DESIGNATION`) — Delegation mapping from original authority to designee, including position, scope, and explicit validity periods.
- [L941–L999] Implementation Notes — Database seed ordering, workflow context mappings, GIN index expressions, and validation rules for application-enforced relationships.

---

---

### Notation in This Document

|Label|Meaning|
|---|---|
|[Confirmed — source]|Present in a cited part of the Consolidated Architecture & Requirements Reference|
|[Inference]|Logically reasoned from confirmed facts; not stated verbatim in the reference document|
|[Unverified]|No reliable source; confirm before implementing|

Field names, enum values, slug identifiers, and JSON Schema structures that are not present verbatim in the source documents are spec decisions made in this document. They are authoritative for implementation unless explicitly revised.

---

### What Is Not in `documents.metadata` JSONB

The following columns are present on **all** `documents.documents` rows regardless of document type. They are not redefined per type and must not appear inside `documents.metadata`.

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

|Data|Schema|Notes|
|---|---|---|
|Workflow step data, committee assignment, submission tracking|`workflow.step_instances.metadata`|Defined in B4 §4.3 (`multi_referral` step metadata schema)|
|Mayor action, Panlalawigan outcome, veto override, publication operational tracking|`workflow.instances.context`|Defined in B4 Appendix B|
|Routing and custody history|`tracking` schema|Every movement: from, to, actor, timestamp, action|
|File attachments|`documents.attachments`|Attachment records with UUID storage keys|

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

**Table footnotes:**

¹ Penalty ordinances additionally require full-text newspaper publication (Ilocos Times) arranged by SP Secretariat. Publication is not the same as public portal visibility. Whether a given ordinance has a penalty provision and therefore requires publication is captured in the JSONB metadata (`has_penalty_provision`). [Confirmed — Part 4.2; Q-C04]

² Certification of Urgency has no standalone numbering series. [Confirmed — Q-B01] `number_series_id` is NULL on the `documents.documents` row for these records.

³ Retention for Certification of Urgency, Transmittal Letter, and Designation: [Inference — PERMANENT]. No specific retention rule is stated for these types in the reference document (Part 11.7). PERMANENT is assigned as the conservative default: these are legal authority documents tied to legislative records that carry permanent retention. Confirm with COA before Production Rollout.

⁴ Certification of Urgency is attached to the legislative measure it certifies. It is not listed independently in the public portal. Public access to it is governed by the visibility rule of the associated measure. [Inference — consistent with Part 4.17; Q-B01]

⁵ Phase 1 citizen-facing features (Citizen Complaint, Document Request Form) are created under the `portal` schema because Part 11.9 assigns `complaints` and `citizen_requests` to `schema: portal`. In Phase 1 the `portal` schema is partially initialized: only complaint and request tables are live. Full portal module activation is Phase 3. [Inference — consistent with Part 11.9; Part 13 roadmap] **Note `[ADR-B3-1]`:** `owning_module` here describes database-schema ownership of the document record, not whether the Workflow Engine drives the document's approval flow — these are independent. Document Request Form's `documents.documents` row remains owned by `portal` schema, but as of ADR-B3-1 its dual approval (VM + SP Secretary) is orchestrated by the Workflow Engine via `workflow.definitions`/`workflow.instances`, the same mechanism used by the `workflow`-owned legislative types above. Citizen Complaint, by contrast, has no Workflow Engine involvement at all in Phase 1 — it remains tracked solely via its own `outcome_state` field.

⁶ Citizen Complaint and Document Request Form have no control number managed by the `number_series` system. [Inference — no numbering series is defined for these types in H3 or Part 5.1.] If a human-readable case reference is needed, implement as a separate sequence outside `number_series` or generate from a sequential field on the table itself. Confirm before implementing.

⁷ Retention for citizen-facing documents: [Inference — 10–15 years]. Part 11.7 assigns 10–15 years to "correspondence with citizens." No specific rule is stated for complaints or document request forms. Applied as the closest matching category.

⁸ Transmittal Letters are SPS (Letters Sent) documents. They consume from the shared `letters_sent` counter and carry an `SPS {YEAR}-{NN}` control number. Part 4.9 lists Transmittal Letters explicitly as a content type of Letters Sent. [Confirmed — Part 4.9] There is no dedicated sub-counter. Whether the shared SPS counter is appropriate or whether a dedicated Transmittal Letter sub-series should be introduced is [Unverified — not addressed in the reference document]. Default: shared SPS counter. Confirm before Phase 1B letters workflow is implemented.

---

### Public Visibility Rule Definitions

These are the four values that appear in the `public_visibility_rule` column of `document_types`. The Platform Administrator can configure which document types are publicly visible (Part 11.21). The seed values below represent the initial configuration at system launch.

|Rule|Meaning|
|---|---|
|`TITLE_AND_FIRST_PAGE_PUBLIC`|Document title and first page visible to the public via the portal. All other pages are blurred. Full copy requires a paid Document Request. [Confirmed — Part 4.15; Part 11.4]|
|`NOT_PUBLIC`|Not listed or accessible through the public portal. Internal access only.|
|`COMPLAINANT_RESTRICTED`|Status visible only to the authenticated complainant via the portal. Not publicly listed. [Inference — consistent with Part 4.14 outcome states and citizen portal identity model in Part 11.18]|
|`REQUESTER_RESTRICTED`|Status visible only to the authenticated requester via the portal. Not publicly listed. [Inference — consistent with Part 4.15]|

---

### Retention Schedule ID Definitions

These are the two retention schedule slugs referenced in the catalog. Actual UUID values must be generated and pinned when the `records.retention_schedules` table is seeded.

|`retention_schedule_id` slug|Retention Period|Source|
|---|---|---|
|`retention_permanent`|Permanent — no disposition|[Confirmed — Part 11.7: "SP Resolutions, Ordinances: Permanent"]|
|`retention_citizens_correspondence`|10–15 years|[Inference — Part 11.7: "Correspondence with citizens: 10–15 years"]|

---

### JSONB Metadata Schemas — Per Document Type

For each document type, the `metadata_schema` column on `documents.document_types` stores a JSON Schema (draft-07) defining the valid structure of `documents.documents.metadata` for that type. The schemas below are the seed values for that column.

Fields labeled [Inference] are not explicitly listed as JSONB or metadata fields in the reference document but are logically required to support confirmed workflows, reporting outputs, or audit requirements.

---

#### 1. SP Resolution (`SP_RESOLUTION`)

**Source:** Part 4.1, Part 5.3 (Index of Ordinances fields applied to resolutions by analogy), Part 11.4

The JSONB captures document-level attributes required for the Index of Resolutions report and for workflow routing. Workflow step data (committee submissions, vote counts, reading outcomes) is entirely in the `workflow` schema (B4 §4.3, Appendix B) and must not be duplicated here.

**Overlap with B4 workflow context (`instances.context`):** `certified_urgent` and `certified_urgent_document_id` also appear in the B4 context (Appendix B). The `documents.metadata` field is the **permanent source of truth**; the workflow context derives its value from this field when the instance is created or when the Certified Urgent bypass is applied. The workflow context copy is operational state; the document JSONB copy is the immutable legislative record. These must be kept in sync by the Certification of Urgency logging handler.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["sponsors", "subject_matter", "certified_urgent"],
  "additionalProperties": false,
  "properties": {

    "sponsors": {
      "type": "array",
      "description": "Councilors and Vice Mayor associated with this measure. Only councilors can formally sponsor; VM is included after the title. [Confirmed — Part 4.1]",
      "items": {
        "type": "object",
        "required": ["person_id", "display_name", "role"],
        "additionalProperties": false,
        "properties": {
          "person_id": {
            "type": "string",
            "format": "uuid",
            "description": "Logical FK to iam.users or organization.employees at time of assignment"
          },
          "display_name": {
            "type": "string",
            "description": "[Inference] Name denormalized at time of assignment. Documents are legal records; the displayed name must reflect the name as of signing, not any subsequent account rename."
          },
          "role": {
            "type": "string",
            "enum": ["author", "co_author", "introduced_by"],
            "description": "[Inference] Role of this person in the measure"
          }
        }
      }
    },

    "subject_matter": {
      "type": "object",
      "description": "Subject matter classification. Required for Index of Resolutions reporting. [Confirmed — Part 5.3 (Index of Ordinances fields applied to resolutions by analogy)]",
      "required": ["general"],
      "additionalProperties": false,
      "properties": {
        "general": {
          "type": "string",
          "description": "General subject matter category"
        },
        "specific": {
          "type": ["string", "null"],
          "description": "Specific subject matter subcategory"
        }
      }
    },

    "certified_urgent": {
      "type": "boolean",
      "description": "True when a Certification of Urgency has been logged for this measure. Causes committee referral bypass and same-session First and Second Readings. [Confirmed — Part 4.17; Part 11.3] Permanent source of truth; B4 workflow context derives from this field.",
      "default": false
    },

    "certification_of_urgency_document_id": {
      "type": ["string", "null"],
      "format": "uuid",
      "description": "[Inference] Logical FK to the CERTIFICATION_OF_URGENCY document record attached to this measure. NULL when certified_urgent is false. Set by the Certification of Urgency logging handler concurrently with updating certified_urgent."
    },

    "transmittal_letter_document_id": {
      "type": ["string", "null"],
      "format": "uuid",
      "description": "[Inference] Logical FK to the TRANSMITTAL_LETTER document generated when this measure is sent to the Mayor's Office. NULL until the transmittal action step is completed. Provides reverse lookup from measure to its transmittal letter without a join through the TRANSMITTAL_LETTER document's own JSONB."
    },

    "remarks": {
      "type": ["string", "null"],
      "description": "[Inference] SP Secretariat free-text remarks field. Analogous to 'Remarks / Post Review Action of SP' in the Index of Ordinances (Part 5.3). Populated after Panlalawigan review or veto proceedings when follow-up notes are needed."
    }

  }
}
```

**GIN index:** A GIN index on `metadata` is required. Minimum: a partial index expression on `(metadata->>'certified_urgent')` to support Certified Urgent queue filtering. [Inference — consistent with PostgreSQL non-negotiables in Part 9 and Stack Context]

---

#### 2. SP Ordinance (`SP_ORDINANCE`)

**Source:** Part 4.2, Part 5.3, Part 11.3

SP Ordinance follows the same three-reading legislative workflow as SP Resolution but adds two fields not present on resolutions: `has_penalty_provision` (determines whether full-text newspaper publication is required) and `publication` (permanent record of where and when publication occurred).

**Overlap with B4 workflow context:** `requires_publication`, `publication_date`, and `publication_newspaper` appear in the B4 context (Appendix B) as operational workflow state. The document JSONB `has_penalty_provision` is the permanent attribute set at document creation; `publication` is the permanent publication record written when the publication action step completes. The B4 context values are operational mirrors populated during workflow execution. Both must be written in the same transaction when the publication action step completes.

`certified_urgent` overlap: same as SP Resolution — document JSONB is permanent source of truth; B4 context derives from it.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["sponsors", "subject_matter", "certified_urgent", "has_penalty_provision"],
  "additionalProperties": false,
  "properties": {

    "sponsors": {
      "type": "array",
      "description": "Same structure as SP Resolution sponsors. [Confirmed — Part 4.2; Part 5.3]",
      "items": {
        "type": "object",
        "required": ["person_id", "display_name", "role"],
        "additionalProperties": false,
        "properties": {
          "person_id": { "type": "string", "format": "uuid" },
          "display_name": { "type": "string" },
          "role": { "type": "string", "enum": ["author", "co_author", "introduced_by"] }
        }
      }
    },

    "subject_matter": {
      "type": "object",
      "description": "Subject matter classification. [Confirmed — Part 5.3]",
      "required": ["general"],
      "additionalProperties": false,
      "properties": {
        "general": { "type": "string" },
        "specific": { "type": ["string", "null"] }
      }
    },

    "certified_urgent": {
      "type": "boolean",
      "description": "True when a Certification of Urgency applies; bypasses committee referral and collapses First and Second Readings into the same session. [Confirmed — Part 4.17] Permanent source of truth; B4 workflow context derives from this field.",
      "default": false
    },

    "certification_of_urgency_document_id": {
      "type": ["string", "null"],
      "format": "uuid",
      "description": "[Inference] Logical FK to the associated CERTIFICATION_OF_URGENCY document record. NULL when certified_urgent is false."
    },

    "has_penalty_provision": {
      "type": "boolean",
      "description": "Determines whether full-text newspaper publication in Ilocos Times is required after Panlalawigan review. True = publication required. SP Secretariat arranges placement. [Confirmed — Part 4.2; Q-C04] Set at document creation or at Second Reading when the penalty clause is confirmed. The B4 decision step evaluating this field reads from workflow context (requires_publication), which must be set from this field when the publication decision step activates.",
      "default": false
    },

    "publication": {
      "type": ["object", "null"],
      "description": "Permanent publication record. NULL until publication occurs. Required (must not be null) when has_penalty_provision is true and the publication action step completes. Penalty ordinances without this field populated are not considered fully processed. [Confirmed — Part 4.2; Part 5.3; Q-C04]",
      "required": ["newspaper_name", "publication_date"],
      "additionalProperties": false,
      "properties": {
        "newspaper_name": {
          "type": "string",
          "description": "Newspaper where full ordinance text was published. [Confirmed — Ilocos Times, Part 4.2]"
        },
        "publication_date": {
          "type": "string",
          "format": "date",
          "description": "Date of publication. Mandatory tracked field in SP records. [Confirmed — Part 4.2; Part 5.3; Q-C04]"
        }
      }
    },

    "transmittal_letter_document_id": {
      "type": ["string", "null"],
      "format": "uuid",
      "description": "[Inference] Logical FK to the TRANSMITTAL_LETTER document generated for this ordinance."
    },

    "remarks": {
      "type": ["string", "null"],
      "description": "[Inference] SP Secretariat remarks. Analogous to 'Remarks / Post Review Action of SP' in Part 5.3."
    }

  }
}
```

**Publication enforcement:** When `has_penalty_provision = true` and the document reaches the publication workflow step, the application layer must enforce that `publication` is non-null before the publication action step is marked complete. This is not enforced by a PostgreSQL check constraint (the constraint would need to reference both `has_penalty_provision` and `lifecycle_state`); enforce at the workflow step completion handler.

---

#### 3. Appropriation Ordinance (`SP_APPROPRIATION_ORDINANCE`)

**Source:** Part 4.2

Appropriation Ordinances follow the same three-reading workflow as SP Ordinances. The JSONB is near-identical to SP Ordinance with two additions: `budget_period_year` (required to disambiguate multiple appropriation ordinances in the same SP-ordinal year) and `is_supplemental`.

No `has_penalty_provision` field: Appropriation Ordinances do not contain penalty provisions. The publication requirement does not apply. [Inference — not stated explicitly in the reference document; consistent with Part 4.2's description of appropriation ordinances as budget allocation instruments]

The Panlalawigan outcome "Operative in its entirety" is specific to Appropriation Ordinances and is treated as equivalent to VALID. [Confirmed — Part 4.2; Part 4.3] This outcome is stored in `workflow.instances.context.panlalawigan_outcome` as `OPERATIVE_IN_ITS_ENTIRETY` and in the Panlalawigan review log entity. It does not appear in this document's JSONB.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["sponsors", "subject_matter", "certified_urgent", "budget_period_year", "is_supplemental"],
  "additionalProperties": false,
  "properties": {

    "sponsors": {
      "type": "array",
      "description": "[Confirmed — Part 4.2]",
      "items": {
        "type": "object",
        "required": ["person_id", "display_name", "role"],
        "additionalProperties": false,
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
      "additionalProperties": false,
      "properties": {
        "general": { "type": "string" },
        "specific": { "type": ["string", "null"] }
      }
    },

    "certified_urgent": {
      "type": "boolean",
      "description": "Permanent source of truth; B4 workflow context derives from this field. [Confirmed — Part 4.17]",
      "default": false
    },

    "certification_of_urgency_document_id": {
      "type": ["string", "null"],
      "format": "uuid"
    },

    "budget_period_year": {
      "type": "integer",
      "description": "[Inference] Fiscal year this Appropriation Ordinance governs (e.g., 2026). Multiple appropriation ordinances may be enacted in the same SP-ordinal year (regular + supplemental); this field disambiguates them. Not confirmed as a tracked field in the reference document; required for operational use.",
      "minimum": 2000,
      "maximum": 2100
    },

    "is_supplemental": {
      "type": "boolean",
      "description": "[Inference] True when this is a Supplemental Appropriation Ordinance allocating additional funds to the initial budget for the same fiscal year. [Confirmed — Part 4.2: 'Supplemental Appropriation Ordinances (allocate more to initial budget) follow the same flow']",
      "default": false
    },

    "transmittal_letter_document_id": {
      "type": ["string", "null"],
      "format": "uuid",
      "description": "[Inference] Logical FK to the TRANSMITTAL_LETTER document generated for this measure."
    },

    "remarks": {
      "type": ["string", "null"]
    }

  }
}
```

---

#### 4. Certification of Urgency (`CERTIFICATION_OF_URGENCY`)

**Source:** Part 4.17, Q-B01

A Certification of Urgency has no standalone number and is not filed as an independent legislative document. It is a Mayor-issued formal document that is logged by the SP Secretariat and attached to one or more legislative measures. [Confirmed — Part 4.17; Q-B01]

A separate `document_type` record is required so the system can classify the uploaded PDF, log it in the audit trail, generate a QR tracking number, and attach it to the associated measure(s). The `documents.final_number` and `documents.control_number` columns are both NULL for Certification of Urgency records. The `documents.number_series_id` is NULL. The `documents.title` column holds a descriptive title (e.g., "Certification of Urgency — Session of [date]"), assigned by the Secretariat at logging.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "issuing_authority_user_id",
    "issuing_authority_display_name",
    "session_date",
    "associated_measure_ids"
  ],
  "additionalProperties": false,
  "properties": {

    "issuing_authority_user_id": {
      "type": "string",
      "format": "uuid",
      "description": "Logical FK to iam.users for the Mayor who issued the Certification. [Confirmed — Part 4.17: 'Issued by: Mayor (formal written document)']"
    },

    "issuing_authority_display_name": {
      "type": "string",
      "description": "[Inference] Denormalized at time of logging. Required for immutable historical display even if the account is later deactivated."
    },

    "session_date": {
      "type": "string",
      "format": "date",
      "description": "[Inference] The session date for which this Certification applies. A single Certification can cover multiple measures in the same session. [Confirmed — Part 4.17; Q-B01] Required to correlate this Certification with the correct Order of Business."
    },

    "associated_measure_ids": {
      "type": "array",
      "minItems": 1,
      "description": "Logical FK references to all legislative measure document records this Certification covers. One Certification can cover multiple measures in the same session. [Confirmed — Part 4.17; Q-B01] All entries must reference documents of type SP_RESOLUTION, SP_ORDINANCE, or SP_APPROPRIATION_ORDINANCE. Referential integrity is enforced at the application layer — PostgreSQL does not enforce FK constraints on JSONB array contents.",
      "items": {
        "type": "string",
        "format": "uuid"
      }
    },

    "remarks": {
      "type": ["string", "null"],
      "description": "[Inference] Optional Secretariat notes at logging time."
    }

  }
}
```

**Logging handler behavior:** When a Certification of Urgency is logged (document created and JSONB written), the handler must:

1. For each UUID in `associated_measure_ids`: update the measure's `documents.metadata.certified_urgent = true` and `documents.metadata.certification_of_urgency_document_id = [this document's id]`.
2. For each associated measure with an active workflow instance: emit the `workflow.certification_urgency.bypass_applied` event to the workflow engine. [Confirmed — Part 4.17; B4 Appendix A]

These three writes (Certification document creation, measure JSONB update, workflow event) must be atomic in a single database transaction.

---

#### 5. Citizen Complaint (`CITIZEN_COMPLAINT`)

**Source:** Part 4.14, Q-B04

Complaints addressed to the Sangguniang Panlungsod. Not limited to transportation — any LGU-related complaint can be filed. [Confirmed — Q-B04]

The four outcome states (`pending_hearing`, `received_seen`, `dismissed`, `resolved`) confirmed in Q-B04 are stored in `metadata.outcome_state` rather than in `documents.lifecycle_state` because they represent the complaint-specific resolution status, which has different semantics than the document lifecycle state (Draft → Completed, etc.). [Inference — these are parallel tracking dimensions, not the same field]

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["complainant", "subject_category", "access_mode", "outcome_state"],
  "additionalProperties": false,
  "properties": {

    "complainant": {
      "type": "object",
      "description": "Complainant details. [Confirmed — Part 4.14 confirmed form fields]",
      "required": ["name"],
      "additionalProperties": false,
      "properties": {
        "name": {
          "type": "string",
          "description": "[Confirmed — Part 4.14]"
        },
        "address": {
          "type": ["string", "null"],
          "description": "[Confirmed — Part 4.14]"
        },
        "contact_number": {
          "type": ["string", "null"],
          "description": "[Confirmed — Part 4.14]"
        },
        "email": {
          "type": ["string", "null"],
          "format": "email",
          "description": "[Confirmed — Part 4.14]"
        },
        "citizen_user_id": {
          "type": ["string", "null"],
          "format": "uuid",
          "description": "[Inference] Logical FK to a registered portal citizen account, if the complainant has one. NULL for walk-in or form-submitted complaints where no account is linked."
        }
      }
    },

    "subject_category": {
      "type": "string",
      "description": "Nature or subject of the complaint. Any LGU-related complaint can be filed; transportation is the primary confirmed example. [Confirmed — Q-B04] The platform should allow freeform entry rather than a closed enum, since categories are not exhaustively defined in the reference document.",
      "examples": ["transportation", "public_works", "barangay_affairs", "environment", "other"]
    },

    "violation_type": {
      "type": ["string", "null"],
      "description": "Specific violation type, where applicable. [Confirmed — Part 4.14: 'Violation type (overcharging, trip cutting, refused to convey, discourtesy, others)' for transportation complaints] Free-text or enum; the reference document defines the transportation set but no other category's values.",
      "examples": ["overcharging", "trip_cutting", "refused_to_convey", "discourtesy", "others"]
    },

    "incident_details": {
      "type": "object",
      "description": "[Confirmed — Part 4.14 confirmed form fields for transportation complaints; apply to all complaint types]",
      "additionalProperties": false,
      "properties": {
        "date": {
          "type": ["string", "null"],
          "format": "date",
          "description": "[Confirmed — Part 4.14]"
        },
        "time": {
          "type": ["string", "null"],
          "description": "Time of incident. Free text to accommodate partial times (e.g., 'afternoon', '14:30'). [Confirmed — Part 4.14]"
        },
        "place": {
          "type": ["string", "null"],
          "description": "[Confirmed — Part 4.14]"
        },
        "narrative": {
          "type": ["string", "null"],
          "description": "[Confirmed — Part 4.14 'remarks' field on complaint form]"
        }
      }
    },

    "respondent": {
      "type": ["object", "null"],
      "description": "Respondent details. NULL when no specific respondent is named (e.g., complaint against an office rather than an individual). [Confirmed — Part 4.14]",
      "additionalProperties": false,
      "properties": {
        "name": {
          "type": ["string", "null"]
        },
        "tricycle_number": {
          "type": ["string", "null"],
          "description": "Tricycle unit number. Applicable for transportation complaints. [Confirmed — Part 4.14]"
        },
        "contact_number": {
          "type": ["string", "null"]
        },
        "email": {
          "type": ["string", "null"],
          "format": "email"
        },
        "notification_channel": {
          "type": ["string", "null"],
          "enum": ["email", "sms_in_person_claim", null],
          "description": "How formal written notice is delivered to the respondent. 'email': notice and formal written notice sent by email. 'sms_in_person_claim': notification sent by phone/SMS; respondent must claim the written notice in person at the LGU. [Confirmed — Part 4.14; Q-B04]"
        }
      }
    },

    "access_mode": {
      "type": "string",
      "enum": ["downloaded_form", "digital_form_printed", "in_person_clerk"],
      "description": "How the complaint was submitted. Three confirmed modes: (1) citizen downloads template from sp.batac.gov.ph and submits physical signed form; (2) citizen inputs on digital form in batac-dms, system generates printable form, citizen prints and signs; (3) citizen goes in person, clerk inputs, form printed on-site and signed. Physical signature still required. [Confirmed — Part 4.14; Part 4.15]"
    },

    "routing_decision": {
      "type": ["string", "null"],
      "description": "[Inference] SP Secretariat's recorded routing rationale. Secretariat decides routing — no fixed rule. [Confirmed — Q-B04: 'Secretariat decides routing — to committee directly, or to Vice Mayor, depending on the nature of the complaint']"
    },

    "outcome_state": {
      "type": "string",
      "enum": ["pending_hearing", "received_seen", "dismissed", "resolved"],
      "description": "Current complaint resolution status. [Confirmed — Part 4.14; Q-B04: four confirmed outcome states] Distinct from documents.lifecycle_state (which tracks document processing lifecycle). 'pending_hearing': complaint received; committee referral in progress. 'received_seen': Vice Mayor and/or Committee has received or seen the complaint. 'dismissed': complaint dismissed. 'resolved': committee report issued; complainant notified; case closed.",
      "default": "pending_hearing"
    }

  }
}
```

**GIN index:** A partial index on `(metadata->>'outcome_state')` is required to support the Secretariat's complaint status dashboard. [Inference]

---

#### 6. Document Request Form (`DOCUMENT_REQUEST_FORM`)

**Source:** Part 4.15

Fee-based process for copies of SP documents. Approval requires both Vice Mayor AND SP Secretary signature. [Confirmed — Part 4.15]

Payment system is deferred to stages later than currently planned phases (Q-D04). The `payment` object is included in the schema so that when payment is eventually implemented, the fields are already defined and backward-compatible with existing records (they simply remain `null` until payment is implemented).

**[RESOLVED — ADR-B3-1, June 2026]** The dual approval requirement (VM + SP Secretary) is modeled as two sequential `approval` steps in the Workflow Engine (B4 §4.2), consistent with the platform's general multi-party-signoff pattern, rather than as JSONB-only boolean flags. This document type now goes through `workflow.definitions`/`workflow.instances` like the legislative measure types, and is included in the `WorkflowCapableDocumentTypeSchema` enum in B3 §7.1. Consequently, `approval_status`, `approved_by_vm`, and `approved_by_sp_secretary` are **removed** from this schema below — they were the JSONB-only representation considered before this decision and are now redundant with `workflow.step_instances` and `workflow.instances` records, which are the source of truth for approval state. See ADR-B3-1 for full rationale, including why this was chosen over the JSONB-flag alternative (the deciding factor was unconditional audit coverage via `workflow.step.completed`, per B3 §7.12's OI-10 resolution).

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["requester", "documents_requested", "access_mode"],
  "additionalProperties": false,
  "properties": {

    "requester": {
      "type": "object",
      "description": "[Confirmed — Part 4.15: confirmed form fields]",
      "required": ["name"],
      "additionalProperties": false,
      "properties": {
        "name": {
          "type": "string",
          "description": "[Confirmed — Part 4.15]"
        },
        "agency_or_organization": {
          "type": ["string", "null"],
          "description": "[Confirmed — Part 4.15: 'requester name/agency']"
        },
        "email": {
          "type": ["string", "null"],
          "format": "email",
          "description": "[Confirmed — Part 4.15]"
        },
        "contact_number": {
          "type": ["string", "null"]
        },
        "id_type_presented": {
          "type": ["string", "null"],
          "description": "Type of government-issued ID presented at submission. [Confirmed — Part 4.15]"
        },
        "citizen_user_id": {
          "type": ["string", "null"],
          "format": "uuid",
          "description": "[Inference] Logical FK to a registered portal citizen account, if the requester has one."
        }
      }
    },

    "documents_requested": {
      "type": "array",
      "minItems": 1,
      "description": "[Confirmed — Part 4.15: 'Document type, title, number of pages']",
      "items": {
        "type": "object",
        "required": ["document_title"],
        "additionalProperties": false,
        "properties": {
          "document_id": {
            "type": ["string", "null"],
            "format": "uuid",
            "description": "[Inference] Logical FK to the document record being requested, if resolvable at time of request."
          },
          "document_type_label": {
            "type": ["string", "null"],
            "description": "[Confirmed — Part 4.15: 'document type']"
          },
          "document_title": {
            "type": "string",
            "description": "[Confirmed — Part 4.15]"
          },
          "document_number": {
            "type": ["string", "null"],
            "description": "[Inference] Series number or control number of the requested document, if known."
          },
          "number_of_pages": {
            "type": ["integer", "null"],
            "minimum": 1,
            "description": "[Confirmed — Part 4.15]"
          }
        }
      }
    },

    "purpose": {
      "type": ["string", "null"],
      "description": "[Confirmed — Part 4.15: 'purpose' is a confirmed form field]"
    },

    "access_mode": {
      "type": "string",
      "enum": ["downloaded_form", "digital_form_printed", "in_person_clerk"],
      "description": "How the request was submitted. Same three modes as Citizen Complaint. Physical signature still required. [Confirmed — Part 4.15]"
    },

    "payment": {
      "type": ["object", "null"],
      "description": "Payment details. [Confirmed — Part 4.15: 'Secretary's Fees under Ordinance No. 3SP 2014-05; OR number; collecting officer'] Payment system deferred to later stages (Q-D04). All fields remain null until payment is implemented.",
      "additionalProperties": false,
      "properties": {
        "or_number": {
          "type": ["string", "null"],
          "description": "Official Receipt number. [Confirmed — Part 4.15]"
        },
        "collecting_officer": {
          "type": ["string", "null"],
          "description": "[Confirmed — Part 4.15]"
        },
        "amount_paid": {
          "type": ["number", "null"],
          "minimum": 0
        },
        "payment_date": {
          "type": ["string", "null"],
          "format": "date"
        }
      }
    },

    "notification_channel": {
      "type": ["string", "null"],
      "enum": ["contact_number", "email", null],
      "description": "How the requester is notified after approval. [Confirmed — Part 4.15: 'person notified via contact number (primary channel)']"
    }

  }
}
```

**[REMOVED — ADR-B3-1]** `approval_status`, `approved_by_vm`, and `approved_by_sp_secretary` previously appeared here as JSONB-only approval tracking. Approval is now modeled as two sequential `approval` steps in the Workflow Engine (B4 §4.2). Query `workflow.step_instances` and `workflow.instances` for approval state instead of this document's JSONB — see ADR-B3-1 for full rationale.

---

#### 7. Transmittal Letter (`TRANSMITTAL_LETTER`)

**Source:** Part 4.1, Part 4.2, Part 4.9, Part 11.3

A Transmittal Letter is the formal cover letter accompanying a legislative measure when it is transmitted to the Mayor's Office. Content confirmed as "For appropriate action." [Confirmed — Part 4.1; Part 4.2] It is an SPS (Letters Sent) document and consumes from the `letters_sent` series counter.

Part 4.9 lists Transmittal Letters to the Mayor as one of the confirmed content types of Letters Sent. Part 11.3 confirms the workflow engine generates or prompts the Secretariat to generate a Transmittal Letter when a resolution or ordinance reaches the Mayor review step. [Confirmed — Part 4.9; Part 11.3]

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["associated_measure_id", "recipient_office_label"],
  "additionalProperties": false,
  "properties": {

    "associated_measure_id": {
      "type": "string",
      "format": "uuid",
      "description": "Logical FK to the SP Resolution, SP Ordinance, or Appropriation Ordinance this letter transmits. One Transmittal Letter per measure. [Confirmed — Part 4.1; Part 4.2: one transmittal letter accompanies each measure to the Mayor] Referential integrity enforced at the application layer."
    },

    "recipient_office_label": {
      "type": "string",
      "description": "[Inference] Display name of the recipient office. Default value for legislative measure transmittals: 'Office of the Mayor'. Stored as text rather than FK to support future use for other recipient offices.",
      "default": "Office of the Mayor"
    },

    "recipient_office_id": {
      "type": ["string", "null"],
      "format": "uuid",
      "description": "[Inference] Logical FK to organization.offices for the recipient, if the office is a registered office in the system."
    },

    "purpose_text": {
      "type": "string",
      "description": "The standard cover letter purpose line printed on the document. [Confirmed — Part 4.1; Part 4.2: 'For appropriate action']",
      "default": "For appropriate action"
    },

    "signed_by_user_id": {
      "type": ["string", "null"],
      "format": "uuid",
      "description": "[Inference] Logical FK to iam.users for the signatory. For Transmittal Letters accompanying legislative measures, the SP Secretary signs. [Confirmed — Part 4.9: 'Signatories: SP Secretary and Vice Mayor' for Letters Sent]"
    },

    "signed_by_display_name": {
      "type": ["string", "null"],
      "description": "[Inference] Denormalized at time of signing for immutable historical display."
    },

    "date_transmitted": {
      "type": ["string", "null"],
      "format": "date",
      "description": "[Inference] Date the letter was sent to the recipient. NULL until the transmittal action step is completed."
    }

  }
}
```

**Workflow integration:** When the workflow engine reaches the transmittal step for a legislative measure (Part 11.3: "system should generate or prompt the Secretariat to generate a Transmittal Letter"), it should either auto-generate a TRANSMITTAL_LETTER document record or prompt the Secretariat to initiate one. The generated record's `id` is then written to the measure's `documents.metadata.transmittal_letter_document_id`. These writes must be atomic. [Inference]

---

#### 8. Designation (`DESIGNATION`)

**Source:** Part 4.12, Part 11.13, Part 12 (Invariant 16)

Phase 1B document type. The `document_type` seed record and JSONB schema must be present before Phase 1 deployment because the `organization` module references `document_type_id` on delegation grant records created at designation logging. Activate the associated workflow definition in Phase 1B.

Each Designation has a dual number system: the originating authority's own memo/order reference embedded in the physical document, plus the SP Secretariat's control number in the `D {YEAR}-{NN}` format. [Confirmed — Part 4.12] The originating authority's reference is stored in `metadata.originating_document_reference`. The Secretariat's control number is stored in `documents.final_number`.

No Platform Administrator confirmation step is required. The `delegation_grant` record in `organization.delegation_grants` takes immediate effect when the Secretariat logs the Designation and enters the scope and time bounds. [Confirmed — Part 4.12; Part 11.13]

One active designation per person is enforced by a DB partial unique index on active `delegation_grants` per user. [Confirmed — Part 12 Invariant 16]

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "delegating_authority_user_id",
    "delegating_authority_display_name",
    "designated_person_user_id",
    "designated_person_display_name",
    "designated_position_title",
    "scope_description",
    "effective_from",
    "effective_until"
  ],
  "additionalProperties": false,
  "properties": {

    "delegating_authority_user_id": {
      "type": "string",
      "format": "uuid",
      "description": "Logical FK to iam.users for the Mayor or Vice Mayor issuing the Designation. [Confirmed — Part 4.12: 'Who initiates: Original authority only (Mayor or Vice Mayor per scope of designation)']"
    },

    "delegating_authority_display_name": {
      "type": "string",
      "description": "[Inference] Denormalized at time of logging for immutable historical display."
    },

    "designated_person_user_id": {
      "type": "string",
      "format": "uuid",
      "description": "Logical FK to iam.users for the person receiving the designation. [Confirmed — Part 4.12]"
    },

    "designated_person_display_name": {
      "type": "string",
      "description": "[Inference] Denormalized at time of logging."
    },

    "designated_position_title": {
      "type": "string",
      "description": "The position or role being designated. [Confirmed — Part 4.12 examples: 'Acting Mayor', 'OIC of SP Secretariat', 'Acting Vice Mayor']"
    },

    "scope_description": {
      "type": "string",
      "description": "Textual description of the scope of authority being delegated. Extracted from the physical Designation document by Secretariat staff and entered manually. [Confirmed — Part 4.12: 'Staff extracts scope and time bounds from the Designation document; enters in system manually']"
    },

    "effective_from": {
      "type": "string",
      "format": "date",
      "description": "Start date of the designation period. Always explicit. [Confirmed — Part 11.13: 'Open-ended delegations: Prohibited — duration must always be explicit']"
    },

    "effective_until": {
      "type": "string",
      "format": "date",
      "description": "End date of the designation period. Always explicit. Auto-expiry at this date: routing returns to the original authority automatically. [Confirmed — Part 4.12; Part 11.13]"
    },

    "originating_document_reference": {
      "type": ["string", "null"],
      "description": "The originating authority's own memo or order number as printed in the physical Designation document. [Confirmed — Part 4.12: 'Dual number system confirmed: Each Designation has two numbers — the originating authority's own memo/order number AND the SP Secretariat's control number'] The Secretariat's control number is in documents.final_number. This field holds the originating authority's own reference."
    },

    "legal_basis": {
      "type": ["string", "null"],
      "description": "Legal basis for the designation, as extracted from the physical document. [Confirmed — Part 4.12: 'Audit trail records: Original authority, designated person, time period, scope, legal basis']"
    },

    "delegation_grant_id": {
      "type": ["string", "null"],
      "format": "uuid",
      "description": "[Inference] Logical FK to the organization.delegation_grants record created when this Designation is logged. Set by the designation logging handler immediately upon document creation. NULL before the handler completes."
    }

  }
}
```

**Logging handler behavior:** When a Designation document is logged (document created and JSONB written), the handler must atomically:

1. Validate that the designated person has no other currently active `delegation_grant` (one-active enforcement; Part 12 Invariant 16).
2. Create the `organization.delegation_grants` record with immediate effect — no Platform Admin confirmation step. [Confirmed — Part 4.12; Part 11.13]
3. Write the new `delegation_grant.id` to `metadata.delegation_grant_id`.
4. Route affected workflow steps to the designated person for the duration. [Confirmed — Part 4.12]

---

### Implementation Notes

**1. Seed ordering**

`documents.document_types` seed must run **before** `documents.number_series` seed (H3), because H3 references `document_type_code` as a logical FK. No other dependency within this catalog; the eight records are independent of each other.

**2. Overlap with B4 workflow instance context — source of truth**

Three fields in the document JSONB overlap with fields in `workflow.instances.context` (B4 Appendix B):

|Document JSONB field|B4 context field|Source of truth|Direction|
|---|---|---|---|
|`certified_urgent`|`certified_urgent`|Document JSONB|Workflow engine reads from JSONB at instance creation and when bypass is applied|
|`certified_urgent` → indirectly →|`certified_urgent_document_id`|Document JSONB|Same as above|
|`has_penalty_provision` (ordinance)|`requires_publication`|Document JSONB|Decision step reads from document JSONB to set workflow context|
|`publication.publication_date`|`publication_date`|Both written in same transaction|Publication action step handler writes to both simultaneously|
|`publication.newspaper_name`|`publication_newspaper`|Both written in same transaction|Same as above|

All other B4 context fields (`mayor_action*`, `panlalawigan_outcome*`, `veto_override_*`, `second_reading_eligible_date`) have **no corresponding field in document JSONB**. They are operational workflow state, derivable from `workflow.step_instances` and `workflow.workflow_events` for any reporting purpose. Do not add these to document JSONB.

**3. Shared `7SP` prefix across three legislative types**

SP Resolution, SP Ordinance, and Appropriation Ordinance all render as `7SP {YEAR}-{NN}`. A rendered number like `7SP 2026-05` does not identify its type. The application must always display `document_types.name` alongside any rendered series number in listings, search results, QR scan outputs, and dashboards. [Confirmed — H3 Implementation Note 2]

**4. FK references inside JSONB**

Multiple JSONB fields in this catalog hold UUID references (e.g., `associated_measure_ids` on Certification of Urgency, `associated_measure_id` on Transmittal Letter, `delegation_grant_id` on Designation). PostgreSQL does not enforce FK constraints on JSONB values. Referential integrity for all JSONB UUID fields is enforced at the application layer only. Document this as a known limitation in the ADR for the `documents` module.

**5. Denormalized display names**

All `display_name` fields in JSONB are intentionally denormalized at the time of assignment (sponsors, delegating authority, designated person). Documents are legal records; the displayed name must reflect the name as of the signing event, not any subsequent account rename or deactivation in `iam.users`. This is consistent with the platform-wide soft-delete-only policy.

**6. GIN indexes**

GIN indexes on `documents.metadata` are required. Minimum targets before Phase 1 goes live:

|Expression|Document type|Use case|
|---|---|---|
|`(metadata->>'certified_urgent')`|SP_RESOLUTION, SP_ORDINANCE, SP_APPROPRIATION_ORDINANCE|Certified Urgent queue; Order of Business filtering|
|`(metadata->>'has_penalty_provision')`|SP_ORDINANCE|Publication workflow trigger; Index of Ordinances export|
|`(metadata->>'outcome_state')`|CITIZEN_COMPLAINT|Complaint status dashboard|

[Inference — specific index expressions must be confirmed against final query patterns]

**7. Designation — Phase 1B activation**

If `documents.document_types` includes an `is_active` boolean column, seed the Designation record with `is_active = false` and activate it when the Phase 1B Designation workflow definition is published. If no `is_active` flag exists, the seed record has no functional impact until a workflow definition references `DESIGNATION` as its `document_type_id`.

**8. Panlalawigan Review Log — excluded from this catalog**

H3 includes a `panlalawigan_review_log` series entry with a proposed `document_type_code = PANLALAWIGAN_REVIEW_LOG`. This catalog does **not** include a matching `document_type` record. The Panlalawigan Review Log (Part 4.3) is a registry entry tracking provincial review responses — it is not a legislative document issued or received by the SP Secretariat in the same sense as the types in this catalog. Whether it is modeled as a row in `documents.document_types` or as a distinct entity in the `tracking` or `records` schema is [Unverified — H3 Implementation Note 5 explicitly defers this]. Resolve before the Panlalawigan review tracking feature is implemented. If it is ultimately modeled as a document type, add it to this catalog then.

**9. Document Request Form — approval modeling decision `[RESOLVED — ADR-B3-1, June 2026]`**

**Resolution:** Dual approval (VM + SP Secretary) is modeled as two sequential `approval` steps in the Workflow Engine (B4 §4.2). The `approved_by_vm`, `approved_by_sp_secretary`, and `approval_status` JSONB flags referenced in the original open question have been removed from the §6 schema above as redundant with `workflow.step_instances`/`workflow.instances` records. This decision also resolved B3's OI-13 (the `documentType` enum on `workflow.instance.created` now includes `DOCUMENT_REQUEST_FORM`) and required two new termination outcome codes, `RELEASED_TO_REQUESTER` and `REQUEST_DENIED`, added to B3's `outcomeCode` enum (§7.2, resolving OI-14). See ADR-B3-1 for full rationale, including the rejected alternative (JSONB-only flags) and why audit-coverage consistency was the deciding factor.

**10. Citizen Complaint — `portal` schema partial initialization**

Part 11.9 assigns `complaints` to `schema: portal`. The full portal module is Phase 3, but Citizen Complaint is Phase 1 scope. In Phase 1, initialize the `portal` schema with only the tables needed for complaints and citizen access (document requests). Full portal module activation (public announcements, citizen portal UI) proceeds in Phase 3. This is [Inference] — the reference document does not explicitly address this partial initialization, but it follows logically from the phasing decisions.