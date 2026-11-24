"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WahlvorstandMitglied } from "@/lib/wahlausschreiben";
import { saveWahlvorstandAction, type WahlvorstandState } from "./actions";

const ZEILEN = 7;
const selectClass = "h-9 rounded-sm border border-input bg-card px-2 text-sm";

export function WahlvorstandForm({ electionId, liste, bestelltAm }: { electionId: string; liste: WahlvorstandMitglied[]; bestelltAm: string | null }) {
  const [state, action, pending] = useActionState<WahlvorstandState, FormData>(saveWahlvorstandAction, {});
  return (
    <form action={action} className="grid gap-4" autoComplete="off">
      <input type="hidden" name="electionId" value={electionId} />
      <div className="grid max-w-xs gap-2">
        <Label htmlFor="bestelltAm">Vom Personalrat bestimmt am</Label>
        <Input id="bestelltAm" name="bestelltAm" type="date" defaultValue={bestelltAm ?? ""} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 font-medium">Name, Vorname</th>
              <th className="py-2 pr-3 font-medium">Funktion</th>
              <th className="py-2 pr-3 font-medium">Ersatzmitglieder (in Reihenfolge)</th>
              <th className="py-2 font-medium">in den PR wählbar</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ZEILEN }, (_, i) => {
              const m = liste[i];
              return (
                <tr key={i} className="border-t">
                  <td className="py-2 pr-3">
                    <Input name={`name_${i}`} defaultValue={m?.name ?? ""} maxLength={120} aria-label={`Name Mitglied ${i + 1}`} />
                  </td>
                  <td className="py-2 pr-3">
                    <select name={`funktion_${i}`} defaultValue={m?.funktion ?? (i === 0 ? "vorsitz" : i === 1 ? "stellvertretung" : "mitglied")} className={selectClass} aria-label={`Funktion Mitglied ${i + 1}`}>
                      <option value="vorsitz">Vorsitz</option>
                      <option value="stellvertretung">Stellvertretender Vorsitz</option>
                      <option value="mitglied">Mitglied</option>
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <Input name={`ersatz_${i}`} defaultValue={m?.ersatz ?? ""} maxLength={250} placeholder="z. B. Name A, Name B" aria-label={`Ersatzmitglieder für Mitglied ${i + 1}`} />
                  </td>
                  <td className="py-2 text-center">
                    <input type="checkbox" name={`pr_${i}`} defaultChecked={m?.prWaehlbar ?? false} aria-label={`Mitglied ${i + 1} nach § 9 LPVG wählbar`} className="size-4" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-muted-foreground">
          Gespeichert.
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Speichern …" : "Wahlvorstand speichern"}
        </Button>
      </div>
    </form>
  );
}
