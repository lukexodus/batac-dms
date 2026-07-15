import { z } from 'zod';
import { UuidSchema, TimestampSchema, DateSchema } from './common.js';

// Shared Sub-schemas
export const SponsorSchema = z.object({
  employeeId: UuidSchema,
  displayName: z.string(),
});

export const ReadingRecordSchema = z.object({
  sessionId: UuidSchema.optional(),
  sessionDate: DateSchema.optional(),
  motionCarried: z.boolean().optional(),
  yesVotes: z.number().int().min(0).optional(),
  noVotes: z.number().int().min(0).optional(),
  abstentions: z.number().int().min(0).optional(),
  presidingOfficerId: UuidSchema.optional(),
  notes: z.string().max(2048).optional(),
});

export const MayorActionSchema = z
  .object({
    type: z.enum(['signed', 'vetoed', 'lapsed']),
    actionDate: DateSchema,
    notes: z.string().max(2048).optional(),
    vetoMessage: z.string().max(4096).optional(),
  })
  .refine((v) => v.type !== 'vetoed' || (v.vetoMessage && v.vetoMessage.length > 0), {
    message: "vetoMessage required when type is 'vetoed'",
    path: ['vetoMessage'],
  });

export const VetoOverrideSchema = z.object({
  overrideDate: DateSchema,
  yesVotes: z.number().int().min(0),
  noVotes: z.number().int().min(0),
  resultedInOverride: z.boolean(),
});

export const PublicationInfoSchema = z.object({
  isPublished: z.boolean().default(false),
  firstPageS3Key: z.string().optional(),
  publishedAt: TimestampSchema.optional(),
});

export const NewspaperPublicationSchema = z.object({
  newspaper: z.string().max(256),
  publicationDate: DateSchema,
  s3Key: z.string().optional(),
  arrangedBy: UuidSchema.optional(),
});

// Phase 1 Document Type Metadata Schemas

const spResolutionBase = z.object({
  sponsors: z.array(SponsorSchema).min(1, 'At least one sponsor required'),
  firstReading: ReadingRecordSchema.optional(),
  certificationOfUrgencyDocumentId: UuidSchema.optional(),
  committeeReferralIds: z.array(UuidSchema).optional(),
  secondReading: ReadingRecordSchema.optional(),
  amendmentNotes: z.string().max(4096).optional(),
  mayorAction: MayorActionSchema.optional(),
  vetoOverride: VetoOverrideSchema.optional(),
  transmittalLetterDocumentId: UuidSchema.optional(),
  publication: PublicationInfoSchema.optional(),
});

export const SpResolutionMetadataSchema = spResolutionBase.refine(
  (v) => !(v.certificationOfUrgencyDocumentId && v.committeeReferralIds?.length),
  { message: 'A certified urgent measure cannot also have committee referrals' },
);
export type SpResolutionMetadata = z.infer<typeof SpResolutionMetadataSchema>;

const spOrdinanceBase = z.object({
  sponsors: z.array(SponsorSchema).min(1),
  firstReading: ReadingRecordSchema.optional(),
  certificationOfUrgencyDocumentId: UuidSchema.optional(),
  committeeReferralIds: z.array(UuidSchema).optional(),
  secondReading: ReadingRecordSchema.optional(),
  amendmentNotes: z.string().max(4096).optional(),
  thirdReading: ReadingRecordSchema.optional(),
  mayorAction: MayorActionSchema.optional(),
  vetoOverride: VetoOverrideSchema.optional(),
  transmittalLetterDocumentId: UuidSchema.optional(),
  hasPenaltyProvision: z.boolean().default(false),
  newspaperPublication: NewspaperPublicationSchema.optional(),
  publication: PublicationInfoSchema.optional(),
});

export const SpOrdinanceMetadataSchema = spOrdinanceBase.refine(
  (v) => !(v.certificationOfUrgencyDocumentId && v.committeeReferralIds?.length),
  { message: 'A certified urgent measure cannot also have committee referrals' },
);
export type SpOrdinanceMetadata = z.infer<typeof SpOrdinanceMetadataSchema>;

const appropriationOrdinanceBase = spOrdinanceBase.extend({
  appropriationType: z.enum(['annual_budget', 'supplemental']).default('annual_budget'),
  fiscalYear: z.number().int().min(2000).max(2099),
  totalAmountPhp: z.number().positive().optional(),
});

export const AppropriationOrdinanceMetadataSchema = appropriationOrdinanceBase.refine(
  (v) => !(v.certificationOfUrgencyDocumentId && v.committeeReferralIds?.length),
  { message: 'A certified urgent measure cannot also have committee referrals' },
);
export type AppropriationOrdinanceMetadata = z.infer<typeof AppropriationOrdinanceMetadataSchema>;

const certificationOfUrgencyBase = z.object({
  issuedByEmployeeId: UuidSchema,
  issuedByDisplayName: z.string().min(1),
  issuanceDate: DateSchema,
  associatedDocumentIds: z.array(UuidSchema).min(1, 'At least one associated measure required'),
  justification: z.string().max(4096).optional(),
  sessionDate: DateSchema.optional(),
});

