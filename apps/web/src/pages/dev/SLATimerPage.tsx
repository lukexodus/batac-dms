import React from 'react';

import { SLATimer } from '@batac/ui';

export default function SLATimerPage() {
  const now = Date.now();

  // 1. On-Track Example (30% elapsed)
  // started 3 hours ago, expires in 7 hours (total 10 hours window)
  const onTrackStart = new Date(now - 3 * 60 * 60 * 1000);
  const onTrackDeadline = new Date(now + 7 * 60 * 60 * 1000);

  // 2. At-Risk Example (85% elapsed)
  // started 8.5 hours ago, expires in 1.5 hours (total 10 hours window)
  const atRiskStart = new Date(now - 8.5 * 60 * 60 * 1000);
  const atRiskDeadline = new Date(now + 1.5 * 60 * 60 * 1000);

  // 3. Breached / Past Deadline Example (150% elapsed)
  // started 15 hours ago, expired 5 hours ago (total 10 hours window)
  const breachedStart = new Date(now - 15 * 60 * 60 * 1000);
  const breachedDeadline = new Date(now - 5 * 60 * 60 * 1000);

  // 4. Static Example from Usage Guide (Mayor's 10-day review SLA)
  // started 2026-06-10T08:00:00+08:00, deadline 2026-06-20T08:00:00+08:00
  const staticStart = new Date('2026-06-10T08:00:00+08:00');
  const staticDeadline = new Date('2026-06-20T08:00:00+08:00');

  return (
    <div className="mx-auto max-w-4xl space-y-12 p-8">
      <div>
        <h1 className="text-text-primary mb-2 text-2xl font-bold">SLATimer Component Showcase</h1>
        <p className="text-text-secondary text-sm">
          Tier 3 domain display component for SLA tracking. Shows progress, remaining/overdue times,
          and urgency states.
        </p>
      </div>

      <div className="space-y-8">
        {/* Live dynamic cases */}
        <section className="space-y-6">
          <h2 className="border-border/50 border-b pb-2 text-lg font-semibold">
            Dynamic Live SLA Tiers
          </h2>
          <div className="grid gap-6">
            {/* On-Track */}
            <div className="border-border/30 space-y-4 rounded-lg border bg-neutral-50 p-6">
              <div className="text-text-muted flex items-center justify-between text-xs">
                <span>Tier: On-Track (&lt; 80% elapsed)</span>
                <span>Target: ~30% progress</span>
              </div>
              <SLATimer
                startedAt={onTrackStart}
                deadlineAt={onTrackDeadline}
                label="Mayor Review (On-Track SLA) — Ord 7SP-101"
              />
            </div>

            {/* At-Risk */}
            <div className="border-border/30 space-y-4 rounded-lg border bg-neutral-50 p-6">
              <div className="text-text-muted flex items-center justify-between text-xs">
                <span>Tier: At-Risk (&ge; 80% and &lt; 100% elapsed)</span>
                <span>Target: ~85% progress with pulsing warning indicator</span>
              </div>
              <SLATimer
                startedAt={atRiskStart}
                deadlineAt={atRiskDeadline}
                label="Panlalawigan Review (At-Risk SLA) — Res 7SP-402"
              />
            </div>

            {/* Breached */}
            <div className="border-border/30 space-y-4 rounded-lg border bg-neutral-50 p-6">
              <div className="text-text-muted flex items-center justify-between text-xs">
                <span>Tier: Breached (&ge; 100% elapsed)</span>
                <span>Target: 100% clamped bar width with pulsing animation</span>
              </div>
              <SLATimer
                startedAt={breachedStart}
                deadlineAt={breachedDeadline}
                label="Mayor Review (Breached SLA) — Ord 7SP-102"
              />
            </div>
          </div>
        </section>

        {/* Static Canonical Case */}
        <section className="space-y-6">
          <h2 className="border-border/50 border-b pb-2 text-lg font-semibold">
            Canonical Static SLA Example
          </h2>
          <div className="border-border/30 space-y-4 rounded-lg border bg-neutral-50 p-6">
            <div className="text-text-muted mb-2 flex flex-col gap-1 text-xs">
              <div className="flex justify-between">
                <span>Start: 2026-06-10 08:00 AM (PST)</span>
                <span>Deadline: 2026-06-20 08:00 AM (PST)</span>
              </div>
              <div>Current Reference: 2026-06-26 (Breached/Overdue)</div>
            </div>
            <SLATimer
              startedAt={staticStart}
              deadlineAt={staticDeadline}
              label="Mayor review (10-day) — 7SP 2026-001"
            />
          </div>
        </section>

        {/* Accessibility & Spec Verification Guide */}
        <section className="bg-info-50/50 border-info-200 space-y-4 rounded-lg border p-6">
          <h2 className="text-md text-info-900 font-semibold">
            Accessibility & Verification Checklist
          </h2>
          <ul className="text-info-800 list-inside list-disc space-y-2 text-sm">
            <li>
              <strong>ARIA roles:</strong> The outer container carries <code>role="timer"</code> and{' '}
              <code>aria-live="polite"</code>.
            </li>
            <li>
              <strong>Accessible Names:</strong> The outer container maps the <code>label</code>{' '}
              prop to <code>aria-label</code>.
            </li>
            <li>
              <strong>Progressbar:</strong> The inner indicator carries{' '}
              <code>role="progressbar"</code> and clamps <code>aria-valuenow</code> to exactly 100
              on breached/past-due examples.
            </li>
            <li>
              <strong>Focus Order:</strong> The component is purely informational and is excluded
              from the tab index hierarchy (no <code>tabindex</code> or interactive keyboard roles).
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
