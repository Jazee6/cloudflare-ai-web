import * as v from "valibot";
import type { Model } from "@/lib/models";

export const MODEL_LAYOUT_STORAGE_KEY = "cf-ai-model-layout-v1";

const modelLayoutSchema = v.object({
  /** Model Catalog IDs the visitor has hidden from the model picker. */
  hidden: v.optional(v.array(v.string()), []),
  /** Keys of the Hidden Groups: groups whose models are all left out of the model picker. */
  hiddenGroups: v.optional(v.array(v.string()), []),
  /** Group keys: `default:<brand>` | `default:external` | `personal:<id>` | `custom:<uuid>`. */
  groupOrder: v.optional(v.array(v.string()), []),
  customGroups: v.optional(v.array(v.object({ id: v.string(), name: v.string() })), []),
  /** Model ID → `custom:<uuid>`; models without an assignment stay in their default group. */
  assignments: v.optional(v.record(v.string(), v.string()), {}),
  /** Group key → ordered model IDs. */
  modelOrder: v.optional(v.record(v.string(), v.array(v.string())), {}),
});

export type ModelLayout = v.InferOutput<typeof modelLayoutSchema>;

export interface ModelLayoutGroup {
  key: string;
  name: string;
  custom: boolean;
  /** Whether this is a Hidden Group. */
  hidden: boolean;
  models: Model[];
}

export const EMPTY_MODEL_LAYOUT: ModelLayout = {
  hidden: [],
  hiddenGroups: [],
  groupOrder: [],
  customGroups: [],
  assignments: {},
  modelOrder: {},
};

export const MAX_GROUP_NAME_LENGTH = 40;

export const customGroupKey = (id: string) => `custom:${id}`;

export const defaultGroupKey = (model: Model) => {
  switch (model.source) {
    case "personal":
      return `personal:${model.personalProviderId}`;
    case "external":
      return EXTERNAL_GROUP_KEY;
    default:
      return `default:${model.brand}`;
  }
};

/** The default group of External Models; its name is translated where it is shown. */
export const EXTERNAL_GROUP_KEY = "default:external";

export const defaultGroupName = (model: Model) => {
  switch (model.source) {
    case "personal":
      return model.personalProviderLabel ?? model.brand;
    case "external":
      return "External";
    default:
      return model.brand;
  }
};

const resolveGroupKey = (model: Model, layout: ModelLayout, customKeys: Set<string>) => {
  const assigned = layout.assignments[model.id];
  return assigned && customKeys.has(assigned) ? assigned : defaultGroupKey(model);
};

/**
 * Arranges the Model Catalog into the visitor's ordered Model Groups. Layout entries for models
 * or groups that are not in the catalog are ignored, so a catalog that fails to load temporarily
 * does not lose the layout. Empty custom groups are kept. Hidden Models and Hidden Groups are
 * dropped unless `includeHidden` asks for both; `includeHiddenGroups` keeps Hidden Groups but
 * still drops individually Hidden Models.
 */
export const applyModelLayout = (
  catalog: Model[],
  layout: ModelLayout,
  {
    includeHidden = false,
    includeHiddenGroups = includeHidden,
  }: { includeHidden?: boolean; includeHiddenGroups?: boolean } = {},
): { groups: ModelLayoutGroup[] } => {
  const customKeys = new Set(layout.customGroups.map((group) => customGroupKey(group.id)));
  const buckets = new Map<string, ModelLayoutGroup>();
  const defaultKeys: string[] = [];

  for (const group of layout.customGroups) {
    const key = customGroupKey(group.id);
    if (!buckets.has(key)) {
      buckets.set(key, { key, name: group.name, custom: true, hidden: false, models: [] });
    }
  }

  for (const model of catalog) {
    const key = resolveGroupKey(model, layout, customKeys);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { key, name: defaultGroupName(model), custom: false, hidden: false, models: [] };
      buckets.set(key, bucket);
      defaultKeys.push(key);
    }
    bucket.models.push(model);
  }

  const orderedKeys = [...new Set(layout.groupOrder)].filter((key) => buckets.has(key));
  const placed = new Set(orderedKeys);
  for (const key of [...defaultKeys, ...layout.customGroups.map((g) => customGroupKey(g.id))]) {
    if (!placed.has(key)) {
      placed.add(key);
      orderedKeys.push(key);
    }
  }

  const hidden = new Set(layout.hidden);
  const hiddenGroups = new Set(layout.hiddenGroups);
  const groups = orderedKeys.map((key) => {
    const bucket = buckets.get(key)!;
    const rank = new Map((layout.modelOrder[key] ?? []).map((id, index) => [id, index]));
    // Models with a stored position come first; new models follow in catalog order.
    const models = bucket.models
      .map((model, index) => ({ model, rank: rank.get(model.id) ?? rank.size + index }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ model }) => model)
      .filter((model) => includeHidden || !hidden.has(model.id));
    return { ...bucket, hidden: hiddenGroups.has(key), models };
  });

  return { groups: includeHiddenGroups ? groups : groups.filter((group) => !group.hidden) };
};

