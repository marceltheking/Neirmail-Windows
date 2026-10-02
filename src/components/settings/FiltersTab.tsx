import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFilter,
  deleteFilter,
  listFilters,
  previewFilter,
  reorderFilters,
} from "../../lib/api/endpoints/filters";
import { listFolders } from "../../lib/api/endpoints/folders";
import type {
  CreateFilterInput,
  EmailFilter,
  FilterAction,
  FilterField,
  FilterMatchType,
} from "../../lib/api/types";
import { useToastStore } from "../../lib/state/toastStore";
import { ArrowDown, ArrowUp, FunnelSimple, Trash } from "@phosphor-icons/react";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { IconButton } from "../ui/IconButton";
import { Select } from "../ui/Select";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { ConfirmationDialog } from "../shared/ConfirmationDialog";
import { ApiError } from "../../lib/api/types";

const actionLabels: Record<FilterAction, string> = {
  star: "Star message",
  archive: "Archive message",
  trash: "Move to trash",
  markRead: "Mark as read",
  move: "Move to folder",
  deletePermanently: "Delete permanently",
};

export function FiltersTab() {
  const [field, setField] = useState<FilterField>("from");
  const [matchType, setMatchType] = useState<FilterMatchType>("contains");
  const [matchValue, setMatchValue] = useState("");
  const [action, setAction] = useState<FilterAction>("star");
  const [destinationFolderId, setDestinationFolderId] = useState("");
  const [preview, setPreview] = useState<number | null>(null);
  const [filterToDelete, setFilterToDelete] = useState<EmailFilter | null>(null);
  const [confirmPermanentFilter, setConfirmPermanentFilter] = useState(false);
  const client = useQueryClient();
  const toast = useToastStore((state) => state.show);
  const filterQuery = useQuery({ queryKey: ["filters"], queryFn: listFilters });
  const filters = filterQuery.data ?? [];
  const { data: folders = [] } = useQuery({ queryKey: ["folders"], queryFn: listFolders });
  const input: CreateFilterInput = {
    field,
    matchType,
    action,
    ...(field !== "attachment" && { matchValue: matchValue.trim() }),
    ...(action === "move" && { destinationFolderId }),
  };
  const formComplete =
    (field === "attachment" || Boolean(matchValue.trim())) &&
    (action !== "move" || Boolean(destinationFolderId));
  const refresh = () => client.invalidateQueries({ queryKey: ["filters"] });
  const add = useMutation({
    mutationFn: () => createFilter(input),
    onSuccess: () => {
      refresh();
      setMatchValue("");
      setPreview(null);
      setConfirmPermanentFilter(false);
      toast("Filter created");
    },
    onError: () => toast("Could not create that filter."),
  });
  const remove = useMutation({
    mutationFn: deleteFilter,
    onSuccess: () => {
      setFilterToDelete(null);
      refresh();
      toast("Filter deleted");
    },
    onError: () => toast("Could not delete that filter."),
  });
  const move = useMutation({
    mutationFn: ({ id, offset }: { id: string; offset: number }) => {
      const ids = filters.map((item) => item.id);
      const from = ids.indexOf(id);
      const to = from + offset;
      if (to < 0 || to >= ids.length) return Promise.resolve(filters);
      [ids[from], ids[to]] = [ids[to], ids[from]];
      return reorderFilters(ids);
    },
    onSuccess: (items) => client.setQueryData(["filters"], items),
    onError: () => toast("Could not reorder filters."),
  });
  const previewMutation = useMutation({
    mutationFn: () =>
      previewFilter({
        field,
        ...(field !== "attachment" && { matchType, matchValue: matchValue.trim() }),
      }),
    onSuccess: setPreview,
    onError: () => toast("Could not preview that filter."),
  });

  return (
    <div className="settings-tab settings-tab-v2">
      <header className="settings-section-head">
        <div className="settings-section-icon">
          <FunnelSimple weight="duotone" />
        </div>
        <div>
          <h1>Filters</h1>
          <p>Organize new mail automatically with ordered, predictable rules.</p>
        </div>
      </header>
      <section className="settings-section-card">
        <div className="settings-card-head">
          <div>
            <h2>Create a filter</h2>
            <p>Rules run from top to bottom when a message arrives.</p>
          </div>
        </div>
        <div className="settings-form-grid">
          <Select
            label="Message field"
            value={field}
            onValueChange={(value) => {
              setField(value as FilterField);
              setPreview(null);
            }}
            options={[
              { value: "from", label: "From" },
              { value: "subject", label: "Subject" },
              { value: "body", label: "Body" },
              { value: "attachment", label: "Has attachment" },
            ]}
          />
          {field !== "attachment" && (
            <>
              <Select
                label="Condition"
                value={matchType}
                onValueChange={(value) => {
                  setMatchType(value as FilterMatchType);
                  setPreview(null);
                }}
                options={[
                  { value: "contains", label: "Contains" },
                  { value: "exact", label: "Exactly equals" },
                  { value: "startsWith", label: "Starts with" },
                  { value: "endsWith", label: "Ends with" },
                ]}
              />
              <Field
                label="Match value"
                value={matchValue}
                onChange={(event) => {
                  setMatchValue(event.target.value);
                  setPreview(null);
                }}
                placeholder="Text to match"
              />
            </>
          )}
          <Select
            label="Action"
            value={action}
            onValueChange={(value) => setAction(value as FilterAction)}
            options={Object.entries(actionLabels).map(([value, label]) => ({ value, label }))}
          />
          {action === "move" && (
            <Select
              label="Destination"
              value={destinationFolderId}
              onValueChange={setDestinationFolderId}
              placeholder="Choose folder"
              options={folders
                .filter((folder) => folder.type !== "starred")
                .map((folder) => ({ value: folder.id, label: folder.name }))}
            />
          )}
        </div>
        <div className="settings-actions">
          <Button
            variant="secondary"
            loading={previewMutation.isPending}
            disabled={field !== "attachment" && !matchValue.trim()}
            onClick={() => previewMutation.mutate()}
          >
            Preview{preview !== null ? `: ${preview} matches` : ""}
          </Button>
          <Button
            loading={add.isPending}
            disabled={!formComplete}
            onClick={() =>
              action === "deletePermanently" ? setConfirmPermanentFilter(true) : add.mutate()
            }
          >
            Add filter
          </Button>
        </div>
      </section>
      <section className="settings-section-card">
        <div className="settings-card-head">
          <div>
            <h2>Active filters</h2>
            <p>Use the arrows to change which matching rule runs first.</p>
          </div>
        </div>
        <div className="settings-list">
          {filterQuery.isPending ? (
            <Skeleton lines={3} />
          ) : filterQuery.isError ? (
            <ErrorState
              title="Filters could not be loaded"
              description={
                filterQuery.error instanceof ApiError
                  ? filterQuery.error.message
                  : "Check your connection and try again."
              }
              onRetry={() => void filterQuery.refetch()}
            />
          ) : filters.length === 0 ? (
            <EmptyState
              icon={<FunnelSimple />}
              title="No filters yet"
              description="Create a rule above to organize new messages automatically."
            />
          ) : null}
          {!filterQuery.isError &&
            filters.map((filter, index) => (
              <div className="settings-list-row" key={filter.id}>
                <div>
                  <strong>
                    {filter.field === "attachment"
                      ? "Message has an attachment"
                      : `${filter.field} ${filter.matchType} “${filter.matchValue}”`}
                  </strong>
                  <span>{actionLabels[filter.action]}</span>
                </div>
                <div className="settings-row-actions">
                  <IconButton
                    label="Move filter up"
                    icon={<ArrowUp />}
                    disabled={index === 0 || move.isPending}
                    onClick={() => move.mutate({ id: filter.id, offset: -1 })}
                  />
                  <IconButton
                    label="Move filter down"
                    icon={<ArrowDown />}
                    disabled={index === filters.length - 1 || move.isPending}
                    onClick={() => move.mutate({ id: filter.id, offset: 1 })}
                  />
                  <IconButton
                    danger
                    label="Delete filter"
                    icon={<Trash />}
                    onClick={() => setFilterToDelete(filter)}
                  />
                </div>
              </div>
            ))}
        </div>
      </section>
      {filterToDelete && (
        <ConfirmationDialog
          title="Delete this filter?"
          description="New messages will stop using this rule."
          confirmLabel="Delete filter"
          busy={remove.isPending}
          onCancel={() => setFilterToDelete(null)}
          onConfirm={() => remove.mutate(filterToDelete.id)}
        />
      )}
      {confirmPermanentFilter && (
        <ConfirmationDialog
          title="Create a permanent-delete filter?"
          description="Every new message matching this rule will be deleted instead of moved to Trash."
          confirmLabel="Create delete filter"
          busy={add.isPending}
          onCancel={() => setConfirmPermanentFilter(false)}
          onConfirm={() => add.mutate()}
          detail="Deleted messages cannot be recovered or undone. Place this rule carefully in the filter order."
        />
      )}
    </div>
  );
}
