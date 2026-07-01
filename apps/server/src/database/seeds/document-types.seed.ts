import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { documentTypes, numberSeries } from '@batac/database/schema/documents.schema.js';

// ────────── CONSTANTS ────────────────────────────────────────────────────────
const CITY_ID = '00000000-0000-4000-8000-000000000001';

// TODO: replace with actual records.retention_schedules UUID after REC seed runs
const RETENTION_PERMANENT = 'a1b2c3d4-5e6f-4000-8000-1e2f3a4b5c6d';
const RETENTION_CITIZENS_CORRESPONDENCE = 'c3d4e5f6-7a8b-4000-8000-2e3f4a5b6c7d';

// ────────── METADATA SCHEMAS ─────────────────────────────────────────────────

const SP_RESOLUTION_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['sponsors', 'subject_matter', 'certified_urgent'],
  additionalProperties: false,
  properties: {
    sponsors: {
      type: 'array',
      description: 'Councilors and Vice Mayor associated with this measure. Only councilors can formally sponsor; VM is included after the title. [Confirmed — Part 4.1]',
      items: {
        type: 'object',
        required: ['person_id', 'display_name', 'role'],
        additionalProperties: false,
        properties: {
          person_id: {
            type: 'string',
            format: 'uuid',
            description: 'Logical FK to iam.users or organization.employees at time of assignment'
          },
          display_name: {
            type: 'string',
            description: '[Inference] Name denormalized at time of assignment. Documents are legal records; the displayed name must reflect the name as of signing, not any subsequent account rename.'
          },
          role: {
            type: 'string',
            enum: ['author', 'co_author', 'introduced_by'],
            description: '[Inference] Role of this person in the measure'
          }
        }
      }
    },
    subject_matter: {
      type: 'object',
      description: 'Subject matter classification. Required for Index of Resolutions reporting. [Confirmed — Part 5.3 (Index of Ordinances fields applied to resolutions by analogy)]',
      required: ['general'],
      additionalProperties: false,
      properties: {
        general: {
          type: 'string',
          description: 'General subject matter category'
        },
        specific: {
          type: ['string', 'null'],
          description: 'Specific subject matter subcategory'
        }
      }
    },
    certified_urgent: {
      type: 'boolean',
      description: 'True when a Certification of Urgency has been logged for this measure. Causes committee referral bypass and same-session First and Second Readings. [Confirmed — Part 4.17; Part 11.3] Permanent source of truth; B4 workflow context derives from this field.',
      default: false
    },
    certification_of_urgency_document_id: {
      type: ['string', 'null'],
      format: 'uuid',
      description: '[Inference] Logical FK to the CERTIFICATION_OF_URGENCY document record attached to this measure. NULL when certified_urgent is false. Set by the Certification of Urgency logging handler concurrently with updating certified_urgent.'
    },
    transmittal_letter_document_id: {
      type: ['string', 'null'],
      format: 'uuid',
      description: '[Inference] Logical FK to the TRANSMITTAL_LETTER document generated when this measure is sent to the Mayor\'s Office. NULL until the transmittal action step is completed. Provides reverse lookup from measure to its transmittal letter without a join through the TRANSMITTAL_LETTER document\'s own JSONB.'
    },
    remarks: {
      type: ['string', 'null'],
      description: '[Inference] SP Secretariat free-text remarks field. Analogous to \'Remarks / Post Review Action of SP\' in the Index of Ordinances (Part 5.3). Populated after Panlalawigan review or veto proceedings when follow-up notes are needed.'
    }
  }
};

