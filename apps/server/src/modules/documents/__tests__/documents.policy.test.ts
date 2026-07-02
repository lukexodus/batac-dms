import { describe, it, expect } from 'vitest';

import { DocumentPolicyGuard, type SubjectContext } from '../documents.policy.js';

// ─── Test Helpers ───────────────────────────────────────────────────────────

/** Returns a minimal valid SubjectContext with overrides applied. */
function makeSubject(overrides: Partial<SubjectContext> = {}): SubjectContext {
  return {
    userId: 'user-001',
    sessionId: 'session-001',
    officeId: 'office-001',
    cityId: 'city-batac',
    roles: ['dept_encoder'],
    permissions: [],
    committeeIds: [],
    delegationGrantId: null,
    effectiveOfficeIds: ['office-001'],
    effectiveRoles: ['dept_encoder'],
    isItAdmin: false,
    isPlatformAdmin: false,
    ...overrides,
  };
}

const guard = new DocumentPolicyGuard();

// ─── document:create (I1 §3.1) ──────────────────────────────────────────────

describe('canCreate', () => {
  it('[acceptance] dept_encoder creating in own office → true', () => {
    const subject = makeSubject({ roles: ['dept_encoder'], officeId: 'A', effectiveOfficeIds: ['A'] });
    expect(guard.canCreate(subject, { ownedByOfficeId: 'A' })).toBe(true);
  });

  it('[acceptance] sys_admin can never create → false', () => {
    const subject = makeSubject({ roles: ['sys_admin'], officeId: 'A', effectiveOfficeIds: ['A'] });
    expect(guard.canCreate(subject, { ownedByOfficeId: 'A' })).toBe(false);
  });

  it('denies plat_admin, records_officer, auditor, citizen', () => {
    for (const role of ['plat_admin', 'records_officer', 'auditor', 'citizen']) {
      const subject = makeSubject({ roles: [role], officeId: 'A', effectiveOfficeIds: ['A'] });
      expect(guard.canCreate(subject, { ownedByOfficeId: 'A' })).toBe(false);
    }
  });

  it('allows sp_member (Councilors may draft SP measures)', () => {
    const subject = makeSubject({ roles: ['sp_member'], officeId: 'SP', effectiveOfficeIds: ['SP'] });
    expect(guard.canCreate(subject, { ownedByOfficeId: 'SP' })).toBe(true);
  });

  it('denies when target office is outside the subject effective offices', () => {
    const subject = makeSubject({ roles: ['dept_encoder'], officeId: 'A', effectiveOfficeIds: ['A'] });
    expect(guard.canCreate(subject, { ownedByOfficeId: 'B' })).toBe(false);
  });

  it('allows via a delegation-extended office', () => {
    const subject = makeSubject({ roles: ['dept_approver'], officeId: 'A', effectiveOfficeIds: ['A', 'B'] });
    expect(guard.canCreate(subject, { ownedByOfficeId: 'B' })).toBe(true);
  });
});

// ─── document:read metadata (I1 §3.2) ───────────────────────────────────────

