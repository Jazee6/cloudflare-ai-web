"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import type { ChatStatus, FileUIPart } from "ai";
import {
  ArrowUp,
  Database,
  Earth,
  FileText,
  Globe,
  ImagePlus,
  Paperclip,
  RefreshCw,
  Square,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as v from "valibot";
import { ContextAttachmentItem } from "@/components/context-attachment-item";
import { useModelCatalogState, useModelPreferences } from "@/components/model-catalog-provider";
import ModelSelect from "@/components/model-select";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentMedia,
} from "@/components/ui/attachment";
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
import { UrlAttachmentDialog } from "@/components/url-attachment-dialog";
import { useKnowledgeBases } from "@/hooks/use-knowledge-bases";
import {
  type ContextAttachmentData,
  createContextAttachmentPart,
  MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE,
  MAX_DOCUMENT_BYTES,
} from "@/lib/context-attachments";
import { DOCUMENT_FILE_ACCEPT } from "@/lib/context-document";
import { compressImage } from "@/lib/image-compression";
import { getMessageContentLength, MODEL_CONTEXT_MAX_CHARS } from "@/lib/model-context";
import type { Model } from "@/lib/models";
import { MAX_IMAGE_PARTS } from "@/lib/request-limits";
import type { StoredModelKey } from "@/lib/utils";

export interface onSendMessageProps {
  text: string;
  files?: FileUIPart[];
  attachments?: ContextAttachmentData[];
}

const formSchema = v.object({
  input: v.pipe(v.string(), v.trim(), v.minLength(1)),
});

type FormData = v.InferOutput<typeof formSchema>;

