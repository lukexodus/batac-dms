import * as React from "react";
import { formatDistance } from "date-fns";
import { phLocale } from "../../lib/date-locale";
import { cn } from "../../lib/utils";

export interface SLATimerProps {
  /** When the SLA window expires */
  deadlineAt: Date;
  /** When the SLA clock started (document entered a time-constrained state) */
  startedAt: Date;
  /** Human-readable label becomes aria-label on the role="timer" container */
  label: string;
  className?: string;
}

export function SLATimer({
  deadlineAt,
  startedAt,
  label,
  className,
}: SLATimerProps) {
  const now = new Date();

  const totalWindow = deadlineAt.getTime() - startedAt.getTime();
  const elapsed = totalWindow > 0 ? (now.getTime() - startedAt.getTime()) / totalWindow : 1;

  // SLAStatus derivation
  let status: "on-track" | "at-risk" | "breached";
  if (elapsed < 0.8) {
    status = "on-track";
  } else if (elapsed < 1.0) {
    status = "at-risk";
  } else {
    status = "breached";
  }

  // Styles map based on SLAStatus
  let fillColorClass = "bg-success-500";
  let trackColorClass = "bg-success-100";
  let textColorClass = "text-success-500";

  if (status === "at-risk") {
    fillColorClass = "bg-warning-500";
    trackColorClass = "bg-warning-100";
    textColorClass = "text-warning-500";
  } else if (status === "breached") {
    fillColorClass = "bg-danger-500";
    trackColorClass = "bg-danger-100";
    textColorClass = "text-danger-500";
  }

  const progressPercent = Math.max(0, Math.min(elapsed * 100, 100));

  // Distance string using formatDistance
  const distanceStr = formatDistance(deadlineAt, now, { locale: phLocale });
  const timeText = now >= deadlineAt ? `${distanceStr} overdue` : `${distanceStr} remaining`;

  return (
    <div
      role="timer"
      aria-label={label}
      aria-live="polite"
      className={cn("space-y-2", className)}
    >
      <div className="flex items-center justify-between text-sm font-medium">
        <div className="flex items-center gap-2">
          {status === "at-risk" && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          )}
          <span className="text-text-primary">{label}</span>
        </div>
        <span className={textColorClass}>{timeText}</span>
      </div>

      <div
        className={cn(
          "h-2 w-full rounded-full overflow-hidden",
          trackColorClass,
          status === "breached" && "animate-pulse"
        )}
      >
        <div
          role="progressbar"
          aria-valuenow={Math.round(progressPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          className={cn("h-full rounded-full transition-all duration-300", fillColorClass)}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
