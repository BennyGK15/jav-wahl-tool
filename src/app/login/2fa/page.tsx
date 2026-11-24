import { AuthShell } from "@/components/auth-shell";
import { TwoFactorForm } from "./two-factor-form";

export const metadata = { title: "Bestätigungscode" };

export default function TwoFactorPage() {
  return (
    <AuthShell>
      <div className="grid w-full max-w-sm gap-7">
        <div>
          <h1 className="text-4xl">Bestätigungscode</h1>
          <p className="mt-1 text-muted-foreground">
            Bitte den sechsstelligen Code aus Ihrer Authenticator-App eingeben.
          </p>
        </div>
        <TwoFactorForm />
      </div>
    </AuthShell>
  );
}
