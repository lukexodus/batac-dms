import React from 'react';
import { Link } from 'react-router-dom';

import { PageHeader, Card, CardHeader, CardTitle, CardContent } from '@batac/ui';

import { useAuth } from '@/lib/auth-context';

// Client-side plat-admin gate.
// NOTE: This checks `session.roleCodes.includes('plat_admin')` on the frontend.
// The backend's own internal IAM checks use a distinct boolean-flag mechanism 
// (`ctx.auth.isPlatformAdmin` derived from claims), rather than checking a generic 
// `roleCodes` array. This is a known divergence: the frontend only has access to the 
// `roleCodes` array from the session, so we use it here. Real enforcement is server-side; 
// this is UX-only defense-in-depth.
function AccessDenied() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <p className="text-lg font-semibold text-danger-600">Access Denied</p>
          <p className="text-sm text-muted-foreground mt-2">
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
  const { session } = useAuth();

  // See divergence-risk comment above.
  if (!session?.roleCodes.includes('plat_admin')) {
    return <AccessDenied />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-8">
      <PageHeader
        title="Platform Administration"
        subtitle="Business-level structural controls for the Batac City LGU platform."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {NAV_ITEMS.map((item) => {
          if (item.disabled) {
            return (
              <Card key={item.label} className="h-full opacity-60 cursor-not-allowed">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
                    <span role="img" aria-hidden>{item.icon}</span>
                    {item.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            );
          }

          return (
            <Link
              key={item.href}
              to={item.href}
              className="group no-underline"
            >
              <Card className="h-full transition-shadow hover:shadow-md group-hover:border-primary/40 cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span role="img" aria-hidden>{item.icon}</span>
                    {item.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
