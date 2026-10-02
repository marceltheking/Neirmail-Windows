import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  listSessions,
  revokeSession,
  revokeAllOtherSessions,
} from "../../lib/api/endpoints/settings";
import { formatFullDate } from "../../lib/format/date";
import { useToastStore } from "../../lib/state/toastStore";
import { Desktop, Fingerprint, SignOut } from "@phosphor-icons/react";
import { Button } from "../ui/Button";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { ApiError } from "../../lib/api/types";
import type { SessionSummary } from "../../lib/api/types";
import { ConfirmationDialog } from "../shared/ConfirmationDialog";
import { useState } from "react";

export function SessionsTab() {
  const [sessionToRevoke, setSessionToRevoke] = useState<SessionSummary | "others" | null>(null);
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.show);

  const sessionsQuery = useQuery({ queryKey: ["sessions"], queryFn: listSessions });
  const sessions = sessionsQuery.data ?? [];

  const revokeOne = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      setSessionToRevoke(null);
      showToast("Session revoked");
    },
    onError: () => showToast("Could not revoke that session."),
  });

  const revokeOthers = useMutation({
    mutationFn: revokeAllOtherSessions,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      setSessionToRevoke(null);
      showToast(`Revoked ${result.revoked} other session${result.revoked === 1 ? "" : "s"}`);
    },
    onError: () => showToast("Could not revoke the other sessions."),
  });

  return (
    <div className="settings-tab settings-tab-v2">
      <header className="settings-section-head">
        <div className="settings-section-icon">
          <Fingerprint weight="duotone" />
        </div>
        <div>
          <h1>Active sessions</h1>
          <p>Review and revoke devices currently signed into your account.</p>
        </div>
      </header>
      <section className="settings-section-card">
        <div className="settings-card-head">
          <div>
            <h2>Signed-in devices</h2>
            <p>Your current Neir Mail session cannot be revoked from this page.</p>
          </div>
          <Button
            variant="secondary"
            icon={<SignOut />}
            loading={revokeOthers.isPending}
            disabled={sessions.filter((session) => !session.isCurrent).length === 0}
            onClick={() => setSessionToRevoke("others")}
          >
            Sign out others
          </Button>
        </div>
        <div className="settings-list">
          {sessionsQuery.isPending ? (
            <Skeleton lines={3} />
          ) : sessionsQuery.isError ? (
            <ErrorState
              title="Sessions could not be loaded"
              description={
                sessionsQuery.error instanceof ApiError
                  ? sessionsQuery.error.message
                  : "Check your connection and try again."
              }
              onRetry={() => void sessionsQuery.refetch()}
            />
          ) : sessions.length === 0 ? (
            <EmptyState
              icon={<Desktop />}
              title="No sessions found"
              description="Signed-in devices will appear here."
            />
          ) : null}
          {!sessionsQuery.isError &&
            sessions.map((session) => (
              <div key={session.id} className="settings-row">
                <div>
                  <div className="settings-row-title">
                    {session.device}
                    {session.isCurrent && <span className="settings-badge">This device</span>}
                  </div>
                  <div className="settings-row-sub">
                    Last active {formatFullDate(session.lastActiveAt)}
                  </div>
                </div>
                {!session.isCurrent && (
                  <Button
                    variant="ghost"
                    loading={revokeOne.isPending}
                    onClick={() => setSessionToRevoke(session)}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
        </div>
      </section>
      {sessionToRevoke && (
        <ConfirmationDialog
          title={
            sessionToRevoke === "others"
              ? "Sign out every other device?"
              : `Revoke “${sessionToRevoke.device}”?`
          }
          description={
            sessionToRevoke === "others"
              ? "Every other Neir session will need the Account Key and 2FA, if enabled, to sign in again."
              : "That device will be signed out of Neir immediately."
          }
          confirmLabel={sessionToRevoke === "others" ? "Sign out others" : "Revoke session"}
          busy={revokeOne.isPending || revokeOthers.isPending}
          onCancel={() => setSessionToRevoke(null)}
          onConfirm={() =>
            sessionToRevoke === "others"
              ? revokeOthers.mutate()
              : revokeOne.mutate(sessionToRevoke.id)
          }
          danger={false}
        />
      )}
    </div>
  );
}
