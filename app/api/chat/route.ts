import {
  convertToModelMessages,
  extractReasoningMiddleware,
  streamText,
  wrapLanguageModel,
} from "ai";
import { workersai } from "@/app/api";
import type { Message } from "@/lib/db";
import type { Model } from "@/lib/models";

interface Data {
  messages: Message[];
  model: Model["id"];
}

export async function POST(request: Request) {
  const { messages, model } = (await request.json()) as Data;

  const wrappedLanguageModel = wrapLanguageModel({
    model: workersai.chat(model),
    middleware: extractReasoningMiddleware({
      tagName: "think",
      startWithReasoning: model === "@cf/qwen/qwq-32b",
    }),
  });

  const result = streamText({
    model: wrappedLanguageModel,
    messages: convertToModelMessages(messages),
    maxOutputTokens: 2048,
    system:
      "You are a helpful assistant. Follow the user's instructions carefully. Respond using Markdown.",
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    messageMetadata: ({ part }) => {
      if (part.type === "start") {
        return {
          model,
        };
      }
    },
  });
}
