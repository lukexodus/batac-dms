import * as React from "react";
import { format } from "date-fns";
import { cn } from "../../lib/utils";
import { phLocale, DATE_FORMATS } from "../../lib/date-locale";
import { AvatarName } from "../ui/avatar";
import type { RoutingEntry } from "../../types/domain";

export interface RoutingHistoryTimelineProps {
  entries: RoutingEntry[];
  className?: string;
}

function getDotColor(entry: RoutingEntry) {
  if (entry.action === "Transmitted" || entry.action === "TransmittedToMayor") {
    return "bg-info-500";
  }
  if (
    entry.action === "SignedByMayor" ||
    entry.action === "VPCertified" ||
    entry.action === "Released" ||
    entry.action === "Archived" ||
    entry.action === "DeemedApproved"
  ) {
    return "bg-success-500";
  }
  if (
    entry.action === "Vetoed" ||
    (entry.action as string) === "Returned" ||
    (entry.action === "PanlalawiganOutcomeRecorded" &&
      entry.notes?.toLowerCase().match(/(returned|vetoed)/))
  ) {
    return "bg-danger-500";
  }
  return "bg-neutral-400";
}

function formatActionLabel(action: string) {
  return action.replace(/([A-Z])/g, " $1").trim();
}

export function RoutingHistoryTimeline({
  entries,
  className,
}: RoutingHistoryTimelineProps) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {entries.map((entry, index) => {
        const isLast = index === entries.length - 1;
        return (
          <li key={entry.id} className="flex">
            {/* Left Column: Connector Line & Dot */}
            <div
              className={cn(
                "border-l-2 border-border-subtle ml-3",
                isLast && "border-transparent"
              )}
            >
              <div
                className={cn(
                  "h-3 w-3 rounded-full -ml-[7px] mt-[10px]",
                  getDotColor(entry)
                )}
              />
            </div>

            {/* Right Column: Content */}
            <div className={cn("flex-1 pl-4", isLast ? "pb-2" : "pb-6")}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AvatarName name={entry.actorName} size="sm" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text">
                      {formatActionLabel(entry.action)}
                    </span>
                    <span className="text-xs text-text-muted">
                      {entry.actorName} • {entry.actorOfficeName}
                    </span>
                  </div>
                </div>
                <div className="mt-1 text-right shrink-0">
                  <span className="font-mono text-xs text-text-muted whitespace-nowrap">
                    {format(entry.timestamp, DATE_FORMATS.displayWithTime, {
                      locale: phLocale,
                    })}
                  </span>
                </div>
              </div>

              {entry.notes && (
                <div className="text-xs text-text-muted mt-1 pl-11">
                  {entry.notes}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
