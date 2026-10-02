import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { PaintBrush } from "@phosphor-icons/react";
import { getPreferences, updatePreferences } from "../../lib/api/endpoints/settings";
import { ApiError, type Preferences } from "../../lib/api/types";
import { useToastStore } from "../../lib/state/toastStore";
import { useThemeStore } from "../../lib/state/themeStore";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { Select } from "../ui/Select";
import { Switch } from "../ui/Switch";
import { ErrorState, Skeleton } from "../ui/States";

const privacyToggles: Array<{
  key: keyof Preferences;
  label: string;
  description: string;
}> = [
  {
    key: "stripImageMetadataEnabled",
    label: "Strip image metadata",
    description: "Remove camera and location data from images you attach.",
  },
  {
    key: "stripDocumentMetadataEnabled",
    label: "Strip document metadata",
    description: "Remove author and app data from documents you attach.",
  },
  {
    key: "stripTrackingParamsEnabled",
    label: "Clean tracking links",
    description: "Remove tracking parameters before opening links.",
  },
  {
    key: "firstTimeSenderWarningEnabled",
    label: "First-time sender warnings",
    description: "Flag mail from addresses you have not seen before.",
  },
  {
    key: "lookalikeDomainWarningEnabled",
    label: "Lookalike domain warnings",
    description: "Warn when a sender domain imitates a known one.",
  },
];

const CLEANUP_CHOICES = [
  { value: "off", label: "Never" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
];

function cleanupChoices(current: number | null) {
  if (current === null || CLEANUP_CHOICES.some((choice) => choice.value === String(current))) {
    return CLEANUP_CHOICES;
  }
  return [
    ...CLEANUP_CHOICES,
    { value: String(current), label: `${current} day${current === 1 ? "" : "s"}` },
  ].sort((a, b) =>
    a.value === "off" ? -1 : b.value === "off" ? 1 : Number(a.value) - Number(b.value),
  );
}

export function PreferencesTab() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.show);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const preferencesQuery = useQuery({ queryKey: ["preferences"], queryFn: getPreferences });
  const data = preferencesQuery.data;

  const mutation = useMutation({
    mutationFn: updatePreferences,
    onSuccess: (updated) => {
      queryClient.setQueryData(["preferences"], updated);
      showToast("Preferences saved");
    },
    onError: (error) =>
      showToast(error instanceof ApiError ? error.message : "Could not save preferences."),
  });

  if (preferencesQuery.isPending) return <Skeleton lines={7} />;
  if (preferencesQuery.isError || !data) {
    return (
      <ErrorState
        title="Preferences could not be loaded"
        description={
          preferencesQuery.error instanceof ApiError
            ? preferencesQuery.error.message
            : "Check your connection and try again."
        }
        onRetry={() => void preferencesQuery.refetch()}
      />
    );
  }

  async function toggle(key: keyof Preferences, enabled: boolean) {
    if (key === "desktopNotificationsEnabled" && enabled) {
      try {
        let granted = await isPermissionGranted();
        if (!granted) granted = (await requestPermission()) === "granted";
        if (!granted) {
          showToast("Desktop notification permission was not granted");
          return;
        }
      } catch {
        showToast("Notification permission could not be checked");
        return;
      }
    }
    if (key === "lightModeEnabled") {
      const previous = theme;
      setTheme(enabled ? "light" : "dark");
      mutation.mutate({ [key]: enabled }, { onError: () => setTheme(previous) });
      return;
    }
    mutation.mutate({ [key]: enabled });
  }

  return (
    <div className="settings-tab settings-tab-v2">
      <header className="settings-section-head">
        <div className="settings-section-icon">
          <PaintBrush weight="duotone" />
        </div>
        <div>
          <h1>Preferences</h1>
        </div>
      </header>

      <section className="settings-section-card">
        <h2>Experience</h2>
        <Switch
          checked={data.desktopNotificationsEnabled}
          onCheckedChange={(checked) => void toggle("desktopNotificationsEnabled", checked)}
          label="Desktop notifications"
          description="Notify you when new mail arrives."
          disabled={mutation.isPending}
        />
        <Switch
          checked={theme === "light"}
          onCheckedChange={(checked) => void toggle("lightModeEnabled", checked)}
          label="Light theme"
          description="Use the light palette."
          disabled={mutation.isPending}
        />
        <Switch
          checked={data.compactViewEnabled}
          onCheckedChange={(checked) => void toggle("compactViewEnabled", checked)}
          label="Compact message list"
          description="Tighter rows in the message list."
          disabled={mutation.isPending}
        />
      </section>

      <section className="settings-section-card">
        <h2>Privacy tools</h2>
        {privacyToggles.map((item) => (
          <Switch
            key={item.key}
            checked={Boolean(data[item.key])}
            onCheckedChange={(checked) => void toggle(item.key, checked)}
            label={item.label}
            description={item.description}
            disabled={mutation.isPending}
          />
        ))}
      </section>

      <section className="settings-section-card">
        <h2>Outgoing mail</h2>
        <Switch
          checked={data.trackEmailOpens}
          onCheckedChange={(checked) => void toggle("trackEmailOpens", checked)}
          label="Open tracking"
          description="Record when a recipient first opens your mail."
          disabled={mutation.isPending}
        />
      </section>

      <section className="settings-section-card">
        <h2>Automatic cleanup</h2>
        <div className="settings-select-row">
          <span className="ui-setting-copy">
            <strong>Delete read mail after</strong>
            <span>Permanently removed after this period.</span>
          </span>
          <Select
            label="Delete read mail after"
            value={data.autoDeleteReadEmailsDays?.toString() ?? "off"}
            onValueChange={(value) =>
              mutation.mutate({ autoDeleteReadEmailsDays: value === "off" ? null : Number(value) })
            }
            disabled={mutation.isPending}
            options={cleanupChoices(data.autoDeleteReadEmailsDays)}
          />
        </div>
        <Switch
          checked={data.autoDeleteInactiveAccountEnabled}
          onCheckedChange={(checked) => void toggle("autoDeleteInactiveAccountEnabled", checked)}
          label="Delete inactive account"
          description="Remove the account after a long period of inactivity."
          disabled={mutation.isPending}
        />
      </section>
    </div>
  );
}
