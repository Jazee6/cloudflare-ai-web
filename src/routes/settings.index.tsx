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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "@/components/ui/toast";
import { useTheme } from "@/hooks/use-theme";
import {
  type AppSettings,
  MAX_CUSTOM_INSTRUCTIONS_LENGTH,
  type WebFetchPolicy,
} from "@/lib/settings";
import { parseThemePreference } from "@/lib/theme";

export const Route = createFileRoute("/settings/")({ component: GeneralSettings });

const chatSettingsSchema = v.object({
  customInstructions: v.pipe(
    v.string(),
    v.maxLength(
      MAX_CUSTOM_INSTRUCTIONS_LENGTH,
      `Instructions must be at most ${MAX_CUSTOM_INSTRUCTIONS_LENGTH} characters.`,
    ),
  ),
  skipGatewayCache: v.boolean(),
  webFetchPolicy: v.picklist(["auto", "zero-quota"]),
});

const WEB_FETCH_POLICY_ITEMS: Record<WebFetchPolicy, string> = {
  auto: "Auto (Zero-quota first, Browser Run fallback)",
  "zero-quota": "Zero-quota only (Never use Browser Run)",
};

function GeneralSettings() {
  const { theme, setTheme } = useTheme();
  const { settings, ready } = useSettings();

  return (
    <FieldGroup className="gap-5">
      <Field>
        <FieldLabel>Theme</FieldLabel>
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
            System
          </ToggleGroupItem>
          <ToggleGroupItem value="light">
            <SunIcon />
            Light
          </ToggleGroupItem>
          <ToggleGroupItem value="dark">
            <MoonIcon />
            Dark
          </ToggleGroupItem>
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
  const { updateSettings } = useSettings();
  const form = useForm({
    defaultValues: {
      customInstructions: settings.customInstructions,
      skipGatewayCache: settings.skipGatewayCache,
      webFetchPolicy: settings.webFetchPolicy,
    },
    validators: { onSubmit: chatSettingsSchema },
    onSubmit: async ({ value }) => {
      updateSettings({
        customInstructions: value.customInstructions.trim(),
        skipGatewayCache: value.skipGatewayCache,
        webFetchPolicy: value.webFetchPolicy,
      });
      toast.add({ title: "Settings saved.", type: "success" });
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
            const errorMessage =
              typeof firstError === "string"
                ? firstError
                : (firstError as { message?: string } | undefined)?.message;
            return (
              <Field data-invalid={errorMessage ? "true" : undefined}>
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel htmlFor="settings-custom-instructions">
                    Custom Instructions
                  </FieldLabel>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {field.state.value.length}/{MAX_CUSTOM_INSTRUCTIONS_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="settings-custom-instructions"
                  rows={4}
                  placeholder="Optional system prompt applied to new chat requests..."
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

        <form.Field name="skipGatewayCache">
          {(field) => (
            <Field orientation="horizontal" className="justify-between">
              <FieldLabel htmlFor="settings-skip-cache">Skip AI Gateway cache</FieldLabel>
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
              <FieldLabel>Webpage Extraction</FieldLabel>
              <Select
                items={WEB_FETCH_POLICY_ITEMS}
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
                  <SelectItem value="auto">{WEB_FETCH_POLICY_ITEMS.auto}</SelectItem>
                  <SelectItem value="zero-quota">{WEB_FETCH_POLICY_ITEMS["zero-quota"]}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                Save
              </Button>
            </div>
          )}
        </form.Subscribe>
      </FieldGroup>
    </form>
  );
}
