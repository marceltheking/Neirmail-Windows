import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArchiveBoxIcon,
  ArrowClockwise,
  Broom,
  Envelope,
  EnvelopeOpen,
  FolderSimple,
  MagnifyingGlass,
  Trash,
} from "@phosphor-icons/react";
import type { Folder, NavKind } from "../../lib/api/types";
import { Checkbox } from "../ui/Checkbox";
import { IconButton } from "../ui/IconButton";
import { Select } from "../ui/Select";

interface MailToolbarProps {
  navKind: NavKind;
  folders: Folder[];
  currentFolderId: string | null;
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
  sort: "date_desc" | "date_asc" | "subject_asc";
  onSortChange: (sort: "date_desc" | "date_asc" | "subject_asc") => void;
  onSearch: (query: string) => void;
  onToggleSelectAll: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onArchiveToggle: () => void;
  onTrash: () => void;
  onMove: (folderId: string) => void;
  onEmpty: () => void;
  onRefresh: () => void;
}

export function MailToolbar(props: MailToolbarProps) {
  const hasSelection = props.selectedCount > 0;
  const canEmpty =
    props.navKind === "trash" || props.navKind === "spam" || props.navKind === "folder";
  const moveTargets = props.folders.filter(
    (folder) => folder.type !== "starred" && folder.id !== props.currentFolderId,
  );
  return (
    <div className="wm-toolbar">
      <div className="wm-toolbar-l">
        <Checkbox
          checked={props.allSelected ? true : props.someSelected ? "indeterminate" : false}
          onCheckedChange={props.onToggleSelectAll}
          label="Select all messages"
        />
        <span className="wm-tb-div" />
        <IconButton
          label="Mark read"
          icon={<EnvelopeOpen />}
          disabled={!hasSelection}
          onClick={props.onMarkRead}
        />
        <IconButton
          label="Mark unread"
          icon={<Envelope />}
          disabled={!hasSelection}
          onClick={props.onMarkUnread}
        />
        <IconButton
          label={props.navKind === "archive" ? "Unarchive" : "Archive"}
          icon={<ArchiveBoxIcon />}
          disabled={!hasSelection}
          onClick={props.onArchiveToggle}
        />
        <IconButton
          danger
          label="Move to trash"
          icon={<Trash />}
          disabled={!hasSelection}
          onClick={props.onTrash}
        />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild disabled={!hasSelection}>
            <span>
              <IconButton label="Move to folder" icon={<FolderSimple />} disabled={!hasSelection} />
            </span>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="wm-move-menu-v2" sideOffset={6} align="start">
              {moveTargets.map((folder) => (
                <DropdownMenu.Item
                  className="wm-move-item-v2"
                  key={folder.id}
                  onSelect={() => props.onMove(folder.id)}
                >
                  <FolderSimple />
                  {folder.name}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        {canEmpty && (
          <IconButton danger label="Empty folder" icon={<Broom />} onClick={props.onEmpty} />
        )}
        <IconButton label="Refresh" icon={<ArrowClockwise />} onClick={props.onRefresh} />
        {props.selectedCount > 0 && (
          <span className="wm-selected-count">{props.selectedCount} selected</span>
        )}
      </div>
      <div className="wm-toolbar-r">
        <label className="wm-search-box">
          <MagnifyingGlass />
          <input
            id="mail-search"
            type="search"
            placeholder="Search mail"
            aria-label="Search mail"
            onChange={(event) => props.onSearch(event.target.value)}
          />
        </label>
        <Select
          label="Sort messages"
          value={props.sort}
          onValueChange={(value) => props.onSortChange(value as typeof props.sort)}
          options={[
            { value: "date_desc", label: "Newest" },
            { value: "date_asc", label: "Oldest" },
            { value: "subject_asc", label: "Subject" },
          ]}
        />
      </div>
    </div>
  );
}
