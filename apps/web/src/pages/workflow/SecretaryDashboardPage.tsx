import {
  ClipboardList,
  FileText,
  CalendarDays,
  ListChecks,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { Card, CardHeader, CardTitle, CardContent, EmptyState, Skeleton } from '@batac/ui';
import { StatCard } from '@batac/ui/components/domain/StatCard';

import { hasRole } from '@/lib/auth-helpers';
import { trpc, type RouterOutputs } from '@/lib/trpc';
import { useSessionStore } from '@/stores';

type AssignedStep = RouterOutputs['workflow']['listMyAssignedSteps']['items'][number];

const PAGE_ALLOWED_ROLES = ['sp_secretary'] as const;

export function SecretaryDashboardPage() {
  const identity = useSessionStore((s) => s.identity);

  if (!hasRole(identity, ...PAGE_ALLOWED_ROLES)) {
    return (
      <div className="text-text-muted flex flex-col items-center justify-center p-8">
        You do not have permission to view this page.
      </div>
    );
  }

  return <SecretaryDashboardContent />;
}

// ─── Shared query at parent level (SessionCalendarWidget + OrderOfBusinessSummaryWidget) ─

function useOrderOfBusiness() {
  return trpc.session.getOrderOfBusiness.useQuery({});
}

// ─── Main content ─────────────────────────────────────────────────────────────

function SecretaryDashboardContent() {
  const orderOfBusinessQuery = useOrderOfBusiness();

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-text-primary text-2xl font-bold">SP Secretary Dashboard</h1>
        <p className="text-text-muted text-sm">
          Overview of your assigned steps, pending documents, upcoming session, and SLA compliance.
        </p>
      </div>

      {/* Row 1: Queue + Pending Items */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QueueWidget />
        <PendingItemsWidget />
      </div>

      {/* Row 2: Session Calendar + OOB Summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SessionCalendarWidget orderOfBusinessQuery={orderOfBusinessQuery} />
        <OrderOfBusinessSummaryWidget orderOfBusinessQuery={orderOfBusinessQuery} />
      </div>

      {/* Row 3: SLA Compliance */}
      <SlaComplianceWidget />
    </div>
  );
}

// ─── QueueWidget ──────────────────────────────────────────────────────────────

function QueueWidget() {
  const { data, isLoading } = trpc.workflow.listMyAssignedSteps.useQuery({
    limit: 5,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-text-primary flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="text-text-muted h-4 w-4" />
          My Assigned Steps
        </CardTitle>
        <Link
          to="/workflow/steps"
          className="text-primary-600 flex items-center gap-1 text-xs hover:underline"
        >
          View all <ExternalLink className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <EmptyState
            icon={ClipboardList}
            heading="No assigned steps"
            body="You have no pending workflow steps."
          />
        ) : (
          <div className="space-y-2">
            {data.items.map((step: AssignedStep) => (
              <Link
                key={step.instanceId}
                to={`/workflow/steps/${step.instanceId}`}
                className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary truncate font-medium">{step.documentTitle}</p>
                  <p className="text-text-muted text-xs">
                    {step.stepName || String(step.stepType).replace(/_/g, ' ')}
                    {step.dueAt && (
                      <>
                        {' '}
                        &middot; Due{' '}
                        {new Date(step.dueAt).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </>
                    )}
                  </p>
                </div>
                <span className="text-text-muted ml-2 shrink-0 text-xs">
                  {new Date(step.assignedAt).toLocaleDateString('en-PH', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── PendingItemsWidget ───────────────────────────────────────────────────────

function PendingItemsWidget() {
  const identity = useSessionStore((s) => s.identity);
  const officeId = identity?.officeScopeId;

  const { data, isLoading } = trpc.documents.list.useQuery(
    { officeId: officeId!, limit: 5 },
    { enabled: !!officeId },
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-text-primary flex items-center gap-2 text-sm font-semibold">
          <FileText className="text-text-muted h-4 w-4" />
          Pending SP Secretariat Documents
        </CardTitle>
        <Link
          to="/documents"
          className="text-primary-600 flex items-center gap-1 text-xs hover:underline"
        >
          View all <ExternalLink className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <EmptyState
            icon={FileText}
            heading="No pending documents"
            body="No documents are pending in the SP Secretariat."
          />
        ) : (
          <div className="space-y-2">
            {data.items.map((doc) => (
              <Link
                key={doc.id}
                to={`/documents/${doc.id}`}
                className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary truncate font-medium">{doc.title}</p>
                  <p className="text-text-muted text-xs">
                    {doc.documentTypeCode}
                    {doc.preliminaryNumber && <> &middot; {doc.preliminaryNumber}</>}
                  </p>
                </div>
                <span className="ml-2 shrink-0 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                  {doc.lifecycleState.replace(/_/g, ' ')}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── SessionCalendarWidget ────────────────────────────────────────────────────

function SessionCalendarWidget({
  orderOfBusinessQuery,
}: {
  orderOfBusinessQuery: ReturnType<typeof useOrderOfBusiness>;
}) {
  const { data, isLoading } = orderOfBusinessQuery;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-text-primary flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="text-text-muted h-4 w-4" />
          Upcoming Session
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : !data ? (
          <p className="text-text-muted text-sm">No session data available.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-primary text-lg font-bold">
                  {new Date(data.sessionDate).toLocaleDateString('en-PH', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <p className="text-text-muted text-xs">
                  {data.items.length} agenda item{data.items.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {data.items.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {data.items.slice(0, 5).map((item, idx) => (
                  <span
                    key={item.documentId}
                    className="text-text-secondary inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                  >
                    {item.preliminaryNumber ?? `#${idx + 1}`}
                  </span>
                ))}
                {data.items.length > 5 && (
                  <span className="text-text-muted text-xs">+{data.items.length - 5} more</span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── OrderOfBusinessSummaryWidget ─────────────────────────────────────────────

function OrderOfBusinessSummaryWidget({
  orderOfBusinessQuery,
}: {
  orderOfBusinessQuery: ReturnType<typeof useOrderOfBusiness>;
}) {
  const { data, isLoading } = orderOfBusinessQuery;

  const redFlagged =
    data?.items.filter((item) => item.committeeReportStatus === 'red_flagged') ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-text-primary flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="text-text-muted h-4 w-4" />
          Order of Business Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : !data ? (
          <p className="text-text-muted text-sm">No order of business data available.</p>
        ) : (
          <div className="space-y-3">
            {data.items.length === 0 ? (
              <p className="text-text-muted text-sm">No agenda items for this identity.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-text-primary text-xl font-bold">{data.items.length}</p>
                    <p className="text-text-muted text-xs">Total</p>
                  </div>
                  <div>
                    <p className="text-text-primary text-xl font-bold">
                      {data.items.filter((i) => i.committeeReportStatus === 'all_submitted').length}
                    </p>
                    <p className="text-text-muted text-xs">Reports Ready</p>
                  </div>
                  <div>
                    <p className="text-danger-600 text-xl font-bold">{redFlagged.length}</p>
                    <p className="text-text-muted text-xs">Red Flagged</p>
                  </div>
                </div>
                {redFlagged.length > 0 && (
                  <div className="bg-danger-50 text-danger-700 rounded-md p-2 text-xs">
                    <AlertTriangle className="mr-1 inline h-3 w-3" />
                    {redFlagged.length} item{redFlagged.length !== 1 ? 's' : ''} missing committee
                    report{redFlagged.length !== 1 ? 's' : ''}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── SlaComplianceWidget ──────────────────────────────────────────────────────

function SlaComplianceWidget() {
  const { data, isLoading, error } = trpc.workflow.getSlaComplianceData.useQuery({
    breachedOnly: true,
  });

  const breachedCount = data?.length ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-text-primary flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="text-text-muted h-4 w-4" />
          SLA Compliance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : error ? (
          <div className="text-text-muted flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4" />
            SLA data is not available for your role.
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <StatCard
              metric={breachedCount}
              label="Breached SLAs"
              {...(breachedCount > 0
                ? {
                    trend: {
                      value: breachedCount,
                      direction: 'down' as const,
                      label: 'need attention',
                    },
                  }
                : {})}
            />
            {breachedCount > 0 && (
              <div className="flex-1 space-y-2">
                {data!.slice(0, 3).map((item) => (
                  <Link
                    key={item.instanceId}
                    to={`/workflow/steps/${item.instanceId}`}
                    className="flex items-center justify-between rounded-md border p-2 text-xs transition-colors hover:bg-gray-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-text-primary truncate font-medium">
                        {item.documentId.slice(0, 8)}...
                      </p>
                      <p className="text-text-muted">
                        {item.slaClassification} &middot; {item.elapsedWorkingDays.toFixed(1)}d
                        elapsed
                      </p>
                    </div>
                    <span className="bg-danger-100 text-danger-700 ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                      Breached
                    </span>
                  </Link>
                ))}
                {breachedCount > 3 && (
                  <p className="text-text-muted text-center text-xs">
                    +{breachedCount - 3} more breached
                  </p>
                )}
              </div>
            )}
            {breachedCount === 0 && (
              <p className="text-success-600 text-sm font-medium">All documents are within SLA.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
