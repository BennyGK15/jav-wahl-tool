import { MinimalShell } from "@/components/minimal-shell";
import { requireSession } from "@/lib/session";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Passwort ändern" };

export default async function PasswortPage() {
  const session = await requireSession({ allowPasswordChangePending: true });
  return (
    <MinimalShell>
      <PasswordForm forced={Boolean(session.user.mustChangePassword)} />
    </MinimalShell>
  );
}
