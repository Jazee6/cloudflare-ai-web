import { useForm } from "@tanstack/react-form";
import {
  DatabaseIcon,
  DownloadIcon,
  MessageSquareIcon,
  MonitorIcon,
  MoonIcon,
  PlayIcon,
  Settings2Icon,
  SquareIcon,
  SunIcon,
  Trash2Icon,
  UploadIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as v from "valibot";
import { useModelCatalogState, useModelPreferences } from "@/components/model-catalog-provider";
import ModelSelect from "@/components/model-select";
import { useSettings } from "@/components/settings-provider";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "@/components/ui/toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSpeechSynthesis, useSpeechVoices } from "@/hooks/use-speech-synthesis";
import {
  exportConversationHistoryJson,
  importConversationHistory,
  MAX_BACKUP_IMPORT_BYTES,
  triggerBackupDownload,
} from "@/lib/conversation-backup";
import {
  clearAllConversations,
  clearImageHistory,
  getStorageStats,
  type LocalStorageStats,
} from "@/lib/conversation-store";
import {
  ASR_LOCALE_OPTIONS,
  type AsrLocale,
  MAX_CUSTOM_INSTRUCTIONS_LENGTH,
  type WebFetchPolicy,
} from "@/lib/settings";
import { useTheme } from "@/hooks/use-theme";
import { parseThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

type SettingsSection = "general" | "chat" | "voice" | "data";

const SECTIONS: Array<{
  id: SettingsSection;
  label: string;
  icon: typeof Settings2Icon;
}> = [
  { id: "general", label: "General", icon: Settings2Icon },
  { id: "chat", label: "Chat", icon: MessageSquareIcon },
  { id: "voice", label: "Voice", icon: Volume2Icon },
  { id: "data", label: "Data", icon: DatabaseIcon },
];

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

const SYSTEM_VOICE_VALUE = "__system__";
const VOICE_PREVIEW_ID = "__settings_voice_preview__";
const WEB_FETCH_POLICY_ITEMS: Record<WebFetchPolicy, string> = {
  auto: "Auto (Zero-quota first, Browser Run fallback)",
  "zero-quota": "Zero-quota only (Never use Browser Run)",
};
const ASR_LOCALE_ITEMS: Record<string, string> = Object.fromEntries(
  ASR_LOCALE_OPTIONS.map((option) => [option.value, option.label]),
);

export const SettingsDialog = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings, settingsOpen, setSettingsOpen } = useSettings();
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");

  const {
    models: chatModels,
    loading: catalogLoading,
    error: catalogError,
    reload: reloadCatalog,
  } = useModelCatalogState("Text Generation");
  const { models: imageModels } = useModelCatalogState("Text to Image");
  const { preferences, setPreference } = useModelPreferences();

  const selectedChatModel =
    chatModels.find((model) => model.id === preferences.modelId) ?? chatModels[0];
  const selectedImageModel =
    imageModels.find((model) => model.id === preferences.imageModelId) ?? imageModels[0];

  const { supported: ttsSupported, voices } = useSpeechVoices();
  const { activeId: activeSpeechId, speak, stop: stopSpeech } = useSpeechSynthesis();
  const isPreviewing = activeSpeechId === VOICE_PREVIEW_ID;

  const groupedVoices = useMemo(() => {
    const groups = new Map<string, SpeechSynthesisVoice[]>();
    for (const voice of voices) {
      const lang = voice.lang || "Other";
      groups.set(lang, [...(groups.get(lang) ?? []), voice]);
    }
    return Array.from(groups, ([lang, items]) => ({ lang, items }));
  }, [voices]);

  const ttsVoiceItems = useMemo<Record<string, string>>(
    () => ({
      [SYSTEM_VOICE_VALUE]: "System default",
      ...Object.fromEntries(voices.map((voice) => [voice.voiceURI, voice.name])),
    }),
    [voices],
  );

  const handleSettingsOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        stopSpeech();
      }
      setSettingsOpen(open);
    },
    [setSettingsOpen, stopSpeech],
  );

  const chatForm = useForm({
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
      toast.add({ title: "Chat settings saved.", type: "success" });
    },
  });

  useEffect(() => {
    if (settingsOpen) {
      chatForm.reset({
        customInstructions: settings.customInstructions,
        skipGatewayCache: settings.skipGatewayCache,
        webFetchPolicy: settings.webFetchPolicy,
      });
    }
  }, [
    settingsOpen,
    settings.customInstructions,
    settings.skipGatewayCache,
    settings.webFetchPolicy,
    chatForm,
  ]);

  const [stats, setStats] = useState<LocalStorageStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [includeImages, setIncludeImages] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [clearTarget, setClearTarget] = useState<"conversations" | "images" | null>(null);
  const [clearing, setClearing] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const refreshStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      setStats(await getStorageStats());
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (settingsOpen && activeSection === "data") {
      void refreshStats();
    }
  }, [settingsOpen, activeSection, refreshStats]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const json = await exportConversationHistoryJson({ includeImages });
      const dateTag = new Date().toISOString().slice(0, 10);
      await triggerBackupDownload(json, `cloudflare-ai-conversations-${dateTag}.json`);
      toast.add({ title: "Conversation history exported.", type: "success" });
    } catch {
      toast.add({ title: "Failed to export conversation history.", type: "error" });
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    setImportError(null);
    if (file.size > MAX_BACKUP_IMPORT_BYTES) {
      setImportError("Backup file exceeds the 20 MiB import limit.");
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      const result = await importConversationHistory(text);
      if (!result.ok) {
        setImportError(result.error);
        toast.add({ title: result.error, type: "error" });
        return;
      }

      toast.add({
        title: `Imported ${result.importedSessions} conversation(s)${
          result.skippedSessions > 0 ? `, skipped ${result.skippedSessions} existing` : ""
        }.`,
        type: "success",
      });
      await refreshStats();
    } catch {
      setImportError("Unable to read the selected backup file.");
    } finally {
      setImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  };

  const handleConfirmClear = async () => {
    if (!clearTarget) {
      return;
    }
    setClearing(true);
    try {
      if (clearTarget === "conversations") {
        await clearAllConversations();
        toast.add({ title: "All conversations cleared.", type: "success" });
        if (pathname.startsWith("/c/")) {
          void navigate({ to: "/" });
        }
      } else {
        await clearImageHistory();
        toast.add({ title: "Image history cleared.", type: "success" });
      }
      setClearTarget(null);
      await refreshStats();
    } catch {
      toast.add({ title: "Failed to clear local history.", type: "error" });
    } finally {
      setClearing(false);
    }
  };

  const renderGeneralSection = () => (
    <FieldGroup className="gap-5">
      <Field>
        <FieldLabel>Theme</FieldLabel>
        <ToggleGroup
          multiple={false}
          variant="outline"
          value={[theme]}
          onValueChange={(values) => {
            if (!values[0]) {
              return;
            }
            const nextTheme = parseThemePreference(values[0]);
            setTheme(nextTheme);
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

      <Field>
        <FieldLabel>Default Chat Model</FieldLabel>
        <div className="flex items-center rounded-lg border px-2 py-1">
          <ModelSelect
            models={chatModels}
            selectedModel={selectedChatModel}
            loading={catalogLoading}
            error={catalogError}
            onReload={reloadCatalog}
            onSelectModel={(model) => setPreference("modelId", model.id)}
          />
        </div>
      </Field>

      <Field>
        <FieldLabel>Default Image Model</FieldLabel>
        <div className="flex items-center rounded-lg border px-2 py-1">
          <ModelSelect
            models={imageModels}
            selectedModel={selectedImageModel}
            loading={catalogLoading}
            error={catalogError}
            onReload={reloadCatalog}
            onSelectModel={(model) => setPreference("imageModelId", model.id)}
          />
        </div>
      </Field>
    </FieldGroup>
  );

  const renderChatSection = () => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void chatForm.handleSubmit();
      }}
    >
      <FieldGroup className="gap-5">
        <chatForm.Field name="customInstructions">
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
        </chatForm.Field>

        <chatForm.Field name="skipGatewayCache">
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
        </chatForm.Field>

        <chatForm.Field name="webFetchPolicy">
          {(field) => (
            <Field>
              <FieldLabel>Webpage Extraction</FieldLabel>
              <Select
                items={WEB_FETCH_POLICY_ITEMS}
                value={field.state.value}
                onValueChange={(value) => {
                  if (value === "auto" || value === "zero-quota") {
                    field.handleChange(value as WebFetchPolicy);
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
        </chatForm.Field>

        <div className="flex justify-end">
          <Button type="submit" size="sm">
            Save
          </Button>
        </div>
      </FieldGroup>
    </form>
  );

  const renderVoiceSection = () => (
    <FieldGroup className="gap-5">
      <Field>
        <FieldLabel>Voice Input Language</FieldLabel>
        <Select
          items={ASR_LOCALE_ITEMS}
          value={settings.asrLocale}
          onValueChange={(value) => {
            if (typeof value === "string") {
              updateSettings({ asrLocale: value as AsrLocale });
            }
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASR_LOCALE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {!ttsSupported ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <VolumeXIcon />
            </EmptyMedia>
            <EmptyTitle>Speech synthesis unavailable</EmptyTitle>
            <EmptyDescription>
              This browser does not expose Web Speech Synthesis voices.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Field>
            <FieldLabel>Read Aloud Voice</FieldLabel>
            <Select
              items={ttsVoiceItems}
              value={settings.ttsVoiceURI || SYSTEM_VOICE_VALUE}
              onValueChange={(value) => {
                if (typeof value === "string") {
                  updateSettings({ ttsVoiceURI: value === SYSTEM_VOICE_VALUE ? "" : value });
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SYSTEM_VOICE_VALUE}>System default</SelectItem>
                {groupedVoices.map(({ lang, items }) => (
                  <SelectGroup key={lang}>
                    <SelectLabel>{lang}</SelectLabel>
                    {items.map((voice) => (
                      <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel>Reading Speed</FieldLabel>
              <span className="text-xs text-muted-foreground tabular-nums">
                {settings.ttsRate.toFixed(1)}x
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                min={0.5}
                max={2}
                step={0.1}
                value={[settings.ttsRate]}
                onValueChange={(value) => {
                  const next = Array.isArray(value) ? value[0] : value;
                  if (typeof next === "number") {
                    updateSettings({ ttsRate: Math.round(next * 10) / 10 });
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isPreviewing) {
                    stopSpeech();
                  } else {
                    speak(
                      VOICE_PREVIEW_ID,
                      "This is a preview of the selected voice and reading speed.",
                    );
                  }
                }}
              >
                {isPreviewing ? <SquareIcon /> : <PlayIcon />}
                {isPreviewing ? "Stop" : "Test"}
              </Button>
            </div>
          </Field>

          <Field orientation="horizontal" className="justify-between">
            <FieldLabel htmlFor="settings-skip-code-blocks">
              Skip code blocks when reading
            </FieldLabel>
            <Switch
              id="settings-skip-code-blocks"
              checked={settings.ttsSkipCodeBlocks}
              onCheckedChange={(checked) => updateSettings({ ttsSkipCodeBlocks: checked })}
            />
          </Field>
        </>
      )}
    </FieldGroup>
  );

  const renderDataSection = () => (
    <FieldGroup className="gap-5">
      <Field>
        <FieldLabel>Local Storage</FieldLabel>
        {statsLoading || !stats ? (
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-0.5 rounded-lg border p-2.5">
              <span className="text-xs text-muted-foreground">Chats</span>
              <span className="text-base font-medium tabular-nums">{stats.sessionCount}</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-lg border p-2.5">
              <span className="text-xs text-muted-foreground">Messages</span>
              <span className="text-base font-medium tabular-nums">{stats.messageCount}</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-lg border p-2.5">
              <span className="text-xs text-muted-foreground">Images</span>
              <span className="text-base font-medium tabular-nums">{stats.imageEntryCount}</span>
            </div>
          </div>
        )}
      </Field>

      <Field>
        <FieldLabel>Conversation Backup</FieldLabel>
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <Field orientation="horizontal" className="justify-between">
            <FieldLabel htmlFor="settings-export-images">
              Include attached images in export
            </FieldLabel>
            <Switch
              id="settings-export-images"
              checked={includeImages}
              onCheckedChange={setIncludeImages}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => void handleExport()}
            >
              {exporting ? <Spinner /> : <DownloadIcon />}
              Export JSON
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={importing}
              onClick={() => importInputRef.current?.click()}
            >
              {importing ? <Spinner /> : <UploadIcon />}
              Import JSON
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                void handleImportFile(event.target.files?.[0]);
              }}
            />
          </div>
          {importError && <FieldError>{importError}</FieldError>}
        </div>
      </Field>

      <Field>
        <FieldLabel>Danger Zone</FieldLabel>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setClearTarget("conversations")}
          >
            <Trash2Icon />
            Clear all conversations
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setClearTarget("images")}
          >
            <Trash2Icon />
            Clear image history
          </Button>
        </div>
      </Field>
    </FieldGroup>
  );

  const sectionContent = (() => {
    switch (activeSection) {
      case "general":
        return renderGeneralSection();
      case "chat":
        return renderChatSection();
      case "voice":
        return renderVoiceSection();
      case "data":
        return renderDataSection();
    }
  })();

  const confirmDialog = (
    <AlertDialog
      open={clearTarget !== null}
      onOpenChange={(open) => {
        if (!open && !clearing) {
          setClearTarget(null);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {clearTarget === "conversations" ? "Clear all conversations?" : "Clear image history?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes stored local history from this browser and cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={clearing}
            onClick={() => void handleConfirmClear()}
          >
            {clearing && <Spinner />}
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={settingsOpen} onOpenChange={handleSettingsOpenChange}>
          <DrawerContent>
            <div className="flex max-h-[85dvh] flex-col gap-3">
              <DrawerHeader>
                <DrawerTitle>Settings</DrawerTitle>
              </DrawerHeader>
              <div className="px-4">
                <Tabs
                  value={activeSection}
                  onValueChange={(value) => setActiveSection(value as SettingsSection)}
                >
                  <TabsList className="w-full">
                    {SECTIONS.map((section) => (
                      <TabsTrigger key={section.id} value={section.id}>
                        <section.icon />
                        {section.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-6">{sectionContent}</div>
            </div>
          </DrawerContent>
        </Drawer>
        {confirmDialog}
      </>
    );
  }

  return (
    <>
      <Dialog open={settingsOpen} onOpenChange={handleSettingsOpenChange}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="flex h-[28rem] min-h-0">
            <nav className="flex w-44 shrink-0 flex-col gap-1 border-r bg-muted/30 p-2">
              {SECTIONS.map((section) => {
                const active = activeSection === section.id;
                return (
                  <Button
                    key={section.id}
                    type="button"
                    variant={active ? "secondary" : "ghost"}
                    size="sm"
                    className={cn("justify-start", active && "font-medium")}
                    onClick={() => setActiveSection(section.id)}
                  >
                    <section.icon />
                    {section.label}
                  </Button>
                );
              })}
            </nav>
            <div className="flex-1 overflow-y-auto p-5">{sectionContent}</div>
          </div>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
};
