import { useState } from "react";
import { BellRinging, Desktop, LockSimple, Tray } from "@phosphor-icons/react";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { callCommand } from "../../lib/api/client";
import { AUTO_LOCK_CHOICES, useAppSettingsStore } from "../../lib/state/appSettingsStore";
import { useAuthStore } from "../../lib/state/authStore";
import { Select } from "../ui/Select";
import { useToastStore } from "../../lib/state/toastStore";
import { Button } from "../ui/Button";
import { Switch } from "../ui/Switch";

export function DesktopTab() {
  const closeToTray = useAppSettingsStore((state) => state.closeToTray);
  const notificationPreview = useAppSettingsStore((state) => state.notificationPreview);
  const notificationSound = useAppSettingsStore((state) => state.notificationSound);
  const autoLockMinutes = useAppSettingsStore((state) => state.autoLockMinutes);
  const update = useAppSettingsStore((state) => state.update);
  const lock = useAuthStore((state) => state.lock);
  const showToast = useToastStore((state) => state.show);
  const [testing, setTesting] = useState(false);

  async function testNotification() {
    setTesting(true);
    try {
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === "granted";
      if (!granted) {
        showToast("Notification permission was not granted");
        return;
      }
      await callCommand("show_native_notification", {
        title: "Neir Mail notifications are ready",
        body: notificationPreview
          ? "Sender and subject previews will appear here."
          : "New mail will arrive without message details.",
        sound: notificationSound,
      });
      showToast("Test notification sent");
    } catch {
      showToast("Could not send the test notification");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="settings-tab settings-tab-v2">
      <header className="settings-section-head">
        <div className="settings-section-icon">
          <Desktop weight="duotone" />
        </div>
        <div>
          <h1>Desktop app</h1>
          <p>Control how Neir Mail behaves on this computer.</p>
        </div>
      </header>
      <section className="settings-section-card">
        <h2>Lock</h2>
        <div className="settings-select-row">
          <span className="ui-setting-copy">
            <strong>Lock after inactivity</strong>
            <span>Clears your decrypted key from memory. Unlock with your Account Key.</span>
          </span>
          <Select
            label="Lock after inactivity"
            value={String(autoLockMinutes)}
            onValueChange={(value) => update({ autoLockMinutes: Number(value) })}
            options={AUTO_LOCK_CHOICES.map((minutes) => ({
              value: String(minutes),
              label:
                minutes === 0
                  ? "Never"
                  : minutes < 60
                    ? `${minutes} minutes`
                    : `${minutes / 60} hour${minutes === 60 ? "" : "s"}`,
            }))}
          />
        </div>
        <div className="settings-feature-note">
          <LockSimple weight="duotone" />
          <span>Lock right away with Ctrl+L, or from the account menu.</span>
          <Button variant="secondary" size="sm" onClick={lock}>
            Lock now
          </Button>
        </div>
      </section>
      <section className="settings-section-card">
        <h2>Window</h2>
        <Switch
          checked={closeToTray}
          onCheckedChange={(checked) => update({ closeToTray: checked })}
          label="Keep Neir Mail in the tray"
          description="Closing the window keeps live mail and notifications running. Quit from the tray menu to fully exit."
        />
        <div className="settings-feature-note">
          <Tray weight="duotone" />
          <span>
            On Linux, open the tray menu with a right click. Windows and macOS also restore the
            window with a normal click.
          </span>
        </div>
      </section>
      <section className="settings-section-card">
        <div className="settings-card-head">
          <div>
            <h2>Notifications</h2>
            <p>Native notifications are delivered as soon as Neir reports new mail.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<BellRinging weight="fill" />}
            loading={testing}
            onClick={testNotification}
          >
            Test
          </Button>
        </div>
        <Switch
          checked={notificationPreview}
          onCheckedChange={(checked) => update({ notificationPreview: checked })}
          label="Show sender and subject"
          description="Turn this off to keep notification content private on the lock screen."
        />
        <Switch
          checked={notificationSound}
          onCheckedChange={(checked) => update({ notificationSound: checked })}
          label="Play a sound"
          description="Play your system notification sound when new mail arrives."
        />
      </section>
    </div>
  );
}
