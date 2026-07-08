import React from "react";
import { Navigate } from "react-router-dom";

import { DocumentNumberBadge } from "@batac/ui";

export default function DocumentNumberBadgePage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  return (
    <div className="p-8 space-y-12 max-w-7xl mx-auto">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-6">
          Dev Component Preview &gt; DocumentNumberBadge
        </h2>
        <h1 className="text-3xl font-bold text-text-primary mb-2">DocumentNumberBadge</h1>
        <p className="text-text-secondary max-w-2xl">
          The signature component of the design system. Renders document numbers in monospace font with distinct styling for final and preliminary states.
        </p>
      </div>

      {/* Case 1: Final Variant (Ordinance) */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          1. Final Variant (Ordinance)
        </h3>
        <div className="p-6 bg-surface-base rounded-lg border border-border-default shadow-sm flex items-center gap-4">
          <DocumentNumberBadge number="7SP 2026-001" variant="final" />
        </div>
      </section>

      {/* Case 2: Preliminary Variant (Draft Ordinance) */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          2. Preliminary Variant (Draft Ordinance)
        </h3>
        <div className="p-6 bg-surface-base rounded-lg border border-border-default shadow-sm flex items-center gap-4">
          <DocumentNumberBadge number="Draft 7SP 2026-02" variant="preliminary" />
        </div>
      </section>

      {/* Case 3: Final Variant (Resolution) */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          3. Final Variant (Resolution)
        </h3>
        <div className="p-6 bg-surface-base rounded-lg border border-border-default shadow-sm flex items-center gap-4">
          <DocumentNumberBadge number="SPR 2026-038" variant="final" />
        </div>
      </section>

      {/* Case 4: Long Number in Narrow Container (Wrapping Test) */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          4. Narrow Container wrapping test (120px Container)
        </h3>
        <p className="text-sm text-text-secondary mb-2">
          Demonstrates that a long document number badge wraps the parent container rather than truncating its own text.
        </p>
        <div className="p-6 bg-surface-base rounded-lg border border-border-default shadow-sm">
          <div className="w-[120px] p-2 bg-neutral-100 rounded border border-neutral-300 flex flex-col gap-2">
            <span className="text-[10px] font-semibold text-text-muted uppercase">Container (120px)</span>
            <div className="flex flex-wrap gap-1">
              <DocumentNumberBadge number="Draft 7SP 2026-002-EXTENDED-NUM" variant="preliminary" />
            </div>
          </div>
        </div>
      </section>

      {/* Case 5: Side-by-Side Comparison (Dimensions Check) */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          5. Dimensions Comparison (Structural Stability Check)
        </h3>
        <p className="text-sm text-text-secondary mb-2">
          Both variants must have identical height, padding, and font-size.
        </p>
        <div className="p-6 bg-surface-base rounded-lg border border-border-default shadow-sm flex items-center gap-4">
          <DocumentNumberBadge number="7SP 2026-001" variant="final" />
          <DocumentNumberBadge number="7SP 2026-001" variant="preliminary" />
        </div>
      </section>
    </div>
  );
}