describe('canReadMetadata', () => {
  it('allows own-office operational role', () => {
    const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['A'] });
    expect(guard.canReadMetadata(subject, { ownedByOfficeId: 'A', classificationLevel: 'internal' })).toBe(true);
  });

  it('denies own-office read for a role with no document access (citizen)', () => {
    const subject = makeSubject({ roles: ['citizen'], effectiveOfficeIds: ['A'] });
    expect(guard.canReadMetadata(subject, { ownedByOfficeId: 'A', classificationLevel: 'internal' })).toBe(false);
  });

  it('allows cross-office read when role qualifies, classification is internal, and grant is present', () => {
    const subject = makeSubject({ roles: ['records_officer'], effectiveOfficeIds: ['A'] });
    expect(
      guard.canReadMetadata(subject, {
        ownedByOfficeId: 'B',
        classificationLevel: 'internal',
        hasCrossOfficeGrant: true,
      }),
    ).toBe(true);
  });

  it('denies cross-office read without an explicit grant', () => {
    const subject = makeSubject({ roles: ['records_officer'], effectiveOfficeIds: ['A'] });
    expect(
      guard.canReadMetadata(subject, {
        ownedByOfficeId: 'B',
        classificationLevel: 'internal',
        hasCrossOfficeGrant: false,
      }),
    ).toBe(false);
  });

  it('allows sp_member via committee membership regardless of office', () => {
    const subject = makeSubject({ roles: ['sp_member'], effectiveOfficeIds: ['A'], committeeIds: ['committee-1'] });
    expect(
      guard.canReadMetadata(subject, {
        ownedByOfficeId: 'other-office',
        classificationLevel: 'internal',
        documentCommitteeId: 'committee-1',
      }),
    ).toBe(true);
  });

  it('allows sp_member via active SP session flag', () => {
    const subject = makeSubject({ roles: ['sp_member'], effectiveOfficeIds: ['A'], committeeIds: [] });
    expect(
      guard.canReadMetadata(subject, {
        ownedByOfficeId: 'other-office',
        classificationLevel: 'internal',
        isInSpSession: true,
      }),
    ).toBe(true);
  });

  it('denies sp_member with neither committee membership nor an active SP session', () => {
    const subject = makeSubject({ roles: ['sp_member'], effectiveOfficeIds: ['A'], committeeIds: [] });
    expect(
      guard.canReadMetadata(subject, {
        ownedByOfficeId: 'other-office',
        classificationLevel: 'internal',
        isInSpSession: false,
      }),
    ).toBe(false);
  });

  it('allows any subject to read public-classification metadata, regardless of role', () => {
    const subject = makeSubject({ roles: ['sys_admin'], effectiveOfficeIds: [] });
    expect(guard.canReadMetadata(subject, { classificationLevel: 'public' })).toBe(true);
  });

  it('[Gate 4] denies confidential metadata without an allowlist entry, even for an own-office role', () => {
    const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['A'] });
    expect(
      guard.canReadMetadata(subject, { ownedByOfficeId: 'A', classificationLevel: 'confidential', hasAllowlistEntry: false }),
    ).toBe(false);
  });

  it('[Gate 4] allows confidential metadata for an own-office role with an allowlist entry', () => {
    const subject = makeSubject({ roles: ['sp_secretary'], effectiveOfficeIds: ['A'] });
    expect(
      guard.canReadMetadata(subject, { ownedByOfficeId: 'A', classificationLevel: 'confidential', hasAllowlistEntry: true }),
    ).toBe(true);
  });
});

// ─── document:update (I1 §3.3) ──────────────────────────────────────────────

describe('canUpdate', () => {
  it('allows an operational role editing a Draft document in their own office', () => {
    const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['A'] });
    expect(guard.canUpdate(subject, { lifecycleState: 'draft', ownedByOfficeId: 'A' })).toBe(true);
  });

  it('denies edits once the document has left Draft state', () => {
    const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['A'] });
    expect(guard.canUpdate(subject, { lifecycleState: 'in_workflow', ownedByOfficeId: 'A' })).toBe(false);
  });

  it('allows sp_member to edit only their own self-authored draft', () => {
    const subject = makeSubject({ roles: ['sp_member'], userId: 'author-1', effectiveOfficeIds: ['SP'] });
    expect(
      guard.canUpdate(subject, { lifecycleState: 'draft', ownedByOfficeId: 'SP', createdBy: 'author-1' }),
    ).toBe(true);
  });

  it('denies sp_member editing a draft authored by a different SP Member', () => {
    const subject = makeSubject({ roles: ['sp_member'], userId: 'author-1', effectiveOfficeIds: ['SP'] });
    expect(
      guard.canUpdate(subject, { lifecycleState: 'draft', ownedByOfficeId: 'SP', createdBy: 'author-2' }),
    ).toBe(false);
  });

  it('denies records_officer / auditor from updating document content', () => {
    for (const role of ['records_officer', 'auditor']) {
      const subject = makeSubject({ roles: [role], effectiveOfficeIds: ['A'] });
      expect(guard.canUpdate(subject, { lifecycleState: 'draft', ownedByOfficeId: 'A' })).toBe(false);
    }
  });
});

// ─── document:delete / soft-delete (I1 §3.4) ────────────────────────────────

