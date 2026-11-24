"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ANMERKUNG_MAX } from "@/lib/datenschutz";
import { einreichenAction, type EinreichungState } from "./actions";

export function EinreichungForm({
  erneut,
  vollstaendig,
}: {
  erneut: boolean;
  vollstaendig: boolean;
}) {
  const [state, action, pending] = useActionState<EinreichungState, FormData>(
    einreichenAction,
    {},
  );
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="ds-anmerkung">
          Anmerkung für den Wahlvorstand (optional)
        </Label>
        <textarea
          id="ds-anmerkung"
          name="anmerkung"
          rows={3}
          maxLength={ANMERKUNG_MAX}
          className="rounded-sm border border-input bg-card px-3 py-2 text-sm"
          placeholder="z. B. Auflagen, offene Punkte oder Hinweise zur Datensicherung"
        />
      </div>
      {!vollstaendig && (
        <p className="text-sm text-muted-foreground">
          Einreichen ist möglich, sobald alle Angaben unten ausgefüllt und
          gespeichert sind.
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-muted-foreground">
          Eingereicht – der Wahlvorstand sieht jetzt den Stand.
        </p>
      )}
      <div>
        <Button
          type="submit"
          variant="accent"
          disabled={pending || !vollstaendig}
        >
          {pending
            ? "Einreichen …"
            : erneut
              ? "Erneut einreichen"
              : "Unterlagen einreichen"}
        </Button>
      </div>
    </form>
  );
}
