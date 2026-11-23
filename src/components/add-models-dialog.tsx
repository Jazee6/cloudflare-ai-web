import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { ModelLogo } from "@/components/model-logo";
import { ResponsiveFormDialog } from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import type { ModelLayoutGroup } from "@/lib/model-layout";

/** Picks Hidden Models to show in the model picker again. */
export const AddModelsDialog = ({
  open,
  onOpenChange,
  groups,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Model Groups holding only the hidden models. */
  groups: ModelLayoutGroup[];
  onAdd: (modelIds: string[]) => void;
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setQuery("");
    }
  }, [open]);

  const needle = query.trim().toLowerCase();
  const visible = groups
    .map((group) => ({
      ...group,
      models: group.models.filter((model) =>
        `${model.name} ${model.id} ${group.name}`.toLowerCase().includes(needle),
      ),
    }))
    .filter((group) => group.models.length > 0);

  const toggle = (modelId: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(modelId);
      } else {
        next.delete(modelId);
      }
      return next;
    });

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add models"
      onSubmit={() => {
        onAdd([...selected]);
        onOpenChange(false);
      }}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={selected.size === 0}>
            {selected.size > 0 ? `Add ${selected.size}` : "Add"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <InputGroup>
          <InputGroupInput
            placeholder="Filter models"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
        </InputGroup>
        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-lg border p-1">
          {visible.length === 0 ? (
            <p className="p-3 text-center text-sm text-muted-foreground">No matching models.</p>
          ) : (
            visible.map((group) => (
              <div key={group.key} className="flex flex-col">
                <span className="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">{group.name}</span>
                {group.models.map((model) => (
                  <label
                    key={model.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={selected.has(model.id)}
                      onCheckedChange={(checked) => toggle(model.id, checked)}
                    />
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      <ModelLogo model={model} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{model.name}</span>
                  </label>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </ResponsiveFormDialog>
  );
};
