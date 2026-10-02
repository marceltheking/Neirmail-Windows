import { useState } from "react";
import { ArrowUpRight, Eye, EyeSlash } from "@phosphor-icons/react";
import { useAuthStore } from "../lib/state/authStore";
import { openWebsite } from "../lib/native/website";
import { NeirLogo } from "../components/shared/NeirLogo";
import { ThemeToggle } from "../components/shared/ThemeToggle";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { IconButton } from "../components/ui/IconButton";

export function LoginPage() {
  const [accountKey, setAccountKey] = useState("");
  const [visible, setVisible] = useState(false);
  const error = useAuthStore((state) => state.error);
  const busy = useAuthStore((state) => state.busy);
  const submitAccountKey = useAuthStore((state) => state.submitAccountKey);
  const clearError = useAuthStore((state) => state.clearError);

  return (
    <div className="login-screen">
      <div className="login-corner">
        <ThemeToggle />
      </div>
      <main className="login-center">
        <form
          className="login-panel"
          onSubmit={(event) => {
            event.preventDefault();
            submitAccountKey(accountKey);
          }}
        >
          <NeirLogo />
          <header className="login-heading">
            <h1>Sign in</h1>
            <p>Your Account Key unlocks your mailbox on this device.</p>
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
          <button type="button" className="login-text-link" onClick={() => openWebsite("recovery")}>
            Lost your key?
          </button>
        </form>
        <button type="button" className="login-signup" onClick={() => openWebsite("signup")}>
          <span>New to Neir?</span>
          <strong>
            Create a free account
            <ArrowUpRight weight="bold" />
          </strong>
        </button>
      </main>
      <nav className="login-legal" aria-label="Legal">
        <button type="button" onClick={() => openWebsite("system")}>
          How it works
        </button>
        <button type="button" onClick={() => openWebsite("terms")}>
          Terms
        </button>
        <button type="button" onClick={() => openWebsite("privacy")}>
          Privacy
        </button>
      </nav>
    </div>
  );
}
