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
import { type ReactNode, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  DeepSeekLogo,
  GoogleLogo,
  MetaLogo,
  MistralLogo,
  QWenLogo,
} from "@/components/logo";

export interface Model {
  id: string;
  name: string;
  logo: ReactNode;
  type: "Text Generation" | "Text to Image";
  disabled?: boolean;
}

export const models: Model[] = [
  {
    id: "@cf/meta/llama-4-scout-17b-16e-instruct",
    name: "llama-4-scout-17b",
    logo: <MetaLogo />,
    type: "Text Generation",
  },
  {
    id: "@cf/google/gemma-3-12b-it",
    name: "gemma-3-12b",
    logo: <GoogleLogo />,
    type: "Text Generation",
  },
  {
    id: "@cf/mistralai/mistral-small-3.1-24b-instruct",
    name: "mistral-small-3.1-24b",
    logo: <MistralLogo />,
    type: "Text Generation",
  },
  {
    id: "@cf/qwen/qwq-32b",
    name: "qwq-32b",
    logo: <QWenLogo />,
    type: "Text Generation",
  },
  {
    id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    name: "deepseek-r1-distill-qwen-32b",
    logo: <DeepSeekLogo />,
    type: "Text Generation",
  },
  {
    id: "@cf/black-forest-labs/flux-1-schnell",
    name: "flux-1-schnell",
    logo: (
      <div className="bg-linear-to-br from-secondary to-primary size-4 rounded-full"></div>
    ),
    type: "Text to Image",
    disabled: true,
  },
];

export const getStoredModelId = () =>
  (localStorage.getItem("CF_AI_MODEL") ?? models[0].id) as Model["id"];

export const getStoredModel = () =>
  models.find((m) => m.id === getStoredModelId()) ?? models[0];

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

const ModelList = ({
  setOpen,
  setSelectedModel,
}: {
  setOpen: (open: boolean) => void;
  setSelectedModel: (models: Model) => void;
}) => {
  return (
    <Command>
      <CommandInput placeholder="Filter models..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groupedModels.map(({ type, models }) => (
          <CommandGroup key={type} heading={type}>
            {models.map((model) => (
              <CommandItem
                disabled={model.disabled}
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

function ComboBoxResponsive() {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [selectedModel, setSelectedModel] = useState<Model>();

  useEffect(() => {
    setSelectedModel(
      models.find((item) => item.id === getStoredModelId()) ?? models[0],
    );
  }, []);

  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem("CF_AI_MODEL", selectedModel.id);
    }
  }, [selectedModel]);

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {selectedModel ? (
            <Button variant="ghost">
              <span className="size-4 flex items-center justify-center">
                {selectedModel.logo}
              </span>
              {selectedModel.name}
              <ChevronDown />
            </Button>
          ) : null}
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start">
          <ModelList setOpen={setOpen} setSelectedModel={setSelectedModel} />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {selectedModel ? (
          <Button variant="ghost">
            <span className="size-4 flex items-center justify-center">
              {selectedModel.logo}
            </span>
            {selectedModel.name}
            <ChevronDown />
          </Button>
        ) : null}
      </DrawerTrigger>
      <DrawerContent>
        <DrawerTitle></DrawerTitle>
        <div className="mt-4 border-t">
          <ModelList setOpen={setOpen} setSelectedModel={setSelectedModel} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

const ModelSelect = () => {
  return <ComboBoxResponsive></ComboBoxResponsive>;
};

export default ModelSelect;
