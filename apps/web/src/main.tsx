import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { TooltipProvider, Toaster } from '@batac/ui';
import '@batac/ui/styles/globals.css';

import { SessionHydrator } from './components/SessionHydrator';
import { queryClient } from './lib/query-client.js';
import { trpc, trpcClient } from './lib/trpc.js';
import { openobserveRum as rum } from '@openobserve/browser-rum';
import { useLocation, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import AllComponentsPage from './pages/dev/AllComponentsPage';
import AppShellPage from './pages/dev/AppShellPage';
import CommitteeReferralBlockPage from './pages/dev/CommitteeReferralBlockPage';
import ComponentsPage from './pages/dev/ComponentsPage';
import DocumentNumberBadgePage from './pages/dev/DocumentNumberBadgePage';
import DocumentPreviewCardPage from './pages/dev/DocumentPreviewCardPage';
import EmptyStatePage from './pages/dev/EmptyStatePage';
import OrderOfBusinessRowPage from './pages/dev/OrderOfBusinessRowPage';
import PageHeaderPage from './pages/dev/PageHeaderPage';
import QRCodeDisplayPage from './pages/dev/QRCodeDisplayPage';
import RoutingHistoryTimelinePage from './pages/dev/RoutingHistoryTimelinePage';
import ScanQualityIndicatorPage from './pages/dev/ScanQualityIndicatorPage';
import SidebarPage from './pages/dev/SidebarPage';
import SLATimerPage from './pages/dev/SLATimerPage';
import StatCardPage from './pages/dev/StatCardPage';
import StatusBadgePage from './pages/dev/StatusBadgePage';
import TopbarPage from './pages/dev/TopbarPage';
import WorkflowStepIndicatorPage from './pages/dev/WorkflowStepIndicatorPage';
import ComplaintDetailPage from './pages/documents/ComplaintDetailPage';
import { ComplaintIntakeClerkAssistedPage } from './pages/documents/ComplaintIntakeClerkAssistedPage';
import { ComplaintsListPage } from './pages/documents/ComplaintsListPage';
import DocumentDetailPage from './pages/documents/DocumentDetailPage';
import DocumentIntakePage from './pages/documents/DocumentIntakePage';
import { DocumentListPage } from './pages/documents/DocumentListPage';
import { DocumentRequestDetailPage } from './pages/documents/DocumentRequestDetailPage';
import { DocumentRequestIntakeClerkAssistedPage } from './pages/documents/DocumentRequestIntakeClerkAssistedPage';
import { DocumentRequestsListPage } from './pages/documents/DocumentRequestsListPage';
import { DatabasePerformancePage } from './pages/sysadmin/DatabasePerformancePage';
import { SecurityAuditLedgerPage } from './pages/sysadmin/SecurityAuditLedgerPage';
import { RoleAssignmentPage } from './pages/iam/RoleAssignmentPage';
import { CommitteeManagementPage } from './pages/organization/CommitteeManagementPage';
import { OrganizationPage } from './pages/organization/OrganizationPage';
import { ActiveSessionsPage } from './pages/sysadmin/ActiveSessionsPage';
import { PlatformAdminHomePage } from './pages/admin/PlatformAdminHomePage';
import { EnvironmentConfigPage } from './pages/sysadmin/EnvironmentConfigPage';
import { SystemAdminHomePage } from './pages/sysadmin/SystemAdminHomePage';
import { SystemLogsPage } from './pages/sysadmin/SystemLogsPage';
import { UserAccountManagementPage } from './pages/sysadmin/UserAccountManagementPage';
import { MayorDashboardPage } from './pages/workflow/MayorDashboardPage';
import { MyAssignedStepsPage } from './pages/workflow/MyAssignedStepsPage';
import { OrderOfBusinessPage } from './pages/workflow/OrderOfBusinessPage';
import { SecretaryDashboardPage } from './pages/workflow/SecretaryDashboardPage';
import { SessionAttendanceDetailPage } from './pages/workflow/SessionAttendanceDetailPage';
import { SessionAttendanceOverviewPage } from './pages/workflow/SessionAttendanceOverviewPage';
import { WorkflowStepActionPage } from './pages/workflow/WorkflowStepActionPage';
import { RequireAuth } from './components/RequireAuth';
import { LoginPage } from './pages/auth/LoginPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

import { AuthenticatedLayout } from './components/AuthenticatedLayout';

rum.init({
  applicationId: 'batac-dms',
  clientToken: import.meta.env['VITE_OTEL_RUM_CLIENT_TOKEN'],
  site: import.meta.env['VITE_OTEL_RUM_SITE'],
  organizationIdentifier: import.meta.env['VITE_OTEL_RUM_ORGANIZATION'],
  apiVersion: 'v1',
  insecureHTTP: false,
  service: 'batac-web',
  env: import.meta.env['MODE'],
  trackViewsManually: true,
  trackUserInteractions: true,
  trackResources: true,
  trackLongTasks: true,
  defaultPrivacyLevel: 'mask-user-input',
});

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    rum.startView(location.pathname);
  }, [location.pathname]);
  return <Outlet />;
}

