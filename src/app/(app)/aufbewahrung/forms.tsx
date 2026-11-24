"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  closeElectionAction,
  deleteElectionAction,
  setAnfechtungAction,
  setRetentionAction,
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

export function RetentionForm({
  electionId,
  value,
  vorschlag,
}: Readonly<{
  electionId: string;
  value: string | null;
  vorschlag?: string | null;
}>) {
  const [state, action, pending] = useActionState(setRetentionAction, initial);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="electionId" value={electionId} />
      <Label htmlFor={`ret-${electionId}`}>Aufbewahren bis</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={`ret-${electionId}`}
          name="retentionUntil"
          type="date"
          required
          defaultValue={value ?? vorschlag ?? ""}
          min={vorschlag ?? undefined}
          className="w-44"
        />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Speichern
        </Button>
      </div>
      <Meldung state={state} />
    </form>
  );
}

export function CloseForm({ electionId }: Readonly<{ electionId: string }>) {
  const [state, action, pending] = useActionState(closeElectionAction, initial);
  return (
    <form
      action={action}
      className="grid gap-2"
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Wahl abschließen? Danach kann eine neue Wahl angelegt werden.",
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="electionId" value={electionId} />
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Wahl abschließen
        </Button>
      </div>
      <Meldung state={state} />
    </form>
  );
}

export function DeleteForm({
  electionId,
  dienststelle,
}: Readonly<{ electionId: string; dienststelle: string }>) {
  const [state, action, pending] = useActionState(
    deleteElectionAction,
    initial,
  );
  return (
    <form
      action={action}
      className="grid gap-2 rounded-md border border-destructive/40 p-4"
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Alle Daten dieser Wahl endgültig löschen? Das kann nicht rückgängig gemacht werden.",
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="electionId" value={electionId} />
      <Label htmlFor={`del-${electionId}`}>
        Zur Bestätigung den Namen der Dienststelle eingeben:{" "}
        <span className="font-semibold">{dienststelle}</span>
      </Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={`del-${electionId}`}
          name="bestaetigung"
          required
          autoComplete="off"
          className="max-w-sm"
        />
        <Button
          type="submit"
          size="sm"
          variant="destructive"
          disabled={pending}
        >
          Endgültig löschen
        </Button>
      </div>
      <Meldung state={state} />
    </form>
  );
}

export function AnfechtungForm({
  electionId,
  am,
  erledigtAm,
}: Readonly<{
  electionId: string;
  am: string | null;
  erledigtAm: string | null;
}>) {
  const [state, action, pending] = useActionState(setAnfechtungAction, initial);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="electionId" value={electionId} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor={`anf-${electionId}`}>
            Wahl angefochten (Kenntnis am)
          </Label>
          <Input
            id={`anf-${electionId}`}
            name="anfechtungAm"
            type="date"
            defaultValue={am ?? ""}
            className="w-44"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`anf-erl-${electionId}`}>
            Verfahren rechtskräftig abgeschlossen am
          </Label>
          <Input
            id={`anf-erl-${electionId}`}
            name="anfechtungErledigtAm"
            type="date"
            defaultValue={erledigtAm ?? ""}
            className="w-44"
          />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Speichern
        </Button>
      </div>
      <Meldung state={state} />
    </form>
  );
}
