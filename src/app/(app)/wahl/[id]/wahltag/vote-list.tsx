"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  briefwahlStepAction,
  markVotedAction,
  undoVotedAction,
  type VoteResult,
} from "./actions";

export interface VoteRow {
  id: string;
  lfdNr: number;
  nachname: string;
  vorname: string;
  votedAt: string | null; // bereits formatiert
  art: "urne" | "brief" | null;
  briefBeantragt: boolean;
  briefVersandt: boolean;
  briefEingegangen: boolean;
}

type Filter = "alle" | "offen" | "gewaehlt" | "brief";
const FILTER: Record<Filter, string> = {
  alle: "Alle",
  offen: "Noch nicht gewählt",
  gewaehlt: "Gewählt",
  brief: "Briefwahl",
};

export function VoteList({
  rows,
  canCorrect,
}: Readonly<{ rows: VoteRow[]; canCorrect: boolean }>) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("offen");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "offen" && r.votedAt) return false;
      if (filter === "gewaehlt" && !r.votedAt) return false;
      if (filter === "brief" && !r.briefBeantragt) return false;
      if (!q) return true;
      return (
        String(r.lfdNr) === q ||
        `${r.nachname} ${r.vorname}`.toLowerCase().includes(q) ||
        `${r.vorname} ${r.nachname}`.toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  function run(id: string, label: string, fn: () => Promise<VoteResult>) {
    setPendingId(id);
    startTransition(async () => {
      const res = await fn();
      setMessage({
        ok: res.ok,
        text: res.ok ? label : (res.message ?? "Fehler"),
      });
      setPendingId(null);
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name oder Nr. suchen …"
          aria-label="Suchen"
          className="max-w-xs"
          autoFocus
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter">
          {(Object.keys(FILTER) as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                "rounded-md px-3 py-1 text-sm",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {FILTER[f]}
            </button>
          ))}
        </div>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={cn(
          "min-h-5 text-sm",
          message?.ok === false ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {message?.text}
      </p>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Einträge.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Nr.</th>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Briefwahl</th>
                <th className="py-2 font-medium">Stimmabgabe</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const busy = pendingId === r.id;
                const name = `${r.vorname} ${r.nachname}`;
                return (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 pr-4 tabular-nums">{r.lfdNr}</td>
                    <td className="py-2 pr-4 font-medium">
                      {r.nachname}, {r.vorname}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap items-center gap-1">
                        {(
                          [
                            ["beantragt", r.briefBeantragt, "Antrag"],
                            ["versandt", r.briefVersandt, "Versand"],
                            ["eingegangen", r.briefEingegangen, "Wahlbrief da"],
                          ] as const
                        ).map(([step, done, label]) =>
                          canCorrect ? (
                            <Button
                              key={step}
                              size="sm"
                              variant={done ? "secondary" : "ghost"}
                              disabled={busy || Boolean(r.votedAt)}
                              onClick={() =>
                                run(
                                  r.id,
                                  `${name}: ${label} ${done ? "zurückgenommen" : "erfasst"}.`,
                                  () => briefwahlStepAction(r.id, step),
                                )
                              }
                              aria-pressed={done}
                            >
                              {done ? "✓ " : ""}
                              {label}
                            </Button>
                          ) : done ? (
                            <Badge key={step} variant="secondary">
                              {label}
                            </Badge>
                          ) : null,
                        )}
                      </div>
                    </td>
                    <td className="py-2">
                      {r.votedAt ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">
                            gewählt{r.art === "brief" ? " (Brief)" : ""} ·{" "}
                            {r.votedAt}
                          </Badge>
                          {canCorrect && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Vermerk bei ${name} wirklich zurücknehmen? Nur bei Fehleingabe.`,
                                  )
                                ) {
                                  run(
                                    r.id,
                                    `Vermerk bei ${name} zurückgenommen.`,
                                    () => undoVotedAction(r.id),
                                  );
                                }
                              }}
                            >
                              Korrigieren
                            </Button>
                          )}
                        </div>
                      ) : r.briefEingegangen ? (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            run(r.id, `${name}: Briefwahl vermerkt.`, () =>
                              markVotedAction(r.id, "brief"),
                            )
                          }
                        >
                          Wahlbrief vermerken
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={busy || r.briefVersandt}
                          title={
                            r.briefVersandt
                              ? "Briefwahlunterlagen wurden versandt"
                              : undefined
                          }
                          onClick={() =>
                            run(r.id, `${name}: Stimmabgabe vermerkt.`, () =>
                              markVotedAction(r.id, "urne"),
                            )
                          }
                        >
                          {busy ? "…" : "Hat gewählt"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
