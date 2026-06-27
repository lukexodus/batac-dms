import React from "react";
import { Navigate } from "react-router-dom";
import { CommitteeReferralBlock } from "@batac/ui";
import type { CommitteeReferral } from "@batac/ui";

const MOCK_REFERRALS: CommitteeReferral[] = [
  {
    id: "cr-001",
    committeeName: "Committee on Laws, Rules, Ethics & Privileges",
    status: "SUBMITTED",
    submittedBy: "Hon. Juan Paulo P. Flojo",
    submittedAt: new Date("2026-06-10T15:00:00+08:00"),
  },
  {
    id: "cr-002",
    committeeName: "Committee on Environment",
    status: "PENDING",
  },
  {
    id: "cr-003",
    committeeName: "Committee on Appropriations",
    status: "ABSENT_NOT_HEARD",
  },
];

export default function CommitteeReferralBlockPage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  return (
    <div className="p-8 space-y-12 max-w-7xl mx-auto">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-6">
          Dev Component Preview &gt; CommitteeReferralBlock
        </h2>
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          CommitteeReferralBlock
        </h1>
        <p className="text-text-secondary max-w-2xl">
          Displays the committee referral status list for a document, showing submission status chips and optional avatar + timestamp for submitted committee reports.
        </p>
      </div>

      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Committee Referrals List
        </h3>
        <div className="p-6 bg-surface-base rounded-lg border border-border-default shadow-sm max-w-4xl">
          <CommitteeReferralBlock referrals={MOCK_REFERRALS} />
        </div>
      </section>
    </div>
  );
}
