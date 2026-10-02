import { useState } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useAuthStore } from "../lib/state/authStore";
import { NeirLogo } from "../components/shared/NeirLogo";
import { ThemeToggle } from "../components/shared/ThemeToggle";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { IconButton } from "../components/ui/IconButton";

export function UnlockPage() {
  const [accountKey, setAccountKey] = useState("");
  const [visible, setVisible] = useState(false);
  const error = useAuthStore((state) => state.error);
  const busy = useAuthStore((state) => state.busy);
  const unlock = useAuthStore((state) => state.unlock);
  const forgetDevice = useAuthStore((state) => state.forgetDevice);
  const clearError = useAuthStore((state) => state.clearError);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    unlock(accountKey);
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
            <h1>Unlock</h1>
            <p>You're still signed in. Enter your Account Key to open your mailbox.</p>
          </header>
          <Field
            label="Account Key"
            type={visible ? "text" : "password"}
            value={accountKey}
            onChange={(event) => {
              setAccountKey(event.target.value);
              clearError();
            }}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            error={error || undefined}
            trailing={
              <IconButton
                label={visible ? "Hide Account Key" : "Show Account Key"}
                icon={visible ? <EyeSlash /> : <Eye />}
                onClick={() => setVisible((current) => !current)}
              />
            }
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={busy}
            disabled={!accountKey.trim()}
          >
            Unlock
          </Button>
          <button type="button" className="login-text-link" onClick={forgetDevice}>
            Sign out
          </button>
        </form>
      </main>
    </div>
  );
}