const SP_ORDINANCE_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['sponsors', 'subject_matter', 'certified_urgent', 'has_penalty_provision'],
  additionalProperties: false,
  properties: {
    sponsors: {
      type: 'array',
      description: 'Same structure as SP Resolution sponsors. [Confirmed — Part 4.2; Part 5.3]',
      items: {
        type: 'object',
        required: ['person_id', 'display_name', 'role'],
        additionalProperties: false,
        properties: {
          person_id: { type: 'string', format: 'uuid' },
          display_name: { type: 'string' },
          role: { type: 'string', enum: ['author', 'co_author', 'introduced_by'] }
        }
      }
    },
    subject_matter: {
      type: 'object',
      description: 'Subject matter classification. [Confirmed — Part 5.3]',
      required: ['general'],
      additionalProperties: false,
      properties: {
        general: { type: 'string' },
        specific: { type: ['string', 'null'] }
      }
    },
    certified_urgent: {
      type: 'boolean',
      description: 'True when a Certification of Urgency applies; bypasses committee referral and collapses First and Second Readings into the same session. [Confirmed — Part 4.17] Permanent source of truth; B4 workflow context derives from this field.',
      default: false
    },
    certification_of_urgency_document_id: {
      type: ['string', 'null'],
      format: 'uuid',
      description: '[Inference] Logical FK to the associated CERTIFICATION_OF_URGENCY document record. NULL when certified_urgent is false.'
    },
    has_penalty_provision: {
      type: 'boolean',
      description: 'Determines whether full-text newspaper publication in Ilocos Times is required after Panlalawigan review. True = publication required. SP Secretariat arranges placement. [Confirmed — Part 4.2; Q-C04] Set at document creation or at Second Reading when the penalty clause is confirmed. The B4 decision step evaluating this field reads from workflow context (requires_publication), which must be set from this field when the publication decision step activates.',
      default: false
    },
    publication: {
      type: ['object', 'null'],
      description: 'Permanent publication record. NULL until publication occurs. Required (must not be null) when has_penalty_provision is true and the publication action step completes. Penalty ordinances without this field populated are not considered fully processed. [Confirmed — Part 4.2; Part 5.3; Q-C04]',
      required: ['newspaper_name', 'publication_date'],
      additionalProperties: false,
      properties: {
        newspaper_name: {
          type: 'string',
          description: 'Newspaper where full ordinance text was published. [Confirmed — Ilocos Times, Part 4.2]'
        },
        publication_date: {
          type: 'string',
          format: 'date',
          description: 'Date of publication. Mandatory tracked field in SP records. [Confirmed — Part 4.2; Part 5.3; Q-C04]'
        }
      }
    },
    transmittal_letter_document_id: {
      type: ['string', 'null'],
      format: 'uuid',
      description: '[Inference] Logical FK to the TRANSMITTAL_LETTER document generated for this ordinance.'
    },
    remarks: {
      type: ['string', 'null'],
      description: '[Inference] SP Secretariat remarks. Analogous to \'Remarks / Post Review Action of SP\' in Part 5.3.'
    }
  }
};

const SP_APPROPRIATION_ORDINANCE_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['sponsors', 'subject_matter', 'certified_urgent', 'budget_period_year', 'is_supplemental'],
  additionalProperties: false,
  properties: {
    sponsors: {
      type: 'array',
      description: '[Confirmed — Part 4.2]',
      items: {
        type: 'object',
        required: ['person_id', 'display_name', 'role'],
        additionalProperties: false,
        properties: {
          person_id: { type: 'string', format: 'uuid' },
          display_name: { type: 'string' },
          role: { type: 'string', enum: ['author', 'co_author', 'introduced_by'] }
        }
      }
    },
    subject_matter: {
      type: 'object',
      required: ['general'],
      additionalProperties: false,
      properties: {
        general: { type: 'string' },
        specific: { type: ['string', 'null'] }
      }
    },
    certified_urgent: {
      type: 'boolean',
      description: 'Permanent source of truth; B4 workflow context derives from this field. [Confirmed — Part 4.17]',
      default: false
    },
    certification_of_urgency_document_id: {
      type: ['string', 'null'],
      format: 'uuid'
    },
    budget_period_year: {
      type: 'integer',
      description: '[Inference] Fiscal year this Appropriation Ordinance governs (e.g., 2026). Multiple appropriation ordinances may be enacted in the same SP-ordinal year (regular + supplemental); this field disambiguates them. Not confirmed as a tracked field in the reference document; required for operational use.',
      minimum: 2000,
      maximum: 2100
    },
    is_supplemental: {
      type: 'boolean',
      description: '[Inference] True when this is a Supplemental Appropriation Ordinance allocating additional funds to the initial budget for the same fiscal year. [Confirmed — Part 4.2: \'Supplemental Appropriation Ordinances (allocate more to initial budget) follow the same flow\']',
      default: false
    },
    transmittal_letter_document_id: {
      type: ['string', 'null'],
      format: 'uuid',
      description: '[Inference] Logical FK to the TRANSMITTAL_LETTER document generated for this measure.'
    },
    remarks: {
      type: ['string', 'null']
    }
  }
};

