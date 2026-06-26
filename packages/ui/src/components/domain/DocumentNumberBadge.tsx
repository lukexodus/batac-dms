import * as React from "react";
import { cn } from "@batac/ui/lib/utils";
import type { NumberVariant } from "@batac/ui/types/domain";

export interface DocumentNumberBadgeProps {
  /** Formatted document number string, e.g. "7SP 2026-001" or "Draft 7SP 2026-02" */
  number: string;
  /** Controls visual variant per DESIGN.md §6.3 Document Number Badge */
  variant: NumberVariant;
  className?: string;
}

export function DocumentNumberBadge({
  number,
  variant,
  className,
}: DocumentNumberBadgeProps) {
  const isFinal = variant === "final";

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 font-mono text-xs font-medium touch-exempt",
        isFinal
          ? "bg-primary-50 text-primary-800 border border-primary-300 border-l-2 border-l-primary-800 rounded-sm"
          : "bg-neutral-50 text-text-secondary border border-dashed border-neutral-400 rounded-sm italic",
        className
      )}
    >
      {number}
    </span>
  );
}
