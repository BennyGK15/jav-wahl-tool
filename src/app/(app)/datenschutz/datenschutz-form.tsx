"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DATENSCHUTZ_FELDER, type DatenschutzAngaben } from "@/lib/datenschutz";
import { saveDatenschutzAction, type DatenschutzState } from "./actions";

export function DatenschutzForm({
  angaben,
}: Readonly<{ angaben: DatenschutzAngaben }>) {
  const [state, action, pending] = useActionState<DatenschutzState, FormData>(
    saveDatenschutzAction,
    {},
  );
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {DATENSCHUTZ_FELDER.map((f) => (
          <div key={f.key} className="grid gap-1.5">
            <Label htmlFor={`ds-${f.key}`}>{f.label}</Label>
            <Input
              id={`ds-${f.key}`}
              name={f.key}
              defaultValue={angaben[f.key] ?? ""}
              placeholder={f.vorgabe ?? f.hinweis}
              maxLength={300}
            />
            {f.vorgabe && (
              <p className="text-xs text-muted-foreground">
                Leer lassen = Vorgabe: {f.vorgabe}
              </p>
            )}
          </div>
        ))}
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-muted-foreground">
          Gespeichert – die Dokumente zeigen die neuen Angaben.
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Speichern …" : "Angaben speichern"}
        </Button>
      </div>
    </form>
  );
}
