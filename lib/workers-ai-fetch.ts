/**
 * Workers AI streams OpenAI-style chunks that also repeat the text in the legacy `response`
 * field and carry an empty `tool_calls` array. workers-ai-provider 4.0.0 reads both, so text
 * arrives twice and every chunk closes the open reasoning block. Drops those redundant fields
 * from one SSE `data:` payload and leaves anything else untouched.
 */
export const normalizeWorkersAIEvent = (data: string): string => {
  let chunk: unknown;
  try {
    chunk = JSON.parse(data);
  } catch {
    return data;
  }
  if (typeof chunk !== "object" || chunk === null || Array.isArray(chunk)) {
    return data;
  }

  const event = chunk as Record<string, unknown> & {
    choices?: { delta?: Record<string, unknown> }[];
  };
  const delta = Array.isArray(event.choices) ? event.choices[0]?.delta : undefined;
  let changed = false;

  // Numeric tokens arrive as JSON numbers in `response`, e.g. 91 for "91".
  if (
    typeof delta?.content === "string" &&
    event.response != null &&
    String(event.response) === delta.content
  ) {
    delete event.response;
    changed = true;
  }
  for (const holder of [event, delta]) {
    if (Array.isArray(holder?.tool_calls) && holder.tool_calls.length === 0) {
      delete holder.tool_calls;
      changed = true;
    }
  }

  return changed ? JSON.stringify(event) : data;
};

const normalizeLine = (line: string) => {
  const match = /^data: ?(.*?)(\r?)$/.exec(line);
  return match ? `data: ${normalizeWorkersAIEvent(match[1])}${match[2]}` : line;
};

const normalizeEventStream = (body: NonNullable<Response["body"]>) => {
  let pending = "";
  return body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(
      new TransformStream<string, string>({
        transform(text, controller) {
          const lines = (pending + text).split("\n");
          pending = lines.pop() ?? "";
          for (const line of lines) {
            controller.enqueue(`${normalizeLine(line)}\n`);
          }
        },
        flush(controller) {
          if (pending) {
            controller.enqueue(normalizeLine(pending));
          }
        },
      }),
    )
    .pipeThrough(new TextEncoderStream());
};

/** Wraps a fetch so Workers AI event streams reach workers-ai-provider without redundant fields. */
export const createWorkersAIFetch = (
  baseFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = globalThis.fetch,
): typeof globalThis.fetch =>
  Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await baseFetch(input, init);
      if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
        return response;
      }
      return new Response(normalizeEventStream(response.body), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    },
    { preconnect: globalThis.fetch.preconnect },
  );
