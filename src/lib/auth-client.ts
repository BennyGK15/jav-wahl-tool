import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  inferAdditionalFields,
  twoFactorClient,
  usernameClient,
} from "better-auth/client/plugins";
import type { auth } from "./auth";

export const authClient = createAuthClient({
  plugins: [
    usernameClient(),
    adminClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        // Außerhalb von React aufgerufen – deshalb vollständige Navigation statt Router
        window.location.assign(new URL("/login/2fa", window.location.origin));
      },
    }),
    inferAdditionalFields<typeof auth>(),
  ],
});