/** Visible models in layout order. */
export const getVisibleModels = (catalog: Model[], layout: ModelLayout) =>
  applyModelLayout(catalog, layout).groups.flatMap((group) => group.models);

const allGroups = (catalog: Model[], layout: ModelLayout) =>
  applyModelLayout(catalog, layout, { includeHidden: true }).groups;

/** The group's full order as displayed, keeping stored IDs of models missing from the catalog. */
const materializeOrder = (
  groups: ModelLayoutGroup[],
  layout: ModelLayout,
  catalogIds: Set<string>,
  key: string,
) => {
  const present = groups.find((group) => group.key === key)?.models.map((model) => model.id) ?? [];
  const stale = (layout.modelOrder[key] ?? []).filter((id) => !catalogIds.has(id));
  return [...present, ...stale];
};

const insertAt = <T>(items: T[], item: T, index = items.length) => {
  const next = [...items];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, item);
  return next;
};

export const setModelHidden = (layout: ModelLayout, modelId: string, hidden: boolean) => {
  const rest = layout.hidden.filter((id) => id !== modelId);
  return { ...layout, hidden: hidden ? [...rest, modelId] : rest };
};

/** Hides or shows a whole Model Group, leaving each model's own Hidden Model choice as it is. */
export const setGroupHidden = (layout: ModelLayout, key: string, hidden: boolean) => {
  const rest = layout.hiddenGroups.filter((candidate) => candidate !== key);
  return { ...layout, hiddenGroups: hidden ? [...rest, key] : rest };
};

/**
 * Moves a model to `index` within `targetKey`, which must be the model's default group or a
 * custom group. Without an index the model goes to the end of the group.
 */
export const moveModel = (
  layout: ModelLayout,
  catalog: Model[],
  modelId: string,
  targetKey: string,
  index?: number,
): ModelLayout => {
  const model = catalog.find((candidate) => candidate.id === modelId);
  if (!model) {
    return layout;
  }
  const isCustomTarget = layout.customGroups.some(
    (group) => customGroupKey(group.id) === targetKey,
  );
  if (!isCustomTarget && targetKey !== defaultGroupKey(model)) {
    return layout;
  }

  const groups = allGroups(catalog, layout);
  const catalogIds = new Set(catalog.map((candidate) => candidate.id));
  const sourceKey = groups.find((group) => group.models.includes(model))?.key ?? targetKey;
  const modelOrder = { ...layout.modelOrder };
  if (sourceKey !== targetKey) {
    modelOrder[sourceKey] = materializeOrder(groups, layout, catalogIds, sourceKey).filter(
      (id) => id !== modelId,
    );
  }
  const target = materializeOrder(groups, layout, catalogIds, targetKey).filter(
    (id) => id !== modelId,
  );
  modelOrder[targetKey] = insertAt(target, modelId, index);

  const assignments = { ...layout.assignments };
  if (isCustomTarget) {
    assignments[modelId] = targetKey;
  } else {
    delete assignments[modelId];
  }

  return { ...layout, assignments, modelOrder };
};

/** Moves a group to `index` among all groups. */
export const moveGroup = (
  layout: ModelLayout,
  catalog: Model[],
  key: string,
  index: number,
): ModelLayout => {
  const keys = allGroups(catalog, layout).map((group) => group.key);
  if (!keys.includes(key)) {
    return layout;
  }
  const stale = layout.groupOrder.filter((candidate) => !keys.includes(candidate));
  const ordered = insertAt(
    keys.filter((candidate) => candidate !== key),
    key,
    index,
  );
  return { ...layout, groupOrder: [...ordered, ...stale] };
};

/**
 * Places `ordered` into the slots that its items occupy in `full`, so items left out of `ordered`
 * (hidden models, groups with nothing to show) keep their positions.
 */
const reorderSubset = (full: string[], ordered: string[]) => {
  const subset = new Set(ordered);
  const queue = ordered.filter((item) => full.includes(item));
  return full.map((item) => (subset.has(item) ? (queue.shift() ?? item) : item));
};

/** Stores a new order for the shown models of a group, keeping hidden models where they were. */
export const reorderGroupModels = (
  layout: ModelLayout,
  catalog: Model[],
  key: string,
  orderedIds: string[],
): ModelLayout => {
  const groups = allGroups(catalog, layout);
  if (!groups.some((group) => group.key === key)) {
    return layout;
  }
  const catalogIds = new Set(catalog.map((model) => model.id));
  const full = materializeOrder(groups, layout, catalogIds, key);
  return {
    ...layout,
    modelOrder: { ...layout.modelOrder, [key]: reorderSubset(full, orderedIds) },
  };
};

