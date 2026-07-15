import React from 'react';
import { Navigate } from 'react-router-dom';

import { DocumentNumberBadge } from '@batac/ui';

export default function DocumentNumberBadgePage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-7xl space-y-12 p-8">
      <div>
        <h2 className="text-text-muted mb-6 text-sm font-semibold tracking-wider uppercase">
          Dev Component Preview &gt; DocumentNumberBadge
        </h2>
        <h1 className="text-text-primary mb-2 text-3xl font-bold">DocumentNumberBadge</h1>
        <p className="text-text-secondary max-w-2xl">
          The signature component of the design system. Renders document numbers in monospace font
          with distinct styling for final and preliminary states.
        </p>
      </div>

      {/* Case 1: Final Variant (Ordinance) */}
      <section className="space-y-4">
        <h3 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
          1. Final Variant (Ordinance)
        </h3>
        <div className="bg-surface-base border-border-default flex items-center gap-4 rounded-lg border p-6 shadow-sm">
          <DocumentNumberBadge number="7SP 2026-001" variant="final" />
        </div>
      </section>

      {/* Case 2: Preliminary Variant (Draft Ordinance) */}
      <section className="space-y-4">
        <h3 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
          2. Preliminary Variant (Draft Ordinance)
        </h3>
        <div className="bg-surface-base border-border-default flex items-center gap-4 rounded-lg border p-6 shadow-sm">
          <DocumentNumberBadge number="Draft 7SP 2026-02" variant="preliminary" />
        </div>
      </section>

      {/* Case 3: Final Variant (Resolution) */}
      <section className="space-y-4">
        <h3 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
          3. Final Variant (Resolution)
        </h3>
        <div className="bg-surface-base border-border-default flex items-center gap-4 rounded-lg border p-6 shadow-sm">
          <DocumentNumberBadge number="SPR 2026-038" variant="final" />
        </div>
      </section>

      {/* Case 4: Long Number in Narrow Container (Wrapping Test) */}
      <section className="space-y-4">
        <h3 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
          4. Narrow Container wrapping test (120px Container)
        </h3>
        <p className="text-text-secondary mb-2 text-sm">
          Demonstrates that a long document number badge wraps the parent container rather than
          truncating its own text.
        </p>
        <div className="bg-surface-base border-border-default rounded-lg border p-6 shadow-sm">
          <div className="flex w-[120px] flex-col gap-2 rounded border border-neutral-300 bg-neutral-100 p-2">
            <span className="text-text-muted text-[10px] font-semibold uppercase">
              Container (120px)
            </span>
            <div className="flex flex-wrap gap-1">
              <DocumentNumberBadge number="Draft 7SP 2026-002-EXTENDED-NUM" variant="preliminary" />
            </div>
          </div>
        </div>
      </section>

      {/* Case 5: Side-by-Side Comparison (Dimensions Check) */}
      <section className="space-y-4">
        <h3 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
          5. Dimensions Comparison (Structural Stability Check)
        </h3>
        <p className="text-text-secondary mb-2 text-sm">
          Both variants must have identical height, padding, and font-size.
        </p>
        <div className="bg-surface-base border-border-default flex items-center gap-4 rounded-lg border p-6 shadow-sm">
          <DocumentNumberBadge number="7SP 2026-001" variant="final" />
          <DocumentNumberBadge number="7SP 2026-001" variant="preliminary" />
        </div>
      </section>
    </div>
  );
}
