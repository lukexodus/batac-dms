import React from "react";
import { Navigate } from "react-router-dom";

import { StatCard } from "@batac/ui";

export default function StatCardPage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  return (
    <div className="p-8 space-y-12 max-w-7xl mx-auto">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-6">
          Dev Component Preview &gt; StatCard
        </h2>
        <h1 className="text-3xl font-bold text-text-primary mb-2">StatCard</h1>
        <p className="text-text-secondary max-w-2xl">
          Dashboard stat card displaying a single top-level KPI metric, custom label, and optional up/down trend indicator with comparison text.
        </p>
      </div>

      {/* Case 1: Metric and Label Only */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          1. Metric and Label Only
        </h3>
        <div className="p-6 bg-surface-base rounded-lg border border-border-default shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard metric="7SP 2026-001" label="Latest Enacted Resolution" />
        </div>
      </section>

      {/* Case 2: Metric + Label + Trend Up */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          2. Metric + Label + Positive Trend (Up)
        </h3>
        <div className="p-6 bg-surface-base rounded-lg border border-border-default shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            metric={14}
            label="Pending in Queue"
            trend={{ value: 3, direction: "up", label: "from last week" }}
          />
        </div>
      </section>

      {/* Case 3: Metric + Label + Trend Down */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          3. Metric + Label + Negative Trend (Down)
        </h3>
        <div className="p-6 bg-surface-base rounded-lg border border-border-default shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            metric={2}
            label="SLA Breaches This Week"
            trend={{ value: 1, direction: "down", label: "from last week" }}
          />
        </div>
      </section>

      {/* Case 4: Attempted Background Color Override */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          4. Anti-pattern Override Test (Card background stays bg-white)
        </h3>
        <p className="text-sm text-text-secondary mb-2">
          This test card has class <code>className="bg-primary-50 bg-neutral-100 hover:bg-neutral-200"</code> passed to it. The background must remain <code>bg-white</code>.
        </p>
        <div className="p-6 bg-surface-base rounded-lg border border-border-default shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            metric={14}
            label="Pending in Queue (bg Override)"
            trend={{ value: 3, direction: "up" }}
            className="bg-primary-50 bg-neutral-100 hover:bg-neutral-200"
          />
        </div>
      </section>
    </div>
  );
}
