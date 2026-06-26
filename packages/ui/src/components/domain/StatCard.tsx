import * as React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "../ui/card";
import { cn } from "@batac/ui/lib/utils";

export interface StatCardTrend {
  value: number;
  direction: "up" | "down";
  label?: string; // e.g. "from last week"
}

export interface StatCardProps {
  metric: string | number;
  label: string;
  trend?: StatCardTrend;
  className?: string;
}

export function StatCard({
  metric,
  label,
  trend,
  className,
}: StatCardProps) {
  // Strip any background utilities (including responsive/state bg- classes) 
  // to ensure the card surface always stays bg-white via the Card primitive.
  const sanitizedClassName = className
    ? className.replace(/\b\S*bg-\S+/g, "").trim()
    : undefined;

  return (
    <Card className={cn("p-4 bg-white", sanitizedClassName)}>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {label}
        </span>
        <span className="text-3xl font-bold text-text-primary">
          {metric}
        </span>
        {trend && (
          <div className="mt-1 flex items-center gap-1">
            {trend.direction === "up" ? (
              <TrendingUp className="h-4 w-4 text-success-500 shrink-0" />
            ) : (
              <TrendingDown className="h-4 w-4 text-danger-500 shrink-0" />
            )}
            <span
              className={cn(
                "text-xs font-medium",
                trend.direction === "up" ? "text-success-500" : "text-danger-500"
              )}
            >
              {trend.value}%
            </span>
            {trend.label && (
              <span className="text-xs text-text-muted">
                {trend.label}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
