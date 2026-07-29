import type { LucideIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  icon: LucideIcon;
  /** Directive heading — state what is empty */
  heading: string;
  /** Directive body — state what action creates content */
  body: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({ icon: Icon, heading, body, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-4 text-center py-8 px-4', className)}>
      <Icon className="h-12 w-12 text-neutral-300" aria-hidden="true" />
      <div className="flex flex-col items-center gap-1">
        <h3 className="text-text-secondary text-lg font-semibold">{heading}</h3>
        <p className="text-text-muted text-sm">{body}</p>
      </div>
      {action && (
        <Button variant="default" className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
