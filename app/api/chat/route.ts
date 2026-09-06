import type { LanguageModelV3 } from "@ai-sdk/provider";
import {
  convertToModelMessages,
  extractReasoningMiddleware,
  stepCountIs,
  streamText,
  wrapLanguageModel,
} from "ai";
import { executeCode } from "ai-sdk-tool-code-execution";
import * as v from "valibot";
import { aigateway, google, workersai } from "@/app/api";
import type { Message } from "@/lib/db";
import { getCatalogModel } from "@/lib/model-catalog";
import type { Model } from "@/lib/models";

const chatSchema = v.object({
  messages: v.pipe(v.array(v.unknown()), v.minLength(1)),
  model: v.pipe(v.string(), v.minLength(1)),
  provider: v.picklist(["workers-ai", "google"]),
  search: v.optional(v.boolean()),
});

export async function POST(request: Request) {
  const parsed = v.safeParse(
    chatSchema,
    await request.json().catch(() => undefined),
  );
  if (!parsed.success) {
    return new Response("Invalid request data", { status: 400 });
  }

  const { messages, model, provider, search } = parsed.output as {
    messages: Message[];
    model: Model["id"];
    provider: Model["provider"];
    search?: boolean;
  };
  const catalogModel = await getCatalogModel(
    model,
    "Text Generation",
    provider,
  );
  if (!catalogModel) {
    return new Response(
      "The model catalog has changed. Refresh and select another model.",
      { status: 409 },
    );
  }

  let providerModel: LanguageModelV3;
  const tools = {};
  switch (provider) {
    case "google":
      providerModel = aigateway([google.chat(model)]);

      Object.assign(tools, {
        ...(search ? { google_search: google.tools.googleSearch({}) } : {}),
      });
      break;
    case "workers-ai": {
      const workerModel = workersai.chat(model);
      providerModel = catalogModel.reasoning
        ? wrapLanguageModel({
            model: workerModel,
            middleware: extractReasoningMiddleware({ tagName: "think" }),
          })
        : workerModel;

      if (catalogModel.tools && process.env.VERCEL_OIDC_TOKEN) {
        Object.assign(tools, {
          executeCode: executeCode(),
        });
      }
      break;
    }
  }

  const result = streamText({
    model: providerModel,
    messages: await convertToModelMessages(messages),
    system:
      "You are a helpful assistant. Follow the user's instructions carefully. Respond using Markdown.",
    tools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
