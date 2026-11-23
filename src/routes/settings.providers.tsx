import { createFileRoute } from "@tanstack/react-router";
import {
  DownloadCloudIcon,
  ImageIcon,
  KeyRoundIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  ShieldAlertIcon,
  Trash2Icon,
} from "lucide-react";
import { useModelCatalogState } from "@/components/model-catalog-provider";
import {
  FetchModelsDialog,
  PersonalModelDialog,
  PersonalProviderDialog,
} from "@/components/personal-provider-dialogs";
import { usePersonalProviders } from "@/components/personal-providers-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useDialogState } from "@/hooks/use-dialog-state";
import {
  GATEWAY_PROVIDERS,
  MAX_PERSONAL_MODELS,
  MAX_PERSONAL_PROVIDERS,
  MODEL_LIST_PATHS,
  type PersonalModelDeclaration,
  type PersonalProvider,
} from "@/lib/personal-providers";

export const Route = createFileRoute("/settings/providers")({ component: ProviderSettings });

type ProviderDialogData = { provider?: PersonalProvider };
type ModelDialogData = { providerId: string; model?: PersonalModelDeclaration };
type DeleteTarget =
  | { kind: "provider"; provider: PersonalProvider }
  | { kind: "model"; providerId: string; model: PersonalModelDeclaration };

