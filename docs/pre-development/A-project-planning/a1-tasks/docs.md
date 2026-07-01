# TASK LIST — Module: DOCS (Documents)

Generated per `A1-AGENTS.md` §6 "Step 2 — Module passes."
Wave D — runs after ORG (Wave C) task list is complete.

**Documents loaded for this pass, in order:**
1. `docs/pre-development/A-project-planning/a1-skeleton.md` (v2.1)
2. `docs/pre-development/A-project-planning/a1-tasks/org.md` (10 tasks + Module Summary)
3. `docs/pre-development/C-database/c1-full-database-schema-ddl-v3.md` §documents (Part 5, L741-L1233) + Part 12 §documents RLS (L1912-L2025) + Part 13 reserved schemas note (L2027-L2037)
4. `docs/pre-development/H-domain-configuration-documents/h2-document-type-catalog-with-jsonb-metadata-schemas-v1.1.md` (all sections)
5. `docs/pre-development/H-domain-configuration-documents/h3-numbering-series-configuration-specification.md` (all sections)
6. `docs/pre-development/E-api-design/e1-trpc-router-and-procedure-catalog.md` Module 3 (L599-L878), Module 10 (L1388-L1447), Module 11 (L1449-L1519)
7. `docs/pre-development/E-api-design/e3-shared-zod-schema-catalog.md` Parts 4-5 (L1220-L2203)
8. `docs/pre-development/B-architecture-documents/b2-module-boundary-and-internal-api-contracts-v1.1.md` Module 3 (L389-L564)
9. `docs/pre-development/I-security-and-authorization/i1-abac-policy-specification.md` §§3-4, §14, §15 relevant invariants, §17
10. `docs/pre-development/I-security-and-authorization/i2-role-permission-matrix.md` §§4-5, 9, 12-14, 17 + Conditional Notes

**Sourcing legend:**
- Unmarked — taken directly from one of the loaded sources.
- `[Inference]` — reasoned synthesis not stated verbatim in any loaded document.
- `[SPEC GAP]` — something a loaded source requires but no loaded document specifies clearly enough to write a self-contained AI Prompt for. Left for human resolution per `A1-AGENTS.md` §8.
- `[CONFLICT]` — disagreement between two loaded sources, flagged per A1-AGENTS.md §1; document followed is stated.

---

## Table of Contents

- [L190–L211] TASK-DOCS-001 — [MIGRATION] Create documents schema Drizzle definitions and DDL migration
- [L212–L220] Project-wide DDL conventions (C1 Part 1) — Project-wide DDL conventions (C1 Part 1) — Project-wide DDL conventions (C1 Part 1)
- [L221–L604] Table definitions (C1 Part 5, L741-L1233) — Table definitions (C1 Part 5, L741-L1233) — Table definitions (C1 Part 5, L741-L1233)
  - [L223–L252] documents.document_types
  - [L253–L287] documents.number_series
  - [L288–L338] documents.documents
  - [L339–L368] Lifecycle transition trigger (add manually to migration after db:generate)
  - [L369–L405] documents.numbers
  - [L406–L438] documents.versions
  - [L439–L460] documents.attachments
  - [L461–L479] documents.signatures
  - [L480–L497] documents.document_sponsorships
  - [L498–L524] documents.panlalawigan_reviews
  - [L525–L542] documents.classification_allowlists (resolved I1 D-ABAC-02)
  - [L543–L571] fn_get_next_sequence_value (add manually to migration)
  - [L572–L604] Grants and RLS (C1 Part 12 -- add to end of migration manually)
