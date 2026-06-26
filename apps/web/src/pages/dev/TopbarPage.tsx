import React from "react";
import { Navigate } from "react-router-dom";
import { Topbar } from "@batac/ui";

const USER_MOCK = {
  name: "Gladys R. Lagura",
  role: "SP Secretary",
};

const BREADCRUMBS_NORMAL = [
  { label: "Home", href: "/dev/components" },
  { label: "Documents", href: "/dev/components/sidebar" },
  { label: "7SP 2026-001" },
];

const BREADCRUMBS_SINGLE = [
  { label: "Dashboard" },
];

const BREADCRUMBS_LONG = [
  { label: "Home", href: "/dev/components" },
  { label: "Documents Library", href: "#" },
  { label: "Legislative Archive Collection", href: "#" },
  { label: "Regular Session Files 2026", href: "#" },
  { label: "Draft Ordinances Folder", href: "#" },
  { label: "7SP-2026-001-A-REVISED-FINAL" },
];

export default function TopbarPage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  const [collapsed, setCollapsed] = React.useState(false);
  const [lastAction, setLastAction] = React.useState<string>("None");

  const handleNotificationClick = () => {
    setLastAction("Notification bell clicked");
  };

  const handleUserMenuAction = (action: "profile" | "logout") => {
    setLastAction(`User menu action triggered: ${action}`);
  };

  return (
    <div className="p-8 space-y-12 max-w-7xl mx-auto pb-24">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-2">
          Dev Component Preview
        </h2>
        <h1 className="text-2xl font-bold text-text-primary">
          Topbar Component (Tier 3)
        </h1>
        <p className="text-xs text-text-muted mt-1">
          Demonstrates fixed layout offset, notification counts, user menus, and responsive breadcrumb truncation.
        </p>
      </div>

      {/* Control panel for testing */}
      <section className="p-4 bg-surface-raised rounded-lg border border-border-default space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">
          Interactive Controls
        </h3>
        <div className="flex flex-wrap gap-4 items-center">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="px-4 py-2 bg-primary-800 text-white rounded text-sm font-semibold hover:bg-primary-900 transition-colors cursor-pointer"
          >
            Toggle Sidebar collapsed state: {collapsed ? "TRUE" : "FALSE"}
          </button>
          <div className="text-xs text-text-secondary">
            Last Action: <strong className="text-primary-800">{lastAction}</strong>
          </div>
        </div>
      </section>

      {/* Case 1: Standard layout & notification badge states */}
      <section className="space-y-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          1. Notification Count Badge States (Fixed Header Preview)
        </h3>
        <p className="text-xs text-text-muted">
          Notice the header takes the top layer. In this preview, we display the Topbars in relative boxes so they do not overlap each other, but they use the exact layout styles.
        </p>

        {/* 1.1 Zero Notifications */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-text-secondary">
            A. Zero Notifications (Count = 0 / Badge Absent)
          </h4>
          <div className="relative border border-border-default rounded-lg h-20 bg-surface-raised [&>header]:relative [&>header]:top-auto [&>header]:left-auto [&>header]:right-auto [&>header]:h-full [&>header]:w-full">
            <Topbar
              breadcrumbs={BREADCRUMBS_NORMAL}
              sidebarCollapsed={collapsed}
              notificationCount={0}
              onNotificationClick={handleNotificationClick}
              currentUser={USER_MOCK}
              onUserMenuAction={handleUserMenuAction}
            />
          </div>
        </div>

        {/* 1.2 Has Notifications */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-text-secondary">
            B. Active Notifications (Count = 5 / Badge Present)
          </h4>
          <div className="relative border border-border-default rounded-lg h-20 bg-surface-raised [&>header]:relative [&>header]:top-auto [&>header]:left-auto [&>header]:right-auto [&>header]:h-full [&>header]:w-full">
            <Topbar
              breadcrumbs={BREADCRUMBS_NORMAL}
              sidebarCollapsed={collapsed}
              notificationCount={5}
              onNotificationClick={handleNotificationClick}
              currentUser={USER_MOCK}
              onUserMenuAction={handleUserMenuAction}
            />
          </div>
        </div>
      </section>

      {/* Case 2: Breadcrumb variations & truncation */}
      <section className="space-y-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          2. Breadcrumb Structures & Truncation
        </h3>

        {/* 2.1 Single level */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-text-secondary">
            A. Single Segment Breadcrumb (e.g. Dashboard root)
          </h4>
          <div className="relative border border-border-default rounded-lg h-20 bg-surface-raised [&>header]:relative [&>header]:top-auto [&>header]:left-auto [&>header]:right-auto [&>header]:h-full [&>header]:w-full">
            <Topbar
              breadcrumbs={BREADCRUMBS_SINGLE}
              sidebarCollapsed={collapsed}
              notificationCount={2}
              onNotificationClick={handleNotificationClick}
              currentUser={USER_MOCK}
              onUserMenuAction={handleUserMenuAction}
            />
          </div>
        </div>

        {/* 2.2 Very long breadcrumb path to verify truncation */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-text-secondary">
            B. Long Path (Truncates middle segments on narrow viewports/containers)
          </h4>
          <p className="text-xs text-text-muted">
            The container below is limited in width to simulate mobile or a narrow viewport (max-w-[400px]). The middle segments must display &quot;…&quot; truncation while the first segment (&quot;Home&quot;) and final segment (&quot;7SP-2026-001-A-REVISED-FINAL&quot;) remain visible.
          </p>
          <div className="relative border border-border-default rounded-lg h-20 bg-surface-raised max-w-[400px] overflow-hidden [&>header]:relative [&>header]:top-auto [&>header]:left-auto [&>header]:right-auto [&>header]:h-full [&>header]:w-full [&>header]:px-3">
            <Topbar
              breadcrumbs={BREADCRUMBS_LONG}
              sidebarCollapsed={collapsed}
              notificationCount={12}
              onNotificationClick={handleNotificationClick}
              currentUser={USER_MOCK}
              onUserMenuAction={handleUserMenuAction}
            />
          </div>
        </div>
      </section>

      {/* Case 3: Fixed placement offset preview */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          3. Absolute Fixed Placement & Sidebar Width Offset
        </h3>
        <p className="text-xs text-text-muted">
          When rendered at the top of the App Shell, the Topbar uses fixed positioning and offset. Click the &quot;Toggle Sidebar&quot; button in Section 1 to see the Topbar adjust its left boundary in sync with the simulated sidebar container.
        </p>
        <div className="relative border border-border-default rounded-lg h-[400px] overflow-hidden flex bg-neutral-50">
          {/* Simulated Sidebar */}
          <div
            className={`bg-primary-950 text-white p-4 transition-all duration-base ease-default flex flex-col items-center ${
              collapsed ? "w-14" : "w-60"
            }`}
          >
            <span className="font-semibold text-xs truncate">
              {collapsed ? "SP" : "Batac SP DMS"}
            </span>
          </div>

          {/* Simulated Main Body + Fixed Topbar */}
          <div className="flex-1 relative flex flex-col pt-14">
            <Topbar
              breadcrumbs={BREADCRUMBS_NORMAL}
              sidebarCollapsed={collapsed}
              notificationCount={2}
              onNotificationClick={handleNotificationClick}
              currentUser={USER_MOCK}
              onUserMenuAction={handleUserMenuAction}
            />
            <div className="flex-1 p-6 text-xs text-text-secondary">
              Main content panel starts below Topbar. Left margin is correctly aligned to the sidebar width.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
