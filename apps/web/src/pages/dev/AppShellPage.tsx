import { LayoutDashboard, FileText, Calendar, Users, Settings } from 'lucide-react';
import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { AppShell, Sidebar, Topbar, Card } from '@batac/ui';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dev/components/app-shell' },
  {
    id: 'documents',
    label: 'Documents',
    icon: FileText,
    href: '/dev/components/app-shell',
    badge: 3,
  },
  { id: 'sessions', label: 'Sessions', icon: Calendar, href: '/dev/components/app-shell' },
  { id: 'members', label: 'SP Members', icon: Users, href: '/dev/components/app-shell' },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: '/dev/components/app-shell',
    disabled: true,
  },
];

const USER_MOCK = {
  name: 'Gladys R. Lagura',
  role: 'SP Secretary',
};

export default function AppShellPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeItem] = useState('documents');

  // Enforce dev env check matching other dev pages
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  return (
    <AppShell
      sidebarCollapsed={collapsed}
      onSidebarToggle={() => setCollapsed((c) => !c)}
      sidebarContent={
        <Sidebar
          items={NAV_ITEMS}
          activeItemId={activeItem}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          currentUser={USER_MOCK}
        />
      }
      topbarContent={
        <Topbar
          breadcrumbs={[{ label: 'Home', href: '/dev/components' }, { label: 'AppShell Dev Page' }]}
          sidebarCollapsed={collapsed}
          currentUser={USER_MOCK}
        />
      }
    >
      <div className="space-y-6 p-6">
        <Card className="p-6">
          <h2 className="text-text-primary mb-4 text-xl font-bold">App Shell Component Preview</h2>
          <p className="text-text-secondary text-sm leading-relaxed">
            Welcome to the AppShell component preview page. This page composes a real{' '}
            <code>Sidebar</code> and a real <code>Topbar</code>.
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="bg-primary-800 hover:bg-primary-900 focus-visible:outline-warning-500 rounded-md px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Toggle Sidebar ({collapsed ? 'Expand' : 'Collapse'})
            </button>
          </div>
        </Card>

        {/* Generate long content to test scrolling */}
        <Card className="p-6">
          <h3 className="text-text-primary mb-4 text-lg font-semibold">Scroll Test Section</h3>
          <p className="text-text-secondary mb-4 text-sm">
            Below is dummy content to force vertical scrolling, allowing verification that only the
            main content area scrolls, while the Topbar and Sidebar remain fixed.
          </p>
          <div className="space-y-4">
            {Array.from({ length: 15 }).map((_, i) => (
              <p key={i} className="text-text-muted text-sm leading-relaxed">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam nec arcu ac felis
                eleifend convallis. Suspendisse vitae porta lectus. Ut ut nisl in tellus varius
                convallis. Proin ac convallis dolor. Nullam aliquet gravida leo, id dictum leo
                commodo vel. Integer nec urna sed massa efficitur viverra.
              </p>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
