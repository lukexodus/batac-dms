import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { TooltipProvider, Toaster } from "@batac/ui";
import "@batac/ui/styles/globals.css";

import ComponentsPage from "./pages/dev/ComponentsPage";
import PageHeaderPage from "./pages/dev/PageHeaderPage";
import SidebarPage from "./pages/dev/SidebarPage";
import TopbarPage from "./pages/dev/TopbarPage";
import AppShellPage from "./pages/dev/AppShellPage";
import DocumentNumberBadgePage from "./pages/dev/DocumentNumberBadgePage";
import RoutingHistoryTimelinePage from "./pages/dev/RoutingHistoryTimelinePage";
import EmptyStatePage from "./pages/dev/EmptyStatePage";
import StatCardPage from "./pages/dev/StatCardPage";
import ScanQualityIndicatorPage from "./pages/dev/ScanQualityIndicatorPage";
import SLATimerPage from "./pages/dev/SLATimerPage";
import QRCodeDisplayPage from "./pages/dev/QRCodeDisplayPage";
import CommitteeReferralBlockPage from "./pages/dev/CommitteeReferralBlockPage";
import StatusBadgePage from "./pages/dev/StatusBadgePage";
import WorkflowStepIndicatorPage from "./pages/dev/WorkflowStepIndicatorPage";
import DocumentPreviewCardPage from "./pages/dev/DocumentPreviewCardPage";
import OrderOfBusinessRowPage from "./pages/dev/OrderOfBusinessRowPage";
import AllComponentsPage from "./pages/dev/AllComponentsPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <div>Batac DMS Home</div>,
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
  </React.StrictMode>
);
