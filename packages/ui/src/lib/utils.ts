import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for composing Tailwind CSS class names.
 * Merges conditional classes (clsx) then resolves Tailwind conflicts (tailwind-merge).
 * Required by all shadcn/ui components.
 *
 * Usage:
 *   cn("px-4 py-2", isActive && "bg-primary-800 text-white", className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
