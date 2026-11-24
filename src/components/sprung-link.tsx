"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Link zu einer Stelle: bei „#id“ auf derselben Seite wird gescrollt und das Feld fokussiert,
 * sonst normal navigiert (das Ziel wird per :target hervorgehoben).
 */
export function SprungLink({ href, children }: { href: string; children: ReactNode }) {
  if (href.startsWith("#")) {
    return (
      <a
        href={href}
        className="underline decoration-1 underline-offset-4 hover:decoration-2"
        onClick={(e) => {
          const el = document.getElementById(href.slice(1));
          if (!el) return;
          e.preventDefault();
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus({ preventScroll: true });
          history.replaceState(null, "", href);
          el.classList.add("sprung-ziel");
          window.setTimeout(() => el.classList.remove("sprung-ziel"), 2000);
        }}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className="underline decoration-1 underline-offset-4 hover:decoration-2">
      {children}
    </Link>
  );
}
