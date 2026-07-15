import React from 'react';
import { Navigate } from 'react-router-dom';

import { StatCard } from '@batac/ui';

export default function StatCardPage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-7xl space-y-12 p-8">
      <div>
        <h2 className="text-text-muted mb-6 text-sm font-semibold tracking-wider uppercase">
          Dev Component Preview &gt; StatCard
        </h2>
        <h1 className="text-text-primary mb-2 text-3xl font-bold">StatCard</h1>
        <p className="text-text-secondary max-w-2xl">
          Dashboard stat card displaying a single top-level KPI metric, custom label, and optional
          up/down trend indicator with comparison text.
        </p>
      </div>

      {/* Case 1: Metric and Label Only */}
      <section className="space-y-4">
        <h3 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
          1. Metric and Label Only
        </h3>
        <div className="bg-surface-base border-border-default grid grid-cols-1 gap-4 rounded-lg border p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <StatCard metric="7SP 2026-001" label="Latest Enacted Resolution" />
        </div>
      </section>

      {/* Case 2: Metric + Label + Trend Up */}
      <section className="space-y-4">
        <h3 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
          2. Metric + Label + Positive Trend (Up)
        </h3>
        <div className="bg-surface-base border-border-default grid grid-cols-1 gap-4 rounded-lg border p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            metric={14}
            label="Pending in Queue"
            trend={{ value: 3, direction: 'up', label: 'from last week' }}
          />
        </div>
      </section>

      {/* Case 3: Metric + Label + Trend Down */}
      <section className="space-y-4">
        <h3 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
          3. Metric + Label + Negative Trend (Down)
        </h3>
        <div className="bg-surface-base border-border-default grid grid-cols-1 gap-4 rounded-lg border p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            metric={2}
            label="SLA Breaches This Week"
            trend={{ value: 1, direction: 'down', label: 'from last week' }}
          />
        </div>
      </section>

      {/* Case 4: Attempted Background Color Override */}
      <section className="space-y-4">
        <h3 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
          4. Anti-pattern Override Test (Card background stays bg-white)
        </h3>
        <p className="text-text-secondary mb-2 text-sm">
          This test card has class{' '}
          <code>className="bg-primary-50 bg-neutral-100 hover:bg-neutral-200"</code> passed to it.
          The background must remain <code>bg-white</code>.
        </p>
        <div className="bg-surface-base border-border-default grid grid-cols-1 gap-4 rounded-lg border p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            metric={14}
            label="Pending in Queue (bg Override)"
            trend={{ value: 3, direction: 'up' }}
            className="bg-primary-50 bg-neutral-100 hover:bg-neutral-200"
          />
        </div>
      </section>
    </div>
  );
}
