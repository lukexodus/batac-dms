import React from 'react';
import { Navigate } from 'react-router-dom';

import { StatusBadge } from '@batac/ui';

import type { DocumentState } from '@batac/ui';

const STATES: DocumentState[] = [
  'DRAFT',
  'SUBMITTED',
  'IN_WORKFLOW',
  'PENDING_APPROVAL',
  'COMPLETED',
  'RELEASED',
  'ARCHIVED',
  'DISPOSED',
  'CANCELLED',
  'FIRST_READING',
  'SECOND_READING',
  'THIRD_READING',
  'IN_COMMITTEE',
  'PENDING_MAYOR',
  'VETOED',
  'OVERRIDE_PENDING',
  'LAPSED',
  'PANLALAWIGAN_REVIEW',
  'VALID',
  'VALID_IN_PART',
  'RETURNED',
  'DEEMED_APPROVED',
  'PENDING_HEARING',
  'RECEIVED_SEEN',
  'DISMISSED',
  'RESOLVED',
];

export default function StatusBadgePage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-7xl space-y-12 p-8">
      <div>
        <h2 className="text-text-muted mb-6 text-sm font-semibold tracking-wider uppercase">
          Dev Component Preview &gt; StatusBadge
        </h2>
        <h1 className="text-text-primary mb-2 text-3xl font-bold">StatusBadge</h1>
        <p className="text-text-secondary max-w-2xl">
          Visual indicator chips for document lifecycle states. Configured dynamically from the
          canonical 26-state metadata map.
        </p>
      </div>

      {/* Spot Checked States */}
      <section className="space-y-4">
        <h3 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
          1. Spot-Checked States (Visual Differences Check)
        </h3>
        <div className="bg-surface-base border-border-default flex flex-wrap gap-4 rounded-lg border p-6 shadow-sm">
          <div className="flex flex-col items-start gap-1">
            <span className="text-text-muted mb-1 text-xs">PANLALAWIGAN_REVIEW</span>
            <StatusBadge state="PANLALAWIGAN_REVIEW" />
          </div>
          <div className="flex flex-col items-start gap-1">
            <span className="text-text-muted mb-1 text-xs">DEEMED_APPROVED</span>
            <StatusBadge state="DEEMED_APPROVED" />
          </div>
          <div className="flex flex-col items-start gap-1">
            <span className="text-text-muted mb-1 text-xs">LAPSED</span>
            <StatusBadge state="LAPSED" />
          </div>
          <div className="flex flex-col items-start gap-1">
            <span className="text-text-muted mb-1 text-xs">CANCELLED</span>
            <StatusBadge state="CANCELLED" />
          </div>
        </div>
      </section>

      {/* All 26 States Grid */}
      <section className="space-y-4">
        <h3 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
          2. All 26 DocumentState Values
        </h3>
        <div className="bg-surface-base border-border-default rounded-lg border p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {STATES.map((state) => (
              <div
                key={state}
                className="border-border-subtle bg-surface-base flex items-center justify-between rounded-md border p-3"
              >
                <span className="text-text-secondary font-mono text-xs font-medium">{state}</span>
                <StatusBadge state={state} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
