import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import * as v from "valibot";
import { useSettings } from "@/components/settings-provider";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "@/components/ui/toast";
import { useTheme } from "@/hooks/use-theme";
import {
  type AppSettings,
  MAX_CONTEXT_MESSAGE_LIMIT,
  MAX_CUSTOM_INSTRUCTIONS_LENGTH,
  MIN_CONTEXT_MESSAGE_LIMIT,
  type WebFetchPolicy,
} from "@/lib/settings";
import { parseThemePreference } from "@/lib/theme";
import { useI18n, useLanguagePreference } from "@/hooks/use-i18n";
import { type LanguagePreference, LOCALES, parseLanguagePreference } from "@/lib/locale";
import type { MessageKey } from "@/locales/en";

export const Route = createFileRoute("/settings/")({ component: GeneralSettings });

const chatSettingsSchema = v.object({
  customInstructions: v.pipe(
    v.string(),
    v.maxLength(MAX_CUSTOM_INSTRUCTIONS_LENGTH, "settings.general.instructionsTooLong"),
  ),
  skipGatewayCache: v.boolean(),
  webFetchPolicy: v.picklist(["auto", "zero-quota"]),
  contextMessageLimit: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(MIN_CONTEXT_MESSAGE_LIMIT),
    v.maxValue(MAX_CONTEXT_MESSAGE_LIMIT),
  ),
});

const WEB_FETCH_POLICY_KEYS = {
  auto: "settings.general.webFetchAuto",
  "zero-quota": "settings.general.webFetchZeroQuota",
} as const satisfies Record<WebFetchPolicy, MessageKey>;

const LANGUAGE_LABELS: Record<Exclude<LanguagePreference, "system">, string> = {
  "zh-CN": "简体中文",
  en: "English",
};

function GeneralSettings() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const { preference: language, setPreference: setLanguage } = useLanguagePreference();
  const { settings, ready } = useSettings();

  return (
    <FieldGroup className="gap-5">
      <Field>
        <FieldLabel>{t("settings.general.theme")}</FieldLabel>
        <ToggleGroup
          multiple={false}
          variant="outline"
          value={[theme]}
          onValueChange={(values) => {
            if (values[0]) {
              setTheme(parseThemePreference(values[0]));
            }
          }}
        >
          <ToggleGroupItem value="system">
            <MonitorIcon />
            {t("settings.general.system")}
          </ToggleGroupItem>
          <ToggleGroupItem value="light">
            <SunIcon />
            {t("settings.general.light")}
          </ToggleGroupItem>
          <ToggleGroupItem value="dark">
            <MoonIcon />
            {t("settings.general.dark")}
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>

      <Field>
        <FieldLabel>{t("settings.general.language")}</FieldLabel>
        <ToggleGroup
          multiple={false}
          variant="outline"
          value={[language]}
          onValueChange={(values) => {
            if (values[0]) {
              setLanguage(parseLanguagePreference(values[0]));
            }
          }}
        >
          <ToggleGroupItem value="system">
            <MonitorIcon />
            {t("settings.general.system")}
          </ToggleGroupItem>
          {LOCALES.map((locale) => (
            <ToggleGroupItem key={locale} value={locale} lang={locale}>
              {LANGUAGE_LABELS[locale]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <FieldSeparator />

      {/* The form starts from stored settings, so it waits for them to load. */}
      {ready ? (
        <ChatSettingsForm settings={settings} />
      ) : (
        <div className="flex flex-col gap-5">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-6 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      )}
    </FieldGroup>
  );
}

function ChatSettingsForm({ settings }: { settings: AppSettings }) {
  const { t, tText } = useI18n();
  const { updateSettings } = useSettings();
  const form = useForm({
    defaultValues: {
      customInstructions: settings.customInstructions,
      skipGatewayCache: settings.skipGatewayCache,
      webFetchPolicy: settings.webFetchPolicy,
      contextMessageLimit: settings.contextMessageLimit,
    },
    validators: { onSubmit: chatSettingsSchema },
    onSubmit: async ({ value }) => {
      updateSettings({
        customInstructions: value.customInstructions.trim(),
        skipGatewayCache: value.skipGatewayCache,
        webFetchPolicy: value.webFetchPolicy,
        contextMessageLimit: value.contextMessageLimit,
      });
      toast.add({ title: t("settings.general.saved"), type: "success" });
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <FieldGroup className="gap-5">
        <form.Field name="customInstructions">
          {(field) => {
            const firstError = field.state.meta.errors[0];
            const rawError =
              typeof firstError === "string"
                ? firstError
                : (firstError as { message?: string } | undefined)?.message;
            const errorMessage = rawError
              ? tText(rawError).replace("{max}", String(MAX_CUSTOM_INSTRUCTIONS_LENGTH))
              : undefined;
            return (
              <Field data-invalid={errorMessage ? "true" : undefined}>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor="settings-custom-instructions">
                    {t("settings.general.customInstructions")}
                  </FieldLabel>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {field.state.value.length}/{MAX_CUSTOM_INSTRUCTIONS_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="settings-custom-instructions"
                  rows={4}
                  placeholder={t("settings.general.customInstructionsPlaceholder")}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-invalid={Boolean(errorMessage)}
                />
                {errorMessage && <FieldError>{errorMessage}</FieldError>}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="contextMessageLimit">
          {(field) => (
            <Field>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel>{t("settings.general.contextMessages")}</FieldLabel>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {field.state.value}
                </span>
              </div>
              <Slider
                min={MIN_CONTEXT_MESSAGE_LIMIT}
                max={MAX_CONTEXT_MESSAGE_LIMIT}
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

        <form.Field name="skipGatewayCache">
          {(field) => (
            <Field orientation="horizontal" className="justify-between">
              <FieldLabel htmlFor="settings-skip-cache">
                {t("settings.general.skipCache")}
              </FieldLabel>
              <Switch
                id="settings-skip-cache"
                checked={field.state.value}
                onCheckedChange={field.handleChange}
              />
            </Field>
          )}
        </form.Field>

        <form.Field name="webFetchPolicy">
          {(field) => (
            <Field>
              <FieldLabel>{t("settings.general.webFetch")}</FieldLabel>
              <Select
                items={{
                  auto: t(WEB_FETCH_POLICY_KEYS.auto),
                  "zero-quota": t(WEB_FETCH_POLICY_KEYS["zero-quota"]),
                }}
                value={field.state.value}
                onValueChange={(value) => {
                  if (value === "auto" || value === "zero-quota") {
                    field.handleChange(value);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{t(WEB_FETCH_POLICY_KEYS.auto)}</SelectItem>
                  <SelectItem value="zero-quota">
                    {t(WEB_FETCH_POLICY_KEYS["zero-quota"])}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {t("common.save")}
              </Button>
            </div>
          )}
        </form.Subscribe>
      </FieldGroup>
    </form>
  );
}
