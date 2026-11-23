import { useForm } from "@tanstack/react-form";
import type { ChatStatus, FileUIPart, UIMessage } from "ai";
import {
  ArrowUp,
  Database,
  Earth,
  FileText,
  Globe,
  ImagePlus,
  Mic,
  MicOff,
  Paperclip,
  RefreshCw,
  Square,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import * as v from "valibot";
import { ContextAttachmentItem } from "@/components/context-attachment-item";
import { ImageAttachmentItem } from "@/components/image-attachment-item";
import { ImageParamsPanel } from "@/components/image-params-panel";
import { useModelCatalogState, useModelPreferences } from "@/components/model-catalog-provider";
import {
  useModelGroups,
  useModelLayout,
  useSelectedModel,
} from "@/components/model-layout-provider";
import ModelSelect from "@/components/model-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UrlAttachmentDialog } from "@/components/url-attachment-dialog";
import type { ImageTurn } from "@/hooks/use-image-turn";
import { useKnowledgeBases } from "@/hooks/use-knowledge-bases";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import {
  type ContextAttachmentData,
  createContextAttachmentPart,
  MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE,
  MAX_DOCUMENT_BYTES,
} from "@/lib/context-attachments";
import { DOCUMENT_FILE_ACCEPT } from "@/lib/context-document";
import { compressImage } from "@/lib/image-compression";
import { MAX_IMAGE_PROMPT_LENGTH } from "@/lib/image-models";
import { getMessageContentLength, MODEL_CONTEXT_MAX_CHARS } from "@/lib/model-context";
import type { Model } from "@/lib/models";
import { MAX_IMAGE_PARTS } from "@/lib/request-limits";

export interface onSendMessageProps {
  text: string;
  files?: FileUIPart[];
  attachments?: ContextAttachmentData[];
  /** Set instead of files and attachments when an image model is selected. */
  imagePrompt?: UIMessage;
}

const formSchema = v.object({
  input: v.pipe(v.string(), v.trim(), v.minLength(1)),
});

const ChatInput = ({
  className,
  onSendMessage,
  onStop,
  onRetry,
  onUnauthorized,
  status = "ready",
  models,
  imageTurn,
  addon,
}: {
  className?: string;
  onSendMessage: (data: onSendMessageProps) => void;
  onStop?: () => void;
  onRetry?: () => void;
  onUnauthorized?: (onSuccess?: () => unknown) => void;
  status?: ChatStatus;
  /** Chat and image models; selecting an image model switches the input to image generation. */
  models: Model[];
  imageTurn: ImageTurn;
  /** Extra controls shown next to the model selector in chat mode. */
  addon?: ReactNode;
}) => {
  const { preferences, ready: preferencesReady, setPreference } = useModelPreferences();
  const {
    capabilities,
    loading: catalogLoading,
    error: catalogError,
    reload: reloadCatalog,
  } = useModelCatalogState();
  const [files, setFiles] = useState<FileUIPart[]>([]);
  const [attachments, setAttachments] = useState<ContextAttachmentData[]>([]);
  const filesRef = useRef<FileUIPart[]>(files);
  const attachmentsRef = useRef<ContextAttachmentData[]>(attachments);
  filesRef.current = files;
  attachmentsRef.current = attachments;
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const searchEnabled = preferences.searchEnabled === true;

  const {
    supported: speechSupported,
    listening,
    start: startSpeech,
    stop: stopSpeech,
    abort: abortSpeech,
  } = useSpeechRecognition();

  const selectedModel = useSelectedModel(models);
  const modelGroups = useModelGroups();
  const { ready: layoutReady } = useModelLayout();
  const imageMode = selectedModel?.type === "Text to Image";
  const enableContextAttachments = !imageMode;
  const supportsReferenceImages = imageMode && imageTurn.profile.maxReferenceImages > 0;

  const kbFeatureEnabled = enableContextAttachments && capabilities.knowledgeBase;
  const {
    instances: kbInstances,
    loading: kbLoading,
    needsAuth: kbNeedsAuth,
    loaded: kbLoaded,
    reload: reloadKnowledgeBases,
  } = useKnowledgeBases(kbFeatureEnabled);
  const selectedKbId = preferences.knowledgeBase ?? "";
  const selectedKb = kbInstances.find((instance) => instance.id === selectedKbId);

  const form = useForm({
    defaultValues: {
      input: "",
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      if (models.length === 0 || uploadingDocument || !selectedModel) {
        return;
      }

      if (imageMode) {
        if (value.input.length > MAX_IMAGE_PROMPT_LENGTH) {
          toast.add({
            title: `Image prompts are limited to ${MAX_IMAGE_PROMPT_LENGTH.toLocaleString()} characters.`,
            type: "warning",
          });
          return;
        }
        if (listening) {
          abortSpeech();
        }
        form.reset({ input: "" });
        onSendMessage({
          text: value.input,
          imagePrompt: imageTurn.takePromptMessage(value.input, selectedModel),
        });
        return;
      }

      const totalChars = getMessageContentLength([
        ...files,
        ...attachments.map(createContextAttachmentPart),
        { type: "text", text: value.input },
      ]);
      if (totalChars > MODEL_CONTEXT_MAX_CHARS) {
        toast.add({
          title: "Message and context attachments exceed the 64,000-character limit.",
          type: "warning",
        });
        return;
      }

      if (listening) {
        abortSpeech();
      }

      const nextText = value.input;
      const nextFiles = files;
      const nextAttachments = attachments;

      form.reset({ input: "" });
      filesRef.current = [];
      attachmentsRef.current = [];
      setFiles([]);
      setAttachments([]);
      onSendMessage({
        text: nextText,
        files: nextFiles,
        attachments: nextAttachments,
      });
    },
  });

  useEffect(() => {
    if (!preferencesReady || catalogLoading || !selectedKbId) {
      return;
    }
    if (!capabilities.knowledgeBase) {
      setPreference("knowledgeBase", undefined);
      return;
    }
    if (kbFeatureEnabled && kbLoaded && !kbLoading && !kbNeedsAuth && !selectedKb) {
      setPreference("knowledgeBase", undefined);
    }
  }, [
    preferencesReady,
    catalogLoading,
    capabilities.knowledgeBase,
    kbFeatureEnabled,
    kbLoaded,
    kbLoading,
    kbNeedsAuth,
    selectedKbId,
    selectedKb,
    setPreference,
  ]);

  // Stores the fallback only after preferences, the model layout and the catalog are ready,
  // avoiding overwriting the stored selection during initial client catalog hydration.
  useEffect(() => {
    if (
      !preferencesReady ||
      !layoutReady ||
      catalogLoading ||
      models.length === 0 ||
      !selectedModel
    ) {
      return;
    }
    if (preferences.modelId !== selectedModel.id) {
      setPreference("modelId", selectedModel.id);
    }
  }, [
    preferencesReady,
    layoutReady,
    catalogLoading,
    models.length,
    preferences,
    selectedModel,
    setPreference,
  ]);

  useEffect(() => {
    if (!catalogLoading && selectedModel && !selectedModel.input?.includes("image")) {
      filesRef.current = [];
      setFiles([]);
    }
  }, [catalogLoading, selectedModel]);

  // Context Attachments belong to chat turns; an image model never receives them.
  useEffect(() => {
    if (imageMode) {
      attachmentsRef.current = [];
      setAttachments([]);
    }
  }, [imageMode]);

  const onSendClick = () => {
    switch (status) {
      case "streaming":
        onStop?.();
        break;
      case "error":
        onRetry?.();
        break;
    }
  };

  const appendFiles = (newFiles: FileUIPart[]) => {
    const combinedFiles = [...filesRef.current, ...newFiles];
    if (combinedFiles.length > MAX_IMAGE_PARTS) {
      toast.add({
        title: `You can only attach up to ${MAX_IMAGE_PARTS} images.`,
        type: "warning",
      });
    }
    const nextFiles = combinedFiles.slice(0, MAX_IMAGE_PARTS);
    filesRef.current = nextFiles;
    setFiles(nextFiles);
  };

  const appendAttachment = (attachment: ContextAttachmentData) => {
    if (attachmentsRef.current.length >= MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE) {
      toast.add({
        title: `You can only attach up to ${MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE} context items per message.`,
        type: "warning",
      });
      return;
    }
    const nextAttachments = [...attachmentsRef.current, attachment];
    attachmentsRef.current = nextAttachments;
    setAttachments(nextAttachments);
  };

  const toFilePart = async (file: File): Promise<FileUIPart | null> => {
    const compressed = await compressImage(file);
    if (!compressed) {
      toast.add({
        title: `Unable to attach ${file.name}: unsupported or too large.`,
        type: "warning",
      });
      return null;
    }
    return { type: "file", filename: file.name, ...compressed };
  };

  const onAddReferenceImages = () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.multiple = true;
    fileInput.onchange = () => {
      const picked = Array.from(fileInput.files ?? []);
      if (picked.length > 0) {
        void imageTurn.addReferenceImages(
          picked.map((file) => ({ blob: file, filename: file.name })),
        );
      }
    };
    fileInput.click();
  };

  const onAddImages = () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.multiple = true;
    fileInput.onchange = async () => {
      const fileParts = await Promise.all(Array.from(fileInput.files ?? []).map(toFilePart));
      appendFiles(fileParts.filter((file): file is FileUIPart => file !== null));
    };
    fileInput.click();
  };

  const uploadDocument = async (file: File) => {
    if (attachmentsRef.current.length >= MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE) {
      toast.add({
        title: `You can only attach up to ${MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE} context items per message.`,
        type: "warning",
      });
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast.add({
        title: `${file.name} exceeds the 4 MiB upload limit.`,
        type: "warning",
      });
      return;
    }

    setUploadingDocument(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/context/document", {
        method: "POST",
        body,
      });

      if (response.status === 401) {
        onUnauthorized?.(() => {
          if (kbFeatureEnabled) {
            void reloadKnowledgeBases();
          }
        });
        return;
      }
      if (!response.ok) {
        const message = (await response.text()).trim();
        toast.add({
          title: message || `Failed to read ${file.name}.`,
          type: "error",
        });
        return;
      }

      const data = (await response.json()) as { attachment: ContextAttachmentData };
      appendAttachment(data.attachment);
    } catch {
      toast.add({
        title: `Failed to upload ${file.name}.`,
        type: "error",
      });
    } finally {
      setUploadingDocument(false);
    }
  };

  const uploadDocumentsWithinLimit = async (selectedFiles: File[]) => {
    const availableSlots = MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE - attachmentsRef.current.length;
    if (availableSlots <= 0) {
      toast.add({
        title: `You can only attach up to ${MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE} context items per message.`,
        type: "warning",
      });
      return;
    }

    const filesToUpload = selectedFiles.slice(0, availableSlots);
    if (selectedFiles.length > availableSlots) {
      toast.add({
        title: `You can only attach up to ${MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE} context items per message.`,
        type: "warning",
      });
    }

    for (const file of filesToUpload) {
      await uploadDocument(file);
    }
  };

  const onAddDocuments = () => {
    if (attachmentsRef.current.length >= MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE) {
      toast.add({
        title: `You can only attach up to ${MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE} context items per message.`,
        type: "warning",
      });
      return;
    }

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = DOCUMENT_FILE_ACCEPT;
    fileInput.multiple = true;
    fileInput.onchange = async () => {
      await uploadDocumentsWithinLimit(Array.from(fileInput.files ?? []));
    };
    fileInput.click();
  };

  const onPaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardItems = event.clipboardData.items;
    const imageFiles: File[] = [];
    const referenceFiles: File[] = [];
    const docFiles: File[] = [];

    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      if (item.kind !== "file") {
        continue;
      }
      const file = item.getAsFile();
      if (!file) {
        continue;
      }

      if (file.type.startsWith("image/")) {
        if (selectedModel?.input?.includes("image")) {
          event.preventDefault();
          imageFiles.push(file);
        } else if (supportsReferenceImages) {
          event.preventDefault();
          referenceFiles.push(file);
        }
      } else if (enableContextAttachments && capabilities.documents) {
        event.preventDefault();
        docFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      const fileParts = await Promise.all(imageFiles.map(toFilePart));
      const newFiles = fileParts.filter((file): file is FileUIPart => file !== null);
      if (newFiles.length > 0) {
        appendFiles(newFiles);
      }
    }
    if (referenceFiles.length > 0) {
      void imageTurn.addReferenceImages(
        referenceFiles.map((file) => ({ blob: file, filename: file.name })),
      );
    }
    if (docFiles.length > 0) {
      await uploadDocumentsWithinLimit(docFiles);
    }
  };

  const supportsImage = Boolean(selectedModel?.input?.includes("image"));
  const supportsDocument = enableContextAttachments && capabilities.documents;
  const supportsWebFetch = enableContextAttachments && capabilities.webFetch;
  const showAttachControl = supportsImage || supportsDocument || supportsWebFetch;
  const referenceImages = supportsReferenceImages ? imageTurn.referenceImages : [];
  const hasTopAddon = files.length > 0 || attachments.length > 0 || referenceImages.length > 0;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className={className}
    >
      <form.Field name="input">
        {(field) => (
          <Field>
            {/* The empty input disables only the send button, so the group keeps its normal look. */}
            <InputGroup className="rounded-md border-3 border-border transition-all focus-within:border-primary has-disabled:bg-transparent has-disabled:opacity-100 has-[[data-slot=input-group-control]:focus-visible]:border-primary has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:has-disabled:bg-input/30">
              {hasTopAddon && (
                <InputGroupAddon align="block-start" className="flex-wrap gap-2">
                  {referenceImages.map((reference) => (
                    <ImageAttachmentItem
                      key={reference.id}
                      src={reference.url}
                      alt={reference.filename}
                      onRemove={() => imageTurn.removeReferenceImage(reference.id)}
                    />
                  ))}

                  {files.map((file, index) => (
                    <ImageAttachmentItem
                      key={`${file.filename}-${file.url}`}
                      src={file.url}
                      alt={file.filename ?? "image"}
                      onRemove={() => {
                        setFiles((prevState) => prevState.filter((_, i) => i !== index));
                      }}
                    />
                  ))}

                  {attachments.map((attachment) => (
                    <ContextAttachmentItem
                      key={attachment.id}
                      attachment={attachment}
                      onRemove={() => {
                        setAttachments((current) =>
                          current.filter((item) => item.id !== attachment.id),
                        );
                      }}
                    />
                  ))}
                </InputGroupAddon>
              )}

              <InputGroupTextarea
                id="chat-message-input"
                name={field.name}
                autoFocus
                className="max-h-[50vh] scrollbar-auto scrollbar-thumb-border scrollbar-track-transparent"
                placeholder="Text here..."
                aria-label="Message"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void form.handleSubmit();
                  }
                }}
                onPaste={onPaste}
              />

              <InputGroupAddon align="block-end" className="min-w-0 gap-1 sm:gap-2">
                <ModelSelect
                  selectedModel={selectedModel}
                  groups={modelGroups}
                  loading={catalogLoading}
                  error={catalogError}
                  onReload={reloadCatalog}
                  onSelectModel={(model) => setPreference("modelId", model.id)}
                />

                {imageMode && selectedModel ? (
                  <ImageParamsPanel
                    model={selectedModel}
                    profile={imageTurn.profile}
                    params={imageTurn.params}
                    onChangeParams={imageTurn.setParams}
                  />
                ) : (
                  addon
                )}

                {supportsReferenceImages && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <InputGroupButton
                          size="icon-sm"
                          variant={referenceImages.length > 0 ? "secondary" : "ghost"}
                          aria-label="Attach reference images"
                          onClick={onAddReferenceImages}
                        />
                      }
                    >
                      <ImagePlus />
                    </TooltipTrigger>
                    <TooltipContent>
                      Attach up to {imageTurn.profile.maxReferenceImages} reference images
                    </TooltipContent>
                  </Tooltip>
                )}

                {!imageMode && selectedModel?.input?.includes("search") && (
                  <Toggle
                    variant="primary"
                    aria-label="Toggle web search"
                    pressed={searchEnabled}
                    onPressedChange={(pressed) => setPreference("searchEnabled", pressed)}
                  >
                    <Earth />
                    Search
                  </Toggle>
                )}

                {kbFeatureEnabled &&
                  (kbNeedsAuth ? (
                    <InputGroupButton
                      size="sm"
                      aria-label="Knowledge Base"
                      onClick={async () => {
                        const ok = await reloadKnowledgeBases();
                        if (!ok) {
                          onUnauthorized?.(() => {
                            void reloadKnowledgeBases();
                          });
                        }
                      }}
                    >
                      <Database />
                      <span className="hidden sm:inline">KB</span>
                    </InputGroupButton>
                  ) : kbInstances.length > 0 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <InputGroupButton
                            size="sm"
                            variant={selectedKb ? "secondary" : "ghost"}
                            aria-label="Select Knowledge Base"
                          />
                        }
                      >
                        <Database />
                        <span className="hidden max-w-28 truncate sm:inline">
                          {selectedKb ? selectedKb.name : "KB"}
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" side="top">
                        <DropdownMenuRadioGroup
                          value={selectedKb?.id ?? ""}
                          onValueChange={(value) =>
                            setPreference(
                              "knowledgeBase",
                              typeof value === "string" && value ? value : undefined,
                            )
                          }
                        >
                          <DropdownMenuRadioItem value="">None</DropdownMenuRadioItem>
                          {kbInstances.map((instance) => (
                            <DropdownMenuRadioItem key={instance.id} value={instance.id}>
                              {instance.name}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null)}

                {showAttachControl && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <InputGroupButton
                          size="icon-sm"
                          aria-label="Attach context"
                          disabled={uploadingDocument}
                        />
                      }
                    >
                      {uploadingDocument ? <Spinner /> : <Paperclip />}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" className="w-auto">
                      {supportsImage && (
                        <DropdownMenuItem onClick={onAddImages}>
                          <ImagePlus />
                          Upload image
                        </DropdownMenuItem>
                      )}
                      {supportsDocument && (
                        <DropdownMenuItem onClick={onAddDocuments}>
                          <FileText />
                          Upload document
                        </DropdownMenuItem>
                      )}
                      {supportsWebFetch && (
                        <DropdownMenuItem
                          onClick={() => {
                            if (
                              attachmentsRef.current.length >= MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE
                            ) {
                              toast.add({
                                title: `You can only attach up to ${MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE} context items per message.`,
                                type: "warning",
                              });
                              return;
                            }
                            setUrlDialogOpen(true);
                          }}
                        >
                          <Globe />
                          Attach webpage URL
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <div className="ml-auto flex items-center gap-1">
                  {speechSupported && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <InputGroupButton
                            size="icon-sm"
                            variant={listening ? "destructive" : "ghost"}
                            aria-label={listening ? "Stop voice input" : "Voice input"}
                            onClick={() => {
                              if (listening) {
                                stopSpeech();
                              } else {
                                startSpeech(field.state.value, (nextText) => {
                                  field.handleChange(nextText);
                                });
                              }
                            }}
                          />
                        }
                      >
                        {listening ? <MicOff /> : <Mic />}
                      </TooltipTrigger>
                      <TooltipContent>
                        {listening ? "Stop voice input" : "Voice input"}
                      </TooltipContent>
                    </Tooltip>
                  )}

                  <InputGroupButton
                    size="icon-sm"
                    variant="default"
                    aria-label={
                      status === "streaming" ? "Stop" : status === "error" ? "Retry" : "Send"
                    }
                    disabled={
                      models.length === 0 ||
                      uploadingDocument ||
                      status === "submitted" ||
                      (field.state.value.trim().length === 0 && status === "ready")
                    }
                    type={status === "ready" ? "submit" : "button"}
                    onClick={onSendClick}
                  >
                    {status === "ready" && <ArrowUp />}
                    {status === "submitted" && <Spinner />}
                    {status === "streaming" && <Square className="fill-primary-foreground" />}
                    {status === "error" && <RefreshCw />}
                  </InputGroupButton>
                </div>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        )}
      </form.Field>

      {supportsWebFetch && (
        <UrlAttachmentDialog
          open={urlDialogOpen}
          onOpenChange={setUrlDialogOpen}
          browserRenderAvailable={capabilities.browserRender}
          onAttached={appendAttachment}
          onUnauthorized={() =>
            onUnauthorized?.(() => {
              if (kbFeatureEnabled) {
                void reloadKnowledgeBases();
              }
            })
          }
        />
      )}
    </form>
  );
};

export default ChatInput;
