import React from 'react';
import type { DocumentPreview } from '../../types/domain';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { DocumentNumberBadge } from './DocumentNumberBadge';
import { StatusBadge } from './StatusBadge';
import { SLATimer } from './SLATimer';
import { format } from 'date-fns';
import { phLocale, DATE_FORMATS } from '../../lib/date-locale';

interface DocumentPreviewCardProps {
  document: DocumentPreview;
  onClick?: () => void;
  /** When true, renders Skeleton placeholders instead of content */
  isLoading?: boolean;
  className?: string;
}

export function DocumentPreviewCard({
  document,
  onClick,
  isLoading,
  className,
}: DocumentPreviewCardProps) {
  if (isLoading) {
    return (
      <Card
        aria-busy="true"
        className={cn(
          "p-4 overflow-hidden",
          className
        )}
      >
        <Skeleton className="w-full aspect-[3/4] rounded mb-3" />
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <Skeleton className="w-20 h-5" />
          <Skeleton className="w-24 h-5" />
        </div>
        <div className="mt-1 space-y-1">
          <Skeleton className="w-full h-4" />
          <Skeleton className="w-3/4 h-4" />
        </div>
        <Skeleton className="w-28 h-3 mt-1" />
      </Card>
    );
  }

  const {
    documentNumber,
    numberVariant,
    title,
    documentState,
    lastActionAt,
    slaDeadlineAt,
    slaStartedAt,
    thumbnailUrl,
  } = document;

  const showSLA = Boolean(
    slaDeadlineAt &&
    slaStartedAt &&
    (documentState === 'PENDING_MAYOR' || documentState === 'PANLALAWIGAN_REVIEW')
  );

  const interactiveProps = onClick ? {
    role: "button",
    tabIndex: 0,
    onClick,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); // prevent scroll on space
        onClick();
      }
    }
  } : {};

  return (
    <Card
      {...interactiveProps}
      className={cn(
        "p-4 overflow-hidden",
        onClick && "cursor-pointer transition-shadow duration-300 hover:shadow-md",
        className
      )}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          className="w-full aspect-[3/4] bg-neutral-100 rounded object-cover mb-3"
        />
      ) : (
        <div className="w-full aspect-[3/4] bg-neutral-100 rounded mb-3 flex items-center justify-center text-neutral-400">
          <span className="text-xs">No Preview</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <DocumentNumberBadge number={documentNumber} variant={numberVariant} />
        <StatusBadge state={documentState} />
      </div>

      <h3 className="text-sm font-medium text-text-primary line-clamp-2 mt-1" title={title}>
        {title}
      </h3>

      <div className="text-xs text-text-muted mt-1">
        {format(lastActionAt, DATE_FORMATS.display, { locale: phLocale })}
      </div>

      {showSLA && (
        <div className="mt-3">
          <SLATimer
            startedAt={slaStartedAt!}
            deadlineAt={slaDeadlineAt!}
            label={documentState === 'PENDING_MAYOR' ? "Mayor's Review" : "Panlalawigan Review"}
          />
        </div>
      )}
    </Card>
  );
}