const CERTIFICATION_OF_URGENCY_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: [
    'issuing_authority_user_id',
    'issuing_authority_display_name',
    'session_date',
    'associated_measure_ids'
  ],
  additionalProperties: false,
  properties: {
    issuing_authority_user_id: {
      type: 'string',
      format: 'uuid',
      description: 'Logical FK to iam.users for the Mayor who issued the Certification. [Confirmed — Part 4.17: \'Issued by: Mayor (formal written document)\']'
    },
    issuing_authority_display_name: {
      type: 'string',
      description: '[Inference] Denormalized at time of logging. Required for immutable historical display even if the account is later deactivated.'
    },
    session_date: {
      type: 'string',
      format: 'date',
      description: '[Inference] The session date for which this Certification applies. A single Certification can cover multiple measures in the same session. [Confirmed — Part 4.17; Q-B01] Required to correlate this Certification with the correct Order of Business.'
    },
    associated_measure_ids: {
      type: 'array',
      minItems: 1,
      description: 'Logical FK references to all legislative measure document records this Certification covers. One Certification can cover multiple measures in the same session. [Confirmed — Part 4.17; Q-B01] All entries must reference documents of type SP_RESOLUTION, SP_ORDINANCE, or SP_APPROPRIATION_ORDINANCE. Referential integrity is enforced at the application layer — PostgreSQL does not enforce FK constraints on JSONB array contents.',
      items: {
        type: 'string',
        format: 'uuid'
      }
    },
    remarks: {
      type: ['string', 'null'],
      description: '[Inference] Optional Secretariat notes at logging time.'
    }
  }
};

