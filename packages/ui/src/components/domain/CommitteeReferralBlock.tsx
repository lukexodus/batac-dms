import * as React from 'react';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import { AvatarName } from '../ui/avatar';
import { phLocale, DATE_FORMATS } from '../../lib/date-locale';
import type { CommitteeReferral } from '../../types/domain';

export interface CommitteeReferralBlockProps {
  referrals: CommitteeReferral[];
  className?: string;
}

const statusBadgeClasses = {
  SUBMITTED: 'bg-success-100 text-success-900 border-transparent',
  PENDING: 'bg-warning-100 text-warning-900 border-transparent',
  ABSENT_NOT_HEARD: 'bg-neutral-100 text-neutral-700 border-transparent',
};

export function CommitteeReferralBlock({ referrals, className = '' }: CommitteeReferralBlockProps) {
  return (
    <ul className={`divide-border-subtle divide-y ${className}`}>
      {referrals.map((referral) => {
        return (
          <li
            key={referral.id}
            className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"
          >
            {/* Left Column: Committee Name */}
            <span className="text-text-primary flex-1 text-sm font-medium">
              {referral.committeeName}
            </span>

            {/* Right Column: Status Badge + Optional User info & Timestamp */}
            <div className="flex shrink-0 items-center gap-3">
              <Badge variant="outline" className={statusBadgeClasses[referral.status]}>
                {referral.status === 'ABSENT_NOT_HEARD' ? 'ABSENT / NOT HEARD' : referral.status}
              </Badge>

              {referral.submittedBy && (
                <div className="flex items-center gap-2">
                  <AvatarName name={referral.submittedBy} size="sm" />
                  {referral.submittedAt && (
                    <span className="text-text-muted font-mono text-xs">
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
