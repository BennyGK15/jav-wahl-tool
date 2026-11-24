import Link from "next/link";
import { UserRound } from "lucide-react";
import { Brand } from "@/components/brand";
import {
  PhasenNav,
  type NavLink,
  type NavPhase,
} from "@/components/phasen-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { SiteFooter } from "@/components/site-footer";
import { hasPermission, isRole, ROLE_LABELS } from "@/lib/rbac";
import { bereinigeAbgelaufenes } from "@/lib/bereinigung";
import { DEV_RESET_ERLAUBT } from "@/lib/dev-reset";
import { requireSession } from "@/lib/session";
import { darfSeite, gesperrtHinweis, seiteHref } from "@/lib/ablauf";
import { loadAblauf } from "@/server/ablauf";
import { getActiveElection } from "@/server/elections";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  void bereinigeAbgelaufenes(); // höchstens stündlich, blockiert die Seite nicht
  const role = session.user.role;
  const can = (p: Parameters<typeof hasPermission>[1]) =>
    hasPermission(role, p);
  const roleLabel = isRole(role) ? ROLE_LABELS[role] : "ohne Rolle";
  const election = can("deadlines.read") ? await getActiveElection() : null;

  // Solange die Einrichtung offen ist, gibt es noch keinen verlässlichen Ablauf – nur den Assistenten zeigen
  const einrichtung = Boolean(election?.einrichtungOffen);
  const ablauf = election && !einrichtung ? await loadAblauf(election) : null;
  const base = election ? `/wahl/${election.id}` : "";

  const phasen: NavPhase[] = (ablauf?.phasen ?? []).map((p, i) => ({
    key: p.key,
    nummer: i + 1,
    label: p.label,
    kurz: p.kurz,
    status: p.status,
    seiten: p.seiten
      .filter((s) => darfSeite(role, s))
      .map((s) => ({
        href: seiteHref(base, s.pfad),
        label: s.label,
        gesperrt: gesperrtHinweis(s, ablauf!.verfuegbar),
      })),
  }));
  const extras: NavLink[] = einrichtung
    ? can("election.manage")
      ? [{ href: `${base}/einrichtung`, label: "Wahl einrichten" }]
      : []
    : election
      ? [
          { href: base, label: "Wahlkalender", exact: true },
          { href: `${base}/aushaenge`, label: "Aushänge" },
          { href: `${base}/checklisten`, label: "Checklisten" },
          ...(can("voters.edit")
            ? [{ href: `${base}/sitzung`, label: "Sitzungen" }]
            : []),
        ]
      : [];
  const verwaltung: NavLink[] = [];
  if (can("deadlines.read"))
    verwaltung.push(
      { href: "/fristen", label: "Fristenrechner", exact: true },
      { href: "/fristen/regeln", label: "Fristregeln" },
    );
  if (can("retention.execute"))
    verwaltung.push({
      href: "/aufbewahrung",
      label: "Aufbewahrung & Löschung",
    });
  if (can("users.manage"))
    verwaltung.push({ href: "/benutzer", label: "Benutzer" });
  if (can("audit.read"))
    verwaltung.push({ href: "/audit", label: "Audit-Log" });
  verwaltung.push({ href: "/datenschutz", label: "Datenschutz-Unterlagen" });
  if (DEV_RESET_ERLAUBT && can("users.manage"))
    verwaltung.push({
      href: "/entwicklung",
      label: "Neu starten (Entwicklung)",
    });

  return (
    <>
      <a
        href="#inhalt"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-card focus:p-2"
      >
        Zum Inhalt springen
      </a>
      <header className="print:hidden">
        <div className="bg-brand-yellow text-brand-ink">
          <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <Brand />
            <div className="flex items-center gap-1 text-sm">
              <span className="mr-2 hidden text-right leading-tight md:block">
                <span className="block font-semibold">
                  {session.user.displayUsername ?? session.user.username}
                </span>
                <span className="block text-xs">{roleLabel}</span>
              </span>
              <Link
                href="/konto"
                className="inline-flex h-8 items-center gap-2 rounded-sm px-3 font-semibold no-underline hover:bg-brand-ink hover:text-brand-yellow"
              >
                <UserRound aria-hidden className="size-4" />
                <span className="hidden sm:inline">Konto</span>
                <span className="sr-only sm:hidden">Mein Konto</span>
              </Link>
              <SignOutButton />
            </div>
          </div>
        </div>
        <div className="border-b bg-card">
          <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
            <PhasenNav
              start={{ href: "/", label: "Übersicht" }}
              phasen={phasen}
              extras={extras}
              verwaltung={verwaltung}
            />
          </div>
        </div>
      </header>
      <main
        id="inhalt"
        className="mx-auto w-full max-w-screen-2xl flex-1 px-4 sm:px-6 lg:px-8 py-8 sm:py-10 print:max-w-none print:p-0"
      >
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
