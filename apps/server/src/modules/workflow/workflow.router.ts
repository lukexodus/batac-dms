import { z } from 'zod';
import { sanitizeRichText, isRichTextEmpty } from './rich-text.util.js';
import { parseRichTextForPdf, PDF_REPORT_STYLE, type PdfBlock, type TextRun } from './rich-text-pdf.util.js';

import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc/trpc.js';
import {
  instances,
  stepInstances,
  steps,
  definitionVersions,
  workflowEvents,
} from '@batac/database/schema/workflow.schema.js';
import { documents, documentTypes, versions } from '@batac/database/schema/documents.schema.js';
import { offices, employees, committees } from '@batac/database/schema/organization.schema.js';
import { users } from '@batac/database/schema/iam.schema.js';
import { eq, and, or, isNull, inArray, notInArray, desc, asc, gte, lte } from 'drizzle-orm';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';
import { SlaService } from './services/sla.service.js';
import { WorkflowRepository } from './workflow.repository.js';
import { DocumentsRepository } from '../documents/documents.repository.js';
import { submitStepAction } from './engine/step-handlers/action.handler.js';
import { submitStepApproval } from './engine/step-handlers/approval.handler.js';
import {
  submitCommitteeReport as engineSubmitCommitteeReport,
  submitStepMultiReferral,
  updateAssignedCommittees,
} from './engine/step-handlers/multi-referral.handler.js';
import { workflowPolicy, MAYOR_STEP_KEYS } from './workflow.policy.js';
import type { StepInstanceAttrs, WorkflowInstanceReadAttrs } from './workflow.policy.js';
import type { Context } from '../iam/iam.types.js';
import { cancelInstance, bypassStep, migrateInstance } from './engine/admin-operations.js';

const paginationInput = z.object({
  cursor: z.string().nullish(),
  limit: z.number().int().min(1).max(100).default(50),
});

const SP_SECRETARIAT_OFFICE_CODE = 'SPS';

const COMMITTEE_REPORT_TYPE_CODE = 'COMMITTEE_REPORT';

let _s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: env.S3_REGION || 'ap-southeast-1',
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY || '',
        secretAccessKey: env.S3_SECRET_KEY || '',
      },
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  }
  return _s3Client;
}

async function buildViewUrl(fileKey: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET || 'batac-dms',
    Key: fileKey,
  });
  return getSignedUrl(getS3Client(), command, {
    expiresIn: env.S3_SIGNED_URL_EXPIRES_S || 300,
  });
}

async function fetchS3Object(fileKey: string): Promise<Buffer> {
  const { Body } = await getS3Client().send(
    new GetObjectCommand({ Bucket: env.S3_BUCKET || 'batac-dms', Key: fileKey }),
  );
  const chunks: Uint8Array[] = [];
  if (Body) {
    for await (const chunk of Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
  }
  return Buffer.concat(chunks);
}

async function putS3Object(fileKey: string, body: Buffer, contentType: string): Promise<void> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET || 'batac-dms',
      Key: fileKey,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export interface DrawableRunFragment {
  text: string;
  font: 'regular' | 'bold' | 'italic' | 'boldItalic' | 'code';
}

export type DrawableLine = DrawableRunFragment[];

/**
 * Wraps a sequence of TextRuns (as produced by parseRichTextForPdf) into
 * lines that fit within maxWidth, preserving which font each word belongs
 * to. Mirrors the word-splitting approach of the existing wrapPdfText
 * function, but operates across run boundaries rather than on a single
 * plain string against a single font.
 *
 * fonts must supply widthOfTextAtSize for each of the four style variants
 * (code uses the regular/non-bold font at the same size, per this pass's
 * scope - no distinct monospace font is introduced).
 */
export function wrapRunsForPdf(
  paragraph: TextRun[],
  fonts: {
    regular: { widthOfTextAtSize(text: string, size: number): number };
    bold: { widthOfTextAtSize(text: string, size: number): number };
    italic: { widthOfTextAtSize(text: string, size: number): number };
    boldItalic: { widthOfTextAtSize(text: string, size: number): number };
  },
  size: number,
  maxWidth: number,
): DrawableLine[] {
  if (paragraph.length === 0) return [[]];

  const lines: DrawableLine[] = [];
  let currentLine: DrawableLine = [];
  let currentLineWidth = 0;
  
  const spaceWidths = {
    regular: fonts.regular.widthOfTextAtSize(' ', size),
    bold: fonts.bold.widthOfTextAtSize(' ', size),
    italic: fonts.italic.widthOfTextAtSize(' ', size),
    boldItalic: fonts.boldItalic.widthOfTextAtSize(' ', size),
    code: fonts.regular.widthOfTextAtSize(' ', size),
  };

  for (const run of paragraph) {
    let fontVariant: DrawableRunFragment['font'] = 'regular';
    if (run.code) {
      fontVariant = 'code';
    } else if (run.bold && run.italic) {
      fontVariant = 'boldItalic';
    } else if (run.bold) {
      fontVariant = 'bold';
    } else if (run.italic) {
      fontVariant = 'italic';
    }

    const fontMetric = fontVariant === 'code' ? fonts.regular : fonts[fontVariant];
    const spaceW = spaceWidths[fontVariant];

    const segments = run.text.split(/\r?\n/);
    for (let i = 0; i < segments.length; i++) {
      if (i > 0) {
        lines.push(currentLine);
        currentLine = [];
        currentLineWidth = 0;
      }

      const segment = segments[i]!;
      const words = segment.split(/\s+/).filter(Boolean);

      for (const word of words) {
        const wordWidth = fontMetric.widthOfTextAtSize(word, size);
        const isFirstWordInLine = currentLine.length === 0;

        if (!isFirstWordInLine && currentLineWidth + spaceW + wordWidth > maxWidth) {
          lines.push(currentLine);
          currentLine = [];
          currentLineWidth = 0;
        }

        if (currentLine.length > 0 && currentLine[currentLine.length - 1]!.font === fontVariant) {
          currentLine[currentLine.length - 1]!.text += ' ' + word;
          currentLineWidth += spaceW + wordWidth;
        } else {
          const prefix = currentLine.length > 0 ? ' ' : '';
          currentLine.push({ text: prefix + word, font: fontVariant });
          currentLineWidth += (prefix ? spaceW : 0) + wordWidth;
        }
      }
    }
  }
  
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [[]];
}

function wrapPdfText(
  text: string,
  font: { widthOfTextAtSize(text: string, size: number): number },
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines;
}

async function resolveCommitteeName(db: any, committeeId: string): Promise<string | null> {
  const [c] = await db
    .select({ name: committees.name })
    .from(committees)
    .where(eq(committees.id, committeeId))
    .limit(1);
  return c?.name ?? null;
}

async function resolveReportDocumentSummary(
  db: any,
  documentId: string | null,
): Promise<{
  reportDocumentId: string | null;
  reportDocumentTitle: string | null;
  reportDocumentUrl: string | null;
}> {
  if (!documentId) {
    return { reportDocumentId: null, reportDocumentTitle: null, reportDocumentUrl: null };
  }
  const [subDoc] = await db
    .select({ title: documents.title })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!subDoc) {
    // contribution_document_id predates real document uploads (LOG-0219) —
    // it may hold an engine-generated UUID with no backing document row.
    return { reportDocumentId: null, reportDocumentTitle: null, reportDocumentUrl: null };
  }
  const [latestVersion] = await db
    .select({ fileKey: versions.fileKey })
    .from(versions)
    .where(eq(versions.documentId, documentId))
    .orderBy(desc(versions.versionNumber))
    .limit(1);
  let reportDocumentUrl: string | null = null;
  if (latestVersion?.fileKey) {
    try {
      reportDocumentUrl = await buildViewUrl(latestVersion.fileKey);
    } catch {
      reportDocumentUrl = null;
    }
  }
  return { reportDocumentId: documentId, reportDocumentTitle: subDoc.title, reportDocumentUrl };
}

