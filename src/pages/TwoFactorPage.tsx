import { useState } from "react";
import { useAuthStore } from "../lib/state/authStore";
import { NeirLogo } from "../components/shared/NeirLogo";
import { ThemeToggle } from "../components/shared/ThemeToggle";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";

export function TwoFactorPage() {
  const [code, setCode] = useState("");
  const error = useAuthStore((state) => state.error);
  const busy = useAuthStore((state) => state.busy);
  const submitTwoFactorCode = useAuthStore((state) => state.submitTwoFactorCode);
  const cancelTwoFactor = useAuthStore((state) => state.cancelTwoFactor);
  const clearError = useAuthStore((state) => state.clearError);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    submitTwoFactorCode(code.trim());
  }

  return (
    <div className="login-screen">
      <div className="login-corner">
        <ThemeToggle />
      </div>
      <main className="login-center">
        <form className="login-panel" onSubmit={handleSubmit}>
          <NeirLogo />
          <header className="login-heading">
            <h1>Verification code</h1>
            <p>Enter the 6-digit code from your authenticator app.</p>
          </header>
          <Field
            label="Code"
            type="text"
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
              clearError();
            }}
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            autoComplete="one-time-code"
            error={error || undefined}
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={busy}
            disabled={code.trim().length !== 6}
          >
            Verify
          </Button>
          <button type="button" className="login-text-link" onClick={cancelTwoFactor}>
            Back to sign in
          </button>
        </form>
      </main>
    </div>
  );
}
