import type { ReactNode } from 'react';
import { cn } from '@batac/ui/lib/utils';

export interface PageHeaderProps {
  /** Page title — renders as h1 with text-2xl font-bold text-text-primary */
  title: string;
  /** Optional subtitle — renders as text-sm text-text-secondary mt-1 */
  subtitle?: string;
  /** Right slot: pass fully constructed Button (T2) elements */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'border-border-default mb-6 flex items-start justify-between border-b pb-4',
        className,
      )}
    >
      <div className="flex flex-col">
        <h1 className="text-text-primary text-2xl font-bold">{title}</h1>
        {subtitle ? <p className="text-text-secondary mt-1 text-sm">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}
