import { appError, type ErrorCode, type ErrorParams } from "@/lib/error-codes";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { parseAiGatewayOptions } from "ai-gateway-provider";
import * as v from "valibot";
import { isDlpOrGuardrailsBlock } from "@/lib/gateway-errors";
import { getModelName, type Model } from "@/lib/models";
import { OPENAI_IMAGE_SIZES, type NormalizedImageParams } from "@/lib/image-models";
import type { ImageReferenceInput } from "@/lib/image-generation";
import {
  getGatewayModelName,
  getPersonalModelId,
  isDynamicRoute,
  MODEL_LIST_PATHS,
  type GatewayProviderId,
  type PersonalCredentials,
  type PersonalRequest,
} from "@/lib/personal-providers";
import type { ChatModel, CreateChatModelOptions } from "@/lib/providers";

const GATEWAY_ORIGIN = "https://gateway.ai.cloudflare.com/v1";

/** Where a Personal Provider's requests go and which credentials they carry. Never log it. */
export interface PersonalGateway {
  baseUrl: string;
  gatewayToken?: string;
  apiKey?: string;
  /** Whether the visitor brought their own AI Gateway rather than the deployment's. */
  own: boolean;
}

export type PersonalGatewayResult =
  | { ok: true; gateway: PersonalGateway }
  | { ok: false; status: number; message: string; code?: ErrorCode; params?: ErrorParams };

/**
 * Applies the Personal Provider routing rules. Through the deployment's gateway the visitor must
 * bring their own provider key and cannot reach Dynamic Routes, so the deployment's BYOK keys and
 * billing only ever serve External Models. With their own gateway, the key is optional.
 */
export const resolvePersonalGateway = (
  credentials: PersonalCredentials,
  modelId?: string,
): PersonalGatewayResult => {
  if (credentials.gateway) {
    const { accountId, gatewayId, token } = credentials.gateway;
    return {
      ok: true,
      gateway: {
        baseUrl: `${GATEWAY_ORIGIN}/${accountId}/${gatewayId}`,
        own: true,
        ...(token ? { gatewayToken: token } : {}),
        ...(credentials.apiKey ? { apiKey: credentials.apiKey } : {}),
      },
    };
  }

  const accountId = process.env.CF_ACCOUNT_ID;
  const gatewayId = process.env.CF_AI_GATEWAY_NAME;
  const gatewayToken = process.env.CF_AI_GATEWAY_TOKEN;
  if (!accountId || !gatewayId || !gatewayToken) {
    return {
      ok: false,
      status: 400,
      ...appError("personalNoGateway"),
    };
  }
  if (!credentials.apiKey) {
    return {
      ok: false,
      status: 400,
      ...appError("personalKeyRequired"),
    };
  }
  if (modelId && isDynamicRoute(modelId)) {
    return {
      ok: false,
      status: 400,
      ...appError("dynamicRoutesOwnGateway"),
    };
  }
  return {
    ok: true,
    gateway: {
      baseUrl: `${GATEWAY_ORIGIN}/${accountId}/${gatewayId}`,
      gatewayToken,
      apiKey: credentials.apiKey,
      own: false,
    },
  };
};

/** AI Gateway headers: gateway auth when set, cache control and request metadata. */
export const getPersonalGatewayHeaders = (
  gateway: PersonalGateway,
  options: { skipCache?: boolean; retry?: boolean } = {},
): Record<string, string> => {
  const headers = Object.fromEntries(
    parseAiGatewayOptions({
      ...(options.skipCache || options.retry ? { skipCache: true } : {}),
      metadata: {
        app: "cloudflare-ai-web",
        personal: true,
        ...(options.retry ? { retry: true } : {}),
      },
    }).entries(),
  );
  if (gateway.gatewayToken) {
    headers["cf-aig-authorization"] = `Bearer ${gateway.gatewayToken}`;
  }
  return headers;
};

/** The catalog model a Personal request stands for; capabilities come only from its declaration. */
export const toPersonalModel = (request: PersonalRequest): Model => {
  const { declaration } = request;
  return {
    id: getPersonalModelId("request", declaration.modelId),
    name: declaration.name ?? getModelName(declaration.modelId),
    brand: request.provider,
    type: declaration.type,
    provider: "ai-gateway",
    source: "personal",
    ...(declaration.imageProtocol ? { imageProtocol: declaration.imageProtocol } : {}),
    ...(declaration.input && declaration.input.length > 0 ? { input: declaration.input } : {}),
    ...(declaration.reasoning ? { reasoning: true } : {}),
    ...(declaration.contextWindow ? { contextWindow: declaration.contextWindow } : {}),
  };
};

