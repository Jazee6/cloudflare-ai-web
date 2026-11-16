import { DefaultChatTransport } from "ai";
import { fitImagePartsWithinLimit } from "@/lib/image-compression";
import { buildModelContext } from "@/lib/model-context";
import type { Model } from "@/lib/models";
import { getCookie, getStoredModel } from "@/lib/utils";

/** A transport belongs to the persisted Conversation History, including retries. */
export const createConversationTransport = (conversationId: string, models: Model[]) =>
  new DefaultChatTransport({
    api: "/api/chat",
    prepareSendMessagesRequest: async ({ messages }) => {
      const selectedModel = getStoredModel(models, "CF_AI_MODEL");
      if (!selectedModel) {
        throw new Error("No chat models are currently available");
      }

      const modelContext = buildModelContext(messages);
      if (!modelContext) {
        throw new Error("The latest message exceeds the 64,000-character context limit.");
      }

      return {
        body: {
          messages: await fitImagePartsWithinLimit(modelContext),
          model: selectedModel.id,
          provider: selectedModel.provider,
          search: getCookie("CF_AI_SEARCH_ENABLED") === "true",
          conversationId,
        },
      };
    },
  });
