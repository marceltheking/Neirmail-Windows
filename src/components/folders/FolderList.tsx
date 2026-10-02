import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArchiveBoxIcon,
  FileText,
  Folder as FolderIcon,
  PaperPlaneTilt,
  Plus,
  ShieldWarning,
  Star,
  Trash,
  Tray,
  X,
} from "@phosphor-icons/react";
import { createFolder, deleteFolder } from "../../lib/api/endpoints/folders";
import { SYSTEM_NAV, folderByType, navBadgeCount } from "../../lib/mail/navigation";
import { useMailStore } from "../../lib/state/mailStore";
import { useToastStore } from "../../lib/state/toastStore";
import { FolderModal } from "./FolderModal";
import { ConfirmationDialog } from "../shared/ConfirmationDialog";
import { ApiError, type Folder as MailFolder } from "../../lib/api/types";
import { IconButton } from "../ui/IconButton";

const systemIcons = {
  inbox: Tray,
  starred: Star,
  sent: PaperPlaneTilt,
  drafts: FileText,
  spam: ShieldWarning,
  archive: ArchiveBoxIcon,
  trash: Trash,
} as const;

export function FolderList({ folders }: { folders: MailFolder[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<MailFolder | null>(null);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const nav = useMailStore((state) => state.nav);
  const setNav = useMailStore((state) => state.setNav);
  const showToast = useToastStore((state) => state.show);

  const deleteMutation = useMutation({
    mutationFn: deleteFolder,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setFolderToDelete(null);
      if (nav.kind === "folder" && nav.folderId === deletedId) {
        setNav({ kind: "inbox", folderId: folderByType(folders, "inbox")?.id ?? null });
        navigate("/mail/inbox");
      }
      showToast("Folder deleted");
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : "Could not delete that folder.");
    },
  });

  const customFolders = folders.filter((folder) => folder.type === "custom");

  return (
    <>
      <ul className="wm-folders">
        {SYSTEM_NAV.map((item) => {
          const folder = folderByType(folders, item.type);
          const badge = navBadgeCount(item.type, folder);
          const active = nav.kind === item.type;
          const Icon = systemIcons[item.type];
          return (
            <li key={item.type}>
              <button
                type="button"
                className={"wm-fi" + (active ? " active" : "")}
                onClick={() => {
                  setNav({ kind: item.type, folderId: folder?.id ?? null });
                  navigate(`/mail/${item.type}`);
                }}
              >
                <Icon className="fold-ico" weight={active ? "fill" : "regular"} />
                <span className="fold-name">{item.name}</span>
                {badge > 0 && (
                  <span className={"wm-badge" + (item.type === "inbox" ? " new" : "")}>
                    {badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="wm-side-label">
        <span>Folders</span>
        <IconButton
          className="wm-side-add"
          label="New folder"
          tooltipSide="right"
          icon={<Plus weight="bold" />}
          onClick={() => setShowCreate(true)}
        />
      </div>
      <ul className="wm-folders">
        {customFolders.map((folder) => (
          <li key={folder.id} className="wm-folder-entry">
            <button
              type="button"
              className={
                "wm-fi" + (nav.kind === "folder" && nav.folderId === folder.id ? " active" : "")
              }
              onClick={() => {
                setNav({ kind: "folder", folderId: folder.id });
                navigate(`/mail/folder/${folder.id}`);
              }}
            >
              <FolderIcon className="fold-ico" weight="regular" />
              <span className="fold-name">{folder.name}</span>
              {folder.totalCount > 0 && <span className="wm-badge">{folder.totalCount}</span>}
            </button>
            <IconButton
              className="wm-fold-del"
              danger
              label={`Delete ${folder.name}`}
              tooltipSide="right"
              icon={<X weight="bold" />}
              onClick={() => setFolderToDelete(folder)}
            />
          </li>
        ))}
      </ul>
      {showCreate && (
        <FolderModal
          onClose={() => setShowCreate(false)}
          onCreate={async (name) => {
            await createFolder(name);
            queryClient.invalidateQueries({ queryKey: ["folders"] });
          }}
        />
      )}
      {folderToDelete && (
        <ConfirmationDialog
          title={`Delete “${folderToDelete.name}”?`}
          description="The custom folder will be removed. Messages in it may no longer be grouped there."
          confirmLabel="Delete folder"
          busy={deleteMutation.isPending}
          onCancel={() => setFolderToDelete(null)}
          onConfirm={() => deleteMutation.mutate(folderToDelete.id)}
          detail="This folder cannot be restored after deletion."
        />
      )}
    </>
  );
}
