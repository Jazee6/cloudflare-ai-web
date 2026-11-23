import { expect, test } from "bun:test";
import {
  applyModelLayout,
  createCustomGroup,
  customGroupKey,
  deleteCustomGroup,
  EMPTY_MODEL_LAYOUT,
  getVisibleModels,
  hasStaleLayoutEntries,
  type ModelLayout,
  moveGroup,
  moveModel,
  parseModelLayout,
  pruneModelLayout,
  renameCustomGroup,
  reorderGroupModels,
  reorderGroups,
  setGroupHidden,
  setModelHidden,
} from "@/lib/model-layout";
import type { Model } from "@/lib/models";

const cf = (id: string, brand: string, type: Model["type"] = "Text Generation"): Model => ({
  id,
  name: id,
  brand,
  type,
  provider: "workers-ai",
  source: "cloudflare",
});

const ext = (id: string): Model => ({
  id,
  name: id,
  brand: "OpenAI",
  type: "Text Generation",
  provider: "ai-gateway",
  source: "external",
});

const catalog = [
  cf("meta-1", "Meta"),
  cf("qwen-1", "Qwen"),
  cf("meta-2", "Meta"),
  cf("flux", "Black Forest Labs", "Text to Image"),
  ext("openai/gpt"),
];

const shape = (layout: ModelLayout, models = catalog, includeHidden = false) =>
  applyModelLayout(models, layout, { includeHidden }).groups.map((group) => [
    group.key,
    group.models.map((model) => model.id),
  ]);

test("default layout groups by brand and External in catalog order", () => {
  expect(shape(EMPTY_MODEL_LAYOUT)).toEqual([
    ["default:Meta", ["meta-1", "meta-2"]],
    ["default:Qwen", ["qwen-1"]],
    ["default:Black Forest Labs", ["flux"]],
    ["default:external", ["openai/gpt"]],
  ]);
  expect(applyModelLayout(catalog, EMPTY_MODEL_LAYOUT).groups.at(-1)?.name).toBe("External");
});

test("hidden models are dropped unless requested", () => {
  const layout = setModelHidden(EMPTY_MODEL_LAYOUT, "meta-1", true);
  expect(shape(layout)[0]).toEqual(["default:Meta", ["meta-2"]]);
  expect(shape(layout, catalog, true)[0]).toEqual(["default:Meta", ["meta-1", "meta-2"]]);
  expect(setModelHidden(layout, "meta-1", false).hidden).toEqual([]);
});

test("new models join the end of their default group", () => {
  const layout = moveModel(EMPTY_MODEL_LAYOUT, catalog, "meta-2", "default:Meta", 0);
  expect(shape(layout)[0]).toEqual(["default:Meta", ["meta-2", "meta-1"]]);
  const grown = [cf("meta-0", "Meta"), ...catalog];
  expect(shape(layout, grown)[0]).toEqual(["default:Meta", ["meta-2", "meta-1", "meta-0"]]);
});

test("groups can be reordered and new groups are appended", () => {
  const layout = moveGroup(EMPTY_MODEL_LAYOUT, catalog, "default:external", 0);
  expect(shape(layout).map(([key]) => key)).toEqual([
    "default:external",
    "default:Meta",
    "default:Qwen",
    "default:Black Forest Labs",
  ]);
  const grown = [...catalog, cf("mistral", "Mistral")];
  expect(shape(layout, grown).at(-1)).toEqual(["default:Mistral", ["mistral"]]);
});

test("custom groups hold assigned models and keep their place", () => {
  let layout = createCustomGroup(EMPTY_MODEL_LAYOUT, catalog, { id: "fav", name: "Favorites" });
  const key = customGroupKey("fav");
  expect(shape(layout).at(-1)).toEqual([key, []]);

  layout = moveModel(layout, catalog, "qwen-1", key);
  layout = moveModel(layout, catalog, "meta-2", key, 0);
  layout = moveGroup(layout, catalog, key, 0);
  expect(shape(layout)).toEqual([
    [key, ["meta-2", "qwen-1"]],
    ["default:Meta", ["meta-1"]],
    ["default:Black Forest Labs", ["flux"]],
    ["default:external", ["openai/gpt"]],
  ]);
  layout = renameCustomGroup(layout, "fav", "Daily");
  expect(applyModelLayout(catalog, layout).groups[0]?.name).toBe("Daily");
});

