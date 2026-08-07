import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AllowedMimeTypeSchema } from '@batac/shared';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Input,
  Checkbox,
  Label,
  RichTextEditor,
} from '@batac/ui';

import { hasRole } from '@/lib/auth-helpers';
import { isRichTextEmpty } from '@/lib/rich-text';
import { trpc, type RouterOutputs } from '@/lib/trpc';
import { useSessionStore } from '@/stores';

// Per F1 §8.2 Multi-Referral role gates:
//   submitCommitteeReport  → sp_secretary OR sp_member (committee-scoped)
//   enterCommitteeHearingDate → sp_secretary only
//   manuallyAdvanceMultiReferralStep → sp_secretary only
//
// Per-action gating is intentional (not page-level) to avoid sp_member
// seeing sp_secretary-only controls.
export function MultiReferralPanel({
  instance,
}: {
  instance: RouterOutputs['workflow']['getInstance'];
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const identity = useSessionStore((s) => s.identity);

  const isSpSecretary = hasRole(identity, 'sp_secretary');
  const isSpMember = hasRole(identity, 'sp_member');

  // Assign Committees state (sp_secretary only)
  const [selectedCommittees, setSelectedCommittees] = useState<string[]>(
    instance.assignedCommittees?.map((c) => c.committeeId) || []
  );

  // Committee report state
  const [committeeId, setCommitteeId] = useState('');
  const [reportText, setReportText] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportFileError, setReportFileError] = useState<string | null>(null);

  // Hearing date state (sp_secretary only)
  const [hearingDate, setHearingDate] = useState('');

  // Manual advance state (sp_secretary only)
  const [mandatoryComment, setMandatoryComment] = useState('');

  // Consolidate + Accept unified report state (sp_secretary only)
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [isAcceptingReport, setIsAcceptingReport] = useState(false);

  const { data: committees } = trpc.organization.listCommittees.useQuery(undefined, {
    enabled: isSpSecretary || isSpMember,
  });

  const { data: myCommitteeIds } = trpc.organization.listMyCommitteeIds.useQuery(undefined, {
    enabled: isSpMember && !isSpSecretary,
  });

  const { data: documentTypes } = trpc.documents.documentTypes.useQuery(undefined, {
    enabled: isSpSecretary || isSpMember,
  });

  const assignedCommitteeIds = new Set(instance.assignedCommittees?.map((c) => c.committeeId) ?? []);
  const selectableCommittees = (committees ?? []).filter((c) => {
    if (!assignedCommitteeIds.has(c.committeeId)) return false;
    if (isSpSecretary) return true;
    if (isSpMember) return (myCommitteeIds ?? []).includes(c.committeeId);
    return false;
  });

  // Committee submission status — read from getInstance metadata, cross-referenced
  // against assignedCommittees. Committees with no non-missed submission are pending.
  const assignedCommitteeCount = instance.assignedCommittees?.length ?? 0;
  const nonMissedSubmissions = instance.committeeSubmissions?.filter((s) => !s.missed) ?? [];
  const allCommitteesSubmitted =
    assignedCommitteeCount > 0 && nonMissedSubmissions.length >= assignedCommitteeCount;

  // Resolve the COMMITTEE_REPORT document type id used for report uploads.
  const committeeReportTypeId = (documentTypes ?? []).find(
    (t: { code: string }) => t.code === 'COMMITTEE_REPORT',
  )?.id;

  const handleReportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) {
      setReportFile(null);
      setReportFileError(null);
      return;
    }
    const MAX = 26214400; // 25 MiB
    if (selected.size > MAX) {
      setReportFileError('File exceeds 25 MiB limit');
      setReportFile(null);
      return;
    }
    if (!AllowedMimeTypeSchema.safeParse(selected.type).success) {
      setReportFileError('Invalid file type. Must be PDF, Word (.docx), Excel (.xlsx), JPEG, or PNG');
      setReportFile(null);
      return;
    }
    setReportFileError(null);
    setReportFile(selected);
  };

  const assignCommitteesMutation = trpc.workflow.assignCommittees.useMutation({
    onSuccess: () => {
      toast.success('Committees assigned successfully.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.session.getOrderOfBusiness.invalidate();
    },
    onError: (err) => toast.error(err.message || 'Failed to assign committees.'),
  });

  const submitReportMutation = trpc.workflow.submitCommitteeReport.useMutation({
    onSuccess: () => {
      toast.success('Committee report submitted.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.session.getOrderOfBusiness.invalidate();
    },
  });

  const hearingDateMutation = trpc.session.enterCommitteeHearingDate.useMutation({
    onSuccess: () => {
      toast.success('Hearing date recorded.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.session.getOrderOfBusiness.invalidate();
    },
    onError: (err) => toast.error(err.message || 'Failed to enter hearing date.'),
  });

  const advanceMutation = trpc.workflow.manuallyAdvanceMultiReferralStep.useMutation({
    onSuccess: () => {
      toast.success('Step advanced.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.session.getOrderOfBusiness.invalidate();
      navigate('/workflow/steps');
    },
    onError: (err) => toast.error(err.message || 'Failed to advance step.'),
  });

  const createDocumentMutation = trpc.documents.create.useMutation();
  const requestUploadUrlMutation = trpc.documents.requestUploadUrl.useMutation();
  const confirmUploadMutation = trpc.documents.confirmUpload.useMutation();

  const consolidateReportsMutation = trpc.workflow.consolidateCommitteeReports.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Reports consolidated: ${result.mergedPdfCount} PDF(s) merged, ${result.textOnlyCount} text-only, ${result.skippedCount} attachment(s) not merged.`,
      );
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.session.getOrderOfBusiness.invalidate();
      void utils.documents.list.invalidate();
    },
  });

  const acceptUnifiedReportMutation = trpc.workflow.acceptUnifiedReport.useMutation({
    onSuccess: () => {
      toast.success('Unified committee report accepted — step completed.');
      void utils.workflow.getInstance.invalidate({ instanceId: instance.instanceId });
      void utils.workflow.getActiveInstanceForDocument.invalidate({ documentId: instance.documentId });
      void utils.workflow.listMyAssignedSteps.invalidate();
      void utils.session.getOrderOfBusiness.invalidate();
      void utils.documents.list.invalidate();
      navigate('/workflow/steps');
    },
  });

  const uploadReportFile = async (file: File, title: string) => {
    if (!committeeReportTypeId) {
      throw new Error('Committee Report document type is not configured. Run the document-types seed.');
    }
    const mimeTypeCheck = AllowedMimeTypeSchema.safeParse(file.type);
    if (!mimeTypeCheck.success) {
      throw new Error('Unsupported file type');
    }
    const { documentId } = await createDocumentMutation.mutateAsync({
      documentTypeId: committeeReportTypeId,
      title,
    });
    const { uploadUrl, s3Key } = await requestUploadUrlMutation.mutateAsync({
      documentId,
      mimeType: mimeTypeCheck.data,
    });
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
    if (!uploadRes.ok) {
      throw new Error('File upload to storage failed');
    }
    await confirmUploadMutation.mutateAsync({
      documentId,
      s3Key,
      originalFilename: file.name,
      mimeType: mimeTypeCheck.data,
      fileSizeBytes: file.size,
    });
    return documentId;
  };

  const handleSubmitCommitteeReport = async () => {
    if (!committeeId) {
      toast.error('Select a committee');
      return;
    }
    if (isRichTextEmpty(reportText) && !reportFile) {
      toast.error('Provide report text and/or an uploaded report document');
      return;
    }
    try {
      if (reportFile) {
        const committeeName =
          (committees ?? []).find((c: { committeeId: string }) => c.committeeId === committeeId)
            ?.name ?? 'Committee Report';
        const documentId = await uploadReportFile(
          reportFile,
          `${committeeName} — ${instance.documentTitle ?? 'Legislative Measure'}`,
        );
        await submitReportMutation.mutateAsync({
          stepInstanceId: instance.currentStepInstanceId,
          committeeId,
          ...(reportText ? { reportText } : {}),
          documentId,
        });
      } else {
        await submitReportMutation.mutateAsync({
          stepInstanceId: instance.currentStepInstanceId,
          committeeId,
          reportText,
        });
      }
      setReportFile(null);
      setReportText('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit report.');
    }
  };

  const handleConsolidateReports = async () => {
    if (!allCommitteesSubmitted) {
      toast.error('All assigned committees must submit before consolidation');
      return;
    }
    setIsConsolidating(true);
    try {
      await consolidateReportsMutation.mutateAsync({
        instanceId: instance.instanceId,
        stepInstanceId: instance.currentStepInstanceId,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to consolidate reports.');
    } finally {
      setIsConsolidating(false);
    }
  };

  // B4 §4.3 completion sequence: the SP Secretary first consolidates the submitted
  // committee reports into a unified document (or it was already produced), then
  // accepts it — completing the step with outcome REPORT_ACCEPTED.
  const handleAcceptUnifiedReport = async () => {
    if (!instance.unifiedReportDocumentId) {
      toast.error('Consolidate the committee reports first');
      return;
    }
    setIsAcceptingReport(true);
    try {
      await acceptUnifiedReportMutation.mutateAsync({
        instanceId: instance.instanceId,
        stepInstanceId: instance.currentStepInstanceId,
        unifiedReportDocumentId: instance.unifiedReportDocumentId,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept unified report');
    } finally {
      setIsAcceptingReport(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Multi-Referral</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Assign Committees — sp_secretary only */}
        {isSpSecretary && (
          <div className="space-y-3 rounded-md border p-4">
            <h3 className="text-sm font-medium">Assign Committees</h3>
            <div className="space-y-2">
              {(committees ?? []).map((c: { committeeId: string; name: string }) => (
                <div key={c.committeeId} className="flex items-center space-x-2">
                  <Checkbox
                    id={`committee-${c.committeeId}`}
                    checked={selectedCommittees.includes(c.committeeId)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedCommittees([...selectedCommittees, c.committeeId]);
                      } else {
                        setSelectedCommittees(selectedCommittees.filter((id) => id !== c.committeeId));
                      }
                    }}
                  />
                  <Label htmlFor={`committee-${c.committeeId}`}>{c.name}</Label>
                </div>
              ))}
            </div>
            <Button
              onClick={() => {
                if (selectedCommittees.length === 0) {
                  toast.error('Select at least one committee');
                  return;
                }
                assignCommitteesMutation.mutate({
                  stepInstanceId: instance.currentStepInstanceId,
                  committeeIds: selectedCommittees,
                });
              }}
              disabled={assignCommitteesMutation.isPending}
            >
              Assign Committees
            </Button>
          </div>
        )}

        {/* Committee Submissions status — read-only, shown to both roles */}
        {(isSpSecretary || isSpMember) &&
          instance.assignedCommittees &&
          instance.assignedCommittees.length > 0 && (
            <div className="space-y-3 rounded-md border p-4">
              <h3 className="text-sm font-medium">Committee Submissions</h3>
              <ul className="space-y-2 text-sm">
                {instance.assignedCommittees.map((c) => {
                  const submission = (instance.committeeSubmissions ?? []).find(
                    (s) => s.committeeId === c.committeeId,
                  );
                  return (
                    <li key={c.committeeId} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="block">{c.name ?? c.committeeId}</span>
                        {submission && !submission.missed && (
                          <div className="text-muted-foreground text-xs">
                            {submission.reportDocumentTitle && (
                              <p className="truncate">{submission.reportDocumentTitle}</p>
                            )}
                            {submission.reportText && (
  <div
    className="line-clamp-2 text-sm text-muted-foreground [&_p]:m-0 [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_u]:underline [&_s]:line-through [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_blockquote]:italic [&_h3]:font-semibold [&_h3]:text-sm [&_h4]:font-semibold [&_h4]:text-sm [&_a]:underline [&_a]:text-text-link"
    dangerouslySetInnerHTML={{ __html: submission.reportText }}
  />
)}
                            {submission.reportDocumentUrl && (
                              <a
                                href={submission.reportDocumentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline"
                              >
                                View report document
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      {submission ? (
                        <span
                          className={
                            submission.missed
                              ? 'shrink-0 text-amber-600'
                              : 'shrink-0 text-muted-foreground'
                          }
                        >
                          {submission.missed
                            ? 'Missed'
                            : `Submitted · ${
                                submission.submittedAt
                                  ? new Date(submission.submittedAt).toLocaleDateString('en-PH')
                                  : '—'
                              }`}
                        </span>
                      ) : (
                        <span className="shrink-0 text-danger-600">Pending</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="text-muted-foreground text-xs">
                {allCommitteesSubmitted
                  ? 'All assigned committees have submitted.'
                  : `${nonMissedSubmissions.length} of ${assignedCommitteeCount} assigned committee(s) have submitted.`}
              </p>
            </div>
          )}

        {/* Submit Committee Report — sp_secretary or sp_member */}
        {(isSpSecretary || isSpMember) && (
          <div className="space-y-3 rounded-md border p-4">
            <h3 className="text-sm font-medium">Submit Committee Report</h3>
            <Select value={committeeId} onValueChange={setCommitteeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select committee…" />
              </SelectTrigger>
              <SelectContent position="popper">
                {selectableCommittees.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No eligible committees
                  </SelectItem>
                ) : (
                  selectableCommittees.map((c: { committeeId: string; name: string }) => (
                    <SelectItem key={c.committeeId} value={c.committeeId}>
                      {c.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <RichTextEditor
              value={reportText}
              onChange={setReportText}
              placeholder="Report text (or describe the attached document)…"
            />
            <div className="space-y-1">
              <Input
                type="file"
                accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                onChange={handleReportFileChange}
                className="cursor-pointer"
              />
              {reportFileError && <p className="text-danger-600 text-xs">{reportFileError}</p>}
              {reportFile && (
                <p className="text-muted-foreground text-xs">
                  Attached: {reportFile.name} — PDFs are merged into the consolidated report;
                  other formats are listed as attachments.
                </p>
              )}
            </div>
            <Button
              onClick={handleSubmitCommitteeReport}
              disabled={submitReportMutation.isPending}
            >
              {submitReportMutation.isPending ? 'Submitting…' : 'Submit Report'}
            </Button>
          </div>
        )}

        {/* Enter Hearing Date — sp_secretary only */}
        {isSpSecretary && (
          <div className="space-y-3 rounded-md border p-4">
            <h3 className="text-sm font-medium">Enter Committee Hearing Date</h3>
            <Input
              type="date"
              value={hearingDate}
              onChange={(e) => setHearingDate(e.target.value)}
            />
            <Button
              onClick={() => {
                if (!hearingDate) {
                  toast.error('Date is required');
                  return;
                }
                // hearingDate is a string from the date input; z.coerce.date() on the server handles it.
                hearingDateMutation.mutate({
                  stepInstanceId: instance.currentStepInstanceId,
                  hearingDate: new Date(hearingDate),
                });
              }}
              disabled={hearingDateMutation.isPending}
            >
              Set Hearing Date
            </Button>
          </div>
        )}

        {/* Consolidate & Accept Unified Report — sp_secretary only */}
        {isSpSecretary && (
          <div className="space-y-3 rounded-md border p-4">
            <h3 className="text-sm font-medium">Consolidate &amp; Accept Unified Committee Report</h3>
            <p className="text-muted-foreground text-xs">
              Consolidate the submitted committee reports into a single document: a title page
              followed by each committee&apos;s uploaded PDF and any text-only submissions. Review
              the result, then accept it to complete this step. All assigned committees must
              have submitted first.
            </p>
            <Button
              onClick={handleConsolidateReports}
              disabled={!allCommitteesSubmitted || isConsolidating}
            >
              {isConsolidating ? 'Consolidating…' : 'Consolidate Committee Reports'}
            </Button>
            {instance.unifiedReportDocumentUrl && (
              <div className="space-y-1">
                <a
                  href={instance.unifiedReportDocumentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-sm underline"
                >
                  View consolidated report{instance.unifiedReportDocumentTitle ? ` — ${instance.unifiedReportDocumentTitle}` : ''}
                </a>
              </div>
            )}
            <Button
              onClick={handleAcceptUnifiedReport}
              disabled={
                !allCommitteesSubmitted ||
                !instance.unifiedReportDocumentId ||
                isAcceptingReport
              }
            >
              {isAcceptingReport ? 'Accepting…' : 'Accept Reports'}
            </Button>
            {!allCommitteesSubmitted && (
              <p className="text-muted-foreground text-xs">
                Waiting for all assigned committees to submit before the unified report can be
                consolidated and accepted.
              </p>
            )}
            {allCommitteesSubmitted && !instance.unifiedReportDocumentId && (
              <p className="text-muted-foreground text-xs">
                Consolidate the reports first — the accept action needs a unified report document.
              </p>
            )}
          </div>
        )}

        {/* Manually Advance — sp_secretary only */}
        {isSpSecretary && (
          <div className="space-y-3 rounded-md border p-4">
            <h3 className="text-sm font-medium">Manually Advance Step</h3>
            <p className="text-muted-foreground text-xs">
              Use only when all committee reports have been received outside the system.
            </p>
            <RichTextEditor
              value={mandatoryComment}
              onChange={setMandatoryComment}
              placeholder="Reason for manual advance (required)…"
            />
            <Button
              variant="destructive"
              onClick={() => {
                if (!mandatoryComment) {
                  toast.error('A reason is required');
                  return;
                }
                advanceMutation.mutate({
                  stepInstanceId: instance.currentStepInstanceId,
                  mandatoryComment,
                });
              }}
              disabled={advanceMutation.isPending}
            >
              Advance Step
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
