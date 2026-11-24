"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markVotedAction } from "@/app/(app)/wahl/[id]/wahltag/actions";

export interface UrneZeile {
  id: string;
  lfdNr: number;
  nachname: string;
  vorname: string;
  /** Uhrzeit des Vermerks, sonst null */
  gewaehltUm: string | null;
  art: "urne" | "brief" | null;
  /** Briefwahlunterlagen wurden ausgegeben */
  briefUnterlagen: boolean;
}

/** Umlaute/Akzente ignorieren, damit „Muller“ auch „Müller“ findet. */
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").trim();

const ABGLEICH_MS = 15_000;

export function UrneAnsicht({ zeilen }: { zeilen: UrneZeile[] }) {
  const router = useRouter();
  const suche = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [auswahl, setAuswahl] = useState<UrneZeile | null>(null);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Mehrere Geräte gleichzeitig: Stand regelmäßig vom Server holen
  useEffect(() => {
    const t = window.setInterval(() => router.refresh(), ABGLEICH_MS);
    return () => window.clearInterval(t);
  }, [router]);

  const gewaehlt = zeilen.filter((z) => z.gewaehltUm).length;

  // Namen erst nach Eingabe zeigen (Bildschirm am Wahltisch ist für Wählende sichtbar)
  const treffer = useMemo(() => {
    const q = norm(query);
    if (!q) return [];
    if (/^\d+$/.test(q)) return zeilen.filter((z) => String(z.lfdNr) === q);
    if (q.length < 2) return [];
    const teile = q.split(/[\s,]+/).filter(Boolean);
    return zeilen
      .filter((z) => {
        const name = norm(`${z.nachname} ${z.vorname}`);
        return teile.every((t) => name.includes(t));
      })
      .slice(0, 8);
  }, [zeilen, query]);

  function vermerken(z: UrneZeile) {
    startTransition(async () => {
      const res = await markVotedAction(z.id, "urne");
      setAuswahl(null);
      if (res.ok) {
        setMeldung({ ok: true, text: `Vermerkt: ${z.vorname} ${z.nachname} (Nr. ${z.lfdNr})` });
        setQuery("");
      } else {
        setMeldung({ ok: false, text: res.message ?? "Vermerk nicht möglich." });
      }
      router.refresh();
      suche.current?.focus();
    });
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-muted-foreground">Person anhand des Ausweises oder Namens suchen, Stimmabgabe bestätigen.</p>
        <p className="text-right text-sm whitespace-nowrap">
          <span className="text-2xl font-bold tabular-nums">{gewaehlt}</span> / {zeilen.length} gewählt
        </p>
      </div>

      <label className="relative block">
        <span className="sr-only">Name oder laufende Nummer</span>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-7 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={suche}
          type="search"
          inputMode="search"
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setMeldung(null);
          }}
          placeholder="Nachname, Vorname oder Nr."
          className="h-16 w-full rounded-sm border-2 border-foreground bg-card pr-4 pl-14 text-2xl outline-none focus-visible:ring-4 focus-visible:ring-brand-yellow"
        />
      </label>

      {meldung && (
        <p
          role="status"
          className={cn(
            "flex items-center gap-3 rounded-sm p-4 text-lg font-semibold",
            meldung.ok ? "bg-success text-white" : "bg-destructive text-white",
          )}
        >
          {meldung.ok ? <Check aria-hidden className="size-6" /> : <TriangleAlert aria-hidden className="size-6" />}
          {meldung.text}
        </p>
      )}

      {query.trim() !== "" && treffer.length === 0 && (
        <p className="rounded-sm border-2 border-dashed p-6 text-center text-lg">
          Keine wahlberechtigte Person gefunden.
          <span className="mt-1 block text-base text-muted-foreground">
            Schreibweise prüfen. Steht die Person nicht im Wählerverzeichnis, darf sie nicht wählen – bitte den Wahlvorstand holen.
          </span>
        </p>
      )}

      <ul className="grid gap-3">
        {treffer.map((z) => (
          <li
            key={z.id}
            className={cn("flex flex-wrap items-center justify-between gap-4 rounded-sm border-2 bg-card p-4", z.gewaehltUm ? "border-border opacity-80" : "border-foreground")}
          >
            <div>
              <p className="text-2xl leading-tight font-bold">
                {z.nachname}, {z.vorname}
              </p>
              <p className="text-base text-muted-foreground">Nr. {z.lfdNr}</p>
              {z.gewaehltUm && (
                <p className="mt-1 font-semibold text-destructive">
                  Hat bereits gewählt ({z.art === "brief" ? "per Brief" : `an der Urne, ${z.gewaehltUm} Uhr`}) – keinen Stimmzettel ausgeben.
                </p>
              )}
              {!z.gewaehltUm && z.briefUnterlagen && (
                <p className="mt-1 font-semibold text-destructive">Briefwahlunterlagen wurden ausgegeben – bitte den Wahlvorstand holen.</p>
              )}
            </div>
            {!z.gewaehltUm && !z.briefUnterlagen && (
              <Button type="button" size="lg" className="h-14 px-6 text-lg" onClick={() => setAuswahl(z)} disabled={pending}>
                Stimmabgabe vermerken
              </Button>
            )}
          </li>
        ))}
      </ul>

      {auswahl && (
        <div role="dialog" aria-modal="true" aria-labelledby="bestaetigen-titel" className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="grid w-full max-w-lg gap-5 rounded-sm bg-card p-6">
            <p id="bestaetigen-titel" className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
              Stimmabgabe vermerken?
            </p>
            <p className="text-3xl leading-tight font-bold">
              {auswahl.nachname}, {auswahl.vorname}
              <span className="block text-lg font-normal text-muted-foreground">Nr. {auswahl.lfdNr} im Wählerverzeichnis</span>
            </p>
            <p className="text-base">Erst vermerken, wenn der Stimmzettelumschlag in die Urne gelegt wird.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" size="lg" variant="outline" className="h-14 text-lg" onClick={() => setAuswahl(null)} disabled={pending}>
                Abbrechen
              </Button>
              <Button type="button" size="lg" className="h-14 text-lg" onClick={() => vermerken(auswahl)} disabled={pending} autoFocus>
                {pending ? "Wird vermerkt …" : "Ja, vermerken"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
