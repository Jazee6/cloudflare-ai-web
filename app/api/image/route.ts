import * as v from "valibot";
import {
  getCloudflareCredentials,
  getCloudflareGatewayCredentials,
  ProviderConfigurationError,
} from "@/app/api";
import { getCatalogModel } from "@/lib/model-catalog";
import { readRequestBody } from "@/lib/request-limits";

const MAX_PROMPT_LENGTH = 8_000;

const schema = v.object({
  prompt: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(MAX_PROMPT_LENGTH)),
  model: v.pipe(v.string(), v.minLength(1)),
});

const imageResponseSchema = v.object({
  result: v.object({ image: v.string() }),
});

// FLUX.2 models only accept multipart/form-data requests with the prompt as a form
// field; every other image model accepts a JSON body.
const requiresMultipartFormData = (model: string) =>
  model.startsWith("@cf/black-forest-labs/flux-2");

const createPromptBody = (model: string, prompt: string) => {
  if (!requiresMultipartFormData(model)) {
    return JSON.stringify({ prompt });
  }

  const form = new FormData();
  form.append("prompt", prompt);
  return form;
};

const decodeImage = (image: string) => {
  const dataUrl = /^data:(image\/[^;,]+);base64,([\s\S]+)$/.exec(image);
  const mediaType = dataUrl?.[1] ?? "image/png";
  const base64 = dataUrl?.[2] ?? image;

  try {
    const binary = atob(base64);
    return {
      bytes: Uint8Array.from(binary, (character) => character.charCodeAt(0)),
      mediaType,
    };
  } catch {
    return null;
  }
};

export async function POST(request: Request) {
  const bodyResult = await readRequestBody(request);
  if (!bodyResult.ok) {
    return new Response(bodyResult.message, { status: bodyResult.status });
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyResult.text);
  } catch {
    return new Response("Invalid request data", { status: 400 });
  }

  const parsed = v.safeParse(schema, body);
  if (!parsed.success) {
    return new Response("Invalid request data", { status: 400 });
  }

  const { prompt, model } = parsed.output;
  const catalogModel = await getCatalogModel(model, "Text to Image", "workers-ai");
  if (!catalogModel) {
    return new Response("The model catalog has changed. Refresh and select another model.", {
      status: 409,
    });
  }

  let accountId: string;
  let apiKey: string;
  let gatewayCredentials: ReturnType<typeof getCloudflareGatewayCredentials>;
  try {
    ({ accountId, apiKey } = getCloudflareCredentials());
    gatewayCredentials = getCloudflareGatewayCredentials();
  } catch (error) {
    if (error instanceof ProviderConfigurationError) {
      console.error(error.message);
      return new Response("Image generation is not configured.", { status: 503 });
    }
    throw error;
  }

  const url = gatewayCredentials
    ? `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayCredentials.gatewayId}/workers-ai/run/${model}`
    : `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(gatewayCredentials
        ? { "cf-aig-authorization": `Bearer ${gatewayCredentials.gatewayToken}` }
        : {}),
      ...(requiresMultipartFormData(model) ? {} : { "Content-Type": "application/json" }),
    },
    method: "POST",
    body: createPromptBody(model, prompt),
  });

  if (!response.ok) {
    console.error(`Image generation failed for ${model}: ${response.status}`);
    return new Response("Image generation failed. Please try again.", {
      status: response.status >= 400 && response.status < 500 ? 400 : 502,
    });
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().startsWith("image/")) {
    return new Response(response.body, {
      headers: { "Content-Type": contentType },
    });
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return new Response("The image provider returned an unsupported response.", { status: 502 });
  }

  const imageResult = v.safeParse(imageResponseSchema, json);
  if (!imageResult.success) {
    return new Response("The image provider returned an unsupported response.", { status: 502 });
  }

  const image = decodeImage(imageResult.output.result.image);
  if (!image) {
    return new Response("The image provider returned invalid image data.", { status: 502 });
  }

  return new Response(image.bytes, {
    headers: { "Content-Type": image.mediaType },
  });
}
