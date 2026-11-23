import { generateId, type UIMessage } from "ai";
import * as v from "valibot";
import type { AppError } from "@/lib/error-codes";

export const FAILED_RESPONSE_PART_TYPE = "data-failure";

const failureSchema = v.object({
  /** The failure as reported, shown when no translation exists for its code. */
  message: v.string(),
  /** The error code for failures the application itself describes; translated when shown. */
  code: v.optional(v.string()),
  params: v.optional(v.record(v.string(), v.union([v.string(), v.number()]))),
});

export type Failure = v.InferOutput<typeof failureSchema>;

/** A Failed Response: the retained record that an inference request for a prompt failed. */
export const createFailedResponse = ({ message, code, params }: AppError): UIMessage => ({
  id: generateId(),
  role: "assistant",
  parts: [
    {
      type: FAILED_RESPONSE_PART_TYPE,
      data: { message, ...(code ? { code } : {}), ...(params ? { params } : {}) },
    },
  ],
});

export const getFailure = (message: UIMessage): Failure | undefined => {
  if (message.role !== "assistant") {
    return undefined;
  }
  for (const part of message.parts) {
    if (part.type === FAILED_RESPONSE_PART_TYPE) {
      const parsed = v.safeParse(failureSchema, (part as { data?: unknown }).data);
      return parsed.success ? parsed.output : { message: "" };
    }
  }
  return undefined;
};

export const isFailedResponse = (message: UIMessage) => getFailure(message) !== undefined;

/** The messages that can be part of a Model Context: everything but Failed Responses. */
export const withoutFailedResponses = <Message extends UIMessage>(messages: Message[]) =>
  messages.filter((message) => !isFailedResponse(message));
