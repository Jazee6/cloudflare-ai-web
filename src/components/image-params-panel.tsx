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
  type ImageModelRef,
  MAX_NEGATIVE_PROMPT_LENGTH,
  MAX_SEED,
  sanitizeImageParams,
} from "@/lib/image-models";
import { useI18n } from "@/hooks/use-i18n";

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
  model: ImageModelRef,
  params: ImageGenerationParams,
  profile: ImageModelProfile,
) => {
  const adapted = adaptImageParamsForModel(model, params);
  return {
    aspectRatio: adapted.aspectRatio ?? profile.aspectRatios?.[0] ?? "",
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
  model,
  profile,
  params,
  onChangeParams,
}: {
  model: ImageModelRef;
  profile: ImageModelProfile;
  params: ImageGenerationParams;
  onChangeParams: (next: ImageGenerationParams) => void;
}) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const adjustable = hasAdjustableImageParams(profile);

  const formSchema = v.pipe(
    v.object({
      aspectRatio: v.string(),
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
          t("imageParams.negativePromptTooLong", { max: MAX_NEGATIVE_PROMPT_LENGTH }),
        ),
      ),
    }),
    v.check((values) => {
      if (!profile.dimensions) {
        return true;
      }
      const w = parseOptionalInt(values.width);
      const h = parseOptionalInt(values.height);
      const check = sanitizeImageParams(model, { width: w, height: h });
      return check.ok;
    }, t("imageParams.dimensionsInvalid")),
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
      t("imageParams.stepsInvalid", {
        min: profile.steps?.min ?? 1,
        max: profile.steps?.max ?? 50,
      }),
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
      t("imageParams.guidanceInvalid", {
        min: profile.guidance?.min ?? 0,
        max: profile.guidance?.max ?? 20,
      }),
    ),
    v.check(
      (values) => {
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
      },
      t("imageParams.seedInvalid", { max: MAX_SEED }),
    ),
  );

  const form = useForm({
    defaultValues: getInitialValues(model, params, profile),
    validators: {
      onSubmit: ({ value }) => {
        const parsed = v.safeParse(formSchema, value);
        if (parsed.success) {
          return undefined;
        }
        return parsed.issues[0]?.message ?? t("imageParams.invalid");
      },
    },
    onSubmit: async ({ value }) => {
      const next: ImageGenerationParams = {};

      if (profile.aspectRatios && value.aspectRatio) {
        next.aspectRatio = value.aspectRatio;
      }
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

      const validated = sanitizeImageParams(model, next);
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
      form.reset(getInitialValues(model, params, profile));
    }
  }, [open, model, params, profile, form]);

  if (!adjustable) {
    return null;
  }

  const adaptedParams = adaptImageParamsForModel(model, params);
  const hasCustomValues =
    (profile.aspectRatios !== undefined &&
      adaptedParams.aspectRatio !== undefined &&
      adaptedParams.aspectRatio !== profile.aspectRatios[0]) ||
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
    form.reset(getInitialValues(model, {}, profile));
  };

  const formBody = (
    <FieldGroup className="gap-4">
      {profile.highCostHint && (
        <Alert>
          <AlertTriangle />
          <AlertDescription>{t(profile.highCostHint)}</AlertDescription>
        </Alert>
      )}

      {profile.aspectRatios && (
        <form.Field name="aspectRatio">
          {(field) => (
            <Field>
              <FieldLabel>{t("imageParams.aspectRatio")}</FieldLabel>
              <ToggleGroup
                multiple={false}
                variant="outline"
                size="sm"
                value={field.state.value ? [field.state.value] : []}
                onValueChange={(values) => {
                  if (values[0]) {
                    field.handleChange(values[0]);
                  }
                }}
              >
                {profile.aspectRatios?.map((ratio) => (
                  <ToggleGroupItem key={ratio} value={ratio}>
                    {ratio}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          )}
        </form.Field>
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
                <FieldLabel>{t("imageParams.aspectRatioAndSize")}</FieldLabel>
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
                        <FieldLabel htmlFor="image-width">{t("imageParams.width")}</FieldLabel>
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
                        <FieldLabel htmlFor="image-height">{t("imageParams.height")}</FieldLabel>
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
                <FieldLabel>{t("imageParams.steps")}</FieldLabel>
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
                <FieldLabel>{t("imageParams.guidance")}</FieldLabel>
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
                <FieldLabel htmlFor="image-seed">{t("imageParams.seed")}</FieldLabel>
                <ButtonGroup className="w-full">
                  <Input
                    id="image-seed"
                    type="number"
                    placeholder={t("imageParams.random")}
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
                    aria-label={t("imageParams.randomizeSeed")}
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
                <FieldLabel htmlFor="image-seed-lock">{t("imageParams.lockSeed")}</FieldLabel>
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
                <FieldLabel htmlFor="image-negative-prompt">
                  {t("imageParams.negativePrompt")}
                </FieldLabel>
                <Textarea
                  id="image-negative-prompt"
                  rows={2}
                  maxLength={MAX_NEGATIVE_PROMPT_LENGTH}
                  placeholder={t("imageParams.negativePromptPlaceholder")}
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
        {t("imageParams.reset")}
      </Button>
      <Button type="submit">{t("imageParams.apply")}</Button>
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
            aria-label={t("imageParams.title")}
            onClick={() => setOpen(true)}
          />
        }
      >
        <SlidersHorizontal />
        <span className="hidden sm:inline">Params</span>
      </TooltipTrigger>
      <TooltipContent>{t("imageParams.tooltip")}</TooltipContent>
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
                <DrawerTitle>{t("imageParams.title")}</DrawerTitle>
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
              <DialogTitle>{t("imageParams.title")}</DialogTitle>
            </DialogHeader>
            {formBody}
            <DialogFooter>{footerActions}</DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
