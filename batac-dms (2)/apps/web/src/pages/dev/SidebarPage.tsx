import {
  LayoutDashboard,
  FileText,
  Calendar,
  Users,
  Settings,
} from "lucide-react";
import React from "react";
import { Navigate } from "react-router-dom";

import { Sidebar } from "@batac/ui";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "documents", label: "Documents", icon: FileText, href: "/documents", badge: 3 },
  { id: "sessions", label: "Sessions", icon: Calendar, href: "/sessions" },
  { id: "members", label: "SP Members", icon: Users, href: "/members" },
  { id: "settings", label: "Settings", icon: Settings, href: "/settings", disabled: true },
];

const USER_MOCK = {
  name: "Gladys R. Lagura",
  role: "SP Secretary",
};

export default function SidebarPage() {
  const [interactiveCollapsed, setInteractiveCollapsed] = React.useState(false);
  const [activeItem, setActiveItem] = React.useState("documents");

  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  return (
    <div className="p-8 space-y-12 max-w-7xl mx-auto">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-6">
          Dev Component Preview &gt; Sidebar
        </h2>
      </div>

      {/* Case 1: Interactive Demo */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">
          1. Interactive Demo
        </h3>
        <p className="text-xs text-text-muted">
          Click the toggle button in the sidebar header to test transitions. Click navigation links to test active state selection.
        </p>
        <div className="relative border border-border-default rounded-lg overflow-hidden h-[600px] flex bg-surface-raised [&>aside]:relative [&>aside]:top-auto [&>aside]:left-auto [&>aside]:h-full">
          <Sidebar
            items={NAV_ITEMS}
            activeItemId={activeItem}
            collapsed={interactiveCollapsed}
            onToggle={() => setInteractiveCollapsed((prev) => !prev)}
            currentUser={USER_MOCK}
          />
          <div className="flex-1 p-8 bg-surface-base flex flex-col justify-center items-center text-center">
            <h4 className="text-lg font-semibold text-text-primary mb-2">
              Mock App Shell Content Area
            </h4>
            <p className="text-sm text-text-secondary max-w-md">
              The Sidebar is currently{" "}
              <strong className="text-primary-800">
                {interactiveCollapsed ? "Collapsed (56px)" : "Expanded (240px)"}
              </strong>
              .
            </p>
            <div className="mt-6 flex gap-4">
              <button
                type="button"
                onClick={() => setInteractiveCollapsed((prev) => !prev)}
                className="px-4 py-2 bg-primary-800 text-white rounded text-sm font-semibold hover:bg-primary-900 transition-colors"
              >
                Toggle Collapse from Content
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveItem(
                    activeItem === "documents" ? "dashboard" : "documents"
                  )
                }
                className="px-4 py-2 border border-border-default rounded text-sm font-semibold hover:bg-surface-raised transition-colors"
              >
                Change Active Link
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Case 2: Side-by-Side Comparison */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">
          2. Static Comparison (Expanded vs. Collapsed)
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Expanded Sidebar */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Expanded State
            </h4>
            <div className="relative border border-border-default rounded-lg overflow-hidden h-[500px] flex bg-surface-raised [&>aside]:relative [&>aside]:top-auto [&>aside]:left-auto [&>aside]:h-full">
              <Sidebar
                items={NAV_ITEMS}
                activeItemId="documents"
                collapsed={false}
                onToggle={() => {}}
                currentUser={USER_MOCK}
              />
              <div className="flex-1 p-6 bg-surface-base text-xs text-text-muted">
                Sidebar fixed width: 240px
              </div>
            </div>
          </div>

          {/* Collapsed Sidebar */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Collapsed State (Icon-only)
            </h4>
            <div className="relative border border-border-default rounded-lg overflow-hidden h-[500px] flex bg-surface-raised [&>aside]:relative [&>aside]:top-auto [&>aside]:left-auto [&>aside]:h-full">
              <Sidebar
                items={NAV_ITEMS}
                activeItemId="documents"
                collapsed={true}
                onToggle={() => {}}
                currentUser={USER_MOCK}
              />
              <div className="flex-1 p-6 bg-surface-base text-xs text-text-muted">
                Sidebar fixed width: 56px. Tooltips are visible on hover.
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
