"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  aufhebenAction,
  feststellenAction,
  saveAuszaehlungAction,
  saveLosAction,
  type FormState,
} from "./actions";

const initial: FormState = {};

function Meldung({ state }: Readonly<{ state: FormState }>) {
  if (state.error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  if (state.ok && state.message)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {state.message}
      </p>
    );
  return null;
}

export interface StimmenFeld {
  name: string;
  label: string;
  /** Überschrift der Gruppe (Wahlvorschlag) – neue Gruppe, sobald sie wechselt */
  gruppe?: string;
  defaultValue: number | null;
}

export function AuszaehlungForm({
  electionId,
  gesamt,
  ungueltig,
  vorkommnisse,
  felder,
  feldTitel,
  stimmenUngueltig,
  disabled,
}: Readonly<{
  electionId: string;
  gesamt: number | null;
  ungueltig: number | null;
  vorkommnisse: string | null;
  felder: StimmenFeld[];
  feldTitel: string;
  stimmenUngueltig: number | null;
  disabled: boolean;
}>) {
  const [state, action, pending] = useActionState(
    saveAuszaehlungAction,
    initial,
  );
  return (
    <form action={action} className="grid gap-6" autoComplete="off">
      <input type="hidden" name="electionId" value={electionId} />
      <fieldset disabled={disabled} className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="stimmzettelGesamt">
              Stimmzettel insgesamt (Urne inkl. Wahlbriefe)
            </Label>
            <Input
              id="stimmzettelGesamt"
              name="stimmzettelGesamt"
              type="number"
              min={0}
              required
              defaultValue={gesamt ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="stimmzettelUngueltig">davon ungültig</Label>
            <Input
              id="stimmzettelUngueltig"
              name="stimmzettelUngueltig"
              type="number"
              min={0}
              required
              defaultValue={ungueltig ?? ""}
            />
          </div>
        </div>

        <fieldset className="grid gap-3">
          <legend className="mb-1 font-semibold">{feldTitel}</legend>
          {felder.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Bewerberinnen oder Bewerber vorhanden.
            </p>
          ) : (
            felder.map((f, i) => (
              <div key={f.name} className="grid gap-2">
                {f.gruppe && f.gruppe !== felder[i - 1]?.gruppe && (
                  <p className="mt-2 border-b pb-1 text-sm font-semibold">
                    {f.gruppe}
                  </p>
                )}
                <div className="grid items-center gap-2 sm:grid-cols-[1fr_8rem]">
                  <Label htmlFor={f.name}>{f.label}</Label>
                  <Input
                    id={f.name}
                    name={f.name}
                    type="number"
                    min={0}
                    defaultValue={f.defaultValue ?? ""}
                    required
                  />
                </div>
              </div>
            ))
          )}
        </fieldset>

        <div className="grid gap-2 sm:max-w-xs">
          <Label htmlFor="stimmenUngueltig">
            Ungültige Stimmen auf gültigen Stimmzetteln
          </Label>
          <Input
            id="stimmenUngueltig"
            name="stimmenUngueltig"
            type="number"
            min={0}
            defaultValue={stimmenUngueltig ?? ""}
          />
          <p className="text-xs text-muted-foreground">
            Für die Niederschrift (§ 26 Abs. 4, §§ 28, 35 LPVGWO); z. B. mehr
            als 3 Stimmen für eine Person.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="vorkommnisse">
            Besondere Vorkommnisse (für die Niederschrift)
          </Label>
          <textarea
            id="vorkommnisse"
            name="vorkommnisse"
            rows={3}
            maxLength={8000}
            defaultValue={vorkommnisse ?? ""}
            placeholder="z. B. Gründe für ungültige Stimmzettel, Abweichungen zwischen Urne und Vermerken, Störungen"
            className="rounded-sm border border-input bg-card px-3 py-2 text-sm"
          />
        </div>
        <Meldung state={state} />
        <div>
          <Button type="submit" disabled={pending || disabled}>
            {pending ? "Speichern …" : "Auszählung speichern und berechnen"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function LosForm({
  electionId,
  beteiligte,
  plaetze,
}: Readonly<{
  electionId: string;
  beteiligte: { id: string; label: string }[];
  plaetze: number;
}>) {
  const [state, action, pending] = useActionState(saveLosAction, initial);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="electionId" value={electionId} />
      <input type="hidden" name="plaetze" value={plaetze} />
      {beteiligte.map((b) => (
        <input key={`h-${b.id}`} type="hidden" name="beteiligt" value={b.id} />
      ))}
      <p className="text-sm">
        Gleichstand an der Sitzgrenze. Der Wahlvorstand zieht das Los um{" "}
        {plaetze} {plaetze === 1 ? "Sitz" : "Sitze"}. Bitte
        {plaetze === 1 ? " den Gewinner" : ` die ${plaetze} Gewinner`}{" "}
        ankreuzen:
      </p>
      <div className="grid gap-2">
        {beteiligte.map((b) => (
          <label key={b.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="gewinner" value={b.id} /> {b.label}
          </label>
        ))}
      </div>
      <Meldung state={state} />
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          Losentscheid festhalten
        </Button>
      </div>
    </form>
  );
}

export function FeststellenForm({
  electionId,
  bereit,
  festgestellt,
}: Readonly<{ electionId: string; bereit: boolean; festgestellt: boolean }>) {
  const [state, action, pending] = useActionState(
    festgestellt ? aufhebenAction : feststellenAction,
    initial,
  );
  return (
    <form
      action={action}
      className="grid gap-2"
      onSubmit={(e) => {
        const text = festgestellt
          ? "Feststellung aufheben? Danach können Zahlen wieder geändert werden. Bereits ausgehängte Bekanntmachungen sind dann ungültig."
          : "Ergebnis jetzt feststellen? Die Eingaben werden danach gesperrt.";
        if (!window.confirm(text)) e.preventDefault();
      }}
    >
      <input type="hidden" name="electionId" value={electionId} />
      <div>
        <Button
          type="submit"
          variant={festgestellt ? "outline" : "default"}
          disabled={pending || (!festgestellt && !bereit)}
        >
          {festgestellt ? "Feststellung aufheben" : "Ergebnis feststellen"}
        </Button>
      </div>
      <Meldung state={state} />
    </form>
  );
}
