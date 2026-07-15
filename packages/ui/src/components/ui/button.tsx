/**
 * packages/ui/src/components/ui/button.tsx
 *
 * shadcn/ui Button with batac-dms customizations.
 * Install shadcn Button first: pnpm dlx shadcn@latest add --cwd packages/ui button
 * Then replace with this file.
 *
 * Changes from shadcn default:
 * 1. variant="default" styled with brand navy (#162e60) instead of shadcn zinc.
 *    shadcn's --primary HSL var already maps to primary-800, so this is cosmetic only.
 * 2. variant="primary" added as CVA alias for variant="default" —
 *    so kitchen-sink.jsx usage (variant="primary") works without renaming.
 * 3. size="xs" added — used in kitchen-sink.jsx WorkflowStepIndicator.
 * 4. variant="ghost-danger" added — used in kitchen-sink.jsx MoreHorizontal menus
 *    and Delete actions per DESIGN.md §6.3.
 *
 * Source: DESIGN.md §6.3 + kitchen-sink.jsx variant audit
 */
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@batac/ui/lib/utils';

const buttonVariants = cva(
  // Base styles — all buttons share these
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /**
         * Primary action — brand navy.
         * "default" is shadcn's name; "primary" is the kitchen-sink alias.
         * Both resolve to the same styles via cva aliasing below.
         */
        default: 'bg-primary-800 text-white hover:bg-primary-900 active:bg-primary-950',

        /**
         * Alias: variant="primary" → same as variant="default".
         * Allows kitchen-sink.jsx to work without renaming every button.
         * Both aliases are documented; the codebase should converge on
         * "default" over time as shadcn components use that internally.
         */
        primary: 'bg-primary-800 text-white hover:bg-primary-900 active:bg-primary-950',

        /** Secondary/outline — border + neutral background */
        secondary:
          'border border-border-default bg-white text-text-primary hover:bg-surface-raised active:bg-neutral-100',

        /** Destructive — danger red. Used for irreversible actions. */
        destructive: 'bg-danger-500 text-white hover:bg-danger-700 active:bg-danger-900',

        /** Ghost — transparent with hover background. Toolbars, icon rows. */
        ghost: 'text-text-primary hover:bg-neutral-100 active:bg-neutral-200',

        /**
         * Ghost danger — transparent with danger hover.
         * Used for Delete actions in menus per DESIGN.md §6.3.
         * [Not in DESIGN.md explicitly — added from kitchen-sink.jsx usage]
         */
        'ghost-danger':
          'text-danger-500 hover:bg-danger-50 hover:text-danger-700 active:bg-danger-100',

        /** Link style — no background, underline on hover */
        link: 'text-text-link underline-offset-4 hover:underline hover:text-text-link-hover',

        /** Outline — shadcn compat alias for secondary */
        outline: 'border border-border-default bg-white text-text-primary hover:bg-surface-raised',
      },

      size: {
        /**
         * xs: smallest — WorkflowStepIndicator, inline chips.
         * Below 44px touch target — use .touch-exempt on the wrapper
         * when placed in non-primary-action contexts.
         * [Not in DESIGN.md explicitly — added from kitchen-sink.jsx]
         */
        xs: 'h-6 px-2 text-xs rounded-sm',

        /** sm: 32px — toolbar actions, form action rows */
        sm: 'h-8 px-3 text-xs',

        /** md/default: 40px — standard form buttons */
        default: 'h-10 px-4 py-2',

        /** lg: 44px — primary CTAs, touch-safe */
        lg: 'h-11 px-6 text-base',

        /** icon: square variant for icon-only buttons */
        icon: 'h-10 w-10',

        /** icon-sm: smaller square for toolbar icon buttons */
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
