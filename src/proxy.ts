import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Next.js 16 „Proxy" (früher middleware.ts).
 * 1. Setzt eine Content-Security-Policy mit Nonce pro Anfrage.
 * 2. Ohne Sitzungs-Cookie: „/“ zeigt die öffentliche Startseite, alles andere führt zum Login
 *    (mit Rücksprungziel). Das ist nur eine Vorprüfung – die echte Prüfung der Sitzung passiert
 *    serverseitig in jeder Seite und Action.
 */
const PUBLIC_PATHS = ["/login", "/api/auth", "/start"];

function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline-Style-Attribute (z. B. von Radix) erfordern 'unsafe-inline' für Styles.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, process.env.NODE_ENV !== "production");
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isPublic && !getSessionCookie(request, { cookiePrefix: "jav" })) {
    // Startadresse: öffentliche Startseite anzeigen (Adresse bleibt „/“)
    if (pathname === "/") {
      const res = NextResponse.rewrite(new URL("/start", request.url), { request: { headers: requestHeaders } });
      res.headers.set("Content-Security-Policy", csp);
      return res;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Nur Seitenaufrufe merken, keine Server-Aktionen oder Dateien
    if (request.method === "GET" && !pathname.startsWith("/api/")) url.searchParams.set("weiter", `${pathname}${request.nextUrl.search}`);
    const res = NextResponse.redirect(url);
    res.headers.set("Content-Security-Policy", csp);
    return res;
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