const CITIZEN_COMPLAINT_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['complainant', 'subject_category', 'access_mode', 'outcome_state'],
  additionalProperties: false,
  properties: {
    complainant: {
      type: 'object',
      description: 'Complainant details. [Confirmed — Part 4.14 confirmed form fields]',
      required: ['name'],
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          description: '[Confirmed — Part 4.14]'
        },
        address: {
          type: ['string', 'null'],
          description: '[Confirmed — Part 4.14]'
        },
        contact_number: {
          type: ['string', 'null'],
          description: '[Confirmed — Part 4.14]'
        },
        email: {
          type: ['string', 'null'],
          format: 'email',
          description: '[Confirmed — Part 4.14]'
        },
        citizen_user_id: {
          type: ['string', 'null'],
          format: 'uuid',
          description: '[Inference] Logical FK to a registered portal citizen account, if the complainant has one. NULL for walk-in or form-submitted complaints where no account is linked.'
        }
      }
    },
    subject_category: {
      type: 'string',
      description: 'Nature or subject of the complaint. Any LGU-related complaint can be filed; transportation is the primary confirmed example. [Confirmed — Q-B04] The platform should allow freeform entry rather than a closed enum, since categories are not exhaustively defined in the reference document.',
      examples: ['transportation', 'public_works', 'barangay_affairs', 'environment', 'other']
    },
    violation_type: {
      type: ['string', 'null'],
      description: 'Specific violation type, where applicable. [Confirmed — Part 4.14: \'Violation type (overcharging, trip cutting, refused to convey, discourtesy, others)\' for transportation complaints] Free-text or enum; the reference document defines the transportation set but no other category\'s values.',
      examples: ['overcharging', 'trip_cutting', 'refused_to_convey', 'discourtesy', 'others']
    },
    incident_details: {
      type: 'object',
      description: '[Confirmed — Part 4.14 confirmed form fields for transportation complaints; apply to all complaint types]',
      additionalProperties: false,
      properties: {
        date: {
          type: ['string', 'null'],
          format: 'date',
          description: '[Confirmed — Part 4.14]'
        },
        time: {
          type: ['string', 'null'],
          description: 'Time of incident. Free text to accommodate partial times (e.g., \'afternoon\', \'14:30\'). [Confirmed — Part 4.14]'
        },
        place: {
          type: ['string', 'null'],
          description: '[Confirmed — Part 4.14]'
        },
        narrative: {
          type: ['string', 'null'],
          description: '[Confirmed — Part 4.14 \'remarks\' field on complaint form]'
        }
      }
    },
    respondent: {
      type: ['object', 'null'],
      description: 'Respondent details. NULL when no specific respondent is named (e.g., complaint against an office rather than an individual). [Confirmed — Part 4.14]',
      additionalProperties: false,
      properties: {
        name: {
          type: ['string', 'null']
        },
        tricycle_number: {
          type: ['string', 'null'],
          description: 'Tricycle unit number. Applicable for transportation complaints. [Confirmed — Part 4.14]'
        },
        contact_number: {
          type: ['string', 'null']
        },
        email: {
          type: ['string', 'null'],
          format: 'email'
        },
        notification_channel: {
          type: ['string', 'null'],
          enum: ['email', 'sms_in_person_claim', null],
          description: 'How formal written notice is delivered to the respondent. \'email\': notice and formal written notice sent by email. \'sms_in_person_claim\': notification sent by phone/SMS; respondent must claim the written notice in person at the LGU. [Confirmed — Part 4.14; Q-B04]'
        }
      }
    },
    access_mode: {
      type: 'string',
      enum: ['downloaded_form', 'digital_form_printed', 'in_person_clerk'],
      description: 'How the complaint was submitted. Three confirmed modes: (1) citizen downloads template from sp.batac.gov.ph and submits physical signed form; (2) citizen inputs on digital form in batac-dms, system generates printable form, citizen prints and signs; (3) citizen goes in person, clerk inputs, form printed on-site and signed. Physical signature still required. [Confirmed — Part 4.14; Part 4.15]'
    },
    routing_decision: {
      type: ['string', 'null'],
      description: '[Inference] SP Secretariat\'s recorded routing rationale. Secretariat decides routing — no fixed rule. [Confirmed — Q-B04: \'Secretariat decides routing — to committee directly, or to Vice Mayor, depending on the nature of the complaint\']'
    },
    outcome_state: {
      type: 'string',
      enum: ['pending_hearing', 'received_seen', 'dismissed', 'resolved'],
      description: 'Current complaint resolution status. [Confirmed — Part 4.14; Q-B04: four confirmed outcome states] Distinct from documents.lifecycle_state (which tracks document processing lifecycle). \'pending_hearing\': complaint received; committee referral in progress. \'received_seen\': Vice Mayor and/or Committee has received or seen the complaint. \'dismissed\': complaint dismissed. \'resolved\': committee report issued; complainant notified; case closed.',
      default: 'pending_hearing'
    }
  }
};

