/**
 * packages/ui/src/components/ui/avatar.tsx
 *
 * shadcn/ui Avatar with batac-dms size variants and initials helper.
 * Install shadcn Avatar first: pnpm dlx shadcn@latest add --cwd packages/ui avatar
 * Then replace with this file.
 *
 * Changes from shadcn default:
 * - Adds size variants: sm (24px), md (32px), lg (40px).
 *   shadcn Avatar has no built-in sizes.
 * - Adds AvatarName compound component — generates initials + deterministic
 *   background color from name string, matching kitchen-sink.jsx behavior.
 *
 * Source: kitchen-sink.jsx Avatar component + DESIGN.md §6.6
 */
import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@batac/ui/lib/utils";

/* ── Size variants ────────────────────────────────────────── */

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-full",
  {
    variants: {
      size: {
        sm: "h-6 w-6",    /* 24px — tight spaces, table rows */
        md: "h-8 w-8",    /* 32px — standard lists, comments */
        lg: "h-10 w-10",  /* 40px — profile, topbar user menu */
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, size, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(avatarVariants({ size, className }))}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

/* ── Image + Fallback (unchanged from shadcn) ─────────────── */

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700",
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

/* ── AvatarName — initials + deterministic color ─────────── */

/**
 * Color palette for avatar backgrounds.
 * Deterministic: same name always → same color.
 * All combinations pass WCAG AA with white text.
 * [Proposed default — colors chosen for sufficient contrast with #ffffff]
 */
const AVATAR_COLORS = [
  "bg-primary-700",   /* navy blue */
  "bg-info-900",      /* deep blue */
  "bg-success-900",   /* deep green */
  "bg-warning-900",   /* deep amber */
  "bg-neutral-700",   /* gray */
  "bg-danger-900",    /* deep red */
] as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";

  const first = parts[0];
  if (!first) return "?";

  if (parts.length === 1) {
    return first.charAt(0).toUpperCase();
  }

  const last = parts[parts.length - 1];
  if (!last) return first.charAt(0).toUpperCase();

  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

function getColorClass(name: string): (typeof AVATAR_COLORS) [number] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] !;
}

export interface AvatarNameProps extends AvatarProps {
  name: string;
}

/**
 * Compound component: renders initials with a deterministic background.
 * Matches kitchen-sink.jsx AvatarName behavior.
 *
 * Usage:
 *   <AvatarName name="Marivic T. Agcaoili" size="md" />
 */
const AvatarName = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarNameProps
>(({ name, size = "md", className, ...props }, ref) => {
  const initials = getInitials(name);
  const colorClass = getColorClass(name);

  const textSizeClass =
    size === "sm" ? "text-[10px]" : size === "lg" ? "text-sm" : "text-xs";

  return (
    <Avatar ref={ref} size={size} className={className} {...props}>
      <AvatarFallback
        className={cn(colorClass, "text-white font-semibold", textSizeClass)}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
});
AvatarName.displayName = "AvatarName";

export { Avatar, AvatarImage, AvatarFallback, AvatarName };