const router = createBrowserRouter([
  {
    element: <RouteTracker />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/reset-password',
        element: <ResetPasswordPage />,
      },
      {
        path: '/',
        element: (
          <RequireAuth>
            <AuthenticatedLayout />
          </RequireAuth>
        ),
        children: [
          {
            index: true,
            element: <HomePage />,
          },
          {
            path: 'organization',
            element: <OrganizationPage />,
          },
          {
            path: 'admin',
            element: <PlatformAdminHomePage />,
          },
          {
            path: 'admin/committees',
            element: <CommitteeManagementPage />,
          },
          {
            path: 'admin/roles',
            element: <RoleAssignmentPage />,
          },
          {
            path: 'sysadmin',
            element: <SystemAdminHomePage />,
          },
          {
            path: 'sysadmin/database-performance',
            element: <DatabasePerformancePage />,
          },
          {
            path: 'sysadmin/audit-ledger',
            element: <SecurityAuditLedgerPage />,
          },
          {
            path: 'sysadmin/environment',
            element: <EnvironmentConfigPage />,
          },
          {
            path: 'sysadmin/logs',
            element: <SystemLogsPage />,
          },
          {
            path: 'sysadmin/sessions',
            element: <ActiveSessionsPage />,
          },
          {
            path: 'sysadmin/users',
            element: <UserAccountManagementPage />,
          },
          {
            path: 'workflow/steps',
            element: <MyAssignedStepsPage />,
          },
          {
            path: 'workflow/steps/:instanceId',
            element: <WorkflowStepActionPage />,
          },
          {
            path: 'mayor',
            element: <MayorDashboardPage />,
          },
          {
            path: 'secretary',
            element: <SecretaryDashboardPage />,
          },
          {
            path: 'sessions',
            element: <SessionAttendanceOverviewPage />,
          },
          {
            path: 'sessions/:sessionDate',
            element: <SessionAttendanceDetailPage />,
          },
          {
            path: 'order-of-business',
            element: <OrderOfBusinessPage />,
          },
          {
            path: 'documents',
            element: <DocumentListPage />,
          },
          {
            path: 'documents/new',
            element: <DocumentIntakePage />,
          },
          {
            path: 'complaints',
            element: <ComplaintsListPage />,
          },
          {
            path: 'complaints/new',
            element: <ComplaintIntakeClerkAssistedPage />,
          },
          {
            path: 'complaints/:complaintId',
            element: <ComplaintDetailPage />,
          },
          {
            path: 'document-requests',
            element: <DocumentRequestsListPage />,
          },
          {
            path: 'document-requests/new',
            element: <DocumentRequestIntakeClerkAssistedPage />,
          },
          {
            path: 'document-requests/:requestId',
            element: <DocumentRequestDetailPage />,
          },
          {
            path: 'documents/:documentId',
            element: <DocumentDetailPage />,
          },
          {
            path: '*',
            element: <NotFoundPage />,
          },
        ],
      },
      {
        path: '/dev/components',
        element: <ComponentsPage />,
      },
      {
        path: '/dev/components/page-header',
        element: <PageHeaderPage />,
      },
      {
        path: '/dev/components/sidebar',
        element: <SidebarPage />,
      },
      {
        path: '/dev/components/topbar',
        element: <TopbarPage />,
      },
      {
        path: '/dev/components/app-shell',
        element: <AppShellPage />,
      },
      {
        path: '/dev/components/document-number-badge',
        element: <DocumentNumberBadgePage />,
      },
      {
        path: '/dev/components/routing-history-timeline',
        element: <RoutingHistoryTimelinePage />,
      },
      {
        path: '/dev/components/empty-state',
        element: <EmptyStatePage />,
      },
      {
        path: '/dev/components/stat-card',
        element: <StatCardPage />,
      },
      {
        path: '/dev/components/scan-quality-indicator',
        element: <ScanQualityIndicatorPage />,
      },
      {
        path: '/dev/components/sla-timer',
        element: <SLATimerPage />,
      },
      {
        path: '/dev/components/qr-code-display',
        element: <QRCodeDisplayPage />,
      },
      {
        path: '/dev/components/committee-referral-block',
        element: <CommitteeReferralBlockPage />,
      },
      {
        path: '/dev/components/status-badge',
        element: <StatusBadgePage />,
      },
      {
        path: '/dev/components/workflow-step-indicator',
        element: <WorkflowStepIndicatorPage />,
      },
      {
        path: '/dev/components/document-preview-card',
        element: <DocumentPreviewCardPage />,
      },
      {
        path: '/dev/components/order-of-business-row',
        element: <OrderOfBusinessRowPage />,
      },
      {
        path: '/dev/all-components',
        element: <AllComponentsPage />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <SessionHydrator />
          <TooltipProvider delayDuration={500}>
            <RouterProvider router={router} />
            <Toaster
              position="bottom-right"
              duration={5000}
              toastOptions={{
                classNames: {
                  success: 'bg-success-100 text-success-900 border border-success-500',
                  error: 'bg-danger-100 text-danger-900 border border-danger-500',
                  warning: 'bg-warning-100 text-warning-900 border border-warning-500',
                  info: 'bg-info-100 text-info-900 border border-info-500',
                },
              }}
            />
          </TooltipProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </>
  </React.StrictMode>,
);
