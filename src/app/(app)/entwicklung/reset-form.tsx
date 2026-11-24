"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { devResetAction, type ResetState } from "./actions";

export function ResetForm({
  bestaetigung,
}: Readonly<{ bestaetigung: string }>) {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    devResetAction,
    {},
  );
  return (
    <form action={action} className="grid gap-4">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="datenschutz"
          defaultChecked
          className="mt-1"
        />
        <span>
          Auch die Datenschutz-Angaben und -Aufgaben zurücksetzen{" "}
          <span className="block text-xs text-muted-foreground">
            Dann fragt der Einrichtungsassistent sie wie bei einer neuen
            Installation ab.
          </span>
        </span>
      </label>
      <div className="grid max-w-sm gap-1.5">
        <Label htmlFor="bestaetigung">
          Zur Bestätigung „{bestaetigung}“ eingeben
        </Label>
        <Input
          id="bestaetigung"
          name="bestaetigung"
          autoComplete="off"
          required
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Wird zurückgesetzt …" : "Umgebung neu starten"}
        </Button>
      </div>
    </form>
  );
}
