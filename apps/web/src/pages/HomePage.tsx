import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useSessionStore } from '@/stores';
import { useAuthActions } from '@/hooks/useAuthActions';
import { PageHeader, Card, CardHeader, CardTitle, CardContent } from '@batac/ui';

export function HomePage() {
  const identity = useSessionStore((s) => s.identity);

  if (!identity) {
    return <Navigate to="/login" replace />;
  }

  const roles = identity.roleCodes;

  // Priority: mayor > sp_secretary > sys_admin
  if (roles.includes('mayor')) {
    return <Navigate to="/mayor" replace />;
  }
  if (roles.includes('sp_secretary')) {
    return <Navigate to="/secretary" replace />;
  }
  if (roles.includes('sys_admin')) {
    return <Navigate to="/sysadmin" replace />;
  }

  // Fallback generic landing view for roles with no dedicated dashboard
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <PageHeader title="Batac DMS" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(roles.includes('records_officer') ||
          roles.includes('dept_encoder') ||
          roles.includes('brgy_encoder')) && (
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <Link to="/documents" className="text-primary hover:underline">
                View Documents
              </Link>
            </CardContent>
          </Card>
        )}
        {(roles.includes('sp_member') || roles.includes('sp_presiding_officer')) && (
          <Card>
            <CardHeader>
              <CardTitle>Workflow</CardTitle>
            </CardHeader>
            <CardContent>
              <Link to="/workflow/steps" className="text-primary hover:underline">
                My Assigned Steps
              </Link>
            </CardContent>
          </Card>
        )}
        {roles.includes('auditor') && (
          <Card>
            <CardHeader>
              <CardTitle>Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <Link to="/sessions" className="text-primary hover:underline">
                Session Overview
              </Link>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Select an option from the navigation to continue.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
