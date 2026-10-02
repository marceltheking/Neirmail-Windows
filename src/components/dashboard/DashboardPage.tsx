import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  At,
  CheckCircle,
  Copy,
  HardDrives,
  Lightning,
  Plus,
  Shuffle,
  Trash,
} from "@phosphor-icons/react";
import { getAccountSummary } from "../../lib/api/endpoints/account";
import {
  createAddress,
  createRandomAddress,
  deleteAddress,
  listAddresses,
} from "../../lib/api/endpoints/dashboard";
import { useAuthStore } from "../../lib/state/authStore";
import { useToastStore } from "../../lib/state/toastStore";
import { formatBytes } from "../../lib/format/bytes";
import { copyText } from "../../lib/native/clipboard";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Select } from "../ui/Select";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { SubscriptionPanel } from "./SubscriptionPanel";
import { ConfirmationDialog } from "../shared/ConfirmationDialog";
import { ApiError, type MailboxAddress } from "../../lib/api/types";

export function DashboardPage() {
  const [username, setUsername] = useState("");
  const [domain, setDomain] = useState("neirmail.com");
  const [addressToDelete, setAddressToDelete] = useState<MailboxAddress | null>(null);
  const me = useAuthStore((state) => state.me);
  const showToast = useToastStore((state) => state.show);
  const queryClient = useQueryClient();
  const summaryQuery = useQuery({
    queryKey: ["account-summary"],
    queryFn: getAccountSummary,
  });
  const addressQuery = useQuery({ queryKey: ["addresses"], queryFn: listAddresses });
  const summary = summaryQuery.data;
  const addresses = addressQuery.data ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["addresses"] });
    queryClient.invalidateQueries({ queryKey: ["account-summary"] });
  };

  const createMutation = useMutation({
    mutationFn: () => createAddress(username, domain),
    onSuccess: () => {
      setUsername("");
      refresh();
      showToast("Address created");
    },
    onError: (error) =>
      showToast(error instanceof ApiError ? error.message : "Could not create that address."),
  });
  const randomMutation = useMutation({
    mutationFn: createRandomAddress,
    onSuccess: () => {
      refresh();
      showToast("Random alias created");
    },
    onError: (error) =>
      showToast(error instanceof ApiError ? error.message : "Could not create a random alias."),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteAddress,
    onSuccess: () => {
      refresh();
      setAddressToDelete(null);
      showToast("Alias deleted");
    },
    onError: (error) =>
      showToast(error instanceof ApiError ? error.message : "Could not delete that alias."),
  });

  const used = Number(summary?.usedBytes ?? 0);
  const quota = Number(summary?.storageQuotaBytes ?? 0);
  const storagePercent = quota ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const usernameValid = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,62}[a-zA-Z0-9])?$/.test(username);

  async function copyAddress(address: string) {
    try {
      await copyText(address);
      showToast("Address copied");
    } catch {
      showToast("Could not copy that address.");
    }
  }

  return (
    <div className="dashboard-page dashboard-page-v2">
      <header className="page-heading">
        <div>
          <span className="page-kicker">Account overview</span>
          <h1>Good to see you.</h1>
          <p>{summary?.primaryAddress ?? "Your private Neir account"}</p>
        </div>
        <div className="dashboard-status-pill">
          <CheckCircle weight="fill" />
          {summary?.status ?? "Active"}
        </div>
      </header>

      {summaryQuery.isPending ? (
        <Skeleton lines={3} />
      ) : summaryQuery.isError ? (
        <ErrorState
          title="Account summary could not be loaded"
          description={
            summaryQuery.error instanceof ApiError
              ? summaryQuery.error.message
              : "Check your connection and try again."
          }
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : (
        <section className="dashboard-metrics">
          <article>
            <span className="dashboard-metric-icon">
              <Lightning weight="duotone" />
            </span>
            <div>
              <span>Plan</span>
              <strong>{me?.plan === "pro" ? "Neir Pro" : "Free"}</strong>
            </div>
            <small>
              {me?.plan === "pro" ? "All privacy tools unlocked" : "Private email essentials"}
            </small>
          </article>
          <article>
            <span className="dashboard-metric-icon">
              <HardDrives weight="duotone" />
            </span>
            <div>
              <span>Storage</span>
              <strong>
                {formatBytes(used)} <em>of {formatBytes(quota)}</em>
              </strong>
            </div>
            <div
              className="wm-bar"
              role="progressbar"
              aria-label="Account storage"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={storagePercent}
            >
              <div className="wm-bar-fill" style={{ width: `${storagePercent}%` }} />
            </div>
          </article>
          <article>
            <span className="dashboard-metric-icon">
              <At weight="duotone" />
            </span>
            <div>
              <span>Addresses</span>
              <strong>{addresses.length}</strong>
            </div>
            <small>
              {addresses.length === 1 ? "One private identity" : "Private identities ready"}
            </small>
          </article>
        </section>
      )}

      <div className="dashboard-columns">
        <section className="dashboard-panel dashboard-addresses">
          <div className="dashboard-panel-head">
            <div>
              <h2>Email addresses</h2>
              <p>Create aliases without exposing your primary inbox.</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<Shuffle />}
              loading={randomMutation.isPending}
              onClick={() => randomMutation.mutate()}
            >
              Random alias
            </Button>
          </div>
          <form
            className="dashboard-address-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (usernameValid) createMutation.mutate();
            }}
          >
            <Field
              label="New address"
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              placeholder="private-name"
              required
              maxLength={64}
              error={
                username && !usernameValid
                  ? "Use letters, numbers, dots, underscores, or hyphens; begin and end with a letter or number."
                  : undefined
              }
            />
            <div className="dashboard-domain-field">
              <span>@</span>
              <Select
                label="Domain"
                value={domain}
                onValueChange={setDomain}
                options={[
                  { value: "neirmail.com", label: "neirmail.com" },
                  ...(me?.plan === "pro" ? [{ value: "neir.io", label: "neir.io" }] : []),
                ]}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              icon={<Plus weight="bold" />}
              loading={createMutation.isPending}
              disabled={!usernameValid}
            >
              Create
            </Button>
          </form>
          <div className="dashboard-address-list">
            {addressQuery.isPending ? (
              <Skeleton lines={3} />
            ) : addressQuery.isError ? (
              <ErrorState
                title="Addresses could not be loaded"
                description={
                  addressQuery.error instanceof ApiError
                    ? addressQuery.error.message
                    : "Check your connection and try again."
                }
                onRetry={() => void addressQuery.refetch()}
              />
            ) : (
              <>
                {addresses.length === 0 && (
                  <EmptyState
                    icon={<At />}
                    title="No addresses found"
                    description="Create an address to begin receiving mail."
                  />
                )}
                {addresses.map((address) => (
                  <div className="dashboard-address-row" key={address.id}>
                    <span className="dashboard-address-icon">
                      <At weight="bold" />
                    </span>
                    <div>
                      <strong>{address.address}</strong>
                      <span>
                        {address.type === "primary"
                          ? "Primary address"
                          : address.isRandomAlias
                            ? "Random alias"
                            : "Custom alias"}
                      </span>
                    </div>
                    <IconButton
                      label="Copy address"
                      icon={<Copy />}
                      onClick={() => void copyAddress(address.address)}
                    />
                    {address.type !== "primary" && (
                      <IconButton
                        danger
                        label="Delete alias"
                        icon={<Trash />}
                        onClick={() => setAddressToDelete(address)}
                      />
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </section>

        <aside className="dashboard-side-column">
          <SubscriptionPanel />
        </aside>
      </div>
      {addressToDelete && (
        <ConfirmationDialog
          title="Delete this alias?"
          description={`${addressToDelete.address} will stop receiving new mail.`}
          confirmLabel="Delete alias"
          busy={deleteMutation.isPending}
          onCancel={() => setAddressToDelete(null)}
          onConfirm={() => deleteMutation.mutate(addressToDelete.id)}
          detail="Messages already delivered to your mailbox will remain. The alias itself cannot be restored."
        />
      )}
    </div>
  );
}
