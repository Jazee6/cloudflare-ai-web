import * as v from "valibot";
import {
  createImageRunRequest,
  type ImageReferenceInput,
  mapImageFailureResponse,
  sniffImageMediaType,
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
  createPersonalImageRequest,
  extractPersonalImage,
  mapPersonalFailure,
  resolvePersonalGateway,
} from "@/lib/personal-gateway";
import { type PersonalRequest, personalRequestSchema } from "@/lib/personal-providers";
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
  personal: v.optional(personalRequestSchema),
});

type ParsedImagePayload =
  | {
      ok: true;
      prompt: string;
      model: string;
      rawParams: unknown;
      skipCache: boolean;
      referenceImages: ImageReferenceInput[];
      personal?: PersonalRequest;
    }
  | { ok: false; response: Response };

const invalidRequest = (): ParsedImagePayload => ({
  ok: false,
  response: new Response("Invalid request data", { status: 400 }),
});

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

  // Multipart requests carry the Personal field as JSON, validated by the same schema.
  let personal: PersonalRequest | undefined;
  const personalEntry = formData.get("personal");
  if (personalEntry !== null) {
    if (typeof personalEntry !== "string") {
      return invalidRequest();
    }
    let json: unknown;
    try {
      json = JSON.parse(personalEntry);
    } catch {
      return invalidRequest();
    }
    const parsedPersonal = v.safeParse(personalRequestSchema, json);
    if (!parsedPersonal.success) {
      return invalidRequest();
    }
    personal = parsedPersonal.output;
  }

  return {
    ok: true,
    prompt: parsedBase.output.prompt,
    model: parsedBase.output.model,
    rawParams,
    skipCache,
    referenceImages,
    ...(personal ? { personal } : {}),
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
    ...(parsed.data.personal ? { personal: parsed.data.personal } : {}),
  };
};

const decodeBase64Image = (base64: string) => {
  try {
    return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
};

const handlePersonalImage = async ({
  personal,
  prompt,
  rawParams,
  skipCache,
  referenceImages,
}: {
  personal: PersonalRequest;
  prompt: string;
  rawParams: unknown;
  skipCache: boolean;
  referenceImages: ImageReferenceInput[];
}): Promise<Response> => {
  const { declaration } = personal;
  if (declaration.type !== "Text to Image" || !declaration.imageProtocol) {
    return new Response("Select an image model to generate images.", { status: 400 });
  }
  const resolved = resolvePersonalGateway(personal, declaration.modelId);
  if (!resolved.ok) {
    return new Response(resolved.message, { status: resolved.status });
  }

  const ref = { id: declaration.modelId, imageProtocol: declaration.imageProtocol };
  if (referenceImages.length > getImageModelProfile(ref).maxReferenceImages) {
    return new Response("The selected model does not support reference images.", { status: 400 });
  }
  const sanitized = sanitizeImageParams(ref, rawParams);
  if (!sanitized.ok) {
    return new Response(sanitized.message, { status: 400 });
  }

  const gateway = resolved.gateway;
  const upstream = await createPersonalImageRequest({
    gateway,
    request: personal,
    prompt,
    params: sanitized.params,
    referenceImages,
    skipCache,
  });

  let response: Response;
  try {
    response = await fetch(upstream.url, upstream.init);
  } catch {
    console.error("Personal image generation request failed");
    return new Response("Image generation failed. Please try again.", { status: 502 });
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const mapped = mapPersonalFailure(gateway, response.status, body, response.headers);
    // Only the outcome is logged; upstream bodies may echo request details.
    console.error(`Personal image generation failed: ${response.status}`);
    return new Response(mapped.message, { status: mapped.status });
  }

  const image = extractPersonalImage(
    declaration.imageProtocol,
    await response.json().catch(() => null),
  );
  const bytes = image ? decodeBase64Image(image.base64) : null;
  if (!image || !bytes || bytes.length === 0) {
    return new Response("The image provider returned no image.", { status: 502 });
  }
  return new Response(bytes, {
    headers: { "Content-Type": image.mediaType ?? sniffImageMediaType(bytes) },
  });
};

export async function POST(request: Request) {
  const parsed = await parseImageRequest(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { prompt, model, rawParams, skipCache, referenceImages, personal } = parsed;
  if (personal) {
    return handlePersonalImage({ personal, prompt, rawParams, skipCache, referenceImages });
  }
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
