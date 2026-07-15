import React from 'react';
import { Link } from 'react-router-dom';

import { PageHeader, Card, CardHeader, CardTitle, CardContent } from '@batac/ui';

import { useSessionStore } from '@/stores';

// Client-side plat-admin gate.
// NOTE: This checks `identity.roleCodes.includes('plat_admin')` on the frontend.
// The backend's own internal IAM checks use a distinct boolean-flag mechanism
// (`ctx.auth.isPlatformAdmin` derived from claims), rather than checking a generic
// `roleCodes` array. This is a known divergence: the frontend only has access to the
// `roleCodes` array from the session, so we use it here. Real enforcement is server-side;
// this is UX-only defense-in-depth.
function AccessDenied() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <p className="text-danger-600 text-lg font-semibold">Access Denied</p>
          <p className="text-muted-foreground mt-2 text-sm">
            This section requires Platform Administrator privileges.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

const NAV_ITEMS = [
  {
    label: 'Committees',
    description: 'Manage committee assignments and structures.',
    href: '/admin/committees',
    icon: '🏢',
    disabled: false,
  },
  {
    label: 'Role Assignment',
    description: 'Assign structural roles (e.g. Mayor, SP Secretary) to user accounts.',
    href: '/admin/roles',
    icon: '🛡️',
    disabled: false,
  },
  {
    label: 'Configuration',
    description: 'System configuration settings (Coming Soon).',
    href: '#',
    icon: '⚙️',
    disabled: true,
  },
  {
    label: 'Delivery Logs',
    description: 'Platform notification and delivery logs (Coming Soon).',
    href: '#',
    icon: '📫',
    disabled: true,
  },
  {
    label: 'Announcements',
    description: 'Manage platform-wide announcements (Coming Soon).',
    href: '#',
    icon: '📢',
    disabled: true,
  },
] as const;

export function PlatformAdminHomePage() {
  const identity = useSessionStore((s) => s.identity);

  // See divergence-risk comment above.
  if (!identity?.roleCodes.includes('plat_admin')) {
    return <AccessDenied />;
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      <PageHeader
        title="Platform Administration"
        subtitle="Business-level structural controls for the Batac City LGU platform."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {NAV_ITEMS.map((item) => {
          if (item.disabled) {
            return (
              <Card key={item.label} className="h-full cursor-not-allowed opacity-60">
                <CardHeader>
                  <CardTitle className="text-muted-foreground flex items-center gap-2 text-base">
                    <span role="img" aria-hidden>
                      {item.icon}
                    </span>
                    {item.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </CardContent>
              </Card>
            );
          }

          return (
            <Link key={item.href} to={item.href} className="group no-underline">
              <Card className="group-hover:border-primary/40 h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span role="img" aria-hidden>
                      {item.icon}
                    </span>
                    {item.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
