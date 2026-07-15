// packages/ui/src/types/domain.ts
// Canonical shared domain types for packages/ui Tier 3 components and apps/web.
// Location: deliberately NOT packages/shared, to avoid a circular dependency —
// packages/ui already depends on packages/shared for tRPC/Zod types, so having
// packages/shared import back from packages/ui would close the circle.

// Ambiguity note (1): IN_WORKFLOW is a broad umbrella state and coexists with the
// more granular reading/committee states rather than being refactored into a
// discriminated union — that refactor is explicitly deferred, not an oversight.
// Ambiguity note (2): PENDING_APPROVAL is a generic alias for non-SP document types —
// SP Resolutions and Ordinances use PENDING_MAYOR specifically, never PENDING_APPROVAL.

export type DocumentState =
  // Core document lifecycle
  | 'DRAFT' // Document created; not yet submitted to Secretariat
  | 'SUBMITTED' // Submitted to Secretariat; pending intake logging
  | 'IN_WORKFLOW' // Active in a workflow instance — broad umbrella state
  | 'PENDING_APPROVAL' // Awaiting a generic approval action (non-SP document types)
  | 'COMPLETED' // Workflow instance reached a terminal approved outcome
  | 'RELEASED' // Published to portal; publicly visible
  | 'ARCHIVED' // Permanent historical record; read-only
  | 'DISPOSED' // Records-managed disposal (no document destroyed — audit only)
  | 'CANCELLED' // Withdrawn/cancelled; terminal; no further action possible
  // Reading and workflow-step states
  | 'FIRST_READING' // Vice Mayor has referred document at First Reading session
  | 'SECOND_READING' // Document before the body at Second Reading session
  | 'THIRD_READING' // Document before the body at Third Reading session (Ordinances only)
  | 'IN_COMMITTEE' // Referred to one or more standing committees
  | 'PENDING_MAYOR' // Transmitted to Mayor; 10-day review clock running
  | 'VETOED' // Mayor returned with veto; override vote pending or failed
  | 'OVERRIDE_PENDING' // Override vote has not yet occurred; 2/3 threshold required
  | 'LAPSED' // Mayor took no action within 10 days; lapsed into law per RA 7160
  // Panlalawigan review outcome states
  | 'PANLALAWIGAN_REVIEW' // Transmitted to Sangguniang Panlalawigan; 30-day timer running
  | 'VALID' // Panlalawigan affirmed the measure in its entirety
  | 'VALID_IN_PART' // Panlalawigan approved with partial invalidity finding
  | 'RETURNED' // Panlalawigan returned with objections
  | 'DEEMED_APPROVED' // 30-day Panlalawigan window lapsed with no action; RA 7160 §56(d)
  // Citizen complaint states
  | 'PENDING_HEARING' // Complaint logged; committee referral in progress
  | 'RECEIVED_SEEN' // Vice Mayor or Committee has acknowledged the complaint
  | 'DISMISSED' // Complaint dismissed by Secretariat or committee
  | 'RESOLVED'; // Committee report issued; complainant notified; case closed

export type NumberVariant = 'final' | 'preliminary';

export type SLAStatus = 'on-track' | 'at-risk' | 'breached';

export type ScanQualityLevel = 'excellent' | 'good' | 'fair' | 'poor';

export type RoutingAction =
  | 'Logged'
  | 'Transmitted'
  | 'Received'
  | 'FirstReadingConducted'
  | 'ReferredToCommittee'
  | 'CommitteeReportSubmitted'
  | 'SecondReadingConducted'
  | 'ThirdReadingConducted'
  | 'FinalNumberAssigned'
  | 'VPCertified'
  | 'TransmittedToMayor'
  | 'SignedByMayor'
  | 'Vetoed'
  | 'Lapsed'
  | 'DeemedApproved'
  | 'SubmittedToPanlalawigan'
  | 'PanlalawiganOutcomeRecorded'
  | 'Released'
  | 'Archived'
  | 'CertificationOfUrgencyLogged'
  | 'CommitteeBypassApplied'
  | 'OverrideVoteRecorded'
  | 'Docketed'
  | 'Repassed'
  | 'OrderOfBusinessScheduled';

export type CommitteeReportStatus = 'SUBMITTED' | 'PENDING' | 'ABSENT_NOT_HEARD';

export interface RoutingEntry {
  id: string;
  actorName: string;
  actorOfficeName: string;
  action: RoutingAction;
  timestamp: Date;
  notes?: string;
  fromOfficeName?: string;
  toOfficeName?: string;
}

export interface WorkflowStep {
  id: string;
  label: string;
  state: 'completed' | 'active' | 'pending' | 'skipped' | 'error';
  completedAt?: Date;
  assigneeName?: string;
  tooltip?: string;
}

export interface CommitteeReferral {
  id: string;
  committeeName: string;
  status: CommitteeReportStatus;
  submittedBy?: string;
  submittedAt?: Date;
}

export interface OrderOfBusinessItem {
  agendaNumber: number;
  documentNumber: string;
  numberVariant: NumberVariant;
  title: string;
  documentState: DocumentState;
  committeeReferrals: CommitteeReferral[];
  isCertifiedUrgent: boolean;
  isMissingReport: boolean;
  scheduledReadingType: 'FIRST' | 'SECOND' | 'THIRD';
}

export interface DocumentPreview {
  id: string;
  documentNumber: string;
  numberVariant: NumberVariant;
  title: string;
  documentState: DocumentState;
  lastActionAt: Date;
  slaDeadlineAt?: Date;
  slaStartedAt?: Date;
  thumbnailUrl?: string;
}

export interface StatusMetaEntry {
  label: string;
  bg: string;
  text: string;
  borderLeft: string;
  borderStyle: 'solid' | 'dashed';
  textStyle: 'normal' | 'italic' | 'line-through';
}
