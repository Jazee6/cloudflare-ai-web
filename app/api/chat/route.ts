import { convertToModelMessages, streamText } from "ai";
import type { Model } from "@/components/model-select";
import type { Message } from "@/lib/db";
import { workersai } from "@/app/api";

interface Data {
  messages: Message[];
  model: Model["id"];
}

export async function POST(request: Request) {
  const { messages, model } = (await request.json()) as Data;

  const result = streamText({
    model: workersai.chat(model),
    messages: convertToModelMessages(messages),
    maxOutputTokens: 2048,
    system:
      "You are a helpful assistant. Follow the user's instructions carefully. Respond using Markdown.",
  });

  return result.toUIMessageStreamResponse();
}
