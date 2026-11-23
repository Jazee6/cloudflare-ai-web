import { APICallError } from "@ai-sdk/provider";
import {
  convertToModelMessages,
  RetryError,
  createUIMessageStreamResponse,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from "ai";
import * as v from "valibot";
import { KnowledgeBaseError, searchKnowledgeBase } from "@/lib/ai-search";
import {
  formatContextAttachmentForModel,
  isContextAttachmentPart,
  validateContextAttachmentParts,
} from "@/lib/context-attachments";
import { extractGatewayMetadata, mapUpstreamError } from "@/lib/gateway-errors";
import { getCatalogModel } from "@/lib/model-catalog";
import { buildModelContext, MODEL_CONTEXT_MAX_MESSAGES } from "@/lib/model-context";
import type { Model } from "@/lib/models";
import {
  createPersonalChatModel,
  mapPersonalFailure,
  type PersonalGateway,
  resolvePersonalGateway,
  toPersonalModel,
} from "@/lib/personal-gateway";
import { personalRequestSchema } from "@/lib/personal-providers";
import { type ChatModel, createChatModel, ProviderConfigurationError } from "@/lib/providers";
import { parseJsonRequest, validateImageParts } from "@/lib/request-limits";
import type { Citation, GatewayMetadata, ResponseMetadata } from "@/lib/response-metadata";
import { MAX_CUSTOM_INSTRUCTIONS_LENGTH } from "@/lib/settings";

const BASE_CHAT_INSTRUCTIONS =
  "You are a helpful assistant. Follow the user's instructions carefully. Respond using Markdown.";

const chatSchema = v.object({
  messages: v.pipe(v.array(v.unknown()), v.minLength(1), v.maxLength(MODEL_CONTEXT_MAX_MESSAGES)),
  model: v.pipe(v.string(), v.minLength(1)),
  provider: v.picklist(["workers-ai", "ai-gateway"]),
  search: v.optional(v.boolean()),
  skipCache: v.optional(v.boolean()),
  retry: v.optional(v.boolean()),
  knowledgeBaseId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  instructions: v.optional(
    v.pipe(v.string(), v.trim(), v.maxLength(MAX_CUSTOM_INSTRUCTIONS_LENGTH)),
  ),
  /** Set for Personal Models: the visitor's provider credentials and model declaration. */
  personal: v.optional(personalRequestSchema),
});

export async function POST(request: Request) {
  const parsed = await parseJsonRequest(request, chatSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const validatedMessages = await safeValidateUIMessages({ messages: parsed.data.messages });
  if (
    !validatedMessages.success ||
    validatedMessages.data.some((message) => !["user", "assistant"].includes(message.role))
  ) {
    return new Response("Invalid request data", { status: 400 });
  }

  const imageValidation = validateImageParts(validatedMessages.data);
  if (!imageValidation.ok) {
    return new Response(imageValidation.message, { status: imageValidation.status });
  }

  const attachmentValidation = validateContextAttachmentParts(validatedMessages.data);
  if (!attachmentValidation.ok) {
    return new Response(attachmentValidation.message, { status: attachmentValidation.status });
  }

  const modelContext = buildModelContext(validatedMessages.data);
  if (!modelContext) {
    return new Response("The latest message is too long to process.", { status: 413 });
  }

  const {
    model,
    provider,
    search,
    skipCache,
    retry,
    knowledgeBaseId,
    instructions: custom,
    personal,
  } = parsed.data;

  let catalogModel: Model | undefined;
  let personalGateway: PersonalGateway | undefined;
  if (personal) {
    if (personal.declaration.type !== "Text Generation") {
      return new Response("Select a chat model to continue this response.", { status: 400 });
    }
    const resolved = resolvePersonalGateway(personal, personal.declaration.modelId);
    if (!resolved.ok) {
      return new Response(resolved.message, { status: resolved.status });
    }
    personalGateway = resolved.gateway;
    catalogModel = toPersonalModel(personal);
  } else {
    catalogModel = await getCatalogModel(model, "Text Generation", provider);
  }
  if (!catalogModel) {
    return new Response("The model catalog has changed. Refresh and select another model.", {
      status: 409,
    });
  }

  const baseInstructions = custom || BASE_CHAT_INSTRUCTIONS;
  let instructions = baseInstructions;
  let citations: Citation[] = [];
  if (knowledgeBaseId) {
    try {
      const kbResult = await searchKnowledgeBase({
        instanceId: knowledgeBaseId,
        messages: modelContext,
      });
      if (kbResult.contextText) {
        instructions = `${baseInstructions}\n\n${kbResult.contextText}`;
      }
      citations = kbResult.citations;
    } catch (error) {
      if (error instanceof KnowledgeBaseError) {
        return new Response(error.message, { status: error.status });
      }
      throw error;
    }
  }

  let gatewayMetadata: GatewayMetadata | undefined;
  const mergeGatewayMetadata = (next?: GatewayMetadata) => {
    if (!next) {
      return;
    }
    gatewayMetadata = { ...gatewayMetadata, ...next };
  };

  const mapError = (error: unknown) => {
    if (!personalGateway) {
      return mapUpstreamError(error, { provider: catalogModel.provider });
    }
    const unwrapped = RetryError.isInstance(error) && error.lastError ? error.lastError : error;
    return APICallError.isInstance(unwrapped)
      ? mapPersonalFailure(
          personalGateway,
          unwrapped.statusCode,
          unwrapped.responseBody,
          unwrapped.responseHeaders,
        )
      : mapPersonalFailure(personalGateway, undefined);
  };

  let chatModel: ChatModel;
  try {
    chatModel =
      personal && personalGateway
        ? createPersonalChatModel(personalGateway, personal, { search, skipCache, retry })
        : createChatModel(catalogModel, {
            search,
            skipCache,
            retry,
            onGatewayMetadata: mergeGatewayMetadata,
          });
  } catch (error) {
    if (error instanceof ProviderConfigurationError) {
      console.error(error.message);
      const mapped = mapUpstreamError(error, { provider: catalogModel.provider });
      return new Response(mapped.message, { status: mapped.status });
    }
    throw error;
  }

  const result = streamText({
    model: chatModel.model,
    messages: await convertToModelMessages(modelContext, {
      convertDataPart: (part) =>
        isContextAttachmentPart(part)
          ? { type: "text", text: formatContextAttachmentForModel(part.data) }
          : undefined,
    }),
    instructions,
    tools: chatModel.tools,
    maxOutputTokens: chatModel.maxOutputTokens,
    stopWhen: isStepCount(5),
    // The SDK logs raw errors by default; Personal errors may echo the visitor's credentials and
    // are logged in redacted form by the UI stream below.
    ...(personalGateway ? { onError: () => {} } : {}),
  });
  // Reasoning segments are timed here because the AI SDK does not time them. Each finished
  // segment resends the whole list, since metadata merges replace arrays.
  const reasoningStarts = new Map<string, { index: number; startedAt: number }>();
  const reasoningSeconds: (number | null)[] = [];
  let usage: ResponseMetadata["usage"];
  const stream = toUIMessageStream({
    stream: result.stream,
    originalMessages: modelContext,
    onError: (error) => {
      const mapped = mapError(error);
      if (personalGateway) {
        // Upstream errors can carry request details, so Personal failures log only the outcome.
        console.error(`Personal chat stream error: ${mapped.status} ${mapped.message}`);
      } else {
        console.error(`Chat stream error for ${catalogModel.id}:`, error);
      }
      return mapped.message;
    },
    messageMetadata: ({ part }): ResponseMetadata | undefined => {
      switch (part.type) {
        case "reasoning-start":
          reasoningStarts.set(part.id, { index: reasoningSeconds.length, startedAt: Date.now() });
          reasoningSeconds.push(null);
          return undefined;
        case "reasoning-end": {
          const segment = reasoningStarts.get(part.id);
          if (!segment) {
            return undefined;
          }
          reasoningStarts.delete(part.id);
          reasoningSeconds[segment.index] = Math.ceil((Date.now() - segment.startedAt) / 1000);
          return { reasoningSeconds: [...reasoningSeconds] };
        }
        case "finish-step":
          mergeGatewayMetadata(extractGatewayMetadata(part.response.headers));
          // Each step resends the conversation, so the last step alone reflects Context Usage.
          if (part.usage.inputTokens !== undefined || part.usage.outputTokens !== undefined) {
            usage = {
              inputTokens: part.usage.inputTokens ?? 0,
              outputTokens: part.usage.outputTokens ?? 0,
            };
          }
          return undefined;
        case "finish": {
          return {
            modelName: catalogModel.name,
            ...(usage ? { usage, contextWindow: catalogModel.contextWindow } : {}),
            ...(gatewayMetadata ? { gateway: gatewayMetadata } : {}),
            ...(citations.length > 0 ? { citations } : {}),
          };
        }
        default:
          return undefined;
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
