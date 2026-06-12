import type { LanguageModelV3 } from "@ai-sdk/provider";
import {
  convertToModelMessages,
  extractReasoningMiddleware,
  stepCountIs,
  streamText,
  wrapLanguageModel,
} from "ai";
import { z } from "zod";
import { aigateway, google, workersai } from "@/app/api";
import type { Message } from "@/lib/db";
import type { Model } from "@/lib/models";
import { executeCode } from "ai-sdk-tool-code-execution";

const chatSchema = z.object({
  messages: z.array(z.any()).min(1),
  model: z.string().min(1),
  provider: z.enum(["workers-ai", "google"]),
  search: z.boolean().optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = chatSchema.safeParse(body);

  if (!parsed.success) {
    return new Response("Invalid request data", { status: 400 });
  }

  const { messages, model, provider, search } = parsed.data as {
    messages: Message[];
    model: Model["id"];
    provider: Model["provider"];
    search?: boolean;
  };

  let providerModel: LanguageModelV3;
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

      if (process.env.VERCEL_OIDC_TOKEN) {
        Object.assign(tools, {
          executeCode: executeCode(),
        });
      }
      break;
    default:
      return new Response(`Unsupported provider: ${provider}`, { status: 400 });
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
