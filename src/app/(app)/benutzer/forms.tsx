"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, ROLES } from "@/lib/rbac";
import {
  banAction,
  createUserAction,
  resetPasswordAction,
  revokeSessionsAction,
  setRoleAction,
  unbanAction,
  type UserFormState,
} from "./actions";

const initial: UserFormState = {};
const selectClass = "h-10 rounded-sm border border-input bg-card px-3 text-sm";

function Ergebnis({ state }: Readonly<{ state: UserFormState }>) {
  if (state.error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  if (!state.ok) return null;
  return (
    <div role="status" className="grid gap-1 text-sm">
      <p>{state.message}</p>
      {state.password && (
        <p className="border-l-4 border-l-foreground bg-highlight p-3">
          Startpasswort (wird nur jetzt angezeigt, bitte sicher übergeben):{" "}
          <code className="font-mono text-base font-bold select-all">
            {state.password}
          </code>
        </p>
      )}
    </div>
  );
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, initial);
  return (
    <form action={action} className="grid gap-4" autoComplete="off">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="username">Benutzername</Label>
          <Input
            id="username"
            name="username"
            required
            minLength={3}
            maxLength={64}
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required maxLength={255} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="role">Rolle</Label>
          <select
            id="role"
            name="role"
            defaultValue="mitglied"
            className={selectClass}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Ergebnis state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          Konto anlegen
        </Button>
      </div>
    </form>
  );
}

function ActionButton({
  action,
  userId,
  label,
  confirmText,
  variant = "outline",
}: Readonly<{
  action: (prev: UserFormState, fd: FormData) => Promise<UserFormState>;
  userId: string;
  label: string;
  confirmText: string;
  variant?: "outline" | "destructive" | "ghost";
}>) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
      className="grid gap-1"
    >
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {label}
      </Button>
      <Ergebnis state={state} />
    </form>
  );
}

export function UserActions({
  userId,
  name,
  banned,
  isSelf,
  role,
}: Readonly<{
  userId: string;
  name: string;
  banned: boolean;
  isSelf: boolean;
  role: string;
}>) {
  const [roleState, roleAction, rolePending] = useActionState(
    setRoleAction,
    initial,
  );
  if (isSelf)
    return <p className="text-sm text-muted-foreground">Ihr eigenes Konto</p>;
  return (
    <div className="grid gap-3">
      <form action={roleAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="userId" value={userId} />
        <select
          name="role"
          defaultValue={role}
          aria-label={`Rolle von ${name}`}
          className={selectClass}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={rolePending}
        >
          Rolle speichern
        </Button>
        <Ergebnis state={roleState} />
      </form>
      <div className="flex flex-wrap items-start gap-2">
        <ActionButton
          action={resetPasswordAction}
          userId={userId}
          label="Passwort zurücksetzen"
          confirmText={`Für ${name} ein neues Startpasswort vergeben?`}
        />
        <ActionButton
          action={revokeSessionsAction}
          userId={userId}
          label="Abmelden erzwingen"
          confirmText={`Alle Sitzungen von ${name} beenden?`}
        />
        {banned ? (
          <ActionButton
            action={unbanAction}
            userId={userId}
            label="Entsperren"
            confirmText={`${name} entsperren?`}
          />
        ) : (
          <ActionButton
            action={banAction}
            userId={userId}
            label="Sperren"
            variant="destructive"
            confirmText={`${name} sperren? Alle Sitzungen werden beendet.`}
          />
        )}
      </div>
    </div>
  );
}
