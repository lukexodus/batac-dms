import { Search } from "lucide-react";
import React, { useState } from "react";
import { Navigate } from "react-router-dom";

import {
  AppShell,
  Sidebar,
  Topbar,
  PageHeader,
  StatCard,
  DocumentNumberBadge,
  StatusBadge,
  SLATimer,
  DocumentPreviewCard,
  WorkflowStepIndicator,
  RoutingHistoryTimeline,
  ScanQualityIndicator,
  QRCodeDisplay,
  OrderOfBusinessRow,
  CommitteeReferralBlock,
  EmptyState,
} from "@batac/ui";

export function AllComponentsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  // Mocks for Section 1
  const sixRows = Array.from({ length: 6 }).map((_, i) => ({
    id: `row-${i}`,
    docNum: `7SP 2026-00${i + 1}`,
    variant: (i % 2 === 0 ? "final" : "preliminary") as "final" | "preliminary",
    status: ["PENDING_MAYOR", "PANLALAWIGAN_REVIEW", "ARCHIVED"][i % 3] as React.ComponentProps<typeof StatusBadge>["state"],
    slaStart: new Date(Date.now() - 1000 * 60 * 60 * 24 * i),
    slaEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * (5 - i)),
  }));

  const docCards = Array.from({ length: 3 }).map((_, i) => ({
    id: `doc-${i}`,
    documentNumber: `RES 2026-${100 + i}`,
    numberVariant: "final" as const,
    title: "A Resolution Pertaining to Local Matters and Other Issues that Require Attention.",
    documentState: "APPROVED" as React.ComponentProps<typeof DocumentPreviewCard>["document"]["documentState"],
    lastActionAt: new Date(),
    slaStartedAt: new Date(),
    slaDeadlineAt: new Date(Date.now() + 100000000),
  }));

  // Mocks for Section 2
  const workflowSteps = Array.from({ length: 7 }).map((_, i) => ({
    id: `step-${i}`,
    label: `Step ${i + 1}`,
    state: (i < 2 ? "completed" : i === 2 ? "active" : "pending") as "completed" | "active" | "pending",
  }));

  const timelineEntries = Array.from({ length: 5 }).map((_, i) => ({
    id: `tl-${i}`,
    action: ["Transmitted", "SignedByMayor", "Vetoed", "Archived", "Transmitted"][i] as React.ComponentProps<typeof RoutingHistoryTimeline>["entries"][number]["action"],
    actorName: "John Doe",
    actorOfficeName: "Office of the Mayor",
    timestamp: new Date(),
    remarks: "Action performed successfully.",
  }));

  // Mocks for Section 3
  const oobNormal = {
    agendaNumber: 1,
    documentNumber: "7SP 2026-001",
    numberVariant: "final" as const,
    title: "An Ordinance Providing for Solid Waste Management",
    documentState: "PANLALAWIGAN_REVIEW" as React.ComponentProps<typeof OrderOfBusinessRow>["item"]["documentState"],
    committeeReferrals: [{ id: "c1", committeeName: "Environment", status: "PENDING" as React.ComponentProps<typeof CommitteeReferralBlock>["referrals"][number]["status"] }],
    isCertifiedUrgent: false,
    isMissingReport: false,
    scheduledReadingType: "FIRST" as const,
  };

  const oobUrgent = {
    ...oobNormal,
    agendaNumber: 2,
    isCertifiedUrgent: true,
    scheduledReadingType: "SECOND" as const,
    committeeReferrals: [],
  };

  const oobMissing = {
    ...oobNormal,
    agendaNumber: 3,
    isMissingReport: true,
    scheduledReadingType: "THIRD" as const,
  };

  return (
    <AppShell
      sidebarCollapsed={sidebarCollapsed}
      onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      sidebarContent={
        <Sidebar 
          items={[{ id: "dev", label: "Dev Components", icon: Search, href: "/dev/all-components" }]} 
          activeItemId="dev"
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          currentUser={{ name: "Gladys R. Lagura", role: "SP Secretary" }}
        />
      }
      topbarContent={
        <Topbar
          breadcrumbs={[{ label: "Dev Components" }]}
          sidebarCollapsed={sidebarCollapsed}
          currentUser={{ name: "Gladys R. Lagura", role: "SP Secretary" }}
        />
      }
    >
      <div className="p-8 max-w-7xl mx-auto space-y-16">
        {/* Section 1 */}
        <section className="space-y-6">
          <PageHeader
            title="SP Secretary Dashboard"
            subtitle="Overview of current legislative documents and tasks."
          />
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total Documents" metric={1250} />
            <StatCard label="Pending Review" metric={45} />
            <StatCard label="Approved" metric={890} />
            <StatCard label="Rejected" metric={12} />
          </div>

          <div className="bg-white rounded-lg border border-border-default overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-neutral-50 border-b border-border-default">
                <tr>
                  <th className="p-3 text-sm font-medium">Document</th>
                  <th className="p-3 text-sm font-medium">Status</th>
                  <th className="p-3 text-sm font-medium w-72">SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {sixRows.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3 align-middle whitespace-nowrap">
                      <DocumentNumberBadge number={r.docNum} variant={r.variant} />
                    </td>
                    <td className="p-3 align-middle whitespace-nowrap">
                      <StatusBadge state={r.status} />
                    </td>
                    <td className="p-3 align-middle">
                      <div className="max-w-[250px]">
                        <SLATimer
                          deadlineAt={r.slaEnd}
                          startedAt={r.slaStart}
                          label="Review SLA"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {docCards.map((d) => (
              <DocumentPreviewCard key={d.id} document={d} />
            ))}
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-8 bg-white p-6 rounded-lg border border-border-default">
          <div className="flex items-center gap-4 border-b border-border-default pb-4">
            <DocumentNumberBadge number="RES 2026-999" variant="final" />
            <StatusBadge state="PENDING_MAYOR" />
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-4">Workflow Progress</h3>
            <WorkflowStepIndicator steps={workflowSteps} currentStepId="step-2" />
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-semibold mb-4">Routing History</h3>
              <RoutingHistoryTimeline entries={timelineEntries} />
            </div>
            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-semibold mb-4">Scan Quality</h3>
                <div className="flex items-center justify-between p-3 border border-border-default rounded-md">
                  <span className="font-mono text-sm">document_scan_001.pdf</span>
                  <ScanQualityIndicator score={85} showLabel={true} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-4">QR Code</h3>
                <QRCodeDisplay 
                  trackingId="123e4567-e89b-12d3-a456-426614174000"
                  documentNumber="RES 2026-999" 
                  title="A Resolution Pertaining to Local Matters"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-6">
          <PageHeader title="Order of Business" />
          <div className="bg-white rounded-lg border border-border-default overflow-hidden">
            <div className="divide-y divide-border-default">
              {[oobNormal, oobUrgent, oobMissing].map((oob, i) => (
                <div key={i} className="flex flex-col">
                  <div className="px-4 py-3">
                    <OrderOfBusinessRow item={oob} />
                  </div>
                  {/* Expanded block below the row */}
                  {oob.committeeReferrals.length > 0 && (
                    <div className="px-4 pb-4 pl-[4.5rem]">
                      <CommitteeReferralBlock referrals={oob.committeeReferrals} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-8">
            <EmptyState
              icon={Search}
              heading="No more items"
              body="You have reached the end of the order of business."
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default AllComponentsPage;
