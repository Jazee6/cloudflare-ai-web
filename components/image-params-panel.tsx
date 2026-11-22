"use client";

import { useForm } from "@tanstack/react-form";
import { AlertTriangle, Dices, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import * as v from "valibot";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroupButton } from "@/components/ui/input-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  adaptImageParamsForModel,
  generateRandomSeed,
  hasAdjustableImageParams,
  IMAGE_ASPECT_RATIOS,
  type ImageGenerationParams,
  type ImageModelProfile,
  MAX_NEGATIVE_PROMPT_LENGTH,
  MAX_SEED,
  sanitizeImageParams,
} from "@/lib/image-models";

const extractFormErrorMessages = (errors: unknown[]): string[] => {
  const messages: string[] = [];
  const visit = (item: unknown) => {
    if (!item) {
      return;
    }
    if (typeof item === "string") {
      messages.push(item);
      return;
    }
    if (Array.isArray(item)) {
      for (const child of item) {
        visit(child);
      }
      return;
    }
    if (typeof item === "object") {
      const record = item as Record<string, unknown>;
      if (typeof record.message === "string" && record.message) {
        messages.push(record.message);
        return;
      }
      for (const value of Object.values(record)) {
        visit(value);
      }
    }
  };
  visit(errors);
  return Array.from(new Set(messages));
};

const parseOptionalInt = (raw: string): number | undefined => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : Number.NaN;
};

const getInitialValues = (
  modelId: string,
  params: ImageGenerationParams,
  profile: ImageModelProfile,
) => {
  const adapted = adaptImageParamsForModel(modelId, params);
  return {
    width: String(adapted.width ?? profile.dimensions?.defaultWidth ?? 1024),
    height: String(adapted.height ?? profile.dimensions?.defaultHeight ?? 1024),
    steps: adapted.steps ?? profile.steps?.default ?? 20,
    guidance: adapted.guidance ?? profile.guidance?.default ?? 7.5,
    seed: adapted.seed !== undefined ? String(adapted.seed) : "",
    seedLocked: Boolean(params.seedLocked && adapted.seed !== undefined),
    negativePrompt: adapted.negativePrompt ?? "",
  };
};

