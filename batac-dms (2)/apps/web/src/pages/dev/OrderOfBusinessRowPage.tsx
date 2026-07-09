import React from 'react';

import { OrderOfBusinessRow } from '@batac/ui/components/domain/OrderOfBusinessRow';

import type { OrderOfBusinessItem } from '@batac/ui/types/domain';

const item: OrderOfBusinessItem = {
  agendaNumber: 1,
  documentNumber: '7SP 2026-001',
  numberVariant: 'final',
  title: 'An Ordinance Providing for the Comprehensive Solid Waste Management Program of the City of Batac',
  documentState: 'PANLALAWIGAN_REVIEW',
  committeeReferrals: [
    {
      id: 'cr-001',
      committeeName: 'Laws, Rules, Ethics & Privileges',
      status: 'SUBMITTED',
      submittedBy: 'Hon. Juan Paulo P. Flojo',
      submittedAt: new Date('2026-06-10T15:00:00+08:00'),
    },
    {
      id: 'cr-002',
      committeeName: 'Environment',
      status: 'ABSENT_NOT_HEARD',
    },
  ],
  isCertifiedUrgent: false,
  isMissingReport: true,
  scheduledReadingType: 'SECOND',
};

const urgentItem: OrderOfBusinessItem = {
  agendaNumber: 2,
  documentNumber: 'SPR 2026-038',
  numberVariant: 'final',
  title: 'A Resolution Directing the City Engineer to Submit Report on Road Conditions',
  documentState: 'FIRST_READING',
  committeeReferrals: [],
  isCertifiedUrgent: true,
  isMissingReport: false,
  scheduledReadingType: 'FIRST',
};

export function OrderOfBusinessRowPage() {
  const [clickedLog, setClickedLog] = React.useState<string[]>([]);

  const handleRowClick = (label: string) => {
    setClickedLog((prev) => [...prev, `Row clicked: ${label} at ${new Date().toLocaleTimeString()}`]);
  };

  return (
    <div className="p-8 space-y-12 max-w-5xl mx-auto">
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Standard Row (Missing Report, bg-danger-50)</h2>
        <p className="text-sm text-neutral-500">
          `isMissingReport` is true. `onClick` is provided (interactive).
        </p>
        <div className="border border-neutral-200 rounded-lg p-2 bg-neutral-50">
          <OrderOfBusinessRow 
            item={item} 
            onClick={() => handleRowClick('Item 1 (Standard)')}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Urgent Row (Certified Urgent, FIRST Reading)</h2>
        <p className="text-sm text-neutral-500">
          `isCertifiedUrgent` is true. `isMissingReport` is false (white bg). `onClick` is provided (interactive).
        </p>
        <div className="border border-neutral-200 rounded-lg p-2 bg-neutral-50">
          <OrderOfBusinessRow 
            item={urgentItem} 
            onClick={() => handleRowClick('Item 2 (Urgent)')}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Non-interactive Row</h2>
        <p className="text-sm text-neutral-500">
          `onClick` is omitted. Hover state should not trigger, and row should not be focusable.
        </p>
        <div className="border border-neutral-200 rounded-lg p-2 bg-neutral-50">
          <OrderOfBusinessRow 
            item={{
              ...item,
              agendaNumber: 3,
              isMissingReport: false,
            }} 
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Interaction Log</h2>
        <div className="p-4 bg-neutral-900 text-neutral-100 rounded-lg font-mono text-xs h-32 overflow-y-auto">
          {clickedLog.length === 0 ? (
            <span className="text-neutral-500">Click interactive rows to log events. Tooltip triggers should NOT fire these log entries.</span>
          ) : (
            clickedLog.map((log, idx) => <div key={idx}>{log}</div>)
          )}
        </div>
      </div>
    </div>
  );
}

export default OrderOfBusinessRowPage;
