import * as React from "react";
import { format } from "date-fns";
import { Badge } from "../ui/badge";
import { AvatarName } from "../ui/avatar";
import { phLocale, DATE_FORMATS } from "../../lib/date-locale";
import type { CommitteeReferral } from "../../types/domain";

export interface CommitteeReferralBlockProps {
  referrals: CommitteeReferral[];
  className?: string;
}

const statusBadgeClasses = {
  SUBMITTED: "bg-success-100 text-success-900 border-transparent",
  PENDING: "bg-warning-100 text-warning-900 border-transparent",
  ABSENT_NOT_HEARD: "bg-neutral-100 text-neutral-700 border-transparent",
};

export function CommitteeReferralBlock({
  referrals,
  className = "",
}: CommitteeReferralBlockProps) {
  return (
    <ul className={`divide-y divide-border-subtle ${className}`}>
      {referrals.map((referral) => {
        return (
          <li
            key={referral.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-3"
          >
            {/* Left Column: Committee Name */}
            <span className="text-sm font-medium text-text-primary flex-1">
              {referral.committeeName}
            </span>

            {/* Right Column: Status Badge + Optional User info & Timestamp */}
            <div className="flex items-center gap-3 shrink-0">
              <Badge
                variant="outline"
                className={statusBadgeClasses[referral.status]}
              >
                {referral.status === "ABSENT_NOT_HEARD"
                  ? "ABSENT / NOT HEARD"
                  : referral.status}
              </Badge>

              {referral.submittedBy && (
                <div className="flex items-center gap-2">
                  <AvatarName name={referral.submittedBy} size="sm" />
                  {referral.submittedAt && (
                    <span className="font-mono text-xs text-text-muted">
                      {format(referral.submittedAt, DATE_FORMATS.displayWithTime, {
                        locale: phLocale,
                      })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