describe('canSoftDelete', () => {
  it('allows dept_encoder to soft-delete a pre-workflow Draft in their office', () => {
    const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['A'] });
    expect(
      guard.canSoftDelete(subject, { lifecycleState: 'draft', workflowInstanceId: null, ownedByOfficeId: 'A' }),
    ).toBe(true);
  });

  it('[LOG-0028] allows brgy_encoder to soft-delete, matching I1 prose + I2 despite the omission in I1 §3.4\'s literal ALLOW-clause role list', () => {
    const subject = makeSubject({ roles: ['brgy_encoder'], effectiveOfficeIds: ['A'] });
    expect(
      guard.canSoftDelete(subject, { lifecycleState: 'submitted', workflowInstanceId: null, ownedByOfficeId: 'A' }),
    ).toBe(true);
  });

  it('denies dept_encoder once a workflow instance exists', () => {
    const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['A'] });
    expect(
      guard.canSoftDelete(subject, { lifecycleState: 'submitted', workflowInstanceId: 'wf-1', ownedByOfficeId: 'A' }),
    ).toBe(false);
  });

  it('[LOG-0030] denies soft-delete for every role once a workflow instance exists, including dept_approver/sp_secretary', () => {
    // I1 §3.4's base ALLOW clause has an unconditional, top-level
    // `AND document.workflow_instance_id IS NULL` (line 379) that applies
    // to the whole rule, not just to encoders. The "RESTRICTED ENCODER
    // RULE" paragraph immediately below it closes with "Once a workflow
    // instance exists, deletion requires dept_approver or sp_secretary,"
    // citing I2 Conditional Note 7 as its source — but I2 Note 7 is
    // actually attached to the *Cancel* document row and is explicitly
    // about the cancel action's encoder restriction, not soft-delete. That
    // sentence in I1 §3.4 appears to be a misattributed copy from §3.6.
    // Read literally, §3.4's own operative ALLOW clause blocks everyone,
    // dept_approver/sp_secretary included, once workflow_instance_id is
    // set; document:cancel (§3.6) is the separate, correctly-documented
    // action those roles retain once a workflow is active.
    const subject = makeSubject({ roles: ['sp_secretary'], effectiveOfficeIds: ['A'] });
    expect(
      guard.canSoftDelete(subject, { lifecycleState: 'submitted', workflowInstanceId: 'wf-1', ownedByOfficeId: 'A' }),
    ).toBe(false);
  });

  it('denies deletion of a Completed document by any role (soft-delete is pre-workflow only)', () => {
    const subject = makeSubject({ roles: ['sp_secretary'], effectiveOfficeIds: ['A'] });
    expect(
      guard.canSoftDelete(subject, { lifecycleState: 'completed', workflowInstanceId: null, ownedByOfficeId: 'A' }),
    ).toBe(false);
  });
});

// ─── document:submit (I1 §3.5) ──────────────────────────────────────────────

describe('canSubmit', () => {
  it('allows an operational role submitting their own-office Draft', () => {
    const subject = makeSubject({ roles: ['brgy_captain'], effectiveOfficeIds: ['BRGY'] });
    expect(guard.canSubmit(subject, { lifecycleState: 'draft', ownedByOfficeId: 'BRGY' })).toBe(true);
  });

  it('denies submitting a non-Draft document', () => {
    const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['A'] });
    expect(guard.canSubmit(subject, { lifecycleState: 'submitted', ownedByOfficeId: 'A' })).toBe(false);
  });
});

describe('requiresSpSecretaryForSubmit', () => {
  it('requires sp_secretary for SP measure types', () => {
    expect(guard.requiresSpSecretaryForSubmit('SP_RESOLUTION')).toBe(true);
    expect(guard.requiresSpSecretaryForSubmit('SP_ORDINANCE')).toBe(true);
    expect(guard.requiresSpSecretaryForSubmit('SP_APPROPRIATION_ORDINANCE')).toBe(true);
  });

  it('does not require sp_secretary for a non-SP document type', () => {
    expect(guard.requiresSpSecretaryForSubmit('MEMO_INCOMING')).toBe(false);
  });
});

// ─── document:cancel (I1 §3.6) ──────────────────────────────────────────────

