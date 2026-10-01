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
    stopWhen: isStepCount(5),
  });
  const stream = toUIMessageStream({ stream: result.stream, originalMessages: modelContext });

  return createUIMessageStreamResponse({ stream });
}
