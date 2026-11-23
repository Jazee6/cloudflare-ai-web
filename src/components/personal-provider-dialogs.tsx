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

type Connection = "deployment" | "own";

const ACCOUNT_ID_RE = /^[a-f0-9]{32}$/i;
const GATEWAY_ID_RE = /^[a-z0-9-]{1,64}$/;

const providerFormSchema = (deploymentAvailable: boolean) =>
  v.pipe(
    v.object({
      label: v.pipe(
        v.string(),
        v.trim(),
        v.minLength(1, "Enter a name."),
        v.maxLength(
          MAX_PROVIDER_LABEL_LENGTH,
          `Use at most ${MAX_PROVIDER_LABEL_LENGTH} characters.`,
        ),
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
        "This deployment has no AI Gateway for Personal Providers.",
      ),
      ["connection"],
    ),
    v.forward(
      v.partialCheck(
        [["connection"], ["apiKey"]],
        (input) => input.connection === "own" || input.apiKey.trim().length > 0,
        "Enter your API key to use this deployment's gateway.",
      ),
      ["apiKey"],
    ),
    v.forward(
      v.partialCheck(
        [["connection"], ["accountId"]],
        (input) => input.connection === "deployment" || ACCOUNT_ID_RE.test(input.accountId.trim()),
        "Account ID is 32 hexadecimal characters.",
      ),
      ["accountId"],
    ),
    v.forward(
      v.partialCheck(
        [["connection"], ["gatewayId"]],
        (input) => input.connection === "deployment" || GATEWAY_ID_RE.test(input.gatewayId.trim()),
        "Use lowercase letters, digits and hyphens.",
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
      title={provider ? "Edit provider" : "Add provider"}
      onSubmit={() => void form.handleSubmit()}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit">{provider ? "Save" : "Add"}</Button>
        </>
      }
    >
      <FieldGroup className="gap-4">
        <form.Field name="label">
          {(field) => {
            const error = firstErrorMessage(field.state.meta.errors);
            return (
              <Field data-invalid={error ? "true" : undefined}>
                <FieldLabel htmlFor="provider-label">Name</FieldLabel>
                <Input
                  id="provider-label"
                  placeholder="My OpenAI"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-invalid={Boolean(error)}
                  autoFocus
                />
                <FieldDescription>
                  Also names the provider's group in the model picker.
                </FieldDescription>
                {error && <FieldError>{error}</FieldError>}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="provider">
          {(field) => (
            <Field>
              <FieldLabel>Service</FieldLabel>
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
              {providerLocked && (
                <FieldDescription>Remove its models to switch to another service.</FieldDescription>
              )}
            </Field>
          )}
        </form.Field>

        <form.Field name="connection">
          {(field) => {
            const error = firstErrorMessage(field.state.meta.errors);
            return (
              <Field data-invalid={error ? "true" : undefined}>
                <FieldLabel>AI Gateway</FieldLabel>
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
                    This deployment's
                  </ToggleGroupItem>
                  <ToggleGroupItem value="own">My own</ToggleGroupItem>
                </ToggleGroup>
                <FieldDescription>
                  {deploymentAvailable
                    ? "This deployment's gateway requires your own API key."
                    : "This deployment offers no gateway, so add your own."}
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
                      const error = firstErrorMessage(field.state.meta.errors);
                      return (
                        <Field data-invalid={error ? "true" : undefined}>
                          <FieldLabel htmlFor="provider-account">Account ID</FieldLabel>
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
                      const error = firstErrorMessage(field.state.meta.errors);
                      return (
                        <Field data-invalid={error ? "true" : undefined}>
                          <FieldLabel htmlFor="provider-gateway">Gateway name</FieldLabel>
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
                        <FieldLabel htmlFor="provider-token">Gateway token</FieldLabel>
                        <Input
                          id="provider-token"
                          type="password"
                          autoComplete="off"
                          placeholder="Optional"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                        <FieldDescription>
                          Needed when the gateway has authentication on.
                        </FieldDescription>
                      </Field>
                    )}
                  </form.Field>
                </>
              )}
              <form.Field name="apiKey">
                {(field) => {
                  const error = firstErrorMessage(field.state.meta.errors);
                  return (
                    <Field data-invalid={error ? "true" : undefined}>
                      <FieldLabel htmlFor="provider-key">API key</FieldLabel>
                      <Input
                        id="provider-key"
                        type="password"
                        autoComplete="off"
                        placeholder={connection === "own" ? "Optional" : undefined}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={Boolean(error)}
                      />
                      {connection === "own" && (
                        <FieldDescription>
                          Leave empty to use the gateway's stored keys or Unified Billing.
                        </FieldDescription>
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
          {(error) => (typeof error === "string" ? <FieldError>{error}</FieldError> : null)}
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
      v.check((id) => !takenIds.has(id), "This model is already added."),
      v.check(
        (id) => dynamicAllowed || !isDynamicRoute(id),
        "Dynamic Routes need your own AI Gateway.",
      ),
    ),
    name: v.pipe(v.string(), v.maxLength(100, "Use at most 100 characters.")),
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
        "Enter a whole number of tokens.",
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
        const error = firstErrorMessage(field.state.meta.errors);
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
      title={model ? "Edit model" : "Add model"}
      description="Only the capabilities you turn on are used."
      onSubmit={() => void form.handleSubmit()}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit">{model ? "Save" : "Add"}</Button>
        </>
      }
    >
      <FieldGroup className="gap-4">
        {textField("modelId", "Model ID", {
          placeholder: provider.gateway ? "gpt-5 or dynamic/route" : "gpt-5",
          description: provider.gateway
            ? "The provider's model ID, or dynamic/<route> for a Dynamic Route."
            : "The provider's model ID.",
        })}
        {textField("name", "Display name", { placeholder: "Optional" })}

        {imageProtocol && (
          <form.Field name="type">
            {(field) => (
              <Field>
                <FieldLabel>Type</FieldLabel>
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
                  <ToggleGroupItem value="Text Generation">Chat</ToggleGroupItem>
                  <ToggleGroupItem value="Text to Image">Image generation</ToggleGroupItem>
                </ToggleGroup>
              </Field>
            )}
          </form.Field>
        )}

        <form.Subscribe selector={(state) => state.values.type}>
          {(type) =>
            type === "Text Generation" && (
              <>
                {switchField("image", "Accepts images")}
                {supportsSearch && switchField("search", "Google Search grounding")}
                {switchField("reasoning", "Reasoning model")}
                {textField("contextWindow", "Context window", {
                  placeholder: "Optional, in tokens",
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
  | { status: "error"; message: string }
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
          setState({
            status: "error",
            message:
              response.status === 401
                ? "Sign in to this deployment first."
                : (await response.text()) || "Unable to fetch models.",
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
          setState({ status: "error", message: "Network error. Please try again." });
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
              <EmptyTitle>No model list</EmptyTitle>
              <EmptyDescription>
                {GATEWAY_PROVIDERS[provider.provider]} does not publish its models here. Add them by
                ID.
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
              <EmptyTitle>Unable to fetch models</EmptyTitle>
              <EmptyDescription>{state.message}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAttempt((n) => n + 1)}
              >
                <RefreshCwIcon />
                Retry
              </Button>
            </EmptyContent>
          </Empty>
        );
      case "ready":
        return (
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
            <div className="flex max-h-72 flex-col overflow-y-auto rounded-lg border p-1">
              {visible.length === 0 ? (
                <p className="p-3 text-center text-sm text-muted-foreground">No matching models.</p>
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
            <p className="text-xs text-muted-foreground">
              Models are added as chat models with no extra capabilities. Edit them to turn
              capabilities on.
            </p>
          </div>
        );
    }
  })();

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Fetch models"
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
            Cancel
          </Button>
          <Button type="submit" disabled={selected.size === 0 || selected.size > remaining}>
            {selected.size > remaining
              ? `Up to ${remaining} more`
              : selected.size > 0
                ? `Add ${selected.size}`
                : "Add"}
          </Button>
        </>
      }
    >
      {body}
    </ResponsiveFormDialog>
  );
};
