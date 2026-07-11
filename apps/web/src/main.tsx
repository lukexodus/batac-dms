import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { TooltipProvider, Toaster } from "@batac/ui";
import "@batac/ui/styles/globals.css";

import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth-context.js';
import { queryClient } from './lib/query-client.js';
import { trpc, trpcClient } from './lib/trpc.js';

import { DocumentListPage } from "./pages/documents/DocumentListPage";
import { CommitteeManagementPage } from "./pages/organization/CommitteeManagementPage";
import { OrganizationPage } from "./pages/organization/OrganizationPage";
import { RoleAssignmentPage } from "./pages/iam/RoleAssignmentPage";
import { SystemAdminHomePage } from "./pages/sysadmin/SystemAdminHomePage";
import { ActiveSessionsPage } from "./pages/sysadmin/ActiveSessionsPage";
import { UserAccountManagementPage } from "./pages/sysadmin/UserAccountManagementPage";
import { MyAssignedStepsPage } from "./pages/workflow/MyAssignedStepsPage";
import { WorkflowStepActionPage } from "./pages/workflow/WorkflowStepActionPage";
import DocumentIntakePage from "./pages/documents/DocumentIntakePage";
import DocumentDetailPage from "./pages/documents/DocumentDetailPage";
import { ComplaintsListPage } from "./pages/documents/ComplaintsListPage";
import { ComplaintIntakeClerkAssistedPage } from "./pages/complaints/ComplaintIntakeClerkAssistedPage";
import { DocumentRequestsListPage } from "./pages/documents/DocumentRequestsListPage";
import { DocumentRequestIntakeClerkAssistedPage } from "./pages/documents/DocumentRequestIntakeClerkAssistedPage";
import { SecretaryDashboardPage } from "./pages/workflow/SecretaryDashboardPage";
import AllComponentsPage from "./pages/dev/AllComponentsPage";
import AppShellPage from "./pages/dev/AppShellPage";
import CommitteeReferralBlockPage from "./pages/dev/CommitteeReferralBlockPage";
import ComponentsPage from "./pages/dev/ComponentsPage";
import DocumentNumberBadgePage from "./pages/dev/DocumentNumberBadgePage";
import DocumentPreviewCardPage from "./pages/dev/DocumentPreviewCardPage";
import EmptyStatePage from "./pages/dev/EmptyStatePage";
import OrderOfBusinessRowPage from "./pages/dev/OrderOfBusinessRowPage";
import PageHeaderPage from "./pages/dev/PageHeaderPage";
import QRCodeDisplayPage from "./pages/dev/QRCodeDisplayPage";
import RoutingHistoryTimelinePage from "./pages/dev/RoutingHistoryTimelinePage";
import ScanQualityIndicatorPage from "./pages/dev/ScanQualityIndicatorPage";
import SidebarPage from "./pages/dev/SidebarPage";
import SLATimerPage from "./pages/dev/SLATimerPage";
import StatCardPage from "./pages/dev/StatCardPage";
import StatusBadgePage from "./pages/dev/StatusBadgePage";
import TopbarPage from "./pages/dev/TopbarPage";
import WorkflowStepIndicatorPage from "./pages/dev/WorkflowStepIndicatorPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <div>Batac DMS Home</div>,
  },
  {
    path: "/organization",
    element: <OrganizationPage />,
  },
  {
    path: "/admin/committees",
    element: <CommitteeManagementPage />,
  },
  {
    path: "/admin/roles",
    element: <RoleAssignmentPage />,
  },
  {
    path: "/sysadmin",
    element: <SystemAdminHomePage />,
  },
  {
    path: "/sysadmin/sessions",
    element: <ActiveSessionsPage />,
  },
  {
    path: "/sysadmin/users",
    element: <UserAccountManagementPage />,
  },
  {
    path: "/workflow/steps",
    element: <MyAssignedStepsPage />,
  },
  {
    path: "/workflow/steps/:instanceId",
    element: <WorkflowStepActionPage />,
  },
  {
    path: "/secretary",
    element: <SecretaryDashboardPage />,
  },
  {
    path: "/documents",
    element: <DocumentListPage />,
  },
  {
    path: "/documents/new",
    element: <DocumentIntakePage />,
  },
  {
    path: "/complaints",
    element: <ComplaintsListPage />,
  },
  {
    path: "/complaints/new",
    element: <ComplaintIntakeClerkAssistedPage />,
  },
  {
    path: "/document-requests",
    element: <DocumentRequestsListPage />,
  },
  {
    path: "/document-requests/new",
    element: <DocumentRequestIntakeClerkAssistedPage />,
  },
  {
    // /documents/new is registered before :documentId so the static segment
    // always wins — React Router v6 also ranks static segments above dynamic
    // params by default, but the explicit ordering removes any ambiguity.
    path: "/documents/:documentId",
    element: <DocumentDetailPage />,
  },
  {
    path: "/dev/components",
    element: <ComponentsPage />,
  },
  {
    path: "/dev/components/page-header",
    element: <PageHeaderPage />,
  },
  {
    path: "/dev/components/sidebar",
    element: <SidebarPage />,
  },
  {
    path: "/dev/components/topbar",
    element: <TopbarPage />,
  },
  {
    path: "/dev/components/app-shell",
    element: <AppShellPage />,
  },
  {
    path: "/dev/components/document-number-badge",
    element: <DocumentNumberBadgePage />,
  },
  {
    path: "/dev/components/routing-history-timeline",
    element: <RoutingHistoryTimelinePage />,
  },
  {
    path: "/dev/components/empty-state",
    element: <EmptyStatePage />,
  },
  {
    path: "/dev/components/stat-card",
    element: <StatCardPage />,
  },
  {
    path: "/dev/components/scan-quality-indicator",
    element: <ScanQualityIndicatorPage />,
  },
  {
    path: "/dev/components/sla-timer",
    element: <SLATimerPage />,
  },
  {
    path: "/dev/components/qr-code-display",
    element: <QRCodeDisplayPage />,
  },
  {
    path: "/dev/components/committee-referral-block",
    element: <CommitteeReferralBlockPage />,
  },
  {
    path: "/dev/components/status-badge",
    element: <StatusBadgePage />,
  },
  {
    path: "/dev/components/workflow-step-indicator",
    element: <WorkflowStepIndicatorPage />,
  },
  {
    path: "/dev/components/document-preview-card",
    element: <DocumentPreviewCardPage />,
  },
  {
    path: "/dev/components/order-of-business-row",
    element: <OrderOfBusinessRowPage />,
  },
  {
    path: "/dev/all-components",
    element: <AllComponentsPage />,
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={500}>
            <RouterProvider router={router} />
            <Toaster
              position="bottom-right"
              duration={5000}
              toastOptions={{
                classNames: {
                  success: "bg-success-100 text-success-900 border border-success-500",
                  error: "bg-danger-100 text-danger-900 border border-danger-500",
                  warning: "bg-warning-100 text-warning-900 border border-warning-500",
                  info: "bg-info-100 text-info-900 border border-info-500",
                },
              }}
            />
          </TooltipProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </AuthProvider>
  </React.StrictMode>
);
