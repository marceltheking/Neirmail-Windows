import { useState } from "react";
import { Check, Lightning, Wallet } from "@phosphor-icons/react";
import { useAuthStore } from "../../lib/state/authStore";
import { PaymentModal } from "../payments/PaymentModal";
import { Button } from "../ui/Button";

export function SubscriptionPanel() {
  const me = useAuthStore((state) => state.me);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="dashboard-panel dashboard-subscription dashboard-subscription-card">
        <div className="dashboard-plan-icon">
          <Lightning weight="fill" />
        </div>
        <div className="dashboard-plan-copy">
          <span>{me?.plan === "pro" ? "Neir Pro" : "Upgrade available"}</span>
          <h2>{me?.plan === "pro" ? "Keep Pro active" : "Unlock the complete mailbox"}</h2>
          <ul>
            <li>
              <Check /> 5 GB encrypted storage
            </li>
            <li>
              <Check /> Unlimited aliases and @neir.io
            </li>
            <li>
              <Check /> Auto-delete controls
            </li>
          </ul>
        </div>
        <Button icon={<Wallet />} onClick={() => setOpen(true)}>
          {me?.plan === "pro" ? "Extend" : "Upgrade"}
        </Button>
      </section>
      {open && (
        <PaymentModal
          onClose={() => setOpen(false)}
          onPaid={async () => {
            await refreshProfile();
          }}
        />
      )}
    </>
  );
}
