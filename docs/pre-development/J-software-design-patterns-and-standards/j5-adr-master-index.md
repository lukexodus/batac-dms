# Batac City LGU Platform — ADR Master Index

**Status:** Pre-Development Baseline **Project Phase:** Pre-Development — Iteration 3 (Post-Interview 2 + Developer Decisions Resolved) **Last Updated:** June 2026 **Audience:** Development team; LGU IT Office (post-delivery reference)

## Table of Contents

- [L11–L90] ADR Index — Central master index linking to all architectural decisions across the platform.

---

## ADR Index

| ID | Title | Domain | Link |
|---|---|---|---|
| ADR-API-001 | Event Bus Implementation | Module Boundaries / API (B2) | [View](../B-architecture-documents/b2-module-boundary-and-internal-api-contracts-adrs/ADR-API-001-event-bus-implementation.md) |
| ADR-API-002 | Audit Log Design | Module Boundaries / API (B2) | [View](../B-architecture-documents/b2-module-boundary-and-internal-api-contracts-adrs/ADR-API-002-audit-log-design.md) |
| ADR-API-003 | Secretariat Decision Entry Point | Module Boundaries / API (B2) | [View](../B-architecture-documents/b2-module-boundary-and-internal-api-contracts-adrs/ADR-API-003-secretariat-decision-entry-point.md) |
| ADR-API-004 | Respondent Notice Channel | Module Boundaries / API (B2) | [View](../B-architecture-documents/b2-module-boundary-and-internal-api-contracts-adrs/ADR-API-004-respondent-notice-channel.md) |
| ADR-API-005 | Phase 1 FTS Column Ownership | Module Boundaries / API (B2) | [View](../B-architecture-documents/b2-module-boundary-and-internal-api-contracts-adrs/ADR-API-005-phase1-fts-column-ownership.md) |
| ADR-API-006 | Published API Versioning and Deprecation | Module Boundaries / API (B2) | [View](../B-architecture-documents/b2-module-boundary-and-internal-api-contracts-adrs/ADR-API-006-published-api-versioning.md) |
| ADR-API-007 | Phase 1 Classification Source | Module Boundaries / API (B2) | [View](../B-architecture-documents/b2-module-boundary-and-internal-api-contracts-adrs/ADR-API-007-phase1-classification-source.md) |
| ADR-AUTH-001 | JWT Signing Algorithm | Authentication / Authorization (B5) | [View](../B-architecture-documents/b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-001-jwt-signing-algorithm.md) |
| ADR-AUTH-002 | Argon2id Parameters | Authentication / Authorization (B5) | [View](../B-architecture-documents/b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-002-argon2id-parameters.md) |
| ADR-AUTH-003 | Refresh Token Lifetime | Authentication / Authorization (B5) | [View](../B-architecture-documents/b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-003-refresh-token-lifetime.md) |
| ADR-AUTH-004 | Refresh Token Hash Algorithm | Authentication / Authorization (B5) | [View](../B-architecture-documents/b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-004-refresh-token-hash-algorithm.md) |
| ADR-AUTH-006 | delegation_grant.scope` Field Schema | Authentication / Authorization (B5) | [View](../B-architecture-documents/b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-006-delegation_grant.scope-field-schema.md) |
| ADR-AUTH-007 | Account Lockout Policy on Repeated Login Failures | Authentication / Authorization (B5) | [View](../B-architecture-documents/b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-007-account-lockout-policy-on-repeated-login-failures.md) |
| ADR-AUTH-008 | External TSA Provider for Audit Log Timestamps | Authentication / Authorization (B5) | [View](../B-architecture-documents/b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-008-external-tsa-provider-for-audit-log-timestamps.md) |
| ADR-AUTH-009 | RLS Policy Expression for Cross-Office Read Grants | Authentication / Authorization (B5) | [View](../B-architecture-documents/b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-009-rls-policy-expression-for-cross-office-read-grants.md) |
| ADR-AUTH-010 | Session `locked_at` Behavior When Access Token Expires While Locked | Authentication / Authorization (B5) | [View](../B-architecture-documents/b5-authentication-and-authorization-architecture-adrs/ADR-AUTH-010-session-locked_at-behavior-when-access-token-expires-while-locked.md) |
| ADR-DB-001 | panlalawigan_review_log` Entity Classification | Database (C1) | [View](../C-database/c1-full-database-schema-ddl-adrs/ADR-DB-001-panlalawigan-review-log-entity-classification.md) |
| ADR-EVT-001 | Document Request Form Approval Modeling | Domain Events (B3) | [View](../B-architecture-documents/b3-internal-domain-event-catalog-adrs/ADR-EVT-001-document-request-form-approval-modeling.md) |
| ADR-GEN-001 | Modular Monolith over Microservices | General Architecture (J5) | [View](j5-initial-adrs/ADR-GEN-001-modular-monolith-over-microservices.md) |
| ADR-GEN-002 | Custom Workflow Engine over Off-the-Shelf BPM Solutions | General Architecture (J5) | [View](j5-initial-adrs/ADR-GEN-002-custom-workflow-engine-over-off-the-shelf-bpm-solutions.md) |
| ADR-GEN-003 | PostgreSQL as the Sole Database Engine | General Architecture (J5) | [View](j5-initial-adrs/ADR-GEN-003-postgresql-as-the-sole-database-engine.md) |
| ADR-GEN-004 | Pessimistic Locking for Document Editing | General Architecture (J5) | [View](j5-initial-adrs/ADR-GEN-004-pessimistic-locking-for-document-editing.md) |
| ADR-GEN-005 | Multi-Referral Step Type for Committee Referral (Option B) | General Architecture (J5) | [View](j5-initial-adrs/ADR-GEN-005-multi-referral-step-type-for-committee-referral-option-b.md) |
| ADR-GEN-006 | Parallel Split/Join Engine Deferred to Phase 2 | General Architecture (J5) | [View](j5-initial-adrs/ADR-GEN-006-parallel-split-join-engine-deferred-to-phase-2.md) |
| ADR-GEN-007 | QR Tracking Number Assigned at Secretariat Logging, Before Preliminary Series Number | General Architecture (J5) | [View](j5-initial-adrs/ADR-GEN-007-qr-tracking-number-assigned-at-secretariat-logging-before-preliminary-series-number.md) |
| ADR-GEN-008 | No-Deletion Invariant with Soft-Delete on Every Table | General Architecture (J5) | [View](j5-initial-adrs/ADR-GEN-008-no-deletion-invariant-with-soft-delete-on-every-table.md) |
| ADR-GEN-009 | Two-Stage Preliminary/Final Document Numbering | General Architecture (J5) | [View](j5-initial-adrs/ADR-GEN-009-two-stage-preliminary-final-document-numbering.md) |
| ADR-GEN-010 | sp.batac.gov.ph Coexistence Without Mandatory Migration | General Architecture (J5) | [View](j5-initial-adrs/ADR-GEN-010-sp.batac.gov.ph-coexistence-without-mandatory-migration.md) |
| ADR-GEN-011 | No Existing Digital QR System Assumed for Letters and Memos | General Architecture (J5) | [View](j5-initial-adrs/ADR-GEN-011-no-existing-digital-qr-system-assumed-for-letters-and-memos.md) |
| ADR-REQ-001 | Authentication and Non-Repudiation | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#111-authentication-and-non-repudiation) |
| ADR-REQ-002 | Infrastructure and Cloud Agnosticism | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#112-infrastructure-and-cloud-agnosticism) |
| ADR-REQ-003 | Workflow Engine | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#113-workflow-engine) |
| ADR-REQ-004 | Document Management | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#114-document-management) |
| ADR-REQ-005 | Document Numbering | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#115-document-numbering) |
| ADR-REQ-006 | Document Tracking (DTS) | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#116-document-tracking-dts) |
| ADR-REQ-007 | Records Management | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#117-records-management) |
| ADR-REQ-008 | Authorization Model | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#118-authorization-model) |
| ADR-REQ-009 | Database Conventions (Invariants) | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#119-database-conventions-invariants) |
| ADR-REQ-010 | Object Storage | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#1110-object-storage) |
| ADR-REQ-011 | Audit Log | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#1111-audit-log) |
| ADR-REQ-012 | Concurrency and Locking | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#1112-concurrency-and-locking) |
| ADR-REQ-013 | Delegation and Acting Authority | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#1113-delegation-and-acting-authority) |
| ADR-REQ-014 | Disaster Recovery and Backup | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#1114-disaster-recovery-and-backup) |
| ADR-REQ-015 | Offline and Connectivity | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#1115-offline-and-connectivity) |
| ADR-REQ-016 | Mobile and Device Support | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#1116-mobile-and-device-support) |
| ADR-REQ-017 | Session Management | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#1117-session-management) |
| ADR-REQ-018 | Citizen Portal and Identity | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#1118-citizen-portal-and-identity) |
| ADR-REQ-019 | Compliance | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#1119-compliance) |
| ADR-REQ-020 | Post-Delivery and Governance | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#1120-post-delivery-and-governance) |
| ADR-REQ-021 | Extensibility Tiers | Key Design Decisions (Consolidated Ref) | [View](../../requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md#1121-extensibility-tiers) |
| ADR-TST-001 | Certified Urgent Revocation (K2 §21, item 1) | Testing (K2) | [View](../K-testing/k2-workflow-engine-test-suite-design-adrs/ADR-TST-001-certified-urgent-revocation-k2-§21-item-1.md) |
| ADR-TST-002 | OPERATIVE_IN_ITS_ENTIRETY` on a Non-Appropriation-Ordinance Instance (K2 §21, item 2) | Testing (K2) | [View](../K-testing/k2-workflow-engine-test-suite-design-adrs/ADR-TST-002-operative_in_its_entirety-on-a-non-appropriation-ordinance-instance-k2-§21-item-2.md) |
| ADR-TST-003 | COMMITTEE_CHAIR` Assignee Resolution (K2 §21, item 3) | Testing (K2) | [View](../K-testing/k2-workflow-engine-test-suite-design-adrs/ADR-TST-003-committee_chair-assignee-resolution-k2-§21-item-3.md) |
| ADR-TST-004 | Encoder ≠ Final Approver: Which Step Carries `is_final_approval = true` (K2 §21, item 4) | Testing (K2) | [View](../K-testing/k2-workflow-engine-test-suite-design-adrs/ADR-TST-004-encoder-≠-final-approver-which-step-carries-is_final_approval-=-true-k2-§21-item-4.md) |
| ADR-TST-005 | workflow_events` Immutability Test (K2 §21, item 5) | Testing (K2) | [View](../K-testing/k2-workflow-engine-test-suite-design-adrs/ADR-TST-005-workflow_events-immutability-test-k2-§21-item-5.md) |
| ADR-TST-006 | MISSING_LAPSE_TRANSITION` Publish-Time Validation Test (K2 §21, item 6) | Testing (K2) | [View](../K-testing/k2-workflow-engine-test-suite-design-adrs/ADR-TST-006-missing_lapse_transition-publish-time-validation-test-k2-§21-item-6.md) |
| ADR-TST-007 | MISSING_OUTCOME_TRANSITION` Publish-Time Validation Test (K2 §21, item 7) | Testing (K2) | [View](../K-testing/k2-workflow-engine-test-suite-design-adrs/ADR-TST-007-missing_outcome_transition-publish-time-validation-test-k2-§21-item-7.md) |
| ADR-TST-008 | ARTA SLA Warning/Escalation Test Scope (K2 §21, item 8) | Testing (K2) | [View](../K-testing/k2-workflow-engine-test-suite-design-adrs/ADR-TST-008-arta-sla-warning-escalation-test-scope-k2-§21-item-8.md) |
| ADR-TST-009 | DESIG-07 Typed Error Code (K2 §21, item 9) | Testing (K2) | [View](../K-testing/k2-workflow-engine-test-suite-design-adrs/ADR-TST-009-desig-07-typed-error-code-k2-§21-item-9.md) |
| ADR-UI-001 | Public Portal Hosting App | Frontend / UI (F1, F2) | [View](../F-frontend-architecture/f1-application-route-map-adrs/ADR-UI-001-public-portal-hosting-app.md) |
| ADR-UI-002 | Tier-2 Platform Admin Config CRUD — Pulled Into Phase 1 | Frontend / UI (F1, F2) | [View](../F-frontend-architecture/f1-application-route-map-adrs/ADR-UI-002-tier2-config-crud-scope.md) |
| ADR-UI-003 | Retention Schedule Creation/Activation — Pulled Into Phase 1 | Frontend / UI (F1, F2) | [View](../F-frontend-architecture/f1-application-route-map-adrs/ADR-UI-003-retention-schedule-crud-scope.md) |
| ADR-UI-004 | Committee List/Read Procedure | Frontend / UI (F1, F2) | [View](../F-frontend-architecture/f1-application-route-map-adrs/ADR-UI-004-committee-list-procedure.md) |
| ADR-UI-005 | complaints` and `documentRequests` Single-Record Read Procedures | Frontend / UI (F1, F2) | [View](../F-frontend-architecture/f1-application-route-map-adrs/ADR-UI-005-single-record-read-procedures.md) |
| ADR-UI-006 | Public Portal Announcements — Built in Phase 1 | Frontend / UI (F1, F2) | [View](../F-frontend-architecture/f1-application-route-map-adrs/ADR-UI-006-public-portal-announcements.md) |
| ADR-UI-007 | Designation Document Type — Pulled Into Phase 1 | Frontend / UI (F1, F2) | [View](../F-frontend-architecture/f1-application-route-map-adrs/ADR-UI-007-designation-document-type-phase1.md) |
| ADR-UI-008 | System Administrator — Dedicated Views Built in Phase 1 | Frontend / UI (F1, F2) | [View](../F-frontend-architecture/f1-application-route-map-adrs/ADR-UI-008-system-administrator-views.md) |
| ADR-UI-009 | No Authenticated Account Required for Portal Request/Complaint Forms | Frontend / UI (F1, F2) | [View](../F-frontend-architecture/f1-application-route-map-adrs/ADR-UI-009-portal-form-no-login.md) |
| ADR-UI-010 | Workflow Step Detail Route Keys on `instanceId` | Frontend / UI (F1, F2) | [View](../F-frontend-architecture/f1-application-route-map-adrs/ADR-UI-010-workflow-step-route-key.md) |
| ADR-UI-011 | Propagation of F1 ADRs (001–010) Into F2 Store Design | Frontend / UI (F1, F2) | [View](../F-frontend-architecture/f2-zustand-store-design-adrs/ADR-UI-011-f2-propagation-of-f1-adrs.md) |
| ADR-UI-012 | AuthResponseSchema` Returns Resolved `roleCodes` Directly | Frontend / UI (F1, F2) | [View](../F-frontend-architecture/f2-zustand-store-design-adrs/ADR-UI-012-session-store-rolecodes-shape.md) |
| ADR-UI-013 | CERTIFICATION_OF_URGENCY and DOCUMENT_REQUEST_FORM Excluded from `useDocumentIntakeStore` Step 1 Picker | Frontend / UI (F1, F2) | [View](../F-frontend-architecture/f2-zustand-store-design-adrs/ADR-UI-013-document-intake-picker-scope.md) |
| ADR-UI-014 | Sequential Commit with Per-Item Status for Order of Business Batch Save | Frontend / UI (F1, F2) | [View](../F-frontend-architecture/f2-zustand-store-design-adrs/ADR-UI-014-order-of-business-batch-save-error-handling.md) |
| ADR-UI-015 | SSE Reconnection — Native `EventSource` Replay, with TanStack Query Poll as Fallback on Drawer Open | Frontend / UI (F1, F2) | [View](../F-frontend-architecture/f2-zustand-store-design-adrs/ADR-UI-015-sse-reconnection-strategy.md) |
| ADR-UI-016 | Presiding-Officer Substitute Lookup Confirmed as `organization.getActiveDesignations`; Mandatory Vitest Coverage for `committeeId` Strip-Before-Send | Frontend / UI (F1, F2) | [View](../F-frontend-architecture/f2-zustand-store-design-adrs/ADR-UI-016-designation-lookup-procedure-and-test-coverage.md) |
| ADR-WFL-005 | RecordType` Enum Value List | Workflow / UML (D3, D4) | [View](../D-uml-and-diagrams/d4-domain-class-diagram-adrs/ADR-WFL-005-recordtype-enum.md) |

---
