import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-03-18" → "Mi., 18.03.2026" */
export function formatIsoDate(iso: string): string {
  return dateFmt.format(new Date(`${iso}T00:00:00Z`));
}