/** Stores a new order for the shown groups, keeping the other groups where they were. */
export const reorderGroups = (
  layout: ModelLayout,
  catalog: Model[],
  orderedKeys: string[],
): ModelLayout => {
  const keys = allGroups(catalog, layout).map((group) => group.key);
  const stale = layout.groupOrder.filter((candidate) => !keys.includes(candidate));
  return { ...layout, groupOrder: [...reorderSubset(keys, orderedKeys), ...stale] };
};

/** Adds a custom group at the end of the group order. */
export const createCustomGroup = (
  layout: ModelLayout,
  catalog: Model[],
  group: { id: string; name: string },
): ModelLayout => {
  const keys = allGroups(catalog, layout).map((existing) => existing.key);
  const stale = layout.groupOrder.filter((candidate) => !keys.includes(candidate));
  return {
    ...layout,
    customGroups: [...layout.customGroups, group],
    groupOrder: [...keys, customGroupKey(group.id), ...stale],
  };
};

export const renameCustomGroup = (layout: ModelLayout, id: string, name: string): ModelLayout => ({
  ...layout,
  customGroups: layout.customGroups.map((group) => (group.id === id ? { ...group, name } : group)),
});

/** Deletes a custom group; its models return to the end of their default groups. */
export const deleteCustomGroup = (
  layout: ModelLayout,
  catalog: Model[],
  id: string,
): ModelLayout => {
  const key = customGroupKey(id);
  const groups = allGroups(catalog, layout);
  const catalogIds = new Set(catalog.map((model) => model.id));
  const modelOrder = { ...layout.modelOrder };
  delete modelOrder[key];

  const materialized = new Set<string>();
  for (const model of groups.find((group) => group.key === key)?.models ?? []) {
    const defaultKey = defaultGroupKey(model);
    if (!materialized.has(defaultKey)) {
      materialized.add(defaultKey);
      modelOrder[defaultKey] = materializeOrder(groups, layout, catalogIds, defaultKey);
    }
    modelOrder[defaultKey] = [...modelOrder[defaultKey]!, model.id];
  }

  return {
    ...layout,
    customGroups: layout.customGroups.filter((group) => group.id !== id),
    groupOrder: layout.groupOrder.filter((candidate) => candidate !== key),
    hiddenGroups: layout.hiddenGroups.filter((candidate) => candidate !== key),
    assignments: Object.fromEntries(
      Object.entries(layout.assignments).filter(([, assigned]) => assigned !== key),
    ),
    modelOrder,
  };
};

/** Whether the layout refers to models or groups that are no longer in the catalog. */
export const hasStaleLayoutEntries = (layout: ModelLayout, catalog: Model[]) => {
  const pruned = pruneModelLayout(layout, catalog);
  return JSON.stringify(pruned) !== JSON.stringify(layout);
};

/** Drops layout entries for models and groups that are no longer in the catalog. */
export const pruneModelLayout = (layout: ModelLayout, catalog: Model[]): ModelLayout => {
  const catalogIds = new Set(catalog.map((model) => model.id));
  const customKeys = new Set(layout.customGroups.map((group) => customGroupKey(group.id)));
  // A default group stays live while the catalog has a model for it, even if they all moved out.
  const groupKeys = new Set([...catalog.map(defaultGroupKey), ...customKeys]);

  return {
    hidden: layout.hidden.filter((id) => catalogIds.has(id)),
    hiddenGroups: layout.hiddenGroups.filter((key) => groupKeys.has(key)),
    groupOrder: layout.groupOrder.filter((key) => groupKeys.has(key)),
    customGroups: layout.customGroups,
    assignments: Object.fromEntries(
      Object.entries(layout.assignments).filter(
        ([id, key]) => catalogIds.has(id) && customKeys.has(key),
      ),
    ),
    modelOrder: Object.fromEntries(
      Object.entries(layout.modelOrder)
        .filter(([key]) => groupKeys.has(key))
        .map(([key, ids]) => [key, ids.filter((id) => catalogIds.has(id))]),
    ),
  };
};

export const parseModelLayout = (raw: string | null): ModelLayout => {
  if (!raw) {
    return EMPTY_MODEL_LAYOUT;
  }
  try {
    const parsed = v.safeParse(modelLayoutSchema, JSON.parse(raw));
    return parsed.success ? parsed.output : EMPTY_MODEL_LAYOUT;
  } catch {
    return EMPTY_MODEL_LAYOUT;
  }
};

export const readModelLayout = (): ModelLayout => {
  if (typeof window === "undefined") {
    return EMPTY_MODEL_LAYOUT;
  }
  try {
    return parseModelLayout(window.localStorage.getItem(MODEL_LAYOUT_STORAGE_KEY));
  } catch {
    return EMPTY_MODEL_LAYOUT;
  }
};

export const writeModelLayout = (layout: ModelLayout) => {
  try {
    window.localStorage.setItem(MODEL_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Ignore storage quota or private browsing failures.
  }
};
