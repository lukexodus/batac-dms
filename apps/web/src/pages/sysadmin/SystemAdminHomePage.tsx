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
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <p className="text-lg font-semibold text-destructive">Access Denied</p>
          <p className="text-sm text-muted-foreground mt-2">
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader
        title="System Administration"
        subtitle="Infrastructure-level controls for the Batac City LGU platform."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {NAV_ITEMS.map((item) => (
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
        ))}
      </div>
    </div>
  );
}