function ProviderSettings() {
  const { providers, ready, updateProviders } = usePersonalProviders();
  const { capabilities } = useModelCatalogState();
  const deploymentAvailable = capabilities.personalViaDeploymentGateway;

  const providerDialog = useDialogState<ProviderDialogData>();
  const modelDialog = useDialogState<ModelDialogData>();
  const fetchDialog = useDialogState<string>();
  const deleteDialog = useDialogState<DeleteTarget>();
  const deleteTarget = deleteDialog.data;

  const findProvider = (id: string | null | undefined) =>
    providers.find((provider) => provider.id === id);
  const modelProvider = findProvider(modelDialog.data?.providerId);
  const fetchProvider = findProvider(fetchDialog.data);

  const saveProvider = (next: PersonalProvider) => {
    const isNew = !providers.some((provider) => provider.id === next.id);
    updateProviders((current) =>
      current.some((provider) => provider.id === next.id)
        ? current.map((provider) => (provider.id === next.id ? next : provider))
        : [...current, next],
    );
    // A new provider starts by listing its models, when the service publishes them.
    if (isNew && MODEL_LIST_PATHS[next.provider]) {
      fetchDialog.show(next.id);
    }
  };

  const updateModels = (
    providerId: string,
    update: (models: PersonalModelDeclaration[]) => PersonalModelDeclaration[],
  ) =>
    updateProviders((current) =>
      current.map((provider) =>
        provider.id === providerId ? { ...provider, models: update(provider.models) } : provider,
      ),
    );

  const confirmDelete = () => {
    if (deleteTarget?.kind === "provider") {
      updateProviders((current) =>
        current.filter((provider) => provider.id !== deleteTarget.provider.id),
      );
    } else if (deleteTarget?.kind === "model") {
      updateModels(deleteTarget.providerId, (models) =>
        models.filter((model) => model.modelId !== deleteTarget.model.modelId),
      );
    }
    deleteDialog.close();
  };

  const canAddProvider = providers.length < MAX_PERSONAL_PROVIDERS;

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <ShieldAlertIcon />
        <AlertTitle>Keys stay in this browser</AlertTitle>
        <AlertDescription>
          API keys and gateway tokens are stored unencrypted in this browser and sent with each
          request through AI Gateway. They are never saved on the server or included in backups.
        </AlertDescription>
      </Alert>

      {!ready ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      ) : providers.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRoundIcon />
            </EmptyMedia>
            <EmptyTitle>No Personal Providers</EmptyTitle>
            <EmptyDescription>
              Use your own provider key, or your own AI Gateway, to add models to the picker.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => providerDialog.show({})}>
              <PlusIcon />
              Add provider
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="flex">
            <Button
              variant="outline"
              disabled={!canAddProvider}
              onClick={() => providerDialog.show({})}
            >
              <PlusIcon />
              Add provider
            </Button>
          </div>

          {providers.map((provider) => {
            const full = provider.models.length >= MAX_PERSONAL_MODELS;
            return (
              <section key={provider.id} className="flex flex-col rounded-lg border">
                <header className="flex items-center gap-2 border-b px-3 py-2">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{provider.label}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {GATEWAY_PROVIDERS[provider.provider]} ·{" "}
                      {provider.gateway
                        ? `Own gateway ${provider.gateway.gatewayId}`
                        : "This deployment's gateway"}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label="Provider actions" />
                      }
                    >
                      <MoreHorizontalIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => providerDialog.show({ provider })}>
                        <PencilIcon />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => deleteDialog.show({ kind: "provider", provider })}
                      >
                        <Trash2Icon />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </header>

                {provider.models.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">No models yet.</p>
                ) : (
                  <ul className="flex flex-col py-1">
                    {provider.models.map((model) => (
                      <li key={model.modelId} className="flex items-center gap-2 px-3 py-1.5">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="truncate text-sm">{model.name ?? model.modelId}</span>
                          {model.name && (
                            <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                              {model.modelId}
                            </span>
                          )}
                        </div>
                        {model.type === "Text to Image" && (
                          <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        {model.input?.includes("image") && <Badge variant="outline">Vision</Badge>}
                        {model.input?.includes("search") && <Badge variant="outline">Search</Badge>}
                        {model.reasoning && <Badge variant="outline">Reasoning</Badge>}
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon-sm" aria-label="Model actions" />
                            }
                          >
                            <MoreHorizontalIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => modelDialog.show({ providerId: provider.id, model })}
                            >
                              <PencilIcon />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                deleteDialog.show({ kind: "model", providerId: provider.id, model })
                              }
                            >
                              <Trash2Icon />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    ))}
                  </ul>
                )}

                <footer className="flex flex-wrap gap-2 border-t px-3 py-2">
                  <Button
                    variant="ghost"
                    disabled={full}
                    onClick={() => modelDialog.show({ providerId: provider.id })}
                  >
                    <PlusIcon />
                    Add model
                  </Button>
                  {MODEL_LIST_PATHS[provider.provider] && (
                    <Button
                      variant="ghost"
                      disabled={full}
                      onClick={() => fetchDialog.show(provider.id)}
                    >
                      <DownloadCloudIcon />
                      Fetch models
                    </Button>
                  )}
                </footer>
              </section>
            );
          })}
        </>
      )}

      <PersonalProviderDialog
        open={providerDialog.open}
        onOpenChange={providerDialog.onOpenChange}
        provider={providerDialog.data?.provider}
        deploymentAvailable={deploymentAvailable}
        onSave={saveProvider}
      />

      {modelProvider && (
        <PersonalModelDialog
          open={modelDialog.open}
          onOpenChange={modelDialog.onOpenChange}
          provider={modelProvider}
          model={modelDialog.data?.model}
          onSave={(next) =>
            updateModels(modelProvider.id, (models) => {
              const editedId = modelDialog.data?.model?.modelId;
              return editedId
                ? models.map((model) => (model.modelId === editedId ? next : model))
                : [...models, next];
            })
          }
        />
      )}

      {fetchProvider && (
        <FetchModelsDialog
          open={fetchDialog.open}
          onOpenChange={fetchDialog.onOpenChange}
          provider={fetchProvider}
          onAdd={(added) => updateModels(fetchProvider.id, (models) => [...models, ...added])}
        />
      )}

      <AlertDialog open={deleteDialog.open} onOpenChange={deleteDialog.onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.kind === "provider"
                ? `Delete ${deleteTarget.provider.label}?`
                : `Remove ${deleteTarget?.model.name ?? deleteTarget?.model.modelId ?? "model"}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === "provider"
                ? "Its key and models are removed from this browser. Conversations are kept."
                : "The model is removed from the picker. Conversations are kept."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              {deleteTarget?.kind === "provider" ? "Delete" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
