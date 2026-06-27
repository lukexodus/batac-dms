import React from "react";
import { Navigate } from "react-router-dom";
import { StatusBadge } from "@batac/ui";
import type { DocumentState } from "@batac/ui";

const STATES: DocumentState[] = [
  "DRAFT",
  "SUBMITTED",
  "IN_WORKFLOW",
  "PENDING_APPROVAL",
  "COMPLETED",
  "RELEASED",
  "ARCHIVED",
  "DISPOSED",
  "CANCELLED",
  "FIRST_READING",
  "SECOND_READING",
  "THIRD_READING",
  "IN_COMMITTEE",
  "PENDING_MAYOR",
  "VETOED",
  "OVERRIDE_PENDING",
  "LAPSED",
  "PANLALAWIGAN_REVIEW",
  "VALID",
  "VALID_IN_PART",
  "RETURNED",
  "DEEMED_APPROVED",
  "PENDING_HEARING",
  "RECEIVED_SEEN",
  "DISMISSED",
  "RESOLVED",
];

export default function StatusBadgePage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  return (
    <div className="p-8 space-y-12 max-w-7xl mx-auto">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-6">
          Dev Component Preview &gt; StatusBadge
        </h2>
        <h1 className="text-3xl font-bold text-text-primary mb-2">StatusBadge</h1>
        <p className="text-text-secondary max-w-2xl">
          Visual indicator chips for document lifecycle states. Configured
          dynamically from the canonical 26-state metadata map.
        </p>
      </div>

      {/* Spot Checked States */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          1. Spot-Checked States (Visual Differences Check)
        </h3>
        <div className="p-6 bg-surface-base rounded-lg border border-border-default shadow-sm flex flex-wrap gap-4">
          <div className="flex flex-col gap-1 items-start">
            <span className="text-xs text-text-muted mb-1">PANLALAWIGAN_REVIEW</span>
            <StatusBadge state="PANLALAWIGAN_REVIEW" />
          </div>
          <div className="flex flex-col gap-1 items-start">
            <span className="text-xs text-text-muted mb-1">DEEMED_APPROVED</span>
            <StatusBadge state="DEEMED_APPROVED" />
          </div>
          <div className="flex flex-col gap-1 items-start">
            <span className="text-xs text-text-muted mb-1">LAPSED</span>
            <StatusBadge state="LAPSED" />
          </div>
          <div className="flex flex-col gap-1 items-start">
            <span className="text-xs text-text-muted mb-1">CANCELLED</span>
            <StatusBadge state="CANCELLED" />
          </div>
        </div>
      </section>

      {/* All 26 States Grid */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          2. All 26 DocumentState Values
        </h3>
        <div className="p-6 bg-surface-base rounded-lg border border-border-default shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {STATES.map((state) => (
              <div
                key={state}
                className="flex items-center justify-between p-3 border border-border-subtle rounded-md bg-surface-base"
              >
                <span className="font-mono text-xs font-medium text-text-secondary">
                  {state}
                </span>
                <StatusBadge state={state} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