const DOCUMENT_REQUEST_FORM_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['requester', 'documents_requested', 'access_mode'],
  additionalProperties: false,
  properties: {
    requester: {
      type: 'object',
      description: '[Confirmed — Part 4.15: confirmed form fields]',
      required: ['name'],
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          description: '[Confirmed — Part 4.15]'
        },
        agency_or_organization: {
          type: ['string', 'null'],
          description: '[Confirmed — Part 4.15: \'requester name/agency\']'
        },
        email: {
          type: ['string', 'null'],
          format: 'email',
          description: '[Confirmed — Part 4.15]'
        },
        contact_number: {
          type: ['string', 'null']
        },
        id_type_presented: {
          type: ['string', 'null'],
          description: 'Type of government-issued ID presented at submission. [Confirmed — Part 4.15]'
        },
        citizen_user_id: {
          type: ['string', 'null'],
          format: 'uuid',
          description: '[Inference] Logical FK to a registered portal citizen account, if the requester has one.'
        }
      }
    },
    documents_requested: {
      type: 'array',
      minItems: 1,
      description: '[Confirmed — Part 4.15: \'Document type, title, number of pages\']',
      items: {
        type: 'object',
        required: ['document_title'],
        additionalProperties: false,
        properties: {
          document_id: {
            type: ['string', 'null'],
            format: 'uuid',
            description: '[Inference] Logical FK to the document record being requested, if resolvable at time of request.'
          },
          document_type_label: {
            type: ['string', 'null'],
            description: '[Confirmed — Part 4.15: \'document type\']'
          },
          document_title: {
            type: 'string',
            description: '[Confirmed — Part 4.15]'
          },
          document_number: {
            type: ['string', 'null'],
            description: '[Inference] Series number or control number of the requested document, if known.'
          },
          number_of_pages: {
            type: ['integer', 'null'],
            minimum: 1,
            description: '[Confirmed — Part 4.15]'
          }
        }
      }
    },
    purpose: {
      type: ['string', 'null'],
      description: '[Confirmed — Part 4.15: \'purpose\' is a confirmed form field]'
    },
    access_mode: {
      type: 'string',
      enum: ['downloaded_form', 'digital_form_printed', 'in_person_clerk'],
      description: 'How the request was submitted. Same three modes as Citizen Complaint. Physical signature still required. [Confirmed — Part 4.15]'
    },
    payment: {
      type: ['object', 'null'],
      description: 'Payment details. [Confirmed — Part 4.15: \'Secretary\'s Fees under Ordinance No. 3SP 2014-05; OR number; collecting officer\'] Payment system deferred to later stages (Q-D04). All fields remain null until payment is implemented.',
      additionalProperties: false,
      properties: {
        or_number: {
          type: ['string', 'null'],
          description: 'Official Receipt number. [Confirmed — Part 4.15]'
        },
        collecting_officer: {
          type: ['string', 'null'],
          description: '[Confirmed — Part 4.15]'
        },
        amount_paid: {
          type: ['number', 'null'],
          minimum: 0
        },
        payment_date: {
          type: ['string', 'null'],
          format: 'date'
        }
      }
    },
    notification_channel: {
      type: ['string', 'null'],
      enum: ['contact_number', 'email', null],
      description: 'How the requester is notified after approval. [Confirmed — Part 4.15: \'person notified via contact number (primary channel)\']'
    }
  }
};

const TRANSMITTAL_LETTER_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['associated_measure_id', 'recipient_office_label'],
  additionalProperties: false,
  properties: {
    associated_measure_id: {
      type: 'string',
      format: 'uuid',
      description: 'Logical FK to the SP Resolution, SP Ordinance, or Appropriation Ordinance this letter transmits. One Transmittal Letter per measure. [Confirmed — Part 4.1; Part 4.2: one transmittal letter accompanies each measure to the Mayor] Referential integrity enforced at the application layer.'
    },
    recipient_office_label: {
      type: 'string',
      description: '[Inference] Display name of the recipient office. Default value for legislative measure transmittals: \'Office of the Mayor\'. Stored as text rather than FK to support future use for other recipient offices.',
      default: 'Office of the Mayor'
    },
    recipient_office_id: {
      type: ['string', 'null'],
      format: 'uuid',
      description: '[Inference] Logical FK to organization.offices for the recipient, if the office is a registered office in the system.'
    },
    purpose_text: {
      type: 'string',
      description: 'The standard cover letter purpose line printed on the document. [Confirmed — Part 4.1; Part 4.2: \'For appropriate action\']',
      default: 'For appropriate action'
    },
    signed_by_user_id: {
      type: ['string', 'null'],
      format: 'uuid',
      description: '[Inference] Logical FK to iam.users for the signatory. For Transmittal Letters accompanying legislative measures, the SP Secretary signs. [Confirmed — Part 4.9: \'Signatories: SP Secretary and Vice Mayor\' for Letters Sent]'
    },
    signed_by_display_name: {
      type: ['string', 'null'],
      description: '[Inference] Denormalized at time of signing for immutable historical display.'
    },
    date_transmitted: {
      type: ['string', 'null'],
      format: 'date',
      description: '[Inference] Date the letter was sent to the recipient. NULL until the transmittal action step is completed.'
    }
  }
};