const withoutGoogleKey = ((input: RequestInfo | URL, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  headers.delete("x-goog-api-key");
  return globalThis.fetch(input, { ...init, headers });
}) as typeof fetch;

/**
 * Resolves a Personal chat model. Requests use the gateway's OpenAI-compatible endpoint, except
 * Google Search grounding, which needs Google's native API.
 */
export const createPersonalChatModel = (
  gateway: PersonalGateway,
  request: PersonalRequest,
  options: Pick<CreateChatModelOptions, "search" | "skipCache" | "retry"> = {},
): ChatModel => {
  const headers = getPersonalGatewayHeaders(gateway, options);
  const { declaration } = request;

  if (
    request.provider === "google-ai-studio" &&
    options.search &&
    declaration.input?.includes("search")
  ) {
    const google = createGoogleGenerativeAI({
      baseURL: `${gateway.baseUrl}/google-ai-studio/v1beta`,
      // Without a key the gateway's BYOK or Unified Billing authenticates the request.
      apiKey: gateway.apiKey ?? "gateway",
      headers,
      ...(gateway.apiKey ? {} : { fetch: withoutGoogleKey }),
    });
    return {
      model: google.chat(declaration.modelId),
      tools: { google_search: google.tools.googleSearch({}) },
    };
  }

  const compat = createOpenAICompatible({
    name: "personal",
    baseURL: `${gateway.baseUrl}/compat`,
    // Omitted keys send no Authorization header, so the visitor's gateway supplies one.
    ...(gateway.apiKey ? { apiKey: gateway.apiKey } : {}),
    headers,
  });
  return { model: compat.chatModel(getGatewayModelName(request.provider, declaration.modelId)) };
};

const toBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

