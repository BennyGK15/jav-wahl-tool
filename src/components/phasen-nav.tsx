"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavLink {
  href: string;
  label: string;
  /** nur bei exakt gleichem Pfad aktiv */
  exact?: boolean;
  /** gesetzt, wenn die Seite noch nicht verfügbar ist: Hinweis, ab wann */
  gesperrt?: string;
}

export interface NavPhase {
  key: string;
  nummer: number;
  label: string;
  kurz: string;
  status: "erledigt" | "aktuell" | "offen";
  seiten: NavLink[];
}

const passt = (pathname: string, l: NavLink) =>
  l.exact || l.href === "/"
    ? pathname === l.href
    : pathname === l.href || pathname.startsWith(`${l.href}/`);

/** Spezifischster Treffer (längster Pfad) gewinnt. */
function finde<T extends NavLink>(pathname: string, links: T[]): T | undefined {
  return links
    .filter((l) => passt(pathname, l))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

const tab = (aktiv: boolean) =>
  cn(
    "inline-flex h-12 items-center gap-2 border-b-[3px] px-3 text-sm font-semibold whitespace-nowrap no-underline transition-colors",
    aktiv
      ? "border-foreground text-foreground"
      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
  );

export function PhasenNav({
  start,
  phasen,
  extras,
  verwaltung,
}: Readonly<{
  start: NavLink;
  phasen: NavPhase[];
  extras: NavLink[];
  verwaltung: NavLink[];
}>) {
  const pathname = usePathname();
  const menue = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (menue.current) menue.current.open = false;
  }, [pathname]);

  const alleSeiten = phasen.flatMap((p) =>
    p.seiten.map((s) => ({ ...s, phase: p.key })),
  );
  const treffer = finde(pathname, [
    start,
    ...extras,
    ...alleSeiten,
    ...verwaltung,
  ]);
  const aktivePhase =
    treffer && "phase" in treffer
      ? phasen.find((p) => p.key === treffer.phase)
      : undefined;
  const aktiveSeite = aktivePhase ? treffer : undefined;
  const verwaltungAktiv = Boolean(
    treffer && verwaltung.includes(treffer as NavLink),
  );

  return (
    <>
      <nav
        aria-label="Hauptnavigation"
        className="-mb-px flex items-stretch gap-2"
      >
        <ul className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          <li>
            <Link
              href={start.href}
              aria-current={treffer === start ? "page" : undefined}
              className={tab(treffer === start)}
            >
              {start.label}
            </Link>
          </li>
          {phasen.map((p) => {
            const aktiv = p === aktivePhase;
            const ziel = p.seiten[0];
            if (!ziel) return null;
            return (
              <li key={p.key}>
                <Link
                  href={ziel.href}
                  aria-current={aktiv ? "page" : undefined}
                  className={tab(aktiv)}
                  title={p.kurz}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                      p.status === "erledigt" &&
                        "bg-foreground text-background",
                      p.status === "aktuell" &&
                        "bg-brand-yellow text-brand-ink ring-2 ring-brand-ink",
                      p.status === "offen" &&
                        "border border-muted-foreground/60",
                    )}
                  >
                    {p.status === "erledigt" ? (
                      <Check className="size-3" />
                    ) : (
                      p.nummer
                    )}
                  </span>
                  {p.label}
                  <span className="sr-only">
                    {p.status === "erledigt"
                      ? " (erledigt)"
                      : p.status === "aktuell"
                        ? " (aktuelle Phase)"
                        : ""}
                  </span>
                </Link>
              </li>
            );
          })}
          {extras.map((e) => (
            <li
              key={e.href}
              className={e === extras[0] ? "ml-auto border-l pl-1" : undefined}
            >
              <Link
                href={e.href}
                aria-current={treffer === e ? "page" : undefined}
                className={tab(treffer === e)}
              >
                {e.label}
              </Link>
            </li>
          ))}
        </ul>
        {verwaltung.length > 0 && (
          <details ref={menue} className="relative">
            <summary
              className={cn(
                tab(verwaltungAktiv),
                "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
              )}
            >
              Verwaltung <ChevronDown aria-hidden className="size-4" />
            </summary>
            <ul className="absolute right-0 z-20 mt-px grid min-w-52 border bg-card py-1 text-sm">
              {verwaltung.map((v) => (
                <li key={v.href}>
                  <Link
                    href={v.href}
                    aria-current={treffer === v ? "page" : undefined}
                    className={cn(
                      "block px-4 py-2 no-underline hover:bg-secondary",
                      treffer === v
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {v.label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </nav>
      {aktivePhase && aktivePhase.seiten.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t py-2">
          <ul
            aria-label={`Seiten der Phase ${aktivePhase.label}`}
            className="flex flex-wrap gap-1"
          >
            {aktivePhase.seiten.map((s) => {
              const aktiv = aktiveSeite?.href === s.href;
              return (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    aria-current={aktiv ? "page" : undefined}
                    title={
                      s.gesperrt
                        ? `Noch nicht verfügbar – ${s.gesperrt}`
                        : undefined
                    }
                    className={cn(
                      "inline-flex h-8 items-center rounded-sm px-3 text-sm no-underline",
                      aktiv
                        ? "bg-foreground font-semibold text-background"
                        : s.gesperrt
                          ? "text-muted-foreground/60 hover:bg-secondary"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {s.label}
                    {s.gesperrt && (
                      <span className="sr-only">
                        {" "}
                        (noch nicht verfügbar – {s.gesperrt})
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              Phase {aktivePhase.nummer} · {aktivePhase.label}:
            </span>{" "}
            {aktivePhase.kurz}
          </p>
        </div>
      )}
    </>
  );
}
