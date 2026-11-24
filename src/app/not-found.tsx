import Link from "next/link";
import { MinimalShell } from "@/components/minimal-shell";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Seite nicht gefunden" };

export default function NotFound() {
  return (
    <MinimalShell>
      <div className="grid w-full max-w-xl gap-4">
        <p className="text-sm font-semibold text-muted-foreground">
          Fehler 404
        </p>
        <h1 className="text-4xl">Seite nicht gefunden</h1>
        <p className="text-muted-foreground">
          Die Seite existiert nicht oder Sie haben keine Berechtigung dafür.
          Bereiche wie das Wählerverzeichnis stehen nur bestimmten Rollen zur
          Verfügung.
        </p>
        <div>
          <Button asChild>
            <Link href="/">Zur Übersicht</Link>
          </Button>
        </div>
      </div>
    </MinimalShell>
  );
}
