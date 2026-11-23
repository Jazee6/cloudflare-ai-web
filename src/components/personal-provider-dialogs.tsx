import { useForm } from "@tanstack/react-form";
import { RefreshCwIcon, SearchIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import * as v from "valibot";
import { firstErrorMessage, ResponsiveFormDialog } from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  GATEWAY_PROVIDER_IDS,
  GATEWAY_PROVIDERS,
  type GatewayProviderId,
  IMAGE_PROTOCOLS,
  isDynamicRoute,
  MAX_PERSONAL_MODELS,
  MAX_PROVIDER_LABEL_LENGTH,
  modelIdSchema,
  type PersonalModelDeclaration,
  type PersonalProvider,
  personalProviderSchema,
} from "@/lib/personal-providers";
import { useI18n } from "@/hooks/use-i18n";
import { type AppError, appError, parseAppError } from "@/lib/error-codes";
import { translateNow } from "@/lib/i18n";

type Connection = "deployment" | "own";

const ACCOUNT_ID_RE = /^[a-f0-9]{32}$/i;
const GATEWAY_ID_RE = /^[a-z0-9-]{1,64}$/;

/** Schema messages are message keys, translated where the error is shown. */
const providerFormSchema = (deploymentAvailable: boolean) =>
  v.pipe(
    v.object({
      label: v.pipe(
        v.string(),
        v.trim(),
        v.minLength(1, "personal.nameRequired"),
        v.maxLength(MAX_PROVIDER_LABEL_LENGTH, "personal.nameTooLong"),
      ),
      provider: v.picklist(GATEWAY_PROVIDER_IDS),
      connection: v.picklist(["deployment", "own"]),
      apiKey: v.string(),
      accountId: v.string(),
      gatewayId: v.string(),
      token: v.string(),
    }),
    v.forward(
      v.partialCheck(
        [["connection"]],
        (input) => input.connection === "own" || deploymentAvailable,
        "personal.noDeploymentGateway",
      ),
      ["connection"],
    ),
    v.forward(
      v.partialCheck(
        [["connection"], ["apiKey"]],
        (input) => input.connection === "own" || input.apiKey.trim().length > 0,
        "personal.apiKeyRequired",
      ),
      ["apiKey"],
    ),
    v.forward(
      v.partialCheck(
        [["connection"], ["accountId"]],
        (input) => input.connection === "deployment" || ACCOUNT_ID_RE.test(input.accountId.trim()),
        "personal.accountIdInvalid",
      ),
      ["accountId"],
    ),
    v.forward(
      v.partialCheck(
        [["connection"], ["gatewayId"]],
        (input) => input.connection === "deployment" || GATEWAY_ID_RE.test(input.gatewayId.trim()),
        "personal.gatewayIdInvalid",
      ),
      ["gatewayId"],
    ),
  );

const getProviderDefaults = (
  provider: PersonalProvider | undefined,
  deploymentAvailable: boolean,
) => ({
  label: provider?.label ?? "",
  provider: provider?.provider ?? ("openai" as GatewayProviderId),
  connection: (provider
    ? provider.gateway
      ? "own"
      : "deployment"
    : deploymentAvailable
      ? "deployment"
      : "own") as Connection,
  apiKey: provider?.apiKey ?? "",
  accountId: provider?.gateway?.accountId ?? "",
  gatewayId: provider?.gateway?.gatewayId ?? "",
  token: provider?.gateway?.token ?? "",
});

