import { createFileRoute } from "@tanstack/react-router";
import {
  BrushCleaningIcon,
  CircleDollarSignIcon,
  EyeIcon,
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
import { ModelPriceDialog } from "@/components/model-price-dialog";
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
import { Badge } from "@/components/ui/badge";
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
  EXTERNAL_GROUP_KEY,
  hasStaleLayoutEntries,
  type ModelLayoutGroup,
  moveModel,
  pruneModelLayout,
  renameCustomGroup,
  reorderGroupModels,
  reorderGroups,
  setGroupHidden,
  setModelHidden,
} from "@/lib/model-layout";
import { canDeclareModelPrice } from "@/lib/model-prices";
import type { Model } from "@/lib/models";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/use-i18n";

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
  const { t } = useI18n();
  const { models: catalog, loading, error, reload } = useModelCatalogState();
  const { layout, ready, updateLayout } = useModelLayout();
  // Hidden Groups stay listed here so they can be shown again; Hidden Models do not.
  const shownGroups = useModelGroups({ includeHiddenGroups: true });
  const allGroups = useModelGroups({ includeHidden: true });
  const hidden = new Set(layout.hidden);
  const groupsWithHiddenModels = allGroups
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
  const priceDialog = useDialogState<Model>();

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
          <EmptyTitle>{t("modelSelect.none")}</EmptyTitle>
          {error && <EmptyDescription>{error}</EmptyDescription>}
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={reload}>
            <RefreshCwIcon />
            {t("common.retry")}
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
          disabled={groupsWithHiddenModels.length === 0}
          onClick={() => addDialog.show(true)}
        >
          <PlusIcon />
          {t("addModels.title")}
        </Button>
        <Button variant="outline" onClick={() => groupDialog.show({ mode: "create" })}>
          <FolderPlusIcon />
          {t("settings.models.newGroup")}
        </Button>
        {showCleanup && (
          <Button
            variant="ghost"
            onClick={() => {
              updateLayout((current) => pruneModelLayout(current, catalog));
              toast.add({ title: t("settings.models.cleanedUp"), type: "success" });
            }}
          >
            <BrushCleaningIcon />
            {t("settings.models.cleanUp")}
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
                onSetPrice={(model) => priceDialog.show(model)}
                onToggleHidden={() =>
                  updateLayout((current) => setGroupHidden(current, key, !group.hidden))
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
        groups={groupsWithHiddenModels}
        onAdd={(ids) =>
          updateLayout((current) =>
            ids.reduce((next, id) => setModelHidden(next, id, false), current),
          )
        }
      />

      <ModelPriceDialog
        model={priceDialog.data ?? undefined}
        open={priceDialog.open}
        onOpenChange={priceDialog.onOpenChange}
      />

      <ModelGroupDialog
        open={groupDialog.open}
        onOpenChange={groupDialog.onOpenChange}
        title={
          groupDialog.data?.mode === "rename"
            ? t("settings.models.renameGroup")
            : t("settings.models.newGroup")
        }
        submitLabel={
          groupDialog.data?.mode === "rename"
            ? t("settings.models.rename")
            : t("settings.models.create")
        }
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
            <AlertDialogTitle>
              {t("settings.models.deleteGroupTitle", { name: deleteDialog.data?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.models.deleteGroupDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
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
              {t("common.delete")}
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
  onSetPrice,
  onToggleHidden,
  onRename,
  onDelete,
}: {
  group: ModelLayoutGroup;
  customGroups: GroupOption[];
  onDragEnd: () => void;
  onReorder: (ids: string[]) => void;
  onMove: (model: Model, targetKey: string) => void;
  onHide: (model: Model) => void;
  onSetPrice: (model: Model) => void;
  onToggleHidden: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
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
        <DragHandle
          controls={controls}
          label={t("settings.models.reorder", { name: group.name })}
        />
        <h2
          className={cn(
            "min-w-0 flex-1 truncate text-sm font-medium",
            group.hidden && "text-muted-foreground",
          )}
        >
          {group.name}
        </h2>
        {group.hidden && <Badge variant="secondary">{t("settings.models.hidden")}</Badge>}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("settings.models.options", { name: group.name })}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onToggleHidden}>
              {group.hidden ? <EyeIcon /> : <EyeOffIcon />}
              {group.hidden ? t("settings.models.showGroup") : t("settings.models.hideGroup")}
            </DropdownMenuItem>
            {group.custom && (
              <>
                <DropdownMenuItem onClick={onRename}>
                  <PencilIcon />
                  {t("settings.models.rename")}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2Icon />
                  {t("common.delete")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {group.models.length === 0 ? (
        <p className="px-3 py-4 text-center text-sm text-muted-foreground">
          {t("settings.models.emptyGroup")}
        </p>
      ) : (
        <Reorder.Group
          axis="y"
          values={modelIds}
          onReorder={setDraftOrder}
          className={cn("flex flex-col py-1", group.hidden && "opacity-60")}
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
                    {
                      key: defaultGroupKey(model),
                      name:
                        defaultGroupKey(model) === EXTERNAL_GROUP_KEY
                          ? t("modelGroups.external")
                          : defaultGroupName(model),
                    },
                    ...customGroups,
                  ]}
                  onDragEnd={commitOrder}
                  onMove={(target) => onMove(model, target)}
                  onHide={() => onHide(model)}
                  onSetPrice={() => onSetPrice(model)}
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
  onSetPrice,
}: {
  model: Model;
  groupKey: string;
  groupOptions: GroupOption[];
  onDragEnd: () => void;
  onMove: (targetKey: string) => void;
  onHide: () => void;
  onSetPrice: () => void;
}) {
  const { t } = useI18n();
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
      <DragHandle controls={controls} label={t("settings.models.reorder", { name: model.name })} />
      <span className="flex size-4 shrink-0 items-center justify-center">
        <ModelLogo model={model} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{model.name}</span>
      {model.type === "Text to Image" && (
        <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("settings.models.options", { name: model.name })}
            />
          }
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canMove && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInputIcon />
                {t("settings.models.moveTo")}
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
          {canDeclareModelPrice(model) && (
            <DropdownMenuItem onClick={onSetPrice}>
              <CircleDollarSignIcon />
              {t("settings.models.setPrice")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onHide}>
            <EyeOffIcon />
            {t("settings.models.hide")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Reorder.Item>
  );
}
