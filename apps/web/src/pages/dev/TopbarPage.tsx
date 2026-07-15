import React from 'react';
import { Navigate } from 'react-router-dom';

import { Topbar } from '@batac/ui';

const USER_MOCK = {
  name: 'Gladys R. Lagura',
  role: 'SP Secretary',
};

const BREADCRUMBS_NORMAL = [
  { label: 'Home', href: '/dev/components' },
  { label: 'Documents', href: '/dev/components/sidebar' },
  { label: '7SP 2026-001' },
];

const BREADCRUMBS_SINGLE = [{ label: 'Dashboard' }];

const BREADCRUMBS_LONG = [
  { label: 'Home', href: '/dev/components' },
  { label: 'Documents Library', href: '#' },
  { label: 'Legislative Archive Collection', href: '#' },
  { label: 'Regular Session Files 2026', href: '#' },
  { label: 'Draft Ordinances Folder', href: '#' },
  { label: '7SP-2026-001-A-REVISED-FINAL' },
];

export default function TopbarPage() {
  const [collapsed, setCollapsed] = React.useState(false);
  const [lastAction, setLastAction] = React.useState<string>('None');

  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  const handleNotificationClick = () => {
    setLastAction('Notification bell clicked');
  };

  const handleUserMenuAction = (action: 'profile' | 'logout') => {
    setLastAction(`User menu action triggered: ${action}`);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-12 p-8 pb-24">
      <div>
        <h2 className="text-text-muted mb-2 text-sm font-semibold tracking-wider uppercase">
          Dev Component Preview
        </h2>
        <h1 className="text-text-primary text-2xl font-bold">Topbar Component (Tier 3)</h1>
        <p className="text-text-muted mt-1 text-xs">
          Demonstrates fixed layout offset, notification counts, user menus, and responsive
          breadcrumb truncation.
        </p>
      </div>

      {/* Control panel for testing */}
      <section className="bg-surface-raised border-border-default space-y-4 rounded-lg border p-4">
        <h3 className="text-text-primary text-sm font-semibold">Interactive Controls</h3>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="bg-primary-800 hover:bg-primary-900 cursor-pointer rounded px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            Toggle Sidebar collapsed state: {collapsed ? 'TRUE' : 'FALSE'}
          </button>
          <div className="text-text-secondary text-xs">
            Last Action: <strong className="text-primary-800">{lastAction}</strong>
          </div>
        </div>
      </section>

      {/* Case 1: Standard layout & notification badge states */}
      <section className="space-y-6">
        <h3 className="text-text-muted text-sm font-semibold tracking-wide uppercase">
          1. Notification Count Badge States (Fixed Header Preview)
        </h3>
        <p className="text-text-muted text-xs">
          Notice the header takes the top layer. In this preview, we display the Topbars in relative
          boxes so they do not overlap each other, but they use the exact layout styles.
        </p>

        {/* 1.1 Zero Notifications */}
        <div className="space-y-2">
          <h4 className="text-text-secondary text-xs font-semibold">
            A. Zero Notifications (Count = 0 / Badge Absent)
          </h4>
          <div className="border-border-default bg-surface-raised relative h-20 rounded-lg border [&>header]:relative [&>header]:top-auto [&>header]:right-auto [&>header]:left-auto [&>header]:h-full [&>header]:w-full">
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
          <h4 className="text-text-secondary text-xs font-semibold">
            B. Active Notifications (Count = 5 / Badge Present)
          </h4>
          <div className="border-border-default bg-surface-raised relative h-20 rounded-lg border [&>header]:relative [&>header]:top-auto [&>header]:right-auto [&>header]:left-auto [&>header]:h-full [&>header]:w-full">
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
        <h3 className="text-text-muted text-sm font-semibold tracking-wide uppercase">
          2. Breadcrumb Structures & Truncation
        </h3>

        {/* 2.1 Single level */}
        <div className="space-y-2">
          <h4 className="text-text-secondary text-xs font-semibold">
            A. Single Segment Breadcrumb (e.g. Dashboard root)
          </h4>
          <div className="border-border-default bg-surface-raised relative h-20 rounded-lg border [&>header]:relative [&>header]:top-auto [&>header]:right-auto [&>header]:left-auto [&>header]:h-full [&>header]:w-full">
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
          <h4 className="text-text-secondary text-xs font-semibold">
            B. Long Path (Truncates middle segments on narrow viewports/containers)
          </h4>
          <p className="text-text-muted text-xs">
            The container below is limited in width to simulate mobile or a narrow viewport
            (max-w-[400px]). The middle segments must display &quot;…&quot; truncation while the
            first segment (&quot;Home&quot;) and final segment
            (&quot;7SP-2026-001-A-REVISED-FINAL&quot;) remain visible.
          </p>
          <div className="border-border-default bg-surface-raised relative h-20 max-w-[400px] overflow-hidden rounded-lg border [&>header]:relative [&>header]:top-auto [&>header]:right-auto [&>header]:left-auto [&>header]:h-full [&>header]:w-full [&>header]:px-3">
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
        <h3 className="text-text-muted text-sm font-semibold tracking-wide uppercase">
          3. Absolute Fixed Placement & Sidebar Width Offset
        </h3>
        <p className="text-text-muted text-xs">
          When rendered at the top of the App Shell, the Topbar uses fixed positioning and offset.
          Click the &quot;Toggle Sidebar&quot; button in Section 1 to see the Topbar adjust its left
          boundary in sync with the simulated sidebar container.
        </p>
        <div className="border-border-default relative flex h-[400px] overflow-hidden rounded-lg border bg-neutral-50">
          {/* Simulated Sidebar */}
          <div
            className={`bg-primary-950 duration-base ease-default flex flex-col items-center p-4 text-white transition-all ${
              collapsed ? 'w-14' : 'w-60'
            }`}
          >
            <span className="truncate text-xs font-semibold">
              {collapsed ? 'SP' : 'Batac SP DMS'}
            </span>
          </div>

          {/* Simulated Main Body + Fixed Topbar */}
          <div className="relative flex flex-1 flex-col pt-14">
            <Topbar
              breadcrumbs={BREADCRUMBS_NORMAL}
              sidebarCollapsed={collapsed}
              notificationCount={2}
              onNotificationClick={handleNotificationClick}
              currentUser={USER_MOCK}
              onUserMenuAction={handleUserMenuAction}
            />
            <div className="text-text-secondary flex-1 p-6 text-xs">
              Main content panel starts below Topbar. Left margin is correctly aligned to the
              sidebar width.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