/** Adds a Personal Provider or edits one's connection and credentials. */
export const PersonalProviderDialog = ({
  open,
  onOpenChange,
  provider,
  deploymentAvailable,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The provider being edited; a new one is created when absent. */
  provider?: PersonalProvider;
  deploymentAvailable: boolean;
  onSave: (provider: PersonalProvider) => void;
}) => {
  const { t, tText } = useI18n();
  const fieldError = (errors: unknown[]) => {
    const message = firstErrorMessage(errors);
    return message ? tText(message).replace("{max}", String(MAX_PROVIDER_LABEL_LENGTH)) : undefined;
  };
  const form = useForm({
    defaultValues: getProviderDefaults(provider, deploymentAvailable),
    validators: { onSubmit: providerFormSchema(deploymentAvailable) },
    onSubmit: ({ value }) => {
      const own = value.connection === "own";
      const candidate = {
        id: provider?.id ?? crypto.randomUUID(),
        label: value.label,
        provider: value.provider,
        apiKey: value.apiKey,
        ...(own
          ? {
              gateway: {
                accountId: value.accountId,
                gatewayId: value.gatewayId,
                token: value.token,
              },
            }
          : {}),
        models: provider?.models ?? [],
      };
      const parsed = v.safeParse(personalProviderSchema, candidate);
      if (!parsed.success) {
        form.setErrorMap({ onSubmit: { form: parsed.issues[0].message, fields: {} } });
        return;
      }
      onSave(parsed.output);
      onOpenChange(false);
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(getProviderDefaults(provider, deploymentAvailable));
    }
  }, [open, provider, deploymentAvailable, form]);

  // The service is fixed once models are declared, since their capabilities depend on it.
  const providerLocked = (provider?.models.length ?? 0) > 0;

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={provider ? t("personal.editProvider") : t("providers.add")}
      onSubmit={() => void form.handleSubmit()}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="submit">{provider ? t("common.save") : t("addModels.add")}</Button>
        </>
      }
    >
      <FieldGroup className="gap-4">
        <form.Field name="label">
          {(field) => {
            const error = fieldError(field.state.meta.errors);
            return (
              <Field data-invalid={error ? "true" : undefined}>
                <FieldLabel htmlFor="provider-label">{t("personal.name")}</FieldLabel>
                <Input
                  id="provider-label"
                  placeholder={t("personal.namePlaceholder")}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-invalid={Boolean(error)}
                  autoFocus
                />
                <FieldDescription>{t("personal.nameDescription")}</FieldDescription>
                {error && <FieldError>{error}</FieldError>}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="provider">
          {(field) => (
            <Field>
              <FieldLabel>{t("personal.service")}</FieldLabel>
              <Select
                items={GATEWAY_PROVIDERS}
                value={field.state.value}
                disabled={providerLocked}
                onValueChange={(value) => {
                  if (value && value in GATEWAY_PROVIDERS) {
                    field.handleChange(value as GatewayProviderId);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GATEWAY_PROVIDER_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {GATEWAY_PROVIDERS[id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {providerLocked && <FieldDescription>{t("personal.serviceLocked")}</FieldDescription>}
            </Field>
          )}
        </form.Field>

        <form.Field name="connection">
          {(field) => {
            const error = fieldError(field.state.meta.errors);
            return (
              <Field data-invalid={error ? "true" : undefined}>
                <FieldLabel>{t("personal.gateway")}</FieldLabel>
                <ToggleGroup
                  multiple={false}
                  variant="outline"
                  value={[field.state.value]}
                  onValueChange={(values) => {
                    if (values[0] === "deployment" || values[0] === "own") {
                      field.handleChange(values[0]);
                    }
                  }}
                >
                  <ToggleGroupItem value="deployment" disabled={!deploymentAvailable}>
                    {t("personal.deploymentGateway")}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="own">{t("personal.ownGateway")}</ToggleGroupItem>
                </ToggleGroup>
                <FieldDescription>
                  {deploymentAvailable
                    ? t("personal.deploymentGatewayHint")
                    : t("personal.noDeploymentGatewayHint")}
                </FieldDescription>
                {error && <FieldError>{error}</FieldError>}
              </Field>
            );
          }}
        </form.Field>

        <form.Subscribe selector={(state) => state.values.connection}>
          {(connection) => (
            <>
              {connection === "own" && (
                <>
                  <form.Field name="accountId">
                    {(field) => {
                      const error = fieldError(field.state.meta.errors);
                      return (
                        <Field data-invalid={error ? "true" : undefined}>
                          <FieldLabel htmlFor="provider-account">
                            {t("personal.accountId")}
                          </FieldLabel>
                          <Input
                            id="provider-account"
                            autoComplete="off"
                            spellCheck={false}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            aria-invalid={Boolean(error)}
                          />
                          {error && <FieldError>{error}</FieldError>}
                        </Field>
                      );
                    }}
                  </form.Field>
                  <form.Field name="gatewayId">
                    {(field) => {
                      const error = fieldError(field.state.meta.errors);
                      return (
                        <Field data-invalid={error ? "true" : undefined}>
                          <FieldLabel htmlFor="provider-gateway">
                            {t("personal.gatewayName")}
                          </FieldLabel>
                          <Input
                            id="provider-gateway"
                            autoComplete="off"
                            spellCheck={false}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            aria-invalid={Boolean(error)}
                          />
                          {error && <FieldError>{error}</FieldError>}
                        </Field>
                      );
                    }}
                  </form.Field>
                  <form.Field name="token">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor="provider-token">
                          {t("personal.gatewayToken")}
                        </FieldLabel>
                        <Input
                          id="provider-token"
                          type="password"
                          autoComplete="off"
                          placeholder={t("personal.optional")}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                        <FieldDescription>{t("personal.gatewayTokenHint")}</FieldDescription>
                      </Field>
                    )}
                  </form.Field>
                </>
              )}
              <form.Field name="apiKey">
                {(field) => {
                  const error = fieldError(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? "true" : undefined}>
                      <FieldLabel htmlFor="provider-key">{t("personal.apiKey")}</FieldLabel>
                      <Input
                        id="provider-key"
                        type="password"
                        autoComplete="off"
                        placeholder={connection === "own" ? t("personal.optional") : undefined}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={Boolean(error)}
                      />
                      {connection === "own" && (
                        <FieldDescription>{t("personal.apiKeyOwnHint")}</FieldDescription>
                      )}
                      {error && <FieldError>{error}</FieldError>}
                    </Field>
                  );
                }}
              </form.Field>
            </>
          )}
        </form.Subscribe>

        <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
          {(error) => (typeof error === "string" ? <FieldError>{tText(error)}</FieldError> : null)}
        </form.Subscribe>
      </FieldGroup>
    </ResponsiveFormDialog>
  );
};

const modelFormSchema = ({
  takenIds,
  dynamicAllowed,
}: {
  takenIds: Set<string>;
  dynamicAllowed: boolean;
}) =>
  v.object({
    modelId: v.pipe(
      modelIdSchema,
      v.check((id) => !takenIds.has(id), "personal.modelTaken"),
      v.check(
        (id) => dynamicAllowed || !isDynamicRoute(id),
        "personal.dynamicRouteNeedsOwnGateway",
      ),
    ),
    name: v.pipe(v.string(), v.maxLength(100, "personal.displayNameTooLong")),
    type: v.picklist(["Text Generation", "Text to Image"]),
    image: v.boolean(),
    search: v.boolean(),
    reasoning: v.boolean(),
    contextWindow: v.pipe(
      v.string(),
      v.trim(),
      v.check(
        (value) =>
          value === "" || (/^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))),
        "personal.contextWindowInvalid",
      ),
    ),
  });

const getModelDefaults = (model: PersonalModelDeclaration | undefined) => ({
  modelId: model?.modelId ?? "",
  name: model?.name ?? "",
  type: model?.type ?? ("Text Generation" as PersonalModelDeclaration["type"]),
  image: model?.input?.includes("image") ?? false,
  search: model?.input?.includes("search") ?? false,
  reasoning: model?.reasoning ?? false,
  contextWindow: model?.contextWindow ? String(model.contextWindow) : "",
});

/**
 * Declares a Personal Model. Capabilities the visitor does not declare are unavailable, as with
 * External Models.
 */
export const PersonalModelDialog = ({
  open,
  onOpenChange,
  provider,
  model,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: PersonalProvider;
  /** The declaration being edited; a new one is added when absent. */
  model?: PersonalModelDeclaration;
  onSave: (model: PersonalModelDeclaration) => void;
}) => {
  const { t, tText } = useI18n();
  const imageProtocol = IMAGE_PROTOCOLS[provider.provider];
  const supportsSearch = provider.provider === "google-ai-studio";
  const takenIds = useMemo(
    () =>
      new Set(
        provider.models.map((candidate) => candidate.modelId).filter((id) => id !== model?.modelId),
      ),
    [provider.models, model?.modelId],
  );

  const form = useForm({
    defaultValues: getModelDefaults(model),
    validators: {
      onSubmit: modelFormSchema({ takenIds, dynamicAllowed: Boolean(provider.gateway) }),
    },
    onSubmit: ({ value }) => {
      const isImage = value.type === "Text to Image";
      const input = isImage
        ? []
        : [
            ...(value.image ? ["image" as const] : []),
            ...(value.search && supportsSearch ? ["search" as const] : []),
          ];
      const contextWindow = value.contextWindow.trim();
      onSave({
        modelId: value.modelId.trim(),
        ...(value.name.trim() ? { name: value.name.trim() } : {}),
        type: value.type,
        ...(isImage && imageProtocol ? { imageProtocol } : {}),
        ...(input.length > 0 ? { input } : {}),
        ...(!isImage && value.reasoning ? { reasoning: true } : {}),
        ...(!isImage && contextWindow ? { contextWindow: Number(contextWindow) } : {}),
      });
      onOpenChange(false);
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(getModelDefaults(model));
    }
  }, [open, model, form]);

  const textField = (
    name: "modelId" | "name" | "contextWindow",
    label: string,
    options: { placeholder?: string; description?: string; inputMode?: "numeric" } = {},
  ) => (
    <form.Field name={name}>
      {(field) => {
        const message = firstErrorMessage(field.state.meta.errors);
        const error = message ? tText(message) : undefined;
        return (
          <Field data-invalid={error ? "true" : undefined}>
            <FieldLabel htmlFor={`personal-model-${name}`}>{label}</FieldLabel>
            <Input
              id={`personal-model-${name}`}
              autoComplete="off"
              spellCheck={false}
              inputMode={options.inputMode}
              placeholder={options.placeholder}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              aria-invalid={Boolean(error)}
            />
            {options.description && <FieldDescription>{options.description}</FieldDescription>}
            {error && <FieldError>{error}</FieldError>}
          </Field>
        );
      }}
    </form.Field>
  );

  const switchField = (name: "image" | "search" | "reasoning", label: string) => (
    <form.Field name={name}>
      {(field) => (
        <Field orientation="horizontal" className="justify-between">
          <FieldLabel htmlFor={`personal-model-${name}`}>{label}</FieldLabel>
          <Switch
            id={`personal-model-${name}`}
            checked={field.state.value}
            onCheckedChange={field.handleChange}
          />
        </Field>
      )}
    </form.Field>
  );

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={model ? t("personal.editModel") : t("providers.addModel")}
      description={t("personal.modelDescription")}
      onSubmit={() => void form.handleSubmit()}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="submit">{model ? t("common.save") : t("addModels.add")}</Button>
        </>
      }
    >
      <FieldGroup className="gap-4">
        {textField("modelId", t("personal.modelId"), {
          placeholder: provider.gateway ? t("personal.modelIdPlaceholderDynamic") : "gpt-5",
          description: provider.gateway
            ? t("personal.modelIdHintDynamic")
            : t("personal.modelIdHint"),
        })}
        {textField("name", t("personal.displayName"), { placeholder: t("personal.optional") })}

        {imageProtocol && (
          <form.Field name="type">
            {(field) => (
              <Field>
                <FieldLabel>{t("personal.type")}</FieldLabel>
                <ToggleGroup
                  multiple={false}
                  variant="outline"
                  value={[field.state.value]}
                  onValueChange={(values) => {
                    if (values[0] === "Text Generation" || values[0] === "Text to Image") {
                      field.handleChange(values[0]);
                    }
                  }}
                >
                  <ToggleGroupItem value="Text Generation">
                    {t("personal.typeChat")}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="Text to Image">{t("personal.typeImage")}</ToggleGroupItem>
                </ToggleGroup>
              </Field>
            )}
          </form.Field>
        )}

        <form.Subscribe selector={(state) => state.values.type}>
          {(type) =>
            type === "Text Generation" && (
              <>
                {switchField("image", t("personal.acceptsImages"))}
                {supportsSearch && switchField("search", t("personal.searchGrounding"))}
                {switchField("reasoning", t("personal.reasoningModel"))}
                {textField("contextWindow", t("personal.contextWindow"), {
                  placeholder: t("personal.contextWindowPlaceholder"),
                  inputMode: "numeric",
                })}
              </>
            )
          }
        </form.Subscribe>
      </FieldGroup>
    </ResponsiveFormDialog>
  );
};

