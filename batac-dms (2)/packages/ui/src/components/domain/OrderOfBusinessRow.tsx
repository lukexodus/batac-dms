import React from 'react';
import type { OrderOfBusinessItem } from '../../types/domain';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/tooltip';
import { DocumentNumberBadge } from './DocumentNumberBadge';
import { StatusBadge } from './StatusBadge';
import { Flag } from 'lucide-react';

interface OrderOfBusinessRowProps {
  item: OrderOfBusinessItem;
  onClick?: () => void;
  className?: string;
}

const READING_LABELS = {
  FIRST: '1st Reading',
  SECOND: '2nd Reading',
  THIRD: '3rd Reading',
} as const;

const REFERRAL_STATUS_CLASSES = {
  SUBMITTED: 'bg-success-100 text-success-900 border-transparent',
  PENDING: 'bg-warning-100 text-warning-900 border-transparent',
  ABSENT_NOT_HEARD: 'bg-neutral-100 text-neutral-700 border-transparent',
} as const;

export function OrderOfBusinessRow({
  item,
  onClick,
  className,
}: OrderOfBusinessRowProps) {
  const {
    agendaNumber,
    documentNumber,
    numberVariant,
    title,
    documentState,
    committeeReferrals,
    isCertifiedUrgent,
    isMissingReport,
    scheduledReadingType,
  } = item;

  const interactiveProps = onClick ? {
    role: "button",
    tabIndex: 0,
    onClick,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); // prevent scroll
        onClick();
      }
    }
  } : {};

  return (
    <TooltipProvider>
      <div
        {...interactiveProps}
        className={cn(
          "flex items-center gap-3 p-3 rounded-md transition-colors duration-200",
          isMissingReport ? "bg-danger-50" : "bg-white",
          onClick && "cursor-pointer hover:bg-neutral-50",
          className
        )}
      >
        {/* 1. Agenda number */}
        <div className="font-mono text-sm text-text-muted w-8 shrink-0">
          {agendaNumber}.
        </div>

        {/* 2. Certified urgent chip */}
        {isCertifiedUrgent && (
          <span 
            className="bg-warning-100 text-warning-900 text-xs font-semibold px-2 py-0.5 rounded-sm touch-exempt shrink-0"
            aria-label="Certified Urgent"
          >
            Urgent
          </span>
        )}

        {/* 3. Document Number Badge */}
        <div className="shrink-0">
          <DocumentNumberBadge number={documentNumber} variant={numberVariant} />
        </div>

        {/* 4. Title */}
        <div 
          className="text-sm text-text-primary flex-1 truncate" 
          title={title}
        >
          {title}
        </div>

        {/* 5. Committee referral chips */}
        {committeeReferrals.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            {committeeReferrals.map((ref) => (
              <Badge
                key={ref.id}
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium border",
                  REFERRAL_STATUS_CLASSES[ref.status]
                )}
                title={`${ref.committeeName} (${ref.status})`}
              >
                {ref.committeeName}
              </Badge>
            ))}
          </div>
        )}

        {/* 6. Status Badge */}
        <div className="shrink-0">
          <StatusBadge state={documentState} />
        </div>

        {/* 7. Reading type chip */}
        <div className="shrink-0">
          <Badge variant="secondary" className="text-xs font-medium">
            {READING_LABELS[scheduledReadingType]}
          </Badge>
        </div>

        {/* 8. Flag icon */}
        {isMissingReport && (
          <div className="shrink-0 flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  tabIndex={0}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500 focus-visible:ring-offset-2 rounded-sm p-0.5"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <Flag
                    className="h-4 w-4 text-danger-500"
                    role="img"
                    aria-label="Missing committee report"
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Missing committee report
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
