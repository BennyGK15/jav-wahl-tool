import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

/** Kachel im Stil des Landesportals: gelbes Icon-Quadrat, fette Überschrift, Pfeil-Link. */
export function Tile({ href, icon: Icon, title, text, meta }: { href: string; icon: LucideIcon; title: string; text: string; meta?: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-sm border border-border bg-card p-5 no-underline transition-colors hover:border-foreground"
    >
      <span aria-hidden className="flex size-9 items-center justify-center bg-brand-yellow text-brand-ink">
        <Icon className="size-5" />
      </span>
      <span className="text-lg leading-tight font-bold text-foreground">{title}</span>
      <span className="text-sm text-muted-foreground">{text}</span>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-foreground">
        <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        {meta ?? "Öffnen"}
      </span>
    </Link>
  );
}