export const CertificationOfUrgencyMetadataSchema = certificationOfUrgencyBase;
export type CertificationOfUrgencyMetadata = z.infer<typeof CertificationOfUrgencyMetadataSchema>;

export const ComplaintOutcomeStateSchema = z.enum([
  'pending_hearing',
  'received_seen',
  'dismissed',
  'resolved',
]);
export type ComplaintOutcomeState = z.infer<typeof ComplaintOutcomeStateSchema>;

export const ComplaintViolationTypeSchema = z.enum([
  'overcharging',
  'trip_cutting',
  'refused_to_convey',
  'discourtesy',
  'other',
]);

const citizenComplaintBase = z.object({
  complainant: z.object({
    name: z.string().min(1),
    address: z.string().nullable(),
    contactNumber: z.string().nullable(),
    email: z.string().email().nullable(),
    citizenUserId: UuidSchema.nullable(),
  }),
  subjectCategory: z.string(),
  violationType: z.string().nullable(),
  incidentDetails: z.object({
    date: DateSchema.nullable(),
    time: z.string().nullable(),
    place: z.string().nullable(),
    narrative: z.string().nullable(),
  }),
  respondent: z
    .object({
      name: z.string().nullable(),
      tricycleNumber: z.string().nullable(),
      contactNumber: z.string().nullable(),
      email: z.string().nullable(),
      notificationChannel: z.enum(['contact_number', 'email']).nullable(),
    })
    .nullable(),
  accessMode: z.enum(['downloaded_form', 'digital_form_printed', 'in_person_clerk']),
  routingDecision: z.string().nullable(),
  outcomeState: ComplaintOutcomeStateSchema.default('pending_hearing'),
});

export const CitizenComplaintMetadataSchema = citizenComplaintBase;
export type CitizenComplaintMetadata = z.infer<typeof CitizenComplaintMetadataSchema>;

const documentRequestFormBase = z.object({
  requester: z.object({
    name: z.string().min(1),
    agencyOrOrganization: z.string().nullable(),
    email: z.string().email().nullable(),
    contactNumber: z.string().nullable(),
    idTypePresented: z.string().nullable(),
    citizenUserId: UuidSchema.nullable(),
  }),
  documentsRequested: z
    .array(
      z.object({
        documentTitle: z.string().min(1),
        documentId: UuidSchema.nullable(),
        documentTypeLabel: z.string().nullable(),
        documentNumber: z.string().nullable(),
        numberOfPages: z.number().int().positive().nullable(),
      }),
    )
    .min(1),
  purpose: z.string().nullable(),
  accessMode: z.enum(['downloaded_form', 'digital_form_printed', 'in_person_clerk']),
  payment: z
    .object({
      orNumber: z.string().nullable(),
      collectingOfficer: z.string().nullable(),
      amountPaid: z.number().positive().nullable(),
      paymentDate: DateSchema.nullable(),
    })
    .nullable(),
  notificationChannel: z.enum(['contact_number', 'email']).nullable(),
});

export const DocumentRequestFormMetadataSchema = documentRequestFormBase;
export type DocumentRequestFormMetadata = z.infer<typeof DocumentRequestFormMetadataSchema>;

const letterReceivedBase = z.object({
  senderName: z.string().min(1).max(256).trim(),
  senderOfficeOrganization: z.string().max(256).optional(),
  dateReceived: DateSchema,
  routedToViceMayor: z.boolean().default(true),
  viceMayorNotes: z.string().max(2048).optional(),
  routedToOfficeId: UuidSchema.optional(),
  actionTaken: z.string().max(2048).optional(),
});

export const LetterReceivedMetadataSchema = letterReceivedBase;
export type LetterReceivedMetadata = z.infer<typeof LetterReceivedMetadataSchema>;

const letterSentBase = z.object({
  recipientName: z.string().min(1).max(256).trim(),
  recipientOfficeOrganization: z.string().max(256).optional(),
  recipientEmail: z.string().email().optional(),
  dateSent: DateSchema,
  relatedDocumentId: UuidSchema.optional(),
  letterType: z.enum(['transmittal', 'invitation', 'forwarding', 'general']).default('general'),
});

export const LetterSentMetadataSchema = letterSentBase;
export type LetterSentMetadata = z.infer<typeof LetterSentMetadataSchema>;

const memoOutgoingBase = z.object({
  memoNumber: z.string().min(1).max(64).trim(),
  issuedByEmployeeId: UuidSchema,
  issuedByDisplayName: z.string(),
  issuanceDate: DateSchema,
  recipientEmployeeIds: z.array(UuidSchema).min(1),
  subject: z.string().min(1).max(512).trim(),
  disseminatedAt: DateSchema.optional(),
});

export const MemoOutgoingMetadataSchema = memoOutgoingBase;
export type MemoOutgoingMetadata = z.infer<typeof MemoOutgoingMetadataSchema>;

