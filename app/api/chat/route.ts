import type { LanguageModelV2 } from "@ai-sdk/provider";
import {
  convertToModelMessages,
  extractReasoningMiddleware,
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
}

export async function POST(request: Request) {
  const { messages, model, provider } = (await request.json()) as Data;

  let providerModel: LanguageModelV2;
  const tools = {};
  switch (provider) {
    case "google":
      providerModel = aigateway([google.chat(model)]);
      // Object.assign(tools, {
      //   code_execution: google.tools.codeExecution({}),
      //   google_search: google.tools.googleSearch({}),
      //   url_context: google.tools.urlContext({}),
      // });
      break;
    case "workers-ai":
      providerModel = wrapLanguageModel({
        model: workersai.chat(model),
        middleware: extractReasoningMiddleware({
          tagName: "think",
          startWithReasoning: model === "@cf/qwen/qwq-32b",
        }),
      });
      break;
  }

  const result = streamText({
    model: providerModel,
    messages: convertToModelMessages(messages),
    maxOutputTokens: provider === "workers-ai" ? 2048 : undefined,
    system:
      "You are a helpful assistant. Follow the user's instructions carefully. Respond using Markdown.",
    providerOptions: {
      google: {
        thinkingConfig: {
          includeThoughts: true,
        },
      },
    },
    tools,
  });

  return result.toUIMessageStreamResponse();
}
