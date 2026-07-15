import * as React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '../ui/card';
import { cn } from '@batac/ui/lib/utils';

export interface StatCardTrend {
  value: number;
  direction: 'up' | 'down';
  label?: string; // e.g. "from last week"
}

export interface StatCardProps {
  metric: string | number;
  label: string;
  trend?: StatCardTrend;
  className?: string;
}

export function StatCard({ metric, label, trend, className }: StatCardProps) {
  // Strip any background utilities (including responsive/state bg- classes)
  // to ensure the card surface always stays bg-white via the Card primitive.
  const sanitizedClassName = className ? className.replace(/\b\S*bg-\S+/g, '').trim() : undefined;

  return (
    <Card className={cn('bg-white p-4', sanitizedClassName)}>
      <div className="flex flex-col gap-1">
        <span className="text-text-muted text-xs font-semibold tracking-wide uppercase">
          {label}
        </span>
        <span className="text-text-primary text-3xl font-bold">{metric}</span>
        {trend && (
          <div className="mt-1 flex items-center gap-1">
            {trend.direction === 'up' ? (
              <TrendingUp className="text-success-500 h-4 w-4 shrink-0" />
            ) : (
              <TrendingDown className="text-danger-500 h-4 w-4 shrink-0" />
            )}
            <span
              className={cn(
                'text-xs font-medium',
                trend.direction === 'up' ? 'text-success-500' : 'text-danger-500',
              )}
            >
              {trend.value}%
            </span>
            {trend.label && <span className="text-text-muted text-xs">{trend.label}</span>}
          </div>
        )}
      </div>
    </Card>
  );
}