export const ImageParamsPanel = ({
  modelId,
  profile,
  params,
  onChangeParams,
}: {
  modelId: string;
  profile: ImageModelProfile;
  params: ImageGenerationParams;
  onChangeParams: (next: ImageGenerationParams) => void;
}) => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const adjustable = hasAdjustableImageParams(profile);

  const formSchema = v.pipe(
    v.object({
      width: v.string(),
      height: v.string(),
      steps: v.number(),
      guidance: v.number(),
      seed: v.string(),
      seedLocked: v.boolean(),
      negativePrompt: v.pipe(
        v.string(),
        v.maxLength(
          MAX_NEGATIVE_PROMPT_LENGTH,
          `Negative prompt must be at most ${MAX_NEGATIVE_PROMPT_LENGTH} characters.`,
        ),
      ),
    }),
    v.check((values) => {
      if (!profile.dimensions) {
        return true;
      }
      const w = parseOptionalInt(values.width);
      const h = parseOptionalInt(values.height);
      const check = sanitizeImageParams(modelId, { width: w, height: h });
      return check.ok;
    }, "Dimensions must match the model range and step size."),
    v.check(
      (values) => {
        if (!profile.steps) {
          return true;
        }
        return (
          Number.isInteger(values.steps) &&
          values.steps >= profile.steps.min &&
          values.steps <= profile.steps.max
        );
      },
      `Steps must be an integer between ${profile.steps?.min ?? 1} and ${profile.steps?.max ?? 50}.`,
    ),
    v.check(
      (values) => {
        if (!profile.guidance) {
          return true;
        }
        return (
          Number.isFinite(values.guidance) &&
          values.guidance >= profile.guidance.min &&
          values.guidance <= profile.guidance.max
        );
      },
      `Guidance must be between ${profile.guidance?.min ?? 0} and ${profile.guidance?.max ?? 20}.`,
    ),
    v.check((values) => {
      if (!profile.supportsSeed || !values.seed.trim()) {
        return true;
      }
      const parsedSeed = parseOptionalInt(values.seed);
      return (
        parsedSeed !== undefined &&
        Number.isInteger(parsedSeed) &&
        parsedSeed >= 0 &&
        parsedSeed <= MAX_SEED
      );
    }, `Seed must be an integer between 0 and ${MAX_SEED}.`),
  );

  const form = useForm({
    defaultValues: getInitialValues(modelId, params, profile),
    validators: {
      onSubmit: ({ value }) => {
        const parsed = v.safeParse(formSchema, value);
        if (parsed.success) {
          return undefined;
        }
        return parsed.issues[0]?.message ?? "Invalid image generation parameters.";
      },
    },
    onSubmit: async ({ value }) => {
      const next: ImageGenerationParams = {};

      if (profile.dimensions) {
        next.width = parseOptionalInt(value.width);
        next.height = parseOptionalInt(value.height);
      }
      if (profile.steps) {
        next.steps = value.steps;
      }
      if (profile.guidance) {
        next.guidance = value.guidance;
      }
      if (profile.supportsSeed) {
        const parsedSeed = parseOptionalInt(value.seed);
        if (parsedSeed !== undefined) {
          next.seed = parsedSeed;
          next.seedLocked = value.seedLocked;
        } else {
          next.seedLocked = false;
        }
      }
      if (profile.supportsNegativePrompt && value.negativePrompt.trim()) {
        next.negativePrompt = value.negativePrompt.trim();
      }

      const validated = sanitizeImageParams(modelId, next);
      if (!validated.ok) {
        return;
      }

      onChangeParams({
        ...validated.params,
        seedLocked: next.seedLocked,
      });
      setOpen(false);
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(getInitialValues(modelId, params, profile));
    }
  }, [open, modelId, params, profile, form]);

  if (!adjustable) {
    return null;
  }

  const adaptedParams = adaptImageParamsForModel(modelId, params);
  const hasCustomValues =
    Boolean(params.seedLocked && adaptedParams.seed !== undefined) ||
    Boolean(adaptedParams.negativePrompt) ||
    adaptedParams.steps !== undefined ||
    adaptedParams.guidance !== undefined ||
    (profile.dimensions &&
      ((adaptedParams.width !== undefined &&
        adaptedParams.width !== profile.dimensions.defaultWidth) ||
        (adaptedParams.height !== undefined &&
          adaptedParams.height !== profile.dimensions.defaultHeight)));

  const handleReset = () => {
    form.reset(getInitialValues(modelId, {}, profile));
  };

  const formBody = (
    <FieldGroup className="gap-4">
      {profile.highCostHint && (
        <Alert>
          <AlertTriangle />
          <AlertDescription>{profile.highCostHint}</AlertDescription>
        </Alert>
      )}

      {profile.dimensions && (
        <form.Subscribe selector={(state) => [state.values.width, state.values.height]}>
          {([widthVal, heightVal]) => {
            const matchedRatio =
              IMAGE_ASPECT_RATIOS.find(
                (ratio) => String(ratio.width) === widthVal && String(ratio.height) === heightVal,
              )?.label ?? "";

            return (
              <Field>
                <FieldLabel>Aspect Ratio & Size</FieldLabel>
                <ToggleGroup
                  multiple={false}
                  variant="outline"
                  size="sm"
                  value={matchedRatio ? [matchedRatio] : []}
                  onValueChange={(values) => {
                    const label = values[0];
                    const ratio = IMAGE_ASPECT_RATIOS.find((item) => item.label === label);
                    if (ratio) {
                      form.setFieldValue("width", String(ratio.width));
                      form.setFieldValue("height", String(ratio.height));
                    }
                  }}
                >
                  {IMAGE_ASPECT_RATIOS.map((ratio) => (
                    <ToggleGroupItem key={ratio.label} value={ratio.label}>
                      {ratio.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <div className="grid grid-cols-2 gap-2">
                  <form.Field name="width">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor="image-width">Width</FieldLabel>
                        <Input
                          id="image-width"
                          type="number"
                          min={profile.dimensions?.min}
                          max={profile.dimensions?.max}
                          step={profile.dimensions?.step}
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="height">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor="image-height">Height</FieldLabel>
                        <Input
                          id="image-height"
                          type="number"
                          min={profile.dimensions?.min}
                          max={profile.dimensions?.max}
                          step={profile.dimensions?.step}
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                      </Field>
                    )}
                  </form.Field>
                </div>
              </Field>
            );
          }}
        </form.Subscribe>
      )}

      {profile.steps && (
        <form.Field name="steps">
          {(field) => (
            <Field>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel>Steps</FieldLabel>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {field.state.value}
                </span>
              </div>
              <Slider
                min={profile.steps?.min}
                max={profile.steps?.max}
                step={1}
                value={[field.state.value]}
                onValueChange={(value) => {
                  const next = Array.isArray(value) ? value[0] : value;
                  if (typeof next === "number") {
                    field.handleChange(next);
                  }
                }}
              />
            </Field>
          )}
        </form.Field>
      )}

      {profile.guidance && (
        <form.Field name="guidance">
          {(field) => (
            <Field>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel>Guidance</FieldLabel>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {field.state.value}
                </span>
              </div>
              <Slider
                min={profile.guidance?.min}
                max={profile.guidance?.max}
                step={profile.guidance?.step}
                value={[field.state.value]}
                onValueChange={(value) => {
                  const next = Array.isArray(value) ? value[0] : value;
                  if (typeof next === "number") {
                    field.handleChange(next);
                  }
                }}
              />
            </Field>
          )}
        </form.Field>
      )}

      {profile.supportsSeed && (
        <div className="flex flex-col gap-2">
          <form.Field name="seed">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="image-seed">Seed</FieldLabel>
                <ButtonGroup className="w-full">
                  <Input
                    id="image-seed"
                    type="number"
                    placeholder="Random"
                    min={0}
                    max={MAX_SEED}
                    value={field.state.value}
                    onChange={(event) => {
                      const next = event.target.value;
                      field.handleChange(next);
                      form.setFieldValue("seedLocked", next.trim().length > 0);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Randomize seed"
                    onClick={() => {
                      field.handleChange(String(generateRandomSeed()));
                      form.setFieldValue("seedLocked", true);
                    }}
                  >
                    <Dices />
                  </Button>
                </ButtonGroup>
              </Field>
            )}
          </form.Field>

          <form.Field name="seedLocked">
            {(field) => (
              <Field orientation="horizontal" className="justify-between">
                <FieldLabel htmlFor="image-seed-lock">Lock seed on retry</FieldLabel>
                <Switch
                  id="image-seed-lock"
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
              </Field>
            )}
          </form.Field>
        </div>
      )}

      {profile.supportsNegativePrompt && (
        <form.Field name="negativePrompt">
          {(field) => {
            const fieldErrors = extractFormErrorMessages(field.state.meta.errors);
            return (
              <Field data-invalid={fieldErrors.length > 0 ? "true" : undefined}>
                <FieldLabel htmlFor="image-negative-prompt">Negative Prompt</FieldLabel>
                <Textarea
                  id="image-negative-prompt"
                  rows={2}
                  maxLength={MAX_NEGATIVE_PROMPT_LENGTH}
                  placeholder="Things to exclude..."
                  value={field.state.value}
                  aria-invalid={fieldErrors.length > 0}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                {fieldErrors.length > 0 && <FieldError>{fieldErrors[0]}</FieldError>}
              </Field>
            );
          }}
        </form.Field>
      )}

      <form.Subscribe selector={(state) => state.errors}>
        {(errors) => {
          const messages = extractFormErrorMessages(errors);
          return messages.length > 0 ? <FieldError>{messages[0]}</FieldError> : null;
        }}
      </form.Subscribe>
    </FieldGroup>
  );

  const footerActions = (
    <>
      <Button type="button" variant="outline" onClick={handleReset}>
        Reset
      </Button>
      <Button type="submit">Apply</Button>
    </>
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit();
  };

  const trigger = (
    <Tooltip>
      <TooltipTrigger
        render={
          <InputGroupButton
            size="sm"
            variant={hasCustomValues ? "secondary" : "ghost"}
            aria-label="Image parameters"
            onClick={() => setOpen(true)}
          />
        }
      >
        <SlidersHorizontal />
        <span className="hidden sm:inline">Params</span>
      </TooltipTrigger>
      <TooltipContent>Generation parameters</TooltipContent>
    </Tooltip>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <form onSubmit={handleSubmit} noValidate className="flex max-h-[85dvh] flex-col gap-4">
              <DrawerHeader>
                <DrawerTitle>Image Parameters</DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto px-4">{formBody}</div>
              <DrawerFooter className="flex-row justify-end">{footerActions}</DrawerFooter>
            </form>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Image Parameters</DialogTitle>
            </DialogHeader>
            {formBody}
            <DialogFooter>{footerActions}</DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