async function resolveCommitteeReportTypeId(db: any, cityId: string): Promise<string> {
  const [dt] = await db
    .select({ id: documentTypes.id })
    .from(documentTypes)
    .where(
      and(
        eq(documentTypes.code, COMMITTEE_REPORT_TYPE_CODE),
        eq(documentTypes.cityId, cityId),
        isNull(documentTypes.deletedAt),
      ),
    )
    .limit(1);
  if (!dt) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Document type ${COMMITTEE_REPORT_TYPE_CODE} is not configured for this city. Run the document-types seed.`,
    });
  }
  return dt.id;
}

function getOrgService(ctx: Context) {
  return ctx.req.server.organizationService;
}

async function resolveAssigneeName(db: any, assigneeId: string): Promise<string> {
  const [userRec] = await db
    .select({
      username: users.username,
      firstName: employees.firstName,
      lastName: employees.lastName,
    })
    .from(users)
    .leftJoin(employees, eq(users.id, employees.userId))
    .where(eq(users.id, assigneeId))
    .limit(1);

  if (!userRec) return assigneeId;
  if (userRec.firstName && userRec.lastName) {
    return `${userRec.firstName} ${userRec.lastName}`;
  }
  return userRec.username || assigneeId;
}

async function checkWorkflowInstanceReadPermission(
  ctx: Context,
  doc: any,
  tx: any = ctx.db,
): Promise<boolean> {
  if (!ctx.auth) return false;
  const roles = ctx.auth.roles;
  const effRoles = ctx.auth.effectiveRoles || [];
  const userRoles = new Set([...roles, ...effRoles]);

  const allowedRoles = new Set([
    'dept_encoder',
    'dept_approver',
    'sp_secretary',
    'sp_member',
    'sp_presiding_officer',
    'mayor',
    'brgy_encoder',
    'brgy_captain',
    'records_officer',
    'auditor',
    'plat_admin',
  ]);
  const hasAllowedRole = [...userRoles].some((r) => allowedRoles.has(r));

  const effectiveOfficeIds = new Set(ctx.auth.effectiveOfficeIds || []);
  const isOwnOffice =
    effectiveOfficeIds.has(doc.ownedByOfficeId) || effectiveOfficeIds.has(doc.originatingOfficeId);

  // 1. Own-office instances and has allowed role
  if (isOwnOffice && hasAllowedRole) {
    return true;
  }

  // 2. SP Secretary: all instances for SP Secretariat scope
  if (userRoles.has('sp_secretary')) {
    const [docOffice] = await tx
      .select({ code: offices.code })
      .from(offices)
      .where(eq(offices.id, doc.ownedByOfficeId))
      .limit(1);
    if (docOffice?.code === 'SP' || docOffice?.code === 'SPS') {
      return true;
    }
  }

  // 2b. SP Member: read access for SP/SPS-owned documents (committee work, OoB, session voting).
  // ABAC for mutating actions is enforced per-procedure; read access is granted here for the
  // same reason sp_presiding_officer gets cross-office read. [LOG-0255-FIX]
  if (userRoles.has('sp_member')) {
    const [docOffice] = await tx
      .select({ code: offices.code })
      .from(offices)
      .where(eq(offices.id, doc.ownedByOfficeId))
      .limit(1);
    if (docOffice?.code === 'SP' || docOffice?.code === 'SPS') {
      return true;
    }
  }

  // 3. Cross-office read
  const crossOfficeRoles = new Set(['records_officer', 'sp_presiding_officer', 'mayor', 'auditor']);
  const hasCrossRole = [...userRoles].some((r) => crossOfficeRoles.has(r));
  const isPublicOrInternal =
    doc.classificationLevel === 'public' || doc.classificationLevel === 'internal';

  if (hasCrossRole && isPublicOrInternal) {
    return true;
  }

  return false;
}

// ─── Step context fetch helper ───────────────────────────────────────────────

/**
 * Fetches a step_instances row with all attributes required by StepInstanceAttrs
 * (for WorkflowPolicyGuard) and the parent instance/document rows needed by the
 * engine handlers. Returns null when the step instance does not exist.
 *
 * Caller is responsible for throwing NOT_FOUND on a null result.
 *
 * `isFinalApprovalStep` is sourced from `steps.config['is_final_approval']`
 * (JSONB), consistent with how approval.handler.ts checks it.
 * [Finding — LOG-0049]
 */
async function fetchStepContext(
  stepInstanceId: string,
  ctx: Context,
): Promise<{
  stepInstance: typeof stepInstances.$inferSelect;
  step: typeof steps.$inferSelect;
  instance: typeof instances.$inferSelect;
  doc: typeof documents.$inferSelect;
  stepAttrs: StepInstanceAttrs;
} | null> {
  const db = ctx.db;

  const rows = await db
    .select({
      stepInstance: stepInstances,
      step: steps,
      instance: instances,
      doc: documents,
    })
    .from(stepInstances)
    .innerJoin(steps, eq(stepInstances.stepId, steps.id))
    .innerJoin(instances, eq(stepInstances.instanceId, instances.id))
    .innerJoin(documents, eq(instances.documentId, documents.id))
    .where(and(eq(stepInstances.id, stepInstanceId), isNull(stepInstances.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const { stepInstance, step, instance, doc } = row;

  // Extract assignee from JSONB array (first element, per policy guard contract).
  // assigned_to is stored as [{ user_id?: string, office_id?: string }, ...]
  const assignedTo =
    (stepInstance.assignedTo as Array<{ user_id?: string; office_id?: string }>) ?? [];
  const assigneeUserId = assignedTo[0]?.user_id ?? null;
  const assigneeOfficeId = assignedTo[0]?.office_id ?? null;

  // Extract assigned committees from metadata (for multi_referral step ABAC)
  const metadata = (stepInstance.metadata as Record<string, any>) ?? {};
  const assignedCommittees =
    (metadata['assigned_committees'] as Array<{ committee_id: string }>) ?? [];
  const assignedCommitteeIds = assignedCommittees.map((c) => c.committee_id);

  // isFinalApprovalStep lives in steps.config['is_final_approval'] (JSONB)
  const config = (step.config as Record<string, any>) ?? {};
  const isFinalApprovalStep = config['is_final_approval'] === true;

  const stepAttrs: StepInstanceAttrs = {
    stepStatus: stepInstance.status as StepInstanceAttrs['stepStatus'],
    stepType: step.stepType as StepInstanceAttrs['stepType'],
    stepKey: step.stepKey,
    isFinalApprovalStep,
    assigneeUserId,
    assigneeOfficeId,
    assignedCommitteeIds,
    instanceCreatedBy: instance.createdBy,
    documentCreatedBy: doc.createdBy,
  };

  return { stepInstance, step, instance, doc, stepAttrs };
}

function enforceRoles(ctx: Context, allowedRoles: string[]) {
  const roles = ctx.auth?.roles || [];
  const effRoles = ctx.auth?.effectiveRoles || [];
  const userRoles = new Set([...roles, ...effRoles]);

  const hasRole = allowedRoles.some((r) => userRoles.has(r));
  if (!hasRole) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action.',
    });
  }
}

export function computeMayorPanelHint(
  mayorActionDeadline: string | null | undefined,
  lapseConfirmedAt: unknown,
): 'mayor_decision' | 'mayor_lapse_confirmation' {
  if (mayorActionDeadline) {
    const deadline = new Date(mayorActionDeadline);
    const lapseConfirmed = !!lapseConfirmedAt;
    if (Date.now() > deadline.getTime() && !lapseConfirmed) {
      return 'mayor_lapse_confirmation';
    }
  }
  return 'mayor_decision';
}

function computePanelHint(
  status: 'Active' | 'Completed' | 'Cancelled',
  currentStepType: string,
  currentStep: any,
  instance: any,
  spsOfficeId?: string,
):
  | 'multi_referral'
  | 'vp_certification'
  | 'transmittal_letter'
  | 'mayor_decision'
  | 'mayor_lapse_confirmation'
  | 'veto_override_recording'
  | 'docketing'
  | 'panlalawigan_outcome'
  | 'publication_date'
  | 'returned_review_decision'
  | 'legal_office_review_decision'
  | 'committee_revisions_decision'
  | 'valid_in_part_decision'
  | 'secretariat_decision'
  | 'order_of_business_scheduling'
  | 'final_number_assignment'
  | 'amendments_logging'
  | 'generic_action'
  | 'generic_approval'
  | null {
  if (status !== 'Active' || !currentStep) return null;

  const { stepKey, metadata, config } = currentStep;
  const instanceContext = (instance.context as Record<string, any>) || {};
  const stepMetadata = (metadata as Record<string, any>) || {};

  if (currentStepType === 'multi_referral') {
    return 'multi_referral';
  } else if (stepKey === 'vp_certification') {
    return 'vp_certification';
  } else if (stepKey === 'transmittal_letter_to_mayor') {
    return 'transmittal_letter';
  } else if (stepKey === 'mayor_review' || stepKey === 'mayor_signature') {
    return computeMayorPanelHint(
      instanceContext['mayor_action_deadline'],
      stepMetadata['lapse_confirmed_at'],
    );
  } else if (stepKey === 'veto_override_vote') {
    return 'veto_override_recording';
  } else if (stepKey === 'docketing') {
    return 'docketing';
  } else if (stepKey === 'panlalawigan_review') {
    return 'panlalawigan_outcome';
  } else if (stepKey === 'newspaper_publication') {
    return 'publication_date';
  } else if (stepKey === 'returned_review') {
    return 'returned_review_decision';
  } else if (stepKey === 'legal_office_review') {
    return 'legal_office_review_decision';
  } else if (stepKey === 'committee_revisions_review') {
    return 'committee_revisions_decision';
  } else if (stepKey === 'valid_in_part_decision') {
    return 'valid_in_part_decision';
  } else if (
    currentStepType === 'approval' &&
    spsOfficeId &&
    (currentStep.assignedTo as Array<any>)?.[0]?.office_id === spsOfficeId
  ) {
    return 'secretariat_decision';
  } else if (stepKey === 'order_of_business_scheduling') {
    return 'order_of_business_scheduling';
  } else if (stepKey === 'final_number_assignment') {
    return 'final_number_assignment';
  } else if (stepKey === 'amendments_logging') {
    return 'amendments_logging';
  } else if (currentStepType === 'action') {
    return 'generic_action';
  } else if (currentStepType === 'approval') {
    return 'generic_approval';
  }

  return null;
}
function getHumanReadableStepName(stepName: string | null, stepKey: string | null, stepType: string | null): string | null {
  if (!stepName) return null;
  const lower = stepName.toLowerCase();
  if (!['action', 'decision', 'review', 'approval', 'multi_referral'].includes(lower)) {
    return stepName;
  }
  
  if (!stepKey) return stepName;
  
  const map: Record<string, string> = {
    'sec_action': 'Secretariat Action',
    'vp_certification': 'VP Certification',
    'mayor_review': 'Mayor Review',
    'mayor_signature': 'Mayor Signature',
    'veto_override_vote': 'Veto Override Vote',
    'docketing': 'Docketing',
    'panlalawigan_review': 'Panlalawigan Review',
    'newspaper_publication': 'Newspaper Publication',
    'returned_review': 'Returned Review',
    'legal_office_review': 'Legal Office Review',
    'committee_revisions_review': 'Committee Revisions Review',
    'valid_in_part_decision': 'Valid In Part Decision',
    'committee_referral': 'Committee Referral',
    'start': 'Start',
    'end': 'End',
  };

  if (map[stepKey]) return map[stepKey];

  return stepKey
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Build a user-friendly action description for routing history entries.
 * Uses the step's human-readable label and a meaningful outcome verb
 * instead of raw technical strings like "action DONE".
 */
function buildActionDescription(
  stepLabel: string | null,
  stepKey: string,
  outcome: string,
): string {
  const name =
    stepLabel ||
    stepKey
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  const OUTCOME_VERBS: Record<string, string> = {
    DONE: 'completed',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    RETURNED_FOR_REVISION: 'returned for revision',
    SIGNED: 'signed',
    VETOED: 'vetoed',
    REPORT_ACCEPTED: 'committee report accepted',
    SECRETARY_ADVANCED: 'manually advanced by SP Secretary',
    LAPSED_CONFIRMED: 'mayor lapse confirmed — document deemed approved (RA 7160 §47)',
    DEEMED_APPROVED_CONFIRMED:
      'Panlalawigan deemed approval confirmed — 30-day window lapsed (RA 7160 §56-d)',
    VALID: 'affirmed in entirety by Panlalawigan',
    VALID_IN_PART: 'approved with partial invalidity by Panlalawigan',
    RETURNED: 'returned with objections by Panlalawigan',
    OPERATIVE_IN_ITS_ENTIRETY: 'affirmed in entirety by Panlalawigan',
  };

  const verb = OUTCOME_VERBS[outcome] ?? outcome.toLowerCase().replace(/_/g, ' ');
  return `${name} — ${verb}`;
}

export function createWorkflowRouter() {
  return router({
    // Queries
    getInstance: protectedProcedure
      .input(z.object({ instanceId: z.string().uuid() }))
      .output(
        z.object({
          instanceId: z.string().uuid(),
          documentId: z.string().uuid(),
          documentTitle: z.string().nullable(),
          definitionVersionId: z.string().uuid(),
          currentStepType: z.enum([
            'action',
            'approval',
            'multi_referral',
            'decision',
            'notification',
            'termination',
            'parallel_split',
            'parallel_join',
          ]),
          currentStepInstanceId: z.string().uuid(),
          currentStepKey: z.string().nullable(),
          currentStepName: z.string().nullable(),
          currentAssigneeUserId: z.string().uuid().nullable(),
          currentAssigneeName: z.string().nullable(),
          status: z.enum(['Active', 'Completed', 'Cancelled']),
          slaDeadline: z.coerce.date().nullable(),
          lapseStatus: z.enum(['mayor_10_day_lapsed', 'panlalawigan_30_day_deemed']).nullable(),
          panelHint: z
            .enum([
              'multi_referral',
              'vp_certification',
              'transmittal_letter',
              'mayor_decision',
              'mayor_lapse_confirmation',
              'veto_override_recording',
              'docketing',
              'panlalawigan_outcome',
              'publication_date',
              'returned_review_decision',
              'legal_office_review_decision',
              'committee_revisions_decision',
              'valid_in_part_decision',
              'secretariat_decision',
              'order_of_business_scheduling',
              'final_number_assignment',
              'amendments_logging',
              'generic_action',
              'generic_approval',
            ])
            .nullable(),
          assignedCommittees: z
            .array(
              z.object({
                committeeId: z.string().uuid(),
                name: z.string().nullable(),
              })
            )
            .nullable(),
          committeeSubmissions: z
            .array(
              z.object({
                committeeId: z.string().uuid(),
                submittedBy: z.string().uuid().nullable(),
                submittedAt: z.coerce.date().nullable(),
                contributionDocumentId: z.string().uuid().nullable(),
                missed: z.boolean(),
                reportText: z.string().nullable(),
                reportDocumentId: z.string().uuid().nullable(),
                reportDocumentTitle: z.string().nullable(),
                reportDocumentUrl: z.string().nullable(),
              })
            )
            .nullable(),
          stepHistory: z.array(
            z.object({
              stepInstanceId: z.string().uuid(),
              stepKey: z.string().nullable(),
              stepName: z.string().nullable(),
              stepType: z.string().nullable(),
              outcome: z.string().nullable(),
              outcomeComment: z.string().nullable(),
              status: z.string(),
              startedAt: z.coerce.date().nullable(),
              completedAt: z.coerce.date().nullable(),
            }),
          ),
          unifiedReportDocumentId: z.string().uuid().nullable(),
          unifiedReportDocumentTitle: z.string().nullable(),
          unifiedReportDocumentUrl: z.string().nullable(),
        }),
      )
      .query(async ({ input, ctx }) => {
        const { instanceId } = input;

        const [instance] = await ctx.db
          .select()
          .from(instances)
          .where(and(eq(instances.id, instanceId), isNull(instances.deletedAt)))
          .limit(1);

        if (!instance) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Workflow instance not found',
          });
        }

        const [doc] = await ctx.db
          .select()
          .from(documents)
          .where(eq(documents.id, instance.documentId))
          .limit(1);

        if (!doc) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Parent document not found',
          });
        }

        const isAllowed = await checkWorkflowInstanceReadPermission(ctx, doc);
        if (!isAllowed) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have permission to view this workflow instance.',
          });
        }

        const currentSteps = await ctx.db
          .select({
            stepInstanceId: stepInstances.id,
            stepType: steps.stepType,
            stepName: steps.label,
            assignedTo: stepInstances.assignedTo,
            stepKey: steps.stepKey,
            metadata: stepInstances.metadata,
            config: steps.config,
          })
          .from(stepInstances)
          .innerJoin(steps, eq(stepInstances.stepId, steps.id))
          .where(and(eq(stepInstances.instanceId, instanceId), isNull(stepInstances.deletedAt)))
          .orderBy(desc(stepInstances.createdAt))
          .limit(1);

        const currentStep = currentSteps[0];
        const assignedUsers = (currentStep?.assignedTo as Array<{ user_id?: string; office_id?: string }>) || [];
        let currentAssigneeUserId: string | null = null;
        let currentAssigneeName: string | null = null;

        if (assignedUsers[0]) {
          const firstAssignee = assignedUsers[0];
          if (firstAssignee.user_id) {
            currentAssigneeUserId = firstAssignee.user_id;
            currentAssigneeName = await resolveAssigneeName(ctx.db, firstAssignee.user_id);
          } else if (firstAssignee.office_id) {
            currentAssigneeUserId = firstAssignee.office_id;
            const [officeRec] = await ctx.db
              .select({ name: offices.name })
              .from(offices)
              .where(eq(offices.id, firstAssignee.office_id))
              .limit(1);
            if (officeRec) {
              currentAssigneeName = officeRec.name;
            } else {
              currentAssigneeName = firstAssignee.office_id;
            }
          }
        }

        let lapseStatus: 'mayor_10_day_lapsed' | 'panlalawigan_30_day_deemed' | null = null;
        const allSteps = await ctx.db
          .select({ outcome: stepInstances.outcome })
          .from(stepInstances)
          .where(and(eq(stepInstances.instanceId, instanceId), isNull(stepInstances.deletedAt)));

        if (allSteps.some((s) => s.outcome === 'LAPSED')) {
          lapseStatus = 'mayor_10_day_lapsed';
        } else if (allSteps.some((s) => s.outcome === 'DEEMED_APPROVED')) {
          lapseStatus = 'panlalawigan_30_day_deemed';
        }

        const historyRows = await ctx.db
          .select({
            stepInstanceId: stepInstances.id,
            stepKey: steps.stepKey,
            stepType: steps.stepType,
            stepName: steps.label,
            outcome: stepInstances.outcome,
            outcomeComment: stepInstances.outcomeComment,
            status: stepInstances.status,
            startedAt: stepInstances.startedAt,
            completedAt: stepInstances.completedAt,
          })
          .from(stepInstances)
          .innerJoin(steps, eq(stepInstances.stepId, steps.id))
          .where(and(eq(stepInstances.instanceId, instanceId), isNull(stepInstances.deletedAt)))
          .orderBy(asc(stepInstances.createdAt));

        const stepHistory = historyRows.map((row) => ({
          stepInstanceId: row.stepInstanceId,
          stepKey: row.stepKey,
          stepName: getHumanReadableStepName(row.stepName, row.stepKey, row.stepType),
          stepType: row.stepType,
          outcome: row.outcome,
          outcomeComment: row.status === 'bypassed' ? null : row.outcomeComment,
          status: row.status,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
        }));

        const statusMap: Record<string, 'Active' | 'Completed' | 'Cancelled'> = {
          completed: 'Completed',
          cancelled: 'Cancelled',
        };
        const status = statusMap[instance.status] || 'Active';

        const validStepTypes = new Set<
          | 'action'
          | 'approval'
          | 'multi_referral'
          | 'decision'
          | 'notification'
          | 'termination'
          | 'parallel_split'
          | 'parallel_join'
        >([
          'action',
          'approval',
          'multi_referral',
          'decision',
          'notification',
          'termination',
          'parallel_split',
          'parallel_join',
        ]);
        const currentStepType =
          currentStep && validStepTypes.has(currentStep.stepType) ? currentStep.stepType : 'action';

        const spsOffice = await getOrgService(ctx).getOfficeByCode(
          SP_SECRETARIAT_OFFICE_CODE,
          ctx.auth!.cityId,
        );
        const panelHint = computePanelHint(
          status,
          currentStepType,
          currentStep,
          instance,
          spsOffice?.officeId,
        );

        let assignedCommittees: Array<{ committeeId: string; name: string | null }> | null = null;
        let committeeSubmissions: Array<{
          committeeId: string;
          submittedBy: string | null;
          submittedAt: Date | null;
          contributionDocumentId: string | null;
          missed: boolean;
          reportText: string | null;
          reportDocumentId: string | null;
          reportDocumentTitle: string | null;
          reportDocumentUrl: string | null;
        }> | null = null;
        let unifiedReportDocumentId: string | null = null;
        let unifiedReportDocumentTitle: string | null = null;
        let unifiedReportDocumentUrl: string | null = null;
        if (currentStepType === 'multi_referral' && currentStep?.metadata) {
          const meta = currentStep.metadata as Record<string, any>;
          const rawAssigned = meta['assigned_committees'] as Array<{ committee_id: string }>;
          if (Array.isArray(rawAssigned) && rawAssigned.length > 0) {
            assignedCommittees = [];
            for (const ac of rawAssigned) {
              const [c] = await ctx.db
                .select({ name: committees.name })
                .from(committees)
                .where(eq(committees.id, ac.committee_id))
                .limit(1);
              assignedCommittees.push({
                committeeId: ac.committee_id,
                name: c?.name || null,
              });
            }
          }
          const rawSubmissions = meta['submissions'] as Array<{
            committee_id: string;
            submitted_by: string | null;
            submitted_at: string | null;
            contribution_document_id: string | null;
            missed?: boolean;
            report_text?: string | null;
          }>;
          if (Array.isArray(rawSubmissions)) {
            committeeSubmissions = [];
            for (const s of rawSubmissions) {
              const report = await resolveReportDocumentSummary(ctx.db, s.contribution_document_id);
              committeeSubmissions.push({
                committeeId: s.committee_id,
                submittedBy: s.submitted_by ?? null,
                submittedAt: s.submitted_at ? new Date(s.submitted_at) : null,
                contributionDocumentId: s.contribution_document_id ?? null,
                missed: s.missed ?? false,
                reportText: s.report_text ?? null,
                reportDocumentId: report.reportDocumentId,
                reportDocumentTitle: report.reportDocumentTitle,
                reportDocumentUrl: report.reportDocumentUrl,
              });
            }
          }
          unifiedReportDocumentId = meta['unified_report_document_id'] ?? null;
          if (unifiedReportDocumentId) {
            const unifiedReport = await resolveReportDocumentSummary(
              ctx.db,
              unifiedReportDocumentId,
            );
            unifiedReportDocumentTitle = unifiedReport.reportDocumentTitle;
            unifiedReportDocumentUrl = unifiedReport.reportDocumentUrl;
          }
        }

        return {
          instanceId: instance.id,
          documentId: instance.documentId,
          documentTitle: doc.title || null,
          definitionVersionId: instance.definitionVersionId,
          currentStepType,
          currentStepName: currentStep ? getHumanReadableStepName(currentStep.stepName, currentStep.stepKey, currentStepType) : null,
          currentStepInstanceId: currentStep
            ? currentStep.stepInstanceId
            : '00000000-0000-0000-0000-000000000000',
          currentStepKey: currentStep?.stepKey ?? null,
          currentAssigneeUserId,
          currentAssigneeName,
          status,
          slaDeadline: instance.slaDeadline,
          lapseStatus,
          panelHint,
          assignedCommittees,
          committeeSubmissions,
          unifiedReportDocumentId,
          unifiedReportDocumentTitle,
          unifiedReportDocumentUrl,
          stepHistory,
        };
      }),

    getActiveInstanceForDocument: protectedProcedure
      .input(z.object({ documentId: z.string().uuid() }))
      .output(
        z
          .object({
            instanceId: z.string().uuid(),
            documentId: z.string().uuid(),
            definitionVersionId: z.string().uuid(),
            currentStepType: z.enum([
              'action',
              'approval',
              'multi_referral',
              'decision',
              'notification',
              'termination',
              'parallel_split',
              'parallel_join',
            ]),
            currentStepName: z.string().nullable(),
            currentStepInstanceId: z.string().uuid(),
            currentAssigneeUserId: z.string().uuid().nullable(),
            currentAssigneeName: z.string().nullable(),
            status: z.enum(['Active', 'Completed', 'Cancelled']),
            slaDeadline: z.coerce.date().nullable(),
            lapseStatus: z.enum(['mayor_10_day_lapsed', 'panlalawigan_30_day_deemed']).nullable(),
            panelHint: z
              .enum([
                'multi_referral',
                'vp_certification',
                'transmittal_letter',
                'mayor_decision',
                'mayor_lapse_confirmation',
                'veto_override_recording',
                'docketing',
                'panlalawigan_outcome',
                'publication_date',
                'returned_review_decision',
                'legal_office_review_decision',
                'committee_revisions_decision',
                'valid_in_part_decision',
                'secretariat_decision',
                'order_of_business_scheduling',
                'final_number_assignment',
                'amendments_logging',
                'generic_action',
                'generic_approval',
              ])
              .nullable(),
          })
          .nullable(),
      )
      .query(async ({ input, ctx }) => {
        const { documentId } = input;

        const [instance] = await ctx.db
          .select()
          .from(instances)
          .where(
            and(
              eq(instances.documentId, documentId),
              eq(instances.status, 'active'),
              isNull(instances.deletedAt),
            ),
          )
          .orderBy(desc(instances.createdAt))
          .limit(1);

        if (!instance) {
          return null;
        }

        const [doc] = await ctx.db
          .select()
          .from(documents)
          .where(eq(documents.id, documentId))
          .limit(1);

        if (!doc) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Parent document not found',
          });
        }

        const isAllowed = await checkWorkflowInstanceReadPermission(ctx, doc);
        if (!isAllowed) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have permission to view this workflow instance.',
          });
        }

        const currentSteps = await ctx.db
          .select({
            stepInstanceId: stepInstances.id,
            stepType: steps.stepType,
            stepName: steps.label,
            assignedTo: stepInstances.assignedTo,
            stepKey: steps.stepKey,
            metadata: stepInstances.metadata,
            config: steps.config,
          })
          .from(stepInstances)
          .innerJoin(steps, eq(stepInstances.stepId, steps.id))
          .where(and(eq(stepInstances.instanceId, instance.id), isNull(stepInstances.deletedAt)))
          .orderBy(desc(stepInstances.createdAt))
          .limit(1);

        const currentStep = currentSteps[0];
        const assignedUsers = (currentStep?.assignedTo as Array<{ user_id: string }>) || [];
        const currentAssigneeUserId = assignedUsers[0]?.user_id || null;

        let lapseStatus: 'mayor_10_day_lapsed' | 'panlalawigan_30_day_deemed' | null = null;
        const allSteps = await ctx.db
          .select({ outcome: stepInstances.outcome })
          .from(stepInstances)
          .where(and(eq(stepInstances.instanceId, instance.id), isNull(stepInstances.deletedAt)));

        if (allSteps.some((s) => s.outcome === 'LAPSED')) {
          lapseStatus = 'mayor_10_day_lapsed';
        } else if (allSteps.some((s) => s.outcome === 'DEEMED_APPROVED')) {
          lapseStatus = 'panlalawigan_30_day_deemed';
        }

        const statusMap: Record<string, 'Active' | 'Completed' | 'Cancelled'> = {
          completed: 'Completed',
          cancelled: 'Cancelled',
        };
        const status = statusMap[instance.status] || 'Active';

        const validStepTypes = new Set<
          | 'action'
          | 'approval'
          | 'multi_referral'
          | 'decision'
          | 'notification'
          | 'termination'
          | 'parallel_split'
          | 'parallel_join'
        >([
          'action',
          'approval',
          'multi_referral',
          'decision',
          'notification',
          'termination',
          'parallel_split',
          'parallel_join',
        ]);
        const currentStepType =
          currentStep && validStepTypes.has(currentStep.stepType) ? currentStep.stepType : 'action';

        const spsOffice = await getOrgService(ctx).getOfficeByCode(
          SP_SECRETARIAT_OFFICE_CODE,
          ctx.auth!.cityId,
        );
        const panelHint = computePanelHint(
          status,
          currentStepType,
          currentStep,
          instance,
          spsOffice?.officeId,
        );

        return {
          instanceId: instance.id,
          documentId: instance.documentId,
          definitionVersionId: instance.definitionVersionId,
          currentStepType,
          currentStepName: currentStep ? getHumanReadableStepName(currentStep.stepName, currentStep.stepKey, currentStepType) : null,
          currentStepInstanceId: currentStep
            ? currentStep.stepInstanceId
            : '00000000-0000-0000-0000-000000000000',
          currentAssigneeUserId,
          currentAssigneeName: currentAssigneeUserId ? await resolveAssigneeName(ctx.db, currentAssigneeUserId) : null,
          status,
          slaDeadline: instance.slaDeadline,
          lapseStatus,
          panelHint,
        };
      }),

    listMyAssignedSteps: protectedProcedure
      .input(paginationInput.extend({ stepKeyIn: z.array(z.string()).optional() }))
      .query(async ({ input, ctx }) => {
        const roles = ctx.auth.roles;
        const effRoles = ctx.auth.effectiveRoles || [];
        const userRoles = new Set([...roles, ...effRoles]);

        const allowedOperationalRoles = new Set([
          'dept_encoder',
          'dept_approver',
          'sp_secretary',
          'sp_member',
          'sp_presiding_officer',
          'mayor',
          'brgy_encoder',
          'brgy_captain',
          'records_officer',
          'auditor',
        ]);
        const hasOperationalRole = [...userRoles].some((r) => allowedOperationalRoles.has(r));
        const seniorRoles = new Set(['sp_presiding_officer', 'mayor', 'auditor']);
        const hasSeniorRole = [...userRoles].some((r) => seniorRoles.has(r));

        const rows = await ctx.db
          .select({
            stepInstanceId: stepInstances.id,
            instanceId: stepInstances.instanceId,
            documentId: instances.documentId,
            documentTitle: documents.title,
            stepType: steps.stepType,
            stepName: steps.label,
            stepKey: steps.stepKey,
            assignedTo: stepInstances.assignedTo,
            createdAt: stepInstances.createdAt,
            slaDeadline: stepInstances.slaDeadline,
            documentOfficeId: documents.ownedByOfficeId,
            instanceContext: instances.context,
            stepMetadata: stepInstances.metadata,
          })
          .from(stepInstances)
          .innerJoin(instances, eq(stepInstances.instanceId, instances.id))
          .innerJoin(documents, eq(instances.documentId, documents.id))
          .innerJoin(steps, eq(stepInstances.stepId, steps.id))
          .where(
            and(
              eq(stepInstances.cityId, ctx.auth.cityId),
              inArray(stepInstances.status, ['active', 'pending']),
              isNull(stepInstances.deletedAt),
              isNull(instances.deletedAt),
              isNull(documents.deletedAt),
              notInArray(documents.lifecycleState, ['cancelled', 'superseded', 'disposed', 'archived', 'completed']),
            ),
          )
          .orderBy(desc(stepInstances.createdAt));

        const allOffices = await ctx.db
          .select({ id: offices.id, code: offices.code })
          .from(offices)
          .where(eq(offices.cityId, ctx.auth.cityId));
        const spOfficeIds = new Set(
          allOffices
            .filter((o) => o.code === 'SP' || o.code === 'SPS' || o.code === 'OVM')
            .map((o) => o.id),
        );

        const subjectUserId = ctx.auth.userId;
        const effectiveOfficeIds = new Set(ctx.auth.effectiveOfficeIds || []);
        const subjectCommitteeIds = new Set<string>(ctx.auth.committeeIds || []);

        const filtered = rows.filter((row) => {
          const assigned =
            (row.assignedTo as Array<{ user_id?: string; office_id?: string }>) || [];

          if (assigned.some((a) => a.user_id === subjectUserId)) {
            console.log(`Matched assigned user_id for step ${row.stepKey}`);
            return true;
          }

          if (hasOperationalRole) {
            if (assigned.some((a) => a.office_id && effectiveOfficeIds.has(a.office_id))) {
              return true;
            }
          }

          if (userRoles.has('sp_secretary') && spOfficeIds.has(row.documentOfficeId)) {
            return true;
          }

          if (hasSeniorRole) {
            return true;
          }

          // multi_referral steps: sp_member sees the step when their committee is assigned.
          // assigned_to is intentionally empty for multi_referral; committees live in metadata.
          // LOG-0215-FIX: missing check was the reason committee chairs saw nothing in My Tasks.
          if (userRoles.has('sp_member') && row.stepType === 'multi_referral') {
            const meta = (row.stepMetadata as Record<string, any>) || {};
            const assignedCommittees =
              (meta['assigned_committees'] as Array<{ committee_id: string }>) || [];
            if (assignedCommittees.some((c) => subjectCommitteeIds.has(c.committee_id))) {
              return true;
            }
          }

          return false;
        });

        const stepKeyFiltered =
          input.stepKeyIn && input.stepKeyIn.length > 0
            ? filtered.filter((row) => input.stepKeyIn!.includes(row.stepKey))
            : filtered;

        const limit = input.limit ?? 50;
        const startIndex = input.cursor ? parseInt(input.cursor, 10) : 0;
        const paginated = stepKeyFiltered.slice(startIndex, startIndex + limit);
        const nextCursor =
          startIndex + limit < stepKeyFiltered.length ? String(startIndex + limit) : null;

        const items = paginated.map((item) => {
          const validStepTypes = new Set<
            | 'action'
            | 'approval'
            | 'multi_referral'
            | 'decision'
            | 'notification'
            | 'termination'
            | 'parallel_split'
            | 'parallel_join'
          >(['action', 'approval', 'multi_referral', 'decision', 'notification', 'termination']);
          const stepType = validStepTypes.has(item.stepType) ? item.stepType : 'action';

          const context = (item.instanceContext as Record<string, any>) || {};
          const metadata = (item.stepMetadata as Record<string, any>) || {};
          const panelHint = MAYOR_STEP_KEYS.has(item.stepKey)
            ? computeMayorPanelHint(
                context['mayor_action_deadline'],
                metadata['lapse_confirmed_at'],
              )
            : null;

          return {
            stepInstanceId: item.stepInstanceId,
            instanceId: item.instanceId,
            documentId: item.documentId,
            documentTitle: item.documentTitle,
            stepType,
            stepName: getHumanReadableStepName(item.stepName, item.stepKey, stepType),
            stepKey: item.stepKey,
            assignedAt: item.createdAt,
            dueAt: item.slaDeadline,
            panelHint,
          };
        });

        return {
          items,
          nextCursor,
        };
      }),

    getSlaComplianceData: protectedProcedure
      .input(
        z.object({
          officeId: z.string().uuid().optional(),
          documentTypeId: z.string().uuid().optional(),
          breachedOnly: z.boolean().default(false),
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
        }),
      )
      .query(async ({ input, ctx }) => {
        workflowPolicy.canAccessSlaData(ctx.auth);

        const conditions = [eq(instances.cityId, ctx.auth.cityId), isNull(instances.deletedAt), isNull(documents.deletedAt)];

        if (input.documentTypeId) {
          conditions.push(eq(documents.documentTypeId, input.documentTypeId));
        }

        if (input.officeId) {
          conditions.push(
            or(
              eq(documents.ownedByOfficeId, input.officeId)!,
              eq(documents.originatingOfficeId, input.officeId)!,
            )!,
          );
        }

        if (input.from) {
          conditions.push(gte(instances.startedAt, input.from));
        }

        if (input.to) {
          conditions.push(lte(instances.startedAt, input.to));
        }

        const rows = await ctx.db
          .select({
            instanceId: instances.id,
            documentId: instances.documentId,
            status: instances.status,
            context: instances.context,
            slaDeadline: instances.slaDeadline,
            slaBreachedAt: instances.slaBreachedAt,
            startedAt: instances.startedAt,
            completedAt: instances.completedAt,
            documentTypeCode: documentTypes.code,
          })
          .from(instances)
          .innerJoin(documents, eq(instances.documentId, documents.id))
          .innerJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
          .where(and(...conditions));

        const slaService = new SlaService();
        const result = [];

        for (const row of rows) {
          const context = (row.context as Record<string, any>) || {};
          let slaClassification: 'simple' | 'complex' | 'highly_technical' = 'simple';
          let slaThresholdDays = 3;

          if (context['sla_classification']) {
            slaClassification = context['sla_classification'];
          } else if (
            row.documentTypeCode === 'SP_RESOLUTION' ||
            row.documentTypeCode === 'SP_ORDINANCE' ||
            row.documentTypeCode === 'SP_APPROPRIATION_ORDINANCE'
          ) {
            slaClassification = 'complex';
          }

          if (context['sla_threshold_days']) {
            slaThresholdDays = context['sla_threshold_days'];
          } else {
            if (slaClassification === 'simple') slaThresholdDays = 3;
            else if (slaClassification === 'complex') slaThresholdDays = 7;
            else if (slaClassification === 'highly_technical') slaThresholdDays = 20;
          }

          const endDate = row.completedAt || new Date();
          const elapsedWorkingDays = await slaService.elapsedWorkingDays(row.startedAt, endDate);

          const isBreached =
            !!row.slaBreachedAt ||
            (row.status === 'active' && !!row.slaDeadline && new Date() > row.slaDeadline);
          const breachedAt = row.slaBreachedAt || (isBreached ? row.slaDeadline : null);

          if (input.breachedOnly && !isBreached) {
            continue;
          }

          result.push({
            instanceId: row.instanceId,
            documentId: row.documentId,
            slaClassification,
            slaThresholdDays,
            elapsedWorkingDays,
            isBreached,
            breachedAt,
          });
        }

        return result;
      }),

    // Mutations

    /**
     * `workflow.completeActionStep`
     *
     * Marks an `action` step as completed and advances the workflow instance.
     * ABAC: I1 §6.2 (role gate + encoder restriction + assignment gate).
     * Emits `workflow.step.completed` to the event bus for downstream audit.
     *
     * Source: E1 §916; I1 §6.2; I2 §6 ("Complete an assigned action step").
     */
    completeActionStep: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          comment: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const sanitizedComment = input.comment ? sanitizeRichText(input.comment) : undefined;
        const { stepInstanceId } = input;
        const comment = sanitizedComment ?? null;

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }

        const { stepInstance, step, instance, stepAttrs } = found;

        // ABAC: delegates all role/assignment/encoder-restriction checks to guard.
        workflowPolicy.canCompleteActionStep(ctx.auth, stepAttrs);

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepAction(
            instance,
            stepInstance,
            ctx.auth!.userId,
            comment,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        // Emit to event bus so audit consumer can create an audit log entry.
        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId,
              stepId: step.id,
              stepType: step.stepType,
              outcome: 'DONE',
              comment,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: buildActionDescription(step.label, step.stepKey, 'DONE'),
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true as const, nextStepType: null };
      }),

    /**
     * `workflow.approveStep`
     *
     * Approves an `approval` step and advances the workflow instance.
     * ABAC: I1 §6.3 (role gate + assignment gate + Invariant #13).
     * Emits `workflow.step.completed` to the event bus for downstream audit.
     *
     * Source: E1 §927; I1 §6.3; I2 §6 ("Complete an assigned approval step (Approve)").
     */
    approveStep: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          comment: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const sanitizedComment = input.comment ? sanitizeRichText(input.comment) : undefined;
        const { stepInstanceId } = input;
        const comment = sanitizedComment ?? null;

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }

        const { stepInstance, step, instance, stepAttrs } = found;

        // ABAC: role gate + assignment gate + Invariant #13 (encoder ≠ final approver).
        workflowPolicy.canApproveStep(ctx.auth, stepAttrs);

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth!.userId,
            'user',
            'APPROVED',
            comment,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId,
              stepId: step.id,
              stepType: step.stepType,
              outcome: 'APPROVED',
              comment,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: buildActionDescription(step.label, step.stepKey, 'APPROVED'),
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true as const };
      }),

    logSecretariatDecision: protectedProcedure
      .input(
        z.object({
          documentId: z.string().uuid(),
          stepInstanceId: z.string().uuid(),
          decision: z.enum(['approve', 'reject', 'amended']),
          remarks: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const sanitizedRemarks = input.remarks ? sanitizeRichText(input.remarks) : undefined;
        const { stepInstanceId, decision } = input;
        const remarks = sanitizedRemarks ?? null;

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }

        const { stepInstance, step, instance, stepAttrs } = found;

        // ABAC: SP Secretary + Office check
        const spsOffice = await getOrgService(ctx).getOfficeByCode(
          SP_SECRETARIAT_OFFICE_CODE,
          ctx.auth.cityId,
        );
        const isSpSecretariatOffice = spsOffice
          ? stepAttrs.assigneeOfficeId === spsOffice.officeId
          : false;

        workflowPolicy.canLogSecretariatDecision(ctx.auth, { isSpSecretariatOffice });

        const outcomeMap: Record<string, string> = {
          approve: 'APPROVED',
          reject: 'REJECTED',
          amended: 'AMENDED',
        };
        const outcome = outcomeMap[decision];

        if (!outcome) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid decision outcome.' });
        }

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth!.userId,
            'user',
            outcome,
            remarks,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId,
              stepId: step.id,
              stepType: step.stepType,
              outcome,
              comment: remarks,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: buildActionDescription(step.label, step.stepKey, outcome),
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true as const };
      }),

    /**
     * `workflow.rejectStep`
     *
     * Rejects an `approval` step (mandatory comment) and advances the workflow.
     * ABAC: I1 §6.3.
     *
     * Source: E1 §927; I1 §6.3; I2 §6 ("Complete an assigned approval step (Reject)").
     */
    rejectStep: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          comment: z.string(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (isRichTextEmpty(input.comment)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Comment is required.' });
        input.comment = sanitizeRichText(input.comment);

        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const { stepInstanceId, comment } = input;

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }

        const { stepInstance, step, instance, stepAttrs } = found;

        workflowPolicy.canApproveStep(ctx.auth, stepAttrs);

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth!.userId,
            'user',
            'REJECTED',
            comment,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId,
              stepId: step.id,
              stepType: step.stepType,
              outcome: 'REJECTED',
              comment,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: buildActionDescription(step.label, step.stepKey, 'REJECTED'),
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true as const };
      }),

    /**
     * `workflow.returnStepForRevision`
     *
     * Returns an `approval` step for revision (mandatory comment).
     * ABAC: I1 §6.3.
     *
     * Source: E1 §927; I1 §6.3; I2 §6 ("Complete an assigned approval step (Return for revision)").
     */
    returnStepForRevision: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          comment: z.string(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (isRichTextEmpty(input.comment)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Comment is required.' });
        input.comment = sanitizeRichText(input.comment);

        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const { stepInstanceId, comment } = input;

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }

        const { stepInstance, step, instance, stepAttrs } = found;

        workflowPolicy.canApproveStep(ctx.auth, stepAttrs);

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth!.userId,
            'user',
            'RETURNED_FOR_REVISION',
            comment,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId,
              stepId: step.id,
              stepType: step.stepType,
              outcome: 'RETURNED_FOR_REVISION',
              comment,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: buildActionDescription(step.label, step.stepKey, 'RETURNED_FOR_REVISION'),
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true as const };
      }),

    /**
     * `workflow.submitApprovalOutcome`
     *
     * Generic outcome-submission procedure for `approval`-type steps whose
     * `allowed_outcomes` do not match any of the hardcoded-outcome procedures
     * (`approveStep`, `rejectStep`, `returnStepForRevision`, `logSecretariatDecision`).
     * The outcome string is validated against the step's own
     * `config.allowed_outcomes` by `submitStepApproval` itself — this procedure
     * does not hardcode or restrict which outcome strings are acceptable beyond
     * requiring a non-empty string; the workflow engine is the source of truth
     * for what's valid on a given step.
     *
     * ABAC: identical to `approveStep`/`rejectStep`/`returnStepForRevision` —
     * reuses `workflowPolicy.canApproveStep` unchanged (role + step-type +
     * step-status + assignment gates; step-key-agnostic).
     *
     * Added by TASK-WF-FE-019 to cover `returned_review`, `legal_office_review`,
     * and `committee_revisions_review`, none of which fit any existing procedure's
     * hardcoded outcome set.
     */
    submitApprovalOutcome: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          outcome: z.string().min(1),
          comment: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const sanitizedComment = input.comment ? sanitizeRichText(input.comment) : undefined;
        const { stepInstanceId, outcome } = input;
        const comment = sanitizedComment ?? null;

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }

        const { stepInstance, step, instance, stepAttrs } = found;

        workflowPolicy.canApproveStep(ctx.auth, stepAttrs);

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth!.userId,
            'user',
            outcome,
            comment,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId,
              stepId: step.id,
              stepType: step.stepType,
              outcome,
              comment,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: buildActionDescription(step.label, step.stepKey, outcome),
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true as const };
      }),

    /**
     * `workflow.assignCommittees`
     *
     * Sets the assigned committees for a multi-referral step.
     */
    assignCommittees: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          committeeIds: z.array(z.string().uuid()).min(1),
          isBypass: z.boolean().optional().default(false),
          comment: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const { stepInstanceId, committeeIds, isBypass, comment } = input;

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }

        const { stepInstance, step, instance, stepAttrs } = found;

        if (step.stepType !== 'multi_referral' || step.stepKey !== 'committee_referral') {
          throw new TRPCError({ code: 'CONFLICT', message: 'This step is not a committee referral step.' });
        }

        workflowPolicy.canAssignCommittees(ctx.auth);

        const resolvedCommittees: Array<{ committeeId: string; name: string }> = [];
        const newAssignedCommittees: Array<{ committee_id: string }> = [];
        
        for (const committeeId of committeeIds) {
          const [c] = await ctx.db
            .select({ name: committees.name })
            .from(committees)
            .where(eq(committees.id, committeeId))
            .limit(1);
            
          if (!c) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'One or more committees could not be found.' });
          }
          resolvedCommittees.push({ committeeId, name: c.name });
          newAssignedCommittees.push({ committee_id: committeeId });
        }

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          await updateAssignedCommittees(
            stepInstance,
            newAssignedCommittees,
            isBypass,
            comment ?? null,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        return {
          success: true as const,
          assignedCommittees: resolvedCommittees,
        };
      }),

    /**
     * `workflow.submitCommitteeReport`
     *
     * Submits a committee report contribution for a multi-referral step.
     * ABAC: I1 §6.6 (committee-scoped `sp_member`, or `sp_secretary`).
     * If all assigned committees have submitted, this orchestrates completion of the step.
     *
     * Source: E1 §938; I1 §6.6
     */
    submitCommitteeReport: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          committeeId: z.string().uuid(),
          reportText: z.string().max(20000).optional(),
          documentId: z.string().uuid().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const { stepInstanceId, committeeId } = input;
        const sanitizedReportText = input.reportText ? sanitizeRichText(input.reportText) : undefined;

        if (isRichTextEmpty(sanitizedReportText) && !input.documentId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Provide report text and/or an uploaded report document.',
          });
        }

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }

        const { stepInstance, instance, stepAttrs } = found;

        // ABAC: committee scoped check
        workflowPolicy.canSubmitCommitteeReport(ctx.auth, stepAttrs);

        // If an uploaded DMS document is referenced, resolve it before wiring it
        // into the engine. Legacy submissions (LOG-0219) recorded a generated
        // UUID here with no backing document row; those are text-only.
        let contributionDocId: string = randomUUID();
        if (input.documentId) {
          const [subDoc] = await ctx.db
            .select({ id: documents.id })
            .from(documents)
            .where(
              and(
                eq(documents.id, input.documentId),
                eq(documents.cityId, ctx.auth.cityId),
                isNull(documents.deletedAt),
              ),
            )
            .limit(1);
          if (!subDoc) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Referenced report document does not exist.',
            });
          }
          contributionDocId = input.documentId;
        }

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        let isCompleted = false;

        await ctx.db.transaction(async (tx) => {
          const txWorkflowRepo = new WorkflowRepository(tx);

          await engineSubmitCommitteeReport(
            instance,
            stepInstance,
            committeeId,
            ctx.auth!.userId,
            contributionDocId,
            { ...deps, db: tx, workflowRepository: txWorkflowRepo },
            tx,
            sanitizedReportText ?? null,
          );

          // After submitting, check if all committees have submitted.
          // The engine handler updates stepInstance in DB, so we must fetch the fresh row
          // inside this transaction to check the updated submissions array.
          const freshStepInstance = await txWorkflowRepo.getStepInstanceById(
            stepInstanceId,
            tx,
          );
          if (!freshStepInstance) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve fresh step instance.',
            });
          }

          const freshMetadata = (freshStepInstance.metadata as Record<string, any>) ?? {};
          const assigned =
            (freshMetadata['assigned_committees'] as Array<{ committee_id: string }>) ?? [];
          const submissions = (freshMetadata['submissions'] as Array<any>) ?? [];

          if (submissions.length >= assigned.length) {
            isCompleted = true; // All assigned committees have submitted
          }
        });

        return { allCommitteesSubmitted: isCompleted };
      }),

    /**
     * `workflow.consolidateCommitteeReports`
     *
     * SP Secretary consolidates the submitted committee reports into a single
     * document: a title page followed by each committee's uploaded PDF (PDF
     * submissions are merged page-by-page; text-only and non-PDF submissions
     * are listed on the title page). The consolidated PDF is stored as a
     * COMMITTEE_REPORT DMS document and its ID is recorded on the step as
     * `metadata.unified_report_document_id`. The secretary reviews it, then
     * completes the step via `workflow.acceptUnifiedReport`.
     *
     * ABAC: reuses I1 §6.8 (sp_secretary only) — consolidation is part of the
     * accept flow.
     */
    consolidateCommitteeReports: protectedProcedure
      .input(
        z.object({
          instanceId: z.string().uuid(),
          stepInstanceId: z.string().uuid(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }
        const { instanceId, stepInstanceId } = input;

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }

        const { stepInstance, instance } = found;

        if (instance.id !== instanceId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Instance ID mismatch.' });
        }

        workflowPolicy.canAcceptUnifiedReport(ctx.auth);

        if (found.step.stepType !== 'multi_referral') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not a multi-referral step.' });
        }

        if (stepInstance.status !== 'active') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Step is not active.' });
        }

        const metadata = (stepInstance.metadata as Record<string, any>) ?? {};
        const assignedCommittees =
          (metadata['assigned_committees'] as Array<{ committee_id: string }>) ?? [];
        const submissions = (metadata['submissions'] as Array<any>) ?? [];
        const nonMissedSubmissions = submissions.filter((s) => !s.missed);

        if (
          nonMissedSubmissions.length < assignedCommittees.length &&
          metadata['manual_advance'] !== true
        ) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'All assigned committees must submit before the reports can be consolidated.',
          });
        }

        // ---- Gather source PDFs + title-page entries -----------------------
        const sourceEntries: Array<{
          title: string;
          submittedAt: string | null;
          status: 'merged' | 'text_only' | 'not_merged';
        }> = [];
        const sourcePdfBuffers: Buffer[] = [];
        const textOnlyContents: Array<{ committeeName: string; text: string }> = [];
        let mergedPageCount = 0;
        let textOnlyCount = 0;
        let skippedCount = 0;

        for (const sub of nonMissedSubmissions) {
          const committeeName = await resolveCommitteeName(ctx.db, sub.committee_id);
          let entryTitle = committeeName ?? sub.committee_id;
          let status: 'merged' | 'text_only' | 'not_merged' = 'text_only';

          if (sub.contribution_document_id) {
            const [subDoc] = await ctx.db
              .select({ id: documents.id, title: documents.title })
              .from(documents)
              .where(eq(documents.id, sub.contribution_document_id))
              .limit(1);
            if (subDoc) {
              entryTitle = subDoc.title || committeeName || subDoc.id;
              const [latestVersion] = await ctx.db
                .select({ fileKey: versions.fileKey, mimeType: versions.mimeType })
                .from(versions)
                .where(eq(versions.documentId, subDoc.id))
                .orderBy(desc(versions.versionNumber))
                .limit(1);
              if (latestVersion?.fileKey && latestVersion.mimeType === 'application/pdf') {
                const bytes = await fetchS3Object(latestVersion.fileKey);
                try {
                  const { PDFDocument } = await import('pdf-lib');
                  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
                  sourcePdfBuffers.push(bytes);
                  mergedPageCount += src.getPageCount();
                  status = 'merged';
                } catch {
                  status = 'not_merged';
                  skippedCount++;
                }
              } else {
                status = 'not_merged';
                skippedCount++;
              }
            }
          } else if (sub.report_text) {
            textOnlyCount++;
          }

          if (sub.report_text) {
            textOnlyContents.push({ committeeName: committeeName ?? sub.committee_id, text: sub.report_text });
          }

          sourceEntries.push({
            title: entryTitle,
            submittedAt: sub.submitted_at ?? null,
            status,
          });
        }

        if (sourcePdfBuffers.length === 0 && textOnlyCount === 0 && sourceEntries.length === 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'No committee report content is available to consolidate.',
          });
        }

        // ---- Build the consolidated PDF ------------------------------------
        const { PDFDocument: PDFDoc, rgb, StandardFonts } = await import('pdf-lib');
        const outPdf = await PDFDoc.create();
        const helveticaBold = await outPdf.embedFont(StandardFonts.HelveticaBold);
        const helvetica = await outPdf.embedFont(StandardFonts.Helvetica);
        const helveticaOblique = await outPdf.embedFont(StandardFonts.HelveticaOblique);
        const helveticaBoldOblique = await outPdf.embedFont(StandardFonts.HelveticaBoldOblique);

        const pageW = 595.28;
        const pageH = 841.89;
        const titlePage = outPdf.addPage([pageW, pageH]);

        titlePage.drawText('REPUBLIC OF THE PHILIPPINES', {
          x: 60,
          y: pageH - 90,
          size: 13,
          font: helvetica,
          color: rgb(0.2, 0.2, 0.2),
        });
        titlePage.drawText('SANGGUNIANG PANLUNGSOD NG BATAC', {
          x: 60,
          y: pageH - 112,
          size: 16,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });

        titlePage.drawText('CONSOLIDATED COMMITTEE REPORT', {
          x: 60,
          y: pageH - 170,
          size: 20,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });

        const measureTitle = found.doc.title ?? 'Legislative measure';

        const measureTitleLine = `Measure: ${measureTitle}`;
        titlePage.drawText(measureTitleLine, {
          x: 60,
          y: pageH - 200,
          size: 12,
          font: helvetica,
          color: rgb(0, 0, 0),
          maxWidth: pageW - 120,
        });

        titlePage.drawText('Submitted to the SP Secretariat', {
          x: 60,
          y: pageH - 240,
          size: 12,
          font: helvetica,
          color: rgb(0.2, 0.2, 0.2),
        });

        titlePage.drawText('Committee Reports Included', {
          x: 60,
          y: pageH - 290,
          size: 12,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });

        let listY = pageH - 318;
        for (const entry of sourceEntries) {
          const dateSuffix = entry.submittedAt
            ? ` (${new Date(entry.submittedAt).toLocaleDateString('en-PH')})`
            : '';
          const statusSuffix =
            entry.status === 'merged'
              ? ' — PDF merged'
              : entry.status === 'not_merged'
                ? ' — attachment submitted, not merged (non-PDF)'
                : ' — text-only report';
          titlePage.drawText(`• ${entry.title}${dateSuffix}${statusSuffix}`, {
            x: 60,
            y: listY,
            size: 10,
            font: helvetica,
            color: rgb(0, 0, 0),
            maxWidth: pageW - 120,
          });
          listY -= 18;
        }

        titlePage.drawText(
          `Consolidated by the SP Secretariat on ${new Date().toLocaleDateString('en-PH')}`,
          {
            x: 60,
            y: 60,
            size: 9,
            font: helvetica,
            color: rgb(0.4, 0.4, 0.4),
          },
        );

        // Render text-only committee reports as PDF pages (word-wrapped).
        let textReportPagesCount = 0;
        if (textOnlyContents.length > 0) {
          const textSize = 11;
          const textLineHeight = 16;
          const contentMaxWidth = pageW - 120;
          const contentTopY = pageH - 100;
          const contentBottomY = 70;

          const courier = await outPdf.embedFont(StandardFonts.Courier);

          const fontsForWrapping = {
            regular: helvetica,
            bold: helveticaBold,
            italic: helveticaOblique,
            boldItalic: helveticaBoldOblique,
          };
          const fontByVariant: Record<DrawableRunFragment['font'], typeof helvetica> = {
            regular: helvetica,
            bold: helveticaBold,
            italic: helveticaOblique,
            boldItalic: helveticaBoldOblique,
            code: helvetica,
          };

          for (const item of textOnlyContents) {
            let textPage = outPdf.addPage([pageW, pageH]);
            textReportPagesCount++;
            let textY = contentTopY;

            textPage.drawText(item.committeeName, {
              x: 60,
              y: textY,
              size: 13,
              font: helveticaBold,
              color: rgb(0, 0, 0),
              maxWidth: contentMaxWidth,
            });
            textY -= 24;

            const activeRules: { marginX: number; startY: number; page: any; color: any; width: number }[] = [];

            const checkPageOverflow = () => {
              if (textY < contentBottomY) {
                for (const rule of activeRules) {
                  rule.page.drawRectangle({
                    x: rule.marginX,
                    y: textY + 12,
                    width: rule.width,
                    height: rule.startY - (textY + 12),
                    color: rule.color,
                  });
                }
                textPage = outPdf.addPage([pageW, pageH]);
                textReportPagesCount++;
                textY = contentTopY;
                for (const rule of activeRules) {
                  rule.startY = textY + 12;
                  rule.page = textPage;
                }
              }
            };

            const drawBlock = (block: PdfBlock, marginX: number, forceItalic: boolean) => {
              if (block.type === 'paragraph') {
                const lines = wrapRunsForPdf(block.runs, fontsForWrapping, textSize, contentMaxWidth - (marginX - 60));
                for (const line of lines) {
                  checkPageOverflow();
                  let cursorX = marginX;
                  for (const fragment of line) {
                    const variant = forceItalic ? (fragment.font === 'bold' || fragment.font === 'boldItalic' ? 'boldItalic' : 'italic') : fragment.font;
                    const font = fontByVariant[variant === 'code' ? 'regular' : variant];
                    textPage.drawText(fragment.text, { x: cursorX, y: textY, size: textSize, font, color: rgb(0, 0, 0) });
                    cursorX += font.widthOfTextAtSize(fragment.text, textSize);
                  }
                  textY -= textLineHeight;
                }
              } else if (block.type === 'heading') {
                const hSize = PDF_REPORT_STYLE.headingSizes[`h${block.level}` as keyof typeof PDF_REPORT_STYLE.headingSizes];
                textY -= PDF_REPORT_STYLE.headingSpacingBefore;
                const lines = wrapRunsForPdf(block.runs, fontsForWrapping, hSize, contentMaxWidth - (marginX - 60));
                for (const line of lines) {
                  checkPageOverflow();
                  let cursorX = marginX;
                  for (const fragment of line) {
                    const variant = forceItalic ? (fragment.font === 'bold' || fragment.font === 'boldItalic' ? 'boldItalic' : 'italic') : fragment.font;
                    const font = fontByVariant[variant === 'code' ? 'regular' : variant];
                    textPage.drawText(fragment.text, { x: cursorX, y: textY, size: hSize, font, color: rgb(0, 0, 0) });
                    cursorX += font.widthOfTextAtSize(fragment.text, hSize);
                  }
                  textY -= (hSize + 4);
                }
                textY -= PDF_REPORT_STYLE.headingSpacingAfter;
              } else if (block.type === 'blockquote') {
                const ruleMarginX = marginX;
                const newMarginX = marginX + PDF_REPORT_STYLE.blockquote.leftPadding;
                const rule = {
                  marginX: ruleMarginX,
                  startY: textY + 12,
                  page: textPage,
                  color: rgb(...PDF_REPORT_STYLE.blockquote.ruleColorRgb),
                  width: PDF_REPORT_STYLE.blockquote.ruleWidth,
                };
                activeRules.push(rule);

                for (const b of block.blocks) {
                  drawBlock(b, newMarginX, PDF_REPORT_STYLE.blockquote.italic || forceItalic);
                }

                activeRules.pop();
                rule.page.drawRectangle({
                  x: rule.marginX,
                  y: textY + 12,
                  width: rule.width,
                  height: rule.startY - (textY + 12),
                  color: rule.color,
                });
              } else if (block.type === 'list') {
                const newMarginX = marginX + PDF_REPORT_STYLE.list.indentPerLevel;
                for (let i = 0; i < block.items.length; i++) {
                  const item = block.items[i]!;
                  checkPageOverflow();
                  const bullet = block.ordered ? `${i + 1}${PDF_REPORT_STYLE.list.orderedSeparator}` : PDF_REPORT_STYLE.list.bulletChar;

                  textPage.drawText(bullet, {
                    x: marginX,
                    y: textY,
                    size: textSize,
                    font: helvetica,
                    color: rgb(0, 0, 0),
                  });

                  const initialTextY = textY;
                  for (const b of item) {
                    drawBlock(b, newMarginX, forceItalic);
                  }

                  if (initialTextY === textY) {
                    textY -= textLineHeight;
                  }
                }
              } else if (block.type === 'codeBlock') {
                const codeMaxWidth = contentMaxWidth - (marginX - 60) - PDF_REPORT_STYLE.codeBlock.leftPadding;
                const lines = wrapPdfText(block.text, courier, textSize, codeMaxWidth);

                checkPageOverflow();
                textPage.drawRectangle({
                  x: marginX,
                  y: textY + 12,
                  width: contentMaxWidth - (marginX - 60),
                  height: PDF_REPORT_STYLE.codeBlock.topBottomPadding,
                  color: rgb(...PDF_REPORT_STYLE.codeBlock.backgroundColorRgb),
                });

                for (const line of lines) {
                  checkPageOverflow();
                  textPage.drawRectangle({
                    x: marginX,
                    y: textY - 4,
                    width: contentMaxWidth - (marginX - 60),
                    height: textLineHeight,
                    color: rgb(...PDF_REPORT_STYLE.codeBlock.backgroundColorRgb),
                  });
                  textPage.drawText(line, {
                    x: marginX + PDF_REPORT_STYLE.codeBlock.leftPadding,
                    y: textY,
                    size: textSize,
                    font: courier,
                    color: rgb(0, 0, 0),
                  });
                  textY -= textLineHeight;
                }

                checkPageOverflow();
                textPage.drawRectangle({
                  x: marginX,
                  y: textY + 12 - PDF_REPORT_STYLE.codeBlock.topBottomPadding,
                  width: contentMaxWidth - (marginX - 60),
                  height: PDF_REPORT_STYLE.codeBlock.topBottomPadding,
                  color: rgb(...PDF_REPORT_STYLE.codeBlock.backgroundColorRgb),
                });
                textY -= PDF_REPORT_STYLE.codeBlock.topBottomPadding;
              }
            };

            const blocks = parseRichTextForPdf(item.text);
            for (const block of blocks) {
              drawBlock(block, 60, false);
            }
          }
        }

        // Merge each source PDF page-by-page (pdf-lib page copying).
        for (const bytes of sourcePdfBuffers) {
          const src = await PDFDoc.load(bytes, { ignoreEncryption: true });
          const pages = await outPdf.copyPages(src, src.getPageIndices());
          for (const page of pages) {
            outPdf.addPage(page);
          }
        }

        const outBytes = await outPdf.save();

        // ---- Persist as a COMMITTEE_REPORT DMS document --------------------
        const documentsRepository = ctx.req.server.documentsRepository;

        const committeeReportTypeId = await resolveCommitteeReportTypeId(
          ctx.db,
          ctx.auth.cityId,
        );
        const spsOffice = await getOrgService(ctx).getOfficeByCode(
          SP_SECRETARIAT_OFFICE_CODE,
          ctx.auth.cityId,
        );
        if (!spsOffice) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'SP Secretariat office (code SPS) is not configured for this city.',
          });
        }

        const documentType = await documentsRepository.findDocumentTypeById(
          committeeReportTypeId,
        );
        if (!documentType || !documentType.retentionScheduleId) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Document type ${COMMITTEE_REPORT_TYPE_CODE} is missing a retention schedule.`,
          });
        }

        const retentionScheduleId = documentType.retentionScheduleId;

        const unifiedTitle = `Unified Committee Report — ${measureTitle}`;
        const s3Key = randomUUID();
        await putS3Object(s3Key, Buffer.from(outBytes), 'application/pdf');

        let createdDocumentId: string;
        await ctx.db.transaction(async (tx) => {
          const txDocumentsRepository = new DocumentsRepository(tx);
          const created = await txDocumentsRepository.insertDocument({
            cityId: ctx.auth!.cityId,
            documentTypeId: committeeReportTypeId,
            title: unifiedTitle,
            lifecycleState: 'draft',
            classificationLevel: 'internal',
            qrTrackingNumber: randomUUID(),
            originatingOfficeId: spsOffice.officeId,
            ownedByOfficeId: spsOffice.officeId,
            createdBy: ctx.auth!.userId,
            versionNumber: 1,
            metadata: {
              step_instance_id: stepInstanceId,
              measure_document_id: instance.documentId,
              committee_id: null,
            },
            retentionScheduleId,
          });
          createdDocumentId = created.id;

          await txDocumentsRepository.insertVersion({
            cityId: ctx.auth!.cityId,
            documentId: created.id,
            versionNumber: 1,
            fileKey: s3Key,
            originalFilename: `${unifiedTitle.replace(/[^\w\s-]/g, '').trim()}.pdf`,
            mimeType: 'application/pdf',
            fileSizeBytes: outBytes.length,
            pageCount: 1 + mergedPageCount + textReportPagesCount,
            ocrProcessed: false,
            requiresManualVerification: false,
            createdBy: ctx.auth!.userId,
          });

          const freshMetadata = { ...metadata };
          freshMetadata['unified_report_document_id'] = created.id;
          freshMetadata['unified_report_created_at'] = new Date().toISOString();
          await new WorkflowRepository(tx).updateStepInstance(
            stepInstanceId,
            { metadata: freshMetadata },
            tx,
          );
        });

        const viewUrl = await buildViewUrl(s3Key);

        return {
          success: true as const,
          unifiedReportDocumentId: createdDocumentId!,
          unifiedReportDocumentTitle: unifiedTitle,
          unifiedReportDocumentUrl: viewUrl,
          mergedPdfCount: sourcePdfBuffers.length,
          textOnlyCount,
          textReportPagesCount,
          skippedCount,
        };
      }),

    /**
     * `workflow.acceptUnifiedReport`
     *
     * SP Secretary accepts the unified committee report after all committees have submitted.
     * ABAC: I1 §6.8 (sp_secretary only).
     */
    acceptUnifiedReport: protectedProcedure
      .input(
        z.object({
          instanceId: z.string().uuid(),
          stepInstanceId: z.string().uuid(),
          unifiedReportDocumentId: z.string().uuid(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }
        const { instanceId, stepInstanceId, unifiedReportDocumentId } = input;

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }

        const { stepInstance, instance } = found;

        if (instance.id !== instanceId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Instance ID mismatch.' });
        }

        workflowPolicy.canAcceptUnifiedReport(ctx.auth);

        if (found.step.stepType !== 'multi_referral') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not a multi-referral step.' });
        }

        if (stepInstance.status !== 'active') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Step is not active.' });
        }

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          const txWorkflowRepo = new WorkflowRepository(tx);

          const freshStepInstance = await txWorkflowRepo.getStepInstanceById(
            stepInstanceId,
            tx,
          );
          if (!freshStepInstance) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to retrieve fresh step instance.',
            });
          }

          const freshMetadata = (freshStepInstance.metadata as Record<string, any>) ?? {};

          freshMetadata['unified_report_document_id'] = unifiedReportDocumentId;
          await txWorkflowRepo.updateStepInstance(
            stepInstanceId,
            { metadata: freshMetadata },
            tx,
          );

          await submitStepMultiReferral(
            instance,
            { ...freshStepInstance, metadata: freshMetadata },
            ctx.auth!.userId,
            'user',
            'REPORT_ACCEPTED',
            null,
            { ...deps, db: tx, workflowRepository: txWorkflowRepo },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId,
              stepInstanceId,
              stepId: found.step.id,
              stepType: found.step.stepType,
              outcome: 'REPORT_ACCEPTED',
              comment: null,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: buildActionDescription(found.step.label, found.step.stepKey, 'REPORT_ACCEPTED'),
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true };
      }),

    /**
     * `workflow.manuallyAdvanceMultiReferralStep`
     *
     * SP Secretary override to advance a multi-referral step before all committees have submitted.
     * ABAC: I1 §6.7 (sp_secretary only).
     *
     * Source: E1 §949; I1 §6.7
     */
    manuallyAdvanceMultiReferralStep: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          mandatoryComment: z.string(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (isRichTextEmpty(input.mandatoryComment)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Comment is required.' });
        input.mandatoryComment = sanitizeRichText(input.mandatoryComment);

        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const { stepInstanceId, mandatoryComment } = input;

        const found = await fetchStepContext(stepInstanceId, ctx);
        if (!found) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        }

        const { stepInstance, step, instance, stepAttrs } = found;

        workflowPolicy.canManuallyAdvanceMultiReferral(ctx.auth);

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          await submitStepMultiReferral(
            instance,
            stepInstance,
            ctx.auth!.userId,
            'user',
            'SECRETARY_ADVANCED',
            mandatoryComment,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId,
              stepId: step.id,
              stepType: step.stepType,
              outcome: 'SECRETARY_ADVANCED',
              comment: mandatoryComment,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: buildActionDescription(step.label, step.stepKey, 'SECRETARY_ADVANCED'),
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true as const };
      }),

    certifyAsPresidingOfficer: protectedProcedure
      .input(z.object({ stepInstanceId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        const found = await fetchStepContext(input.stepInstanceId, ctx);
        if (!found) throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        const { stepInstance, step, instance, stepAttrs } = found;

        if (step.stepType !== 'approval' || step.stepKey !== 'vp_certification') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Invalid step type or key.' });
        }

        const server = ctx.req.server as any;
        const deps = {
          db: ctx.db,
          workflowRepository: new WorkflowRepository(ctx.db),
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        const hasRole = ctx.auth.effectiveRoles.includes('sp_presiding_officer');
        if (!hasRole)
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Requires sp_presiding_officer role.',
          });

        const isAssignee = stepAttrs.assigneeUserId === ctx.auth.userId;
        let isActingViaDelegation = false;
        const delegationSummary = await deps.delegationService.getActiveDelegationForUser(ctx.auth.userId);
        if (delegationSummary) {
          const grant = await deps.delegationService.getDelegationGrantById(delegationSummary.delegationId);
          if (grant?.scope?.roles?.includes('sp_presiding_officer')) {
            isActingViaDelegation = true;
          }
        }

        if (!isAssignee && !isActingViaDelegation) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Must be direct assignee or hold active delegation.',
          });
        }

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth.userId,
            'user',
            'SIGNED',
            null,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId: input.stepInstanceId,
              stepId: step.id,
              stepType: step.stepType,
              outcome: 'SIGNED',
              comment: null,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: buildActionDescription(step.label, step.stepKey, 'SIGNED'),
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true as const };
      }),

    mayorSign: protectedProcedure
      .input(z.object({ stepInstanceId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        const found = await fetchStepContext(input.stepInstanceId, ctx);
        if (!found) throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        const { stepInstance, step, instance, stepAttrs } = found;

        if (step.stepKey !== 'mayor_review' && step.stepKey !== 'mayor_signature') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Invalid step key.' });
        }

        const server = ctx.req.server as any;
        const deps = {
          db: ctx.db,
          workflowRepository: new WorkflowRepository(ctx.db),
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        const hasRole = ctx.auth.effectiveRoles.includes('mayor');
        if (!hasRole) throw new TRPCError({ code: 'FORBIDDEN', message: 'Requires mayor role.' });

        const isAssignee = stepAttrs.assigneeUserId === ctx.auth.userId;
        let isActingViaDelegation = false;
        const delegationSummary = await deps.delegationService.getActiveDelegationForUser(ctx.auth.userId);
        if (delegationSummary) {
          const grant = await deps.delegationService.getDelegationGrantById(delegationSummary.delegationId);
          if (grant?.scope?.roles?.includes('mayor')) {
            isActingViaDelegation = true;
          }
        }

        if (!isAssignee && !isActingViaDelegation) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Must be direct assignee or hold active delegation.',
          });
        }

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth.userId,
            'user',
            'SIGNED',
            null,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId: input.stepInstanceId,
              stepId: step.id,
              stepType: step.stepType,
              outcome: 'SIGNED',
              comment: null,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: buildActionDescription(step.label, step.stepKey, 'SIGNED'),
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true as const };
      }),

    mayorVeto: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          objectionsText: z.string(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (isRichTextEmpty(input.objectionsText)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Objections text is required to veto.' });
        input.objectionsText = sanitizeRichText(input.objectionsText);

        const found = await fetchStepContext(input.stepInstanceId, ctx);
        if (!found) throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found.' });
        const { stepInstance, step, instance, stepAttrs } = found;

        if (step.stepKey !== 'mayor_review' && step.stepKey !== 'mayor_signature') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Invalid step key.' });
        }

        const server = ctx.req.server as any;
        const deps = {
          db: ctx.db,
          workflowRepository: new WorkflowRepository(ctx.db),
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        const hasRole = ctx.auth.effectiveRoles.includes('mayor');
        if (!hasRole) throw new TRPCError({ code: 'FORBIDDEN', message: 'Requires mayor role.' });

        const isAssignee = stepAttrs.assigneeUserId === ctx.auth.userId;
        let isActingViaDelegation = false;
        const delegationSummary = await deps.delegationService.getActiveDelegationForUser(ctx.auth.userId);
        if (delegationSummary) {
          const grant = await deps.delegationService.getDelegationGrantById(delegationSummary.delegationId);
          if (grant?.scope?.roles?.includes('mayor')) {
            isActingViaDelegation = true;
          }
        }

        if (!isAssignee && !isActingViaDelegation) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Must be direct assignee or hold active delegation.',
          });
        }

        await ctx.db.transaction(async (tx) => {
          await submitStepApproval(
            instance,
            stepInstance,
            ctx.auth.userId,
            'user',
            'VETOED',
            input.objectionsText,
            { ...deps, db: tx, workflowRepository: new WorkflowRepository(tx) },
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId: input.stepInstanceId,
              stepId: step.id,
              stepType: step.stepType,
              outcome: 'VETOED',
              comment: input.objectionsText,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: buildActionDescription(step.label, step.stepKey, 'VETOED'),
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true as const };
      }),

    logMayorLapseConfirmation: protectedProcedure
      .input(z.object({ stepInstanceId: z.string().uuid() }))
      .output(z.object({ success: z.literal(true), legalBasis: z.literal('RA7160_S47') }))
      .mutation(async ({ ctx, input }) => {
        const stepContext = await fetchStepContext(input.stepInstanceId, ctx);
        if (!stepContext) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });
        }

        const { instance, stepInstance, stepAttrs } = stepContext;

        workflowPolicy.canLogSpSecretaryAction(ctx.auth);

        // Ambiguity resolution: Verify we are actually on a step that lapses.
        const contextObj = (instance.context as Record<string, any>) || {};
        if (!contextObj['mayor_action_deadline']) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Step is not subject to a mayor lapse timer (no deadline set).',
          });
        }

        // Idempotency check: Repeated manual confirmation calls are treated as a no-op to
        // prevent duplicate audit trail logging. Rationale: The SP Secretary's acknowledgment
        // that the lapse occurred is distinguished from the scheduler-set status using the
        // presence of the lapse_confirmed_at key in the step instance's metadata.

        return await ctx.db.transaction(async (tx) => {
          // Re-fetch with lock to prevent race conditions
          const txRepo = new WorkflowRepository(tx);
          const lockedStepInstance = await txRepo.lockStepInstanceForUpdate(
            stepInstance.id,
            tx,
          );
          if (!lockedStepInstance) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });
          }

          const lockedMetadata = (lockedStepInstance.metadata as Record<string, any>) || {};

          if (lockedMetadata['lapse_confirmed_at']) {
            return { success: true, legalBasis: 'RA7160_S47' };
          }

          lockedMetadata['lapse_confirmed_at'] = new Date().toISOString();
          lockedMetadata['lapse_confirmed_by'] = ctx.auth.userId;

          await txRepo.updateStepInstance(
            lockedStepInstance.id,
            { metadata: lockedMetadata },
            tx,
          );

          await txRepo.createWorkflowEvent(
            {
              instanceId: instance.id,
              eventType: 'workflow.step.completed', // Event type mapped in shared
              actorType: 'user',
              actorId: ctx.auth.userId,
              payload: {
                instanceId: instance.id,
                stepInstanceId: lockedStepInstance.id,
                stepId: stepContext.step.id,
                stepType: stepContext.step.stepType,
                outcome: 'LAPSED_CONFIRMED',
                comment: 'Mayor lapse confirmed by SP Secretary',
              },
            },
            tx,
          );

          const server = ctx.req.server as any;
          if (ctx.req.server.eventBus) {
            ctx.req.server.eventBus.emit('workflow.step.completed', {
              eventId: randomUUID(),
              eventType: 'workflow.step.completed',
              occurredAt: new Date().toISOString(),
              cityId: ctx.auth.cityId,
              schemaVersion: 1,
              payload: {
                instanceId: instance.id,
                stepInstanceId: lockedStepInstance.id,
                stepId: stepContext.step.id,
                stepType: stepContext.step.stepType,
                outcome: 'LAPSED_CONFIRMED',
                comment: 'Mayor lapse confirmed by SP Secretary',
                documentId: instance.documentId,
                actorId: ctx.auth!.userId,
                fromOfficeId: null,
                toOfficeId: null,
                actionDescription: buildActionDescription(stepContext.step.label, stepContext.step.stepKey, 'LAPSED_CONFIRMED'),
                cityId: ctx.auth!.cityId,
              },
            });
          }

          return { success: true, legalBasis: 'RA7160_S47' };
        });
      }),

    recordVetoOverrideVote: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          votesFor: z.number().int().min(0).max(12),
          votesAgainst: z.number().int().min(0).max(12),
          absentCouncilorIds: z.array(z.string().uuid()),
        }),
      )
      .output(z.object({ success: z.literal(true) }))
      .mutation(async ({ ctx, input }) => {
        const stepContext = await fetchStepContext(input.stepInstanceId, ctx);
        if (!stepContext) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });
        }

        workflowPolicy.canLogSpSecretaryAction(ctx.auth);

        // 2/3 of 12 SP members = 8. Hardcoded per consolidated reference Part 4.1/4.2
        // ("Override vote: 2/3 = 8 of 12") — not a judgment call, not configurable.
        const outcome = input.votesFor >= 8 ? 'OVERRIDE_SUCCEEDED' : 'OVERRIDE_FAILED';

        const server4 = ctx.req.server as any;
        const deps = {
          db: ctx.db,
          workflowRepository: new WorkflowRepository(ctx.db),
          documentsService: server4.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server4.organizationService,
          delegationService: server4.delegationService,
          iamService: server4.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          const txDeps = {
            ...deps,
            workflowRepository: new WorkflowRepository(tx),
          };

          const patch: Record<string, any> = {
            veto_override_votes_for: input.votesFor,
            veto_override_votes_against: input.votesAgainst,
            veto_override_absent_councilor_ids: input.absentCouncilorIds,
            veto_override_vote_count: input.votesFor,
          };

          await txDeps.workflowRepository.updateInstanceContext(
            stepContext.instance.id,
            patch,
            tx,
          );

          const updatedInstance = await txDeps.workflowRepository.getInstanceById(
            stepContext.instance.id,
            tx,
          );
          if (!updatedInstance) throw new Error('Instance not found');

          await submitStepApproval(
            updatedInstance,
            stepContext.stepInstance,
            ctx.auth.userId,
            'user',
            outcome,
            null, // comment — require_comment_on: [] for this step
            txDeps,
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: stepContext.instance.id,
              stepInstanceId: stepContext.stepInstance.id,
              stepId: stepContext.step.id,
              stepType: stepContext.step.stepType,
              outcome,
              comment: null,
              documentId: stepContext.instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: buildActionDescription(stepContext.step.label, stepContext.step.stepKey, outcome),
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true };
      }),

    logDocketingCompletion: protectedProcedure
      .input(z.object({ stepInstanceId: z.string().uuid() }))
      .output(z.object({ success: z.literal(true) }))
      .mutation(async ({ ctx, input }) => {
        const stepContext = await fetchStepContext(input.stepInstanceId, ctx);
        if (!stepContext) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });
        }

        workflowPolicy.canLogSpSecretaryAction(ctx.auth);

        const server = ctx.req.server as any;
        const deps = {
          db: ctx.db,
          workflowRepository: new WorkflowRepository(ctx.db),
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          const txDeps = {
            ...deps,
            workflowRepository: new WorkflowRepository(tx),
          };

          await submitStepAction(
            stepContext.instance,
            stepContext.stepInstance,
            ctx.auth.userId,
            null, // comment
            txDeps,
            tx,
          );

          // Docketing is the precondition for Panlalawigan transmission
          // (see apps/server/src/modules/documents/panlalawigan.router.ts,
          // initiatePanlalawiganTransmittal's precondition check). Without
          // this call, that procedure always throws PRECONDITION_FAILED.
          await deps.documentsService.transitionState(
            stepContext.instance.documentId,
            'pending_panlalawigan_review',
            ctx.auth.userId,
            'Docketing completed; document transmitted for Panlalawigan review',
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: stepContext.instance.id,
              stepInstanceId: stepContext.stepInstance.id,
              stepId: stepContext.step.id,
              stepType: stepContext.step.stepType,
              outcome: 'DONE',
              comment: null,
              documentId: stepContext.instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: buildActionDescription(stepContext.step.label, stepContext.step.stepKey, 'DONE'),
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true };
      }),

    recordPanlalawiganOutcome: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          outcome: z.enum(['VALID', 'VALID_IN_PART', 'RETURNED', 'OPERATIVE_IN_ITS_ENTIRETY']),
          controlNumber: z.string().optional(),
          panlalawiganResolutionNumber: z.string().optional(),
          remarks: z.string().optional(),
        }),
      )
      .output(z.object({ success: z.literal(true) }))
      .mutation(async ({ input, ctx }) => {
        if (input.remarks) input.remarks = sanitizeRichText(input.remarks);

        const stepContext = await fetchStepContext(input.stepInstanceId, ctx);
        if (!stepContext) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });
        }

        const { instance, stepInstance, stepAttrs } = stepContext;

        workflowPolicy.canLogPanlalawiganAction(ctx.auth, stepAttrs);

        const server2 = ctx.req.server as any;
        const deps = {
          db: ctx.db,
          workflowRepository: new WorkflowRepository(ctx.db),
          documentsService: server2.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server2.organizationService,
          delegationService: server2.delegationService,
          iamService: server2.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          const txDeps = {
            ...deps,
            workflowRepository: new WorkflowRepository(tx),
          };

          const patch: Record<string, any> = {
            panlalawigan_outcome: input.outcome,
          };
          if (input.controlNumber !== undefined)
            patch['panlalawigan_control_number'] = input.controlNumber;
          if (input.panlalawiganResolutionNumber !== undefined)
            patch['panlalawigan_resolution_number'] = input.panlalawiganResolutionNumber;
          if (input.remarks !== undefined) patch['panlalawigan_remarks'] = input.remarks;

          await txDeps.workflowRepository.updateInstanceContext(instance.id, patch, tx);

          // Refresh instance to get updated context
          const updatedInstance = await txDeps.workflowRepository.getInstanceById(
            instance.id,
            tx,
          );
          if (!updatedInstance) throw new Error('Instance not found');

          await submitStepApproval(
            updatedInstance,
            stepInstance,
            ctx.auth.userId,
            'user',
            input.outcome,
            input.remarks ?? null,
            txDeps,
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: stepContext.instance.id,
              stepInstanceId: stepContext.stepInstance.id,
              stepId: stepContext.step.id,
              stepType: stepContext.step.stepType,
              outcome: input.outcome,
              comment: input.remarks ?? null,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: buildActionDescription(stepContext.step.label, stepContext.step.stepKey, input.outcome),
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true };
      }),

    resolveValidInPart: protectedProcedure
      .input(
        z.object({
          documentId: z.string().uuid(),
          resolutionPath: z.enum([
            'resolve_as_is',
            'route_to_legal',
            'route_to_committee',
            'implement_directly',
          ]),
          mandatoryComment: z.string(),
        }),
      )
      .output(z.object({ success: z.literal(true) }))
      .mutation(async ({ input, ctx }) => {
        if (isRichTextEmpty(input.mandatoryComment)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Comment is required.' });
        input.mandatoryComment = sanitizeRichText(input.mandatoryComment);

        const workflowRepository = new WorkflowRepository(ctx.db);
        const instance = await workflowRepository.getActiveInstanceForDocument(input.documentId);
        if (!instance) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Active workflow instance not found for document',
          });
        }

        const rows = await ctx.db
          .select({
            stepInstanceId: stepInstances.id,
          })
          .from(stepInstances)
          .innerJoin(steps, eq(stepInstances.stepId, steps.id))
          .where(
            and(
              eq(stepInstances.instanceId, instance.id),
              eq(steps.stepKey, 'valid_in_part_decision'),
              inArray(stepInstances.status, ['pending', 'active']),
              isNull(stepInstances.deletedAt),
            ),
          )
          .limit(1);

        if (rows.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No active valid_in_part_decision step found',
          });
        }

        const stepContext = await fetchStepContext(rows[0]!.stepInstanceId, ctx);
        if (!stepContext)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });

        workflowPolicy.canResolveValidInPart(ctx.auth);

        const server3 = ctx.req.server as any;
        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server3.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server3.organizationService,
          delegationService: server3.delegationService,
          iamService: server3.iamService,
        };

        // Map resolutionPath to engine outcome string
        let outcome = 'RESOLVED_IN_PLACE';
        if (input.resolutionPath === 'route_to_legal') outcome = 'ROUTED_TO_LEGAL';
        else if (input.resolutionPath === 'route_to_committee') outcome = 'ROUTED_TO_COMMITTEE';
        else if (input.resolutionPath === 'implement_directly') outcome = 'REVISED_DIRECTLY';

        await ctx.db.transaction(async (tx) => {
          const txDeps = {
            ...deps,
            workflowRepository: new WorkflowRepository(tx),
          };

          if (input.resolutionPath === 'route_to_committee') {
            // Find the original committee referral step instance to get the committee ID
            const committeeRows = await tx
              .select({ metadata: stepInstances.metadata })
              .from(stepInstances)
              .innerJoin(steps, eq(stepInstances.stepId, steps.id))
              .where(
                and(
                  eq(stepInstances.instanceId, instance.id),
                  eq(steps.stepKey, 'committee_referral'),
                  isNull(stepInstances.deletedAt),
                ),
              )
              .orderBy(desc(stepInstances.createdAt))
              .limit(1);

            if (committeeRows.length === 0) {
              throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: 'No committee referral found in this workflow instance to route back to.',
              });
            }

            const metadata = (committeeRows[0]!.metadata as Record<string, any>) || {};
            const assignedCommittees = metadata['assigned_committees'] as
              | Array<{ committee_id: string }>
              | undefined;

            if (!assignedCommittees || assignedCommittees.length === 0) {
              throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: 'No committees were assigned during the referral step.',
              });
            }

            const primaryCommitteeId = assignedCommittees[0]!.committee_id;
            const chair = await txDeps.orgService.getCommitteeChair(primaryCommitteeId);

            if (!chair) {
              throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message:
                  'The committee assigned during referral has no chair on record. Assign a chair in the Organization module before routing to committee, or choose a different resolution path.',
              });
            }

            await txDeps.workflowRepository.updateInstanceContext(
              instance.id,
              {
                referred_committee_chair_id: chair.userId,
              },
              tx,
            );
          }

          // Refresh instance to get updated context (e.g. if we set referred_committee_chair_id)
          const updatedInstance = await txDeps.workflowRepository.getInstanceById(
            instance.id,
            tx,
          );
          if (!updatedInstance) throw new Error('Instance not found');

          await submitStepApproval(
            updatedInstance,
            stepContext.stepInstance,
            ctx.auth.userId,
            'user',
            outcome,
            input.mandatoryComment,
            txDeps,
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId: stepContext.stepInstance.id,
              stepId: stepContext.step.id,
              stepType: stepContext.step.stepType,
              outcome,
              comment: input.mandatoryComment,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: buildActionDescription(stepContext.step.label, stepContext.step.stepKey, outcome),
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true };
      }),

    confirmPanlalawiganDeemedApproved: protectedProcedure
      .input(z.object({ stepInstanceId: z.string().uuid() }))
      .output(z.object({ success: z.literal(true), legalBasis: z.literal('RA7160_S56D') }))
      .mutation(async ({ ctx, input }) => {
        const stepContext = await fetchStepContext(input.stepInstanceId, ctx);
        if (!stepContext) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });
        }

        const { instance, stepInstance, stepAttrs } = stepContext;

        workflowPolicy.canLogPanlalawiganAction(ctx.auth, stepAttrs);

        const contextObj = (instance.context as Record<string, any>) || {};
        const deadlineStr = contextObj['panlalawigan_action_deadline'];

        if (!deadlineStr) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'No Panlalawigan action deadline is set.',
          });
        }

        const deadline = new Date(deadlineStr);
        if (new Date() < deadline) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: '30-day window has not yet elapsed.',
          });
        }

        const workflowRepository = new WorkflowRepository(ctx.db);
        const server = ctx.req.server as any;

        return await ctx.db.transaction(async (tx) => {
          const txRepo = new WorkflowRepository(tx);
          const lockedStepInstance = await txRepo.lockStepInstanceForUpdate(
            stepInstance.id,
            tx,
          );
          if (!lockedStepInstance) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });
          }

          const lockedMetadata = (lockedStepInstance.metadata as Record<string, any>) || {};
          if (lockedMetadata['deemed_approved_confirmed_at']) {
            return { success: true, legalBasis: 'RA7160_S56D' } as const;
          }

          lockedMetadata['deemed_approved_confirmed_at'] = new Date().toISOString();
          lockedMetadata['deemed_approved_confirmed_by'] = ctx.auth.userId;

          await txRepo.updateStepInstance(
            lockedStepInstance.id,
            { metadata: lockedMetadata },
            tx,
          );

          await txRepo.createWorkflowEvent(
            {
              instanceId: instance.id,
              eventType: 'workflow.step.completed',
              actorType: 'user',
              actorId: ctx.auth.userId,
              payload: {
                instanceId: instance.id,
                stepInstanceId: lockedStepInstance.id,
                stepId: stepContext.step.id,
                stepType: stepContext.step.stepType,
                outcome: 'DEEMED_APPROVED_CONFIRMED',
                comment: 'Panlalawigan deemed approval confirmed by SP Secretary',
              },
            },
            tx,
          );

          if (ctx.req.server.eventBus) {
            ctx.req.server.eventBus.emit('workflow.step.completed', {
              eventId: randomUUID(),
              eventType: 'workflow.step.completed',
              occurredAt: new Date().toISOString(),
              cityId: ctx.auth.cityId,
              schemaVersion: 1,
              payload: {
                instanceId: instance.id,
                stepInstanceId: lockedStepInstance.id,
                stepId: stepContext.step.id,
                stepType: stepContext.step.stepType,
                outcome: 'DEEMED_APPROVED_CONFIRMED',
                comment: 'Panlalawigan deemed approval confirmed by SP Secretary',
                documentId: instance.documentId,
                actorId: ctx.auth!.userId,
                fromOfficeId: null,
                toOfficeId: null,
                actionDescription: buildActionDescription(stepContext.step.label, stepContext.step.stepKey, 'DEEMED_APPROVED_CONFIRMED'),
                cityId: ctx.auth!.cityId,
              },
            });
          }

          return { success: true, legalBasis: 'RA7160_S56D' } as const;
        });
      }),

    recordNewspaperPublicationDate: protectedProcedure
      .input(
        z.object({
          documentId: z.string().uuid(),
          publicationDate: z.coerce.date(),
          newspaperName: z.string().default('Ilocos Times'),
        }),
      )
      .output(z.object({ success: z.literal(true) }))
      .mutation(async ({ ctx, input }) => {
        const workflowRepository = new WorkflowRepository(ctx.db);
        const instance = await workflowRepository.getActiveInstanceForDocument(input.documentId);
        if (!instance) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Active workflow instance not found for document',
          });
        }

        workflowPolicy.canLogSpSecretaryAction(ctx.auth);

        // Fetch document type and metadata to verify constraint
        const docRows = await ctx.db
          .select({
            code: documentTypes.code,
            metadata: documents.metadata,
          })
          .from(documents)
          .innerJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
          .where(eq(documents.id, input.documentId))
          .limit(1);

        if (docRows.length === 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
        }

        const docType = docRows[0]!.code;
        if (docType !== 'SP_ORDINANCE' && docType !== 'SP_APPROPRIATION_ORDINANCE') {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Only Ordinances and Appropriation Ordinances require newspaper publication.',
          });
        }

        // Add penalty clause check
        const docMetadata = (docRows[0]!.metadata as Record<string, any>) || {};
        const hasPenalty =
          docMetadata['has_penalty_provision'] === true ||
          docMetadata['has_penalty_provision'] === 'true';
        if (!hasPenalty) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Only ordinances with a penalty provision require newspaper publication.',
          });
        }

        // Query active step instance for 'newspaper_publication'
        const rows = await ctx.db
          .select({
            stepInstanceId: stepInstances.id,
          })
          .from(stepInstances)
          .innerJoin(steps, eq(stepInstances.stepId, steps.id))
          .where(
            and(
              eq(stepInstances.instanceId, instance.id),
              eq(steps.stepKey, 'newspaper_publication'),
              inArray(stepInstances.status, ['pending', 'active']),
              isNull(stepInstances.deletedAt),
            ),
          )
          .limit(1);

        if (rows.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No active newspaper_publication step found for this instance',
          });
        }

        const stepContext = await fetchStepContext(rows[0]!.stepInstanceId, ctx);
        if (!stepContext)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Step instance not found' });

        const server = ctx.req.server as any;
        const deps = {
          db: ctx.db,
          workflowRepository,
          documentsService: server.documentsService,
          eventBus: ctx.req.server.eventBus,
          orgService: server.organizationService,
          delegationService: server.delegationService,
          iamService: server.iamService,
        };

        await ctx.db.transaction(async (tx) => {
          const txDeps = {
            ...deps,
            workflowRepository: new WorkflowRepository(tx),
          };

          await txDeps.workflowRepository.updateInstanceContext(
            instance.id,
            {
              publication_date: input.publicationDate.toISOString().split('T')[0],
              publication_newspaper: input.newspaperName,
            },
            tx,
          );

          await submitStepAction(
            instance,
            stepContext.stepInstance,
            ctx.auth.userId,
            null, // comment
            txDeps,
            tx,
          );
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.step.completed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.completed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: instance.id,
              stepInstanceId: stepContext.stepInstance.id,
              stepId: stepContext.step.id,
              stepType: stepContext.step.stepType,
              outcome: 'DONE',
              comment: null,
              documentId: instance.documentId,
              actorId: ctx.auth!.userId,
              fromOfficeId: null,
              toOfficeId: null,
              actionDescription: buildActionDescription(stepContext.step.label, stepContext.step.stepKey, 'DONE'),
              cityId: ctx.auth!.cityId,
            },
          });
        }

        return { success: true };
      }),

    cancelInstance: protectedProcedure
      .input(
        z.object({
          instanceId: z.string().uuid(),
          reason: z.string().min(1),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const [instance] = await ctx.db
          .select()
          .from(instances)
          .where(and(eq(instances.id, input.instanceId), isNull(instances.deletedAt)))
          .limit(1);

        if (!instance) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow instance not found.' });
        }

        const [doc] = await ctx.db
          .select()
          .from(documents)
          .where(eq(documents.id, instance.documentId))
          .limit(1);

        if (!doc) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Parent document not found.' });
        }

        const attrs: WorkflowInstanceReadAttrs = {
          documentOfficeId: doc.ownedByOfficeId,
          classificationLevel: doc.classificationLevel as
            | 'public'
            | 'internal'
            | 'confidential'
            | 'restricted',
        };

        workflowPolicy.canCancelInstance(ctx.auth, attrs);

        const server = ctx.req.server as any;
        await ctx.db.transaction(async (tx) => {
          const deps = {
            db: tx,
            workflowRepository: new WorkflowRepository(tx),
            documentsService: server.documentsService,
            eventBus: ctx.req.server.eventBus,
            orgService: server.organizationService,
            delegationService: server.delegationService,
            getApprovalGrant: (instanceId: string, versionId: string) =>
              deps.workflowRepository.getApprovalGrant(instanceId, versionId),
            markApprovalGrantUsed: (grantId: string) =>
              deps.workflowRepository.markApprovalGrantUsed(grantId),
          };
          await cancelInstance(input.instanceId, ctx.auth!.userId, input.reason, deps);
        });

        if (ctx.req.server.eventBus) {
          ctx.req.server.eventBus.emit('workflow.instance.cancelled', {
            eventId: randomUUID(),
            eventType: 'workflow.instance.cancelled',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: input.instanceId,
              cancelledBy: ctx.auth.userId,
              cancellationReason: input.reason,
            },
          });
        }

        return { success: true as const };
      }),

    bypassStep: protectedProcedure
      .input(
        z.object({
          stepInstanceId: z.string().uuid(),
          bypassReason: z.string().min(1),
          comment: z.string().min(1),
          outcomeCode: z.string().min(1),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        workflowPolicy.canBypassStep(ctx.auth);

        const server = ctx.req.server as any;
        await ctx.db.transaction(async (tx) => {
          const deps = {
            db: tx,
            workflowRepository: new WorkflowRepository(tx),
            documentsService: server.documentsService,
            eventBus: ctx.req.server.eventBus,
            orgService: server.organizationService,
            delegationService: server.delegationService,
            iamService: server.iamService,
            getApprovalGrant: (instanceId: string, versionId: string) =>
              deps.workflowRepository.getApprovalGrant(instanceId, versionId),
            markApprovalGrantUsed: (grantId: string) =>
              deps.workflowRepository.markApprovalGrantUsed(grantId),
          };
          await bypassStep(
            input.stepInstanceId,
            ctx.auth!.userId,
            input.bypassReason,
            input.comment,
            input.outcomeCode,
            deps,
          );
        });

        const [stepInstance] = await ctx.db
          .select({ instanceId: stepInstances.instanceId })
          .from(stepInstances)
          .where(eq(stepInstances.id, input.stepInstanceId))
          .limit(1);

        if (ctx.req.server.eventBus && stepInstance) {
          ctx.req.server.eventBus.emit('workflow.step.bypassed', {
            eventId: randomUUID(),
            eventType: 'workflow.step.bypassed',
            occurredAt: new Date().toISOString(),
            cityId: ctx.auth.cityId,
            schemaVersion: 1,
            payload: {
              instanceId: stepInstance.instanceId,
              stepInstanceId: input.stepInstanceId,
              bypassReason: input.bypassReason,
              bypassedBy: ctx.auth.userId,
              comment: input.comment,
            },
          });
        }

        return { success: true as const };
      }),

    migrateInstanceToNewDefinitionVersion: protectedProcedure
      .input(
        z.object({
          instanceId: z.string().uuid(),
          newDefinitionVersionId: z.string().uuid(),
          mandatoryReason: z.string().min(1),
          secondLevelApproverUserId: z.string().uuid(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        workflowPolicy.canMigrateInstance(ctx.auth);

        const server = ctx.req.server as any;
        let result: { migrationId: string; reversibleUntil: Date };

        await ctx.db.transaction(async (tx) => {
          const deps = {
            db: tx,
            workflowRepository: new WorkflowRepository(tx),
            documentsService: server.documentsService,
            eventBus: ctx.req.server.eventBus,
            orgService: server.organizationService,
            delegationService: server.delegationService,
            getApprovalGrant: (instanceId: string, versionId: string) =>
              deps.workflowRepository.getApprovalGrant(instanceId, versionId),
            markApprovalGrantUsed: (grantId: string) =>
              deps.workflowRepository.markApprovalGrantUsed(grantId),
          };
          result = await migrateInstance(
            input.instanceId,
            input.newDefinitionVersionId,
            ctx.auth!.userId,
            input.mandatoryReason,
            deps,
          );
        });

        if (ctx.req.server.eventBus) {
          const [startedEvent] = await ctx.db
            .select()
            .from(workflowEvents)
            .where(
              and(
                eq(workflowEvents.instanceId, input.instanceId),
                eq(workflowEvents.eventType, 'workflow.instance.migration.started'),
              ),
            )
            .orderBy(desc(workflowEvents.occurredAt))
            .limit(1);

          if (startedEvent) {
            ctx.req.server.eventBus.emit('workflow.instance.migration.started', {
              eventId: randomUUID(),
              eventType: 'workflow.instance.migration.started',
              occurredAt: new Date().toISOString(),
              cityId: ctx.auth.cityId,
              schemaVersion: 1,
              payload: startedEvent.payload as Record<string, unknown>,
            });
          }

          const [completedEvent] = await ctx.db
            .select()
            .from(workflowEvents)
            .where(
              and(
                eq(workflowEvents.instanceId, input.instanceId),
                eq(workflowEvents.eventType, 'workflow.instance.migration.completed'),
              ),
            )
            .orderBy(desc(workflowEvents.occurredAt))
            .limit(1);

          if (completedEvent) {
            ctx.req.server.eventBus.emit('workflow.instance.migration.completed', {
              eventId: randomUUID(),
              eventType: 'workflow.instance.migration.completed',
              occurredAt: new Date().toISOString(),
              cityId: ctx.auth.cityId,
              schemaVersion: 1,
              payload: completedEvent.payload as Record<string, unknown>,
            });
          }
        }

        return result!;
      }),
  });
}

export const workflowRouter = createWorkflowRouter();
