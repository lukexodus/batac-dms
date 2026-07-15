import React from 'react';
import { Navigate } from 'react-router-dom';

import { QRCodeDisplay } from '@batac/ui';

export default function QRCodeDisplayPage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-7xl space-y-12 p-8">
      <div>
        <h2 className="text-text-muted mb-6 text-sm font-semibold tracking-wider uppercase">
          Dev Component Preview &gt; QRCodeDisplay
        </h2>
        <h1 className="text-text-primary mb-2 text-3xl font-bold">QRCodeDisplay</h1>
        <p className="text-text-secondary max-w-2xl">
          Renders the document tracking QR code containing the UUID payload, accompanied by centered
          document metadata. Designed with strict DOM accessibility rules.
        </p>
      </div>

      {/* Case 1: Screen Variant (Standard Card with Shadow) */}
      <section className="space-y-4">
        <h3 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
          1. Screen Variant (Standard Card with Shadow, Long Title wrapping test)
        </h3>
        <p className="text-text-secondary mb-2 text-sm">
          Wraps in a styled container. Long title is clamped to a maximum of 2 lines.
        </p>
        <div className="bg-surface-base border-border-default flex flex-col items-start gap-6 rounded-lg border p-6 shadow-sm md:flex-row">
          <QRCodeDisplay
            trackingId="dts-2026-00147"
            documentNumber="7SP 2026-001"
            title="An Ordinance Providing for the Comprehensive Solid Waste Management Program of the City of Batac"
            variant="screen"
            className="w-[240px]"
          />
        </div>
      </section>

      {/* Case 2: Print Variant (No Shadow, Minimum Dimensions) */}
      <section className="space-y-4">
        <h3 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
          2. Print Variant (No Shadow, Min 200x200px, High Contrast)
        </h3>
        <p className="text-text-secondary mb-2 text-sm">
          Removes shadow and rounded corners, increases contrast of border to ensure maximum scan
          legibility on physical paper.
        </p>
        <div className="bg-surface-base border-border-default flex flex-col items-start gap-6 rounded-lg border p-6 shadow-sm md:flex-row">
          <QRCodeDisplay
            trackingId="dts-2026-00147"
            documentNumber="7SP 2026-001"
            title="Solid Waste Management Ordinance"
            variant="print"
          />
        </div>
      </section>
    </div>
  );
}
