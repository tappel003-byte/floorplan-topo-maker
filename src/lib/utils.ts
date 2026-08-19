import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** System UI stack for canvas text — matches html/body. */
export const CANVAS_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
