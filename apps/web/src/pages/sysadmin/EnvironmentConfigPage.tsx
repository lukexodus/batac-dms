import React from 'react';

import { PageHeader, Card, CardContent } from '@batac/ui';

import { trpc } from '@/lib/trpc';
import { useSessionStore } from '@/stores';

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

export function EnvironmentConfigPage() {
  const identity = useSessionStore((s) => s.identity);

  if (!identity?.roleCodes.includes('sys_admin')) {
    return <AccessDenied />;
  }

  const { data, isPending, isError, error } = trpc.iam.getEnvironmentConfigMatrix.useQuery();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <PageHeader
        title="Environment Configuration Matrix"
        subtitle="Live snapshot of the system's runtime environment variables."
      />

      {isPending && (
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-full rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-10 w-full rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-10 w-full rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      )}

      {isError && (
        <div className="border-destructive/30 bg-destructive/5 rounded-md border px-4 py-3">
          <p className="text-destructive text-sm">
            Failed to load environment configuration: {error.message}
          </p>
        </div>
      )}

      {data && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                      Configuration Key
                    </th>
                    <th className="text-muted-foreground px-4 py-3 text-center text-xs font-semibold tracking-wide uppercase">
                      Status
                    </th>
                    <th className="text-muted-foreground w-full px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase">
                      Resolved Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.map((item: any) => (
                    <tr key={item.key} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                        {item.key}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.isSet ? (
                          <span className="inline-flex items-center rounded-full border border-blue-300 bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">
                            SET
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                            UNSET
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {item.isMasked ? (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">{item.value}</span>
                            <span title="Sensitive value is masked" className="cursor-help text-amber-500">
                              🔒
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-900 dark:text-slate-100">
                            {item.value === null ? (
                              <span className="italic text-slate-400">null</span>
                            ) : (
                              item.value
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
