/**
 * designation.handler.ts — TASK-DOCS-018
 *
 * DesignationHandler wires the DESIGNATION document type's lifecycle to the
 * ORG module's delegation-grant lifecycle, so that logging (or cancelling) a
 * DESIGNATION document atomically creates (or revokes) an
 * organization.delegation_grants row.
 *
 * ============================================================================
 * READ THIS BEFORE CHANGING TRIGGER POINTS OR ASSUMING THIS IS FULLY SETTLED
 * ============================================================================
 *
 * [Confirmed] This handler is wired into `documents.submit` per an explicit
 * human decision made during this task's investigation, DESPITE a confirmed
 * conflict with H2 §8 ("Logging handler behavior") and the consolidated
 * architecture reference Part 4.12, both of which describe the trigger as
 * document *logging* ("document created and JSONB written"), not
 * `documents.submit`. Per AGENTS.md §1, H2 and the consolidated reference
 * outrank this task's own AI Prompt — that conflict is NOT resolved by this
 * file, only implemented-around per instruction. See
 * docs/development-findings-log.md for the full finding
 * ([LOG-0037] in this batch). A human should revisit whether `documents.submit`
 * is really the right hook once the H2-vs-task conflict is adjudicated.
 *
 * [Confirmed] TASK-DOCS-018's own stated ORG Published API method names,
 * parameter names, and Date-typed effectiveFrom/effectiveUntil do NOT match
 * the real, implemented ORG surface. This handler is written against the
 * REAL implemented signatures (`delegationService.createDelegationGrant` /
 * `revokeEarlyDelegationGrant`, field names `delegatingEmployeeId` /
 * `delegatedToEmployeeId` / `officeId` / `positionId`, `startDate`/`endDate`
 * as `YYYY-MM-DD` strings), not the task prompt's assumed names. See
 * docs/development-findings-log.md for the full field-name mapping.
 *
 * [Confirmed] The DESIGNATION document type's `metadata_schema` field names,
 * per the shared Zod DesignationMetadataSchema
 * (packages/shared/src/schemas/document-metadata.ts), use camelCase and
 * match TASK-DOCS-018's stated field list exactly — the mismatch is
 * entirely on the ORG-side calling convention, not the DOCS-side metadata
 * shape. effectiveFrom/effectiveUntil are already YYYY-MM-DD strings
 * (DateSchema), not Date objects, so no date-type conversion is needed when
 * mapping into CreateDelegationGrantInput.startDate/endDate.
 *
 * [Confirmed] `revokeEarlyDelegationGrant` enforces its own internal ABAC:
 * the calling subject must be the delegating authority, or hold
 * `sp_secretary` AND supply a `writtenInstructionReference`. This handler
 * passes the DESIGNATION document's cancellation `reason` through as
 * `writtenInstructionReference`, per the literal instruction in
 * TASK-DOCS-018. This is a real, likely-user-facing gap: a canceller who is
 * neither the delegating authority nor `sp_secretary` will receive a
 * `PolicyDeniedError` from the ORG side, surfaced here as `FORBIDDEN`. This
 * is not fixed by this file — see docs/development-findings-log.md.
 *
 * [Unverified] None of the code in this file has been executed against a
 * real database, real PgBoss instance, or `pnpm typecheck`/`pnpm test`. It
 * is written against the real types and schemas present in this repository,
 * but should be treated as [Inference]-level confidence until verified
 * locally.
 */
import type { DocumentsRepository } from './documents.repository.js';
import type { DbTransaction as DocumentsDbTransaction } from './documents.types.js';
import type {
  DelegationService,
  DelegationSubject,
  CreateDelegationGrantInput,
} from '../organization/organization.types.js';
import type { DesignationMetadata } from '@batac/shared';

/**
 * Thrown when a DESIGNATION document's metadata does not contain the fields
 * this handler needs, or fails DesignationMetadataSchema-shaped validation.
 * Not added to the shared DomainErrorCode enum (packages/shared/src/errors.ts)
 * — that's a more central change than this task warrants; the router layer
 * (documents.router.ts) is expected to catch this and translate it to a
 * TRPCError, matching how documents.router.ts already handles other
 * input-shape problems inline (see its existing BAD_REQUEST throws).
 */
