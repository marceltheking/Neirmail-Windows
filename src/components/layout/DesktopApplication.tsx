import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Redirect, Route, Switch, useLocation, useParams } from "wouter";
import { listFolders } from "../../lib/api/endpoints/folders";
import { getAccountSummary } from "../../lib/api/endpoints/account";
import type { Folder, NavKind } from "../../lib/api/types";
import { formatBytes } from "../../lib/format/bytes";
import { folderByType } from "../../lib/mail/navigation";
import { useComposeStore } from "../../lib/state/composeStore";
import { useMailStore } from "../../lib/state/mailStore";
import { useAuthStore } from "../../lib/state/authStore";
import { useAppSettingsStore } from "../../lib/state/appSettingsStore";
import { useIdleLock } from "../../lib/hooks/useIdleLock";
import { useShortcuts } from "../../lib/hooks/useShortcuts";
import { ShortcutsDialog } from "../shared/ShortcutsDialog";
import { ComposeWindow } from "../compose/ComposeWindow";
import { DashboardPage } from "../dashboard/DashboardPage";
import { FolderList } from "../folders/FolderList";
import { MailView } from "../mail/MailView";
import { SettingsPage } from "../settings/SettingsPage";
import { ErrorBoundary } from "../shared/ErrorBoundary";
import { AppShell } from "./AppShell";
import { MailLayout } from "./MailLayout";
import { ErrorState, Skeleton } from "../ui/States";
import { ApiError } from "../../lib/api/types";
import { getPreferences } from "../../lib/api/endpoints/settings";

const systemRoutes = new Set<NavKind>([
  "inbox",
  "starred",
  "sent",
  "drafts",
  "spam",
  "archive",
  "trash",
]);
const EMPTY_FOLDERS: Folder[] = [];

function MailScreen() {
  const { kind = "inbox", folderId } = useParams();
  const setNav = useMailStore((state) => state.setNav);
  const openEmail = useMailStore((state) => state.openEmail);
  const readerOpen = useMailStore((state) => state.selectedEmailId !== null);
  const folderQuery = useQuery({ queryKey: ["folders"], queryFn: listFolders });
  const folders = folderQuery.data ?? EMPTY_FOLDERS;
  const { data: summary } = useQuery({
    queryKey: ["account-summary"],
    queryFn: getAccountSummary,
  });

  useEffect(() => {
    openEmail(null);
  }, [folderId, kind, openEmail]);

  useEffect(() => {
    if (kind === "folder" && folderId) {
      setNav({ kind: "folder", folderId });
      return;
    }
    const navKind = systemRoutes.has(kind as NavKind) ? (kind as NavKind) : "inbox";
    setNav({ kind: navKind, folderId: folderByType(folders, navKind)?.id ?? null });
  }, [folderId, folders, kind, setNav]);

  const usedBytes = Number(summary?.usedBytes ?? 0);
  const quotaBytes = Number(summary?.storageQuotaBytes ?? 0);
  const usedPct = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;

  return (
    <MailLayout
      readerOpen={readerOpen}
      sidebar={
        <>
          <FolderList folders={folders} />
          <div className="wm-spacer" />
          <div className="wm-storage">
            <div className="wm-storage-copy">
              <span>Storage</span>
              <span>{formatBytes(usedBytes)}</span>
            </div>
            <div
              className="wm-bar"
              role="progressbar"
              aria-label="Mailbox storage"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={usedPct}
            >
              <div className="wm-bar-fill" style={{ width: `${usedPct}%` }} />
            </div>
            <span className="wm-storage-limit">of {formatBytes(quotaBytes)}</span>
          </div>
        </>
      }
    >
      {folderQuery.isPending ? (
        <Skeleton lines={9} />
      ) : folderQuery.isError ? (
        <ErrorState
          title="Mailbox folders could not be loaded"
          description={
            folderQuery.error instanceof ApiError
              ? folderQuery.error.message
              : "Check your connection, then try loading the mailbox again."
          }
          onRetry={() => void folderQuery.refetch()}
        />
      ) : (
        <MailView folders={folders} />
      )}
    </MailLayout>
  );
}

export function DesktopApplication() {
  const [location, navigate] = useLocation();
  const section = location.split("/")[1];
  const isComposeOpen = useComposeStore((state) => state.isOpen);
  const openCompose = useComposeStore((state) => state.open);
  const lock = useAuthStore((state) => state.lock);
  const autoLockMinutes = useAppSettingsStore((state) => state.autoLockMinutes);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const lockNow = useCallback(() => lock(), [lock]);

  useIdleLock(autoLockMinutes, lockNow);

  useShortcuts({
    c: () => openCompose(),
    "/": () => {
      if (section !== "mail") navigate("/mail/inbox");
      window.setTimeout(() => document.getElementById("mail-search")?.focus(), 0);
    },
    "?": () => setShowShortcuts(true),
  });
  useShortcuts({ "mod+l": lockNow }, { global: true });
  const { data: preferences } = useQuery({
    queryKey: ["preferences"],
    queryFn: getPreferences,
  });

  return (
    <AppShell compact={preferences?.compactViewEnabled}>
      <div className="app-route-surface">
        <ErrorBoundary key={section} scope="section">
          <Switch>
            <Route path="/mail/folder/:folderId">
              <MailScreen />
            </Route>
            <Route path="/mail/:kind">
              <MailScreen />
            </Route>
            <Route path="/dashboard">
              <DashboardPage />
            </Route>
            <Route path="/settings/:section">
              <SettingsPage />
            </Route>
            <Route>
              <Redirect to="/mail/inbox" replace />
            </Route>
          </Switch>
        </ErrorBoundary>
      </div>
      {isComposeOpen && <ComposeWindow />}
      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
    </AppShell>
  );
}