const ChatInput = ({
  className,
  onSendMessage,
  onStop,
  onRetry,
  onUnauthorized,
  status = "ready",
  models,
  modelKey,
  enableContextAttachments = true,
  addon,
}: {
  className?: string;
  onSendMessage: (data: onSendMessageProps) => void;
  onStop?: () => void;
  onRetry?: () => void;
  onUnauthorized?: () => void;
  status?: ChatStatus;
  models: Model[];
  modelKey?: StoredModelKey;
  enableContextAttachments?: boolean;
  /** Extra controls shown next to the model selector. */
  addon?: ReactNode;
}) => {
  const { preferences, ready: preferencesReady, setPreference } = useModelPreferences();
  const {
    capabilities,
    loading: catalogLoading,
    error: catalogError,
    reload: reloadCatalog,
  } = useModelCatalogState();
  const selectedModelKey = modelKey ?? "CF_AI_MODEL";
  const form = useForm<FormData>({
    resolver: valibotResolver(formSchema),
    defaultValues: {
      input: "",
    },
  });
  const input = form.watch("input");
  const selectedModel =
    models.find((model) => model.id === preferences[selectedModelKey]) ?? models[0];
  const [files, setFiles] = useState<FileUIPart[]>([]);
  const [attachments, setAttachments] = useState<ContextAttachmentData[]>([]);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const searchEnabled = preferences.CF_AI_SEARCH_ENABLED === "true";

  const kbFeatureEnabled = enableContextAttachments && capabilities.knowledgeBase;
  const {
    instances: kbInstances,
    needsAuth: kbNeedsAuth,
    reload: reloadKnowledgeBases,
  } = useKnowledgeBases(kbFeatureEnabled);
  const selectedKbId = preferences.CF_AI_KNOWLEDGE_BASE ?? "";
  const selectedKb = kbInstances.find((instance) => instance.id === selectedKbId);

  // Stores the fallback only after both preferences and catalog are ready,
  // avoiding overwriting stored cookies during initial client catalog hydration.
  useEffect(() => {
    if (!preferencesReady || catalogLoading || models.length === 0 || !selectedModel) {
      return;
    }
    if (preferences[selectedModelKey] !== selectedModel.id) {
      setPreference(selectedModelKey, selectedModel.id);
    }
  }, [
    preferencesReady,
    catalogLoading,
    models.length,
    preferences,
    selectedModel,
    selectedModelKey,
    setPreference,
  ]);

  useEffect(() => {
    if (!catalogLoading && selectedModel && !selectedModel.input?.includes("image")) {
      setFiles([]);
    }
  }, [catalogLoading, selectedModel]);

  function onSubmit(values: FormData) {
    if (models.length === 0 || uploadingDocument) {
      return;
    }

    const totalChars = getMessageContentLength([
      ...files,
      ...attachments.map(createContextAttachmentPart),
      { type: "text", text: values.input },
    ]);
    if (totalChars > MODEL_CONTEXT_MAX_CHARS) {
      toast.add({
        title: "Message and context attachments exceed the 64,000-character limit.",
        type: "warning",
      });
      return;
    }

    form.resetField("input");
    setFiles([]);
    setAttachments([]);
    onSendMessage({
      text: values.input,
      files,
      attachments,
    });
  }

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
    setFiles((currentFiles) => {
      const combinedFiles = [...currentFiles, ...newFiles];
      if (combinedFiles.length > MAX_IMAGE_PARTS) {
        toast.add({
          title: `You can only attach up to ${MAX_IMAGE_PARTS} images.`,
          type: "warning",
        });
      }
      return combinedFiles.slice(0, MAX_IMAGE_PARTS);
    });
  };

  const appendAttachment = (attachment: ContextAttachmentData) => {
    setAttachments((current) => {
      if (current.length >= MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE) {
        toast.add({
          title: `You can only attach up to ${MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE} context items per message.`,
          type: "warning",
        });
        return current;
      }
      return [...current, attachment];
    });
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
    if (attachments.length >= MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE) {
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
        onUnauthorized?.();
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

  const onAddDocuments = () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = DOCUMENT_FILE_ACCEPT;
    fileInput.multiple = true;
    fileInput.onchange = async () => {
      for (const file of Array.from(fileInput.files ?? [])) {
        await uploadDocument(file);
      }
    };
    fileInput.click();
  };

  const onPaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardItems = event.clipboardData.items;
    const newFiles: FileUIPart[] = [];
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
          const filePart = await toFilePart(file);
          if (filePart) {
            newFiles.push(filePart);
          }
        }
      } else if (enableContextAttachments && capabilities.documents) {
        event.preventDefault();
        docFiles.push(file);
      }
    }

    if (newFiles.length > 0) {
      appendFiles(newFiles);
    }
    for (const docFile of docFiles) {
      await uploadDocument(docFile);
    }
  };

  const supportsImage = Boolean(selectedModel?.input?.includes("image"));
  const supportsDocument = enableContextAttachments && capabilities.documents;
  const supportsWebFetch = enableContextAttachments && capabilities.webFetch;
  const showAttachControl = supportsImage || supportsDocument || supportsWebFetch;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className={className}>
      <Controller
        control={form.control}
        name="input"
        render={({ field }) => (
          <Field>
            {/* The empty input disables only the send button, so the group keeps its normal look. */}
            <InputGroup className="rounded-md border-3 border-border transition-all focus-within:border-primary has-disabled:bg-transparent has-disabled:opacity-100 has-[[data-slot=input-group-control]:focus-visible]:border-primary has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:has-disabled:bg-input/30">
              {(files.length > 0 || attachments.length > 0) && (
                <InputGroupAddon align="block-start" className="flex-wrap gap-2">
                  {files.map((file, index) => (
                    <Attachment
                      key={`${file.filename}-${file.url}`}
                      orientation="vertical"
                      className="w-20"
                    >
                      <AttachmentMedia variant="image">
                        <img src={file.url} alt={file.filename} />
                      </AttachmentMedia>
                      <AttachmentActions>
                        <AttachmentAction
                          type="button"
                          aria-label={`Remove ${file.filename ?? "image"}`}
                          onClick={() => {
                            setFiles((prevState) => prevState.filter((_, i) => i !== index));
                          }}
                        >
                          <X />
                        </AttachmentAction>
                      </AttachmentActions>
                    </Attachment>
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
                autoFocus
                className="max-h-[50vh] scrollbar-auto scrollbar-thumb-border scrollbar-track-transparent"
                placeholder="Text here..."
                aria-label="Message"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    form.handleSubmit(onSubmit)();
                  }
                }}
                onPaste={onPaste}
                {...field}
              />

              <InputGroupAddon align="block-end" className="min-w-0 gap-1 sm:gap-2">
                <ModelSelect
                  selectedModel={selectedModel}
                  models={models}
                  loading={catalogLoading}
                  error={catalogError}
                  onReload={reloadCatalog}
                  onSelectModel={(model) => setPreference(selectedModelKey, model.id)}
                />

                {addon}

                {selectedModel?.input?.includes("search") && (
                  <Toggle
                    aria-label="Toggle web search"
                    pressed={searchEnabled}
                    onPressedChange={(pressed) =>
                      setPreference("CF_AI_SEARCH_ENABLED", pressed ? "true" : "false")
                    }
                  >
                    <Earth />
                    Search
                  </Toggle>
                )}

                {kbFeatureEnabled &&
                  (kbNeedsAuth ? (
                    <InputGroupButton
                      size="xs"
                      aria-label="Knowledge Base"
                      onClick={async () => {
                        const ok = await reloadKnowledgeBases();
                        if (!ok) {
                          onUnauthorized?.();
                        }
                      }}
                    >
                      <Database />
                      <span className="hidden sm:inline">KB</span>
                    </InputGroupButton>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <InputGroupButton
                            size="xs"
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
                              "CF_AI_KNOWLEDGE_BASE",
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
                  ))}

                {showAttachControl &&
                  (!enableContextAttachments ? (
                    <InputGroupButton
                      size="icon-sm"
                      aria-label="Attach images"
                      onClick={onAddImages}
                    >
                      <Paperclip />
                    </InputGroupButton>
                  ) : (
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
                      <DropdownMenuContent align="start" side="top">
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
                          <DropdownMenuItem onClick={() => setUrlDialogOpen(true)}>
                            <Globe />
                            Attach webpage URL
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ))}

                <InputGroupButton
                  size="icon-sm"
                  variant="default"
                  className="ml-auto"
                  aria-label={
                    status === "streaming" ? "Stop" : status === "error" ? "Retry" : "Send"
                  }
                  disabled={
                    models.length === 0 ||
                    uploadingDocument ||
                    status === "submitted" ||
                    (input.trim().length === 0 && status === "ready")
                  }
                  type={status === "ready" ? "submit" : "button"}
                  onClick={onSendClick}
                >
                  {status === "ready" && <ArrowUp />}
                  {status === "submitted" && <Spinner />}
                  {status === "streaming" && <Square className="fill-primary-foreground" />}
                  {status === "error" && <RefreshCw />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        )}
      />

      {supportsWebFetch && (
        <UrlAttachmentDialog
          open={urlDialogOpen}
          onOpenChange={setUrlDialogOpen}
          browserRenderAvailable={capabilities.browserRender}
          onAttached={appendAttachment}
          onUnauthorized={onUnauthorized}
        />
      )}
    </form>
  );
};

export default ChatInput;
