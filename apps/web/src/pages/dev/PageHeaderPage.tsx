import React from "react";
import { Navigate } from "react-router-dom";
import { PageHeader, Button } from "@batac/ui";

export default function PageHeaderPage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  return (
    <div className="p-8 space-y-12 max-w-7xl mx-auto">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-6">
          Dev Component Preview &gt; PageHeader
        </h2>
      </div>

      {/* Case 1: Title Only */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          1. Title Only
        </h3>
        <div className="p-6 bg-surface-base rounded-lg border border-border-default shadow-sm">
          <PageHeader title="Order of Business" />
        </div>
      </section>

      {/* Case 2: Title + Subtitle */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          2. Title + Subtitle
        </h3>
        <div className="p-6 bg-surface-base rounded-lg border border-border-default shadow-sm">
          <PageHeader
            title="Order of Business"
            subtitle="Regular Session · Tuesday, 17 June 2026"
          />
        </div>
      </section>

      {/* Case 3: Title + Actions (One Button) */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          3. Title + Actions (One Button)
        </h3>
        <div className="p-6 bg-surface-base rounded-lg border border-border-default shadow-sm">
          <PageHeader
            title="Order of Business"
            actions={
              <Button variant="default" onClick={() => alert("Action triggered")}>
                Generate PDF
              </Button>
            }
          />
        </div>
      </section>

      {/* Case 4: Title + Subtitle + Actions (Two Buttons) */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          4. Title + Subtitle + Actions (Two Buttons)
        </h3>
        <div className="p-6 bg-surface-base rounded-lg border border-border-default shadow-sm">
          <PageHeader
            title="Order of Business"
            subtitle="Regular Session · Tuesday, 17 June 2026"
            actions={
              <>
                <Button variant="outline" onClick={() => alert("Secondary triggered")}>
                  Cancel
                </Button>
                <Button variant="default" onClick={() => alert("Primary triggered")}>
                  Generate Order of Business
                </Button>
              </>
            }
          />
        </div>
      </section>
    </div>
  );
}
