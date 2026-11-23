import { AlertTriangle, ChevronsUpDown, ImageIcon, RefreshCw } from "lucide-react";
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { getImageModelProfile } from "@/lib/image-models";
import type { ModelLayoutGroup } from "@/lib/model-layout";
import type { Model } from "@/lib/models";

const ModelSelect = ({
  groups,
  selectedModel,
  onSelectModel,
  loading = false,
  error = null,
  onReload,
}: {
  /** Model Groups in layout order; hidden models must already be left out. */
  groups: ModelLayoutGroup[];
  selectedModel?: Model;
  onSelectModel: (model: Model) => void;
  loading?: boolean;
  error?: string | null;
  onReload?: () => void;
}) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const groupedModels = useMemo(() => groups.filter((group) => group.models.length > 0), [groups]);
  const modelCount = groupedModels.reduce((count, group) => count + group.models.length, 0);

  const commandPicker = (
    <Command>
      <CommandInput placeholder="Filter models..." />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>No models found.</CommandEmpty>
        {groupedModels.map(({ key, name, models: groupModels }) => (
          <CommandGroup key={key} heading={name}>
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
                <span className="min-w-0 flex-1 truncate">{model.name}</span>
                {(() => {
                  const isImageModel = model.type === "Text to Image";
                  const highCostHint = isImageModel
                    ? getImageModelProfile(model).highCostHint
                    : undefined;
                  if (
                    !isImageModel &&
                    !model.tag?.length &&
                    model.source !== "external" &&
                    !model.isGatewayRoute &&
                    !highCostHint
                  ) {
                    return null;
                  }
                  return (
                    <span className="flex shrink-0 items-center gap-1">
                      {isImageModel && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span className="inline-flex items-center text-muted-foreground">
                                <ImageIcon className="size-3.5" />
                              </span>
                            }
                          />
                          <TooltipContent>Generates images</TooltipContent>
                        </Tooltip>
                      )}
                      {highCostHint && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span className="inline-flex items-center text-muted-foreground">
                                <AlertTriangle className="size-3.5" />
                              </span>
                            }
                          />
                          <TooltipContent>{highCostHint}</TooltipContent>
                        </Tooltip>
                      )}
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
                  );
                })()}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  );

  if (loading && modelCount === 0) {
    return <Skeleton className="h-8 w-36 rounded-md" />;
  }

  if (!loading && error && modelCount === 0 && onReload) {
    return (
      <Button type="button" variant="ghost" onClick={onReload}>
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
        disabled={modelCount === 0}
        onClick={() => setOpen(true)}
      >
        {selectedModel ? (
          <>
            <span className="flex size-4 shrink-0 items-center justify-center">
              <ModelLogo model={selectedModel} />
            </span>
            <span className="truncate">{selectedModel.name}</span>
          </>
        ) : modelCount > 0 ? (
          <span className="truncate">Select a model</span>
        ) : (
          <span className="truncate">No models available</span>
        )}
        <ChevronsUpDown className="shrink-0" />
      </Button>

      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <DrawerHeader className="sr-only">
              <DrawerTitle>Select a model</DrawerTitle>
              <DrawerDescription>Search models by name or brand</DrawerDescription>
            </DrawerHeader>
            <div className="p-2 pb-4">{commandPicker}</div>
          </DrawerContent>
        </Drawer>
      ) : (
        <CommandDialog
          open={open}
          onOpenChange={setOpen}
          title="Select a model"
          description="Search models by name or brand"
          className="max-w-xl"
        >
          {commandPicker}
        </CommandDialog>
      )}
    </>
  );
};

export default ModelSelect;
