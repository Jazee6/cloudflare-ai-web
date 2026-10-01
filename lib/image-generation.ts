import * as v from "valibot";
import type { CloudflareGatewayCredentials } from "@/lib/providers";

export const MAX_IMAGE_PROMPT_LENGTH = 8_000;

const imageResponseSchema = v.object({
  result: v.object({ image: v.string() }),
});

// FLUX.2 models only accept multipart/form-data requests with the prompt as a form
// field; every other image model accepts a JSON body.
const requiresMultipartFormData = (model: string) =>
  model.startsWith("@cf/black-forest-labs/flux-2");

export const createImageRunRequest = ({
  accountId,
  apiKey,
  gateway,
  model,
  prompt,
}: {
  accountId: string;
  apiKey: string;
  gateway?: CloudflareGatewayCredentials;
  model: string;
  prompt: string;
}): { url: string; init: RequestInit } => {
  const url = gateway
    ? `https://gateway.ai.cloudflare.com/v1/${accountId}/${gateway.gatewayId}/workers-ai/run/${model}`
    : `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
  if (gateway) {
    headers["cf-aig-authorization"] = `Bearer ${gateway.gatewayToken}`;
  }

  if (requiresMultipartFormData(model)) {
    const form = new FormData();
    form.append("prompt", prompt);
    return { url, init: { method: "POST", headers, body: form } };
  }

  headers["Content-Type"] = "application/json";
  return { url, init: { method: "POST", headers, body: JSON.stringify({ prompt }) } };
};

/**
 * Maps a failed upstream status to the status reported to the browser.
 * Credential rejections are server misconfiguration, not a client error.
 */
export const getImageFailureStatus = (upstreamStatus: number) => {
  if (upstreamStatus === 401 || upstreamStatus === 403) {
    return 502;
  }
  if (upstreamStatus === 429) {
    return 429;
  }
  return upstreamStatus >= 400 && upstreamStatus < 500 ? 400 : 502;
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

/** Converts a successful upstream response, binary or JSON-wrapped base64, into an image response. */
export const toImageResponse = async (response: Response): Promise<Response> => {
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
};
