"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction, type ChangePasswordState } from "./actions";

const initial: ChangePasswordState = { ok: false };

export function PasswordForm({ forced }: Readonly<{ forced: boolean }>) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initial,
  );

  useEffect(() => {
    if (state.ok) {
      router.replace("/");
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Passwort ändern</CardTitle>
        <CardDescription>
          {forced
            ? "Bitte vergib vor der ersten Nutzung ein eigenes Passwort (mindestens 12 Zeichen)."
            : "Mindestens 12 Zeichen. Andere Sitzungen werden danach abgemeldet."}
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newPassword">Neues Passwort</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Neues Passwort wiederholen</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </div>
          {state.message && !state.ok && (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Speichern …" : "Passwort speichern"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
