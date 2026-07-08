import React from "react";
import { Navigate } from "react-router-dom";

import { RoutingHistoryTimeline } from "@batac/ui";

import type { RoutingEntry } from "@batac/ui";

const MOCK_ENTRIES: RoutingEntry[] = [
  {
    id: "rh-001",
    actorName: "Gladys R. Lagura",
    actorOfficeName: "SP Secretariat",
    action: "FinalNumberAssigned",
    timestamp: new Date("2026-06-12T10:30:00+08:00"),
    notes: "Final number 7SP 2026-001 assigned; Draft prefix removed.",
  },
  {
    id: "rh-002",
    actorName: "Gladys R. Lagura",
    actorOfficeName: "SP Secretariat",
    action: "TransmittedToMayor",
    timestamp: new Date("2026-06-13T09:00:00+08:00"),
    notes:
      "Transmittal letter SPS 2026-038 dispatched. Mayor review 10-day clock started.",
    fromOfficeName: "SP Secretariat",
    toOfficeName: "Office of the Mayor",
  },
  {
    id: "rh-003",
    actorName: "Mark Christian R. Chua",
    actorOfficeName: "Office of the City Mayor",
    action: "Vetoed",
    timestamp: new Date("2026-06-16T11:00:00+08:00"),
    notes: "Vetoed due to budgetary constraints.",
    toOfficeName: "SP Secretariat",
  },
  {
    id: "rh-004",
    actorName: "Mark Christian R. Chua",
    actorOfficeName: "Office of the City Mayor",
    action: "SignedByMayor",
    timestamp: new Date("2026-06-17T14:15:00+08:00"),
    toOfficeName: "SP Secretariat",
    // No notes to demonstrate conditional rendering
  },
];

export default function RoutingHistoryTimelinePage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text mb-2">
          Routing History Timeline
        </h1>
        <p className="text-text-muted">
          Tier 3 domain component displaying document lifecycle events.
        </p>
      </div>

      <div className="bg-surface rounded-xl border border-border shadow-sm p-6">
        <RoutingHistoryTimeline entries={MOCK_ENTRIES.slice().reverse()} />
      </div>
    </div>
  );
}
