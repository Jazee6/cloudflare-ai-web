import { createAiGateway } from "ai-gateway-provider";
import { createWorkersAI } from "workers-ai-provider";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { Model } from "@/components/model-select";

const aigateway = createAiGateway({
  accountId: process.env.CF_ACCOUNT_ID!,
  gateway: process.env.CF_AI_GATEWAY_NAME!,
});

const workersai = createWorkersAI({
  accountId: process.env.CF_ACCOUNT_ID!,
  apiKey: process.env.CF_WORKERS_AI_TOKEN!,
});

interface Data {
  messages: UIMessage[];
  model: Model["id"];
}

export async function POST(request: Request) {
  const { messages, model } = (await request.json()) as Data;

  const result = streamText({
    model: workersai(model),
    messages: convertToModelMessages(messages),
    maxOutputTokens: 2048,
    system:
      "You are a helpful assistant. Follow the user's instructions carefully. Respond using GitHub Flavored Markdown.",
  });

  return result.toUIMessageStreamResponse();
}