describe('canCancel', () => {
  it('allows dept_approver to cancel from any active (non-terminal) state', () => {
    const subject = makeSubject({ roles: ['dept_approver'], effectiveOfficeIds: ['A'] });
    expect(
      guard.canCancel(subject, { lifecycleState: 'in_workflow', workflowInstanceId: 'wf-1', ownedByOfficeId: 'A' }),
    ).toBe(true);
  });

  it('denies cancellation once archived, disposed, or cancelled', () => {
    const subject = makeSubject({ roles: ['mayor'], effectiveOfficeIds: ['A'] });
    for (const lifecycleState of ['archived', 'disposed', 'cancelled'] as const) {
      expect(guard.canCancel(subject, { lifecycleState, workflowInstanceId: null, ownedByOfficeId: 'A' })).toBe(false);
    }
  });

  it('allows dept_encoder to cancel only pre-workflow', () => {
    const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['A'] });
    expect(
      guard.canCancel(subject, { lifecycleState: 'submitted', workflowInstanceId: null, ownedByOfficeId: 'A' }),
    ).toBe(true);
  });

  it('denies dept_encoder from cancelling once a workflow instance exists', () => {
    const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['A'] });
    expect(
      guard.canCancel(subject, { lifecycleState: 'in_workflow', workflowInstanceId: 'wf-1', ownedByOfficeId: 'A' }),
    ).toBe(false);
  });

  it('denies sp_member from cancelling (not in any grant)', () => {
    const subject = makeSubject({ roles: ['sp_member'], effectiveOfficeIds: ['A'] });
    expect(
      guard.canCancel(subject, { lifecycleState: 'draft', workflowInstanceId: null, ownedByOfficeId: 'A' }),
    ).toBe(false);
  });
});

// ─── document:number_assign (I1 §3.7) ───────────────────────────────────────

describe('canAssignPreliminaryNumber', () => {
  it('allows sp_secretary to assign a preliminary number at secretariat logging', () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    expect(
      guard.canAssignPreliminaryNumber(subject, {
        documentTypeCode: 'SP_ORDINANCE',
        lifecycleState: 'submitted',
        preliminaryNumber: null,
      }),
    ).toBe(true);
  });

  it('denies non-SP document types', () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    expect(
      guard.canAssignPreliminaryNumber(subject, {
        documentTypeCode: 'MEMO_INCOMING',
        lifecycleState: 'submitted',
        preliminaryNumber: null,
      }),
    ).toBe(false);
  });

  it('denies when a preliminary number is already assigned', () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    expect(
      guard.canAssignPreliminaryNumber(subject, {
        documentTypeCode: 'SP_RESOLUTION',
        lifecycleState: 'submitted',
        preliminaryNumber: 'Draft 7SP 2026-01',
      }),
    ).toBe(false);
  });

  it('denies any role other than sp_secretary', () => {
    const subject = makeSubject({ roles: ['sp_presiding_officer'] });
    expect(
      guard.canAssignPreliminaryNumber(subject, {
        documentTypeCode: 'SP_RESOLUTION',
        lifecycleState: 'submitted',
        preliminaryNumber: null,
      }),
    ).toBe(false);
  });
});

// ─── document:number_promote (I1 §3.8) ──────────────────────────────────────

describe('canAssignFinalNumber', () => {
  it('allows sp_secretary to promote once preliminary is set and final is not', () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    expect(
      guard.canAssignFinalNumber(subject, {
        documentTypeCode: 'SP_ORDINANCE',
        preliminaryNumber: 'Draft 7SP 2026-01',
        finalNumber: null,
      }),
    ).toBe(true);
  });

  it('[acceptance] denies when a final number is already set', () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    expect(
      guard.canAssignFinalNumber(subject, {
        documentTypeCode: 'SP_RESOLUTION',
        finalNumber: 'already-set',
        preliminaryNumber: 'x',
      }),
    ).toBe(false);
  });

  it('denies when no preliminary number exists yet', () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    expect(
      guard.canAssignFinalNumber(subject, {
        documentTypeCode: 'SP_RESOLUTION',
        preliminaryNumber: null,
        finalNumber: null,
      }),
    ).toBe(false);
  });
});

// ─── document:certify_urgent (I1 §3.9) ──────────────────────────────────────

describe('canCertifyUrgent', () => {
  it('allows sp_secretary logging a Certification of Urgency', () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    expect(guard.canCertifyUrgent(subject, { certifyingDocumentTypeCode: 'CERTIFICATION_OF_URGENCY' })).toBe(true);
  });

  it('denies a non-sp_secretary role', () => {
    const subject = makeSubject({ roles: ['mayor'] });
    expect(guard.canCertifyUrgent(subject, { certifyingDocumentTypeCode: 'CERTIFICATION_OF_URGENCY' })).toBe(false);
  });

  it('denies when the referenced document is not a Certification of Urgency', () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    expect(guard.canCertifyUrgent(subject, { certifyingDocumentTypeCode: 'SP_RESOLUTION' })).toBe(false);
  });
});

