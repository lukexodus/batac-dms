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
import EmptyStatePage from "./pages/dev/EmptyStatePage";
import StatCardPage from "./pages/dev/StatCardPage";
import ScanQualityIndicatorPage from "./pages/dev/ScanQualityIndicatorPage";

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
