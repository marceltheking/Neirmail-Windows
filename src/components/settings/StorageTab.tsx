import { useMutation } from "@tanstack/react-query";
import { clearLocalCache } from "../../lib/cache/localCache";
import { useToastStore } from "../../lib/state/toastStore";
import { Broom, Database, LockKey } from "@phosphor-icons/react";
import { Button } from "../ui/Button";

export function StorageTab() {
  const showToast = useToastStore((state) => state.show);

  const mutation = useMutation({
    mutationFn: clearLocalCache,
    onSuccess: () => showToast("Local cache cleared"),
    onError: () => showToast("Could not clear the local cache."),
  });

  return (
    <div className="settings-tab settings-tab-v2">
      <header className="settings-section-head">
        <div className="settings-section-icon">
          <Database weight="duotone" />
        </div>
        <div>
          <h1>Local storage</h1>
          <p>Manage the encrypted cache stored on this computer.</p>
        </div>
      </header>
      <section className="settings-section-card">
        <div className="settings-card-title-row">
          <LockKey weight="duotone" />
          <div>
            <h2>Encrypted mail cache</h2>
            <p>
              Neir Mail protects cached metadata with a key from your operating system keychain.
            </p>
          </div>
        </div>
        <p className="settings-body-copy">
          Neir Mail keeps an encrypted local copy of your folders and mail so the app stays fast and
          works offline. Clearing it does not delete anything from your account. It simply resyncs
          from the server next time you're online.
        </p>
        <Button
          variant="secondary"
          icon={<Broom />}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Clear local cache
        </Button>
      </section>
    </div>
  );
}
