import Link from "next/link";
import { notFound } from "next/navigation";
import { DruckRahmen } from "@/components/druck-rahmen";
import { NochNichtVerfuegbar } from "@/components/noch-nicht-verfuegbar";
import { writeAudit } from "@/lib/audit";
import { decrypt } from "@/lib/crypto";
import { formatBerlinDateTime, todayBerlin } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { formatIsoDate } from "@/lib/utils";
import { parseAngaben } from "@/lib/wahlausschreiben";

export const metadata = { title: "Entscheidung über einen Einspruch" };

/**
 * Schriftliche Mitteilung der Entscheidung über einen Einspruch gegen das Wählerverzeichnis –
 * an die einspruchsführende und an die betroffene Person (§ 6 Abs. 6 LPVGWO).
 * Das Schreiben an die betroffene Person enthält den Einspruchstext bewusst nicht (Datenminimierung).
 */
export default async function EinspruchBescheidPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; oid: string }>;
  searchParams: Promise<{ an?: string }>;
}) {
  const session = await requireSession();
  if (
    !hasPermission(session.user.role, "voters.edit") ||
    !hasPermission(session.user.role, "voters.sensitive.read")
  )
    notFound();
  const { id, oid } = await params;
  const an =
    (await searchParams).an === "betroffen" ? "betroffen" : "einspruch";
  const o = await prisma.objection.findFirst({
    where: { id: oid, electionId: id },
    include: { voter: true, election: true },
  });
  if (!o) notFound();
  if (o.entscheidung === "offen") {
    return (
      <NochNichtVerfuegbar
        titel="Entscheidung über einen Einspruch"
        text="Über diesen Einspruch ist noch nicht entschieden. Das Schreiben steht bereit, sobald die Entscheidung gespeichert ist."
        ziel={{ href: `/wahl/${id}/einsprueche`, label: "Zu den Einsprüchen" }}
      />
    );
  }
  const grund = o.entscheidungsgrundEnc
    ? decrypt(o.entscheidungsgrundEnc, `objection:${o.id}:grund`)
    : "";
  await writeAudit({
    userId: session.user.id,
    action: "objection.letter",
    objectType: "objection",
    objectId: o.id,
    fields: [an, "entscheidungsgrund"],
  });

  const a = parseAngaben(o.election.wahlausschreibenAngaben);
  const datum = `${a.ausstellungsort ? `${a.ausstellungsort}, ` : ""}${formatIsoDate(todayBerlin())}`;
  const person = o.voter
    ? `${o.voter.vorname} ${o.voter.nachname} (lfd. Nr. ${o.voter.lfdNr})`
    : null;
  const stattgegeben = o.entscheidung === "stattgegeben";

  return (
    <DruckRahmen
      zurueck={{ href: `/wahl/${id}/einsprueche`, label: "Einsprüche" }}
      titel="Entscheidung über einen Einspruch"
      entwurf={false}
      kopf={{
        dienststelle: o.election.dienststelle,
        art: "Entscheidung",
        datum,
      }}
      hinweis={
        <>
          Unverzüglich, spätestens am Arbeitstag vor dem Wahltag schriftlich
          mitteilen (§ 6 Abs. 6 LPVGWO).{" "}
          {o.voter ? (
            <Link
              href={`?an=${an === "einspruch" ? "betroffen" : "einspruch"}`}
              className="underline"
            >
              {an === "einspruch"
                ? "Schreiben an die betroffene Person"
                : "Schreiben an die einspruchsführende Person"}
            </Link>
          ) : (
            "Keine betroffene Person zugeordnet – nur das Schreiben an die einspruchsführende Person."
          )}
        </>
      }
    >
      <article className="grid gap-4 text-sm leading-relaxed">
        <p>
          An
          <br />
          {an === "betroffen" && o.voter ? (
            <strong>
              {o.voter.vorname} {o.voter.nachname}
            </strong>
          ) : (
            "______________________________"
          )}
          <br />
          ______________________________
          <br />
          ______________________________
        </p>
        <h1 className="mt-4 text-lg font-bold">
          Entscheidung über einen Einspruch gegen das Wählerverzeichnis
        </h1>
        <p>
          Wahl der Jugend- und Auszubildendenvertretung bei{" "}
          {o.election.dienststelle}
        </p>

        {an === "einspruch" ? (
          <p>
            Ihren Einspruch vom {formatBerlinDateTime(o.eingangAm)} Uhr gegen
            die Richtigkeit des Wählerverzeichnisses
            {person ? `, der den Eintrag von ${person} betrifft,` : ""} hat der
            Wahlvorstand geprüft (§ 6 Abs. 5 und 6 LPVGWO).
          </p>
        ) : (
          <p>
            gegen die Richtigkeit des Wählerverzeichnisses ist am{" "}
            {formatBerlinDateTime(o.eingangAm)} Uhr ein Einspruch eingegangen,
            der Ihren Eintrag ({person}) betrifft. Der Wahlvorstand hat darüber
            entschieden (§ 6 Abs. 6 LPVGWO).
          </p>
        )}

        <p className="font-semibold">
          Entscheidung: Dem Einspruch wird{" "}
          {stattgegeben
            ? "stattgegeben"
            : "nicht stattgegeben; er wird zurückgewiesen"}
          .
        </p>
        {stattgegeben && (
          <p>
            Das Wählerverzeichnis wird entsprechend berichtigt (§ 6 Abs. 6 Satz
            3 LPVGWO).
          </p>
        )}
        <p className="font-semibold">Gründe:</p>
        <p className="whitespace-pre-line">
          {grund || "[Begründung eintragen]"}
        </p>

        <div className="unterschrift mt-10 grid w-64 gap-1">
          <span className="border-t border-black pt-1">
            Vorsitz des Wahlvorstands
          </span>
        </div>
      </article>
    </DruckRahmen>
  );
}
