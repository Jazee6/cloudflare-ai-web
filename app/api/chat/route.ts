import type { LanguageModelV2 } from "@ai-sdk/provider";
import {
  convertToModelMessages,
  extractReasoningMiddleware,
  stepCountIs,
  streamText,
  wrapLanguageModel,
} from "ai";
import { aigateway, google, workersai } from "@/app/api";
import type { Message } from "@/lib/db";
import type { Model } from "@/lib/models";

interface Data {
  messages: Message[];
  model: Model["id"];
  provider: Model["provider"];
  search?: boolean;
}

export async function POST(request: Request) {
  const { messages, model, provider, search } = (await request.json()) as Data;

  let providerModel: LanguageModelV2;
  const tools = {};
  switch (provider) {
    case "google":
      providerModel = aigateway([google.chat(model)]);

      Object.assign(tools, {
        // code_execution: google.tools.codeExecution({}),
        // url_context: google.tools.urlContext({}),
        ...(search ? { google_search: google.tools.googleSearch({}) } : {}),
      });
      break;
    case "workers-ai":
      providerModel = wrapLanguageModel({
        model: workersai.chat(model),
        middleware: extractReasoningMiddleware({
          tagName: "think",
          startWithReasoning: model === "@cf/qwen/qwq-32b",
        }),
      });

      // if (process.env.VERCEL_OIDC_TOKEN) {
      //   Object.assign(tools, {
      //     executeCode: executeCode(),
      //   });
      // }
      break;
  }

  const result = streamText({
    model: providerModel,
    messages: convertToModelMessages(messages),
    maxOutputTokens: provider === "workers-ai" ? 2048 : undefined,
    system:
      "You are a helpful assistant. Follow the user's instructions carefully. Respond using Markdown.",
    tools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
