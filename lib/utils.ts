import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines conditional CSS class names and resolves Tailwind CSS specificity collisions.
 * Uses clsx for conditional class resolution and tailwind-merge to ensure consumer
 * overrides cleanly replace component defaults.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
