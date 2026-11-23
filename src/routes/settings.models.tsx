import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BrushCleaningIcon,
  GripVerticalIcon,
  ImageIcon,
  LayersIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react";
import { type DragEvent, useMemo, useState } from "react";
import { useModelCatalogState } from "@/components/model-catalog-provider";
import { ModelGroupDialog } from "@/components/model-group-dialog";
import { useModelGroups, useModelLayout } from "@/components/model-layout-provider";
import { ModelLogo } from "@/components/model-logo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import {
  createCustomGroup,
  defaultGroupKey,
  defaultGroupName,
  deleteCustomGroup,
  hasStaleLayoutEntries,
  type ModelLayoutGroup,
  moveGroup,
  moveModel,
  pruneModelLayout,
  renameCustomGroup,
  setModelHidden,
} from "@/lib/model-layout";
import type { Model } from "@/lib/models";

export const Route = createFileRoute("/settings/models")({ component: ModelSettings });

type Dragging = { kind: "model"; model: Model } | { kind: "group"; key: string } | null;
type GroupDialog = { mode: "create" } | { mode: "rename"; id: string; name: string } | null;

const groupIdOf = (key: string) => key.slice("custom:".length);

function ModelSettings() {
  const { models: catalog, loading, error, reload } = useModelCatalogState();
  const { layout, ready, updateLayout } = useModelLayout();
  const groups = useModelGroups({ includeHidden: true });
  const hidden = useMemo(() => new Set(layout.hidden), [layout.hidden]);
  const customGroups = groups.filter((group) => group.custom);
  const showCleanup = ready && catalog.length > 0 && hasStaleLayoutEntries(layout, catalog);

  const [groupDialog, setGroupDialog] = useState<GroupDialog>(null);
  const [deleteTarget, setDeleteTarget] = useState<ModelLayoutGroup | null>(null);
  const [dragging, setDragging] = useState<Dragging>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const canDropModel = (model: Model, groupKey: string) =>
    groupKey.startsWith("custom:") || groupKey === defaultGroupKey(model);

  const endDrag = () => {
    setDragging(null);
    setDropTarget(null);
  };

  /** Drops the dragged model before `beforeId`, or at the end of the group. */
  const dropModel = (group: ModelLayoutGroup, beforeId?: string) => {
    if (dragging?.kind !== "model" || !canDropModel(dragging.model, group.key)) {
      return;
    }
    const { model } = dragging;
    const rest = group.models.filter((candidate) => candidate.id !== model.id);
    const index = beforeId ? rest.findIndex((candidate) => candidate.id === beforeId) : rest.length;
    updateLayout((current) =>
      moveModel(current, catalog, model.id, group.key, index < 0 ? rest.length : index),
    );
  };

  const dropGroup = (beforeKey: string) => {
    if (dragging?.kind !== "group" || dragging.key === beforeKey) {
      return;
    }
    const rest = groups.filter((group) => group.key !== dragging.key);
    const index = rest.findIndex((group) => group.key === beforeKey);
    updateLayout((current) => moveGroup(current, catalog, dragging.key, index));
  };

  const allowDrop = (event: DragEvent, target: string, allowed: boolean) => {
    if (!allowed) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTarget(target);
  };

  if (!ready || (loading && catalog.length === 0)) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
    );
  }

  if (catalog.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayersIcon />
          </EmptyMedia>
          <EmptyTitle>No models available</EmptyTitle>
          {error && <EmptyDescription>{error}</EmptyDescription>}
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCwIcon />
            Retry
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setGroupDialog({ mode: "create" })}>
          <PlusIcon />
          New group
        </Button>
        {showCleanup && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              updateLayout((current) => pruneModelLayout(current, catalog));
              toast.add({ title: "Removed entries for unavailable models.", type: "success" });
            }}
          >
            <BrushCleaningIcon />
            Clean up unavailable models
          </Button>
        )}
      </div>

      {groups.map((group, groupIndex) => (
        <section
          key={group.key}
          className="flex flex-col rounded-lg border data-[drop-target=true]:border-primary"
          data-drop-target={dropTarget === group.key}
          onDragOver={(event) => {
            if (dragging?.kind === "group") {
              allowDrop(event, group.key, dragging.key !== group.key);
            } else if (dragging?.kind === "model") {
              allowDrop(event, group.key, canDropModel(dragging.model, group.key));
            }
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setDropTarget((current) => (current === group.key ? null : current));
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (dragging?.kind === "group") {
              dropGroup(group.key);
            } else {
              dropModel(group);
            }
            endDrag();
          }}
        >
          <header className="flex items-center gap-2 border-b py-1.5 pr-2 pl-1">
            <span
              draggable
              className="flex cursor-grab items-center text-muted-foreground"
              aria-hidden
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", group.key);
                setDragging({ kind: "group", key: group.key });
              }}
              onDragEnd={endDrag}
            >
              <GripVerticalIcon className="size-4" />
            </span>
            <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{group.name}</h2>
            <ButtonGroup>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Move ${group.name} up`}
                disabled={groupIndex === 0}
                onClick={() =>
                  updateLayout((current) => moveGroup(current, catalog, group.key, groupIndex - 1))
                }
              >
                <ArrowUpIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Move ${group.name} down`}
                disabled={groupIndex === groups.length - 1}
                onClick={() =>
                  updateLayout((current) => moveGroup(current, catalog, group.key, groupIndex + 1))
                }
              >
                <ArrowDownIcon />
              </Button>
            </ButtonGroup>
            {group.custom && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-xs" aria-label={`${group.name} options`} />
                  }
                >
                  <MoreHorizontalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      setGroupDialog({ mode: "rename", id: groupIdOf(group.key), name: group.name })
                    }
                  >
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(group)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </header>

          {group.models.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              Drag models here or use a model’s menu.
            </p>
          ) : (
            <ul className="flex flex-col py-1">
              {group.models.map((model, modelIndex) => {
                const groupOptions = [
                  { key: defaultGroupKey(model), name: defaultGroupName(model) },
                  ...customGroups.map((custom) => ({ key: custom.key, name: custom.name })),
                ];
                const rowKey = `${group.key}|${model.id}`;
                return (
                  <li
                    key={model.id}
                    className="flex items-center gap-2 py-1 pr-2 pl-1 data-[drop-target=true]:shadow-[inset_0_2px_0_var(--primary)]"
                    data-drop-target={dropTarget === rowKey}
                    onDragOver={(event) => {
                      if (dragging?.kind === "model") {
                        event.stopPropagation();
                        allowDrop(
                          event,
                          rowKey,
                          dragging.model.id !== model.id && canDropModel(dragging.model, group.key),
                        );
                      }
                    }}
                    onDrop={(event) => {
                      if (dragging?.kind === "model") {
                        event.preventDefault();
                        event.stopPropagation();
                        dropModel(group, model.id);
                        endDrag();
                      }
                    }}
                  >
                    <span
                      draggable
                      className="flex cursor-grab items-center text-muted-foreground"
                      aria-hidden
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", model.id);
                        setDragging({ kind: "model", model });
                      }}
                      onDragEnd={endDrag}
                    >
                      <GripVerticalIcon className="size-4" />
                    </span>
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      <ModelLogo model={model} />
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate text-sm data-[hidden=true]:text-muted-foreground"
                      data-hidden={hidden.has(model.id)}
                    >
                      {model.name}
                    </span>
                    {model.type === "Text to Image" && (
                      <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <ButtonGroup>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Move ${model.name} up`}
                        disabled={modelIndex === 0}
                        onClick={() =>
                          updateLayout((current) =>
                            moveModel(current, catalog, model.id, group.key, modelIndex - 1),
                          )
                        }
                      >
                        <ArrowUpIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Move ${model.name} down`}
                        disabled={modelIndex === group.models.length - 1}
                        onClick={() =>
                          updateLayout((current) =>
                            moveModel(current, catalog, model.id, group.key, modelIndex + 1),
                          )
                        }
                      >
                        <ArrowDownIcon />
                      </Button>
                    </ButtonGroup>
                    {customGroups.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Move ${model.name} to group`}
                            />
                          }
                        >
                          <MoreHorizontalIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>Move to</DropdownMenuLabel>
                            <DropdownMenuRadioGroup
                              value={group.key}
                              onValueChange={(value) => {
                                if (typeof value === "string" && value !== group.key) {
                                  updateLayout((current) =>
                                    moveModel(current, catalog, model.id, value),
                                  );
                                }
                              }}
                            >
                              {groupOptions.map((option) => (
                                <DropdownMenuRadioItem key={option.key} value={option.key}>
                                  {option.name}
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <Switch
                      size="sm"
                      aria-label={`Show ${model.name}`}
                      checked={!hidden.has(model.id)}
                      onCheckedChange={(checked) =>
                        updateLayout((current) => setModelHidden(current, model.id, !checked))
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}

      <ModelGroupDialog
        open={groupDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setGroupDialog(null);
          }
        }}
        title={groupDialog?.mode === "rename" ? "Rename group" : "New group"}
        submitLabel={groupDialog?.mode === "rename" ? "Rename" : "Create"}
        initialName={groupDialog?.mode === "rename" ? groupDialog.name : ""}
        onSubmit={(name) => {
          if (groupDialog?.mode === "rename") {
            const { id } = groupDialog;
            updateLayout((current) => renameCustomGroup(current, id, name));
          } else {
            const id = crypto.randomUUID();
            updateLayout((current) => createCustomGroup(current, catalog, { id, name }));
          }
        }}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Its models return to their default groups.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  const id = groupIdOf(deleteTarget.key);
                  updateLayout((current) => deleteCustomGroup(current, catalog, id));
                }
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