export class DesignationMetadataInvalidError extends Error {
  constructor(documentId: string, reason: string) {
    super(`DESIGNATION document ${documentId} has invalid metadata: ${reason}`);
    this.name = 'DesignationMetadataInvalidError';
  }
}

export interface DesignationHandlerDeps {
  documentsRepository: DocumentsRepository;
  delegationService: DelegationService;
  /**
   * Runs `fn` inside a single DB transaction shared by both the document
   * repository writes and the delegation-service writes this handler makes.
   * [Inference] Callers are expected to pass something equivalent to
   * `deps.db.transaction(async (trx) => fn(trx))` — this handler does not
   * construct its own top-level `AppDb` connection; it composes into
   * whatever transaction machinery the caller (documents.router.ts, via
   * documents.plugin.ts) provides, matching the pattern already established
   * by documents.service.ts's transitionState and delegation.service.ts's
   * createDelegationGrant/revokeEarlyDelegationGrant (both edited in this
   * same change to accept an optional trx).
   */
  runInTransaction: <T>(fn: (trx: DocumentsDbTransaction) => Promise<T>) => Promise<T>;
}

/**
 * Narrow, defensive parse of a DESIGNATION document's metadata into the
 * fields this handler needs. Does not use the full DesignationMetadataSchema
 * Zod parser from packages/shared directly here, to avoid a hard dependency
 * on Zod's exact refine()-driven error shape inside this handler; instead
 * checks presence of the specific fields this handler reads. [Inference]
 * This is a deliberately narrower check than full schema validation — if a
 * document's metadata satisfies this handler's needs but would fail a
 * stricter DesignationMetadataSchema.parse() elsewhere (e.g. the
 * cross-field refine() that delegatingAuthorityEmployeeId !==
 * designatedPersonEmployeeId), that stricter validation is expected to have
 * already run at document create/update time (documents.router.ts's create
 * and update procedures validate against DocumentMetadataSchema per E3 /
 * TASK-DOCS-003), not re-run here.
 */
function extractDesignationFields(
  documentId: string,
  metadata: Record<string, unknown>,
): Pick<
  DesignationMetadata,
  | 'delegatingAuthorityEmployeeId'
  | 'designatedPersonEmployeeId'
  | 'designatedOfficeId'
  | 'designatedPositionId'
  | 'scopeDescription'
  | 'effectiveFrom'
  | 'effectiveUntil'
