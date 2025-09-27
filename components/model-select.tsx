"use client";

import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Model } from "@/lib/models";
import { getStoredModelId } from "@/lib/utils";

const getGroupedModels = (models: Model[]) => {
  const groupedModels: {
    type: Model["type"];
    models: Model[];
  }[] = [];

  for (const model of models) {
    let group = groupedModels.find((g) => g.type === model.type);
    if (!group) {
      group = { type: model.type, models: [] as Model[] };
      groupedModels.push(group);
    }
    group.models.push(model);
  }

  return groupedModels;
};

const ModelList = ({
  models,
  setOpen,
  setSelectedModel,
}: {
  models: Model[];
  setOpen: (open: boolean) => void;
  setSelectedModel: (models: Model) => void;
}) => {
  const groupedModels = getGroupedModels(models);

  return (
    <Command>
      <CommandInput placeholder="Filter models..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groupedModels.map(({ type, models }) => (
          <CommandGroup key={type} heading={type}>
            {models.map((model) => (
              <CommandItem
                key={model.id}
                value={model.id}
                onSelect={(value) => {
                  setSelectedModel(
                    models.find((m) => m.id === value) ?? models[0],
                  );
                  setOpen(false);
                }}
              >
                <span className="size-4 flex items-center justify-center">
                  {model.logo}
                </span>
                {model.name}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  );
};

function ComboBoxResponsive({ models }: { models: Model[] }) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [selectedModel, setSelectedModel] = useState<Model>();

  useEffect(() => {
    setSelectedModel(
      models.find((item) => item.id === getStoredModelId()) ?? models[0],
    );
  }, [models]);

  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem("CF_AI_MODEL", selectedModel.id);
    }
  }, [selectedModel]);

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {selectedModel && (
            <Button variant="ghost">
              <span className="size-4 flex items-center justify-center">
                {selectedModel.logo}
              </span>
              {selectedModel.name}
              <ChevronDown />
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start">
          <ModelList
            setOpen={setOpen}
            setSelectedModel={setSelectedModel}
            models={models}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {selectedModel && (
          <Button variant="ghost">
            <span className="size-4 flex items-center justify-center">
              {selectedModel.logo}
            </span>
            {selectedModel.name}
            <ChevronDown />
          </Button>
        )}
      </DrawerTrigger>
      <DrawerContent>
        <DrawerTitle></DrawerTitle>
        <div className="mt-4 border-t">
          <ModelList
            setOpen={setOpen}
            setSelectedModel={setSelectedModel}
            models={models}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

const ModelSelect = ({ models }: { models: Model[] }) => {
  return <ComboBoxResponsive models={models}></ComboBoxResponsive>;
};

export default ModelSelect;
