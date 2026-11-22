import * as v from "valibot";
import {
  createImageRunRequest,
  type ImageReferenceInput,
  mapImageFailureResponse,
  toImageResponse,
} from "@/lib/image-generation";
import {
  getImageModelProfile,
  MAX_IMAGE_PROMPT_LENGTH,
  MAX_REFERENCE_IMAGES,
  sanitizeImageParams,
} from "@/lib/image-models";
import { getCatalogModel } from "@/lib/model-catalog";
import {
  getCloudflareCredentials,
  getCloudflareGatewayCredentials,
  ProviderConfigurationError,
} from "@/lib/providers";
import {
  MAX_IMAGE_BYTES,
  MAX_REQUEST_BODY_BYTES,
  parseJsonRequest,
  readRequestBytes,
} from "@/lib/request-limits";

const promptSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.maxLength(MAX_IMAGE_PROMPT_LENGTH),
);
const modelSchema = v.pipe(v.string(), v.minLength(1));

const jsonSchema = v.object({
  prompt: promptSchema,
  model: modelSchema,
  params: v.optional(v.unknown()),
  skipCache: v.optional(v.boolean()),
});

type ParsedImagePayload =
  | {
      ok: true;
      prompt: string;
      model: string;
      rawParams: unknown;
      skipCache: boolean;
      referenceImages: ImageReferenceInput[];
    }
  | { ok: false; response: Response };

const parseMultipartImageRequest = async (request: Request): Promise<ParsedImagePayload> => {
  const bytesResult = await readRequestBytes(request, MAX_REQUEST_BODY_BYTES);
  if (!bytesResult.ok) {
    return {
      ok: false,
      response: new Response(bytesResult.message, { status: bytesResult.status }),
    };
  }

  let formData: FormData;
  try {
    const contentType = request.headers.get("content-type") ?? "multipart/form-data";
    const copy = new Uint8Array(bytesResult.bytes);
    formData = await new Response(copy, {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    return { ok: false, response: new Response("Invalid request data", { status: 400 }) };
  }

  const promptEntry = formData.get("prompt");
  const modelEntry = formData.get("model");
  const parsedBase = v.safeParse(v.object({ prompt: promptSchema, model: modelSchema }), {
    prompt: typeof promptEntry === "string" ? promptEntry : "",
    model: typeof modelEntry === "string" ? modelEntry : "",
  });
  if (!parsedBase.success) {
    return { ok: false, response: new Response("Invalid request data", { status: 400 }) };
  }

  let rawParams: unknown;
  const paramsEntry = formData.get("params");
  if (typeof paramsEntry === "string" && paramsEntry.trim().length > 0) {
    try {
      rawParams = JSON.parse(paramsEntry);
    } catch {
      return { ok: false, response: new Response("Invalid image parameters.", { status: 400 }) };
    }
  }

  const rawFiles = formData.getAll("referenceImages");
  if (rawFiles.length > MAX_REFERENCE_IMAGES) {
    return {
      ok: false,
      response: new Response(`Up to ${MAX_REFERENCE_IMAGES} reference images are allowed.`, {
        status: 400,
      }),
    };
  }

  const referenceImages: ImageReferenceInput[] = [];
  for (const item of rawFiles) {
    if (!(item instanceof Blob) || !item.type.startsWith("image/")) {
      return {
        ok: false,
        response: new Response("Only image reference files are supported.", { status: 400 }),
      };
    }
    if (item.size === 0 || item.size > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        response: new Response("Reference image size exceeds the 512 KiB limit.", { status: 413 }),
      };
    }
    referenceImages.push({
      blob: item,
      filename: item instanceof File && item.name ? item.name : undefined,
    });
  }

  const skipCache = formData.get("skipCache") === "true";

  return {
    ok: true,
    prompt: parsedBase.output.prompt,
    model: parsedBase.output.model,
    rawParams,
    skipCache,
    referenceImages,
  };
};

const parseImageRequest = async (request: Request): Promise<ParsedImagePayload> => {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("multipart/form-data")) {
    return parseMultipartImageRequest(request);
  }

  const parsed = await parseJsonRequest(request, jsonSchema);
  if (!parsed.ok) {
    return parsed;
  }

  return {
    ok: true,
    prompt: parsed.data.prompt,
    model: parsed.data.model,
    rawParams: parsed.data.params,
    skipCache: Boolean(parsed.data.skipCache),
    referenceImages: [],
  };
};

export async function POST(request: Request) {
  const parsed = await parseImageRequest(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { prompt, model, rawParams, skipCache, referenceImages } = parsed;
  const catalogModel = await getCatalogModel(model, "Text to Image", "workers-ai");
  if (!catalogModel) {
    return new Response("The model catalog has changed. Refresh and select another model.", {
      status: 409,
    });
  }

  const profile = getImageModelProfile(model);
  if (referenceImages.length > profile.maxReferenceImages) {
    return new Response("The selected model does not support reference images.", { status: 400 });
  }

  const sanitized = sanitizeImageParams(model, rawParams);
  if (!sanitized.ok) {
    return new Response(sanitized.message, { status: 400 });
  }

  let runRequest: ReturnType<typeof createImageRunRequest>;
  try {
    runRequest = createImageRunRequest({
      ...getCloudflareCredentials(),
      gateway: getCloudflareGatewayCredentials(),
      model,
      prompt,
      params: sanitized.params,
      referenceImages,
      skipCache,
    });
  } catch (error) {
    if (error instanceof ProviderConfigurationError) {
      console.error(error.message);
      return new Response("Image generation is not configured.", { status: 503 });
    }
    throw error;
  }

  let response: Response;
  try {
    response = await fetch(runRequest.url, runRequest.init);
  } catch (error) {
    console.error(`Image generation request failed for ${model}`, error);
    return new Response("Image generation failed. Please try again.", { status: 502 });
  }
  if (!response.ok) {
    console.error(`Image generation failed for ${model}: ${response.status}`);
    return mapImageFailureResponse(response);
  }

  return toImageResponse(response);
}
