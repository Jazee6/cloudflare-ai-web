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
import { GoogleLogo, MetaLogo, QWenLogo } from "@/components/logo";
import { ChevronDown } from "lucide-react";

export interface Model {
  id: string;
  name: string;
  logo: ReactNode;
  type: "Text Generation";
}

const models: Model[] = [
  {
    id: "@cf/meta/llama-4-scout-17b-16e-instruct",
    name: "llama-4-scout-17b-16e-instruct",
    logo: <MetaLogo />,
    type: "Text Generation",
  },
  {
    id: "@cf/google/gemma-3-12b-it",
    name: "gemma-3-12b-it",
    logo: <GoogleLogo />,
    type: "Text Generation",
  },
  {
    id: "@cf/qwen/qwq-32b",
    name: "qwq-32b",
    logo: <QWenLogo />,
    type: "Text Generation",
  },
];

export const getStoredModelId = () =>
  (localStorage.getItem("CF_AI_MODEL") ?? models[0].id) as Model["id"];

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
        <CommandGroup heading="Text Generation">
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
            <Button variant="outline">
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
          <Button variant="outline">
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
