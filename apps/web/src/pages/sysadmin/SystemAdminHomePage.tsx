import React from 'react';
import { Link } from 'react-router-dom';

import { PageHeader, Card, CardHeader, CardTitle, CardContent } from '@batac/ui';

import { useSessionStore } from '@/stores';

// Client-side sys-admin gate.
// NOTE: This is an approximation of the server's ctx.auth.isItAdmin,
// which is derived from the JWT `is_ita` claim set via:
//   activeRoles.some((ra) => ra.role.code === 'sys_admin')
// The session's roleCodes array carries the same values, so this check
// is currently equivalent. It would diverge if the sys_admin role row
// were ever renamed or if a new system-admin role were created with a
// different code — both of which are unlikely but possible. Real enforcement
// is server-side; this is UX-only defense-in-depth.
function AccessDenied() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <p className="text-destructive text-lg font-semibold">Access Denied</p>
          <p className="text-muted-foreground mt-2 text-sm">
            This section requires System Administrator privileges.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

const NAV_ITEMS = [
  {
    label: 'Active Sessions',
    description: 'View and terminate active user sessions across the platform.',
    href: '/sysadmin/sessions',
    icon: '🔑',
  },
  {
    label: 'User Accounts',
    description: 'Create, edit, deactivate, and reactivate user accounts.',
    href: '/sysadmin/users',
    icon: '👤',
  },
] as const;

export function SystemAdminHomePage() {
  const identity = useSessionStore((s) => s.identity);

  // See divergence-risk comment above.
  if (!identity?.roleCodes.includes('sys_admin')) {
    return <AccessDenied />;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        title="System Administration"
        subtitle="Infrastructure-level controls for the Batac City LGU platform."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {NAV_ITEMS.map((item) => (
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
        ))}
      </div>
    </div>
  );
}
