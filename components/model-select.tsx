"use client";

import { ChevronsUpDown, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { ModelLogo } from "@/components/model-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import type { Model } from "@/lib/models";
import { getModelGroup } from "@/lib/models";

const getGroupedModels = (models: Model[]) => {
  const groups = new Map<string, Model[]>();

  for (const model of models) {
    const group = getModelGroup(model);
    groups.set(group, [...(groups.get(group) ?? []), model]);
  }

  return Array.from(groups, ([name, groupModels]) => ({
    name,
    models: groupModels,
  }));
};

const ModelSelect = ({
  models,
  selectedModel,
  onSelectModel,
  loading = false,
  error = null,
  onReload,
}: {
  models: Model[];
  selectedModel?: Model;
  onSelectModel: (model: Model) => void;
  loading?: boolean;
  error?: string | null;
  onReload?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const groupedModels = useMemo(() => getGroupedModels(models), [models]);

  if (loading && models.length === 0) {
    return <Skeleton className="h-8 w-36 rounded-md" />;
  }

  if (!loading && error && models.length === 0 && onReload) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={onReload}>
        <RefreshCw />
        Retry
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="min-w-0 shrink text-primary hover:text-primary aria-expanded:text-primary"
        disabled={models.length === 0}
        onClick={() => setOpen(true)}
      >
        {selectedModel ? (
          <>
            <span className="flex size-4 shrink-0 items-center justify-center">
              <ModelLogo model={selectedModel} />
            </span>
            <span className="truncate">{selectedModel.name}</span>
          </>
        ) : models.length > 0 ? (
          <span className="truncate">Select a model</span>
        ) : (
          <span className="truncate">No models available</span>
        )}
        <ChevronsUpDown className="shrink-0" />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Select a model"
        description="Search models by name or brand"
        className="max-w-xl"
      >
        <Command>
          <CommandInput placeholder="Filter models..." />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>No models found.</CommandEmpty>
            {groupedModels.map(({ name, models: groupModels }) => (
              <CommandGroup key={name} heading={name}>
                {groupModels.map((model) => (
                  <CommandItem
                    key={`${model.provider}:${model.id}`}
                    value={`${name} ${model.brand} ${model.name} ${model.id}`}
                    data-checked={selectedModel?.id === model.id}
                    onSelect={() => {
                      onSelectModel(model);
                      setOpen(false);
                    }}
                  >
                    <span className="flex size-4 items-center justify-center">
                      <ModelLogo model={model} />
                    </span>
                    <span className="truncate">{model.name}</span>
                    {(model.tag?.length || model.source === "external") && (
                      <span className="ml-auto flex items-center gap-1">
                        {model.tag?.map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                        {model.isGatewayRoute ? (
                          <Badge variant="secondary">Route</Badge>
                        ) : model.source === "external" ? (
                          <Badge variant="secondary">{model.brand}</Badge>
                        ) : null}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
};

export default ModelSelect;