- [L605–L625] TASK-DOCS-002 — Scaffold DOCS module file structure with typed stubs
- [L626–L628] Module location — Module location — Module location
- [L629–L650] Published API interface (B2 Module 3 -- paste verbatim into documents.types.ts) — Published API interface (B2 Module 3 -- paste verbatim into documents.types.ts) — Published API interface (B2 Module 3 -- paste verbatim into documents.types.ts)
- [L651–L669] Pattern to follow — Pattern to follow — Pattern to follow
- [L670–L688] TASK-DOCS-003 — Implement shared Zod schemas — documents and document-metadata domains (E3 Parts 4-5)
- [L689–L692] Files — Files — Files
- [L693–L705] Key enum schemas (documents.ts) — Key enum schemas (documents.ts) — Key enum schemas (documents.ts)
- [L706–L719] LogPanlalawiganOutcomeInputSchema (with refine -- implement exactly) — LogPanlalawiganOutcomeInputSchema (with refine -- implement exactly) — LogPanlalawiganOutcomeInputSchema (with refine -- implement exactly)
- [L720–L736] SpResolutionMetadataSchema (with refine) — SpResolutionMetadataSchema (with refine) — SpResolutionMetadataSchema (with refine)
- [L737–L753] DesignationMetadataSchema (with refines) — DesignationMetadataSchema (with refines) — DesignationMetadataSchema (with refines)
- [L754–L761] CitizenComplaintMetadataSchema (implement from H2 §5 spec) — CitizenComplaintMetadataSchema (implement from H2 §5 spec) — CitizenComplaintMetadataSchema (implement from H2 §5 spec)
- [L762–L768] DocumentRequestFormMetadataSchema (implement from H2 §6 spec) — DocumentRequestFormMetadataSchema (implement from H2 §6 spec) — DocumentRequestFormMetadataSchema (implement from H2 §6 spec)
- [L769–L800] DocumentMetadataSchema discriminated union — DocumentMetadataSchema discriminated union — DocumentMetadataSchema discriminated union
- [L801–L817] TASK-DOCS-004 — Implement DOCS repository layer — all nine documents.* tables
- [L818–L823] Cross-module boundary rules (B2 Module 3, Law #2) — Cross-module boundary rules (B2 Module 3, Law #2) — Cross-module boundary rules (B2 Module 3, Law #2)
- [L824–L829] Key type conventions — Key type conventions — Key type conventions
- [L830–L834] updateDocumentNumbering -- atomic operation — updateDocumentNumbering -- atomic operation — updateDocumentNumbering -- atomic operation
- [L835–L860] hasClassificationAllowlistEntry — hasClassificationAllowlistEntry — hasClassificationAllowlistEntry
- [L861–L879] TASK-DOCS-005 — Implement numbering service (fn_get_next_sequence_value wrapper, preliminary/final assignment, gap logging)
- [L880–L903] Number assignment rules (H3 + C1 Part 5) — Number assignment rules (H3 + C1 Part 5) — Number assignment rules (H3 + C1 Part 5)
- [L904–L914] DB function call pattern — DB function call pattern — DB function call pattern
- [L915–L919] Gap policy (H3 §9) — Gap policy (H3 §9) — Gap policy (H3 §9)
- [L920–L933] Atomic transaction pattern — Atomic transaction pattern — Atomic transaction pattern
- [L934–L952] TASK-DOCS-006 — Implement DOCS Published API (getDocumentById, getDocumentType, transitionState, assignFinalNumber, getAttachmentRefs)
- [L953–L963] Published API interface (B2 Module 3 -- implement exactly) — Published API interface (B2 Module 3 -- implement exactly) — Published API interface (B2 Module 3 -- implement exactly)
- [L964–L983] State machine (I1 §17 -- enforce in transitionState before any DB write) — State machine (I1 §17 -- enforce in transitionState before any DB write) — State machine (I1 §17 -- enforce in transitionState before any DB write)
- [L984–L998] Domain events (B2 Module 3 -- emit on success) — Domain events (B2 Module 3 -- emit on success) — Domain events (B2 Module 3 -- emit on success)
- [L999–L1005] Event consumers (B2 Module 3) — Event consumers (B2 Module 3) — Event consumers (B2 Module 3)
- [L1006–L1020] S3 presigned URLs (getAttachmentRefs) — S3 presigned URLs (getAttachmentRefs) — S3 presigned URLs (getAttachmentRefs)
- [L1021–L1037] TASK-DOCS-007 — Seed document_types — seven Phase 1 types + DESIGNATION record (inactive, Phase 1B)
- [L1038–L1074] Document type catalog (H2 Catalog Summary Table) — Document type catalog (H2 Catalog Summary Table) — Document type catalog (H2 Catalog Summary Table)
- [L1075–L1083] Retention schedule resolution — Retention schedule resolution — Retention schedule resolution
- [L1084–L1097] metadata_schema values — metadata_schema values — metadata_schema values
- [L1098–L1113] Idempotency pattern — Idempotency pattern — Idempotency pattern
- [L1114–L1131] TASK-DOCS-008 — Seed number_series — all 11 series records + 2026 year sequences for Phase 1 active series
- [L1132–L1138] Global field values (H3 -- identical across all 11 rows) — Global field values (H3 -- identical across all 11 rows) — Global field values (H3 -- identical across all 11 rows)
- [L1139–L1162] All 11 series (H3 Tables 1-3) — All 11 series (H3 Tables 1-3) — All 11 series (H3 Tables 1-3)
- [L1163–L1179] Phase 1 active series 2026 sequences (pre-create to avoid on-demand creation warning) — Phase 1 active series 2026 sequences (pre-create to avoid on-demand creation warning) — Phase 1 active series 2026 sequences (pre-create to avoid on-demand creation warning)
- [L1180–L1200] TASK-DOCS-009 — [ABAC] Implement DOCS ABAC policy guard rules (document, document_version, document_attachment, number_series resource types)
- [L1201–L1210] SubjectContext type (from IAM module) — SubjectContext type (from IAM module) — SubjectContext type (from IAM module)
- [L1211–L1220] Global cascade gates (I1 §2 -- run in every read/download method) — Global cascade gates (I1 §2 -- run in every read/download method) — Global cascade gates (I1 §2 -- run in every read/download method)
- [L1221–L1226] document:create (I1 §3.1) — document:create (I1 §3.1) — document:create (I1 §3.1)
- [L1227–L1236] document:read metadata (I1 §3.2) — document:read metadata (I1 §3.2) — document:read metadata (I1 §3.2)
- [L1237–L1241] document:update (I1 §3.3) — document:update (I1 §3.3) — document:update (I1 §3.3)
- [L1242–L1246] document:soft_delete (I1 §3.4) — document:soft_delete (I1 §3.4) — document:soft_delete (I1 §3.4)
- [L1247–L1252] document:submit (I1 §3.5) — document:submit (I1 §3.5) — document:submit (I1 §3.5)
- [L1253–L1259] document:cancel (I1 §3.6) — document:cancel (I1 §3.6) — document:cancel (I1 §3.6)
- [L1260–L1264] document:number_assign (I1 §3.7) — document:number_assign (I1 §3.7) — document:number_assign (I1 §3.7)
- [L1265–L1269] document:number_promote (I1 §3.8) — document:number_promote (I1 §3.8) — document:number_promote (I1 §3.8)
- [L1270–L1273] document:certify_urgent (I1 §3.9) — document:certify_urgent (I1 §3.9) — document:certify_urgent (I1 §3.9)
- [L1274–L1278] document:archive (I1 §3.10) — document:archive (I1 §3.10) — document:archive (I1 §3.10)
- [L1279–L1284] document:publish_portal (I1 §3.11) — document:publish_portal (I1 §3.11) — document:publish_portal (I1 §3.11)
- [L1285–L1289] document_version:read / document_attachment:read (I1 §4.1) — document_version:read / document_attachment:read (I1 §4.1) — document_version:read / document_attachment:read (I1 §4.1)
- [L1290–L1294] document_version:create (I1 §4.2) — document_version:create (I1 §4.2) — document_version:create (I1 §4.2)
- [L1295–L1297] number_series:read (I1 §14.1) — number_series:read (I1 §14.1) — number_series:read (I1 §14.1)
- [L1298–L1327] State-Action Compatibility Matrix (I1 §17) — State-Action Compatibility Matrix (I1 §17) — State-Action Compatibility Matrix (I1 §17)
- [L1328–L1350] TASK-DOCS-010 — Implement OCR service job wrapper (auto-enqueue on upload, quality score callback, manual re-OCR trigger)
- [L1351–L1369] OCR flow (confirmed Q-C01) — OCR flow (confirmed Q-C01) — OCR flow (confirmed Q-C01)
- [L1370–L1387] OcrProvider interface (library-agnostic stub) — OcrProvider interface (library-agnostic stub) — OcrProvider interface (library-agnostic stub)
- [L1388–L1401] Scan quality category thresholds (env-configurable) — Scan quality category thresholds (env-configurable) — Scan quality category thresholds (env-configurable)
- [L1402–L1410] pgboss job enqueueing — pgboss job enqueueing — pgboss job enqueueing
- [L1411–L1437] PreviewProvider interface (library-agnostic — same pattern as OcrProvider) — PreviewProvider interface (library-agnostic — same pattern as OcrProvider) — PreviewProvider interface (library-agnostic — same pattern as OcrProvider)
- [L1438–L1468] First-page preview generation (SPEC-GAP-TRACK-02 resolution — unconditional) — First-page preview generation (SPEC-GAP-TRACK-02 resolution — unconditional) — First-page preview generation (SPEC-GAP-TRACK-02 resolution — unconditional)
- [L1469–L1488] TASK-DOCS-011 — [ABAC][AUDIT] Implement documents tRPC router — general CRUD (eight procedures)
- [L1489–L1494] tRPC context — tRPC context — tRPC context
- [L1495–L1510] ABAC enforcement pattern (apply in every procedure) — ABAC enforcement pattern (apply in every procedure) — ABAC enforcement pattern (apply in every procedure)
- [L1511–L1523] documents.create (mutation) — documents.create (mutation) — documents.create (mutation)
- [L1524–L1529] documents.get (query) — documents.get (query) — documents.get (query)
- [L1530–L1534] documents.getMetadataForAdmin (query -- sys_admin ONLY) — documents.getMetadataForAdmin (query -- sys_admin ONLY) — documents.getMetadataForAdmin (query -- sys_admin ONLY)
- [L1535–L1539] documents.list (query) — documents.list (query) — documents.list (query)
- [L1540–L1545] documents.search (query) — documents.search (query) — documents.search (query)
- [L1546–L1550] documents.update (mutation) — documents.update (mutation) — documents.update (mutation)
- [L1551–L1555] documents.delete (mutation -- soft delete ONLY) — documents.delete (mutation -- soft delete ONLY) — documents.delete (mutation -- soft delete ONLY)
- [L1556–L1572] documents.cancel (mutation) — documents.cancel (mutation) — documents.cancel (mutation)
- [L1573–L1592] TASK-DOCS-012 — [ABAC][AUDIT] Implement documents tRPC router — SP workflow specifics and Secretariat decision delegation (eight procedures)
- [L1593–L1610] documents.submit (mutation) — documents.submit (mutation) — documents.submit (mutation)
- [L1611–L1617] documents.assignPreliminaryNumber (mutation) — documents.assignPreliminaryNumber (mutation) — documents.assignPreliminaryNumber (mutation)
- [L1618–L1625] documents.assignFinalNumber (mutation) — documents.assignFinalNumber (mutation) — documents.assignFinalNumber (mutation)
- [L1626–L1637] documents.logCertificationOfUrgency (mutation) — documents.logCertificationOfUrgency (mutation) — documents.logCertificationOfUrgency (mutation)
- [L1638–L1644] documents.publishToPortal / documents.unpublishFromPortal (mutations) — documents.publishToPortal / documents.unpublishFromPortal (mutations) — documents.publishToPortal / documents.unpublishFromPortal (mutations)
- [L1645–L1649] documents.archive (mutation) — documents.archive (mutation) — documents.archive (mutation)
- [L1650–L1669] documents.logSecretariatDecision (mutation) [ADR-B2-3 delegation] — documents.logSecretariatDecision (mutation) [ADR-B2-3 delegation] — documents.logSecretariatDecision (mutation) [ADR-B2-3 delegation]
- [L1670–L1688] TASK-DOCS-013 — [ABAC] Implement documents tRPC router — file, version, and attachment handling (nine procedures)
- [L1689–L1693] Architectural invariant -- files never touch app server disk (tech-stack.md) — Architectural invariant -- files never touch app server disk (tech-stack.md) — Architectural invariant -- files never touch app server disk (tech-stack.md)
- [L1694–L1702] documents.requestUploadUrl (mutation) — documents.requestUploadUrl (mutation) — documents.requestUploadUrl (mutation)
- [L1703–L1713] documents.confirmUpload (mutation) — documents.confirmUpload (mutation) — documents.confirmUpload (mutation)
- [L1714–L1718] documents.getVersionHistory (query) — documents.getVersionHistory (query) — documents.getVersionHistory (query)
- [L1719–L1725] documents.downloadVersion (mutation) — documents.downloadVersion (mutation) — documents.downloadVersion (mutation)
- [L1726–L1730] documents.getOcrText (query) — documents.getOcrText (query) — documents.getOcrText (query)
- [L1731–L1736] documents.getScanQualityIndicator (query) — documents.getScanQualityIndicator (query) — documents.getScanQualityIndicator (query)
- [L1737–L1742] documents.triggerManualReOcr (mutation) — documents.triggerManualReOcr (mutation) — documents.triggerManualReOcr (mutation)
- [L1743–L1747] documents.flagScannedBackForVerification (mutation) — documents.flagScannedBackForVerification (mutation) — documents.flagScannedBackForVerification (mutation)
- [L1748–L1762] documents.acceptScannedBackAsOfficial (mutation) — documents.acceptScannedBackAsOfficial (mutation) — documents.acceptScannedBackAsOfficial (mutation)
- [L1763–L1781] TASK-DOCS-014 — [AUDIT] Implement Panlalawigan review tRPC procedures (initiate transmittal, log outcome, deemed-approved timer)
- [L1782–L1789] Business context (consolidated reference Part 4.3 + H3) — Business context (consolidated reference Part 4.3 + H3) — Business context (consolidated reference Part 4.3 + H3)
- [L1790–L1803] documents.initiatePanlalawiganTransmittal (mutation) — documents.initiatePanlalawiganTransmittal (mutation) — documents.initiatePanlalawiganTransmittal (mutation)
- [L1804–L1816] documents.logPanlalawiganOutcome (mutation) — documents.logPanlalawiganOutcome (mutation) — documents.logPanlalawiganOutcome (mutation)
- [L1817–L1821] documents.getPanlalawiganReview (query) — documents.getPanlalawiganReview (query) — documents.getPanlalawiganReview (query)
- [L1822–L1855] panlalawigan.checkDeemedApproved (pgboss scheduled job) — panlalawigan.checkDeemedApproved (pgboss scheduled job) — panlalawigan.checkDeemedApproved (pgboss scheduled job)
- [L1856–L1872] TASK-DOCS-015 — Implement signature recording tRPC procedures (log signature, upload scan, scanned-back verification flow)
- [L1873–L1882] Business rules — Business rules — Business rules
- [L1883–L1888] Callable-by roles (I2 Section 9) — Callable-by roles (I2 Section 9) — Callable-by roles (I2 Section 9)
- [L1889–L1901] LogSignatureInputSchema (E3) — LogSignatureInputSchema (E3) — LogSignatureInputSchema (E3)
- [L1902–L1912] SignatureSelectSchema (E3) — SignatureSelectSchema (E3) — SignatureSelectSchema (E3)
- [L1913–L1927] documents.uploadSignatureImage (mutation) — documents.uploadSignatureImage (mutation) — documents.uploadSignatureImage (mutation)
- [L1928–L1946] TASK-DOCS-016 — [ABAC][AUDIT] Implement complaints tRPC router — internal SP Secretariat side (five procedures)
- [L1947–L1952] [CONFLICT] Phase 1 storage (C1 followed over E1 per A1-AGENTS.md §1) — [CONFLICT] Phase 1 storage (C1 followed over E1 per A1-AGENTS.md §1) — [CONFLICT] Phase 1 storage (C1 followed over E1 per A1-AGENTS.md §1)
- [L1953–L1963] CITIZEN_COMPLAINT metadata JSONB schema (H2 §5 -- enforce at procedure level) — CITIZEN_COMPLAINT metadata JSONB schema (H2 §5 -- enforce at procedure level) — CITIZEN_COMPLAINT metadata JSONB schema (H2 §5 -- enforce at procedure level)
- [L1964–L1975] complaints.createClerkAssisted (mutation) — complaints.createClerkAssisted (mutation) — complaints.createClerkAssisted (mutation)
- [L1976–L1981] complaints.logAndAssign (mutation) — complaints.logAndAssign (mutation) — complaints.logAndAssign (mutation)
- [L1982–L1987] complaints.enterCommitteeReport (mutation) — complaints.enterCommitteeReport (mutation) — complaints.enterCommitteeReport (mutation)
- [L1988–L1997] complaints.setOutcome (mutation) — complaints.setOutcome (mutation) — complaints.setOutcome (mutation)
- [L1998–L2013] complaints.listAll (query) — complaints.listAll (query) — complaints.listAll (query)
- [L2014–L2032] TASK-DOCS-017 — [ABAC][AUDIT] Implement document requests tRPC router — internal SP Secretariat side (six procedures)
- [L2033–L2038] [CONFLICT] Phase 1 storage (C1 followed over E1 per A1-AGENTS.md §1) — [CONFLICT] Phase 1 storage (C1 followed over E1 per A1-AGENTS.md §1) — [CONFLICT] Phase 1 storage (C1 followed over E1 per A1-AGENTS.md §1)
- [L2039–L2046] ADR-EVT-001 (June 2026) -- dual approval via Workflow steps (NOT JSONB flags) — ADR-EVT-001 (June 2026) -- dual approval via Workflow steps (NOT JSONB flags) — ADR-EVT-001 (June 2026) -- dual approval via Workflow steps (NOT JSONB flags)
- [L2047–L2055] DOCUMENT_REQUEST_FORM metadata JSONB schema (H2 §6) — DOCUMENT_REQUEST_FORM metadata JSONB schema (H2 §6) — DOCUMENT_REQUEST_FORM metadata JSONB schema (H2 §6)
- [L2056–L2065] documentRequests.createClerkAssisted (mutation) — documentRequests.createClerkAssisted (mutation) — documentRequests.createClerkAssisted (mutation)
- [L2066–L2071] documentRequests.generatePrintableForm (query) — documentRequests.generatePrintableForm (query) — documentRequests.generatePrintableForm (query)
- [L2072–L2080] documentRequests.approveAsPresidingOfficer (mutation) [Vice Mayor] — documentRequests.approveAsPresidingOfficer (mutation) [Vice Mayor] — documentRequests.approveAsPresidingOfficer (mutation) [Vice Mayor]
- [L2081–L2090] documentRequests.approveAsSecretary (mutation) — documentRequests.approveAsSecretary (mutation) — documentRequests.approveAsSecretary (mutation)
- [L2091–L2100] documentRequests.releaseCopy (mutation) — documentRequests.releaseCopy (mutation) — documentRequests.releaseCopy (mutation)
- [L2101–L2115] documentRequests.listAll (query) — documentRequests.listAll (query) — documentRequests.listAll (query)
- [L2116–L2135] TASK-DOCS-018 — [ABAC][AUDIT] Implement DESIGNATION document logging handler (atomic delegation grant creation on document log)
- [L2136–L2142] Business context (H2 §8 + ORG module Published API) — Business context (H2 §8 + ORG module Published API) — Business context (H2 §8 + ORG module Published API)
- [L2143–L2155] DESIGNATION metadata schema (DesignationMetadataSchema from TASK-DOCS-003) — DESIGNATION metadata schema (DesignationMetadataSchema from TASK-DOCS-003) — DESIGNATION metadata schema (DesignationMetadataSchema from TASK-DOCS-003)
- [L2156–L2169] Atomicity requirement (B2 Module 3 -- cross-module transaction boundary) — Atomicity requirement (B2 Module 3 -- cross-module transaction boundary) — Atomicity requirement (B2 Module 3 -- cross-module transaction boundary)
- [L2170–L2177] Integration point with documents.submit — Integration point with documents.submit — Integration point with documents.submit
- [L2178–L2189] Cancellation handling — Cancellation handling — Cancellation handling
- [L2190–L2218] ORG Published API method signatures (TASK-ORG-004 deliverable) — ORG Published API method signatures (TASK-ORG-004 deliverable) — ORG Published API method signatures (TASK-ORG-004 deliverable)
- [L2219–L2238] TASK-DOCS-019 — Wire DOCS Fastify plugin and inject Published API into dependent module stubs
- [L2239–L2285] Plugin structure — Plugin structure — Plugin structure
- [L2286–L2298] Registration order in app.ts — Registration order in app.ts — Registration order in app.ts
- [L2299–L2305] Event consumers registered in the plugin — Event consumers registered in the plugin — Event consumers registered in the plugin
- [L2306–L2320] tRPC router merging — tRPC router merging — tRPC router merging
- [L2321–L2434] Module Summary -- DOCS — Module Summary -- DOCS — Module Summary -- DOCS
  - [L2327–L2352] Coverage map
  - [L2353–L2366] Cross-module dependency map
  - [L2367–L2372] Unresolved INFRA dependencies
  - [L2373–L2383] Conflicts flagged (per A1-AGENTS.md §1)
  - [L2384–L2417] Spec gaps flagged (per A1-AGENTS.md §8)
  - [L2418–L2423] Known cross-document correction
  - [L2424–L2434] Downstream consumers of DOCS Published API

---

## TASK-DOCS-001

Phase:          1
Module:         DOCS
Title:          [MIGRATION] Create documents schema Drizzle definitions and DDL migration
Prerequisites:  [TASK-ORG-001, TASK-INFRA-005, TASK-INFRA-006]
Deliverables:
  - /packages/database/src/schema/documents.ts — Drizzle ORM table definitions for all ten documents.* tables (document_types, number_series, documents, numbers, versions, attachments, signatures, document_sponsorships, panlalawigan_reviews, classification_allowlists) using pgSchema('documents') and pgTable; all indexes, check constraints, unique indexes, and updated_at triggers represented; named exports re-exported from /packages/database/src/schema/index.ts.
  - /apps/server/src/database/migrations/{timestamp}_create_documents_schema.sql — SQL migration generated by `pnpm db:generate`, then manually extended with: (a) the three trigger functions (check_lifecycle_transition, check_number_immutability, FTS tsvector_update_trigger calls), (b) the fn_get_next_sequence_value SECURITY DEFINER function, (c) the GIN indexes on documents.metadata and specific expression indexes on metadata fields, (d) GRANT statements from C1 Part 12 for documents schema batac_app/batac_readonly/batac_it_admin, (e) the three RLS policies on documents.documents, and (f) the sequence GRANT for documents schema.
Acceptance Criteria:
  - [ ] `pnpm db:generate` produces a migration file that, when applied via `pnpm db:migrate`, creates all ten documents.* tables with zero errors on a database that already has iam and organization schemas applied
  - [ ] `SELECT table_name FROM information_schema.tables WHERE table_schema = 'documents' ORDER BY table_name` returns exactly: attachments, classification_allowlists, document_sponsorships, document_types, documents, number_series, numbers, panlalawigan_reviews, signatures, versions
  - [ ] `INSERT INTO documents.documents (..., lifecycle_state = 'draft'); UPDATE documents.documents SET lifecycle_state = 'disposed' WHERE ...` raises exception 'invalid document lifecycle transition: draft -> disposed'
  - [ ] `UPDATE documents.numbers SET number_value = 'Y' WHERE number_type = 'final'` raises exception 'final and control numbers are immutable once assigned'
  - [ ] `SELECT documents.fn_get_next_sequence_value('sp_resolution', 2026)` returns a row; calling on unknown series raises exception 'unknown or deleted number series'
  - [ ] `pnpm typecheck` passes at the workspace root
  - [ ] `pnpm db:migrate` is idempotent — running twice on the same database does not fail
AI Prompt: |
  You are implementing the Drizzle ORM schema for the `documents` PostgreSQL schema and
  generating the corresponding SQL migration for the Batac City LGU document-management
  platform.

  ## Project-wide DDL conventions (C1 Part 1)
  - Every table: `id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()`
  - Every table: `city_id UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid`
  - All temporal columns: TIMESTAMPTZ. Every mutable table: `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - The `updated_at` column is maintained by `public.fn_set_updated_at()` (already created by TASK-INFRA-006). Pattern per table: `CREATE TRIGGER trg_{tablename}_set_updated_at BEFORE UPDATE ON documents.{tablename} FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();`
  - Soft delete only: all tables carry `deleted_at TIMESTAMPTZ NULL` and `deleted_by UUID NULL`. No table may ever receive a SQL DELETE. DELETE is revoked at the PostgreSQL grant level by TASK-INFRA-006.
  - No FOREIGN KEY constraints across schema boundaries. Cross-schema references are plain UUID columns with comment: `-- logical FK -> <schema>.<table>.<column> (cross-schema)`
  - Drizzle: use `drizzle-orm/pg-core`, `pgSchema`, `pgTable`, `uuid`, `text`, `boolean`, `timestamp`, `smallint`, `integer`, `bigint`, `numeric`, `jsonb`, `tsvector`, `index`, `uniqueIndex` helpers. Schema file: `/packages/database/src/schema/documents.ts`.

  ## Table definitions (C1 Part 5, L741-L1233)

  ### documents.document_types
  ```sql
  CREATE TABLE documents.document_types (
      id                        UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id                   UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
      name                      TEXT        NOT NULL,
      code                      TEXT        NOT NULL,
      owning_module             TEXT        NOT NULL CHECK (owning_module IN ('workflow','organization','portal')),
      number_series_id          UUID        NULL,
      has_preliminary_numbering BOOLEAN     NOT NULL DEFAULT false,
      control_number_deferred   BOOLEAN     NOT NULL DEFAULT false,
      requires_publication      BOOLEAN     NOT NULL DEFAULT false,
      retention_schedule_id     UUID        NULL,  -- logical FK -> records.retention_schedules.id (cross-schema)
      classification_default    TEXT        NOT NULL CHECK (classification_default IN ('public','internal','confidential','restricted')),
      public_visibility_rule    TEXT        NOT NULL CHECK (public_visibility_rule IN
                                    ('title_and_first_page_public','not_public','complainant_restricted','requester_restricted')),
      required_step_types       TEXT[]      NULL,
      metadata_schema           JSONB       NULL,
      is_active                 BOOLEAN     NOT NULL DEFAULT false,
      created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at                TIMESTAMPTZ NULL,
      deleted_by                UUID        NULL,
      CONSTRAINT uq_document_types_city_code UNIQUE (city_id, code),
      CONSTRAINT ck_document_types_retention_before_activation
          CHECK (is_active = false OR retention_schedule_id IS NOT NULL)
  );
  CREATE TRIGGER trg_document_types_set_updated_at BEFORE UPDATE ON documents.document_types FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
  ```

  ### documents.number_series
  ```sql
  CREATE TABLE documents.number_series (
      id                           UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id                      UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
      series_key                   TEXT        NOT NULL,
      document_type_id             UUID        NULL REFERENCES documents.document_types(id),
      series_type                  TEXT        NOT NULL CHECK (series_type IN ('legislative','administrative')),
      phase                        TEXT        NOT NULL DEFAULT '1' CHECK (phase IN ('1','1b')),
      prefix                       TEXT        NULL,
      sp_ordinal                   TEXT        NULL,
      delimiter                    TEXT        NOT NULL DEFAULT ' ',
      sequence_padding             SMALLINT    NOT NULL,
      sequence_name_prefix         TEXT        NOT NULL,
      year_format                  TEXT        NOT NULL DEFAULT 'YYYY',
      preliminary_format           TEXT        NULL,
      final_format                 TEXT        NOT NULL,
      resets_annually              BOOLEAN     NOT NULL DEFAULT true,
      authority_office_id          UUID        NOT NULL,  -- logical FK -> organization.offices.id (cross-schema)
      preliminary_assignment_event TEXT        NULL,
      final_assignment_event       TEXT        NOT NULL,
      deferred_final_assignment    BOOLEAN     NOT NULL DEFAULT false,
      is_active                    BOOLEAN     NOT NULL DEFAULT true,
      created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at                   TIMESTAMPTZ NULL,
      deleted_by                   UUID        NULL,
      CONSTRAINT uq_number_series_city_key UNIQUE (city_id, series_key)
  );
  CREATE TRIGGER trg_number_series_set_updated_at BEFORE UPDATE ON documents.number_series FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
  -- Break circular DDL dependency after both tables exist:
  ALTER TABLE documents.document_types ADD CONSTRAINT fk_document_types_number_series
      FOREIGN KEY (number_series_id) REFERENCES documents.number_series(id);
  ```

  ### documents.documents
  ```sql
  CREATE TABLE documents.documents (
      id                     UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id                UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
      document_type_id       UUID        NOT NULL REFERENCES documents.document_types(id),
      title                  TEXT        NOT NULL,
      lifecycle_state        TEXT        NOT NULL DEFAULT 'draft' CHECK (lifecycle_state IN (
                                 'draft','submitted','in_workflow','pending_mayor_action',
                                 'pending_panlalawigan_review','completed','released',
                                 'archived','disposed','cancelled','superseded'
                             )),
      classification_level   TEXT        NOT NULL CHECK (classification_level IN ('public','internal','confidential','restricted')),
      qr_tracking_number     UUID        NOT NULL,
      preliminary_number     TEXT        NULL,
      final_number           TEXT        NULL,
      control_number         TEXT        NULL,
      number_series_id       UUID        NULL REFERENCES documents.number_series(id),
      originating_office_id  UUID        NOT NULL,  -- logical FK -> organization.offices.id (cross-schema)
      owned_by_office_id     UUID        NOT NULL,  -- logical FK -> organization.offices.id (cross-schema)
      drafted_by_employee_id UUID        NULL,      -- logical FK -> organization.employees.id (cross-schema)
      created_by             UUID        NOT NULL,  -- logical FK -> iam.users.id (cross-schema)
      workflow_instance_id   UUID        NULL,      -- logical FK -> workflow.instances.id (cross-schema)
      retention_schedule_id  UUID        NOT NULL,  -- logical FK -> records.retention_schedules.id (cross-schema)
      version_number         INTEGER     NOT NULL DEFAULT 1,
      metadata               JSONB       NULL DEFAULT '{}'::jsonb,
      tsv                    tsvector    NULL,
      superseded_by          UUID        NULL REFERENCES documents.documents(id),
      superseded_at          TIMESTAMPTZ NULL,
      closure_reason         TEXT        NULL,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at             TIMESTAMPTZ NULL,
      deleted_by             UUID        NULL,
      CONSTRAINT uq_documents_qr_tracking_number UNIQUE (qr_tracking_number)
  );
  CREATE TRIGGER trg_documents_set_updated_at BEFORE UPDATE ON documents.documents FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
  CREATE INDEX idx_documents_type               ON documents.documents(document_type_id);
  CREATE INDEX idx_documents_lifecycle_state    ON documents.documents(lifecycle_state);
  CREATE INDEX idx_documents_originating_office ON documents.documents(originating_office_id);
  CREATE INDEX idx_documents_owned_by_office    ON documents.documents(owned_by_office_id);
  CREATE INDEX idx_documents_workflow_instance  ON documents.documents(workflow_instance_id);
  CREATE INDEX idx_documents_metadata_gin          ON documents.documents USING GIN (metadata);
  CREATE INDEX idx_documents_metadata_certified_urgent ON documents.documents ((metadata->>'certified_urgent'));
  CREATE INDEX idx_documents_metadata_has_penalty     ON documents.documents ((metadata->>'has_penalty_provision'));
  CREATE INDEX idx_documents_metadata_outcome_state   ON documents.documents ((metadata->>'outcome_state'));
  CREATE TRIGGER trg_documents_tsv_update
      BEFORE INSERT OR UPDATE OF title ON documents.documents
      FOR EACH ROW EXECUTE FUNCTION tsvector_update_trigger(tsv, 'pg_catalog.english', title);
  ```

  ### Lifecycle transition trigger (add manually to migration after db:generate)
  ```sql
  CREATE OR REPLACE FUNCTION documents.check_lifecycle_transition()
  RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
  DECLARE v_allowed BOOLEAN := false;
  BEGIN
      IF NEW.lifecycle_state IS DISTINCT FROM OLD.lifecycle_state THEN
          v_allowed := CASE OLD.lifecycle_state
              WHEN 'draft'                       THEN NEW.lifecycle_state IN ('submitted','cancelled')
              WHEN 'submitted'                   THEN NEW.lifecycle_state IN ('in_workflow','cancelled')
              WHEN 'in_workflow'                 THEN NEW.lifecycle_state IN ('pending_mayor_action','pending_panlalawigan_review','completed','cancelled')
              WHEN 'pending_mayor_action'        THEN NEW.lifecycle_state IN ('in_workflow','completed','cancelled')
              WHEN 'pending_panlalawigan_review' THEN NEW.lifecycle_state IN ('completed','superseded','cancelled')
              WHEN 'completed'                   THEN NEW.lifecycle_state IN ('released','cancelled')
              WHEN 'released'                    THEN NEW.lifecycle_state IN ('archived','cancelled')
              WHEN 'archived'                    THEN NEW.lifecycle_state IN ('disposed')
              WHEN 'disposed'    THEN false  WHEN 'cancelled'  THEN false  WHEN 'superseded' THEN false
              ELSE false
          END;
          IF NOT v_allowed THEN
              RAISE EXCEPTION 'invalid document lifecycle transition: % -> %', OLD.lifecycle_state, NEW.lifecycle_state;
          END IF;
      END IF;
      RETURN NEW;
  END;
  $fn$;
  CREATE TRIGGER trg_documents_lifecycle_transition
      BEFORE UPDATE ON documents.documents FOR EACH ROW EXECUTE FUNCTION documents.check_lifecycle_transition();
  ```

  ### documents.numbers
  ```sql
  CREATE TABLE documents.numbers (
      id               UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id          UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
      document_id      UUID        NOT NULL REFERENCES documents.documents(id),
      number_series_id UUID        NOT NULL REFERENCES documents.number_series(id),
      number_type      TEXT        NOT NULL CHECK (number_type IN ('preliminary','final','control')),
      number_value     TEXT        NOT NULL,
      sequence_year    SMALLINT    NOT NULL,
      sequence_number  INTEGER     NOT NULL,
      is_current       BOOLEAN     NOT NULL DEFAULT true,
      assigned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      assigned_by      UUID        NOT NULL,  -- logical FK -> iam.users.id (cross-schema)
      superseded_at    TIMESTAMPTZ NULL,
      cancellation_reason TEXT     NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at       TIMESTAMPTZ NULL,
      deleted_by       UUID        NULL,
      CONSTRAINT uq_numbers_series_year_seq UNIQUE (number_series_id, sequence_year, sequence_number)
  );
  CREATE UNIQUE INDEX uq_numbers_one_current_per_type ON documents.numbers(document_id, number_type)
      WHERE is_current = true AND deleted_at IS NULL;
  CREATE INDEX idx_numbers_document ON documents.numbers(document_id);
  -- Number immutability trigger (add manually):
  CREATE OR REPLACE FUNCTION documents.check_number_immutability()
  RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
  BEGIN
      IF OLD.number_type IN ('final','control') AND OLD.number_value IS DISTINCT FROM NEW.number_value THEN
          RAISE EXCEPTION 'final and control numbers are immutable once assigned: % %', OLD.number_type, OLD.number_value;
      END IF;
      RETURN NEW;
  END;
  $fn$;
  CREATE TRIGGER trg_numbers_immutability BEFORE UPDATE ON documents.numbers FOR EACH ROW EXECUTE FUNCTION documents.check_number_immutability();
  ```

  ### documents.versions
  ```sql
  CREATE TABLE documents.versions (
      id                           UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id                      UUID         NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
      document_id                  UUID         NOT NULL REFERENCES documents.documents(id),
      version_number               INTEGER      NOT NULL,
      file_key                     UUID         NOT NULL,  -- UUID storage key; NEVER original filename (Invariant #5)
      original_filename            TEXT         NULL,
      mime_type                    TEXT         NOT NULL,
      file_size_bytes              BIGINT       NULL,
      page_count                   INTEGER      NULL,
      scan_quality_score           NUMERIC(4,3) NULL,
      scan_quality_category        TEXT         NULL CHECK (scan_quality_category IN ('good','fair','poor')),
      ocr_processed                BOOLEAN      NOT NULL DEFAULT false,
      ocr_text                     TEXT         NULL,
      tsv                          tsvector     NULL,
      requires_manual_verification BOOLEAN      NOT NULL DEFAULT false,
      verified_by                  UUID         NULL,  -- logical FK -> iam.users.id (cross-schema)
      verified_at                  TIMESTAMPTZ  NULL,
      created_by                   UUID         NOT NULL,  -- logical FK -> iam.users.id (cross-schema)
      created_at                   TIMESTAMPTZ  NOT NULL DEFAULT now(),
      deleted_at                   TIMESTAMPTZ  NULL,
      deleted_by                   UUID         NULL,
      CONSTRAINT uq_versions_document_number UNIQUE (document_id, version_number),
      CONSTRAINT ck_versions_scan_quality_range CHECK (scan_quality_score IS NULL OR (scan_quality_score >= 0 AND scan_quality_score <= 1))
  );
  CREATE INDEX idx_versions_document ON documents.versions(document_id);
  CREATE TRIGGER trg_versions_tsv_update
      BEFORE INSERT OR UPDATE OF ocr_text ON documents.versions
      FOR EACH ROW EXECUTE FUNCTION tsvector_update_trigger(tsv, 'pg_catalog.english', ocr_text);
  ```

  ### documents.attachments
  ```sql
  CREATE TABLE documents.attachments (
      id                 UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id            UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
      document_id        UUID        NOT NULL REFERENCES documents.documents(id),
      attachment_type    TEXT        NOT NULL CHECK (attachment_type IN ('certification_of_urgency','committee_report','transmittal_letter','scan','other')),
      file_key           UUID        NULL,
      source_document_id UUID        NULL REFERENCES documents.documents(id),
      mime_type          TEXT        NULL,
      file_size_bytes    BIGINT      NULL,
      description        TEXT        NULL,
      uploaded_by        UUID        NOT NULL,  -- logical FK -> iam.users.id (cross-schema)
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at         TIMESTAMPTZ NULL,
      deleted_by         UUID        NULL,
      CONSTRAINT ck_attachments_file_or_source CHECK (file_key IS NOT NULL OR source_document_id IS NOT NULL)
  );
  CREATE INDEX idx_attachments_document        ON documents.attachments(document_id);
  CREATE INDEX idx_attachments_source_document ON documents.attachments(source_document_id);
  ```

  ### documents.signatures
  ```sql
  CREATE TABLE documents.signatures (
      id                     UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id                UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
      document_id            UUID        NOT NULL REFERENCES documents.documents(id),
      signature_type         TEXT        NOT NULL CHECK (signature_type IN ('presiding_officer','mayor','sp_secretary','vice_mayor','committee_chair')),
      signed_by_employee_id  UUID        NOT NULL,  -- logical FK -> organization.employees.id (cross-schema)
      signed_by_display_name TEXT        NULL,
      signed_at              TIMESTAMPTZ NOT NULL,
      is_wet_ink             BOOLEAN     NOT NULL DEFAULT false,
      signature_image_s3_key TEXT        NULL,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at             TIMESTAMPTZ NULL,
      deleted_by             UUID        NULL
  );
  CREATE INDEX idx_signatures_document ON documents.signatures(document_id);
  ```

  ### documents.document_sponsorships
  ```sql
  CREATE TABLE documents.document_sponsorships (
      id                  UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id             UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
      document_id         UUID        NOT NULL REFERENCES documents.documents(id),
      sponsor_employee_id UUID        NOT NULL,  -- logical FK -> organization.employees.id (cross-schema)
      sponsorship_type    TEXT        NOT NULL CHECK (sponsorship_type IN ('principal_author','co_author','introducer','co_introducer')),
      order_of_priority   INTEGER     NOT NULL DEFAULT 1,
      display_name        TEXT        NOT NULL,  -- denormalized at assignment time (Implementation Note 5)
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at          TIMESTAMPTZ NULL,
      deleted_by          UUID        NULL,
      CONSTRAINT uq_sponsorships UNIQUE (document_id, sponsor_employee_id, sponsorship_type)
  );
  CREATE INDEX idx_sponsorships_document ON documents.document_sponsorships(document_id);
  ```

  ### documents.panlalawigan_reviews
  ```sql
  CREATE TABLE documents.panlalawigan_reviews (
      id                 UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id            UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
      document_id        UUID        NOT NULL REFERENCES documents.documents(id),
      number_series_id   UUID        NULL REFERENCES documents.number_series(id),
      control_no         TEXT        NULL,
      subject            TEXT        NULL,
      transmitted_at     TIMESTAMPTZ NULL,
      received_at        TIMESTAMPTZ NULL,
      action_deadline    TIMESTAMPTZ NULL,
      response_date      TIMESTAMPTZ NULL,
      outcome            TEXT        NULL CHECK (outcome IN ('valid','valid_in_part','returned','operative_in_its_entirety','deemed_approved')),
      resolution_number  TEXT        NULL,
      remarks            TEXT        NULL,
      days_elapsed       INTEGER     NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at         TIMESTAMPTZ NULL,
      deleted_by         UUID        NULL,
      CONSTRAINT uq_panlalawigan_reviews_document UNIQUE (document_id)
  );
  CREATE TRIGGER trg_panlalawigan_reviews_set_updated_at BEFORE UPDATE ON documents.panlalawigan_reviews FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
  CREATE INDEX idx_panlalawigan_reviews_document ON documents.panlalawigan_reviews(document_id);
  ```

  ### documents.classification_allowlists (resolved I1 D-ABAC-02)
  ```sql
  -- Supports I1 Gate 4: one row per (document_type_id, role_code) grants that role
  -- read/download access to Confidential/Restricted documents of that type.
  CREATE TABLE documents.classification_allowlists (
      id               UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id          UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
      document_type_id UUID        NOT NULL REFERENCES documents.document_types(id),
      role_code        TEXT        NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by       UUID        NOT NULL,  -- logical FK -> iam.users.id (cross-schema)
      deleted_at       TIMESTAMPTZ NULL,
      deleted_by       UUID        NULL,
      CONSTRAINT uq_classification_allowlists_type_role UNIQUE (document_type_id, role_code, city_id)
  );
  CREATE INDEX idx_classification_allowlists_type ON documents.classification_allowlists(document_type_id);
  ```

  ### fn_get_next_sequence_value (add manually to migration)
  ```sql
  CREATE OR REPLACE FUNCTION documents.fn_get_next_sequence_value(p_series_key TEXT, p_year INTEGER)
  RETURNS TABLE (sequence_value BIGINT, was_created BOOLEAN)
  LANGUAGE plpgsql SECURITY DEFINER AS $fn$
  DECLARE
      v_prefix   TEXT;  v_seq_name TEXT;  v_next BIGINT;  v_created BOOLEAN := false;
  BEGIN
      SELECT sequence_name_prefix INTO v_prefix FROM documents.number_series
      WHERE series_key = p_series_key AND deleted_at IS NULL;
      IF v_prefix IS NULL THEN
          RAISE EXCEPTION 'unknown or deleted number series: %', p_series_key;
      END IF;
      v_seq_name := 'documents.' || v_prefix || '_' || p_year::text || '_seq';
      BEGIN
          EXECUTE format('SELECT nextval(%L)', v_seq_name) INTO v_next;
      EXCEPTION WHEN undefined_table THEN
          EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %s AS INTEGER INCREMENT 1 START 1', v_seq_name);
          EXECUTE format('SELECT nextval(%L)', v_seq_name) INTO v_next;
          v_created := true;
      END;
      RETURN QUERY SELECT v_next, v_created;
  END;
  $fn$;
  REVOKE ALL ON FUNCTION documents.fn_get_next_sequence_value(TEXT, INTEGER) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION documents.fn_get_next_sequence_value(TEXT, INTEGER) TO batac_app;
  ALTER FUNCTION documents.fn_get_next_sequence_value(TEXT, INTEGER) OWNER TO batac_migrate;
  ```

  ### Grants and RLS (C1 Part 12 -- add to end of migration manually)
  ```sql
  GRANT USAGE ON SCHEMA documents TO batac_app, batac_readonly, batac_it_admin;
  GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA documents TO batac_app;
  GRANT SELECT ON ALL TABLES IN SCHEMA documents TO batac_readonly;
  GRANT SELECT, UPDATE ON documents.documents TO batac_it_admin;
  REVOKE ALL ON documents.versions    FROM batac_it_admin;   -- Invariant #10: IT Admin no content
  REVOKE ALL ON documents.attachments FROM batac_it_admin;   -- Invariant #10
  GRANT USAGE ON ALL SEQUENCES IN SCHEMA documents TO batac_app;

  ALTER TABLE documents.documents ENABLE ROW LEVEL SECURITY;
  CREATE POLICY documents_office_isolation ON documents.documents
      FOR SELECT TO batac_app
      USING (owned_by_office_id = current_setting('app.current_office_id', true)::uuid
             OR current_setting('app.bypass_office_isolation', true) = 'true');
  CREATE POLICY documents_it_admin_no_confidential ON documents.documents
      FOR SELECT TO batac_it_admin
      USING (classification_level NOT IN ('confidential','restricted'));
  CREATE POLICY documents_it_admin_metadata_only_update ON documents.documents
      FOR UPDATE TO batac_it_admin USING (true) WITH CHECK (false);
  ```

  Before submitting this PR, confirm each item:
  - [ ] `pnpm db:generate` produces a migration file that, when applied via `pnpm db:migrate`, creates all ten documents.* tables with zero errors on a database that already has iam and organization schemas applied
  - [ ] `SELECT table_name FROM information_schema.tables WHERE table_schema = 'documents' ORDER BY table_name` returns exactly: attachments, classification_allowlists, document_sponsorships, document_types, documents, number_series, numbers, panlalawigan_reviews, signatures, versions
  - [ ] `INSERT INTO documents.documents (..., lifecycle_state = 'draft'); UPDATE documents.documents SET lifecycle_state = 'disposed' WHERE ...` raises exception 'invalid document lifecycle transition: draft -> disposed'
  - [ ] `UPDATE documents.numbers SET number_value = 'Y' WHERE number_type = 'final'` raises exception 'final and control numbers are immutable once assigned'
  - [ ] `SELECT documents.fn_get_next_sequence_value('sp_resolution', 2026)` returns a row; calling on unknown series raises exception 'unknown or deleted number series'
  - [ ] `pnpm typecheck` passes at the workspace root
  - [ ] `pnpm db:migrate` is idempotent -- running twice on the same database does not fail

---

## TASK-DOCS-002

Phase:          1
Module:         DOCS
Title:          Scaffold DOCS module file structure with typed stubs
Prerequisites:  [TASK-DOCS-001]
Deliverables:
  - /apps/server/src/modules/documents/index.ts — barrel export; re-exports createDocumentsModule factory and DocumentsPublicAPI type
  - /apps/server/src/modules/documents/documents.types.ts — TypeScript type aliases for DocumentLifecycleState, ClassificationLevel, DocumentSummary, DocumentTypeSummary, DocumentNumberResult, AttachmentRef; the DocumentsPublicAPI interface (five methods from B2 Module 3); all methods throw `new Error('not implemented')` at runtime in the stub
  - /apps/server/src/modules/documents/documents.repository.ts — class stub DocumentsRepository with typed method signatures for all Phase 1 queries/mutations; no implementation yet
  - /apps/server/src/modules/documents/documents.service.ts — stub createDocumentsService factory returning DocumentsPublicAPI with all five methods throwing 'not implemented'
  - /apps/server/src/modules/documents/documents.router.ts — stub createDocumentsRouter factory returning an empty tRPC router object
  - /apps/server/src/modules/documents/documents.plugin.ts — stub Fastify plugin registering the module; augments FastifyInstance with documentsService and documentsTrpcRouter
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes with zero errors; no `any` types in stub files
  - [ ] `pnpm build` succeeds at the workspace root
  - [ ] Every stub method has a JSDoc comment referencing the B2 Module 3 Published API or E1 Module 3 procedure name it will implement
AI Prompt: |
  You are scaffolding the file structure for the DOCS module of the Batac City LGU
  document-management platform. Create typed stubs only — no business logic.

  ## Module location
  `/apps/server/src/modules/documents/`

  ## Published API interface (B2 Module 3 -- paste verbatim into documents.types.ts)
  ```typescript
  interface DocumentsPublicAPI {
    /** B2 Module 3 -- called by Workflow, Records, Tracking */
    getDocumentById(documentId: string): Promise<DocumentSummary | null>;
    /** B2 Module 3 -- called by Workflow to retrieve workflow template ref */
    getDocumentType(documentTypeId: string): Promise<DocumentTypeSummary | null>;
    /** B2 Module 3 -- called by Workflow at step completion; emits document.state_changed */
    transitionState(documentId: string, toState: DocumentLifecycleState, actorId: string, reason?: string): Promise<void>;
    /** B2 Module 3 -- called by Workflow at correct lifecycle event */
    assignFinalNumber(documentId: string, actorId: string): Promise<DocumentNumberResult>;
    /** B2 Module 3 -- called by Records for archiving; Search Meta for OCR (Phase 2) */
    getAttachmentRefs(documentId: string, actorId: string): Promise<AttachmentRef[]>;
  }

  type DocumentLifecycleState =
    | 'draft' | 'submitted' | 'in_workflow'
    | 'pending_mayor_action' | 'pending_panlalawigan_review'
    | 'completed' | 'released' | 'archived' | 'disposed'
    | 'cancelled' | 'superseded';
  ```

  ## Pattern to follow
  Mirror the structure of `/apps/server/src/modules/organization/` (created by TASK-ORG-002).
  Use the same Fastify plugin pattern and TypeScript module augmentation:
  ```typescript
  declare module 'fastify' {
    interface FastifyInstance {
      documentsService: ReturnType<typeof import('./documents.service').createDocumentsService>;
      documentsTrpcRouter: ReturnType<typeof import('./documents.router').createDocumentsRouter>;
    }
  }
  ```

  Before submitting this PR, confirm each item:
  - [ ] `pnpm typecheck` passes with zero errors; no `any` types in stub files
  - [ ] `pnpm build` succeeds at the workspace root
  - [ ] Every stub method has a JSDoc comment referencing the B2 Module 3 Published API or E1 Module 3 procedure name it will implement

---

## TASK-DOCS-003

Phase:          1
Module:         DOCS
Title:          Implement shared Zod schemas -- documents and document-metadata domains (E3 Parts 4-5)
Prerequisites:  [TASK-ORG-002]
Deliverables:
  - /packages/shared/src/schemas/documents.ts — all enum schemas (LifecycleStateSchema, ClassificationLevelSchema, PublicVisibilityRuleSchema, NumberTypeSchema, AttachmentTypeSchema, SignatureTypeSchema, PanlalawiganOutcomeSchema, ScanQualityCategorySchema) plus all entity schemas from E3 Part 4 (DocumentTypeSummarySchema, DocumentTypeSelectSchema, DocumentSelectSchema, DocumentSummarySchema, LogDocumentInputSchema, DocumentFilterSchema, CancelDocumentInputSchema, VersionSelectSchema, UploadNewVersionInputSchema, AttachmentSelectSchema, UploadAttachmentInputSchema, DocumentNumberSelectSchema, AssignFinalNumberInputSchema, SignatureSelectSchema, LogSignatureInputSchema, PanlalawiganReviewSelectSchema, InitiatePanlalawiganTransmittalInputSchema, LogPanlalawiganOutcomeInputSchema); all re-exported from /packages/shared/src/index.ts
  - /packages/shared/src/schemas/document-metadata.ts — all shared sub-schemas (SponsorSchema, ReadingRecordSchema, MayorActionSchema, VetoOverrideSchema, PublicationInfoSchema, NewspaperPublicationSchema) plus all 13 per-type metadata schemas (SpResolutionMetadataSchema, SpOrdinanceMetadataSchema, AppropriationOrdinanceMetadataSchema, CertificationOfUrgencyMetadataSchema, CitizenComplaintMetadataSchema, DocumentRequestFormMetadataSchema, LetterReceivedMetadataSchema, LetterSentMetadataSchema, MemoOutgoingMetadataSchema, MemoIncomingMetadataSchema, NoticeOfCommitteeHearingMetadataSchema, NoticeOfSpecialSessionMetadataSchema, DesignationMetadataSchema) plus DocumentMetadataSchema discriminated union; all re-exported from /packages/shared/src/index.ts
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes at workspace root
  - [ ] `SpResolutionMetadataSchema.parse({ sponsors: [{ employeeId: '<uuid>', displayName: 'X' }] })` succeeds; `.parse({ certificationOfUrgencyDocumentId: '<uuid>', committeeReferralIds: ['<uuid>'] })` fails with 'A certified urgent measure cannot also have committee referrals'
  - [ ] `LogPanlalawiganOutcomeInputSchema.parse({ documentId: '<uuid>', outcome: 'valid_in_part', receivedAt: new Date(), remarks: 'short' })` fails; with `remarks: 'ten or more chars'` succeeds
  - [ ] `DesignationMetadataSchema.parse({ delegatingAuthorityEmployeeId: 'X', designatedPersonEmployeeId: 'X', ... })` fails with 'must differ'
  - [ ] `DocumentMetadataSchema.parse({ __type: 'SP_RESOLUTION', sponsors: [...] })` correctly discriminates to SpResolutionMetadata
AI Prompt: |
  You are implementing the shared Zod schemas for the DOCS module. These live in
  `packages/shared/` and are consumed by both server and web client.

  ## Files
  - `packages/shared/src/schemas/documents.ts` (E3 Part 4)
  - `packages/shared/src/schemas/document-metadata.ts` (E3 Part 5)

  ## Key enum schemas (documents.ts)
  ```typescript
  export const LifecycleStateSchema = z.enum([
    "draft","under_review","pending_mayor_action","pending_panlalawigan_review",
    "approved","released","superseded","cancelled","rejected",
  ]);
  export const ClassificationLevelSchema = z.enum(["public","internal","confidential","restricted"]);
  export const PanlalawiganOutcomeSchema = z.enum([
    "valid","valid_in_part","returned","operative_in_its_entirety","deemed_approved",
  ]);
  export const ScanQualityCategorySchema = z.enum(["good","fair","poor"]);
  ```

  ## LogPanlalawiganOutcomeInputSchema (with refine -- implement exactly)
  ```typescript
  export const LogPanlalawiganOutcomeInputSchema = z.object({
    documentId: UuidSchema, outcome: PanlalawiganOutcomeSchema,
    panlalawiganResolutionNumber: z.string().max(64).optional(),
    receivedAt: TimestampSchema, dateReferred: TimestampSchema.optional(),
    remarks: z.string().max(2048).optional(),
  })
  .refine((v) => v.outcome !== "valid_in_part" || (v.remarks && v.remarks.length >= 10),
    { message: "Remarks required for VALID-IN-PART (min 10 chars)", path: ["remarks"] })
  .refine((v) => v.outcome !== "returned" || (v.remarks && v.remarks.length >= 10),
    { message: "Remarks required for RETURNED (min 10 chars)", path: ["remarks"] });
  ```

  ## SpResolutionMetadataSchema (with refine)
  ```typescript
  export const SpResolutionMetadataSchema = z.object({
    sponsors: z.array(SponsorSchema).min(1, "At least one sponsor required"),
    firstReading: ReadingRecordSchema.optional(),
    certificationOfUrgencyDocumentId: UuidSchema.optional(),
    committeeReferralIds: z.array(UuidSchema).optional(),
    secondReading: ReadingRecordSchema.optional(),
    amendmentNotes: z.string().max(4096).optional(),
    mayorAction: MayorActionSchema.optional(), vetoOverride: VetoOverrideSchema.optional(),
    transmittalLetterDocumentId: UuidSchema.optional(), publication: PublicationInfoSchema.optional(),
  }).refine(
    (v) => !(v.certificationOfUrgencyDocumentId && v.committeeReferralIds?.length),
    { message: "A certified urgent measure cannot also have committee referrals" }
  );
  ```

  ## DesignationMetadataSchema (with refines)
  ```typescript
  export const DesignationMetadataSchema = z.object({
    delegatingAuthorityEmployeeId: UuidSchema, delegatingAuthorityDisplayName: z.string(),
    designatedPersonEmployeeId: UuidSchema, designatedPersonDisplayName: z.string(),
    designatedOfficeId: UuidSchema, designatedPositionId: UuidSchema,
    scopeDescription: z.string().min(1).max(1024).trim(),
    legalBasis: z.string().max(512).optional(),
    effectiveFrom: DateSchema, effectiveUntil: DateSchema,
    delegationGrantId: UuidSchema.optional(),
  })
  .refine((v) => v.delegatingAuthorityEmployeeId !== v.designatedPersonEmployeeId,
    { message: "Delegating authority and designated person must differ", path: ["designatedPersonEmployeeId"] })
  .refine((v) => v.effectiveUntil >= v.effectiveFrom,
    { message: "effectiveUntil must not be before effectiveFrom", path: ["effectiveUntil"] });
  ```

  ## CitizenComplaintMetadataSchema (implement from H2 §5 spec)
  Fields (all camelCase in TypeScript): complainant (object: name required, address/contactNumber/
  email/citizenUserId nullable), subjectCategory (string), violationType (string nullable),
  incidentDetails (object: date/time/place/narrative all nullable), respondent (object nullable:
  name/tricycleNumber/contactNumber/email/notificationChannel), accessMode (enum:
  downloaded_form/digital_form_printed/in_person_clerk), routingDecision (string nullable),
  outcomeState (enum: pending_hearing/received_seen/dismissed/resolved, default pending_hearing).

  ## DocumentRequestFormMetadataSchema (implement from H2 §6 spec)
  Fields: requester (object: name required, agencyOrOrganization/email/contactNumber/idTypePresented/
  citizenUserId nullable), documentsRequested (array min 1: documentTitle required, documentId/
  documentTypeLabel/documentNumber/numberOfPages nullable), purpose (string nullable), accessMode
  (same enum), payment (object nullable: orNumber/collectingOfficer/amountPaid/paymentDate all
  nullable), notificationChannel (enum: contact_number/email, nullable).

  ## DocumentMetadataSchema discriminated union
  ```typescript
  export const DocumentMetadataSchema = z.discriminatedUnion("__type", [
    SpResolutionMetadataSchema.extend({ __type: z.literal("SP_RESOLUTION") }),
    SpOrdinanceMetadataSchema.extend({ __type: z.literal("SP_ORDINANCE") }),
    AppropriationOrdinanceMetadataSchema.extend({ __type: z.literal("APPROPRIATION_ORDINANCE") }),
    CertificationOfUrgencyMetadataSchema.extend({ __type: z.literal("CERTIFICATION_OF_URGENCY") }),
    CitizenComplaintMetadataSchema.extend({ __type: z.literal("CITIZEN_COMPLAINT") }),
    DocumentRequestFormMetadataSchema.extend({ __type: z.literal("DOCUMENT_REQUEST_FORM") }),
    LetterReceivedMetadataSchema.extend({ __type: z.literal("LETTER_RECEIVED") }),
    LetterSentMetadataSchema.extend({ __type: z.literal("LETTER_SENT") }),
    MemoOutgoingMetadataSchema.extend({ __type: z.literal("MEMO_OUTGOING") }),
    MemoIncomingMetadataSchema.extend({ __type: z.literal("MEMO_INCOMING") }),
    NoticeOfCommitteeHearingMetadataSchema.extend({ __type: z.literal("NOTICE_OF_COMMITTEE_HEARING") }),
    NoticeOfSpecialSessionMetadataSchema.extend({ __type: z.literal("NOTICE_OF_SPECIAL_SESSION") }),
    DesignationMetadataSchema.extend({ __type: z.literal("DESIGNATION") }),
  ]);
  ```

  Use `UuidSchema`, `TimestampSchema`, `DateSchema`, `OfficeSummarySchema` from their existing
  locations in `packages/shared/src/schemas/`. OfficeSummarySchema is in organization.ts
  (TASK-ORG-002 deliverable). Implement ALL schemas listed in the Deliverables section.

  Before submitting this PR, confirm each item:
  - [ ] `pnpm typecheck` passes at workspace root
  - [ ] `SpResolutionMetadataSchema.parse({ sponsors: [{ employeeId: '<uuid>', displayName: 'X' }] })` succeeds; `.parse({ certificationOfUrgencyDocumentId: '<uuid>', committeeReferralIds: ['<uuid>'] })` fails with 'A certified urgent measure cannot also have committee referrals'
  - [ ] `LogPanlalawiganOutcomeInputSchema.parse({ documentId: '<uuid>', outcome: 'valid_in_part', receivedAt: new Date(), remarks: 'short' })` fails; with `remarks: 'ten or more chars'` succeeds
  - [ ] `DesignationMetadataSchema.parse({ delegatingAuthorityEmployeeId: 'X', designatedPersonEmployeeId: 'X', ... })` fails with 'must differ'
  - [ ] `DocumentMetadataSchema.parse({ __type: 'SP_RESOLUTION', sponsors: [...] })` correctly discriminates to SpResolutionMetadata

---

## TASK-DOCS-004

Phase:          1
Module:         DOCS
Title:          Implement DOCS repository layer -- all nine documents.* tables
Prerequisites:  [TASK-DOCS-002, TASK-DOCS-003]
Deliverables:
  - /apps/server/src/modules/documents/documents.repository.ts — DocumentsRepository class with typed Drizzle ORM methods for all documents.* tables; key methods: findDocumentById, findDocumentsByOffice, findDocumentsByLifecycleState, insertDocument, updateDocumentLifecycleState, updateDocumentMetadata, updateDocumentNumbering, softDeleteDocument, insertNumber, findCurrentNumber, supersedePreliminaryNumber, insertVersion, findVersionsByDocument, findVersionById, updateVersionOcrResult, markVersionPendingVerification, markVersionVerified, insertAttachment, findAttachmentsByDocument, insertSignature, findSignaturesByDocument, insertSponsorship, findSponsorshipsByDocument, insertPanlalawiganReview, findPanlalawiganReviewByDocument, updatePanlalawiganReview, insertClassificationAllowlistEntry, hasClassificationAllowlistEntry; all reads use WHERE deleted_at IS NULL; no cross-schema queries
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] Vitest tests cover: insertDocument -> findDocumentById round-trip; insertNumber -> findCurrentNumber; hasClassificationAllowlistEntry returns false for unlisted type/role pairs
  - [ ] `pnpm test` passes
AI Prompt: |
  You are implementing the repository layer for the DOCS module of the Batac City LGU
  document-management platform. This is the only layer that touches documents.* tables
  directly. All other layers call this repository.

  ## Cross-module boundary rules (B2 Module 3, Law #2)
  - No cross-schema joins. For UUID references to organization.* or iam.* tables, store
    only the UUID. Name/label resolution is done by calling those modules' Published APIs.
  - Always filter WHERE deleted_at IS NULL unless explicitly fetching deleted records.
  - The repository does NOT enforce ABAC -- that is the policy guard's job.

  ## Key type conventions
  Import Drizzle table definitions from `/packages/database/src/schema/documents.ts`.
  Follow the pattern from `/apps/server/src/modules/organization/organization.repository.ts`
  (created by TASK-ORG-003): class accepting the db connection from `apps/server/src/db.ts`,
  methods returning strongly-typed results using Drizzle's InferSelectModel/InferInsertModel.

  ## updateDocumentNumbering -- atomic operation
  This method must update preliminary_number, final_number, and/or qr_tracking_number
  in a single UPDATE statement. It is used by the numbering service to atomically apply
  the formatted number string alongside inserting the documents.numbers ledger row.

  ## hasClassificationAllowlistEntry
  ```typescript
  async hasClassificationAllowlistEntry(
    documentTypeId: string, roleCode: string, cityId: string
  ): Promise<boolean> {
    const result = await this.db
      .select({ id: classificationAllowlists.id })
      .from(classificationAllowlists)
      .where(and(
        eq(classificationAllowlists.documentTypeId, documentTypeId),
        eq(classificationAllowlists.roleCode, roleCode),
        eq(classificationAllowlists.cityId, cityId),
        isNull(classificationAllowlists.deletedAt)
      ))
      .limit(1);
    return result.length > 0;
  }
  ```

  Before submitting this PR, confirm each item:
  - [ ] `pnpm typecheck` passes
  - [ ] Vitest tests cover: insertDocument -> findDocumentById round-trip; insertNumber -> findCurrentNumber; hasClassificationAllowlistEntry returns false for unlisted type/role pairs
  - [ ] `pnpm test` passes

---

## TASK-DOCS-005

Phase:          1
Module:         DOCS
Title:          Implement numbering service (fn_get_next_sequence_value wrapper, preliminary/final assignment, gap logging)
Prerequisites:  [TASK-DOCS-004]
Deliverables:
  - /apps/server/src/modules/documents/numbering.service.ts — NumberingService class with methods: assignPreliminaryNumber(documentId, seriesKey, cityId, actorId), assignFinalNumber(documentId, seriesKey, cityId, actorId), assignControlNumber(documentId, seriesKey, cityId, actorId), logCancellationGap(numberId, reason, actorId); all methods are atomic (single DB transaction: call fn_get_next_sequence_value -> insert documents.numbers row -> update documents.documents number column); service logs a structured warning when fn_get_next_sequence_value returns was_created=true (on-demand year sequence creation); gap cancellations write cancellation_reason to the documents.numbers row
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `assignPreliminaryNumber` inserts a documents.numbers row with number_type='preliminary', is_current=true, and updates documents.documents.preliminary_number to the formatted string (e.g. 'Draft 7SP 2026-01'); calling it a second time for the same document throws 'preliminary number already assigned'
  - [ ] `assignFinalNumber` when final_number IS NOT NULL throws; when NULL, inserts final row, sets old preliminary row is_current=false and superseded_at, updates documents.documents.final_number, clears preliminary_number=NULL
  - [ ] `pnpm test` passes
AI Prompt: |
  You are implementing the numbering service for the DOCS module of the Batac City LGU
  document-management platform. This service is the ONLY code path that assigns series
  numbers to documents. No other code may write to documents.numbers or the
  preliminary_number/final_number/control_number columns directly.

  ## Number assignment rules (H3 + C1 Part 5)

  Preliminary number assignment (SP_RESOLUTION, SP_ORDINANCE, SP_APPROPRIATION_ORDINANCE only):
  - Triggered at SECRETARIAT_LOGGING event (called by documents.submit for SP types)
  - Format: 'Draft 7SP {YEAR}-{NN}' where NN is zero-padded to sequence_padding=2 digits
  - Preliminary numbers are mutable until finalization; a new preliminary can supersede
    an old one (sequence order may diverge from logging order)

  Final number assignment:
  - SP_RESOLUTION: after SECOND_READING_VOTE_APPROVED
  - SP_ORDINANCE / SP_APPROPRIATION_ORDINANCE: after THIRD_READING_VOTE_APPROVED
  - Format: '7SP {YEAR}-{NN}' (same counter as preliminary)
  - IMMUTABLE once assigned: enforced by DB trigger AND by this service's precondition
  - When final assigned: clear preliminary_number to NULL on documents.documents;
    set old preliminary documents.numbers row is_current=false, superseded_at=now()

  Format rendering logic:
  - Read series row from documents.number_series for the given seriesKey
  - For sp_* types: rendered as '{sp_ordinal}{prefix}{delimiter}{year_format}-{NN}'
    = '7' + '' + ' ' + '2026' + '-' + '05' = '7SP 2026-05' (prefix is NULL for sp types,
    so format is sp_ordinal + delimiter + year + '-' + padded_sequence)
  - Use the series row's final_format or preliminary_format template to render
  - Pad sequence value to sequence_padding digits with leading zeros

  ## DB function call pattern
  ```typescript
  const result = await this.db.execute(
    sql`SELECT sequence_value, was_created FROM documents.fn_get_next_sequence_value(${seriesKey}, ${year})`
  );
  const { sequence_value, was_created } = result.rows[0];
  if (was_created) {
    this.logger.warn({ seriesKey, year }, 'On-demand year sequence created -- operational log only, NOT an audit event');
  }
  ```

  ## Gap policy (H3 §9)
  Gaps permitted only for cancelled documents. When a document is cancelled, call
  logCancellationGap to record the reason on the documents.numbers row.
  Reuse: Never. The sequence continues; gaps are permanent.

  ## Atomic transaction pattern
  All three steps must succeed together or all roll back:
  1. Call fn_get_next_sequence_value to get next sequence_value
  2. INSERT into documents.numbers with the formatted number_value
  3. UPDATE documents.documents.preliminary_number (or final_number, or control_number)

  Before submitting this PR, confirm each item:
  - [ ] `pnpm typecheck` passes
  - [ ] `assignPreliminaryNumber` inserts a documents.numbers row with number_type='preliminary', is_current=true, and updates documents.documents.preliminary_number to the formatted string (e.g. 'Draft 7SP 2026-01'); calling it a second time for the same document throws 'preliminary number already assigned'
  - [ ] `assignFinalNumber` when final_number IS NOT NULL throws; when NULL, inserts final row, sets old preliminary row is_current=false and superseded_at, updates documents.documents.final_number, clears preliminary_number=NULL
  - [ ] `pnpm test` passes

---

## TASK-DOCS-006

Phase:          1
Module:         DOCS
Title:          Implement DOCS Published API (getDocumentById, getDocumentType, transitionState, assignFinalNumber, getAttachmentRefs)
Prerequisites:  [TASK-DOCS-004, TASK-DOCS-005]
Deliverables:
  - /apps/server/src/modules/documents/documents.service.ts — createDocumentsService factory implementing all five Published API methods; transitionState validates the transition against the state machine before calling the repository (invalid transitions throw; DB constraint provides a second enforcement layer); transitionState emits document.state_changed on success; assignFinalNumber delegates to NumberingService.assignFinalNumber and emits document.number_assigned with numberType='final'; getAttachmentRefs generates presigned S3 GET URLs via the S3 client (expiry configurable via env var, default 900s); all five methods match the B2 Module 3 Published API interface signatures exactly
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `transitionState(id, 'disposed', actorId)` on lifecycle_state='draft' throws and does NOT update the row
  - [ ] `transitionState(id, 'cancelled', actorId)` on lifecycle_state='in_workflow' succeeds; row lifecycle_state='cancelled'
  - [ ] `document.state_changed` domain event is emitted on each successful transitionState call
  - [ ] `pnpm test` passes
AI Prompt: |
  You are implementing the Published API (service layer) for the DOCS module of the Batac
  City LGU document-management platform. This is the only interface other modules use to
  interact with DOCS -- they must never query documents.* tables directly (B2 Law #2).

  ## Published API interface (B2 Module 3 -- implement exactly)
  ```typescript
  interface DocumentsPublicAPI {
    getDocumentById(documentId: string): Promise<DocumentSummary | null>;
    getDocumentType(documentTypeId: string): Promise<DocumentTypeSummary | null>;
    transitionState(documentId: string, toState: DocumentLifecycleState, actorId: string, reason?: string): Promise<void>;
    assignFinalNumber(documentId: string, actorId: string): Promise<DocumentNumberResult>;
    getAttachmentRefs(documentId: string, actorId: string): Promise<AttachmentRef[]>;
  }
  ```

  ## State machine (I1 §17 -- enforce in transitionState before any DB write)
  ```typescript
  const VALID_TRANSITIONS: Record<string, string[]> = {
    'draft':                       ['submitted','cancelled'],
    'submitted':                   ['in_workflow','cancelled'],
    'in_workflow':                 ['pending_mayor_action','pending_panlalawigan_review','completed','cancelled'],
    'pending_mayor_action':        ['in_workflow','completed','cancelled'],
    'pending_panlalawigan_review': ['completed','superseded','cancelled'],
    'completed':                   ['released','cancelled'],
    'released':                    ['archived','cancelled'],
    'archived':                    ['disposed'],
    'disposed':                    [],
    'cancelled':                   [],
    'superseded':                  [],
  };
  ```
  If the requested transition is not in the allowed list, throw:
  `new Error(`invalid state transition: ${current} -> ${toState}`)`
  This check runs BEFORE the repository call. The DB trigger is a second enforcement layer.

  ## Domain events (B2 Module 3 -- emit on success)
  ```typescript
  // document.state_changed -- emit in transitionState
  eventBus.publish({
    type: 'document.state_changed',
    payload: { documentId, fromState, toState, actorId, reason, cityId, timestamp: new Date() }
  });

  // document.number_assigned -- emit in assignFinalNumber
  eventBus.publish({
    type: 'document.number_assigned',
    payload: { documentId, numberType: 'final', numberValue, series: seriesKey, assignedBy: actorId, cityId, timestamp: new Date() }
  });
  ```

  ## Event consumers (B2 Module 3)
  - document.created -> Tracking (QR generation), Workflow (instance creation), Audit
  - document.state_changed -> Tracking (routing history), Notifications, Audit
  - document.number_assigned -> Audit
  Emit via the shared event bus. DB write and event publish must be in the same transaction.
  Use the dead-letter repository for failed publishes.

  ## S3 presigned URLs (getAttachmentRefs)
  Use the S3 client configured via env vars (S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY
  from apps/server/src/config/env.server.ts). Generate presigned GET URLs with expiry from
  env var ATTACHMENT_URL_EXPIRY_SECONDS (default 900). Return only the UUID file_key as s3Key.
  ocrText is fetched from documents.versions.ocr_text.

  Before submitting this PR, confirm each item:
  - [ ] `pnpm typecheck` passes
  - [ ] `transitionState(id, 'disposed', actorId)` on lifecycle_state='draft' throws and does NOT update the row
  - [ ] `transitionState(id, 'cancelled', actorId)` on lifecycle_state='in_workflow' succeeds; row lifecycle_state='cancelled'
  - [ ] `document.state_changed` domain event is emitted on each successful transitionState call
  - [ ] `pnpm test` passes

---

## TASK-DOCS-007

Phase:          1
Module:         DOCS
Title:          Seed document_types -- seven Phase 1 types + DESIGNATION record (inactive, Phase 1B)
Prerequisites:  [TASK-DOCS-001, TASK-DOCS-008]
Deliverables:
  - /apps/server/src/database/seeds/document-types.seed.ts — idempotent seed script (upsert on city_id+code) that inserts eight rows into documents.document_types with all fields from H2 catalog, including the full JSON Schema metadata_schema JSONB for each type; DESIGNATION seeded with is_active=false; number_series_id FKs resolved by querying documents.number_series by series_key at seed time; retention_schedule_id set to placeholder UUID constants if records.retention_schedules is not yet populated (with TODO comment); script must run AFTER TASK-DOCS-008 (number_series seed)
Acceptance Criteria:
  - [ ] Running the seed twice produces exactly eight rows (upsert idempotent)
  - [ ] `SELECT code, is_active, has_preliminary_numbering, owning_module FROM documents.document_types ORDER BY code` returns: CERTIFICATION_OF_URGENCY(true,false,workflow), CITIZEN_COMPLAINT(true,false,portal), DESIGNATION(false,false,organization), DOCUMENT_REQUEST_FORM(true,false,portal), SP_APPROPRIATION_ORDINANCE(true,true,workflow), SP_ORDINANCE(true,true,workflow), SP_RESOLUTION(true,true,workflow), TRANSMITTAL_LETTER(true,false,workflow)
  - [ ] Each row's metadata_schema is valid JSON parseable by JSON.parse()
  - [ ] All active rows have retention_schedule_id IS NOT NULL (placeholder UUID acceptable if REC not yet seeded)
AI Prompt: |
  You are writing the document_types seed script for the Batac City LGU
  document-management platform. Must run AFTER the number_series seed (TASK-DOCS-008).

  ## Document type catalog (H2 Catalog Summary Table)

  1. SP_RESOLUTION: name='SP Resolution', owning_module='workflow', series_key='sp_resolution',
     has_preliminary_numbering=true, is_active=true, classification_default='internal',
     public_visibility_rule='title_and_first_page_public', retention='permanent'

  2. SP_ORDINANCE: name='SP Ordinance', owning_module='workflow', series_key='sp_ordinance',
     has_preliminary_numbering=true, is_active=true, classification_default='internal',
     public_visibility_rule='title_and_first_page_public', retention='permanent'

  3. SP_APPROPRIATION_ORDINANCE: name='Appropriation Ordinance', owning_module='workflow',
     series_key='sp_appropriation_ordinance', has_preliminary_numbering=true, is_active=true,
     classification_default='internal', public_visibility_rule='title_and_first_page_public', retention='permanent'

  4. CERTIFICATION_OF_URGENCY: name='Certification of Urgency', owning_module='workflow',
     series_key=NULL (no series -- H2 footnote 2), has_preliminary_numbering=false, is_active=true,
     classification_default='internal', public_visibility_rule='not_public', retention='permanent'

  5. CITIZEN_COMPLAINT: name='Citizen Complaint', owning_module='portal',
     series_key=NULL, has_preliminary_numbering=false, is_active=true,
     classification_default='internal', public_visibility_rule='complainant_restricted',
     retention='citizens_correspondence' (10-15 years)

  6. DOCUMENT_REQUEST_FORM: name='Document Request Form', owning_module='portal',
     series_key=NULL, has_preliminary_numbering=false, is_active=true,
     classification_default='internal', public_visibility_rule='requester_restricted',
     retention='citizens_correspondence'

  7. TRANSMITTAL_LETTER: name='Transmittal Letter', owning_module='workflow',
     series_key='letters_sent', has_preliminary_numbering=false, is_active=true,
     classification_default='internal', public_visibility_rule='not_public', retention='permanent'

  8. DESIGNATION: name='Designation', owning_module='organization', series_key='designation',
     has_preliminary_numbering=false, IS_ACTIVE=FALSE (Phase 1B -- activate when Phase 1B
     Designation workflow is published), classification_default='internal',
     public_visibility_rule='not_public', retention='permanent'

  ## Retention schedule resolution
  Two slugs from H2:
  - 'retention_permanent': pin as a constant UUID generated once and committed (e.g. 'a1b2c3d4-...')
  - 'retention_citizens_correspondence': pin as another constant UUID
  These are placeholder UUIDs until the REC module seeds records.retention_schedules.
  Add a TODO comment: 'TODO: replace with actual records.retention_schedules UUID after REC seed runs'.
  The DB CHECK constraint (ck_document_types_retention_before_activation) prevents activating
  a type without a valid retention_schedule_id, so placeholder UUIDs are safe for Phase 1.

  ## metadata_schema values
  Each type requires a full JSON Schema draft-07 object. Key structures:
  - SP_RESOLUTION: required=['sponsors','subject_matter','certified_urgent']; sponsors is array of objects
  - SP_ORDINANCE: required=['sponsors','subject_matter','certified_urgent','has_penalty_provision']; adds publication object
  - SP_APPROPRIATION_ORDINANCE: extends SP_ORDINANCE with budget_period_year (integer) and is_supplemental (boolean)
  - CERTIFICATION_OF_URGENCY: required=['issuing_authority_user_id','issuing_authority_display_name','session_date','associated_measure_ids']
  - CITIZEN_COMPLAINT: required=['complainant','subject_category','access_mode','outcome_state']
  - DOCUMENT_REQUEST_FORM: required=['requester','documents_requested','access_mode']
  - TRANSMITTAL_LETTER: required=['associated_measure_id','recipient_office_label']
  - DESIGNATION: required=['delegating_authority_user_id','delegating_authority_display_name',
      'designated_person_user_id','designated_person_display_name','designated_position_title',
      'scope_description','effective_from','effective_until']
  Use additionalProperties=false and type=object for all top-level schemas.

  ## Idempotency pattern
  ```typescript
  await db.insert(documentTypes).values(row).onConflictDoUpdate({
    target: [documentTypes.cityId, documentTypes.code],
    set: { name: sql`excluded.name`, isActive: sql`excluded.is_active`, ... }
  });
  ```

  Before submitting this PR, confirm each item:
  - [ ] Running the seed twice produces exactly eight rows (upsert idempotent)
  - [ ] `SELECT code, is_active, has_preliminary_numbering, owning_module FROM documents.document_types ORDER BY code` returns: CERTIFICATION_OF_URGENCY(true,false,workflow), CITIZEN_COMPLAINT(true,false,portal), DESIGNATION(false,false,organization), DOCUMENT_REQUEST_FORM(true,false,portal), SP_APPROPRIATION_ORDINANCE(true,true,workflow), SP_ORDINANCE(true,true,workflow), SP_RESOLUTION(true,true,workflow), TRANSMITTAL_LETTER(true,false,workflow)
  - [ ] Each row's metadata_schema is valid JSON parseable by JSON.parse()
  - [ ] All active rows have retention_schedule_id IS NOT NULL (placeholder UUID acceptable if REC not yet seeded)

---

## TASK-DOCS-008

Phase:          1
Module:         DOCS
Title:          Seed number_series -- all 11 series records + 2026 year sequences for Phase 1 active series
Prerequisites:  [TASK-DOCS-001, TASK-ORG-009]
Deliverables:
  - /apps/server/src/database/seeds/number-series.seed.ts — idempotent seed script (upsert on city_id+series_key) that inserts all 11 rows into documents.number_series with values from H3 Tables 1-3; authority_office_id resolved by querying organization.offices WHERE code='SPS' at seed time; also runs CREATE SEQUENCE IF NOT EXISTS for the four Phase 1 active series' 2026 sequences (ns_sp_resolution_2026_seq, ns_sp_ordinance_2026_seq, ns_sp_appropriation_ordinance_2026_seq, ns_panlalawigan_review_log_2026_seq)
Acceptance Criteria:
  - [ ] Running the seed twice is idempotent
  - [ ] `SELECT series_key, phase, sequence_padding FROM documents.number_series ORDER BY series_key` returns 11 rows with correct values (sp_resolution: phase=1, padding=2; panlalawigan_review_log: phase=1, padding=2; letters_received: phase=1b, padding=3)
  - [ ] `SELECT documents.fn_get_next_sequence_value('sp_resolution', 2026)` returns (1, false) on first call (sequence pre-created by seed, so was_created=false)
  - [ ] `SELECT relname FROM pg_class WHERE relname LIKE 'ns_%_2026_seq' ORDER BY relname` returns 4 rows
AI Prompt: |
  You are writing the number_series seed script for the Batac City LGU
  document-management platform. This seed must run BEFORE the document_types seed
  (TASK-DOCS-007) because document_types has a FK to number_series.

  ## Global field values (H3 -- identical across all 11 rows)
  - delimiter: ' ' (single space, confirmed Q-A01)
  - resets_annually: true (confirmed Part 5.1)
  - authority_office_id: query at seed time: SELECT id FROM organization.offices WHERE code='SPS'
    (SP Secretariat, confirmed Q-B03)
  - year_format: 'YYYY'

  ## All 11 series (H3 Tables 1-3)

  | series_key | series_type | phase | prefix | sp_ordinal | padding | sequence_name_prefix | preliminary_format | final_format | preliminary_event | final_event | deferred |
  |---|---|---|---|---|---|---|---|---|---|---|---|
  | sp_resolution | legislative | 1 | NULL | '7' | 2 | 'ns_sp_resolution' | 'Draft 7SP {YEAR}-{NN}' | '7SP {YEAR}-{NN}' | 'SECRETARIAT_LOGGING' | 'SECOND_READING_VOTE_APPROVED' | false |
  | sp_ordinance | legislative | 1 | NULL | '7' | 2 | 'ns_sp_ordinance' | 'Draft 7SP {YEAR}-{NN}' | '7SP {YEAR}-{NN}' | 'SECRETARIAT_LOGGING' | 'THIRD_READING_VOTE_APPROVED' | false |
  | sp_appropriation_ordinance | legislative | 1 | NULL | '7' | 2 | 'ns_sp_appropriation_ordinance' | 'Draft 7SP {YEAR}-{NN}' | '7SP {YEAR}-{NN}' | 'SECRETARIAT_LOGGING' | 'THIRD_READING_VOTE_APPROVED' | false |
  | notice_committee_hearing | administrative | 1b | 'NCH' | NULL | 2 | 'ns_nch' | NULL | 'NCH {YEAR}-{NN}' | NULL | 'SECRETARIAT_LOGGING' | false |
  | notice_special_session | administrative | 1b | 'NOSP' | NULL | 2 | 'ns_nosp' | NULL | 'NOSP {YEAR}-{NN}' | NULL | 'SECRETARIAT_LOGGING' | false |
  | designation | administrative | 1b | 'D' | NULL | 2 | 'ns_designation' | NULL | 'D {YEAR}-{NN}' | NULL | 'SECRETARIAT_LOGGING' | false |
  | letters_received | administrative | 1b | 'SPR' | NULL | 3 | 'ns_letters_received' | NULL | 'SPR {YEAR}-{NNN}' | NULL | 'SECRETARIAT_NUMBER_ASSIGNMENT' | TRUE |
  | letters_sent | administrative | 1b | 'SPS' | NULL | 2 | 'ns_letters_sent' | NULL | 'SPS {YEAR}-{NN}' | NULL | 'SECRETARIAT_LOGGING' | false |
  | memo_outgoing | administrative | 1b | 'MO' | NULL | 2 | 'ns_memo_outgoing' | NULL | 'MO {YEAR}-{NN}' | NULL | 'SECRETARIAT_FINALIZATION' | false |
  | memo_incoming | administrative | 1b | 'MI' | NULL | 2 | 'ns_memo_incoming' | NULL | 'MI {YEAR}-{NN}' | NULL | 'SECRETARIAT_LOGGING' | false |
  | panlalawigan_review_log | administrative | 1 | NULL | NULL | 2 | 'ns_panlalawigan_review_log' | NULL | '{YEAR}-{NN}' | NULL | 'RECEIPT_OF_PROVINCIAL_RESPONSE' | false |

  Notes:
  - panlalawigan_review_log has document_type_id=NULL (ADR-DB-001 -- it is a log entry, not a document type)
  - letters_received has deferred_final_assignment=TRUE (Part 4.8 -- SPR number assigned separately after VM review)
  - All Phase 1B series should still be seeded now with is_active=true (H3 §8: seed all before Phase 1 goes live;
    unused series have zero sequence activity until their workflow is live)
  - The document_type_id FK for each series: look up the UUID from documents.document_types by code;
    skip if not yet seeded (seed order: number_series BEFORE document_types)

  ## Phase 1 active series 2026 sequences (pre-create to avoid on-demand creation warning)
  ```sql
  CREATE SEQUENCE IF NOT EXISTS documents.ns_sp_resolution_2026_seq AS INTEGER INCREMENT 1 START 1;
  CREATE SEQUENCE IF NOT EXISTS documents.ns_sp_ordinance_2026_seq AS INTEGER INCREMENT 1 START 1;
  CREATE SEQUENCE IF NOT EXISTS documents.ns_sp_appropriation_ordinance_2026_seq AS INTEGER INCREMENT 1 START 1;
  CREATE SEQUENCE IF NOT EXISTS documents.ns_panlalawigan_review_log_2026_seq AS INTEGER INCREMENT 1 START 1;
  ```
  Execute these via db.execute(sql`CREATE SEQUENCE IF NOT EXISTS ...`) in the seed script.

  Before submitting this PR, confirm each item:
  - [ ] Running the seed twice is idempotent
  - [ ] `SELECT series_key, phase, sequence_padding FROM documents.number_series ORDER BY series_key` returns 11 rows with correct values (sp_resolution: phase=1, padding=2; panlalawigan_review_log: phase=1, padding=2; letters_received: phase=1b, padding=3)
  - [ ] `SELECT documents.fn_get_next_sequence_value('sp_resolution', 2026)` returns (1, false) on first call (sequence pre-created by seed, so was_created=false)
  - [ ] `SELECT relname FROM pg_class WHERE relname LIKE 'ns_%_2026_seq' ORDER BY relname` returns 4 rows

---

## TASK-DOCS-009

Phase:          1
Module:         DOCS
Title:          [ABAC] Implement DOCS ABAC policy guard rules (document, document_version, document_attachment, number_series resource types)
Prerequisites:  [TASK-DOCS-002, TASK-IAM-004]
Deliverables:
  - /apps/server/src/modules/documents/documents.policy.ts — DocumentPolicyGuard class with methods for every document action: canCreate, canReadMetadata, canReadContent, canUpdate, canSoftDelete, canSubmit, canCancel, canAssignPreliminaryNumber, canAssignFinalNumber, canCertifyUrgent, canArchive, canPublishPortal, canReadVersionContent, canCreateVersion, canReadOcrText, canReadScanQuality, canReadNumberSeries, canManageNumberSeries; plus checkStateActionCompatibility(action, lifecycleState) helper; each method takes SubjectContext plus resource attributes and returns boolean; no DB queries inside the guard (attributes pre-fetched by callers)
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `canCreate({ roles: ['dept_encoder'], officeId: 'A', effectiveOfficeIds: ['A'] }, { ownedByOfficeId: 'A' })` returns true
  - [ ] `canCreate({ roles: ['sys_admin'], ...}, ...)` returns false
  - [ ] `canReadContent({ roles: ['sys_admin'], isIta: true }, { classificationLevel: 'internal' })` returns false (Gate 2: IT Admin blocked from content regardless of classification)
  - [ ] `canAssignFinalNumber({ roles: ['sp_secretary'], ...}, { documentTypeCode: 'SP_RESOLUTION', finalNumber: 'already-set', preliminaryNumber: 'x', ...})` returns false
  - [ ] `checkStateActionCompatibility('update', 'in_workflow')` returns false; `checkStateActionCompatibility('cancel', 'in_workflow')` returns true
  - [ ] `pnpm test` passes
AI Prompt: |
  You are implementing the ABAC policy guard for the DOCS module of the Batac City LGU
  document-management platform. Called by every tRPC procedure before execution.
  Does NOT query the DB -- evaluates pre-fetched attributes only.

  ## SubjectContext type (from IAM module)
  ```typescript
  interface SubjectContext {
    userId: string; cityId: string; roles: string[];
    officeId: string | null; effectiveOfficeIds: string[];
    committeeIds: string[];  // JWT-cached per D-ABAC-06
    isIta: boolean; isPa: boolean;
  }
  ```

  ## Global cascade gates (I1 §2 -- run in every read/download method)
  Gate 2 (IT Admin content block -- Invariant #10): if subject.isIta is true, DENY
  all content access (versions, attachments, OCR text) regardless of classification.
  Note: the check in I1 §4.1 shows that sys_admin (IT Admin) has NO entry in the
  ALLOW clause for content -- not even for public documents. The guard must reflect this.

  Gate 4 (Classification gate): if classificationLevel IN ('confidential','restricted'),
  the guard accepts a pre-fetched hasAllowlistEntry boolean (the caller queries
  documents.classification_allowlists before calling the guard). If false -> DENY.

  ## document:create (I1 §3.1)
  ALLOW IF: subject.roles intersects {dept_encoder, dept_approver, sp_secretary, sp_member,
    sp_presiding_officer, mayor, brgy_encoder, brgy_captain}
    AND subject.officeId in subject.effectiveOfficeIds
  DENY: sys_admin, plat_admin, records_officer, auditor, citizen

  ## document:read metadata (I1 §3.2)
  ALLOW IF any of:
  - (ownedByOfficeId in subject.effectiveOfficeIds) AND roles intersect operational roles
  - Cross-office: roles in {records_officer, sp_secretary, sp_presiding_officer, mayor, auditor}
    AND classificationLevel in ('public','internal') AND hasCrossOfficeGrant=true
  - sp_member AND (documentCommitteeId in subject.committeeIds OR isInSpSession=true)
  - classificationLevel='public'
  sys_admin: ALLOW for public/internal classification metadata (title/status/number) only via
    getMetadataForAdmin procedure (not this general canReadMetadata method)

  ## document:update (I1 §3.3)
  ALLOW IF: lifecycleState='draft' AND ownedByOfficeId in effectiveOfficeIds
    AND roles intersect {dept_encoder, dept_approver, sp_secretary, sp_presiding_officer, mayor, brgy_encoder, brgy_captain}
  ADDITIONAL sp_member: ALLOW only if document.createdBy = subject.userId

  ## document:soft_delete (I1 §3.4)
  ALLOW IF: lifecycleState IN ('draft','submitted') AND workflowInstanceId IS NULL
    AND ownedByOfficeId in effectiveOfficeIds
    AND roles intersect {dept_encoder, dept_approver, sp_secretary, sp_presiding_officer, mayor, brgy_captain}

  ## document:submit (I1 §3.5)
  ALLOW IF: lifecycleState='draft' AND ownedByOfficeId in effectiveOfficeIds
    AND roles intersect {dept_encoder, dept_approver, sp_secretary, sp_member, sp_presiding_officer, mayor, brgy_encoder, brgy_captain}
  For SP types: formal submission (QR+workflow trigger) additionally requires roles CONTAINS 'sp_secretary'
  Expose this extra check as a separate method: requiresSpSecretaryForSubmit(documentTypeCode)

  ## document:cancel (I1 §3.6)
  ALLOW IF: lifecycleState NOT IN ('archived','disposed','cancelled')
    AND ownedByOfficeId in effectiveOfficeIds
    AND (roles intersect {dept_approver, sp_secretary, sp_presiding_officer, mayor, brgy_captain}
         OR (roles CONTAINS 'dept_encoder' AND lifecycleState IN ('draft','submitted') AND workflowInstanceId IS NULL)
         OR (roles CONTAINS 'brgy_encoder' AND lifecycleState IN ('draft','submitted') AND workflowInstanceId IS NULL))

  ## document:number_assign (I1 §3.7)
  ALLOW IF: documentTypeCode IN ('SP_RESOLUTION','SP_ORDINANCE','SP_APPROPRIATION_ORDINANCE')
    AND lifecycleState IN ('submitted','in_workflow') AND roles CONTAINS 'sp_secretary'
    AND preliminaryNumber IS NULL

  ## document:number_promote (I1 §3.8)
  ALLOW IF: documentTypeCode IN ('SP_RESOLUTION','SP_ORDINANCE','SP_APPROPRIATION_ORDINANCE')
    AND roles CONTAINS 'sp_secretary' AND preliminaryNumber IS NOT NULL AND finalNumber IS NULL
  (Workflow step check is done at the procedure level, not here)

  ## document:certify_urgent (I1 §3.9)
  ALLOW IF: roles CONTAINS 'sp_secretary'
    AND certifyingDocumentTypeCode='CERTIFICATION_OF_URGENCY'

  ## document:archive (I1 §3.10)
  ALLOW IF: lifecycleState IN ('completed','released')
    AND (roles CONTAINS 'records_officer'
         OR (roles CONTAINS 'sp_secretary' AND ownedByOfficeId=SP_SECRETARIAT_OFFICE_ID))

  ## document:publish_portal (I1 §3.11)
  ALLOW IF: documentTypeCode IN ('SP_RESOLUTION','SP_ORDINANCE','SP_APPROPRIATION_ORDINANCE')
    AND lifecycleState IN ('released','archived')
    AND (classificationLevel='public' OR (classificationLevel='internal' AND publicVisibilityRule='title_and_first_page_public'))
    AND roles CONTAINS 'sp_secretary'

  ## document_version:read / document_attachment:read (I1 §4.1)
  Gate 2 first: if subject.isIta -> DENY (no content access for IT Admin, any classification)
  Then: same own-office/cross-office/committee rules as document:read metadata
  NOTE: sys_admin has NO allowance in §4.1 ALLOW clause -- this is intentional, not an omission

  ## document_version:create (I1 §4.2)
  ALLOW IF: ownedByOfficeId in effectiveOfficeIds
    AND roles intersect {dept_encoder, dept_approver, sp_secretary, sp_member, sp_presiding_officer, mayor, brgy_encoder, brgy_captain}
  sp_member: additionally require document.createdBy = subject.userId

  ## number_series:read (I1 §14.1)
  ALLOW IF: roles intersect {plat_admin, records_officer, sp_secretary, sys_admin, auditor}

  ## State-Action Compatibility Matrix (I1 §17)
  ```typescript
  checkStateActionCompatibility(action: string, lifecycleState: string): boolean {
    const matrix: Record<string, string[]> = {
      'draft':                       ['create','read','update','submit','cancel'],
      'submitted':                   ['read','cancel','number_assign'],
      'in_workflow':                 ['read','approve','reject','cancel','number_assign'],
      'pending_mayor_action':        ['read','approve','reject','cancel','number_promote'],
      'completed':                   ['read','cancel','archive'],
      'released':                    ['read','cancel','archive'],
      'archived':                    ['read','dispose'],
      'disposed':                    ['read'],
      'cancelled':                   ['read'],
      'superseded':                  ['read'],
    };
    return matrix[lifecycleState]?.includes(action) ?? false;
  }
  ```

  Before submitting this PR, confirm each item:
  - [ ] `pnpm typecheck` passes
  - [ ] `canCreate({ roles: ['dept_encoder'], officeId: 'A', effectiveOfficeIds: ['A'] }, { ownedByOfficeId: 'A' })` returns true
  - [ ] `canCreate({ roles: ['sys_admin'], ...}, ...)` returns false
  - [ ] `canReadContent({ roles: ['sys_admin'], isIta: true }, { classificationLevel: 'internal' })` returns false (Gate 2: IT Admin blocked from content regardless of classification)
  - [ ] `canAssignFinalNumber({ roles: ['sp_secretary'], ...}, { documentTypeCode: 'SP_RESOLUTION', finalNumber: 'already-set', preliminaryNumber: 'x', ...})` returns false
  - [ ] `checkStateActionCompatibility('update', 'in_workflow')` returns false; `checkStateActionCompatibility('cancel', 'in_workflow')` returns true
  - [ ] `pnpm test` passes

---

## TASK-DOCS-010

Phase:          1
Module:         DOCS
Title:          Implement OCR service job wrapper (auto-enqueue on upload, quality score callback, manual re-OCR trigger) + first-page preview generation
Prerequisites:  [TASK-DOCS-004, CROSS-MODULE REF: INFRA -- pgboss job initialization task; exact TASK-INFRA-NNN not identifiable from TASK-ORG list alone; resolve at integration pass]
Deliverables:
  - /apps/server/src/modules/documents/ocr.service.ts — OcrService class with methods: enqueueOcrJob(versionId, s3Key, documentId), processOcrCallback(versionId, ocrText, scanQualityScore, documentId, mimeType), enqueueManualReOcrJob(versionId); enqueueOcrJob sends pgboss job 'ocr.process' with retryLimit=3, retryDelay=30s, expireInHours=24; processOcrCallback writes ocr_text, scan_quality_score, scan_quality_category to documents.versions and marks ocr_processed=true; scan quality category determined by env-configurable thresholds (good>=0.85, fair>=0.50, poor<0.50); if category='poor' sets requires_manual_verification=true; OcrProvider is injected (library-agnostic interface) with a StubOcrProvider that throws 'OCR provider not configured'. **[SPEC-GAP-TRACK-02 resolution]** processOcrCallback also calls `generateFirstPagePreview(documentId, s3Key, mimeType)` UNCONDITIONALLY for every document version — uploads a WebP image of page 1 to S3 at canonical key `documents/previews/{documentId}/page-1.webp`. Generation is intentionally NOT gated by `public_visibility_rule`: rendering a thumbnail is a technical capability distinct from who is authorized to view it, and `tracking.scanQrCodeAuthenticated` (E1) has no classification gate (`[Confirmed — I1 §7.3 in full]`, "any authenticated non-citizen, non-system role") and a non-nullable `firstPageImageUrl` output field — gating generation by visibility would leave that field unfillable for restricted document types scanned by authorized staff. Visibility-based ACCESS to the resulting image is the consuming module's (TRACK's) responsibility at the point a URL is handed to a caller, not DOCS's responsibility at generation time. The S3 key convention is the inter-module contract between DOCS and TRACK; TRACK constructs this key directly from documentId without an API call.
  - /apps/server/src/modules/documents/preview.provider.ts — PreviewProvider interface and StubPreviewProvider (same pattern as OcrProvider): `interface PreviewProvider { renderFirstPage(s3Key: string, mimeType: string): Promise<Buffer> }`. StubPreviewProvider returns a 1×1 transparent WebP placeholder. Production provider (pdf2pic, LibreOffice, or equivalent) injected when tech-stack decision is made for the rendering library. [RESOLVED — SPEC-GAP-TRACK-02, 2026-06-30]
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] After `enqueueOcrJob` called with valid versionId, a pgboss job with type 'ocr.process' exists in pg_boss.job
  - [ ] `processOcrCallback` with score=0.9 sets scan_quality_category='good'; score=0.7 sets 'fair'; score=0.3 sets 'poor' and requires_manual_verification=true
  - [ ] `processOcrCallback` calls PreviewProvider.renderFirstPage and uploads result to S3 key matching pattern `documents/previews/{documentId}/page-1.webp` for every call, regardless of the document's public_visibility_rule
  - [ ] `pnpm test` passes with mocked pgboss, mocked OcrProvider, and mocked PreviewProvider
AI Prompt: |
  You are implementing the OCR service for the DOCS module of the Batac City LGU
  document-management platform. OCR runs automatically on every document upload.
  The OCR library choice is an open item in tech-stack.md; stub the provider interface.
  This task also resolves SPEC-GAP-TRACK-02 by generating a first-page preview WebP
  image for every document, stored at a canonical S3 key that the TRACK module can
  construct directly from documentId without an API call.

  ## OCR flow (confirmed Q-C01)
  1. Client calls documents.requestUploadUrl -> receives presigned PUT URL + s3Key (UUID)
  2. Client uploads file directly to S3/MinIO (file never touches app server disk)
  3. Client calls documents.confirmUpload -> server inserts documents.versions row with
     ocr_processed=false, then calls OcrService.enqueueOcrJob(versionId, s3Key, documentId)
  4. pgboss job 'ocr.process' picked up by OCR worker
  5. OCR worker calls OcrProvider (library-specific) -> text + confidence score
  6. OCR worker calls OcrService.processOcrCallback(versionId, ocrText, score, documentId,
     mimeType) -> writes results to documents.versions, sets ocr_processed=true, then
     unconditionally calls generateFirstPagePreview (step 7)
  7. OcrService calls PreviewProvider.renderFirstPage(s3Key, mimeType) -> WebP Buffer,
     then uploads to S3 at `documents/previews/{documentId}/page-1.webp`.
     Generation is NOT gated by public_visibility_rule — rendering is a technical
     capability independent of access control. Visibility-based access to the resulting
     image URL is TRACK's responsibility at point of delivery, not DOCS's at generation.
     (tracking.scanQrCodeAuthenticated has no classification gate per I1 §7.3 and its
     output firstPageImageUrl is non-nullable — gating generation would leave that field
     unfillable for restricted document types scanned by authorized staff.)

  ## OcrProvider interface (library-agnostic stub)
  ```typescript
  export interface OcrProvider {
    extractTextFromS3Key(s3Key: string, mimeType: string): Promise<{
      text: string;
      confidenceScore: number;  // 0.0 to 1.0
    }>;
  }

  export class StubOcrProvider implements OcrProvider {
    async extractTextFromS3Key(): Promise<never> {
      throw new Error('OCR provider not configured -- set OCR_PROVIDER in environment');
    }
  }
  ```
  OcrService accepts OcrProvider via constructor injection. Production provider
  will be injected when the OCR library decision is made (tech-stack.md open item).

  ## Scan quality category thresholds (env-configurable)
  ```typescript
  const GOOD_THRESHOLD = parseFloat(process.env.OCR_QUALITY_GOOD_THRESHOLD ?? '0.85');
  const FAIR_THRESHOLD = parseFloat(process.env.OCR_QUALITY_FAIR_THRESHOLD ?? '0.50');

  function categorize(score: number): 'good' | 'fair' | 'poor' {
    if (score >= GOOD_THRESHOLD) return 'good';
    if (score >= FAIR_THRESHOLD) return 'fair';
    return 'poor';
  }
  ```
  If category='poor' -> set requires_manual_verification=true on the versions row.
  This surfaces the quality indicator to the SP Secretary for review.

  ## pgboss job enqueueing
  ```typescript
  await pgBoss.send('ocr.process', { versionId, s3Key, documentId }, {
    retryLimit: 3,
    retryDelay: 30,
    expireInHours: 24,
  });
  ```

  ## PreviewProvider interface (library-agnostic — same pattern as OcrProvider)
  ```typescript
  // /apps/server/src/modules/documents/preview.provider.ts
  export interface PreviewProvider {
    /**
     * Render the first page of a document file as a WebP image.
     * s3Key: the object key for the source file in S3/MinIO.
     * mimeType: MIME type of the source file (e.g. 'application/pdf', 'image/tiff').
     * Returns the WebP image as a Buffer.
     */
    renderFirstPage(s3Key: string, mimeType: string): Promise<Buffer>;
  }

  export class StubPreviewProvider implements PreviewProvider {
    async renderFirstPage(): Promise<Buffer> {
      // 1×1 transparent WebP placeholder (valid minimal WebP header)
      return Buffer.from(
        'UklGRlYAAABXRUJQVlA4IEoAAADQAQCdASoBAAEAAkA4JYgCdAEO/gHOAAD++' +
        'P3f///////z3/f1f/3//////9H/////////v/////////a//////////8A',
        'base64'
      );
    }
  }
  ```
  Production PreviewProvider (pdf2pic, LibreOffice, or equivalent) will be injected
  when the rendering library decision is made. Follow the OcrProvider injection pattern.

  ## First-page preview generation (SPEC-GAP-TRACK-02 resolution — unconditional)
  Called from processOcrCallback for EVERY version, regardless of visibility rule:
  ```typescript
  async generateFirstPagePreview(
    documentId: string,
    s3Key: string,
    mimeType: string
  ): Promise<void> {
    const webpBuffer = await this.previewProvider.renderFirstPage(s3Key, mimeType);
    // Canonical S3 key convention — TRACK constructs this key directly from documentId.
    // Changing this convention requires updating TASK-TRACK-007 and TASK-TRACK-008.
    // [RESOLVED — SPEC-GAP-TRACK-02, 2026-06-30]
    const previewKey = `documents/previews/${documentId}/page-1.webp`;
    await this.s3.putObject({
      Bucket: this.bucket,
      Key: previewKey,
      Body: webpBuffer,
      ContentType: 'image/webp',
    });
  }
  ```

  Before submitting this PR, confirm each item:
  - [ ] `pnpm typecheck` passes
  - [ ] After `enqueueOcrJob` called with valid versionId, a pgboss job with type 'ocr.process' exists in pg_boss.job
  - [ ] `processOcrCallback` with score=0.9 sets scan_quality_category='good'; score=0.7 sets 'fair'; score=0.3 sets 'poor' and requires_manual_verification=true
  - [ ] `processOcrCallback` calls PreviewProvider.renderFirstPage and uploads to S3 key `documents/previews/{documentId}/page-1.webp` for every call, regardless of public_visibility_rule
  - [ ] `pnpm test` passes with mocked pgboss, mocked OcrProvider, and mocked PreviewProvider

---

## TASK-DOCS-011

Phase:          1
Module:         DOCS
Title:          [ABAC][AUDIT] Implement documents tRPC router -- general CRUD (eight procedures)
Prerequisites:  [TASK-DOCS-006, TASK-DOCS-009, TASK-DOCS-010]
Deliverables:
  - /apps/server/src/modules/documents/documents.router.ts (general CRUD section) — eight procedures: documents.create, documents.get, documents.getMetadataForAdmin, documents.list, documents.search, documents.update, documents.delete, documents.cancel; each calls DocumentPolicyGuard before executing; cancel emits audit event; search uses PostgreSQL tsvector FTS (no Meilisearch in Phase 1); all input/output uses Zod schemas from TASK-DOCS-003
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `documents.create` with dept_encoder caller inserts lifecycle_state='draft'; qr_tracking_number NOT yet assigned
  - [ ] `documents.create` with sys_admin caller throws FORBIDDEN
  - [ ] `documents.get` with sys_admin caller and classification='confidential' throws FORBIDDEN (Gate 2)
  - [ ] `documents.cancel` requires non-empty reason; cancel on lifecycle_state='disposed' throws
  - [ ] `documents.search` results are filtered to caller's office scope (sp_secretary sees all SP office docs)
  - [ ] `pnpm test` passes
AI Prompt: |
  You are implementing the general CRUD section of the documents tRPC router for the
  Batac City LGU document-management platform.

  ## tRPC context
  ctx.subject: SubjectContext (userId, roles, officeId, effectiveOfficeIds, committeeIds, isIta, isPa, cityId)
  ctx.documentsService: DocumentsPublicAPI
  ctx.documentsPolicyGuard: DocumentPolicyGuard
  ctx.documentsRepository: DocumentsRepository (direct repo access for reads not in PublicAPI)

  ## ABAC enforcement pattern (apply in every procedure)
  ```typescript
  const document = await ctx.documentsRepository.findDocumentById(input.documentId, ctx.subject.cityId);
  if (!document) throw new TRPCError({ code: 'NOT_FOUND' });
  const allowed = ctx.documentsPolicyGuard.canReadMetadata(ctx.subject, {
    ownedByOfficeId: document.ownedByOfficeId,
    classificationLevel: document.classificationLevel,
    hasCrossOfficeGrant: await ctx.orgService.hasCrossOfficeReadGrant(ctx.subject.userId),
    hasAllowlistEntry: await ctx.documentsRepository.hasClassificationAllowlistEntry(
      document.documentTypeId, ctx.subject.roles[0], ctx.subject.cityId
    ),
    // ... other attributes
  });
  if (!allowed) throw new TRPCError({ code: 'FORBIDDEN' });
  ```

  ## documents.create (mutation)
  Input: `z.object({ documentTypeId: z.string().uuid(), title: z.string().min(1).max(500).trim(), classificationLevel: ClassificationLevelSchema.default('internal'), metadata: z.record(z.unknown()).default({}) })`
  Output: `z.object({ documentId: z.string().uuid(), lifecycleState: z.literal('draft') })`
  ABAC: canCreate -- sys_admin, plat_admin, records_officer, auditor, citizen -> FORBIDDEN
  Business:
  - Fetch document_type to get classification_default (override only if subject has write-classification permission)
  - For SP types (SP_RESOLUTION, SP_ORDINANCE, SP_APPROPRIATION_ORDINANCE): set originating_office_id
    and owned_by_office_id server-side to SP Secretariat office UUID (not from request body)
  - Validate input.metadata against document_type.metadata_schema (second-pass JSONB validation)
  - Insert with lifecycle_state='draft'; qr_tracking_number NOT yet set (assigned at submit)
  - created_by = ctx.subject.userId; retention_schedule_id from document_type row
  - NO domain event or audit event at draft creation (event-worthy moment is submit per B2)

  ## documents.get (query)
  Input: `z.object({ documentId: z.string().uuid() })`
  Output: DocumentSelectSchema (full document record + nested office/type summaries)
  ABAC: canReadMetadata -- sys_admin must use getMetadataForAdmin instead; warn in response for misdirected calls
  Gate 4: fetch hasAllowlistEntry from repository for confidential/restricted docs

  ## documents.getMetadataForAdmin (query -- sys_admin ONLY)
  Input: `z.object({ documentId: z.string().uuid() })`
  Output: narrow shape: `z.object({ documentId: z.string(), title: z.string(), lifecycleState: LifecycleStateSchema, finalNumber: z.string().nullable(), classificationLevel: ClassificationLevelSchema })`
  ABAC: roles MUST CONTAIN 'sys_admin'; Gate 2 extends to metadata admin view -- DENY if classificationLevel IN (confidential,restricted) even for sys_admin

  ## documents.list (query)
  Input: PaginationInputSchema extended with: documentTypeId?, lifecycleState?, officeId?, dateFrom?, dateTo?
  Output: `z.object({ items: z.array(DocumentSummarySchema), nextCursor: z.string().nullable() })`
  ABAC: same as canReadMetadata applied as WHERE filter; RLS on documents.documents provides DB-level scoping

  ## documents.search (query)
  Input: PaginationInputSchema extended with: queryText (min 1 char), documentTypeIds?, classificationLevels?, dateFrom?, dateTo?
  Output: `z.object({ items: z.array(z.object({ documentId, title, documentTypeName, finalNumber, currentState })), nextCursor: z.string().nullable() })`
  Phase 1 FTS: use to_tsquery() against documents.documents.tsv and LEFT JOIN documents.versions for ocr_text match
  Apply office-scope WHERE: encoders/approvers see own office only; sp_secretary/records_officer/auditor bypass

  ## documents.update (mutation)
  Input: `z.object({ documentId: z.string().uuid(), title: z.string().min(1).max(500).trim().optional(), metadata: z.record(z.unknown()).optional() })`
  ABAC: canUpdate -- lifecycle_state MUST BE 'draft'; checkStateActionCompatibility('update', state)
  Business: update title and/or metadata; validate updated metadata against document_type.metadata_schema

  ## documents.delete (mutation -- soft delete ONLY)
  Input: `z.object({ documentId: z.string().uuid() })`
  ABAC: canSoftDelete -- lifecycle_state IN ('draft','submitted') AND workflow_instance_id IS NULL
  Business: set deleted_at=now(), deleted_by=ctx.subject.userId; NEVER hard delete (Invariant #2)

  ## documents.cancel (mutation)
  Input: `z.object({ documentId: z.string().uuid(), reason: z.string().min(1).max(2048) })`
  ABAC: canCancel -- reason is mandatory at procedure level (Zod min 1 char + business rule)
  Business: calls ctx.documentsService.transitionState(documentId, 'cancelled', userId, reason)
  Audit event: emit DOCUMENT_CANCELLED with reason (I1 Part 11.11 -- every cancellation audit-logged)

  Before submitting this PR, confirm each item:
  - [ ] `pnpm typecheck` passes
  - [ ] `documents.create` with dept_encoder caller inserts lifecycle_state='draft'; qr_tracking_number NOT yet assigned
  - [ ] `documents.create` with sys_admin caller throws FORBIDDEN
  - [ ] `documents.get` with sys_admin caller and classification='confidential' throws FORBIDDEN (Gate 2)
  - [ ] `documents.cancel` requires non-empty reason; cancel on lifecycle_state='disposed' throws
  - [ ] `documents.search` results are filtered to caller's office scope (sp_secretary sees all SP office docs)
  - [ ] `pnpm test` passes

---

## TASK-DOCS-012

Phase:          1
Module:         DOCS
Title:          [ABAC][AUDIT] Implement documents tRPC router -- SP workflow specifics and Secretariat decision delegation (eight procedures)
Prerequisites:  [TASK-DOCS-011]
Deliverables:
  - /apps/server/src/modules/documents/documents.router.ts (SP workflow section) — eight procedures added to the router: documents.submit, documents.assignPreliminaryNumber, documents.assignFinalNumber, documents.logCertificationOfUrgency, documents.publishToPortal, documents.unpublishFromPortal, documents.archive, documents.logSecretariatDecision; submit triggers QR number assignment + preliminary number + emits document.created; logSecretariatDecision delegates to Workflow Published API (stubbed in Phase 1 pending WF module); assignPreliminaryNumber and assignFinalNumber use NumberingService
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `documents.submit` on draft SP_RESOLUTION: lifecycle_state='submitted', qr_tracking_number set to UUID, preliminary_number='Draft 7SP 2026-01', document.created event emitted
  - [ ] `documents.submit` with non-sp_secretary caller on SP_RESOLUTION throws FORBIDDEN with code 'sp_secretary_required_for_formal_submission'
  - [ ] `documents.assignPreliminaryNumber` on document with existing preliminary_number throws PRECONDITION_FAILED
  - [ ] `documents.assignFinalNumber` on SP_RESOLUTION: final_number='7SP 2026-01', preliminary_number cleared to NULL
  - [ ] `documents.logCertificationOfUrgency` with associatedMeasureId where lifecycle_state != 'in_workflow' throws PRECONDITION_FAILED
  - [ ] `pnpm test` passes
AI Prompt: |
  You are implementing the SP workflow specifics section of the documents tRPC router
  for the Batac City LGU document-management platform.

  ## documents.submit (mutation)
  Input: `z.object({ documentId: z.string().uuid() })`
  Output: `z.object({ lifecycleState: z.literal('submitted'), qrTrackingNumber: z.string().uuid(), preliminaryNumber: z.string().nullable() })`
  ABAC: canSubmit
  Special SP rule: for SP_RESOLUTION/SP_ORDINANCE/SP_APPROPRIATION_ORDINANCE document types,
    subject.roles MUST CONTAIN 'sp_secretary'; else throw:
    `new TRPCError({ code: 'FORBIDDEN', message: 'sp_secretary_required_for_formal_submission' })`
  Business (atomic transaction):
  1. Generate qr_tracking_number = crypto.randomUUID() (ensures uniqueness per Invariant)
  2. Transition lifecycle_state from 'draft' to 'submitted'
  3. For SP types: call NumberingService.assignPreliminaryNumber (secretariat logging)
  4. Emit domain event 'document.created' (NOTE: event name is 'document.created' per B2 §3
     even though it fires at SUBMIT, not at INSERT of the draft):
     `{ type: 'document.created', payload: { documentId, documentTypeId, documentTypeName,
        originatingOfficeId, createdBy: actorId, cityId, timestamp: new Date() } }`
  5. Workflow instance creation is triggered by the Workflow module listening to 'document.created'
     via the event bus -- do NOT call Workflow module directly here

  ## documents.assignPreliminaryNumber (mutation)
  Input: `z.object({ documentId: z.string().uuid() })`
  Output: `z.object({ preliminaryNumber: z.string() })`
  ABAC: canAssignPreliminaryNumber (sp_secretary ONLY; preliminaryNumber IS NULL precondition)
  Business: calls NumberingService.assignPreliminaryNumber
  Emits: 'document.number_assigned' with numberType='preliminary'

  ## documents.assignFinalNumber (mutation)
  Input: `z.object({ documentId: z.string().uuid() })`
  Output: `z.object({ finalNumber: z.string(), assignedAt: z.coerce.date() })`
  ABAC: canAssignFinalNumber (sp_secretary ONLY; requires correct workflow step state; preliminaryNumber IS NOT NULL; finalNumber IS NULL)
  Business: calls ctx.documentsService.assignFinalNumber (delegating to NumberingService);
  clears preliminaryNumber to NULL; emits 'document.number_assigned' with numberType='final'
  Final numbers are IMMUTABLE -- DB trigger enforces, procedure checks as precondition

  ## documents.logCertificationOfUrgency (mutation)
  Input: `z.object({ certifyingDocumentId: z.string().uuid(), associatedMeasureIds: z.array(z.string().uuid()).min(1).max(10) })`
  Output: `z.object({ certificationDocumentId: z.string().uuid(), affectedDocumentIds: z.array(z.string().uuid()) })`
  ABAC: sp_secretary ONLY; certifyingDocument.documentTypeCode MUST BE 'CERTIFICATION_OF_URGENCY'
  Business:
  1. Load all associatedMeasureIds from documents.documents
  2. Verify ALL have lifecycle_state='in_workflow' AND workflowStepType='committee_referral_pending'
     If ANY fail -> throw PRECONDITION_FAILED for ALL (all-or-nothing)
  3. For each measure: update metadata by merging { certified_urgent: true, certification_of_urgency_document_id: certifyingDocumentId }
  4. Emit event 'document.certified_urgent' for each measure (Workflow module listens to bypass committee step)
  5. The certifying document itself (CERTIFICATION_OF_URGENCY type) has no number series (H2 §4 footnote)

  ## documents.publishToPortal / documents.unpublishFromPortal (mutations)
  Input: `z.object({ documentId: z.string().uuid() })`
  ABAC for publishToPortal: canPublishPortal -- SP types only, lifecycle IN (released,archived), sp_secretary role,
    classificationLevel='public' OR (internal AND publicVisibilityRule='title_and_first_page_public')
  Business: merge { portal_published: true/false, portal_published_at: now()/null } into metadata JSONB
  [Inference: Phase 1 uses metadata JSONB flag since portal.* tables are Phase 3 per C1 Part 13]

  ## documents.archive (mutation)
  Input: `z.object({ documentId: z.string().uuid() })`
  ABAC: canArchive -- lifecycle IN (completed,released)
  Business: calls ctx.documentsService.transitionState(documentId, 'archived', actorId)

  ## documents.logSecretariatDecision (mutation) [ADR-B2-3 delegation]
  Input: `z.object({ documentId: z.string().uuid(), stepInstanceId: z.string().uuid(), decision: z.enum(['approve','reject','amended']), remarks: z.string().max(2048).optional() })`
  ABAC: sp_secretary ONLY; step must be assigned to SP Secretariat office
  Business per ADR-B2-3:
  - DELEGATES to Workflow.submitStepAction(stepInstanceId, { outcome: decision, remarks })
  - Does NOT call document state transition directly -- the Workflow module does that
  - Phase 1 stub (before WF module available): transition state directly + add TODO:
    `// TODO(WF-INTEGRATION): replace with ctx.workflowService.submitStepAction(...) when TASK-WF-NNN completes`

  Before submitting this PR, confirm each item:
  - [ ] `pnpm typecheck` passes
  - [ ] `documents.submit` on draft SP_RESOLUTION: lifecycle_state='submitted', qr_tracking_number set to UUID, preliminary_number='Draft 7SP 2026-01', document.created event emitted
  - [ ] `documents.submit` with non-sp_secretary caller on SP_RESOLUTION throws FORBIDDEN with code 'sp_secretary_required_for_formal_submission'
  - [ ] `documents.assignPreliminaryNumber` on document with existing preliminary_number throws PRECONDITION_FAILED
  - [ ] `documents.assignFinalNumber` on SP_RESOLUTION: final_number='7SP 2026-01', preliminary_number cleared to NULL
  - [ ] `documents.logCertificationOfUrgency` with associatedMeasureId where lifecycle_state != 'in_workflow' throws PRECONDITION_FAILED
  - [ ] `pnpm test` passes

---

## TASK-DOCS-013

Phase:          1
Module:         DOCS
Title:          [ABAC] Implement documents tRPC router -- file, version, and attachment handling (nine procedures)
Prerequisites:  [TASK-DOCS-011, TASK-DOCS-010]
Deliverables:
  - /apps/server/src/modules/documents/documents.router.ts (file/version/attachment section) — nine procedures added: documents.requestUploadUrl, documents.confirmUpload, documents.getVersionHistory, documents.downloadVersion, documents.getOcrText, documents.getScanQualityIndicator, documents.triggerManualReOcr, documents.flagScannedBackForVerification, documents.acceptScannedBackAsOfficial; requestUploadUrl generates a UUID s3Key + presigned PUT URL; confirmUpload inserts documents.versions row and enqueues OCR job; downloadVersion generates presigned GET URL (sys_admin excluded); file never touches app server disk (Invariant #3)
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `documents.requestUploadUrl` returns presignedUploadUrl (URL) and s3Key (UUID); s3Key is NOT the original filename
  - [ ] `documents.confirmUpload` inserts a versions row with ocr_processed=false and enqueues 'ocr.process' job
  - [ ] `documents.downloadVersion` with sys_admin caller throws FORBIDDEN (content exclusion per I1 §4.1)
  - [ ] `documents.getScanQualityIndicator` returns scanQualityScore and scanQualityCategory for an OCR-processed version
  - [ ] `pnpm test` passes
AI Prompt: |
  You are implementing the file, version, and attachment handling section of the
  documents tRPC router for the Batac City LGU document-management platform.

  ## Architectural invariant -- files never touch app server disk (tech-stack.md)
  - Client uploads directly to S3/MinIO via presigned PUT URL
  - s3Key is always a UUID generated by the server (never the original filename -- Invariant #5)
  - App server only generates and verifies upload; never buffers file bytes

  ## documents.requestUploadUrl (mutation)
  Input: `z.object({ documentId: z.string().uuid(), filename: z.string().min(1).max(512), mimeType: z.string(), fileSizeBytes: z.number().int().positive().max(26214400) })`
  Output: `z.object({ presignedUploadUrl: z.string().url(), s3Key: z.string().uuid() })`
  ABAC: ownedByOfficeId in effectiveOfficeIds; sp_member: document.createdBy=subject.userId only
  Business:
  1. s3Key = crypto.randomUUID()
  2. Generate S3 presigned PUT URL for the s3Key (expiry from env UPLOAD_URL_EXPIRY_SECONDS, default 900)
  3. Return URL + s3Key to client; do NOT insert versions row yet

  ## documents.confirmUpload (mutation)
  Input: `z.object({ documentId: z.string().uuid(), s3Key: z.string().uuid(), originalFilename: z.string(), mimeType: z.string(), fileSizeBytes: z.number().int().positive(), pageCount: z.number().int().positive().optional() })`
  Output: `z.object({ versionId: z.string().uuid(), versionNumber: z.number().int(), ocrQueued: z.literal(true) })`
  ABAC: same as requestUploadUrl
  Business:
  1. versionNumber = max(existing version_numbers for documentId) + 1
  2. Insert documents.versions with: file_key=s3Key (UUID), original_filename from input,
     ocr_processed=false, created_by=subject.userId; file_key stores UUID NOT original_filename
  3. Call OcrService.enqueueOcrJob(versionId, s3Key, documentId)
  4. Return ocrQueued=true always (Q-C01: OCR always runs on upload)

  ## documents.getVersionHistory (query)
  Input: `z.object({ documentId: z.string().uuid() })`
  Output: `z.array(VersionSelectSchema)` (excludes ocr_text field -- separate procedure)
  ABAC: same own-office/cross-office scoping as documents.get

  ## documents.downloadVersion (mutation)
  Input: `z.object({ versionId: z.string().uuid() })`
  Output: `z.object({ presignedDownloadUrl: z.string().url(), expiresInSeconds: z.number().int() })`
  ABAC: canReadVersionContent -- Gate 2 applies first: if subject.isIta -> FORBIDDEN
  NOTE: sys_admin (isIta=true) has NO entry in the §4.1 ALLOW clause -- not even for public docs
  Business: generate presigned GET URL for versions.file_key; expiry from DOWNLOAD_URL_EXPIRY_SECONDS env (default 900)

  ## documents.getOcrText (query)
  Input: `z.object({ versionId: z.string().uuid() })`
  Output: `z.object({ ocrText: z.string().nullable(), ocrProcessed: z.boolean() })`
  ABAC: canReadOcrText -- same as downloadVersion (Gate 2 applies; isIta -> FORBIDDEN)

  ## documents.getScanQualityIndicator (query)
  Input: `z.object({ versionId: z.string().uuid() })`
  Output: `z.object({ scanQualityScore: z.number().min(0).max(1).nullable(), scanQualityCategory: z.enum(['good','fair','poor']).nullable(), requiresManualVerification: z.boolean() })`
  ABAC: looser than content read -- any document author or office member can check quality;
  canReadScanQuality: ownedByOfficeId in effectiveOfficeIds OR document.createdBy = subject.userId

  ## documents.triggerManualReOcr (mutation)
  Input: `z.object({ versionId: z.string().uuid() })`
  Output: `z.object({ ocrQueued: z.literal(true) })`
  ABAC: roles MUST CONTAIN 'records_officer' OR 'sp_secretary'
  Business: calls OcrService.enqueueManualReOcrJob(versionId)

  ## documents.flagScannedBackForVerification (mutation)
  Input: `z.object({ versionId: z.string().uuid(), notes: z.string().max(512).optional() })`
  ABAC: roles MUST CONTAIN 'records_officer'
  Business: set requires_manual_verification=true on documents.versions (Part 11.4 physical correspondence)

  ## documents.acceptScannedBackAsOfficial (mutation)
  Input: `z.object({ versionId: z.string().uuid() })`
  ABAC: roles MUST CONTAIN 'records_officer' OR 'sp_secretary'
  Business: set requires_manual_verification=false, verified_by=subject.userId, verified_at=now()

  Before submitting this PR, confirm each item:
  - [ ] `pnpm typecheck` passes
  - [ ] `documents.requestUploadUrl` returns presignedUploadUrl (URL) and s3Key (UUID); s3Key is NOT the original filename
  - [ ] `documents.confirmUpload` inserts a versions row with ocr_processed=false and enqueues 'ocr.process' job
  - [ ] `documents.downloadVersion` with sys_admin caller throws FORBIDDEN (content exclusion per I1 §4.1)
  - [ ] `documents.getScanQualityIndicator` returns scanQualityScore and scanQualityCategory for an OCR-processed version
  - [ ] `pnpm test` passes

---

## TASK-DOCS-014

Phase:          1
Module:         DOCS
Title:          [AUDIT] Implement Panlalawigan review tRPC procedures (initiate transmittal, log outcome, deemed-approved timer)
Prerequisites:  [TASK-DOCS-011]
Deliverables:
  - /apps/server/src/modules/documents/panlalawigan.router.ts — tRPC sub-router with three procedures (documents.initiatePanlalawiganTransmittal, documents.logPanlalawiganOutcome, documents.getPanlalawiganReview) merged into the main documentsRouter; plus a pgboss scheduled job handler 'panlalawigan.checkDeemedApproved' registered in the DOCS plugin (runs nightly at 6 AM PH time); initiatePanlalawiganTransmittal sets action_deadline=transmittedAt+30days and assigns a panlalawigan_review_log series control number; logPanlalawiganOutcome enforces remarks requirement for valid_in_part and returned outcomes; deemed-approved timer auto-sets outcome and transitions document state for overdue reviews
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `documents.initiatePanlalawiganTransmittal` creates a panlalawigan_reviews row with action_deadline = transmittedAt + INTERVAL '30 days'
  - [ ] `documents.logPanlalawiganOutcome` with outcome='valid_in_part' and remarks.length < 10 throws ZodError; with valid remarks succeeds
  - [ ] `documents.logPanlalawiganOutcome` with outcome='deemed_approved' throws FORBIDDEN (only the system timer can set deemed_approved)
  - [ ] Deemed-approved job handler sets outcome='deemed_approved' and transitions document to 'completed' for a review with transmitted_at 31 days ago and outcome=NULL
  - [ ] `pnpm test` passes
AI Prompt: |
  You are implementing the Panlalawigan review procedures for the DOCS module of the
  Batac City LGU document-management platform.

  ## Business context (consolidated reference Part 4.3 + H3)
  SP Resolutions, Ordinances, and Appropriation Ordinances passed by the SP are
  transmitted to the Sangguniang Panlalawigan (Provincial Council) for review.
  The Panlalawigan has 30 days to respond. If no response is received within 30 days,
  the measure is deemed approved by operation of law (Section 54, LGC 1991).
  The deemed_approved outcome is system-generated only -- the SP Secretary cannot
  manually set it.

  ## documents.initiatePanlalawiganTransmittal (mutation)
  Input: `z.object({ documentId: z.string().uuid(), transmittedAt: z.coerce.date(), controlNumber: z.string().max(64).optional(), subject: z.string().max(512).optional() })`
  Callable by: sp_secretary ONLY
  Precondition: document.lifecycle_state MUST BE 'pending_panlalawigan_review'
  Business:
  1. Insert documents.panlalawigan_reviews with:
     - transmitted_at = transmittedAt
     - action_deadline = transmittedAt + INTERVAL '30 days'
     - subject = input.subject
  2. Assign panlalawigan_review_log series control number via NumberingService.assignControlNumber
     (series_key='panlalawigan_review_log', year from transmittedAt.getFullYear())
  3. Store control_no on the review row
  4. Emit audit event

  ## documents.logPanlalawiganOutcome (mutation)
  Input: LogPanlalawiganOutcomeInputSchema (from TASK-DOCS-003 -- has refine for valid_in_part/returned remarks)
  Callable by: sp_secretary ONLY
  Precondition: outcome MUST NOT BE 'deemed_approved' (system-only):
    if (input.outcome === 'deemed_approved') throw new TRPCError({ code: 'FORBIDDEN', message: 'deemed_approved is set by the system only' })
  Business:
  1. Update panlalawigan_reviews: outcome, response_date, resolution_number, remarks
  2. Compute days_elapsed = Math.floor((receivedAt - transmitted_at) / (1000*60*60*24))
  3. Transition document state based on outcome:
     - 'valid' or 'valid_in_part' or 'operative_in_its_entirety': transitionState -> 'completed'
     - 'returned': transitionState -> 'in_workflow' (returned for amendment)
  4. Emit audit event

  ## documents.getPanlalawiganReview (query)
  Input: `z.object({ documentId: z.string().uuid() })`
  Output: PanlalawiganReviewSelectSchema
  Callable by: sp_secretary, sp_presiding_officer, records_officer, auditor, mayor

  ## panlalawigan.checkDeemedApproved (pgboss scheduled job)
  Register in DOCS plugin:
  ```typescript
  await pgBoss.schedule('panlalawigan.checkDeemedApproved', '0 6 * * *', {}, { timezone: 'Asia/Manila' });
  await pgBoss.work('panlalawigan.checkDeemedApproved', async () => {
    // Find all pending reviews where transmitted_at + 30 days <= now() AND outcome IS NULL
    const overdueReviews = await repository.findOverduePanlalawiganReviews();
    for (const review of overdueReviews) {
      await repository.updatePanlalawiganReview(review.documentId, {
        outcome: 'deemed_approved',
        response_date: new Date(),
      });
      await documentsService.transitionState(review.documentId, 'completed', SYSTEM_ACTOR_ID,
        'Deemed approved by operation of law -- 30-day review period elapsed without Panlalawigan response');
      eventBus.publish({
        type: 'document.panlalawigan.deemed_approved',
        payload: { documentId: review.documentId, transmittedAt: review.transmitted_at, cityId }
      });
    }
  });
  ```
  SYSTEM_ACTOR_ID is a reserved UUID constant (e.g. '00000000-0000-4000-8000-000000000000') that identifies
  automated system transitions for audit trail purposes.

  Before submitting this PR, confirm each item:
  - [ ] `pnpm typecheck` passes
  - [ ] `documents.initiatePanlalawiganTransmittal` creates a panlalawigan_reviews row with action_deadline = transmittedAt + INTERVAL '30 days'
  - [ ] `documents.logPanlalawiganOutcome` with outcome='valid_in_part' and remarks.length < 10 throws ZodError; with valid remarks succeeds
  - [ ] `documents.logPanlalawiganOutcome` with outcome='deemed_approved' throws FORBIDDEN (only the system timer can set deemed_approved)
  - [ ] Deemed-approved job handler sets outcome='deemed_approved' and transitions document to 'completed' for a review with transmitted_at 31 days ago and outcome=NULL
  - [ ] `pnpm test` passes

---

## TASK-DOCS-015

Phase:          1
Module:         DOCS
Title:          Implement signature recording tRPC procedures (log signature, upload scan image, get signature records)
Prerequisites:  [TASK-DOCS-011]
Deliverables:
  - /apps/server/src/modules/documents/signatures.router.ts — tRPC sub-router with three procedures merged into documentsRouter: documents.logSignature, documents.uploadSignatureImage, documents.getSignatureRecords; signed_by_display_name is denormalized at insert time (never updated after -- legal record requirement); signed_by_employee_id references organization.employees (not iam.users) because officers may sign before having a platform account; signature_image_s3_key stored as a UUID (never original filename)
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `documents.logSignature` inserts a row with correct signature_type, signed_by_employee_id, signed_by_display_name, signed_at, is_wet_ink; signed_by_display_name is NOT updated on subsequent calls (denormalized)
  - [ ] `documents.getSignatureRecords` returns all non-deleted signatures ordered by signed_at ASC
  - [ ] `pnpm test` passes
AI Prompt: |
  You are implementing the signature recording procedures for the DOCS module of the
  Batac City LGU document-management platform.

  ## Business rules
  Legislative documents carry wet-ink signatures from specific officials. The SP Secretariat
  records when each signatory has signed. signed_by_display_name is denormalized at the
  moment of logging because the document is a legal record; the name must reflect who signed
  at the time of signing, regardless of any subsequent account change or deactivation.

  signed_by_employee_id references organization.employees (not iam.users) because:
  - Officers may sign documents before they have a platform login
  - The employee identity (position, display name) is the relevant fact for legislative records

  ## Callable-by roles (I2 Section 9)
  logSignature: dept_approver, sp_secretary, sp_presiding_officer, mayor, brgy_captain
  uploadSignatureImage: same
  getSignatureRecords: records_officer, dept_encoder, dept_approver, sp_secretary, sp_member,
    sp_presiding_officer, mayor, brgy_encoder, brgy_captain, auditor

  ## LogSignatureInputSchema (E3)
  ```typescript
  z.object({
    documentId: UuidSchema,
    signedByEmployeeId: UuidSchema,
    signedByDisplayName: z.string().min(1).max(256).trim(),
    signatureType: SignatureTypeSchema,
    signedAt: TimestampSchema,
    isWetInk: z.boolean().default(true),
    signatureImageS3Key: z.string().uuid().optional(),
  })
  ```

  ## SignatureSelectSchema (E3)
  ```typescript
  z.object({
    id: UuidSchema, documentId: UuidSchema,
    signedByEmployeeId: UuidSchema, signedByDisplayName: z.string(),
    signatureType: SignatureTypeSchema, signedAt: TimestampSchema,
    isWetInk: z.boolean(), signatureImageS3Key: z.string().nullable(),
    createdAt: TimestampSchema,
  })
  ```

  ## documents.uploadSignatureImage (mutation)
  Input: `z.object({ signatureId: z.string().uuid(), s3Key: z.string().uuid() })`
  Business: update signature_image_s3_key on existing signatures row
  s3Key must be UUID (Invariant #5 -- never original filename)
  ABAC: same role set as logSignature; additionally verify caller has access to the
  parent document (ownedByOfficeId in effectiveOfficeIds)

  Before submitting this PR, confirm each item:
  - [ ] `pnpm typecheck` passes
  - [ ] `documents.logSignature` inserts a row with correct signature_type, signed_by_employee_id, signed_by_display_name, signed_at, is_wet_ink; signed_by_display_name is NOT updated on subsequent calls (denormalized)
  - [ ] `documents.getSignatureRecords` returns all non-deleted signatures ordered by signed_at ASC
  - [ ] `pnpm test` passes

---

## TASK-DOCS-016

Phase:          1
Module:         DOCS
Title:          [ABAC][AUDIT] Implement complaints tRPC router -- internal SP Secretariat side (five procedures)
Prerequisites:  [TASK-DOCS-011, TASK-DOCS-007]
Deliverables:
  - /apps/server/src/modules/documents/complaints.router.ts — tRPC router with five procedures registered under the complaints namespace: complaints.createClerkAssisted, complaints.logAndAssign, complaints.enterCommitteeReport, complaints.setOutcome, complaints.listAll; complaint data stored in documents.documents with document_type_code=CITIZEN_COMPLAINT and all complaint-specific fields in metadata JSONB per CitizenComplaintMetadataSchema; [CONFLICT noted in AI Prompt: C1 Part 13 followed over E1 Module 10 schema reference]
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `complaints.createClerkAssisted` inserts documents.documents row with document_type_code=CITIZEN_COMPLAINT, lifecycle_state='draft', metadata.outcome_state='pending_hearing', metadata.access_mode='in_person_clerk'
  - [ ] `complaints.logAndAssign` is callable by sp_secretary ONLY; non-secretary throws FORBIDDEN
  - [ ] `complaints.setOutcome` with outcome='dismissed' updates metadata.outcome_state='dismissed' and triggers notification signal
  - [ ] `complaints.listAll` with sp_member caller returns only complaints where metadata.assigned_office_id IN subject.committeeIds
  - [ ] `pnpm test` passes
AI Prompt: |
  You are implementing the internal-staff complaints tRPC router for the Batac City LGU
  document-management platform.

  ## [CONFLICT] Phase 1 storage (C1 followed over E1 per A1-AGENTS.md §1)
  E1 Module 10 references "Schema: portal.complaints" but C1 Part 13 explicitly states
  no portal schema tables exist in Phase 1. In Phase 1, citizen complaints are stored
  as documents.documents rows with document_type=CITIZEN_COMPLAINT and all complaint-specific
  data in the metadata JSONB column. The portal.complaints table is a Phase 3 addition.

  ## CITIZEN_COMPLAINT metadata JSONB schema (H2 §5 -- enforce at procedure level)
  Fields stored in documents.documents.metadata for complaints:
  - complainant: { name: string (required), address?: string, contactNumber?: string, email?: string, citizenUserId?: string }
  - subjectCategory: string (required)
  - violationType: string | null
  - incidentDetails: { date?: string, time?: string, place?: string, narrative?: string }
  - respondent: { name?: string, tricycleNumber?: string, contactNumber?: string, email?: string, notificationChannel?: string } | null
  - accessMode: 'downloaded_form' | 'digital_form_printed' | 'in_person_clerk' (required)
  - routingDecision: string | null
  - outcomeState: 'pending_hearing' | 'received_seen' | 'dismissed' | 'resolved' (default: 'pending_hearing')

  ## complaints.createClerkAssisted (mutation)
  Input: `z.object({ complainantName: z.string().min(1), complainantAddress: z.string().optional(), complainantContact: z.string().optional(), subjectCategory: z.string().min(1), incidentNarrative: z.string().min(1), respondentName: z.string().optional(), respondentEmail: z.string().email().optional(), respondentPhone: z.string().optional() })`
  Callable by: sp_secretary ONLY (clerk-assisted = in-person access mode)
  Business:
  1. Resolve CITIZEN_COMPLAINT document_type_id from documents.document_types
  2. Set originated_office_id = owned_by_office_id = SP Secretariat office UUID
  3. Insert documents.documents with lifecycle_state='draft' and metadata:
     { complainant: { name: complainantName, ... }, incidentDetails: { narrative: incidentNarrative },
       respondent: respondentName ? { name: respondentName, ... } : null,
       accessMode: 'in_person_clerk', subjectCategory, outcomeState: 'pending_hearing' }
  4. title = 'Citizen Complaint -- ' + complainantName + ' -- ' + new Date().toISOString().slice(0,10)

  ## complaints.logAndAssign (mutation)
  Input: `z.object({ complaintId: z.string().uuid(), assignedOfficeId: z.string().uuid(), routingNotes: z.string().max(512).optional() })`
  Callable by: sp_secretary ONLY (I1 §10.3 -- Secretariat decides routing, no fixed path)
  Business: merge into metadata: { routingDecision: routingNotes, assignedOfficeId }
  Also: transition complaint from 'draft' to 'submitted' state

  ## complaints.enterCommitteeReport (mutation)
  Input: `z.object({ complaintId: z.string().uuid(), reportText: z.string().min(1) })`
  Callable by: sp_secretary, sp_member (committee-scoped)
  ABAC for sp_member: complaint.metadata.assignedOfficeId MUST BE IN subject.committeeIds
  Business: merge into metadata: { committeeReport: reportText, outcomeState: 'received_seen' }

  ## complaints.setOutcome (mutation)
  Input: `z.object({ complaintId: z.string().uuid(), outcome: z.enum(['dismissed','resolved']), notifyRespondentVia: z.enum(['contact_number','email']) })`
  Callable by: sp_secretary ONLY (I1 §10.7)
  Business:
  1. Merge into metadata: { outcomeState: outcome }
  2. Signal Notifications module for respondent notification:
     emit 'complaint.outcome_set' event with notifyRespondentVia channel
     (Notifications module handles actual delivery -- DOCS module emits only the signal)
  3. Emit audit event

  ## complaints.listAll (query)
  Input: PaginationInputSchema + optional outcomeState filter
  Callable by: sp_secretary, sp_presiding_officer, auditor (unconditional); sp_member (committee-scoped)
  ABAC for sp_member: additional WHERE filter: metadata->>'assignedOfficeId' IN (subject.committeeIds)
  Business: SELECT from documents.documents WHERE document_type_code='CITIZEN_COMPLAINT' AND deleted_at IS NULL

  Before submitting this PR, confirm each item:
  - [ ] `pnpm typecheck` passes
  - [ ] `complaints.createClerkAssisted` inserts documents.documents row with document_type_code=CITIZEN_COMPLAINT, lifecycle_state='draft', metadata.outcome_state='pending_hearing', metadata.access_mode='in_person_clerk'
  - [ ] `complaints.logAndAssign` is callable by sp_secretary ONLY; non-secretary throws FORBIDDEN
  - [ ] `complaints.setOutcome` with outcome='dismissed' updates metadata.outcome_state='dismissed' and triggers notification signal
  - [ ] `complaints.listAll` with sp_member caller returns only complaints where metadata.assigned_office_id IN subject.committeeIds
  - [ ] `pnpm test` passes

---

## TASK-DOCS-017

Phase:          1
Module:         DOCS
Title:          [ABAC][AUDIT] Implement document requests tRPC router -- internal SP Secretariat side (six procedures)
Prerequisites:  [TASK-DOCS-011, TASK-DOCS-012, TASK-DOCS-007]
Deliverables:
  - /apps/server/src/modules/documents/document-requests.router.ts — tRPC router with six procedures: documentRequests.createClerkAssisted, documentRequests.generatePrintableForm, documentRequests.approveAsPresidingOfficer, documentRequests.approveAsSecretary, documentRequests.releaseCopy, documentRequests.listAll; document requests stored as documents.documents rows with document_type_code=DOCUMENT_REQUEST_FORM; dual approval (Vice Mayor + SP Secretary) modeled as two sequential workflow approval steps per ADR-EVT-001 (NOT as JSONB flags -- those were removed); payment optional per Q-D04 and does NOT block release in Phase 1; [CONFLICT noted: C1 Part 13 followed over E1 Module 11 schema reference]
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `documentRequests.createClerkAssisted` inserts documents.documents row with document_type_code=DOCUMENT_REQUEST_FORM, lifecycle_state='draft', metadata.access_mode='in_person_clerk'
  - [ ] `documentRequests.approveAsPresidingOfficer` callable by sp_presiding_officer ONLY; others throw FORBIDDEN
  - [ ] `documentRequests.approveAsSecretary` checks that presiding officer has approved via workflow step state; throws PRECONDITION_FAILED if VM approval not yet recorded
  - [ ] `documentRequests.releaseCopy` records orNumber if provided; marks request released; does NOT block on payment (Q-D04)
  - [ ] `pnpm test` passes
AI Prompt: |
  You are implementing the internal-staff document requests tRPC router for the Batac City
  LGU document-management platform.

  ## [CONFLICT] Phase 1 storage (C1 followed over E1 per A1-AGENTS.md §1)
  E1 Module 11 references "Schema: portal.citizen_requests" but C1 Part 13 explicitly states
  no portal schema tables exist in Phase 1. In Phase 1, document requests are stored as
  documents.documents rows with document_type=DOCUMENT_REQUEST_FORM and all request-specific
  data in the metadata JSONB column. portal.citizen_requests is a Phase 3 addition.

  ## ADR-EVT-001 (June 2026) -- dual approval via Workflow steps (NOT JSONB flags)
  The dual approval requirement (Vice Mayor + SP Secretary) is modeled as two sequential
  'approval' step_instances in the Workflow Engine. The JSONB fields approval_status,
  approved_by_vm, and approved_by_sp_secretary were REMOVED from the metadata schema.
  In Phase 1 (before WF module is live): stub approval state tracking using metadata JSONB
  fields as a temporary measure, with TODO comments to replace with workflow step queries:
  `// TODO(WF-INTEGRATION): replace metadata.vm_approved check with workflow.getStepState(...) when TASK-WF-NNN completes`

  ## DOCUMENT_REQUEST_FORM metadata JSONB schema (H2 §6)
  Fields in documents.documents.metadata for document requests:
  - requester: { name: string (required), agencyOrOrganization?: string, email?: string, contactNumber?: string, idTypePresented?: string, citizenUserId?: string }
  - documentsRequested: Array<{ documentTitle: string, documentId?: string, documentTypeLabel?: string, documentNumber?: string, numberOfPages?: number }> (min 1 item)
  - purpose: string | null
  - accessMode: 'downloaded_form' | 'digital_form_printed' | 'in_person_clerk'
  - payment: { orNumber?: string, collectingOfficer?: string, amountPaid?: number, paymentDate?: string } | null
  - notificationChannel: 'contact_number' | 'email' | null

  ## documentRequests.createClerkAssisted (mutation)
  Input: `z.object({ requesterName: z.string().min(1), requesterContact: z.string().optional(), documentsRequested: z.array(z.object({ documentTitle: z.string().min(1), documentNumber: z.string().optional() })).min(1), purpose: z.string().max(512).optional() })`
  Callable by: sp_secretary ONLY
  Business:
  1. Resolve DOCUMENT_REQUEST_FORM document_type_id
  2. Insert documents.documents with lifecycle_state='draft' and metadata:
     { requester: { name: requesterName, contactNumber: requesterContact },
       documentsRequested, purpose, accessMode: 'in_person_clerk' }
  3. title = 'Document Request -- ' + requesterName

  ## documentRequests.generatePrintableForm (query)
  Input: `z.object({ requestId: z.string().uuid() })`
  Output: structured data for the printable form (not a PDF -- PDF generation is a separate concern)
  Callable by: sp_secretary
  Business: return the full request metadata formatted for the staff to print

  ## documentRequests.approveAsPresidingOfficer (mutation) [Vice Mayor]
  Input: `z.object({ requestId: z.string().uuid() })`
  Callable by: sp_presiding_officer ONLY (Vice Mayor acts as presiding officer per LGC)
  Business (Phase 1 stub):
  1. Verify lifecycle_state is in appropriate pre-release state
  2. Merge into metadata: { vm_approved: true, vm_approved_at: new Date().toISOString(), vm_approved_by: subject.userId }
  3. Emit audit event
  TODO(WF-INTEGRATION): replace with workflow.submitStepAction for the VM approval step

  ## documentRequests.approveAsSecretary (mutation)
  Input: `z.object({ requestId: z.string().uuid() })`
  Callable by: sp_secretary ONLY
  Business (Phase 1 stub):
  1. Verify metadata.vm_approved = true; if not: throw PRECONDITION_FAILED 'Presiding officer approval required first'
  2. Merge into metadata: { sp_approved: true, sp_approved_at: new Date().toISOString(), sp_approved_by: subject.userId }
  3. Transition lifecycle_state to 'completed'
  4. Emit audit event
  TODO(WF-INTEGRATION): replace with workflow.submitStepAction for the SP Secretary approval step

  ## documentRequests.releaseCopy (mutation)
  Input: `z.object({ requestId: z.string().uuid(), orNumber: z.string().max(64).optional(), collectingOfficer: z.string().max(256).optional(), amountPaid: z.number().positive().optional() })`
  Callable by: sp_secretary
  Business:
  1. Request must be in lifecycle_state='completed' (both approvals done)
  2. If orNumber provided: merge into metadata.payment: { orNumber, collectingOfficer, amountPaid, paymentDate: today }
  3. NOTE: payment is OPTIONAL and does NOT block release (Q-D04 -- payment system deferred to Phase 2)
  4. Transition lifecycle_state to 'released'
  5. Emit notification signal for requester pickup notification

  ## documentRequests.listAll (query)
  Input: PaginationInputSchema + optional filter by requester name or document number
  Callable by: sp_secretary, sp_presiding_officer, records_officer, auditor
  Business: SELECT from documents.documents WHERE document_type_code='DOCUMENT_REQUEST_FORM' AND deleted_at IS NULL

  Before submitting this PR, confirm each item:
  - [ ] `pnpm typecheck` passes
  - [ ] `documentRequests.createClerkAssisted` inserts documents.documents row with document_type_code=DOCUMENT_REQUEST_FORM, lifecycle_state='draft', metadata.access_mode='in_person_clerk'
  - [ ] `documentRequests.approveAsPresidingOfficer` callable by sp_presiding_officer ONLY; others throw FORBIDDEN
  - [ ] `documentRequests.approveAsSecretary` checks that presiding officer has approved via workflow step state; throws PRECONDITION_FAILED if VM approval not yet recorded
  - [ ] `documentRequests.releaseCopy` records orNumber if provided; marks request released; does NOT block on payment (Q-D04)
  - [ ] `pnpm test` passes

---

## TASK-DOCS-018

Phase:          1
Module:         DOCS
Title:          [ABAC][AUDIT] Implement DESIGNATION document logging handler (atomic delegation grant creation on document log)
Prerequisites:  [TASK-DOCS-011, TASK-ORG-004]
Deliverables:
  - /apps/server/src/modules/documents/designation.handler.ts — DesignationHandler class with method handleDesignationLogged(documentId, metadata, actorId) called after a DESIGNATION document passes through documents.submit; atomically creates an organization.delegation_grants row via the ORG Published API (ORG.createDelegationGrant) and writes the resulting delegationGrantId back into the DESIGNATION document's metadata; the handler is called as an async side effect in documents.submit (guarded by documentTypeCode='DESIGNATION') with a compensating rollback if the ORG Published API call fails; also handles DESIGNATION document cancellation (calls ORG.revokeDelegationGrant when DESIGNATION document is cancelled)
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] Submitting a DESIGNATION document calls ORG Published API createDelegationGrant with the correct effectiveFrom, effectiveUntil, delegatingAuthorityEmployeeId, designatedPersonEmployeeId, designatedOfficeId, designatedPositionId, and scopeDescription from the document metadata
  - [ ] If ORG.createDelegationGrant throws, the transaction rolls back and the DESIGNATION document remains in 'draft' state
  - [ ] The delegationGrantId returned by ORG.createDelegationGrant is stored back into documents.documents.metadata.delegationGrantId
  - [ ] Cancelling a DESIGNATION document in states (submitted, in_workflow) calls ORG.revokeDelegationGrant with the stored delegationGrantId
  - [ ] `pnpm test` passes
AI Prompt: |
  You are implementing the DESIGNATION document logging handler for the DOCS module of
  the Batac City LGU document-management platform. This handler creates an atomic link
  between a DESIGNATION document and an organization delegation grant.

  ## Business context (H2 §8 + ORG module Published API)
  When the SP Secretary logs a DESIGNATION document (submits it to the SP workflow),
  the system must atomically create a delegation grant in the ORG module. This grant
  temporarily transfers authority from one employee to another (e.g., Mayor delegates
  powers to a VP during travel). The delegation grant is the authoritative record that
  affects JWT-resolved effective_office_ids and ABAC policy evaluation.

  ## DESIGNATION metadata schema (DesignationMetadataSchema from TASK-DOCS-003)
  The handler reads from documents.documents.metadata:
  - delegatingAuthorityEmployeeId: UUID
  - delegatingAuthorityDisplayName: string
  - designatedPersonEmployeeId: UUID
  - designatedPersonDisplayName: string
  - designatedOfficeId: UUID
  - designatedPositionId: UUID
  - scopeDescription: string
  - legalBasis: string (optional)
  - effectiveFrom: date string
  - effectiveUntil: date string

  ## Atomicity requirement (B2 Module 3 -- cross-module transaction boundary)
  The DESIGNATION document submit and the delegation grant creation must succeed together
  or fail together. Since they span two modules (DOCS and ORG) with separate tables,
  implement as a two-phase compensating transaction:
  1. Start DB transaction
  2. Call documents.submit (lifecycle_state: draft -> submitted)
  3. Call ORG.createDelegationGrant via Published API
  4. Write returned delegationGrantId back into documents.metadata.delegationGrantId
  5. Commit
  If step 3 or 4 fails: roll back the DB transaction (reverts the lifecycle state change)
  Note: ORG.createDelegationGrant is also a DB write; if it fails, the whole transaction rolls back.
  This works if both modules share the same DB connection/transaction scope (which they do in
  this monolith -- pass the Drizzle transaction object through the ORG Published API call).

  ## Integration point with documents.submit
  In documents.router.ts (documents.submit procedure), add after the main submit logic:
  ```typescript
  if (documentType.code === 'DESIGNATION') {
    await ctx.designationHandler.handleDesignationLogged(documentId, document.metadata, ctx.subject.userId);
  }
  ```

  ## Cancellation handling
  In documents.cancel procedure (after the general cancel logic), add:
  ```typescript
  if (documentType.code === 'DESIGNATION' && document.metadata?.delegationGrantId) {
    await ctx.orgService.revokeDelegationGrant(
      document.metadata.delegationGrantId,
      ctx.subject.userId,
      `DESIGNATION document cancelled: ${input.reason}`
    );
  }
  ```

  ## ORG Published API method signatures (TASK-ORG-004 deliverable)
  ```typescript
  // Call via ctx.orgService (injected into tRPC context via Fastify plugin)
  ctx.orgService.createDelegationGrant({
    delegatingAuthorityEmployeeId: string,
    designatedPersonEmployeeId: string,
    designatedOfficeId: string,
    designatedPositionId: string,
    scopeDescription: string,
    legalBasis: string | undefined,
    effectiveFrom: Date,
    effectiveUntil: Date,
    createdBy: string,
    cityId: string,
  }): Promise<{ delegationGrantId: string }>

  ctx.orgService.revokeDelegationGrant(grantId: string, revokedBy: string, reason: string): Promise<void>
  ```

  Before submitting this PR, confirm each item:
  - [ ] `pnpm typecheck` passes
  - [ ] Submitting a DESIGNATION document calls ORG Published API createDelegationGrant with the correct effectiveFrom, effectiveUntil, delegatingAuthorityEmployeeId, designatedPersonEmployeeId, designatedOfficeId, designatedPositionId, and scopeDescription from the document metadata
  - [ ] If ORG.createDelegationGrant throws, the transaction rolls back and the DESIGNATION document remains in 'draft' state
  - [ ] The delegationGrantId returned by ORG.createDelegationGrant is stored back into documents.documents.metadata.delegationGrantId
  - [ ] Cancelling a DESIGNATION document in states (submitted, in_workflow) calls ORG.revokeDelegationGrant with the stored delegationGrantId
  - [ ] `pnpm test` passes

---

## TASK-DOCS-019

Phase:          1
Module:         DOCS
Title:          Wire DOCS Fastify plugin and inject Published API into dependent module stubs
Prerequisites:  [TASK-DOCS-006, TASK-DOCS-009, TASK-DOCS-010, TASK-DOCS-014, TASK-DOCS-015, TASK-DOCS-016, TASK-DOCS-017, TASK-DOCS-018, TASK-ORG-010]
Deliverables:
  - /apps/server/src/modules/documents/documents.plugin.ts — production Fastify plugin that: (1) instantiates DocumentsRepository, NumberingService, OcrService, DocumentPolicyGuard, DesignationHandler and all sub-routers; (2) calls pgBoss.schedule for the panlalawigan.checkDeemedApproved nightly job; (3) merges all sub-routers (main documentsRouter, panlalawigan, signatures, complaints, documentRequests) under a single root documentsAppRouter using tRPC's createCallerFactory; (4) registers fastify.documentsService (PublicAPI) and fastify.documentsTrpcRouter on the Fastify instance; (5) wires the OcrProvider stub (with a TODO for the production provider); (6) emits a 'documents.module.ready' log line at plugin ready
  - /apps/server/src/app.ts (edit) — registers documents plugin AFTER organization plugin and BEFORE workflow/tracking/notifications plugins; passes the ORG Published API to the documents plugin for DesignationHandler and cross-module event consumers
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] `pnpm dev` starts without error; log line 'documents.module.ready' appears
  - [ ] `curl -X POST .../trpc/documents.create` with valid auth returns HTTP 200 (or 401 if auth missing -- never 500)
  - [ ] `curl .../trpc/documents.search?input=...` returns HTTP 200 with items array
  - [ ] `pnpm test` passes
AI Prompt: |
  You are wiring the complete DOCS module as a production Fastify plugin for the Batac
  City LGU document-management platform. This is the integration task that connects all
  DOCS module components.

  ## Plugin structure
  ```typescript
  import type { FastifyPluginAsync } from 'fastify';
  import fp from 'fastify-plugin';

  const documentsPlugin: FastifyPluginAsync = async (fastify) => {
    // 1. Instantiate infrastructure
    const repository = new DocumentsRepository(fastify.db);
    const policyGuard = new DocumentPolicyGuard();
    const numberingService = new NumberingService(repository, fastify.logger);
    const ocrService = new OcrService(
      new StubOcrProvider(),  // TODO(OCR-PROVIDER): replace when tech-stack.md library decision made
      fastify.pgBoss,
      repository,
      fastify.logger
    );
    const designationHandler = new DesignationHandler(repository, fastify.orgService);

    // 2. Instantiate service (Published API)
    const documentsService = createDocumentsService(repository, numberingService, fastify.s3Client, fastify.eventBus);

    // 3. Build merged tRPC router
    const documentsRouter = createDocumentsRouter({ repository, policyGuard, documentsService, numberingService, ocrService, designationHandler, orgService: fastify.orgService });
    const panlalawiganRouter = createPanlalawiganRouter({ repository, documentsService, numberingService });
    const signaturesRouter = createSignaturesRouter({ repository });
    const complaintsRouter = createComplaintsRouter({ repository, documentsService });
    const documentRequestsRouter = createDocumentRequestsRouter({ repository, documentsService });

    const documentsAppRouter = t.mergeRouters(documentsRouter, panlalawiganRouter, signaturesRouter, complaintsRouter, documentRequestsRouter);

    // 4. Register pgboss scheduled jobs
    await fastify.pgBoss.schedule('panlalawigan.checkDeemedApproved', '0 6 * * *', {}, { timezone: 'Asia/Manila' });
    await fastify.pgBoss.work('panlalawigan.checkDeemedApproved', createPanlalawiganDeemedApprovedHandler({ repository, documentsService, eventBus: fastify.eventBus, logger: fastify.logger }));

    // 5. Decorate Fastify instance
    fastify.decorate('documentsService', documentsService);
    fastify.decorate('documentsTrpcRouter', documentsAppRouter);

    fastify.log.info('documents.module.ready');
  };

  export default fp(documentsPlugin, {
    name: 'documents-plugin',
    dependencies: ['organization-plugin', 'infra-plugin'],
  });
  ```

  ## Registration order in app.ts
  ```typescript
  // Existing:
  await app.register(iamPlugin);
  await app.register(organizationPlugin);
  // Add:
  await app.register(documentsPlugin);
  // Future (these consume documents.documentsService):
  // await app.register(workflowPlugin);
  // await app.register(trackingPlugin);
  // await app.register(notificationsPlugin);
  ```

  ## Event consumers registered in the plugin
  The DOCS module emits events; it does NOT consume events from other modules in Phase 1.
  Future event consumers (added when those modules ship):
  - 'workflow.step.completed' -> documents service updates state via transitionState Published API
  Register these as TODO stubs in the plugin body:
  `// TODO(WF-INTEGRATION): fastify.eventBus.subscribe('workflow.step.completed', ...)`

  ## tRPC router merging
  All sub-routers use the same tRPC instance (t from apps/server/src/trpc.ts). Merge using
  t.mergeRouters(...) so they all appear under the same router namespace.
  The merged router is registered on the Fastify tRPC handler via the existing router
  registration pattern in apps/server/src/trpc-handler.ts.

  Before submitting this PR, confirm each item:
  - [ ] `pnpm typecheck` passes
  - [ ] `pnpm dev` starts without error; log line 'documents.module.ready' appears
  - [ ] `curl -X POST .../trpc/documents.create` with valid auth returns HTTP 200 (or 401 if auth missing -- never 500)
  - [ ] `curl .../trpc/documents.search?input=...` returns HTTP 200 with items array
  - [ ] `pnpm test` passes

---

## Module Summary -- DOCS

**Task count:** 19 (TASK-DOCS-001 through TASK-DOCS-019)
**Estimated range from skeleton:** 14-22 tasks. Actual: 19. Within range.
**Wave:** D (depends on ORG; precedes WORKFLOW, TRACKING, NOTIFICATIONS, PORTAL)

### Coverage map

| Source section | Covered by task(s) |
|---|---|
| C1 Part 5 -- documents schema (10 tables, triggers, functions) | TASK-DOCS-001 |
| C1 Part 12 -- documents schema grants + RLS | TASK-DOCS-001 |
| H2 -- 8 document type catalog entries (Phase 1 + 1B) | TASK-DOCS-007 |
| H2 -- 13 JSONB metadata schemas (document-metadata.ts) | TASK-DOCS-003 |
| H3 -- 11 number series + 2026 sequences | TASK-DOCS-008 |
| E1 Module 3.1 -- general CRUD (8 procedures) | TASK-DOCS-011 |
| E1 Module 3.2 + 3.4 -- SP workflow specifics (8 procedures) | TASK-DOCS-012 |
| E1 Module 3.3 -- file/version/attachment (9 procedures) | TASK-DOCS-013 |
| E1 Module 10 -- complaints router (5 procedures) | TASK-DOCS-016 |
| E1 Module 11 -- document requests router (6 procedures) | TASK-DOCS-017 |
| E3 Parts 4-5 -- shared Zod schemas | TASK-DOCS-003 |
| B2 Module 3 -- Published API (5 methods) | TASK-DOCS-006 |
| B2 Module 3 -- domain events (created, state_changed, number_assigned) | TASK-DOCS-006, TASK-DOCS-012 |
| I1 §§3-4, §14, §17 -- ABAC policy guard | TASK-DOCS-009 |
| I1 D-ABAC-02 -- classification_allowlists table | TASK-DOCS-001 |
| Numbering service (fn wrapper, preliminary/final/control) | TASK-DOCS-005 |
| Panlalawigan review procedures + deemed-approved timer | TASK-DOCS-014 |
| Signature recording procedures | TASK-DOCS-015 |
| OCR service wrapper + OcrProvider interface | TASK-DOCS-010 |
| DESIGNATION handler (cross-module atomic grant creation) | TASK-DOCS-018 |
| Module wiring + sub-router merge + pgboss job registration | TASK-DOCS-019 |

### Cross-module dependency map

| Dependency | Used by | Task |
|---|---|---|
| TASK-ORG-001 (organization schema) | documents.documents FKs to organization tables | TASK-DOCS-001 |
| TASK-ORG-002 (ORG scaffold + OfficeSummarySchema) | OfficeSummarySchema in DocumentSelectSchema | TASK-DOCS-003 |
| TASK-ORG-004 (ORG Published API) | DesignationHandler calls createDelegationGrant | TASK-DOCS-018 |
| TASK-ORG-009 (office seed) | authority_office_id in number_series seed | TASK-DOCS-008 |
| TASK-ORG-010 (ORG wire plugin) | fastify.orgService at documents plugin init | TASK-DOCS-019 |
| TASK-IAM-004 (IAM PolicyGuard + PolicyEvaluator) | SubjectContext type + ABAC base pattern | TASK-DOCS-009 |
| TASK-INFRA-005 (env validation) | S3 + OCR env vars | TASK-DOCS-001, TASK-DOCS-010 |
| TASK-INFRA-006 (fn_set_updated_at) | all DOCS tables use updated_at trigger | TASK-DOCS-001 |
| INFRA pgboss task (ID unknown) | OcrService, PanlalawiganTimer | TASK-DOCS-010, TASK-DOCS-014 |

### Unresolved INFRA dependencies
- **pgboss initialization task**: The task ID (TASK-INFRA-NNN) for the pgboss job system
  initialization is not in the TASK-ORG list supplied for this pass. This affects
  TASK-DOCS-010 (OcrService) and TASK-DOCS-014 (Panlalawigan timer). Resolve at
  integration pass by loading the INFRA task list and backfilling the Prerequisites fields.

### Conflicts flagged (per A1-AGENTS.md §1)

**[CONFLICT-DOCS-01] E1 Module 10 / 11 schema reference vs C1 Part 13**
- E1 Module 10 declares "Schema: portal.complaints"; E1 Module 11 declares "Schema: portal.citizen_requests"
- C1 Part 13 explicitly states: "No tables are created in [portal] in Phase 1 DDL"
- **Resolution applied:** C1 Part 13 followed as the more authoritative pre-dev source.
  In Phase 1, CITIZEN_COMPLAINT and DOCUMENT_REQUEST_FORM records are stored in
  documents.documents with JSONB metadata. portal.complaints and portal.citizen_requests
  are Phase 3 additions when the full PORTAL module ships.
- **Action required:** Update E1 Module 10/11 to clarify Phase 1 vs Phase 3 storage model.

### Spec gaps flagged (per A1-AGENTS.md §8)

**[SPEC-GAP-DOCS-01] OCR library choice open**
- tech-stack.md lists the OCR library as an open item.
- TASK-DOCS-010 stubs the OcrProvider interface to be library-agnostic.
- **Action required:** When the library is chosen, implement the production OcrProvider
  class (e.g., TesseractOcrProvider, AwsTextractOcrProvider) and inject it in
  TASK-DOCS-019 (plugin wiring). No other tasks need changes.

**[SPEC-GAP-DOCS-02] DESIGNATION document type activation criteria**
- H2 seeds DESIGNATION as is_active=false (Phase 1B).
- The trigger for Phase 1B activation (which workflow template publish event, and who
  runs the activation migration) is not defined in any loaded document.
- **Action required:** Define the Phase 1B activation procedure before the DESIGNATION
  workflow is published. Likely a separate seed migration that sets is_active=true
  on the DESIGNATION document_type row and activates the 'designation' number_series.

**[SPEC-GAP-DOCS-03] retention_schedule_id placeholder UUIDs**
- TASK-DOCS-007 seeds document_types with placeholder retention_schedule_id UUIDs
  because records.retention_schedules is a Phase 1 stub table (REC module is Wave F).
- **Action required:** After TASK-REC-NNN (retention schedules seed) runs, update the
  document_types seed to replace placeholder UUIDs with the actual schedule UUIDs.
  The DB CHECK constraint ck_document_types_retention_before_activation prevents
  activating a type with an invalid schedule UUID, so this is safe to defer.

**[SPEC-GAP-DOCS-04] classification_allowlists initial seed not defined**
- I1 Gate 4 requires classification_allowlists to be populated for Confidential/Restricted
  document types. No loaded document defines the initial allowlist configuration.
- In Phase 1, all eight seeded document_types have classification_default='internal'
  (none are Confidential or Restricted), so the initial allowlist is empty.
- **Action required:** When any Confidential or Restricted document type is activated
  (likely in a later wave), a corresponding allowlist seed must be created. Document
  this requirement in the Platform Admin onboarding checklist.

### Known cross-document correction

**IAM forward reference:** the IAM task list anticipated a task numbered TASK-ORG-014 for
the DOCS module wiring. The actual wiring task is TASK-DOCS-019 (not ORG-014). This has
no impact on DOCS task dependencies but should be noted for IAM module task list reconciliation.

### Downstream consumers of DOCS Published API

These modules will call DOCS Published API methods listed in B2 Module 3:
- **WORKFLOW** (Wave E): calls transitionState, assignFinalNumber, getDocumentById
- **TRACKING** (Wave E): calls getDocumentById for QR routing history
- **RECORDS** (Wave F): calls getAttachmentRefs for archival
- **NOTIFICATIONS** (Wave E): subscribes to document.state_changed events
- **PORTAL** (Wave G): calls getDocumentById, getDocumentType for citizen-facing display

Until each dependent module is live, their event subscriptions are registered as TODO stubs
in TASK-DOCS-019 (plugin wiring).
