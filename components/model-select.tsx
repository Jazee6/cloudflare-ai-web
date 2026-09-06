"use client";

import { ChevronsUpDown } from "lucide-react";
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
}: {
  models: Model[];
  selectedModel?: Model;
  onSelectModel: (model: Model) => void;
}) => {
  const [open, setOpen] = useState(false);
  const groupedModels = useMemo(() => getGroupedModels(models), [models]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        disabled={models.length === 0}
        onClick={() => setOpen(true)}
      >
        {selectedModel ? (
          <>
            <span className="flex size-4 items-center justify-center">
              <ModelLogo model={selectedModel} />
            </span>
            {selectedModel.name}
          </>
        ) : models.length > 0 ? (
          "Select a model"
        ) : (
          "No models available"
        )}
        <ChevronsUpDown />
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
                    value={`${name} ${model.name} ${model.id}`}
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
                    {model.tag?.map((tag) => (
                      <Badge key={tag} variant="outline" className="ml-auto">
                        {tag}
                      </Badge>
                    ))}
                    {model.source === "external" && (
                      <Badge variant="secondary" className="ml-auto">
                        Google API
                      </Badge>
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