// ─── document:archive (I1 §3.10) ────────────────────────────────────────────

describe('canArchive', () => {
  it('allows records_officer to archive a Completed document from any office', () => {
    const subject = makeSubject({ roles: ['records_officer'] });
    expect(guard.canArchive(subject, { lifecycleState: 'completed', ownedByOfficeId: 'X' })).toBe(true);
  });

  it('allows sp_secretary to archive only SP-Secretariat-owned documents', () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    expect(
      guard.canArchive(subject, { lifecycleState: 'released', ownedByOfficeId: 'SPS', isSpSecretariatOffice: true }),
    ).toBe(true);
  });

  it('denies sp_secretary archiving a document not owned by SP Secretariat', () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    expect(
      guard.canArchive(subject, { lifecycleState: 'released', ownedByOfficeId: 'CAO', isSpSecretariatOffice: false }),
    ).toBe(false);
  });

  it('denies archiving a document that is not Completed or Released', () => {
    const subject = makeSubject({ roles: ['records_officer'] });
    expect(guard.canArchive(subject, { lifecycleState: 'draft', ownedByOfficeId: 'X' })).toBe(false);
  });
});

// ─── document:publish_portal (I1 §3.11) ─────────────────────────────────────

describe('canPublishPortal', () => {
  it('allows sp_secretary to publish a released, public-classification SP measure', () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    expect(
      guard.canPublishPortal(subject, {
        documentTypeCode: 'SP_RESOLUTION',
        lifecycleState: 'released',
        classificationLevel: 'public',
      }),
    ).toBe(true);
  });

  it('allows an internal-classification measure with the title-and-first-page rule', () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    expect(
      guard.canPublishPortal(subject, {
        documentTypeCode: 'SP_ORDINANCE',
        lifecycleState: 'archived',
        classificationLevel: 'internal',
        publicVisibilityRule: 'title_and_first_page_public',
      }),
    ).toBe(true);
  });

  it('denies an internal-classification measure without the visibility rule', () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    expect(
      guard.canPublishPortal(subject, {
        documentTypeCode: 'SP_ORDINANCE',
        lifecycleState: 'released',
        classificationLevel: 'internal',
        publicVisibilityRule: 'not_public',
      }),
    ).toBe(false);
  });

  it('denies a non-SP document type', () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    expect(
      guard.canPublishPortal(subject, {
        documentTypeCode: 'MEMO_OUTGOING',
        lifecycleState: 'released',
        classificationLevel: 'public',
      }),
    ).toBe(false);
  });
});

// ─── document_version / document_attachment read (I1 §4.1) ─────────────────

describe('canReadContent', () => {
  it('[acceptance] Gate 2: IT Admin is blocked from content regardless of classification', () => {
    const subject = makeSubject({ roles: ['sys_admin'], isItAdmin: true });
    expect(guard.canReadContent(subject, { classificationLevel: 'internal' })).toBe(false);
  });

  it('IT Admin is also blocked for confidential content (Gate 2 explicit backstop)', () => {
    const subject = makeSubject({ roles: ['sys_admin'], isItAdmin: true });
    expect(guard.canReadContent(subject, { classificationLevel: 'confidential', hasAllowlistEntry: true })).toBe(false);
  });

  it('IT Admin is blocked even for public-classification content (no ALLOW branch includes sys_admin)', () => {
    const subject = makeSubject({ roles: ['sys_admin'], isItAdmin: true });
    expect(guard.canReadContent(subject, { classificationLevel: 'public' })).toBe(false);
  });

  it('allows an own-office operational role to read internal content', () => {
    const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['A'] });
    expect(guard.canReadContent(subject, { ownedByOfficeId: 'A', classificationLevel: 'internal' })).toBe(true);
  });

  it('[LOG-0029] allows cross-office content read without an explicit grant, unlike metadata read', () => {
    const subject = makeSubject({ roles: ['records_officer'], effectiveOfficeIds: ['A'] });
    expect(guard.canReadContent(subject, { ownedByOfficeId: 'B', classificationLevel: 'internal' })).toBe(true);
  });

  it('[Gate 4] denies confidential content without an allowlist entry', () => {
    const subject = makeSubject({ roles: ['sp_secretary'], effectiveOfficeIds: ['A'] });
    expect(
      guard.canReadContent(subject, { ownedByOfficeId: 'A', classificationLevel: 'confidential', hasAllowlistEntry: false }),
    ).toBe(false);
  });

  it('[Gate 4] allows confidential content for an allowlisted own-office role', () => {
    const subject = makeSubject({ roles: ['sp_secretary'], effectiveOfficeIds: ['A'] });
    expect(
      guard.canReadContent(subject, { ownedByOfficeId: 'A', classificationLevel: 'confidential', hasAllowlistEntry: true }),
    ).toBe(true);
  });

  it('denies sp_member content read outside their committee/session even for internal classification', () => {
    const subject = makeSubject({ roles: ['sp_member'], effectiveOfficeIds: ['A'], committeeIds: ['committee-1'] });
    expect(
      guard.canReadContent(subject, { ownedByOfficeId: 'other', classificationLevel: 'internal', documentCommitteeId: 'committee-2' }),
    ).toBe(false);
  });
});

