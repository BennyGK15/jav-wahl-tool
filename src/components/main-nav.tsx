"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  /** Nur bei exakt gleichem Pfad aktiv (z. B. Wahlkalender, dessen Unterseiten eigene Einträge haben) */
  exact?: boolean;
}

export function MainNav({
  items,
  label,
}: Readonly<{ items: NavItem[]; label: string }>) {
  const pathname = usePathname();
  const isActive = (i: NavItem) =>
    i.exact || i.href === "/"
      ? pathname === i.href
      : pathname === i.href || pathname.startsWith(`${i.href}/`);
  // Spezifischster Treffer gewinnt (z. B. /fristen/regeln vor /fristen)
  const active = items
    .filter(isActive)
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav aria-label={label} className="-mb-px overflow-x-auto">
      <ul className="flex min-w-max gap-1">
        {items.map((i) => {
          const current = i === active;
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex h-12 items-center border-b-[3px] px-3 text-sm font-semibold whitespace-nowrap no-underline transition-colors",
                  current
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
