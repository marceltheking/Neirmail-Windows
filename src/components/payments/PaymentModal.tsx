import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Wallet } from "@phosphor-icons/react";
import {
  createSubscriptionCheckout,
  getCheckoutStatus,
  getPaymentOptions,
} from "../../lib/api/endpoints/payments";
import type { PaymentCheckout, PaymentOptionsResult } from "../../lib/api/types";
import { copyText } from "../../lib/native/clipboard";
import { Modal, ModalClose } from "../shared/Modal";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { ErrorState, Skeleton } from "../ui/States";
import { useToastStore } from "../../lib/state/toastStore";

interface PaymentModalProps {
  onClose: () => void;
  onPaid: (checkout: PaymentCheckout) => void | Promise<void>;
}

const terminalStatuses = new Set(["paid", "expired", "failed"]);

export function PaymentModal({ onClose, onPaid }: PaymentModalProps) {
  const onPaidRef = useRef(onPaid);
  const showToast = useToastStore((state) => state.show);
  const [options, setOptions] = useState<PaymentOptionsResult | null>(null);
  const [months, setMonths] = useState<1 | 3 | 6 | 12>(12);
  const [currency, setCurrency] = useState("");
  const [network, setNetwork] = useState("");
  const [checkout, setCheckout] = useState<PaymentCheckout | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optionsAttempt, setOptionsAttempt] = useState(0);

  const currencies = useMemo(
    () =>
      Array.from(
        new Map(options?.options.map((option) => [option.currency, option]) ?? []).values(),
      ),
    [options],
  );
  const networks = options?.options.filter((option) => option.currency === currency) ?? [];

  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  useEffect(() => {
    let active = true;
    void getPaymentOptions()
      .then((result) => {
        if (!active) return;
        setOptions(result);
        setCurrency(result.options[0]?.currency ?? "");
        setNetwork(result.options[0]?.network ?? "");
      })
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err.message : "Payment options could not be loaded.");
      })
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [optionsAttempt]);

  useEffect(() => {
    if (!checkout || terminalStatuses.has(checkout.status)) return;
    let active = true;
    let timer = 0;
    const refresh = async () => {
      try {
        const next = await getCheckoutStatus(checkout.id, checkout.token);
        if (!active) return;
        setCheckout(next);
        if (next.status === "paid") {
          await onPaidRef.current(next);
          return;
        }
        if (terminalStatuses.has(next.status)) return;
      } catch {}
      if (active) timer = window.setTimeout(refresh, 4000);
    };
    timer = window.setTimeout(refresh, 2500);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [checkout]);

  async function createCheckout() {
    if (!currency || !network) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createSubscriptionCheckout(months, currency, network);
      setCheckout(result);
      const QRCode = (await import("qrcode")).default;
      setQr(await QRCode.toDataURL(result.paymentUri, { margin: 1, width: 220 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The payment address could not be created.");
    } finally {
      setBusy(false);
    }
  }

  const selectedPrice = options?.prices.find((price) => price.months === months);

  return (
    <Modal
      title="Extend Neir Pro"
      description="Choose a term and pay privately with a supported cryptocurrency."
      size="lg"
      onClose={onClose}
    >
      {busy && !options && !checkout ? (
        <Skeleton lines={3} />
      ) : error && !options && !checkout ? (
        <ErrorState
          title="Payment options could not be loaded"
          description={error}
          onRetry={() => {
            setBusy(true);
            setError(null);
            setOptionsAttempt((attempt) => attempt + 1);
          }}
        />
      ) : !checkout ? (
        <div className="payment-flow">
          <div className="payment-term-grid">
            {options?.prices.map((price) => (
              <button
                type="button"
                key={price.months}
                className={months === price.months ? "selected" : ""}
                onClick={() => setMonths(price.months)}
              >
                <span>
                  {price.months} {price.months === 1 ? "month" : "months"}
                </span>
                <strong>${price.usdAmount}</strong>
                {price.months === 12 && <small>Best value</small>}
              </button>
            ))}
          </div>
          <div className="payment-fields">
            <Select
              label="Cryptocurrency"
              value={currency}
              onValueChange={(value) => {
                setCurrency(value);
                setNetwork(
                  options?.options.find((option) => option.currency === value)?.network ?? "",
                );
              }}
              options={currencies.map((option) => ({
                value: option.currency,
                label: `${option.name} (${option.currency})`,
              }))}
            />
            <Select
              label="Network"
              value={network}
              onValueChange={setNetwork}
              options={networks.map((option) => ({
                value: option.network,
                label: option.networkName,
              }))}
            />
          </div>
          <div className="payment-summary">
            <div>
              <span>Total</span>
              <strong>${selectedPrice?.usdAmount ?? "..."}</strong>
            </div>
            <p>The payment address is generated only after you confirm.</p>
          </div>
          {error && <div className="auth-error">{error}</div>}
          <div className="modal-actions">
            <ModalClose>
              <Button variant="ghost">Cancel</Button>
            </ModalClose>
            <Button
              icon={<Wallet />}
              loading={busy}
              disabled={!options || !currency || !network}
              onClick={createCheckout}
            >
              Continue to payment
            </Button>
          </div>
        </div>
      ) : (
        <div className="payment-checkout">
          {checkout.status === "paid" ? (
            <div className="payment-paid">
              <Check weight="bold" />
              <h3>Payment confirmed</h3>
              <p>Your Neir Pro access is ready.</p>
              <ModalClose>
                <Button>Done</Button>
              </ModalClose>
            </div>
          ) : (
            <>
              <div className="payment-qr">{qr && <img src={qr} alt="Payment QR code" />}</div>
              <div className="payment-instructions">
                <span
                  className={`status-chip status-${checkout.status}`}
                  role="status"
                  aria-live="polite"
                >
                  {checkout.status}
                </span>
                <h3>
                  Send {checkout.payAmount} {checkout.payCurrency}
                </h3>
                <p>Use the {checkout.network} network. The status updates automatically.</p>
                <button
                  type="button"
                  className="copy-value-v2"
                  onClick={() =>
                    void copyText(checkout.address)
                      .then(() => showToast("Payment address copied"))
                      .catch(() => showToast("Could not copy the payment address."))
                  }
                >
                  <code>{checkout.address}</code>
                  <Copy />
                </button>
                {(checkout.status === "expired" || checkout.status === "failed") && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCheckout(null);
                      setQr(null);
                    }}
                  >
                    Start a new payment
                  </Button>
                )}
                {error && <div className="auth-error">{error}</div>}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
