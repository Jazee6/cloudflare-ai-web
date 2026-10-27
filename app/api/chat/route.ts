import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from "ai";
import * as v from "valibot";
import { getCatalogModel } from "@/lib/model-catalog";
import { buildModelContext, MODEL_CONTEXT_MAX_MESSAGES } from "@/lib/model-context";
import { type ChatModel, createChatModel, ProviderConfigurationError } from "@/lib/providers";
import { parseJsonRequest, validateImageParts } from "@/lib/request-limits";
import type { ResponseMetadata } from "@/lib/response-metadata";

const chatSchema = v.object({
  messages: v.pipe(v.array(v.unknown()), v.minLength(1), v.maxLength(MODEL_CONTEXT_MAX_MESSAGES)),
  model: v.pipe(v.string(), v.minLength(1)),
  provider: v.picklist(["workers-ai", "google"]),
  search: v.optional(v.boolean()),
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

  const modelContext = buildModelContext(validatedMessages.data);
  if (!modelContext) {
    return new Response("The latest message is too long to process.", { status: 413 });
  }

  const { model, provider, search } = parsed.data;
  const catalogModel = await getCatalogModel(model, "Text Generation", provider);
  if (!catalogModel) {
    return new Response("The model catalog has changed. Refresh and select another model.", {
      status: 409,
    });
  }

  let chatModel: ChatModel;
  try {
    chatModel = createChatModel(catalogModel, { search });
  } catch (error) {
    if (error instanceof ProviderConfigurationError) {
      console.error(error.message);
      return new Response("The selected provider is not configured.", { status: 503 });
    }
    throw error;
  }

  const result = streamText({
    model: chatModel.model,
    messages: await convertToModelMessages(modelContext),
    instructions:
      "You are a helpful assistant. Follow the user's instructions carefully. Respond using Markdown.",
    tools: chatModel.tools,
    maxOutputTokens: chatModel.maxOutputTokens,
    stopWhen: isStepCount(5),
  });
  // Reasoning segments are timed here because the AI SDK does not time them. Each finished
  // segment resends the whole list, since metadata merges replace arrays.
  const reasoningStarts = new Map<string, { index: number; startedAt: number }>();
  const reasoningSeconds: (number | null)[] = [];
  let usage: ResponseMetadata["usage"];
  const stream = toUIMessageStream({
    stream: result.stream,
    originalMessages: modelContext,
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
          // Each step resends the conversation, so the last step alone reflects Context Usage.
          if (part.usage.inputTokens !== undefined || part.usage.outputTokens !== undefined) {
            usage = {
              inputTokens: part.usage.inputTokens ?? 0,
              outputTokens: part.usage.outputTokens ?? 0,
            };
          }
          return undefined;
        case "finish":
          return usage ? { usage, contextWindow: catalogModel.contextWindow } : undefined;
        default:
          return undefined;
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
