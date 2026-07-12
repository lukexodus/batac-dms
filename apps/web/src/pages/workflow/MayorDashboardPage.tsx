import {
  ClipboardList,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardHeader, CardTitle, CardContent, EmptyState, Skeleton } from "@batac/ui";
import { StatCard } from "@batac/ui/components/domain/StatCard";

import { useAuth } from "@/lib/auth-context";
import { hasRole } from "@/lib/auth-helpers";
import { trpc, type RouterOutputs } from "@/lib/trpc";

const PAGE_ALLOWED_ROLES = ["mayor"] as const;

export function MayorDashboardPage() {
  const { session } = useAuth();
  const roleCodes = session?.roleCodes ?? [];

  if (!hasRole(roleCodes, ...PAGE_ALLOWED_ROLES)) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-text-muted">
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
        <h1 className="text-2xl font-bold text-text-primary">Mayor Dashboard</h1>
        <p className="text-sm text-text-muted">
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

type AssignedStepRow = RouterOutputs["workflow"]["listMyAssignedSteps"]["items"][number];

function QueueWidget() {
  const { data, isLoading } = trpc.workflow.listMyAssignedSteps.useQuery({
    limit: 30,
  });

  const assignedRows = data?.items ?? [];

  // N+1 batched fetching for panelHint
  // Note: if this list grows large in practice, the better long-term fix is a server-side addition
  // (a new filter param on listMyAssignedSteps, or including stepKey/panelHint directly in its existing output)
  // rather than optimizing the N+1 pattern itself — this would be its own small backend task.
  const instanceQueries = trpc.useQueries((t) =>
    assignedRows.map((row) => t.workflow.getInstance({ instanceId: row.instanceId }))
  );

  const isInstancesLoading = instanceQueries.some((q) => q.isLoading);
  const loading = isLoading || isInstancesLoading;

  // Combine rows with their resolved instance data
  const combinedItems = assignedRows.map((row, index) => {
    const instanceData = instanceQueries[index]?.data;
    return {
      ...row,
      panelHint: instanceData?.panelHint,
      lapseStatus: instanceData?.lapseStatus,
      slaDeadline: instanceData?.slaDeadline,
    };
  });

  const decisions = combinedItems.filter((item) => item.panelHint === "mayor_decision");
  const lapses = combinedItems.filter((item) => item.panelHint === "mayor_lapse_confirmation");

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-text-muted" />
          My Assigned Steps
        </CardTitle>
        <Link to="/workflow/steps" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
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
                <h3 className="text-sm font-medium text-text-primary mb-3">Awaiting Your Decision</h3>
                <div className="space-y-2">
                  {decisions.map((step) => (
                    <Link
                      key={step.instanceId}
                      to={`/workflow/steps/${step.instanceId}`}
                      className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text-primary truncate">
                          {step.documentTitle}
                        </p>
                        <p className="text-xs text-text-muted">
                          {step.stepType.replace(/_/g, " ")}
                          {step.dueAt && (
                            <>
                              {" "}&middot; Due{" "}
                              {new Date(step.dueAt).toLocaleDateString("en-PH", {
                                month: "short",
                                day: "numeric",
                              })}
                            </>
                          )}
                        </p>
                      </div>
                      <span className="ml-2 shrink-0 text-xs text-text-muted">
                        {new Date(step.assignedAt).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {lapses.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-3">Lapse Notices</h3>
                <div className="space-y-2">
                  {lapses.map((step) => (
                    <div
                      key={step.instanceId}
                      className="flex items-center justify-between rounded-md border p-3 text-sm bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text-primary truncate">
                          {step.documentTitle}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">
                          Pending SP Secretary confirmation
                          {step.slaDeadline && (
                            <>
                              {" "}
                              &middot; Deadline passed on{" "}
                              {new Date(step.slaDeadline).toLocaleDateString("en-PH", {
                                month: "short",
                                day: "numeric",
                              })}
                            </>
                          )}
                        </p>
                      </div>
                      <span className="ml-2 shrink-0 rounded-full bg-warning-100 px-2 py-0.5 text-xs font-medium text-warning-800 whitespace-nowrap">
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
        <CardTitle className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-text-muted" />
          SLA Compliance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <AlertTriangle className="h-4 w-4" />
            SLA data is not available for your role.
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <StatCard
              metric={breachedCount}
              label="Breached SLAs"
              {...(breachedCount > 0
                ? { trend: { value: breachedCount, direction: "down" as const, label: "need attention" } }
                : {})}
            />
            {breachedCount > 0 && (
              <div className="flex-1 space-y-2">
                {data!.slice(0, 3).map((item) => (
                  <Link
                    key={item.instanceId}
                    to={`/workflow/steps/${item.instanceId}`}
                    className="flex items-center justify-between rounded-md border p-2 text-xs hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-text-primary truncate">
                        {item.documentId.slice(0, 8)}...
                      </p>
                      <p className="text-text-muted">
                        {item.slaClassification} &middot; {item.elapsedWorkingDays.toFixed(1)}d elapsed
                      </p>
                    </div>
                    <span className="ml-2 shrink-0 rounded-full bg-danger-100 px-2 py-0.5 text-xs font-medium text-danger-700">
                      Breached
                    </span>
                  </Link>
                ))}
                {breachedCount > 3 && (
                  <p className="text-xs text-text-muted text-center">
                    +{breachedCount - 3} more breached
                  </p>
                )}
              </div>
            )}
            {breachedCount === 0 && (
              <p className="text-sm text-success-600 font-medium">
                All documents are within SLA.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
