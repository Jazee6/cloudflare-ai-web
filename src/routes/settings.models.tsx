import { createFileRoute } from "@tanstack/react-router";
import {
  BrushCleaningIcon,
  EyeOffIcon,
  FolderInputIcon,
  FolderPlusIcon,
  GripVerticalIcon,
  ImageIcon,
  LayersIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { type DragControls, Reorder, useDragControls } from "motion/react";
import { useState } from "react";
import { AddModelsDialog } from "@/components/add-models-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import { toast } from "@/components/ui/toast";
import { useDialogState } from "@/hooks/use-dialog-state";
import {
  createCustomGroup,
  defaultGroupKey,
  defaultGroupName,
  deleteCustomGroup,
  hasStaleLayoutEntries,
  type ModelLayoutGroup,
  moveModel,
  pruneModelLayout,
  renameCustomGroup,
  reorderGroupModels,
  reorderGroups,
  setModelHidden,
} from "@/lib/model-layout";
import type { Model } from "@/lib/models";

export const Route = createFileRoute("/settings/models")({ component: ModelSettings });

type GroupDialogData = { mode: "create" } | { mode: "rename"; id: string; name: string };
type GroupOption = { key: string; name: string };

const groupIdOf = (key: string) => key.slice("custom:".length);

const DRAG_TRANSITION = { type: "spring", stiffness: 600, damping: 40 } as const;
const WHILE_DRAG = { scale: 1.01, boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.2)" };

const DragHandle = ({ controls, label }: { controls: DragControls; label: string }) => (
  <span
    role="button"
    aria-label={label}
    className="flex cursor-grab touch-none items-center text-muted-foreground active:cursor-grabbing"
    onPointerDown={(event) => controls.start(event)}
  >
    <GripVerticalIcon className="size-4" />
  </span>
);

function ModelSettings() {
  const { models: catalog, loading, error, reload } = useModelCatalogState();
  const { layout, ready, updateLayout } = useModelLayout();
  const shownGroups = useModelGroups();
  const allGroups = useModelGroups({ includeHidden: true });
  const hidden = new Set(layout.hidden);
  const hiddenGroups = allGroups
    .map((group) => ({ ...group, models: group.models.filter((model) => hidden.has(model.id)) }))
    .filter((group) => group.models.length > 0);
  // Default groups whose models are all hidden have nothing to show; custom groups always do.
  const groups = shownGroups.filter((group) => group.custom || group.models.length > 0);
  const customGroups = groups.filter((group) => group.custom);
  const showCleanup =
    ready && !loading && catalog.length > 0 && hasStaleLayoutEntries(layout, catalog);

  const addDialog = useDialogState<true>();
  const groupDialog = useDialogState<GroupDialogData>();
  const deleteDialog = useDialogState<ModelLayoutGroup>();

  // Order shown while a group is dragged; committed when the drag ends.
  const [draftGroupOrder, setDraftGroupOrder] = useState<string[] | null>(null);
  const groupKeys = draftGroupOrder ?? groups.map((group) => group.key);
  const groupsByKey = new Map(groups.map((group) => [group.key, group]));

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
          <Button variant="outline" onClick={reload}>
            <RefreshCwIcon />
            Retry
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const commitGroupOrder = () => {
    if (draftGroupOrder) {
      const order = draftGroupOrder;
      updateLayout((current) => reorderGroups(current, catalog, order));
      setDraftGroupOrder(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={hiddenGroups.length === 0}
          onClick={() => addDialog.show(true)}
        >
          <PlusIcon />
          Add models
        </Button>
        <Button variant="outline" onClick={() => groupDialog.show({ mode: "create" })}>
          <FolderPlusIcon />
          New group
        </Button>
        {showCleanup && (
          <Button
            variant="ghost"
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

      <Reorder.Group
        as="div"
        axis="y"
        values={groupKeys}
        onReorder={setDraftGroupOrder}
        className="flex flex-col gap-4"
      >
        {groupKeys.map((key) => {
          const group = groupsByKey.get(key);
          return (
            group && (
              <GroupCard
                key={key}
                group={group}
                customGroups={customGroups}
                onDragEnd={commitGroupOrder}
                onReorder={(ids) =>
                  updateLayout((current) => reorderGroupModels(current, catalog, key, ids))
                }
                onMove={(model, target) =>
                  updateLayout((current) => moveModel(current, catalog, model.id, target))
                }
                onHide={(model) =>
                  updateLayout((current) => setModelHidden(current, model.id, true))
                }
                onRename={() =>
                  groupDialog.show({ mode: "rename", id: groupIdOf(key), name: group.name })
                }
                onDelete={() => deleteDialog.show(group)}
              />
            )
          );
        })}
      </Reorder.Group>

      <AddModelsDialog
        open={addDialog.open}
        onOpenChange={addDialog.onOpenChange}
        groups={hiddenGroups}
        onAdd={(ids) =>
          updateLayout((current) =>
            ids.reduce((next, id) => setModelHidden(next, id, false), current),
          )
        }
      />

      <ModelGroupDialog
        open={groupDialog.open}
        onOpenChange={groupDialog.onOpenChange}
        title={groupDialog.data?.mode === "rename" ? "Rename group" : "New group"}
        submitLabel={groupDialog.data?.mode === "rename" ? "Rename" : "Create"}
        initialName={groupDialog.data?.mode === "rename" ? groupDialog.data.name : ""}
        onSubmit={(name) => {
          const data = groupDialog.data;
          if (data?.mode === "rename") {
            updateLayout((current) => renameCustomGroup(current, data.id, name));
          } else {
            const id = crypto.randomUUID();
            updateLayout((current) => createCustomGroup(current, catalog, { id, name }));
          }
        }}
      />

      <AlertDialog open={deleteDialog.open} onOpenChange={deleteDialog.onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteDialog.data?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Its models return to their default groups.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const target = deleteDialog.data;
                if (target) {
                  updateLayout((current) =>
                    deleteCustomGroup(current, catalog, groupIdOf(target.key)),
                  );
                }
                deleteDialog.close();
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

function GroupCard({
  group,
  customGroups,
  onDragEnd,
  onReorder,
  onMove,
  onHide,
  onRename,
  onDelete,
}: {
  group: ModelLayoutGroup;
  customGroups: GroupOption[];
  onDragEnd: () => void;
  onReorder: (ids: string[]) => void;
  onMove: (model: Model, targetKey: string) => void;
  onHide: (model: Model) => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const controls = useDragControls();
  // Order shown while a model is dragged; committed when the drag ends.
  const [draftOrder, setDraftOrder] = useState<string[] | null>(null);
  const modelIds = draftOrder ?? group.models.map((model) => model.id);
  const modelsById = new Map(group.models.map((model) => [model.id, model]));

  const commitOrder = () => {
    if (draftOrder) {
      onReorder(draftOrder);
      setDraftOrder(null);
    }
  };

  return (
    <Reorder.Item
      as="section"
      value={group.key}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      transition={DRAG_TRANSITION}
      whileDrag={WHILE_DRAG}
      className="relative flex flex-col rounded-lg border bg-background"
    >
      <header className="flex h-10 items-center gap-2 border-b pr-2 pl-1">
        <DragHandle controls={controls} label={`Reorder ${group.name}`} />
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{group.name}</h2>
        {group.custom && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`${group.name} options`} />
              }
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onRename}>
                <PencilIcon />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {group.models.length === 0 ? (
        <p className="px-3 py-4 text-center text-sm text-muted-foreground">
          Move models here from their menu.
        </p>
      ) : (
        <Reorder.Group
          axis="y"
          values={modelIds}
          onReorder={setDraftOrder}
          className="flex flex-col py-1"
        >
          {modelIds.map((id) => {
            const model = modelsById.get(id);
            return (
              model && (
                <ModelRow
                  key={id}
                  model={model}
                  groupKey={group.key}
                  groupOptions={[
                    { key: defaultGroupKey(model), name: defaultGroupName(model) },
                    ...customGroups,
                  ]}
                  onDragEnd={commitOrder}
                  onMove={(target) => onMove(model, target)}
                  onHide={() => onHide(model)}
                />
              )
            );
          })}
        </Reorder.Group>
      )}
    </Reorder.Item>
  );
}

function ModelRow({
  model,
  groupKey,
  groupOptions,
  onDragEnd,
  onMove,
  onHide,
}: {
  model: Model;
  groupKey: string;
  groupOptions: GroupOption[];
  onDragEnd: () => void;
  onMove: (targetKey: string) => void;
  onHide: () => void;
}) {
  const controls = useDragControls();
  const canMove = groupOptions.length > 1;

  return (
    <Reorder.Item
      value={model.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      transition={DRAG_TRANSITION}
      whileDrag={WHILE_DRAG}
      className="relative flex h-9 items-center gap-2 rounded-md bg-background pr-2 pl-1"
    >
      <DragHandle controls={controls} label={`Reorder ${model.name}`} />
      <span className="flex size-4 shrink-0 items-center justify-center">
        <ModelLogo model={model} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{model.name}</span>
      {model.type === "Text to Image" && (
        <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`${model.name} options`} />}
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canMove && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInputIcon />
                Move to
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={groupKey}
                  onValueChange={(value) => {
                    if (typeof value === "string" && value !== groupKey) {
                      onMove(value);
                    }
                  }}
                >
                  {groupOptions.map((option) => (
                    <DropdownMenuRadioItem key={option.key} value={option.key}>
                      {option.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuItem onClick={onHide}>
            <EyeOffIcon />
            Hide
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Reorder.Item>
  );
}
