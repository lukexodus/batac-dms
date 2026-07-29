import { ClipboardList, ShieldCheck, AlertTriangle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Card, CardHeader, CardTitle, CardContent, EmptyState, Skeleton } from '@batac/ui';
import { StatCard } from '@batac/ui/components/domain/StatCard';

import { hasRole } from '@/lib/auth-helpers';
import { trpc } from '@/lib/trpc';
import { useSessionStore } from '@/stores';

const PAGE_ALLOWED_ROLES = ['mayor'] as const;

export function MayorDashboardPage() {
  const identity = useSessionStore((s) => s.identity);

  if (!hasRole(identity, ...PAGE_ALLOWED_ROLES)) {
    return (
      <div className="text-text-muted flex flex-col items-center justify-center p-8">
        You do not have permission to view this page.
      </div>
    );
  }

  return <MayorDashboardContent />;
}

function MayorDashboardContent() {
  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-text-primary text-2xl font-bold">Mayor Dashboard</h1>
        <p className="text-text-muted text-sm">
          Overview of your assigned steps and SLA compliance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QueueWidget />
        <SlaComplianceWidget />
      </div>
    </div>
  );
}

function QueueWidget() {
  // MUST STAY IN SYNC WITH MAYOR_STEP_KEYS IN workflow.policy.ts
  const MAYOR_STEP_KEYS = ['mayor_review', 'mayor_signature'];
  const { data, isLoading } = trpc.workflow.listMyAssignedSteps.useQuery({
    limit: 30,
    stepKeyIn: [...MAYOR_STEP_KEYS],
  });

  const assignedRows = data?.items ?? [];
  const loading = isLoading;

  const decisions = assignedRows.filter((item) => item.panelHint === 'mayor_decision');
  const lapses = assignedRows.filter((item) => item.panelHint === 'mayor_lapse_confirmation');

  return (
    <Card className="h-full">
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
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !assignedRows.length || (decisions.length === 0 && lapses.length === 0) ? (
          <EmptyState
            icon={ClipboardList}
            heading="No assigned steps"
            body="You have no pending workflow steps requiring your action."
          />
        ) : (
          <div className="space-y-6">
            {decisions.length > 0 && (
              <div>
                <h3 className="text-text-primary mb-3 text-sm font-medium">
                  Awaiting Your Decision
                </h3>
                <div className="space-y-2">
                  {decisions.map((step) => (
                    <Link
                      key={step.instanceId}
                      to={`/workflow/steps/${step.instanceId}`}
                      className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-text-primary truncate font-medium">
                          {step.documentTitle}
                        </p>
                        <p className="text-text-muted text-xs">
                          {step.stepName || step.stepType.replace(/_/g, ' ')}
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
              </div>
            )}

            {lapses.length > 0 && (
              <div>
                <h3 className="text-text-primary mb-3 text-sm font-medium">Lapse Notices</h3>
                <div className="space-y-2">
                  {lapses.map((step) => (
                    <div
                      key={step.instanceId}
                      className="flex items-center justify-between rounded-md border bg-gray-50 p-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-text-primary truncate font-medium">
                          {step.documentTitle}
                        </p>
                        <p className="text-text-muted mt-0.5 text-xs">
                          Pending SP Secretary confirmation
                          {step.dueAt && (
                            <>
                              {' '}
                              &middot; Deadline passed on{' '}
                              {new Date(step.dueAt).toLocaleDateString('en-PH', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </>
                          )}
                        </p>
                      </div>
                      <span className="bg-warning-100 text-warning-800 ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                        Action Lapsed
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SlaComplianceWidget() {
  const { data, isLoading, error } = trpc.workflow.getSlaComplianceData.useQuery({
    breachedOnly: true,
  });

  const breachedCount = data?.length ?? 0;

  return (
    <Card className="h-full">
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
