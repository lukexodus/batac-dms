import React from 'react';
import type { WorkflowStep } from '../../types/domain';
import { cn } from '../../lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/tooltip';
import { format } from 'date-fns';
import { phLocale, DATE_FORMATS } from '../../lib/date-locale';

interface WorkflowStepIndicatorProps {
  steps: WorkflowStep[];
  currentStepId: string;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

function getRingClasses(state: WorkflowStep['state']) {
  const base = "border-2";
  switch (state) {
    case 'completed': return `${base} border-transparent bg-success-500 text-white`;
    case 'active': return `${base} border-transparent bg-primary-800 text-white`;
    case 'pending': return `${base} border-transparent bg-neutral-200 text-neutral-500`;
    case 'skipped': return `${base} border-dashed border-neutral-200 bg-neutral-100 text-neutral-400`;
    case 'error': return `${base} border-transparent bg-danger-500 text-white`;
  }
}

export function WorkflowStepIndicator({
  steps,
  currentStepId,
  orientation = 'horizontal',
  className,
}: WorkflowStepIndicatorProps) {
  return (
    <TooltipProvider>
      <ol
        aria-label="Document workflow steps"
        className={cn(
          "flex w-full",
          orientation === 'horizontal' ? "flex-col md:flex-row" : "flex-col",
          className
        )}
      >
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const tooltipContent = step.tooltip ?? `${step.label}${
            step.completedAt
              ? ` — completed ${format(step.completedAt, DATE_FORMATS.display, { locale: phLocale })}`
              : ''
          }`;

          return (
            <li
              key={step.id}
              aria-current={step.id === currentStepId ? 'step' : undefined}
              aria-disabled={step.state === 'skipped' ? true : undefined}
              aria-label={
                step.state === 'completed' ? `${step.label} — completed` :
                step.state === 'error' ? `${step.label} — error` :
                undefined
              }
              className={cn(
                "relative flex",
                "flex-row items-start gap-4 pb-8", // default vertical spacing
                orientation === 'horizontal' && "md:flex-col md:items-center md:gap-2 md:pb-0 md:flex-1",
                isLast && "pb-0 md:pb-0" // remove bottom padding on the last item
              )}
            >
              {!isLast && (
                <div
                  className={cn(
                    "absolute z-0",
                    // Vertical mode positioning (behind the ring, going down):
                    "left-[15px] top-8 bottom-0 w-[2px]", 
                    // Horizontal mode override (connecting to the next ring's center):
                    orientation === 'horizontal' && "md:left-[50%] md:right-[-50%] md:top-[15px] md:bottom-auto md:w-auto md:h-[2px]",
                    step.state === 'completed' ? 'bg-success-500' : 'bg-neutral-200'
                  )}
                />
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    tabIndex={0}
                    className={cn(
                      "group relative z-10 flex cursor-default outline-none",
                      "flex-row items-start gap-4 text-left w-full",
                      orientation === 'horizontal' && "md:flex-col md:items-center md:gap-2 md:text-center",
                      "focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-sm"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium",
                        getRingClasses(step.state)
                      )}
                    >
                      {index + 1}
                    </div>
                    <div
                      className={cn(
                        "flex flex-col pt-1.5",
                        orientation === 'horizontal' && "md:pt-0"
                      )}
                    >
                      <span
                        className={cn(
                          "text-sm",
                          step.state === 'active' ? "font-semibold text-text-primary" :
                          step.state === 'completed' ? "text-text-primary" : "text-text-muted"
                        )}
                      >
                        {step.label}
                      </span>
                      {step.assigneeName && step.state === 'active' && (
                        <span className="text-xs text-text-muted mt-0.5">
                          {step.assigneeName}
                        </span>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {tooltipContent}
                </TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ol>
    </TooltipProvider>
  );
}
