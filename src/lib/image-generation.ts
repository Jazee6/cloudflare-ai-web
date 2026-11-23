import * as v from "valibot";
import { extractGatewayMetadata } from "@/lib/gateway-errors";
import { getImageModelProfile, type NormalizedImageParams } from "@/lib/image-models";
import type { CloudflareGatewayCredentials } from "@/lib/providers";

// The REST API wraps the payload in `result`; AI Gateway returns it unwrapped.
const imagePayloadSchema = v.object({ image: v.string() });
const imageResponseSchema = v.union([v.object({ result: imagePayloadSchema }), imagePayloadSchema]);

export const sniffImageMediaType = (bytes: Uint8Array) => {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "image/jpeg";
  }
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) {
    return "image/webp";
  }
  return "image/png";
};

export interface ImageReferenceInput {
  blob: Blob;
  filename?: string;
}

export const createImageRunRequest = ({
  accountId,
  apiKey,
  gateway,
  model,
  prompt,
  params = {},
  referenceImages = [],
  skipCache = false,
}: {
  accountId: string;
  apiKey: string;
  gateway?: CloudflareGatewayCredentials;
  model: string;
  prompt: string;
  params?: NormalizedImageParams;
  referenceImages?: ImageReferenceInput[];
  skipCache?: boolean;
}): { url: string; init: RequestInit } => {
  const url = gateway
    ? `https://gateway.ai.cloudflare.com/v1/${accountId}/${gateway.gatewayId}/workers-ai/run/${model}`
    : `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
  if (gateway) {
    headers["cf-aig-authorization"] = `Bearer ${gateway.gatewayToken}`;
    if (skipCache) {
      headers["cf-aig-skip-cache"] = "true";
    }
  }

  const profile = getImageModelProfile(model);

  if (profile.transport === "multipart") {
    const form = new FormData();
    form.append("prompt", prompt);
    if (profile.dimensions) {
      if (params.width !== undefined) {
        form.append("width", String(params.width));
      }
      if (params.height !== undefined) {
        form.append("height", String(params.height));
      }
    }
    if (profile.steps && params.steps !== undefined) {
      form.append(profile.steps.field, String(params.steps));
    }
    if (profile.supportsSeed && params.seed !== undefined) {
      form.append("seed", String(params.seed));
    }
    for (const [index, ref] of referenceImages.slice(0, profile.maxReferenceImages).entries()) {
      form.append(`input_image_${index}`, ref.blob, ref.filename ?? `reference-${index}.jpg`);
    }
    return { url, init: { method: "POST", headers, body: form } };
  }

  const body: Record<string, unknown> = { prompt };
  if (profile.dimensions) {
    if (params.width !== undefined) {
      body.width = params.width;
    }
    if (params.height !== undefined) {
      body.height = params.height;
    }
  }
  if (profile.steps && params.steps !== undefined) {
    body[profile.steps.field] = params.steps;
  }
  if (profile.guidance && params.guidance !== undefined) {
    body.guidance = params.guidance;
  }
  if (profile.supportsSeed && params.seed !== undefined) {
    body.seed = params.seed;
  }
  if (profile.supportsNegativePrompt && params.negativePrompt) {
    body.negative_prompt = params.negativePrompt;
  }

  headers["Content-Type"] = "application/json";
  return { url, init: { method: "POST", headers, body: JSON.stringify(body) } };
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

export const mapImageFailureResponse = async (response: Response): Promise<Response> => {
  const body = await response.text().catch(() => "");
  const gatewayMeta = extractGatewayMetadata(response.headers);

  if (/\b(2001|2009)\b|gateway does not exist|authentication active/i.test(body)) {
    return new Response(
      "AI Gateway configuration is invalid or the gateway does not exist. Please check server environment variables.",
      { status: 502 },
    );
  }

  if (
    (response.status === 400 || response.status === 403 || response.status === 422) &&
    ((gatewayMeta?.dlpAction && !/^(log|redact|mask|allow)$/i.test(gatewayMeta.dlpAction)) ||
      /\b(2016|2017)\b|guardrail|cf-aig-dlp|\bdlp\b/i.test(body))
  ) {
    return new Response(
      "The request or response was blocked by Cloudflare AI Gateway security/DLP policy.",
      { status: 422 },
    );
  }

  if (response.status === 403 && /\b5035\b|workers paid|paid plan|requires a paid/i.test(body)) {
    return new Response(
      "This model requires a Cloudflare Workers Paid plan and is not available on Free accounts.",
      { status: 403 },
    );
  }

  if (response.status === 429) {
    return new Response(
      "Daily free quota or gateway rate limit reached. Please try again later or switch models.",
      { status: 429 },
    );
  }

  return new Response("Image generation failed. Please try again.", {
    status: getImageFailureStatus(response.status),
  });
};

const decodeImage = (image: string) => {
  const dataUrl = /^data:(image\/[^;,]+);base64,([\s\S]+)$/.exec(image);
  const base64 = dataUrl?.[2] ?? image;

  try {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    return { bytes, mediaType: dataUrl?.[1] ?? sniffImageMediaType(bytes) };
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

  const payload = "result" in imageResult.output ? imageResult.output.result : imageResult.output;
  const image = decodeImage(payload.image);
  if (!image) {
    return new Response("The image provider returned invalid image data.", { status: 502 });
  }

  return new Response(image.bytes, {
    headers: { "Content-Type": image.mediaType },
  });
};
