import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  computeSchedule,
  EMPFEHLUNGEN,
  holidaysBW,
  RECHTSSTAND,
} from "@/lib/fristen";
import { formatIsoDate } from "@/lib/utils";

export const metadata = { title: "Fristenrechner" };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const params = z.object({
  wahltag: isoDate.optional(),
  ausschreiben: isoDate.optional(),
});

export default async function FristenPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const parsed = params.safeParse(await searchParams);
  const wahltag = parsed.success ? parsed.data.wahltag : undefined;
  const ausschreiben = parsed.success ? parsed.data.ausschreiben : undefined;

  let schedule: ReturnType<typeof computeSchedule> | null = null;
  let error: string | null = null;
  if (wahltag) {
    try {
      schedule = computeSchedule(wahltag, undefined, {
        wahlausschreibenAm: ausschreiben,
      });
    } catch (e) {
      error = e instanceof Error ? e.message : "Berechnung nicht möglich";
    }
  }
  const years = wahltag
    ? [Number(wahltag.slice(0, 4)) - 1, Number(wahltag.slice(0, 4))]
    : [];
  const holidays = years.flatMap((y) => holidaysBW(y));

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl">Fristenrechner</h1>
        <p className="text-muted-foreground">
          Unverbindliche Vorschau für das reguläre Verfahren. Für die echte Wahl
          den gespeicherten Wahlkalender nutzen.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-4" method="get">
            <div className="grid gap-2">
              <Label htmlFor="wahltag">Erster Wahltag</Label>
              <Input
                id="wahltag"
                name="wahltag"
                type="date"
                defaultValue={wahltag}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ausschreiben">
                Wahlausschreiben tatsächlich am (optional)
              </Label>
              <Input
                id="ausschreiben"
                name="ausschreiben"
                type="date"
                defaultValue={ausschreiben}
              />
            </div>
            <Button type="submit">Berechnen</Button>
          </form>
        </CardContent>
      </Card>

      <div
        role="note"
        className="rounded-md border border-l-4 border-l-foreground border-y-0 border-r-0 bg-highlight p-4 text-sm text-foreground"
      >
        Die Standardfristen sind mit dem amtlichen Text abgeglichen (
        {RECHTSSTAND.lpvgwo}; {RECHTSSTAND.lpvg}). Als „Empfehlung“ markierte
        Termine sind gesetzlich nicht vorgeschrieben. Bei einer Rechtsänderung
        oder eigenen Anpassungen bitte erneut prüfen.
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {schedule && (
        <Card>
          <CardHeader>
            <CardTitle>
              Wahlkalender für den {formatIsoDate(wahltag!)}
            </CardTitle>
            <CardDescription>
              Arbeitstage: Mo–Fr ohne Feiertage BW, ohne 24.12. und 31.12.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Datum</th>
                  <th className="py-2 pr-4 font-medium">Schritt</th>
                  <th className="py-2 pr-4 font-medium">Rechtsgrundlage</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...schedule,
                  {
                    key: "wahltag",
                    label: "Erster Wahltag",
                    date: wahltag!,
                    legalBasis: "",
                    verified: true,
                    isWahltag: true,
                  },
                ]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((e) => (
                    <tr
                      key={e.key}
                      className={
                        "isWahltag" in e ? "border-t font-medium" : "border-t"
                      }
                    >
                      <td className="py-2 pr-4 whitespace-nowrap tabular-nums">
                        {formatIsoDate(e.date)}
                      </td>
                      <td className="py-2 pr-4">{e.label}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {e.legalBasis}
                      </td>
                      <td className="py-2">
                        {"isWahltag" in e ? null : e.verified ? (
                          <Badge variant="secondary">geprüft</Badge>
                        ) : EMPFEHLUNGEN.includes(e.key) ? (
                          <Badge variant="outline">Empfehlung</Badge>
                        ) : (
                          <Badge variant="warning">ungeprüft</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {holidays.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Berücksichtigte Feiertage BW ({years.join(", ")})
          </summary>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {holidays.map((h) => (
              <li key={h.date} className="tabular-nums">
                {formatIsoDate(h.date)} – {h.name}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
