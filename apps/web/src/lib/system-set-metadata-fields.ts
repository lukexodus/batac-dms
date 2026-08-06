/**
 * Metadata field names that are set by backend handlers after intake, never
 * entered by the user at document-creation time. Declared (with descriptions
 * confirming this) in three schemas in
 * apps/server/src/database/seeds/document-types.seed.ts:
 * SP_RESOLUTION_SCHEMA, SP_ORDINANCE_SCHEMA, APPROPRIATION_ORDINANCE_SCHEMA.
 *
 * DynamicField (DocumentIntakePage.tsx) excludes any top-level metadata key
 * in this set from rendering at intake, regardless of which document type is
 * selected — the field name itself is what marks it system-set, not the
 * document type. Added by TASK-DOCS-FE-022.
 */
export const SYSTEM_SET_METADATA_FIELDS = new Set([
  'certification_of_urgency_document_id',
  'transmittal_letter_document_id',
  'certified_urgent',
]);