const DESIGNATION_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: [
    'delegating_authority_user_id',
    'delegating_authority_display_name',
    'designated_person_user_id',
    'designated_person_display_name',
    'designated_position_title',
    'scope_description',
    'effective_from',
    'effective_until'
  ],
  additionalProperties: false,
  properties: {
    delegating_authority_user_id: {
      type: 'string',
      format: 'uuid',
      description: 'Logical FK to iam.users for the Mayor or Vice Mayor issuing the Designation. [Confirmed — Part 4.12: \'Who initiates: Original authority only (Mayor or Vice Mayor per scope of designation)\']'
    },
    delegating_authority_display_name: {
      type: 'string',
      description: '[Inference] Denormalized at time of logging for immutable historical display.'
    },
    designated_person_user_id: {
      type: 'string',
      format: 'uuid',
      description: 'Logical FK to iam.users for the person receiving the designation. [Confirmed — Part 4.12]'
    },
    designated_person_display_name: {
      type: 'string',
      description: '[Inference] Denormalized at time of logging.'
    },
    designated_position_title: {
      type: 'string',
      description: 'The position or role being designated. [Confirmed — Part 4.12 examples: \'Acting Mayor\', \'OIC of SP Secretariat\', \'Acting Vice Mayor\']'
    },
    scope_description: {
      type: 'string',
      description: 'Textual description of the scope of authority being delegated. Extracted from the physical Designation document by Secretariat staff and entered manually. [Confirmed — Part 4.12: \'Staff extracts scope and time bounds from the Designation document; enters in system manually\']'
    },
    effective_from: {
      type: 'string',
      format: 'date',
      description: 'Start date of the designation period. Always explicit. [Confirmed — Part 11.13: \'Open-ended delegations: Prohibited — duration must always be explicit\']'
    },
    effective_until: {
      type: 'string',
      format: 'date',
      description: 'End date of the designation period. Always explicit. Auto-expiry at this date: routing returns to the original authority automatically. [Confirmed — Part 4.12; Part 11.13]'
    },
    originating_document_reference: {
      type: ['string', 'null'],
      description: 'The originating authority\'s own memo or order number as printed in the physical Designation document. [Confirmed — Part 4.12: \'Dual number system confirmed: Each Designation has two numbers — the originating authority\'s own memo/order number AND the SP Secretariat\'s control number\'] The Secretariat\'s control number is in documents.final_number. This field holds the originating authority\'s own reference.'
    },
    legal_basis: {
      type: ['string', 'null'],
      description: 'Legal basis for the designation, as extracted from the physical document. [Confirmed — Part 4.12: \'Audit trail records: Original authority, designated person, time period, scope, legal basis\']'
    },
    delegation_grant_id: {
      type: ['string', 'null'],
      format: 'uuid',
      description: '[Inference] Logical FK to the organization.delegation_grants record created when this Designation is logged. Set by the designation logging handler immediately upon document creation. NULL before the handler completes.'
    }
  }
};

// ────────── DEFINITIONS ───────────────────────────────────────────────────────

interface DocumentTypeDef {
  id: string;
  name: string;
  code: string;
  owningModule: 'workflow' | 'portal' | 'organization';
  seriesKey: string | null;
  hasPreliminaryNumbering: boolean;
  controlNumberDeferred: boolean;
  requiresPublication: boolean;
  retentionScheduleId: string;
  classificationDefault: 'public' | 'internal' | 'confidential' | 'restricted';
  publicVisibilityRule: 'title_and_first_page_public' | 'not_public' | 'complainant_restricted' | 'requester_restricted';
  metadataSchema: Record<string, any>;
  isActive: boolean;
}

