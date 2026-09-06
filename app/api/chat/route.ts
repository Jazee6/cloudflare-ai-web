import type { LanguageModelV4 } from "@ai-sdk/provider";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  extractReasoningMiddleware,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  wrapLanguageModel,
} from "ai";
import * as v from "valibot";
import {
  getGoogleGatewayProviders,
  getWorkersAIProvider,
  ProviderConfigurationError,
} from "@/app/api";
import { buildModelContext, MODEL_CONTEXT_MAX_MESSAGES } from "@/lib/model-context";
import { getCatalogModel } from "@/lib/model-catalog";
import { readRequestBody, validateImageParts } from "@/lib/request-limits";

const chatSchema = v.object({
  messages: v.pipe(v.array(v.unknown()), v.minLength(1), v.maxLength(MODEL_CONTEXT_MAX_MESSAGES)),
  model: v.pipe(v.string(), v.minLength(1)),
  provider: v.picklist(["workers-ai", "google"]),
  search: v.optional(v.boolean()),
});

export async function POST(request: Request) {
  const bodyResult = await readRequestBody(request);
  if (!bodyResult.ok) {
    return new Response(bodyResult.message, { status: bodyResult.status });
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyResult.text);
  } catch {
    return new Response("Invalid request data", { status: 400 });
  }

  const parsed = v.safeParse(chatSchema, body);
  if (!parsed.success) {
    return new Response("Invalid request data", { status: 400 });
  }

  const validatedMessages = await safeValidateUIMessages({ messages: parsed.output.messages });
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

  const { model, provider, search } = parsed.output;
  const catalogModel = await getCatalogModel(model, "Text Generation", provider);
  if (!catalogModel) {
    return new Response("The model catalog has changed. Refresh and select another model.", {
      status: 409,
    });
  }

  type GoogleSearchTool = ReturnType<
    ReturnType<typeof getGoogleGatewayProviders>["google"]["tools"]["googleSearch"]
  >;
  let providerModel: LanguageModelV4;
  let googleSearchTool: GoogleSearchTool | undefined;
  try {
    switch (provider) {
      case "google": {
        const { gateway, google } = getGoogleGatewayProviders();
        providerModel = gateway([google.chat(model)]);
        googleSearchTool = search ? google.tools.googleSearch({}) : undefined;
        break;
      }
      case "workers-ai": {
        const workerModel = getWorkersAIProvider().chat(model);
        providerModel = catalogModel.reasoning
          ? wrapLanguageModel({
              model: workerModel,
              middleware: extractReasoningMiddleware({ tagName: "think" }),
            })
          : workerModel;
        break;
      }
    }
  } catch (error) {
    if (error instanceof ProviderConfigurationError) {
      console.error(error.message);
      return new Response("The selected provider is not configured.", { status: 503 });
    }
    throw error;
  }

  const tools = googleSearchTool ? { google_search: googleSearchTool } : undefined;
  const result = streamText({
    model: providerModel,
    messages: await convertToModelMessages(modelContext),
    instructions:
      "You are a helpful assistant. Follow the user's instructions carefully. Respond using Markdown.",
    tools,
    stopWhen: isStepCount(5),
  });
  const stream = toUIMessageStream({ stream: result.stream, originalMessages: modelContext });

  return createUIMessageStreamResponse({ stream });
}