> & { legalBasis?: string; delegationGrantId?: string } {
  const m = metadata as Partial<DesignationMetadata>;

  const required: Array<keyof DesignationMetadata> = [
    'delegatingAuthorityEmployeeId',
    'designatedPersonEmployeeId',
    'designatedOfficeId',
    'designatedPositionId',
    'scopeDescription',
    'effectiveFrom',
    'effectiveUntil',
  ];

  const missing = required.filter((key) => {
    const value = m[key];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    throw new DesignationMetadataInvalidError(
      documentId,
      `missing required field(s): ${missing.join(', ')}`,
    );
  }

  return {
    delegatingAuthorityEmployeeId: m.delegatingAuthorityEmployeeId!,
    designatedPersonEmployeeId: m.designatedPersonEmployeeId!,
    designatedOfficeId: m.designatedOfficeId!,
    designatedPositionId: m.designatedPositionId!,
    scopeDescription: m.scopeDescription!,
    effectiveFrom: m.effectiveFrom!,
    effectiveUntil: m.effectiveUntil!,
    ...(m.legalBasis !== undefined && { legalBasis: m.legalBasis }),
    ...(m.delegationGrantId !== undefined && { delegationGrantId: m.delegationGrantId }),
  };
}

export class DesignationHandler {
  constructor(private readonly deps: DesignationHandlerDeps) {}

  /**
   * Called as an async side effect from documents.router.ts's `submit`
   * procedure, guarded by `documentType.code === 'DESIGNATION'`, AFTER the
   * document's own submit logic has already run (per TASK-DOCS-018's
   * literal instruction). Wraps the delegation-grant creation and the
   * metadata write-back in one transaction. Does NOT wrap the document's
   * own lifecycle-state transition — that has already committed by the time
   * this method is called, per the calling convention TASK-DOCS-018
   * describes and per the trigger-point note at the top of this file.
   *
   * [Inference] Because `documents.submit`'s own transitionState call has
   * already committed before this method runs (see documents.router.ts's
   * submit procedure — it is a separate statement, not nested inside this
   * method), true single-transaction atomicity between "document became
   * submitted" and "grant was created" is NOT what this method delivers,
   * despite the transactional trx-threading added to both
   * transitionState() and createDelegationGrant() in this same change. What
   * IS delivered: the grant INSERT and the metadata write-back
   * (delegationGrantId written into documents.documents.metadata) are one
   * transaction together — if the grant creation fails, the metadata
   * write-back does not happen, and vice versa. If a human wants the
   * document's own state transition included in the same transaction as
   * the grant creation, documents.router.ts's submit procedure would need
   * restructuring to call this handler and the state transition inside one
   * shared transaction block, rather than calling this handler as a
   * separate step after transitionState() has already returned. That
   * restructuring is NOT done in this change — flagging it rather than
   * silently deciding it, since it changes documents.router.ts's control
   * flow beyond what TASK-DOCS-018 describes.
   */
  async handleDesignationLogged(
    documentId: string,
    metadata: Record<string, unknown>,
    actorId: string,
    subject: DelegationSubject,
  ): Promise<{ delegationGrantId: string }> {
    const fields = extractDesignationFields(documentId, metadata);

    const grant = await this.deps.runInTransaction(async (trx) => {
      const input: CreateDelegationGrantInput = {
        delegatingEmployeeId: fields.delegatingAuthorityEmployeeId,
        delegatedToEmployeeId: fields.designatedPersonEmployeeId,
        officeId: fields.designatedOfficeId,
        positionId: fields.designatedPositionId,
        designationDocumentId: documentId,
        scopeDescription: fields.scopeDescription,
        ...(fields.legalBasis !== undefined && { legalBasis: fields.legalBasis }),
        startDate: fields.effectiveFrom,
        endDate: fields.effectiveUntil,
        cityId: subject.cityId,
      };

      const createdGrant = await this.deps.delegationService.createDelegationGrant(
        input,
        subject,
        trx,
      );

      await this.deps.documentsRepository.updateDocumentMetadata(documentId, {
        ...metadata,
        delegationGrantId: createdGrant.id,
      });

      return createdGrant;
    });

    return { delegationGrantId: grant.id };
  }

  /**
   * Called as an async side effect from documents.router.ts's `cancel`
   * procedure, guarded by `documentType.code === 'DESIGNATION' &&
   * document.metadata?.delegationGrantId`, per TASK-DOCS-018's literal
   * instruction. Passes the document cancellation's `reason` through as
   * `writtenInstructionReference` — see the file-header note above on why
   * this is a known, flagged gap rather than a resolved one: a canceller
   * who is neither the delegating authority nor `sp_secretary` will hit
   * revokeEarlyDelegationGrant's own internal ABAC and receive
   * PolicyDeniedError.
   *
   * [Inference] Not wrapped in the same transaction as documents.cancel's
   * own state transition, for the same reason described on
   * handleDesignationLogged above: documents.cancel's transitionState call
   * has already committed by the time this method would be invoked, per the
   * calling convention TASK-DOCS-018 describes.
   */
  async handleDesignationCancelled(
    delegationGrantId: string,
    reason: string,
    subject: DelegationSubject,
  ): Promise<void> {
    await this.deps.delegationService.revokeEarlyDelegationGrant(
      delegationGrantId,
      { writtenInstructionReference: reason },
      subject,
    );
  }
}
