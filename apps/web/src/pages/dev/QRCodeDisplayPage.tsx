import React from "react";
import { Navigate } from "react-router-dom";
import { QRCodeDisplay } from "@batac/ui";

export default function QRCodeDisplayPage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  return (
    <div className="p-8 space-y-12 max-w-7xl mx-auto">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-6">
          Dev Component Preview &gt; QRCodeDisplay
        </h2>
        <h1 className="text-3xl font-bold text-text-primary mb-2">QRCodeDisplay</h1>
        <p className="text-text-secondary max-w-2xl">
          Renders the document tracking QR code containing the UUID payload,
          accompanied by centered document metadata. Designed with strict DOM accessibility rules.
        </p>
      </div>

      {/* Case 1: Screen Variant (Standard Card with Shadow) */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          1. Screen Variant (Standard Card with Shadow, Long Title wrapping test)
        </h3>
        <p className="text-sm text-text-secondary mb-2">
          Wraps in a styled container. Long title is clamped to a maximum of 2 lines.
        </p>
        <div className="p-6 bg-surface-base rounded-lg border border-border-default shadow-sm flex flex-col md:flex-row gap-6 items-start">
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
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          2. Print Variant (No Shadow, Min 200x200px, High Contrast)
        </h3>
        <p className="text-sm text-text-secondary mb-2">
          Removes shadow and rounded corners, increases contrast of border to ensure maximum scan legibility on physical paper.
        </p>
        <div className="p-6 bg-surface-base rounded-lg border border-border-default shadow-sm flex flex-col md:flex-row gap-6 items-start">
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
