import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBerlinDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { hasPermission, isRole, ROLE_LABELS } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { CreateUserForm, UserActions } from "./forms";

export const metadata = { title: "Benutzer" };

export default async function BenutzerPage() {
  const session = await requireSession();
  if (!hasPermission(session.user.role, "users.manage")) notFound();

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      username: true,
      displayUsername: true,
      role: true,
      banned: true,
      banReason: true,
      banExpires: true,
      mustChangePassword: true,
      twoFactorEnabled: true,
      createdAt: true,
      sessions: {
        select: { updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });
  const jetzt = new Date();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl">Benutzerverwaltung</h1>
        <p className="max-w-3xl text-muted-foreground">
          Konten werden nur hier angelegt – es gibt keine Selbstregistrierung.
          Startpasswörter werden einmal angezeigt und müssen bei der ersten
          Anmeldung geändert werden. Nach 5 Fehlversuchen sperrt sich ein Konto
          für 15 Minuten selbst.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Neues Konto</CardTitle>
          <CardDescription>
            Rollen: Vorsitz und Mitglieder des Wahlvorstands, Wahlhelfer (nur
            Wahltag), Administration (nur Technik, keine Wahldaten).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateUserForm />
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {users.map((u) => {
          const gesperrt = Boolean(
            u.banned && (!u.banExpires || u.banExpires > jetzt),
          );
          const letzte = u.sessions[0]?.updatedAt;
          return (
            <Card key={u.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{u.name}</CardTitle>
                  <Badge variant="secondary">
                    {isRole(u.role)
                      ? ROLE_LABELS[u.role]
                      : (u.role ?? "ohne Rolle")}
                  </Badge>
                  {gesperrt && (
                    <Badge
                      variant="outline"
                      className="border-destructive text-destructive"
                    >
                      gesperrt
                      {u.banExpires
                        ? ` bis ${formatBerlinDateTime(u.banExpires)}`
                        : ""}
                    </Badge>
                  )}
                  {u.mustChangePassword && (
                    <Badge variant="warning">Startpasswort</Badge>
                  )}
                  {u.twoFactorEnabled && <Badge variant="success">2FA</Badge>}
                </div>
                <CardDescription>
                  {u.displayUsername ?? u.username} · angelegt{" "}
                  {formatBerlinDateTime(u.createdAt)}
                  {letzte
                    ? ` · zuletzt aktiv ${formatBerlinDateTime(letzte)}`
                    : ""}
                  {gesperrt && u.banReason ? ` · ${u.banReason}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UserActions
                  userId={u.id}
                  name={u.name}
                  banned={gesperrt}
                  isSelf={u.id === session.user.id}
                  role={u.role ?? "mitglied"}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