describe('canReadVersionContent', () => {
  it('mirrors canReadContent for the same attributes', () => {
    const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['A'] });
    const attrs = { ownedByOfficeId: 'A', classificationLevel: 'internal' as const };
    expect(guard.canReadVersionContent(subject, attrs)).toBe(guard.canReadContent(subject, attrs));
    expect(guard.canReadVersionContent(subject, attrs)).toBe(true);
  });
});

// ─── document_version:create (I1 §4.2) ──────────────────────────────────────

describe('canCreateVersion', () => {
  it('allows an operational role uploading to their own office', () => {
    const subject = makeSubject({ roles: ['dept_approver'], effectiveOfficeIds: ['A'] });
    expect(guard.canCreateVersion(subject, { ownedByOfficeId: 'A' })).toBe(true);
  });

  it('restricts sp_member to their own self-authored document', () => {
    const subject = makeSubject({ roles: ['sp_member'], userId: 'u1', effectiveOfficeIds: ['SP'] });
    expect(guard.canCreateVersion(subject, { ownedByOfficeId: 'SP', createdBy: 'u1' })).toBe(true);
    expect(guard.canCreateVersion(subject, { ownedByOfficeId: 'SP', createdBy: 'someone-else' })).toBe(false);
  });

  it('denies uploads outside the subject effective offices', () => {
    const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['A'] });
    expect(guard.canCreateVersion(subject, { ownedByOfficeId: 'B' })).toBe(false);
  });
});

// ─── OCR text (I1 §4.3) ──────────────────────────────────────────────────────

describe('canReadOcrText', () => {
  it('mirrors canReadContent (I1: "same conditions as document_version:read")', () => {
    const subject = makeSubject({ roles: ['sys_admin'], isItAdmin: true });
    expect(guard.canReadOcrText(subject, { classificationLevel: 'internal' })).toBe(false);
  });

  it('allows an own-office operational role to read OCR text', () => {
    const subject = makeSubject({ roles: ['dept_approver'], effectiveOfficeIds: ['A'] });
    expect(guard.canReadOcrText(subject, { ownedByOfficeId: 'A', classificationLevel: 'internal' })).toBe(true);
  });
});

// ─── Scan quality (I1 §4.4) ──────────────────────────────────────────────────

describe('canReadScanQuality', () => {
  it('allows the uploader to view their own scan quality indicator regardless of office', () => {
    const subject = makeSubject({ roles: ['dept_encoder'], userId: 'u1', effectiveOfficeIds: [] });
    expect(guard.canReadScanQuality(subject, { createdBy: 'u1', ownedByOfficeId: 'other' })).toBe(true);
  });

  it('allows an own-office role to view scan quality for a document uploaded by someone else', () => {
    const subject = makeSubject({ roles: ['records_officer'], userId: 'u2', effectiveOfficeIds: ['A'] });
    expect(guard.canReadScanQuality(subject, { createdBy: 'u1', ownedByOfficeId: 'A' })).toBe(true);
  });

  it('denies auditor (excluded from this role set, unlike other content reads)', () => {
    const subject = makeSubject({ roles: ['auditor'], effectiveOfficeIds: ['A'] });
    expect(guard.canReadScanQuality(subject, { createdBy: 'someone', ownedByOfficeId: 'A' })).toBe(false);
  });

  it('denies when neither self-authored nor own-office', () => {
    const subject = makeSubject({ roles: ['dept_encoder'], userId: 'u2', effectiveOfficeIds: ['A'] });
    expect(guard.canReadScanQuality(subject, { createdBy: 'u1', ownedByOfficeId: 'B' })).toBe(false);
  });
});

