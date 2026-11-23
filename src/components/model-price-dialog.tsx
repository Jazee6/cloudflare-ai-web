import { useForm } from "@tanstack/react-form";
import { useEffect, useState } from "react";
import * as v from "valibot";
import { Button } from "@/components/ui/button";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  type DeclaredModelPrices,
  MAX_MODEL_PRICE,
  MODEL_PRICES_CHANGE_EVENT,
  MODEL_PRICES_STORAGE_KEY,
  readDeclaredModelPrices,
  writeDeclaredModelPrice,
} from "@/lib/model-prices";
import type { Model } from "@/lib/models";
import { useI18n } from "@/hooks/use-i18n";

/** The visitor's declared Model Prices, kept in sync across tabs. */
export const useDeclaredModelPrices = (): DeclaredModelPrices => {
  const [prices, setPrices] = useState<DeclaredModelPrices>({});
  useEffect(() => {
    const refresh = () => setPrices(readDeclaredModelPrices());
    const onStorage = (event: StorageEvent) => {
      if (event.key === MODEL_PRICES_STORAGE_KEY) {
        refresh();
      }
    };
    refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener(MODEL_PRICES_CHANGE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(MODEL_PRICES_CHANGE_EVENT, refresh);
    };
  }, []);
  return prices;
};

const errorText = (errors: unknown[]) => {
  const first = errors[0];
  return typeof first === "string" ? first : (first as { message?: string } | undefined)?.message;
};

/** Declares the Model Price of a model that has no catalog price. */
export const ModelPriceDialog = ({
  model,
  open,
  onOpenChange,
}: {
  model: Model | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const prices = useDeclaredModelPrices();
  const priceText = v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, t("modelPrice.required")),
    v.check(
      (value) => {
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 && number <= MAX_MODEL_PRICE;
      },
      t("modelPrice.range", { max: MAX_MODEL_PRICE }),
    ),
  );
  const modelPriceFormSchema = v.object({ input: priceText, output: priceText });
  const current = model ? prices[model.id] : undefined;
  const form = useForm({
    defaultValues: { input: "", output: "" },
    validators: { onSubmit: modelPriceFormSchema },
    onSubmit: ({ value }) => {
      if (model) {
        writeDeclaredModelPrice(model.id, {
          input: Number(value.input),
          output: Number(value.output),
        });
      }
      onOpenChange(false);
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        input: current ? String(current.input) : "",
        output: current ? String(current.output) : "",
      });
    }
  }, [open, current, form]);

  const priceField = (name: "input" | "output", label: string) => (
    <form.Field name={name}>
      {(field) => {
        const message = errorText(field.state.meta.errors);
        const id = `model-price-${name}`;
        return (
          <Field data-invalid={message ? "true" : undefined}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>$</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id={id}
                inputMode="decimal"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={Boolean(message)}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{t("modelPrice.perMillion")}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            {message && <FieldError>{message}</FieldError>}
          </Field>
        );
      }}
    </form.Field>
  );

  const fields = (
    <FieldGroup className="gap-4">
      {priceField("input", t("modelPrice.input"))}
      {priceField("output", t("modelPrice.output"))}
    </FieldGroup>
  );

  const actions = (
    <>
      {current && model && (
        <Button
          type="button"
          variant="ghost"
          className="mr-auto"
          onClick={() => {
            writeDeclaredModelPrice(model.id, undefined);
            onOpenChange(false);
          }}
        >
          {t("common.remove")}
        </Button>
      )}
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
        {t("common.cancel")}
      </Button>
      <Button type="submit">{t("common.save")}</Button>
    </>
  );

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit();
  };

  const title = model ? t("modelPrice.titleFor", { name: model.name }) : t("modelPrice.title");

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <form onSubmit={handleFormSubmit} noValidate className="flex flex-col gap-4">
            <DrawerHeader>
              <DrawerTitle>{title}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4">{fields}</div>
            <DrawerFooter className="flex-row justify-end">{actions}</DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleFormSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {fields}
          <DialogFooter>{actions}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
