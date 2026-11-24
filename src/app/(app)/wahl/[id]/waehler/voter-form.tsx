"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveVoterAction, type VoterFormState } from "./actions";

export interface VoterDefaults {
  voterId: string;
  nachname: string;
  vorname: string;
  organisationseinheit: string | null;
  funktion: string | null;
  geburtsdatum: string;
  inAusbildung: boolean;
  ausbildungsende: string | null;
  geschlecht: "w" | "m" | "d" | null;
}

const initial: VoterFormState = {};

export function VoterForm({
  electionId,
  defaults,
}: Readonly<{ electionId: string; defaults?: VoterDefaults }>) {
  const [state, formAction, pending] = useActionState(saveVoterAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && !defaults) {
      formRef.current?.reset();
      formRef.current?.querySelector<HTMLInputElement>("#nachname")?.focus();
    }
  }, [state, defaults]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-4"
      autoComplete="off"
    >
      <input type="hidden" name="electionId" value={electionId} />
      {defaults && (
        <input type="hidden" name="voterId" value={defaults.voterId} />
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="nachname">Nachname</Label>
          <Input
            id="nachname"
            name="nachname"
            required
            maxLength={120}
            defaultValue={defaults?.nachname}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="vorname">Vorname</Label>
          <Input
            id="vorname"
            name="vorname"
            required
            maxLength={120}
            defaultValue={defaults?.vorname}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="organisationseinheit">
            Organisationseinheit (optional)
          </Label>
          <Input
            id="organisationseinheit"
            name="organisationseinheit"
            maxLength={120}
            defaultValue={defaults?.organisationseinheit ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="funktion">
            Amts- oder Funktionsbezeichnung / Ausbildungsberuf
          </Label>
          <Input
            id="funktion"
            name="funktion"
            maxLength={120}
            defaultValue={defaults?.funktion ?? ""}
            placeholder="z. B. Auszubildende/r Verwaltungsfachangestellte/r"
            aria-describedby="funktion-hinweis"
          />
          <p id="funktion-hinweis" className="text-xs text-muted-foreground">
            Pflichtangabe im Wählerverzeichnis (§ 6 Abs. 3 Nr. 5 LPVGWO);
            erscheint bei Bewerbern auch auf dem Stimmzettel.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="geburtsdatum">Geburtsdatum</Label>
          <Input
            id="geburtsdatum"
            name="geburtsdatum"
            type="date"
            required
            defaultValue={defaults?.geburtsdatum}
          />
        </div>
        <div className="grid content-end gap-2 pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="inAusbildung"
              defaultChecked={defaults?.inAusbildung}
            />{" "}
            In beruflicher Ausbildung
          </label>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ausbildungsende">Ausbildungsende (optional)</Label>
          <Input
            id="ausbildungsende"
            name="ausbildungsende"
            type="date"
            defaultValue={defaults?.ausbildungsende ?? ""}
          />
        </div>
      </div>

      <div className="grid max-w-xs gap-2">
        <Label htmlFor="geschlecht">
          Geschlecht (nur für die Geschlechteranteile)
        </Label>
        <select
          id="geschlecht"
          name="geschlecht"
          defaultValue={defaults?.geschlecht ?? ""}
          className="h-9 rounded-sm border border-input bg-card px-3 text-sm"
        >
          <option value="">keine Angabe</option>
          <option value="w">weiblich</option>
          <option value="m">männlich</option>
          <option value="d">divers</option>
        </select>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p role="status" className="text-sm text-muted-foreground">
          {state.message}
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Speichern …"
            : defaults
              ? "Änderungen speichern"
              : "Person erfassen"}
        </Button>
      </div>
    </form>
  );
}
