/**
 * packages/ui/src/components/ui/tabs.tsx
 *
 * shadcn/ui Tabs with batac-dms underline variant.
 * Install shadcn Tabs first: pnpm dlx shadcn@latest add --cwd packages/ui tabs
 * Then replace TabsList and TabsTrigger with these versions.
 *
 * Changes from shadcn default:
 * - Adds variant="underline" to TabsList + TabsTrigger.
 *   DESIGN.md §6.2: document detail panel tabs use a bottom-border
 *   underline style, not the default pill/background style.
 * - "default" variant preserves shadcn's original pill style.
 *
 * API is fully shadcn-compatible: <Tabs>, <TabsList>, <TabsTrigger>, <TabsContent>
 * kitchen-sink.jsx custom Tabs must be migrated to this API.
 *
 * Source: DESIGN.md §6.2
 */

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@batac/ui/lib/utils';

/* ── TabsList ─────────────────────────────────────────────── */

const tabsListVariants = cva('inline-flex items-center', {
  variants: {
    variant: {
      /** Default: pill background style (shadcn original) */
      default: 'h-9 rounded-lg bg-neutral-100 p-1 text-text-secondary',
      /** Underline: bottom border only, no background */
      underline: 'h-auto border-b border-border-default bg-transparent gap-0 w-full',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface TabsListProps
  extends
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, variant, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(tabsListVariants({ variant, className }))}
      {...props}
    />
  ),
);
TabsList.displayName = TabsPrimitive.List.displayName;

/* ── TabsTrigger ──────────────────────────────────────────── */

const tabsTriggerVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        /** Default: pill/background style (shadcn original) */
        default:
          'rounded-md px-3 py-1 text-text-secondary hover:text-text-primary data-[state=active]:bg-white data-[state=active]:text-text-primary data-[state=active]:shadow',
        /**
         * Underline: bottom border indicator.
         * Active: primary-800 border + text.
         * DESIGN.md §6.2: "tabs use a persistent underline on active tab"
         */
        underline:
          'rounded-none px-4 py-2.5 border-b-2 border-transparent text-text-secondary hover:text-text-primary hover:border-neutral-300 data-[state=active]:border-primary-800 data-[state=active]:text-primary-800 data-[state=active]:font-semibold',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface TabsTriggerProps
  extends
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
    VariantProps<typeof tabsTriggerVariants> {}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant, className }))}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

/* ── TabsContent ──────────────────────────────────────────── */

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'focus-visible:ring-ring mt-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

/* ── Root (unchanged from shadcn) ────────────────────────── */
const Tabs = TabsPrimitive.Root;

export { Tabs, TabsList, TabsTrigger, TabsContent };