const memoIncomingBase = z.object({
  senderOffice: z.string().min(1).max(256).trim(),
  sendersOwnReference: z.string().max(128).optional(),
  dateReceived: DateSchema,
  subject: z.string().min(1).max(512).trim(),
});

export const MemoIncomingMetadataSchema = memoIncomingBase;
export type MemoIncomingMetadata = z.infer<typeof MemoIncomingMetadataSchema>;

const noticeOfCommitteeHearingBase = z.object({
  committeeIds: z.array(UuidSchema).min(1),
  hearingDate: DateSchema.optional(),
  hearingTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  hearingVenue: z.string().max(256).optional(),
  relatedDocumentIds: z.array(UuidSchema).min(1),
  recipientEmployeeIds: z.array(UuidSchema).min(1),
  notes: z.string().max(2048).optional(),
});

export const NoticeOfCommitteeHearingMetadataSchema = noticeOfCommitteeHearingBase;
export type NoticeOfCommitteeHearingMetadata = z.infer<
  typeof NoticeOfCommitteeHearingMetadataSchema
>;

const noticeOfSpecialSessionBase = z.object({
  sessionNumber: z.string().max(64),
  sessionDate: DateSchema,
  sessionTime: z.string().regex(/^\d{2}:\d{2}$/),
  subject: z.string().min(1).max(512).trim(),
  recipientEmployeeIds: z.array(UuidSchema).min(1),
});

export const NoticeOfSpecialSessionMetadataSchema = noticeOfSpecialSessionBase;
export type NoticeOfSpecialSessionMetadata = z.infer<typeof NoticeOfSpecialSessionMetadataSchema>;

const designationBase = z.object({
  delegatingAuthorityEmployeeId: UuidSchema,
  delegatingAuthorityDisplayName: z.string(),
  designatedPersonEmployeeId: UuidSchema,
  designatedPersonDisplayName: z.string(),
  designatedOfficeId: UuidSchema,
  designatedPositionId: UuidSchema,
  scopeDescription: z.string().min(1).max(1024).trim(),
  legalBasis: z.string().max(512).optional(),
  effectiveFrom: DateSchema,
  effectiveUntil: DateSchema,
  delegationGrantId: UuidSchema.optional(),
});

export const DesignationMetadataSchema = designationBase
  .refine((v) => v.delegatingAuthorityEmployeeId !== v.designatedPersonEmployeeId, {
    message: 'Delegating authority and designated person must differ',
    path: ['designatedPersonEmployeeId'],
  })
  .refine((v) => v.effectiveUntil >= v.effectiveFrom, {
    message: 'effectiveUntil must not be before effectiveFrom',
    path: ['effectiveUntil'],
  });
export type DesignationMetadata = z.infer<typeof DesignationMetadataSchema>;

export const DocumentMetadataSchema = z
  .discriminatedUnion('__type', [
    spResolutionBase.extend({ __type: z.literal('SP_RESOLUTION') }),
    spOrdinanceBase.extend({ __type: z.literal('SP_ORDINANCE') }),
    appropriationOrdinanceBase.extend({ __type: z.literal('APPROPRIATION_ORDINANCE') }),
    certificationOfUrgencyBase.extend({ __type: z.literal('CERTIFICATION_OF_URGENCY') }),
    citizenComplaintBase.extend({ __type: z.literal('CITIZEN_COMPLAINT') }),
    documentRequestFormBase.extend({ __type: z.literal('DOCUMENT_REQUEST_FORM') }),
    letterReceivedBase.extend({ __type: z.literal('LETTER_RECEIVED') }),
    letterSentBase.extend({ __type: z.literal('LETTER_SENT') }),
    memoOutgoingBase.extend({ __type: z.literal('MEMO_OUTGOING') }),
    memoIncomingBase.extend({ __type: z.literal('MEMO_INCOMING') }),
    noticeOfCommitteeHearingBase.extend({ __type: z.literal('NOTICE_OF_COMMITTEE_HEARING') }),
    noticeOfSpecialSessionBase.extend({ __type: z.literal('NOTICE_OF_SPECIAL_SESSION') }),
    designationBase.extend({ __type: z.literal('DESIGNATION') }),
  ])
  .superRefine((val, ctx) => {
    if (
      val.__type === 'SP_RESOLUTION' ||
      val.__type === 'SP_ORDINANCE' ||
      val.__type === 'APPROPRIATION_ORDINANCE'
    ) {
      if (val.certificationOfUrgencyDocumentId && val.committeeReferralIds?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A certified urgent measure cannot also have committee referrals',
        });
      }
    }
    if (val.__type === 'DESIGNATION') {
      if (val.delegatingAuthorityEmployeeId === val.designatedPersonEmployeeId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Delegating authority and designated person must differ',
          path: ['designatedPersonEmployeeId'],
        });
      }
      if (val.effectiveUntil < val.effectiveFrom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'effectiveUntil must not be before effectiveFrom',
          path: ['effectiveUntil'],
        });
      }
    }
  });

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;
