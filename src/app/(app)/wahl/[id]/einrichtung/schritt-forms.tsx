"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrtFeld } from "@/lib/einrichtung";
import {
  abschliessenAction,
  saveOrteAction,
  saveStuetzAction,
  type EinrichtungState,
} from "./actions";

function Meldung({
  state,
  ok,
}: Readonly<{ state: EinrichtungState; ok: string }>) {
  if (state.error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {ok}
      </p>
    );
  return null;
}

export function OrteForm({
  electionId,
  felder,
  werte,
}: Readonly<{
  electionId: string;
  felder: OrtFeld[];
  werte: Record<string, string>;
}>) {
  const [state, action, pending] = useActionState<EinrichtungState, FormData>(
    saveOrteAction,
    {},
  );
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="electionId" value={electionId} />
      <div className="grid gap-4 sm:grid-cols-2">
        {felder.map((f) => (
          <div
            key={f.key}
            className={
              f.typ === "lang" ? "grid gap-1.5 sm:col-span-2" : "grid gap-1.5"
            }
          >
            <Label htmlFor={`e-${f.key}`}>
              {f.label}
              {f.pflicht && <span aria-hidden> *</span>}
            </Label>
            {f.typ === "lang" ? (
              <textarea
                id={`e-${f.key}`}
                name={f.key}
                defaultValue={werte[f.key] ?? ""}
                rows={3}
                maxLength={1000}
                className="rounded-sm border border-input bg-card px-3 py-2 text-sm"
              />
            ) : (
              <Input
                id={`e-${f.key}`}
                name={f.key}
                type={f.typ === "zeit" ? "time" : "text"}
                defaultValue={werte[f.key] ?? ""}
                required={f.pflicht}
                maxLength={300}
              />
            )}
            {f.hinweis && (
              <p className="text-xs text-muted-foreground">{f.hinweis}</p>
            )}
          </div>
        ))}
      </div>
      <Meldung state={state} ok="Gespeichert." />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Speichern …" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}

export function StuetzForm({
  electionId,
  wert,
  vorschlag,
}: Readonly<{ electionId: string; wert: number | null; vorschlag: number }>) {
  const [state, action, pending] = useActionState<EinrichtungState, FormData>(
    saveStuetzAction,
    {},
  );
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="electionId" value={electionId} />
      <div className="grid max-w-xs gap-1.5">
        <Label htmlFor="e-min">Mindestzahl Stützunterschriften *</Label>
        <Input
          id="e-min"
          name="min"
          type="number"
          min={0}
          max={50}
          required
          defaultValue={wert ?? vorschlag}
        />
      </div>
      <Meldung state={state} ok="Gespeichert." />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Speichern …" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}

export function AbschlussForm({
  electionId,
  bereit,
}: Readonly<{ electionId: string; bereit: boolean }>) {
  const [state, action, pending] = useActionState<EinrichtungState, FormData>(
    abschliessenAction,
    {},
  );
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="electionId" value={electionId} />
      <Meldung state={state} ok="" />
      <div>
        <Button
          type="submit"
          size="lg"
          variant="accent"
          disabled={!bereit || pending}
        >
          {pending
            ? "Wird freigeschaltet …"
            : "Einrichtung abschließen und Wahlkalender freischalten"}
        </Button>
      </div>
    </form>
  );
}
