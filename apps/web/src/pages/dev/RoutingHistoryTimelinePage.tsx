import React from 'react';
import { Navigate } from 'react-router-dom';

import { RoutingHistoryTimeline } from '@batac/ui';

import type { RoutingEntry } from '@batac/ui';

const MOCK_ENTRIES: RoutingEntry[] = [
  {
    id: 'rh-001',
    actorName: 'Gladys R. Lagura',
    actorOfficeName: 'SP Secretariat',
    action: 'Logged',
    timestamp: new Date('2026-06-12T10:30:00+08:00'),
    notes: 'Document logged and QR tracking number assigned',
  },
  {
    id: 'rh-002',
    actorName: 'Gladys R. Lagura',
    actorOfficeName: 'SP Secretariat',
    action: 'TransmittedToMayor',
    timestamp: new Date('2026-06-13T09:00:00+08:00'),
    notes: 'Transmittal Letter to Mayor — completed',
    fromOfficeName: 'SP Secretariat',
    toOfficeName: 'Office of the City Mayor',
  },
  {
    id: 'rh-003',
    actorName: 'Mark Christian R. Chua',
    actorOfficeName: 'Office of the City Mayor',
    action: 'Vetoed',
    timestamp: new Date('2026-06-16T11:00:00+08:00'),
    notes: 'Mayor Review — vetoed',
    toOfficeName: 'SP Secretariat',
  },
  {
    id: 'rh-004',
    actorName: 'Mark Christian R. Chua',
    actorOfficeName: 'Office of the City Mayor',
    action: 'SignedByMayor',
    timestamp: new Date('2026-06-17T14:15:00+08:00'),
    notes: 'Mayor Signature — signed',
    toOfficeName: 'SP Secretariat',
  },
];

export default function RoutingHistoryTimelinePage() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      <div>
        <h1 className="text-text mb-2 text-2xl font-bold">Routing History Timeline</h1>
        <p className="text-text-muted">
          Tier 3 domain component displaying document lifecycle events.
        </p>
      </div>

      <div className="bg-surface border-border rounded-xl border p-6 shadow-sm">
        <RoutingHistoryTimeline entries={MOCK_ENTRIES.slice().reverse()} />
      </div>
    </div>
  );
}
