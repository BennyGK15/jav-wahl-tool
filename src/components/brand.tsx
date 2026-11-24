import Link from "next/link";
import { cn } from "@/lib/utils";

/** Eigene Wortmarke (bewusst ohne Landeswappen – kein offizielles Angebot des Landes). */
export function Brand({ className }: Readonly<{ className?: string }>) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2.5 font-bold text-brand-ink no-underline",
        className,
      )}
      aria-label="JAV-Wahl-Tool, zur Übersicht"
    >
      <span
        aria-hidden
        className="flex h-8 items-center bg-brand-ink px-1.5 text-sm font-black tracking-wider text-brand-yellow"
      >
        JAV
      </span>
      <span className="text-base leading-none">Wahl-Tool</span>
    </Link>
  );
}
