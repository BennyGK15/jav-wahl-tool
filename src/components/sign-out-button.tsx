"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-brand-ink hover:bg-brand-ink hover:text-brand-yellow"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await authClient.signOut();
          router.replace("/login?abgemeldet=1");
          router.refresh();
        })
      }
    >
      <LogOut aria-hidden />
      <span className="hidden sm:inline">Abmelden</span>
      <span className="sr-only sm:hidden">Abmelden</span>
    </Button>
  );
}
