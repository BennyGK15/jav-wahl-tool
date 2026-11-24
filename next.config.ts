import type { NextConfig } from "next";

// Statische Sicherheits-Header. Die Content-Security-Policy mit Nonce setzt src/proxy.ts.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const appHost = process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).host : undefined;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    agentUpgrade: "security",
    serverActions: {
      allowedOrigins: appHost ? [appHost] : [],
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
