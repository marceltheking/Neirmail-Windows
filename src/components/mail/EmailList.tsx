import { Fragment, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { listEmails, batchAction } from "../../lib/api/endpoints/emails";
import { emptyFolder } from "../../lib/api/endpoints/folders";
import { forgetCachedEmails } from "../../lib/cache/localCache";
import type { EmailListItem, Folder } from "../../lib/api/types";
import { navListParams, navQueryKey } from "../../lib/mail/navigation";
import { buildUndo } from "../../lib/mail/undo";
import { openSponsoredLink, sponsoredHost } from "../../lib/mail/sponsored";
import { useMailStore } from "../../lib/state/mailStore";
import { useToastStore } from "../../lib/state/toastStore";
import { EmailListRow } from "./EmailListRow";
import { ConfirmationDialog } from "../shared/ConfirmationDialog";
import { MailToolbar } from "./MailToolbar";
import { Button } from "../ui/Button";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { ApiError } from "../../lib/api/types";
import { useDebouncedValue } from "../../lib/hooks/useDebouncedValue";
import { useShortcuts } from "../../lib/hooks/useShortcuts";
import { dateGroupLabel } from "../../lib/format/date";
import { ArrowLeft, ArrowRight, EnvelopeSimple } from "@phosphor-icons/react";

const PAGE_LIMIT = 25;

interface EmailListProps {
  folders: Folder[];
}

export function EmailList({ folders }: EmailListProps) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "subject_asc">("date_desc");
  const [query, setQuery] = useState("");
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 260);

  const nav = useMailStore((state) => state.nav);
  const selectedIds = useMailStore((state) => state.selectedIds);
  const toggleSelected = useMailStore((state) => state.toggleSelected);
  const clearSelected = useMailStore((state) => state.clearSelected);
  const selectAll = useMailStore((state) => state.selectAll);
  const openEmail = useMailStore((state) => state.openEmail);
  const selectedEmailId = useMailStore((state) => state.selectedEmailId);
  const navKey = navQueryKey(nav);

  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.show);

  const params = {
    ...navListParams(nav, folders),
    sort,
    page,
    limit: PAGE_LIMIT,
    q: debouncedQuery || undefined,
  };
  const listKey = ["emails", navKey, nav.folderId, page, sort, debouncedQuery];

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: listKey,
    queryFn: () => listEmails(params),
  });

  const emails = data?.emails ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  const mailboxTitle =
    nav.kind === "folder"
      ? (folders.find((folder) => folder.id === nav.folderId)?.name ?? "Folder")
      : {
          inbox: "Inbox",
          starred: "Starred",
          sent: "Sent",
          drafts: "Drafts",
          spam: "Spam",
          archive: "Archive",
          trash: "Trash",
        }[nav.kind];

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ["emails"] });
    queryClient.invalidateQueries({ queryKey: ["folders"] });
  }

  const mutation = useMutation({
    mutationFn: ({
      ids,
      action,
      destinationFolderId,
    }: {
      ids: string[];
      action: Parameters<typeof batchAction>[1];
      destinationFolderId?: string;
    }) => batchAction(ids, action, destinationFolderId),
    onSuccess: (results, variables) => {
      clearSelected();
      setPage(1);
      refreshAll();
      const undo = buildUndo(results);
      const label =
        variables.action === "trash"
          ? "Trashed"
          : variables.action === "archive"
            ? "Archived"
            : variables.action === "unarchive"
              ? "Unarchived"
              : variables.action === "read"
                ? "Marked read"
                : variables.action === "unread"
                  ? "Marked unread"
                  : variables.action === "star"
                    ? "Starred"
                    : variables.action === "unstar"
                      ? "Unstarred"
                      : "Moved";
      showToast(`${label} ${results.length} message${results.length === 1 ? "" : "s"}`, {
        label: "Undo",
        onClick: () => {
          void undo()
            .then(refreshAll)
            .catch(() => showToast("Could not undo that action."));
        },
      });
    },
    onError: () => showToast("That action could not be completed."),
  });

  const emptyMutation = useMutation({
    mutationFn: emptyFolder,
    onSuccess: () => {
      void forgetCachedEmails(emails.map((email) => email.id));
      if (emails.some((email) => email.id === selectedEmailId)) openEmail(null);
      refreshAll();
      setPage(1);
      setConfirmEmpty(false);
      showToast("Folder emptied");
    },
    onError: () => showToast("Could not empty that folder."),
  });

  const ids = emails.filter((email) => !email.isPinned).map((email) => email.id);
  const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && ids.some((id) => selectedIds.has(id));

  const grouped = sort !== "subject_asc";

  function groupLabel(index: number): string {
    const email = emails[index];
    return email.isPinned ? "Pinned" : dateGroupLabel(email.receivedAt);
  }

  function step(delta: number) {
    const readable = emails.filter((email) => !sponsoredHost(email));
    if (readable.length === 0) return;
    const index = readable.findIndex((email) => email.id === selectedEmailId);
    const next = index === -1 ? (delta > 0 ? 0 : readable.length - 1) : index + delta;
    if (next < 0 || next >= readable.length) return;
    openEmail(readable[next].id);
    document
      .querySelector(`[data-email-id="${readable[next].id}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function open(email: EmailListItem) {
    if (!openSponsoredLink(email)) {
      openEmail(email.id);
      return;
    }
    if (!email.isRead) {
      void batchAction([email.id], "read")
        .then(refreshAll)
        .catch(() => undefined);
    }
  }

  useShortcuts({
    j: () => step(1),
    k: () => step(-1),
  });

  function toggleStar(id: string, next: boolean) {
    mutation.mutate({ ids: [id], action: next ? "star" : "unstar" });
  }

  return (
    <>
      <h1 className="sr-only">{mailboxTitle}</h1>
      <MailToolbar
        navKind={nav.kind}
        folders={folders}
        currentFolderId={nav.folderId}
        selectedCount={selectedIds.size}
        allSelected={allSelected}
        someSelected={someSelected}
        sort={sort}
        onSortChange={(value) => {
          clearSelected();
          setPage(1);
          setSort(value);
        }}
        onSearch={(value) => {
          setQuery(value);
          setPage(1);
          clearSelected();
        }}
        onToggleSelectAll={() => (allSelected ? clearSelected() : selectAll(ids))}
        onMarkRead={() => mutation.mutate({ ids: Array.from(selectedIds), action: "read" })}
        onMarkUnread={() => mutation.mutate({ ids: Array.from(selectedIds), action: "unread" })}
        onArchiveToggle={() =>
          mutation.mutate({
            ids: Array.from(selectedIds),
            action: nav.kind === "archive" ? "unarchive" : "archive",
          })
        }
        onTrash={() => mutation.mutate({ ids: Array.from(selectedIds), action: "trash" })}
        onMove={(folderId) =>
          mutation.mutate({
            ids: Array.from(selectedIds),
            action: "move",
            destinationFolderId: folderId,
          })
        }
        onEmpty={() => setConfirmEmpty(true)}
        onRefresh={refreshAll}
      />
      <div className="wm-list">
        {isLoading && <Skeleton lines={9} />}
        {isError && (
          <ErrorState
            title="Mail could not be loaded"
            description={
              error instanceof ApiError
                ? error.message
                : "Check your connection, then try this folder again."
            }
            onRetry={() => void refetch()}
          />
        )}
        {!isLoading && !isError && emails.length === 0 && (
          <EmptyState
            icon={<EnvelopeSimple weight="duotone" />}
            title={debouncedQuery ? "No matching messages" : "This folder is empty"}
            description={
              debouncedQuery
                ? "Try a different sender, subject, or search phrase."
                : "Messages placed here will appear immediately."
            }
          />
        )}
        {!isError &&
          emails.map((email, index) => (
            <Fragment key={email.id}>
              {grouped && (index === 0 || groupLabel(index) !== groupLabel(index - 1)) && (
                <div className="wm-list-group" role="presentation">
                  {groupLabel(index)}
                </div>
              )}
              <EmailListRow
                email={email}
                selected={selectedIds.has(email.id)}
                active={selectedEmailId === email.id}
                outgoing={nav.kind === "sent" || nav.kind === "drafts"}
                showSeen={nav.kind === "sent"}
                onToggleSelect={() => toggleSelected(email.id)}
                onOpen={() => open(email)}
                onToggleStar={() => toggleStar(email.id, !email.isStarred)}
              />
            </Fragment>
          ))}
      </div>
      {totalPages > 1 && (
        <div className="wm-pagination">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft />}
            disabled={page <= 1}
            onClick={() => {
              clearSelected();
              setPage((p) => p - 1);
            }}
          >
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowRight />}
            disabled={page >= totalPages}
            onClick={() => {
              clearSelected();
              setPage((p) => p + 1);
            }}
          >
            Next
          </Button>
        </div>
      )}
      {confirmEmpty && nav.folderId && (
        <ConfirmationDialog
          title="Empty this folder?"
          description="Every message currently in this folder will be permanently removed."
          confirmLabel="Empty folder"
          busy={emptyMutation.isPending}
          onCancel={() => setConfirmEmpty(false)}
          onConfirm={() => emptyMutation.mutate(nav.folderId!)}
          detail="This action cannot be undone."
        />
      )}
    </>
  );
}
