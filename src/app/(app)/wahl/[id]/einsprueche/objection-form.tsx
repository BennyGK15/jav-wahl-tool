"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createObjectionAction, type ObjectionFormState } from "./actions";

const initial: ObjectionFormState = {};

export function ObjectionForm({
  electionId,
  persons,
  defaultEingang,
}: Readonly<{
  electionId: string;
  persons: { id: string; label: string }[];
  defaultEingang: string;
}>) {
  const [state, formAction, pending] = useActionState(
    createObjectionAction,
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-4"
      autoComplete="off"
    >
      <input type="hidden" name="electionId" value={electionId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="eingangAm">Eingang beim Wahlvorstand</Label>
          <Input
            id="eingangAm"
            name="eingangAm"
            type="datetime-local"
            required
            defaultValue={defaultEingang}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="voterId">
            Betroffene Person (falls bereits erfasst)
          </Label>
          <select
            id="voterId"
            name="voterId"
            defaultValue=""
            className="h-9 rounded-sm border border-input bg-card px-3 text-sm"
          >
            <option value="">– nicht im Verzeichnis / mehrere –</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="begruendung">Einspruchsführer/in und Inhalt</Label>
        <textarea
          id="begruendung"
          name="begruendung"
          required
          minLength={5}
          maxLength={4000}
          rows={3}
          className="rounded-sm border border-input bg-card px-3 py-2 text-sm"
          placeholder="z. B. „Max Muster: Azubi seit 01.09., fehlt im Verzeichnis“"
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-muted-foreground">
          Einspruch erfasst.
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Speichern …" : "Einspruch erfassen"}
        </Button>
      </div>
    </form>
  );
}