const DOCUMENT_TYPE_DEFINITIONS: DocumentTypeDef[] = [
  {
    id: 'de30b91e-3f6c-4b5b-8f3e-8c3b1e7c5c01',
    name: 'SP Resolution',
    code: 'SP_RESOLUTION',
    owningModule: 'workflow',
    seriesKey: 'sp_resolution',
    hasPreliminaryNumbering: true,
    controlNumberDeferred: false,
    requiresPublication: false,
    retentionScheduleId: RETENTION_PERMANENT,
    classificationDefault: 'internal',
    publicVisibilityRule: 'title_and_first_page_public',
    metadataSchema: SP_RESOLUTION_SCHEMA,
    isActive: true,
  },
  {
    id: 'de30b91e-3f6c-4b5b-8f3e-8c3b1e7c5c02',
    name: 'SP Ordinance',
    code: 'SP_ORDINANCE',
    owningModule: 'workflow',
    seriesKey: 'sp_ordinance',
    hasPreliminaryNumbering: true,
    controlNumberDeferred: false,
    requiresPublication: false,
    retentionScheduleId: RETENTION_PERMANENT,
    classificationDefault: 'internal',
    publicVisibilityRule: 'title_and_first_page_public',
    metadataSchema: SP_ORDINANCE_SCHEMA,
    isActive: true,
  },
  {
    id: 'de30b91e-3f6c-4b5b-8f3e-8c3b1e7c5c03',
    name: 'Appropriation Ordinance',
    code: 'SP_APPROPRIATION_ORDINANCE',
    owningModule: 'workflow',
    seriesKey: 'sp_appropriation_ordinance',
    hasPreliminaryNumbering: true,
    controlNumberDeferred: false,
    requiresPublication: false,
    retentionScheduleId: RETENTION_PERMANENT,
    classificationDefault: 'internal',
    publicVisibilityRule: 'title_and_first_page_public',
    metadataSchema: SP_APPROPRIATION_ORDINANCE_SCHEMA,
    isActive: true,
  },
  {
    id: 'de30b91e-3f6c-4b5b-8f3e-8c3b1e7c5c04',
    name: 'Certification of Urgency',
    code: 'CERTIFICATION_OF_URGENCY',
    owningModule: 'workflow',
    seriesKey: null,
    hasPreliminaryNumbering: false,
    controlNumberDeferred: false,
    requiresPublication: false,
    retentionScheduleId: RETENTION_PERMANENT,
    classificationDefault: 'internal',
    publicVisibilityRule: 'not_public',
    metadataSchema: CERTIFICATION_OF_URGENCY_SCHEMA,
    isActive: true,
  },
  {
    id: 'de30b91e-3f6c-4b5b-8f3e-8c3b1e7c5c05',
    name: 'Citizen Complaint',
    code: 'CITIZEN_COMPLAINT',
    owningModule: 'portal',
    seriesKey: null,
    hasPreliminaryNumbering: false,
    controlNumberDeferred: false,
    requiresPublication: false,
    retentionScheduleId: RETENTION_CITIZENS_CORRESPONDENCE,
    classificationDefault: 'internal',
    publicVisibilityRule: 'complainant_restricted',
    metadataSchema: CITIZEN_COMPLAINT_SCHEMA,
    isActive: true,
  },
  {
    id: 'de30b91e-3f6c-4b5b-8f3e-8c3b1e7c5c06',
    name: 'Document Request Form',
    code: 'DOCUMENT_REQUEST_FORM',
    owningModule: 'portal',
    seriesKey: null,
    hasPreliminaryNumbering: false,
    controlNumberDeferred: false,
    requiresPublication: false,
    retentionScheduleId: RETENTION_CITIZENS_CORRESPONDENCE,
    classificationDefault: 'internal',
    publicVisibilityRule: 'requester_restricted',
    metadataSchema: DOCUMENT_REQUEST_FORM_SCHEMA,
    isActive: true,
  },
  {
    id: 'de30b91e-3f6c-4b5b-8f3e-8c3b1e7c5c07',
    name: 'Transmittal Letter',
    code: 'TRANSMITTAL_LETTER',
    owningModule: 'workflow',
    seriesKey: 'letters_sent',
    hasPreliminaryNumbering: false,
    controlNumberDeferred: false,
    requiresPublication: false,
    retentionScheduleId: RETENTION_PERMANENT,
    classificationDefault: 'internal',
    publicVisibilityRule: 'not_public',
    metadataSchema: TRANSMITTAL_LETTER_SCHEMA,
    isActive: true,
  },
  {
    id: 'de30b91e-3f6c-4b5b-8f3e-8c3b1e7c5c08',
    name: 'Designation',
    code: 'DESIGNATION',
    owningModule: 'organization',
    seriesKey: 'designation',
    hasPreliminaryNumbering: false,
    controlNumberDeferred: false,
    requiresPublication: false,
    retentionScheduleId: RETENTION_PERMANENT,
    classificationDefault: 'internal',
    publicVisibilityRule: 'not_public',
    metadataSchema: DESIGNATION_SCHEMA,
    isActive: false, // Phase 1B (seeded inactive)
  },
];

