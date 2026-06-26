import * as React from "react";
import { cn } from "../../lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

export interface ScanQualityIndicatorProps {
  /** 0–100. Component derives ScanQualityLevel internally. */
  score: number;
  /** When true, renders the level label text alongside the color indicator */
  showLabel?: boolean;
  className?: string;
}

export function ScanQualityIndicator({
  score,
  showLabel = false,
  className,
}: ScanQualityIndicatorProps) {
  let colorClass: string;
  let labelText: string;

  if (score >= 95) {
    colorClass = "text-success-500";
    labelText = "Excellent";
  } else if (score >= 80) {
    colorClass = "text-info-500";
    labelText = "Good";
  } else if (score >= 60) {
    colorClass = "text-warning-500";
    labelText = "Fair";
  } else {
    colorClass = "text-danger-500";
    labelText = "Poor";
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex items-center gap-1.5 touch-exempt",
            colorClass,
            className
          )}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="flex-shrink-0"
          >
            <circle cx="6" cy="6" r="4" fill="currentColor" />
          </svg>
          {showLabel && <span className="font-medium text-sm">{labelText}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{labelText} — {score} / 100</p>
      </TooltipContent>
    </Tooltip>
  );
}
