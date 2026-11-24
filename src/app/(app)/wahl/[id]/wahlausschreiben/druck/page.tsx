import Link from "next/link";
import { Briefkopf, DokFuss } from "@/components/dokument";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { WahlausschreibenDokument } from "@/components/wahlausschreiben-dokument";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { buildWahlausschreiben } from "@/server/wahlausschreiben";

export const metadata = { title: "Wahlausschreiben – Druck" };

export default async function WahlausschreibenDruckPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "deadlines.read")) notFound();

  const { id } = await params;
  const election = await prisma.election.findUnique({ where: { id }, select: { id: true } });
  if (!election) notFound();

  const [{ view, fehlend, sha256 }, latest] = await Promise.all([
    buildWahlausschreiben(id),
    prisma.document.findFirst({ where: { electionId: id, typ: "wahlausschreiben" }, orderBy: { version: "desc" } }),
  ]);
  const freigegeben = latest?.sha256 === sha256;
  await writeAudit({ userId: session.user.id, action: "wahlausschreiben.printed", objectType: "election", objectId: id });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <p className="text-sm text-muted-foreground">
          <Link href={`/wahl/${id}/wahlausschreiben`} className="hover:underline">
            Wahlausschreiben
          </Link>{" "}
          / Druckansicht
        </p>
        <PrintButton />
      </div>
      {(!freigegeben || fehlend.length > 0) && (
        <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive print:hidden">
          {fehlend.length > 0 ? "Es fehlen noch Angaben (rot markiert). " : ""}
          {freigegeben ? "" : "Dieser Stand ist nicht freigegeben – bitte nicht aushängen."}
        </p>
      )}
      <DokFuss text={`JAV-Wahl ${view.dienststelle} · Wahlausschreiben`} />
      <div className="dok mx-auto w-full max-w-3xl print:max-w-none">
        <Briefkopf dienststelle={view.dienststelle} art="Wahlausschreiben" datum={view.erlassAm ? `${view.ausstellungsort ? `${view.ausstellungsort}, ` : ""}${view.erlassAm}` : null} />
        <WahlausschreibenDokument v={view} />
        <p className="mt-6 text-[10px] text-muted-foreground">
          {freigegeben && latest ? `Version ${latest.version} · Prüfsumme ${sha256.slice(0, 16)}` : `Entwurf · Prüfsumme ${sha256.slice(0, 16)}`}
        </p>
      </div>
    </div>
  );
}
