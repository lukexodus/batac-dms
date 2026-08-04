import * as React from 'react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { phLocale, DATE_FORMATS } from '../../lib/date-locale';
import { AvatarName } from '../ui/avatar';
import type { RoutingEntry } from '../../types/domain';

export interface RoutingHistoryTimelineProps {
  entries: RoutingEntry[];
  className?: string;
}

function getDotColor(entry: RoutingEntry) {
  if (entry.action === 'Transmitted' || entry.action === 'TransmittedToMayor') {
    return 'bg-info-500';
  }
  if (
    entry.action === 'SignedByMayor' ||
    entry.action === 'VPCertified' ||
    entry.action === 'Released' ||
    entry.action === 'Archived' ||
    entry.action === 'DeemedApproved'
  ) {
    return 'bg-success-500';
  }
  if (
    entry.action === 'Vetoed' ||
    (entry.action as string) === 'Returned' ||
    (entry.action === 'PanlalawiganOutcomeRecorded' &&
      entry.notes?.toLowerCase().match(/(returned|vetoed)/))
  ) {
    return 'bg-danger-500';
  }
  return 'bg-neutral-400';
}

function formatActionLabel(action: string) {
  return action.replace(/([A-Z])/g, ' $1').trim();
}

export function RoutingHistoryTimeline({ entries, className }: RoutingHistoryTimelineProps) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {entries.map((entry, index) => {
        const isLast = index === entries.length - 1;
        return (
          <li key={entry.id} className="flex">
            {/* Left Column: Connector Line & Dot */}
            <div
              className={cn('border-border-subtle ml-3 border-l-2', isLast && 'border-transparent')}
            >
              <div className={cn('mt-[10px] -ml-[7px] h-3 w-3 rounded-full', getDotColor(entry))} />
            </div>

            {/* Right Column: Content */}
            <div className={cn('flex-1 pl-4', isLast ? 'pb-2' : 'pb-6')}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AvatarName name={entry.actorName} size="sm" />
                  <div className="flex flex-col">
                    <span className="text-text text-sm font-medium">
                      {entry.notes || formatActionLabel(entry.action)}
                    </span>
                    <span className="text-text-muted text-xs">
                      {entry.actorName} • {entry.actorOfficeName}
                    </span>
                  </div>
                </div>
                <div className="mt-1 shrink-0 text-right">
                  <span className="text-text-muted font-mono text-xs whitespace-nowrap">
                    {format(entry.timestamp, DATE_FORMATS.displayWithTime, {
                      locale: phLocale,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