test("models can only move to their default group or a custom group", () => {
  expect(moveModel(EMPTY_MODEL_LAYOUT, catalog, "meta-1", "default:Qwen")).toBe(EMPTY_MODEL_LAYOUT);
  expect(moveModel(EMPTY_MODEL_LAYOUT, catalog, "missing", "default:Meta")).toBe(
    EMPTY_MODEL_LAYOUT,
  );
});

test("deleting a custom group returns its models to the end of their default groups", () => {
  const key = customGroupKey("fav");
  let layout = createCustomGroup(EMPTY_MODEL_LAYOUT, catalog, { id: "fav", name: "Favorites" });
  layout = moveModel(layout, catalog, "meta-1", key);
  layout = moveModel(layout, catalog, "qwen-1", key);
  layout = deleteCustomGroup(layout, catalog, "fav");
  expect(layout.customGroups).toEqual([]);
  expect(layout.assignments).toEqual({});
  expect(layout.modelOrder[key]).toBeUndefined();
  expect(shape(layout)).toEqual([
    ["default:Meta", ["meta-2", "meta-1"]],
    ["default:Qwen", ["qwen-1"]],
    ["default:Black Forest Labs", ["flux"]],
    ["default:external", ["openai/gpt"]],
  ]);
});

test("assignments to deleted groups fall back to the default group", () => {
  const layout: ModelLayout = { ...EMPTY_MODEL_LAYOUT, assignments: { "meta-1": "custom:gone" } };
  expect(shape(layout)[0]).toEqual(["default:Meta", ["meta-1", "meta-2"]]);
});

test("entries for missing models are kept until pruned", () => {
  const key = customGroupKey("fav");
  let layout = createCustomGroup(EMPTY_MODEL_LAYOUT, catalog, { id: "fav", name: "Favorites" });
  layout = moveModel(layout, catalog, "meta-1", key);
  layout = setModelHidden(layout, "meta-1", true);
  layout = moveModel(layout, catalog, "meta-2", "default:Meta", 0);

  const shrunk = catalog.filter((model) => model.id !== "meta-1");
  expect(shape(layout, shrunk)[0]).toEqual(["default:Meta", ["meta-2"]]);
  // Reordering with a partial catalog keeps the missing model's entries.
  const reordered = moveModel(layout, shrunk, "qwen-1", key);
  expect(reordered.modelOrder[key]).toEqual(["meta-1", "qwen-1"]);
  expect(shape(reordered, catalog, true).find(([k]) => k === key)).toEqual([
    key,
    ["meta-1", "qwen-1"],
  ]);

  expect(hasStaleLayoutEntries(layout, shrunk)).toBe(true);
  const pruned = pruneModelLayout(layout, shrunk);
  expect(pruned.hidden).toEqual([]);
  expect(pruned.assignments).toEqual({});
  expect(pruned.modelOrder).toEqual({ [key]: [], "default:Meta": ["meta-2"] });
  expect(pruned.customGroups).toEqual(layout.customGroups);
  expect(hasStaleLayoutEntries(pruned, shrunk)).toBe(false);
});

test("parses stored layouts and rejects malformed ones", () => {
  expect(parseModelLayout(null)).toEqual(EMPTY_MODEL_LAYOUT);
  expect(parseModelLayout("{")).toEqual(EMPTY_MODEL_LAYOUT);
  expect(parseModelLayout('{"hidden":"x"}')).toEqual(EMPTY_MODEL_LAYOUT);
  expect(parseModelLayout('{"hidden":["a"]}')).toEqual({ ...EMPTY_MODEL_LAYOUT, hidden: ["a"] });
});

test("a default group emptied into a custom group is not stale", () => {
  const key = customGroupKey("fav");
  let layout = createCustomGroup(EMPTY_MODEL_LAYOUT, catalog, { id: "fav", name: "Favorites" });
  layout = moveModel(layout, catalog, "qwen-1", key);
  expect(hasStaleLayoutEntries(layout, catalog)).toBe(false);
  expect(pruneModelLayout(layout, catalog).groupOrder).toContain("default:Qwen");
});