// ─── number_series (I1 §14) ─────────────────────────────────────────────────

describe('canReadNumberSeries', () => {
  it('allows each of the five qualifying roles', () => {
    for (const role of ['plat_admin', 'records_officer', 'sp_secretary', 'sys_admin', 'auditor']) {
      expect(guard.canReadNumberSeries(makeSubject({ roles: [role] }))).toBe(true);
    }
  });

  it('denies a role with no number-series access', () => {
    expect(guard.canReadNumberSeries(makeSubject({ roles: ['dept_encoder'] }))).toBe(false);
  });
});

describe('canManageNumberSeries', () => {
  it('allows plat_admin with isPlatformAdmin set', () => {
    const subject = makeSubject({ roles: ['plat_admin'], isPlatformAdmin: true });
    expect(guard.canManageNumberSeries(subject)).toBe(true);
  });

  it('denies plat_admin role without the isPlatformAdmin flag', () => {
    const subject = makeSubject({ roles: ['plat_admin'], isPlatformAdmin: false });
    expect(guard.canManageNumberSeries(subject)).toBe(false);
  });

  it('denies sys_admin (a different role from plat_admin)', () => {
    const subject = makeSubject({ roles: ['sys_admin'], isItAdmin: true });
    expect(guard.canManageNumberSeries(subject)).toBe(false);
  });
});

// ─── State-Action Compatibility Matrix (I1 §17) ─────────────────────────────

describe('checkStateActionCompatibility', () => {
  it('[acceptance] update is not compatible with in_workflow', () => {
    expect(guard.checkStateActionCompatibility('update', 'in_workflow')).toBe(false);
  });

  it('[acceptance] cancel is compatible with in_workflow', () => {
    expect(guard.checkStateActionCompatibility('cancel', 'in_workflow')).toBe(true);
  });

  it('allows the full draft action set', () => {
    for (const action of ['create', 'read', 'update', 'submit', 'cancel']) {
      expect(guard.checkStateActionCompatibility(action, 'draft')).toBe(true);
    }
    expect(guard.checkStateActionCompatibility('approve', 'draft')).toBe(false);
  });

  it('allows number_assign only in submitted / in_workflow', () => {
    expect(guard.checkStateActionCompatibility('number_assign', 'submitted')).toBe(true);
    expect(guard.checkStateActionCompatibility('number_assign', 'in_workflow')).toBe(true);
    expect(guard.checkStateActionCompatibility('number_assign', 'draft')).toBe(false);
  });

  it('allows number_promote only in pending_mayor_action', () => {
    expect(guard.checkStateActionCompatibility('number_promote', 'pending_mayor_action')).toBe(true);
    expect(guard.checkStateActionCompatibility('number_promote', 'in_workflow')).toBe(false);
  });

  it('allows archive only from completed / released, and dispose only from archived', () => {
    expect(guard.checkStateActionCompatibility('archive', 'completed')).toBe(true);
    expect(guard.checkStateActionCompatibility('archive', 'released')).toBe(true);
    expect(guard.checkStateActionCompatibility('archive', 'archived')).toBe(false);
    expect(guard.checkStateActionCompatibility('dispose', 'archived')).toBe(true);
    expect(guard.checkStateActionCompatibility('dispose', 'completed')).toBe(false);
  });

  it('always allows read, including on terminal states', () => {
    for (const state of ['disposed', 'cancelled', 'superseded'] as const) {
      expect(guard.checkStateActionCompatibility('read', state)).toBe(true);
      expect(guard.checkStateActionCompatibility('update', state)).toBe(false);
    }
  });

  it('[LOG-0027][Inference] pending_panlalawigan_review (missing from I1 §17) allows read and cancel only', () => {
    expect(guard.checkStateActionCompatibility('read', 'pending_panlalawigan_review')).toBe(true);
    expect(guard.checkStateActionCompatibility('cancel', 'pending_panlalawigan_review')).toBe(true);
    expect(guard.checkStateActionCompatibility('approve', 'pending_panlalawigan_review')).toBe(false);
    expect(guard.checkStateActionCompatibility('update', 'pending_panlalawigan_review')).toBe(false);
  });
});