// ────────── MAIN SEED FUNCTION ─────────────────────────────────────────────────
async function main() {
  const databaseUrl = process.env['DATABASE_URL_MIGRATE'] || process.env['DATABASE_URL_APP'];

  if (!databaseUrl) {
    console.error('[seed:document-types] Error: DATABASE_URL_MIGRATE or DATABASE_URL_APP environment variable is not set.');
    process.exit(1);
  }

  console.log('[seed:document-types] Connecting to database...');
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    await db.transaction(async (tx) => {
      console.log('[seed:document-types] Seeding 8 document types...');
      let seededCount = 0;

      for (const def of DOCUMENT_TYPE_DEFINITIONS) {
        // Query if associated number series exists to resolve numberSeriesId
        let numberSeriesId: string | null = null;
        if (def.seriesKey) {
          const [series] = await tx
            .select({ id: numberSeries.id })
            .from(numberSeries)
            .where(
              sql`${numberSeries.cityId} = ${CITY_ID} AND ${numberSeries.seriesKey} = ${def.seriesKey}`
            )
            .limit(1);

          if (series) {
            numberSeriesId = series.id;
          } else {
            console.warn(`[seed:document-types] Warning: Number series with key "${def.seriesKey}" not found. Will insert with null number_series_id.`);
          }
        }

        // Upsert the document type
        const [upserted] = await tx
          .insert(documentTypes)
          .values({
            id: def.id,
            cityId: CITY_ID,
            name: def.name,
            code: def.code,
            owningModule: def.owningModule,
            numberSeriesId,
            hasPreliminaryNumbering: def.hasPreliminaryNumbering,
            controlNumberDeferred: def.controlNumberDeferred,
            requiresPublication: def.requiresPublication,
            retentionScheduleId: def.retentionScheduleId,
            classificationDefault: def.classificationDefault,
            publicVisibilityRule: def.publicVisibilityRule,
            metadataSchema: def.metadataSchema,
            isActive: def.isActive,
          })
          .onConflictDoUpdate({
            target: [documentTypes.cityId, documentTypes.code],
            set: {
              name: def.name,
              owningModule: def.owningModule,
              numberSeriesId,
              hasPreliminaryNumbering: def.hasPreliminaryNumbering,
              controlNumberDeferred: def.controlNumberDeferred,
              requiresPublication: def.requiresPublication,
              retentionScheduleId: def.retentionScheduleId,
              classificationDefault: def.classificationDefault,
              publicVisibilityRule: def.publicVisibilityRule,
              metadataSchema: def.metadataSchema,
              isActive: def.isActive,
              updatedAt: new Date(),
            },
          })
          .returning({ id: documentTypes.id });

        const docTypeId = upserted.id;

        // Dynamic cross-referencing: Update the number_series table to point back to the new documentType ID.
        if (def.seriesKey && numberSeriesId) {
          console.log(`[seed:document-types] Cross-referencing number series "${def.seriesKey}" with document type ID "${docTypeId}"`);
          await tx
            .update(numberSeries)
            .set({
              documentTypeId: docTypeId,
              updatedAt: new Date(),
            })
            .where(
              sql`${numberSeries.id} = ${numberSeriesId}`
            );
        }

        seededCount++;
      }

      console.log(`[seed:document-types] Seeding completed. Upserted ${seededCount} document types.`);
    });

    console.log('[seed:document-types] Document types seeding completed successfully.');
  } catch (error) {
    console.error('[seed:document-types] Database seeding failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[seed:document-types] Unhandled error during seeding:', err);
  process.exit(1);
});