test("each Personal Provider is a default group named after its label", () => {
  const personal = (id: string, providerId: string, label: string): Model => ({
    id,
    name: id,
    brand: "OpenAI",
    type: "Text Generation",
    provider: "ai-gateway",
    source: "personal",
    personalProviderId: providerId,
    personalProviderLabel: label,
  });
  const withPersonal = [
    ...catalog,
    personal("personal:a:gpt-5", "a", "Work"),
    personal("personal:b:gpt-5", "b", "Home"),
    personal("personal:a:gpt-5-mini", "a", "Work"),
  ];
  const groups = applyModelLayout(withPersonal, EMPTY_MODEL_LAYOUT).groups;
  expect(groups.slice(-2).map((group) => [group.key, group.name, group.models.length])).toEqual([
    ["personal:a", "Work", 2],
    ["personal:b", "Home", 1],
  ]);

  // A Personal Model can only move within its own provider's group or into a custom group.
  const moved = moveModel(EMPTY_MODEL_LAYOUT, withPersonal, "personal:a:gpt-5", "personal:b");
  expect(moved).toBe(EMPTY_MODEL_LAYOUT);
  const reordered = moveModel(
    EMPTY_MODEL_LAYOUT,
    withPersonal,
    "personal:a:gpt-5-mini",
    "personal:a",
    0,
  );
  expect(reordered.modelOrder["personal:a"]).toEqual(["personal:a:gpt-5-mini", "personal:a:gpt-5"]);
});

test("reordering shown models keeps hidden models in their slots", () => {
  const models = [...catalog, cf("meta-3", "Meta")];
  const hidden = setModelHidden(EMPTY_MODEL_LAYOUT, "meta-2", true);
  const layout = reorderGroupModels(hidden, models, "default:Meta", ["meta-3", "meta-1"]);
  expect(shape(layout, models, true)[0]).toEqual(["default:Meta", ["meta-3", "meta-2", "meta-1"]]);
  expect(shape(layout, models)[0]).toEqual(["default:Meta", ["meta-3", "meta-1"]]);
});

test("reordering shown groups keeps the other groups in their slots", () => {
  const layout = reorderGroups(EMPTY_MODEL_LAYOUT, catalog, [
    "default:external",
    "default:Meta",
    "default:Black Forest Labs",
  ]);
  expect(shape(layout).map(([key]) => key)).toEqual([
    "default:external",
    "default:Qwen",
    "default:Meta",
    "default:Black Forest Labs",
  ]);
});

test("a Hidden Group drops all its models, including new ones, and keeps model choices", () => {
  let layout = setModelHidden(EMPTY_MODEL_LAYOUT, "meta-1", true);
  layout = setGroupHidden(layout, "default:Meta", true);
  expect(shape(layout).map(([key]) => key)).not.toContain("default:Meta");

  const grown = [...catalog, cf("meta-3", "Meta")];
  expect(getVisibleModels(grown, layout).map((model) => model.id)).not.toContain("meta-3");

  const withGroups = applyModelLayout(catalog, layout, { includeHiddenGroups: true }).groups;
  const meta = withGroups.find((group) => group.key === "default:Meta");
  expect(meta?.hidden).toBe(true);
  expect(meta?.models.map((model) => model.id)).toEqual(["meta-2"]);

  const shown = setGroupHidden(layout, "default:Meta", false);
  expect(shape(shown)[0]).toEqual(["default:Meta", ["meta-2"]]);
});

test("a model moved out of a Hidden Group into a shown group is shown", () => {
  const key = customGroupKey("fav");
  let layout = createCustomGroup(EMPTY_MODEL_LAYOUT, catalog, { id: "fav", name: "Fav" });
  layout = setGroupHidden(layout, "default:Meta", true);
  layout = moveModel(layout, catalog, "meta-1", key);
  expect(getVisibleModels(catalog, layout).map((model) => model.id)).toContain("meta-1");
  expect(getVisibleModels(catalog, layout).map((model) => model.id)).not.toContain("meta-2");
});

test("Hidden Groups survive pruning while live and go with their custom group", () => {
  let layout = createCustomGroup(EMPTY_MODEL_LAYOUT, catalog, { id: "fav", name: "Fav" });
  layout = setGroupHidden(layout, customGroupKey("fav"), true);
  layout = setGroupHidden(layout, "default:Meta", true);
  layout = setGroupHidden(layout, "default:Gone", true);
  expect(pruneModelLayout(layout, catalog).hiddenGroups).toEqual([
    customGroupKey("fav"),
    "default:Meta",
  ]);
  expect(deleteCustomGroup(layout, catalog, "fav").hiddenGroups).toEqual([
    "default:Meta",
    "default:Gone",
  ]);
});