/** Builds the upstream image request for a Personal image model. */
export const createPersonalImageRequest = async ({
  gateway,
  request,
  prompt,
  params,
  referenceImages,
  skipCache,
}: {
  gateway: PersonalGateway;
  request: PersonalRequest;
  prompt: string;
  params: NormalizedImageParams;
  referenceImages: ImageReferenceInput[];
  skipCache: boolean;
}): Promise<{ url: string; init: RequestInit }> => {
  const headers = getPersonalGatewayHeaders(gateway, { skipCache });
  const { modelId } = request.declaration;

  if (request.declaration.imageProtocol === "gemini") {
    if (gateway.apiKey) {
      headers["x-goog-api-key"] = gateway.apiKey;
    }
    headers["Content-Type"] = "application/json";
    const imageParts = await Promise.all(
      referenceImages.map(async ({ blob }) => ({
        inline_data: { mime_type: blob.type || "image/jpeg", data: await toBase64(blob) },
      })),
    );
    return {
      url: `${gateway.baseUrl}/google-ai-studio/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
      init: {
        method: "POST",
        headers,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [...imageParts, { text: prompt }] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            ...(params.aspectRatio ? { imageConfig: { aspectRatio: params.aspectRatio } } : {}),
          },
        }),
      },
    };
  }

  if (gateway.apiKey) {
    headers.Authorization = `Bearer ${gateway.apiKey}`;
  }
  const size = params.aspectRatio ? OPENAI_IMAGE_SIZES[params.aspectRatio] : undefined;
  const base = `${gateway.baseUrl}/${request.provider}/images`;

  if (referenceImages.length > 0) {
    const form = new FormData();
    form.append("model", modelId);
    form.append("prompt", prompt);
    if (size) {
      form.append("size", size);
    }
    for (const [index, ref] of referenceImages.entries()) {
      form.append("image[]", ref.blob, ref.filename ?? `reference-${index}.png`);
    }
    return { url: `${base}/edits`, init: { method: "POST", headers, body: form } };
  }

  headers["Content-Type"] = "application/json";
  return {
    url: `${base}/generations`,
    init: {
      method: "POST",
      headers,
      body: JSON.stringify({ model: modelId, prompt, n: 1, ...(size ? { size } : {}) }),
    },
  };
};

const openAIImageResponseSchema = v.object({
  data: v.pipe(v.array(v.object({ b64_json: v.optional(v.string()) })), v.minLength(1)),
});

const geminiPartSchema = v.object({
  inlineData: v.optional(v.object({ mimeType: v.string(), data: v.string() })),
  inline_data: v.optional(v.object({ mime_type: v.string(), data: v.string() })),
});

const geminiResponseSchema = v.object({
  candidates: v.optional(
    v.array(
      v.object({ content: v.optional(v.object({ parts: v.optional(v.array(geminiPartSchema)) })) }),
    ),
  ),
});

/** The base64 image in a successful Personal image response, or null when there is none. */
export const extractPersonalImage = (
  protocol: "openai-images" | "gemini",
  json: unknown,
): { base64: string; mediaType?: string } | null => {
  if (protocol === "gemini") {
    const parsed = v.safeParse(geminiResponseSchema, json);
    if (!parsed.success) {
      return null;
    }
    for (const candidate of parsed.output.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.inlineData) {
          return { base64: part.inlineData.data, mediaType: part.inlineData.mimeType };
        }
        if (part.inline_data) {
          return { base64: part.inline_data.data, mediaType: part.inline_data.mime_type };
        }
      }
    }
    return null;
  }

  const parsed = v.safeParse(openAIImageResponseSchema, json);
  // A URL-only response is not followed: fetching provider-chosen URLs server-side invites SSRF.
  const base64 = parsed.success ? parsed.output.data[0]?.b64_json : undefined;
  return base64 ? { base64 } : null;
};

/**
 * The status and message for a failed Personal request. Credentials belong to the visitor, so
 * rejections are reported as client errors without echoing anything upstream returned.
 */
export const mapPersonalFailure = (
  gateway: Pick<PersonalGateway, "own">,
  status: number | undefined,
  body = "",
  headers?: Headers | Record<string, string | undefined>,
): { status: number; message: string; code?: ErrorCode; params?: ErrorParams } => {
  if (/\b(2001|2009)\b|gateway does not exist|authentication active/i.test(body)) {
    return gateway.own
      ? {
          status: 400,
          ...appError("personalGatewayInvalid"),
        }
      : {
          status: 502,
          ...appError("gatewayInvalid"),
        };
  }
  if (isDlpOrGuardrailsBlock(status, body, headers)) {
    return {
      status: 422,
      ...appError("dlpBlocked"),
    };
  }
  if (status === 401 || status === 403) {
    return {
      status: 400,
      ...appError("personalCredentialsRejected"),
    };
  }
  if (status === 404) {
    return { status: 400, ...appError("personalModelNotOffered") };
  }
  if (status === 429) {
    return { status: 429, ...appError("personalRateLimited") };
  }
  if (status !== undefined && status >= 400 && status < 500) {
    return { status: 400, ...appError("personalRejected") };
  }
  return { status: 502, ...appError("personalProviderError") };
};

const openAIModelListSchema = v.object({
  data: v.array(v.object({ id: v.string(), name: v.optional(v.string()) })),
});

const googleModelListSchema = v.object({
  models: v.array(v.object({ name: v.string(), displayName: v.optional(v.string()) })),
});

const MAX_LISTED_MODELS = 500;

export type PersonalModelListResult =
  | { ok: true; supported: false }
  | { ok: true; supported: true; models: { modelId: string; name?: string }[] }
  | { ok: false; status: number; message: string; code?: ErrorCode; params?: ErrorParams };

/** Lists the models a Personal Provider offers, for the visitor to pick from. */
export const listPersonalModels = async (
  gateway: PersonalGateway,
  provider: GatewayProviderId,
): Promise<PersonalModelListResult> => {
  const path = MODEL_LIST_PATHS[provider];
  if (!path) {
    return { ok: true, supported: false };
  }

  const headers = getPersonalGatewayHeaders(gateway);
  if (gateway.apiKey) {
    if (provider === "google-ai-studio") {
      headers["x-goog-api-key"] = gateway.apiKey;
    } else {
      headers.Authorization = `Bearer ${gateway.apiKey}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(`${gateway.baseUrl}/${path}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, status: 502, ...appError("personalUnreachable") };
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { ok: false, ...mapPersonalFailure(gateway, response.status, body) };
  }

  const json: unknown = await response.json().catch(() => null);
  const google = v.safeParse(googleModelListSchema, json);
  if (google.success) {
    return {
      ok: true,
      supported: true,
      models: google.output.models.slice(0, MAX_LISTED_MODELS).map((model) => ({
        modelId: model.name.replace(/^models\//, ""),
        ...(model.displayName ? { name: model.displayName } : {}),
      })),
    };
  }
  const openAI = v.safeParse(openAIModelListSchema, json);
  if (openAI.success) {
    return {
      ok: true,
      supported: true,
      models: openAI.output.data
        .slice(0, MAX_LISTED_MODELS)
        .map((model) => ({ modelId: model.id, ...(model.name ? { name: model.name } : {}) })),
    };
  }
  return {
    ok: false,
    status: 502,
    ...appError("personalModelListInvalid"),
  };
};
