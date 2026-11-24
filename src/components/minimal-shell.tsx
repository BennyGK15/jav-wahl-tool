import type { ReactNode } from "react";
import { Brand } from "./brand";
import { SiteFooter } from "./site-footer";

/** Schlanker Rahmen für Seiten ohne Navigation (Login, Passwortwechsel). */
export function MinimalShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <header className="bg-brand-yellow">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center px-4 sm:px-6 lg:px-8">
          <Brand />
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-20">
        {children}
      </main>
      <SiteFooter oeffentlich />
    </>
  );
}
