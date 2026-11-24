"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createNominationAction, updateNominationMetaAction, type NominationFormState } from "./actions";

const initial: NominationFormState = {};

export interface NominationDefaults {
  nominationId: string;
  kennwort: string | null;
  einreicherArt: "beschaeftigte" | "gewerkschaft";
  gewerkschaft: string | null;
  eingangAm: string; // "YYYY-MM-DDTHH:MM"
}

export function NominationForm({
  electionId,
  defaults,
  defaultEingang,
  disabled = false,
}: {
  electionId: string;
  defaults?: NominationDefaults;
  defaultEingang?: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(defaults ? updateNominationMetaAction : createNominationAction, initial);
  const [art, setArt] = useState<"beschaeftigte" | "gewerkschaft">(defaults?.einreicherArt ?? "beschaeftigte");

  return (
    <form action={formAction} className="grid gap-4" autoComplete="off">
      <input type="hidden" name="electionId" value={electionId} />
      {defaults && <input type="hidden" name="nominationId" value={defaults.nominationId} />}
      <fieldset disabled={disabled} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="eingangAm">Eingang beim Wahlvorstand</Label>
            <Input id="eingangAm" name="eingangAm" type="datetime-local" required defaultValue={defaults?.eingangAm ?? defaultEingang} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="kennwort">Kennwort (optional)</Label>
            <Input id="kennwort" name="kennwort" maxLength={120} defaultValue={defaults?.kennwort ?? ""} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="einreicherArt">Eingereicht von</Label>
            <select
              id="einreicherArt"
              name="einreicherArt"
              value={art}
              onChange={(e) => setArt(e.target.value as typeof art)}
              className="h-9 rounded-sm border border-input bg-card px-3 text-sm"
            >
              <option value="beschaeftigte">Wahlberechtigten Beschäftigten</option>
              <option value="gewerkschaft">einer in der Dienststelle vertretenen Gewerkschaft</option>
            </select>
          </div>
          {art === "gewerkschaft" && (
            <div className="grid gap-2">
              <Label htmlFor="gewerkschaft">Gewerkschaft</Label>
              <Input id="gewerkschaft" name="gewerkschaft" required maxLength={120} defaultValue={defaults?.gewerkschaft ?? ""} />
            </div>
          )}
        </div>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <div>
          <Button type="submit" disabled={pending || disabled}>
            {pending ? "Speichern …" : defaults ? "Angaben speichern" : "Wahlvorschlag anlegen"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
