import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Freundlicher Hinweis für Seiten, die es erst ab einem bestimmten Stand der Wahl gibt. */
export function NochNichtVerfuegbar({ titel, text, ziel }: { titel: string; text: React.ReactNode; ziel: { href: string; label: string } }) {
  return (
    <div className="grid max-w-3xl gap-4">
      <h1 className="text-3xl">{titel}</h1>
      <div className="grid gap-4 rounded-sm border border-l-4 border-l-foreground bg-card p-6">
        <p className="flex items-center gap-2 font-semibold">
          <Clock aria-hidden className="size-5" /> Noch nicht verfügbar
        </p>
        <div className="text-muted-foreground">{text}</div>
        <div>
          <Button asChild>
            <Link href={ziel.href}>
              {ziel.label} <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
