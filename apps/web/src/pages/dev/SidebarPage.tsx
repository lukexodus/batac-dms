import { LayoutDashboard, FileText, Calendar, Users, Settings } from 'lucide-react';
import React from 'react';
import { Navigate } from 'react-router-dom';

import { Sidebar } from '@batac/ui';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'documents', label: 'Documents', icon: FileText, href: '/documents', badge: 3 },
  { id: 'sessions', label: 'Sessions', icon: Calendar, href: '/sessions' },
  { id: 'members', label: 'SP Members', icon: Users, href: '/members' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings', disabled: true },
];

const USER_MOCK = {
  name: 'Gladys R. Lagura',
  role: 'SP Secretary',
};

export default function SidebarPage() {
  const [interactiveCollapsed, setInteractiveCollapsed] = React.useState(false);
  const [activeItem, setActiveItem] = React.useState('documents');

  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-7xl space-y-12 p-8">
      <div>
        <h2 className="text-text-muted mb-6 text-sm font-semibold tracking-wider uppercase">
          Dev Component Preview &gt; Sidebar
        </h2>
      </div>

      {/* Case 1: Interactive Demo */}
      <section className="space-y-4">
        <h3 className="text-text-primary text-sm font-semibold">1. Interactive Demo</h3>
        <p className="text-text-muted text-xs">
          Click the toggle button in the sidebar header to test transitions. Click navigation links
          to test active state selection.
        </p>
        <div className="border-border-default bg-surface-raised relative flex h-[600px] overflow-hidden rounded-lg border [&>aside]:relative [&>aside]:top-auto [&>aside]:left-auto [&>aside]:h-full">
          <Sidebar
            items={NAV_ITEMS}
            activeItemId={activeItem}
            collapsed={interactiveCollapsed}
            onToggle={() => setInteractiveCollapsed((prev) => !prev)}
            currentUser={USER_MOCK}
          />
          <div className="bg-surface-base flex flex-1 flex-col items-center justify-center p-8 text-center">
            <h4 className="text-text-primary mb-2 text-lg font-semibold">
              Mock App Shell Content Area
            </h4>
            <p className="text-text-secondary max-w-md text-sm">
              The Sidebar is currently{' '}
              <strong className="text-primary-800">
                {interactiveCollapsed ? 'Collapsed (56px)' : 'Expanded (240px)'}
              </strong>
              .
            </p>
            <div className="mt-6 flex gap-4">
              <button
                type="button"
                onClick={() => setInteractiveCollapsed((prev) => !prev)}
                className="bg-primary-800 hover:bg-primary-900 rounded px-4 py-2 text-sm font-semibold text-white transition-colors"
              >
                Toggle Collapse from Content
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveItem(activeItem === 'documents' ? 'dashboard' : 'documents')
                }
                className="border-border-default hover:bg-surface-raised rounded border px-4 py-2 text-sm font-semibold transition-colors"
              >
                Change Active Link
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Case 2: Side-by-Side Comparison */}
      <section className="space-y-4">
        <h3 className="text-text-primary text-sm font-semibold">
          2. Static Comparison (Expanded vs. Collapsed)
        </h3>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Expanded Sidebar */}
          <div className="space-y-2">
            <h4 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
              Expanded State
            </h4>
            <div className="border-border-default bg-surface-raised relative flex h-[500px] overflow-hidden rounded-lg border [&>aside]:relative [&>aside]:top-auto [&>aside]:left-auto [&>aside]:h-full">
              <Sidebar
                items={NAV_ITEMS}
                activeItemId="documents"
                collapsed={false}
                onToggle={() => {}}
                currentUser={USER_MOCK}
              />
              <div className="bg-surface-base text-text-muted flex-1 p-6 text-xs">
                Sidebar fixed width: 240px
              </div>
            </div>
          </div>

          {/* Collapsed Sidebar */}
          <div className="space-y-2">
            <h4 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
              Collapsed State (Icon-only)
            </h4>
            <div className="border-border-default bg-surface-raised relative flex h-[500px] overflow-hidden rounded-lg border [&>aside]:relative [&>aside]:top-auto [&>aside]:left-auto [&>aside]:h-full">
              <Sidebar
                items={NAV_ITEMS}
                activeItemId="documents"
                collapsed={true}
                onToggle={() => {}}
                currentUser={USER_MOCK}
              />
              <div className="bg-surface-base text-text-muted flex-1 p-6 text-xs">
                Sidebar fixed width: 56px. Tooltips are visible on hover.
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
