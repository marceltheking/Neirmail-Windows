import { useEffect, useState } from "react";
import { Copy, ShieldCheck, ShieldSlash } from "@phosphor-icons/react";
import {
  disableTwoFactor,
  enableTwoFactor,
  setupTwoFactor,
} from "../../lib/api/endpoints/settings";
import type { TwoFactorSetup } from "../../lib/api/types";
import { useAuthStore } from "../../lib/state/authStore";
import { useToastStore } from "../../lib/state/toastStore";
import { Modal, ModalClose } from "../shared/Modal";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { copyText } from "../../lib/native/clipboard";

export function TwoFactorModal({ onClose }: { onClose: () => void }) {
  const active = useAuthStore((state) => Boolean(state.me?.twofaActive));
  const updateStatus = useAuthStore((state) => state.updateTwoFactorStatus);
  const showToast = useToastStore((state) => state.show);
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(!active);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (active) return;
    void setupTwoFactor()
      .then(async (result) => {
        setSetup(result);
        const QRCode = (await import("qrcode")).default;
        setQr(await QRCode.toDataURL(result.otpauthUrl, { margin: 1, width: 210 }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not start 2FA setup."))
      .finally(() => setBusy(false));
  }, [active]);

  async function enable() {
    if (!setup || !/^\d{6}$/.test(code)) {
      setError("Enter the current 6-digit authenticator code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await enableTwoFactor(setup, code);
      updateStatus(true);
      showToast("Two-factor authentication enabled");
      onClose();
    } catch {
      setError("That code was not accepted. Check your authenticator and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the current 6-digit authenticator code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await disableTwoFactor(code);
      updateStatus(false);
      showToast("Two-factor authentication disabled");
      onClose();
    } catch {
      setError("That code was not accepted. Two-factor authentication is still enabled.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={active ? "Disable two-factor authentication" : "Set up two-factor authentication"}
      description={
        active
          ? "Confirm with your current authenticator code."
          : "Scan the code, then enter the current 6-digit value."
      }
      size="md"
      onClose={onClose}
    >
      {active ? (
        <div className="twofa-modal-form">
          <Field
            label="Authenticator code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            autoFocus
          />
          {error && <div className="auth-error">{error}</div>}
          <div className="modal-actions">
            <ModalClose>
              <Button variant="ghost">Cancel</Button>
            </ModalClose>
            <Button variant="danger" icon={<ShieldSlash />} loading={busy} onClick={disable}>
              Disable 2FA
            </Button>
          </div>
        </div>
      ) : (
        <div className="twofa-modal-setup">
          <div className="twofa-qr">{qr && <img src={qr} alt="Authenticator QR code" />}</div>
          <div className="twofa-modal-form">
            <p>Add this account to your authenticator app.</p>
            {setup && (
              <div className="twofa-manual-key">
                <code className="settings-code">{setup.secret}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Copy />}
                  onClick={() =>
                    void copyText(setup.secret)
                      .then(() => showToast("Authenticator key copied"))
                      .catch(() => showToast("Could not copy the authenticator key."))
                  }
                >
                  Copy
                </Button>
              </div>
            )}
            <Field
              label="Authenticator code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              autoFocus
            />
            {error && <div className="auth-error">{error}</div>}
            <div className="modal-actions">
              <ModalClose>
                <Button variant="ghost">Cancel</Button>
              </ModalClose>
              <Button icon={<ShieldCheck />} loading={busy} disabled={!setup} onClick={enable}>
                Enable 2FA
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
