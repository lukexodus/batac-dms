import * as React from 'react';
import { cn } from '../../lib/utils';
import type { DocumentState } from '../../types/domain';
import { STATUS_META } from '../../lib/status-meta';

export interface StatusBadgeProps {
  state: DocumentState;
  className?: string;
}

export function StatusBadge({ state, className }: StatusBadgeProps) {
  const meta = STATUS_META[state];
  if (!meta) return null;

  return (
    <span
      aria-label={meta.label}
      className={cn(
        'touch-exempt inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium',
        meta.bg,
        meta.text,
        meta.borderLeft,
        meta.borderStyle === 'dashed' && 'border-dashed',
        meta.textStyle === 'italic' && 'italic',
        meta.textStyle === 'line-through' && 'line-through',
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
