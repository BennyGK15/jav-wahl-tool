"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayBerlin } from "@/lib/dates";
import { fruehesterWahltag } from "@/lib/fristen";
import { verfahrensauskunft } from "@/lib/jav";
import { formatIsoDate } from "@/lib/utils";
import { createElectionAction, type CreateElectionState } from "./actions";

const initial: CreateElectionState = {};

export interface ElectionDefaults {
  electionId: string;
  dienststelle: string;
  wahlberechtigte: number;
  verfahren: "regulaer" | "wahlversammlung";
  wahltag: string;
  amtszeitEnde: string | null;
}

export function ElectionForm({
  action = createElectionAction,
  defaults,
  submitLabel = "Wahl anlegen und Kalender berechnen",
  erlassMonate = 2,
}: Readonly<{
  action?: (
    prev: CreateElectionState,
    formData: FormData,
  ) => Promise<CreateElectionState>;
  defaults?: ElectionDefaults;
  submitLabel?: string;
  /** Vorlauf des Wahlausschreibens laut Fristregel (Monate) */
  erlassMonate?: number;
}>) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [anzahl, setAnzahl] = useState<number | null>(
    defaults?.wahlberechtigte ?? null,
  );
  const [verfahren, setVerfahren] = useState<"regulaer" | "wahlversammlung">(
    defaults?.verfahren ?? "regulaer",
  );
  const [wahltag, setWahltag] = useState(defaults?.wahltag ?? "");
  const [amtszeitEnde, setAmtszeitEnde] = useState(
    defaults?.amtszeitEnde ?? "",
  );

  const auskunft = anzahl == null ? null : verfahrensauskunft(anzahl);
  const wvMoeglich = auskunft?.wahlversammlungMoeglich ?? false;
  const effektiv = wvMoeglich ? verfahren : "regulaer";

  const vorschlag = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(amtszeitEnde)) return null;
    try {
      return fruehesterWahltag({
        heute: todayBerlin(),
        amtszeitEnde,
        verfahren: effektiv,
        erlassMonate,
      });
    } catch {
      return null;
    }
  }, [amtszeitEnde, effektiv, erlassMonate]);

  return (
    <form action={formAction} className="grid gap-8">
      {defaults && (
        <input type="hidden" name="electionId" value={defaults.electionId} />
      )}
      <fieldset className="grid gap-4">
        <legend className="mb-2 font-semibold">1. Dienststelle</legend>
        <div className="grid gap-2">
          <Label htmlFor="dienststelle">Name der Dienststelle</Label>
          <Input
            id="dienststelle"
            name="dienststelle"
            required
            maxLength={255}
            defaultValue={defaults?.dienststelle}
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 font-semibold">2. Wahlberechtigte</legend>
        <div className="grid max-w-xs gap-2">
          <Label htmlFor="wahlberechtigte">
            Voraussichtliche Zahl (laut Personalstelle)
          </Label>
          <Input
            id="wahlberechtigte"
            name="wahlberechtigte"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            required
            defaultValue={defaults?.wahlberechtigte}
            onChange={(e) =>
              setAnzahl(e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Unter 18-Jährige und alle Beschäftigten in Ausbildung (unabhängig vom
          Alter). Die genaue Zahl ergibt sich später aus dem Wählerverzeichnis.
        </p>
        {auskunft && (
          <div role="status" className="rounded-md border p-4 text-sm">
            {auskunft.javMoeglich ? (
              <>
                <p>
                  Die JAV hat <strong>{auskunft.mitglieder}</strong>{" "}
                  {auskunft.mitglieder === 1 ? "Mitglied" : "Mitglieder"} (§ 61
                  LPVG BW).
                </p>
                <p className="text-muted-foreground">
                  {auskunft.wahlversammlungMoeglich
                    ? "Bei höchstens 20 Wahlberechtigten kann der Wahlvorstand eine Wahlversammlung bestimmen."
                    : "Es gilt das reguläre Wahlverfahren mit Wahlausschreiben."}
                </p>
              </>
            ) : (
              <p className="text-destructive">
                Bei weniger als 5 Wahlberechtigten wird keine JAV gebildet (§ 59
                LPVG BW).
              </p>
            )}
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-2 font-semibold">3. Wahlverfahren</legend>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="radio"
            name="verfahren"
            value="regulaer"
            className="mt-1"
            checked={effektiv === "regulaer"}
            onChange={() => setVerfahren("regulaer")}
          />
          <span>
            <span className="font-medium">Reguläres Verfahren</span>
            <span className="block text-muted-foreground">
              Wahlausschreiben, Wählerverzeichnis, Wahlvorschläge,
              Urnen-/Briefwahl
            </span>
          </span>
        </label>
        <label
          className={`flex items-start gap-3 text-sm ${wvMoeglich ? "" : "opacity-50"}`}
        >
          <input
            type="radio"
            name="verfahren"
            value="wahlversammlung"
            className="mt-1"
            disabled={!wvMoeglich}
            checked={effektiv === "wahlversammlung"}
            onChange={() => setVerfahren("wahlversammlung")}
          />
          <span>
            <span className="font-medium">Wahlversammlung</span>
            <span className="block text-muted-foreground">
              Nur bei 5–20 Wahlberechtigten. Vorschläge aus der Versammlung,
              Mehrheitswahl, keine Briefwahl.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 font-semibold">4. Termine</legend>
        <div className="flex flex-wrap gap-4">
          <div className="grid gap-2">
            <Label htmlFor="wahltag">
              {effektiv === "wahlversammlung"
                ? "Tag der Wahlversammlung"
                : "Erster Wahltag"}
            </Label>
            <Input
              id="wahltag"
              name="wahltag"
              type="date"
              required
              value={wahltag}
              onChange={(e) => setWahltag(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="amtszeitEnde">
              Ende der Amtszeit der bisherigen JAV
            </Label>
            <Input
              id="amtszeitEnde"
              name="amtszeitEnde"
              type="date"
              required={effektiv === "wahlversammlung"}
              value={amtszeitEnde}
              onChange={(e) => setAmtszeitEnde(e.target.value)}
            />
          </div>
        </div>
        {vorschlag && (
          <div
            role="status"
            className="grid gap-2 border-l-4 border-l-foreground bg-highlight p-4 text-sm"
          >
            <div className="flex flex-wrap items-center gap-3">
              <p>
                Frühester Wahltag:{" "}
                <strong>{formatIsoDate(vorschlag.datum)}</strong>
              </p>
              {wahltag !== vorschlag.datum && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setWahltag(vorschlag.datum)}
                >
                  Übernehmen
                </Button>
              )}
            </div>
            <ul className="grid gap-1 text-muted-foreground">
              {vorschlag.gruende.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            {vorschlag.warnungen.map((w) => (
              <p key={w} className="font-semibold text-destructive">
                {w}
              </p>
            ))}
            {wahltag &&
              amtszeitEnde &&
              wahltag > amtszeitEnde &&
              !vorschlag.warnungen.length && (
                <p className="font-semibold text-destructive">
                  Der gewählte Wahltag liegt nach dem Ende der Amtszeit.
                </p>
              )}
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {effektiv === "wahlversammlung"
            ? "Tag der Wahlversammlung dieser (kommenden) Wahl."
            : "Erster Wahltag der kommenden Wahl – bei mehreren Wahltagen der erste. Von ihm aus werden alle Fristen rückwärts berechnet."}
        </p>
        <p className="text-sm text-muted-foreground">
          Amtszeitende: Leer lassen, wenn es noch keine JAV gibt (erste Wahl).
          {effektiv === "wahlversammlung" &&
            " Für die Wahlversammlung ist das Datum Pflicht, weil sich die Einladungsfrist danach richtet."}
        </p>
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div>
        <Button
          type="submit"
          disabled={pending || (auskunft != null && !auskunft.javMoeglich)}
        >
          {pending ? "Speichern …" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
