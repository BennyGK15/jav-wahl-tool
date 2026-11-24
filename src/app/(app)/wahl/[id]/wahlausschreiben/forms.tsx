"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Angaben } from "@/lib/wahlausschreiben";
import { releaseAction, saveAngabenAction, type FormState } from "./actions";

const initial: FormState = {};

function Feld({
  name,
  label,
  defaultValue,
  type = "text",
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} placeholder={placeholder} />
    </div>
  );
}

function Meldung({ state }: { state: FormState }) {
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

export function AngabenForm({
  electionId,
  angaben,
  erlassAm,
  erlassSpaetestens,
}: {
  electionId: string;
  angaben: Angaben;
  erlassAm: string | null;
  erlassSpaetestens: string | null;
}) {
  const [state, action, pending] = useActionState(saveAngabenAction, initial);
  return (
    <form action={action} className="grid gap-6" autoComplete="off">
      <input type="hidden" name="electionId" value={electionId} />

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-semibold">Erlass</legend>
        <div className="grid gap-2">
          <Label htmlFor="wahlausschreibenAm">Datum des Erlasses</Label>
          <Input id="wahlausschreibenAm" name="wahlausschreibenAm" type="date" defaultValue={erlassAm ?? ""} max={erlassSpaetestens ?? undefined} />
          {erlassSpaetestens && <p className="text-xs text-muted-foreground">spätestens {erlassSpaetestens}</p>}
        </div>
        <Feld name="ausstellungsort" label="Ort (für „Ort, den …“)" defaultValue={angaben.ausstellungsort} />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 font-semibold">Stimmabgabe</legend>
        <Feld name="wahlzeitVon" label="Wahlzeit von" type="time" defaultValue={angaben.wahlzeitVon} />
        <Feld name="wahlzeitBis" label="Wahlzeit bis" type="time" defaultValue={angaben.wahlzeitBis} />
        <Feld name="wahlraum" label="Wahlraum" defaultValue={angaben.wahlraum} placeholder="z. B. Raum 1.12, Gebäude A" />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-semibold">Auslage des Wählerverzeichnisses</legend>
        <Feld name="auslageOrt" label="Ort" defaultValue={angaben.auslageOrt} placeholder="z. B. Büro des Personalrats, Raum 0.04" />
        <Feld name="auslageZeiten" label="Zeiten der Einsichtnahme" defaultValue={angaben.auslageZeiten} placeholder="z. B. Mo–Fr 9–15 Uhr" />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-semibold">Wahlvorschläge und Bekanntmachungen</legend>
        <Feld name="einreichungsstelle" label="Einreichungsstelle" defaultValue={angaben.einreichungsstelle} placeholder="z. B. Vorsitz Wahlvorstand, Raum 0.04" />
        <Feld name="bekanntmachungsort" label="Ort der Bekanntmachungen" defaultValue={angaben.bekanntmachungsort} placeholder="z. B. Schwarzes Brett EG, Intranet" />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-semibold">Auszählung (am Wahltag) und Briefwahl</legend>
        <Feld name="auszaehlungZeit" label="Uhrzeit der Auszählung" type="time" defaultValue={angaben.auszaehlungZeit} />
        <Feld name="auszaehlungOrt" label="Ort der Auszählung" defaultValue={angaben.auszaehlungOrt} />
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="briefwahlHinweis">Zusatz zur Briefwahl (optional)</Label>
          <textarea
            id="briefwahlHinweis"
            name="briefwahlHinweis"
            rows={2}
            maxLength={1000}
            defaultValue={angaben.briefwahlHinweis ?? ""}
            className="rounded-sm border border-input bg-card px-3 py-2 text-sm"
          />
        </div>
      </fieldset>

      <p className="text-sm text-muted-foreground">
        Uhrzeiten für das Ende der Einreichungs- und der Einspruchsfrist werden im Wahlkalender gepflegt.
      </p>
      <Meldung state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Speichern …" : "Angaben speichern"}
        </Button>
      </div>
    </form>
  );
}

export function ReleaseForm({ electionId, disabled }: { electionId: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(releaseAction, initial);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="electionId" value={electionId} />
      <div>
        <Button type="submit" disabled={disabled || pending}>
          {pending ? "Freigeben …" : "Diesen Stand freigeben"}
        </Button>
      </div>
      <Meldung state={state} />
    </form>
  );
}
