import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import { useToastStore } from "../../lib/state/toastStore";
import { ArrowsClockwise, GithubLogo, Info, ShieldCheck } from "@phosphor-icons/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "../ui/Button";

export function AboutTab() {
  const showToast = useToastStore((state) => state.show);
  const [checking, setChecking] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getVersion()
      .then((value) => {
        if (!cancelled) setVersion(value);
      })
      .catch(() => {
        if (!cancelled) setVersion("unknown");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function checkForUpdates() {
    setChecking(true);
    try {
      const update = await check();
      if (!update) {
        showToast("You're on the latest version");
        return;
      }
      showToast(`Installing update ${update.version}…`);
      await update.downloadAndInstall();
      await relaunch();
    } catch {
      showToast("Could not check for updates.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="settings-tab settings-tab-v2">
      <header className="settings-section-head">
        <div className="settings-section-icon">
          <Info weight="duotone" />
        </div>
        <div>
          <h1>About Neir Mail</h1>
          <p>The official open-source desktop client for Neir.io.</p>
        </div>
      </header>
      <section className="settings-about-hero">
        <div className="settings-about-mark">N</div>
        <div>
          <strong>Neir Mail</strong>
          <span>Version {version ?? "loading"}</span>
        </div>
      </section>
      <section className="settings-section-card">
        <div className="settings-card-head">
          <div>
            <h2>Software updates</h2>
            <p>Updates are signed and downloaded from the official GitHub release feed.</p>
          </div>
          <Button
            variant="secondary"
            icon={<ArrowsClockwise />}
            loading={checking}
            onClick={checkForUpdates}
          >
            Check for updates
          </Button>
        </div>
      </section>
      <section className="settings-section-card">
        <div className="settings-card-title-row">
          <ShieldCheck weight="duotone" />
          <div>
            <h2>Open source</h2>
            <p>Inspect the client, report issues, or contribute improvements on GitHub.</p>
          </div>
        </div>
        <Button
          variant="ghost"
          icon={<GithubLogo />}
          onClick={() =>
            void openUrl("https://github.com/marceltheking/Neirmail-Windows").catch(() =>
              showToast("Could not open the project page."),
            )
          }
        >
          View source code
        </Button>
      </section>
    </div>
  );
}