type FetchState =
  | { status: "loading" }
  | { status: "error"; error: AppError }
  | { status: "unsupported" }
  | { status: "ready"; models: { modelId: string; name?: string }[] };

/** Lists the provider's models so the visitor can pick which to add. */
export const FetchModelsDialog = ({
  open,
  onOpenChange,
  provider,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: PersonalProvider;
  onAdd: (models: PersonalModelDeclaration[]) => void;
}) => {
  const { t, tError } = useI18n();
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [attempt, setAttempt] = useState(0);
  const existing = useMemo(
    () => new Set(provider.models.map((model) => model.modelId)),
    [provider.models],
  );
  const remaining = MAX_PERSONAL_MODELS - provider.models.length;

  useEffect(() => {
    if (!open) {
      return;
    }
    setState({ status: "loading" });
    setSelected(new Set());
    setQuery("");
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/personal-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: provider.provider,
            ...(provider.apiKey ? { apiKey: provider.apiKey } : {}),
            ...(provider.gateway ? { gateway: provider.gateway } : {}),
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const text = response.status === 401 ? "" : await response.text();
          setState({
            status: "error",
            error:
              response.status === 401
                ? { message: translateNow("personal.signInFirst") }
                : text.trim()
                  ? parseAppError(text)
                  : { message: translateNow("personal.fetchFailed") },
          });
          return;
        }
        const body = (await response.json()) as {
          supported: boolean;
          models: { modelId: string; name?: string }[];
        };
        setState(
          body.supported
            ? {
                status: "ready",
                // Only IDs this app can store are offered.
                models: body.models.filter((model) => v.is(modelIdSchema, model.modelId)),
              }
            : { status: "unsupported" },
        );
      } catch {
        if (!controller.signal.aborted) {
          setState({ status: "error", error: appError("networkError") });
        }
      }
    })();
    return () => controller.abort();
  }, [open, provider, attempt]);

  const visible =
    state.status === "ready"
      ? state.models.filter((model) =>
          `${model.modelId} ${model.name ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : [];

  const toggle = (modelId: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(modelId);
      } else {
        next.delete(modelId);
      }
      return next;
    });
  };

  const body = (() => {
    switch (state.status) {
      case "loading":
        return (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
        );
      case "unsupported":
        return (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>{t("personal.noModelList")}</EmptyTitle>
              <EmptyDescription>
                {t("personal.noModelListDescription", {
                  service: GATEWAY_PROVIDERS[provider.provider],
                })}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        );
      case "error":
        return (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <TriangleAlertIcon />
              </EmptyMedia>
              <EmptyTitle>{t("personal.fetchFailed")}</EmptyTitle>
              <EmptyDescription>{tError(state.error)}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                <RefreshCwIcon />
                {t("common.retry")}
              </Button>
            </EmptyContent>
          </Empty>
        );
      case "ready":
        return (
          <div className="flex flex-col gap-2">
            <InputGroup>
              <InputGroupInput
                placeholder={t("addModels.filter")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
            </InputGroup>
            <div className="flex max-h-72 flex-col overflow-y-auto rounded-lg border p-1">
              {visible.length === 0 ? (
                <p className="p-3 text-center text-sm text-muted-foreground">
                  {t("addModels.empty")}
                </p>
              ) : (
                visible.map((model) => {
                  const added = existing.has(model.modelId);
                  return (
                    <label
                      key={model.modelId}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted has-disabled:cursor-default has-disabled:opacity-60"
                    >
                      <Checkbox
                        checked={added || selected.has(model.modelId)}
                        disabled={added}
                        onCheckedChange={(checked) => toggle(model.modelId, checked)}
                      />
                      <span className="min-w-0 flex-1 truncate">{model.name ?? model.modelId}</span>
                      {model.name && (
                        <span className="max-w-1/2 truncate text-xs text-muted-foreground">
                          {model.modelId}
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t("personal.fetchHint")}</p>
          </div>
        );
    }
  })();

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("providers.fetchModels")}
      onSubmit={() => {
        const models = (state.status === "ready" ? state.models : [])
          .filter((model) => selected.has(model.modelId))
          .slice(0, remaining)
          .map((model): PersonalModelDeclaration => ({
            modelId: model.modelId,
            ...(model.name ? { name: model.name } : {}),
            type: "Text Generation",
          }));
        onAdd(models);
        onOpenChange(false);
      }}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={selected.size === 0 || selected.size > remaining}>
            {selected.size > remaining
              ? t("personal.upToMore", { count: remaining })
              : selected.size > 0
                ? t("addModels.addCount", { count: selected.size })
                : t("addModels.add")}
          </Button>
        </>
      }
    >
      {body}
    </ResponsiveFormDialog>
  );
};
