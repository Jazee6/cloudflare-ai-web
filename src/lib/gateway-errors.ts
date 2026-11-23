import { appError, type ErrorCode, type ErrorParams } from "@/lib/error-codes";
import { APICallError } from "@ai-sdk/provider";
import { RetryError } from "ai";
import { AiGatewayDoesNotExist, AiGatewayUnauthorizedError } from "ai-gateway-provider";
import type { ModelProvider } from "@/lib/models";
import type { GatewayMetadata } from "@/lib/response-metadata";

export class ProviderConfigurationError extends Error {
  constructor(name: string) {
    super(`Missing required environment variable: ${name}`);
    this.name = "ProviderConfigurationError";
  }
}

type HeaderSource = Headers | Record<string, string | undefined>;

const readHeader = (headers: HeaderSource | undefined, targetName: string): string | undefined => {
  if (!headers) {
    return undefined;
  }

  const normalizedTarget = targetName.toLowerCase();
  if (headers instanceof Headers) {
    return headers.get(normalizedTarget) ?? undefined;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === normalizedTarget && typeof value === "string") {
      return value;
    }
  }
  return undefined;
};

const MAX_DLP_ACTION_LENGTH = 48;

const sanitizeDlpAction = (rawValue: string | undefined): string | undefined => {
  if (!rawValue) {
    return undefined;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { action?: unknown };
      if (typeof parsed.action === "string" && parsed.action.trim()) {
        return parsed.action.trim().slice(0, MAX_DLP_ACTION_LENGTH);
      }
    } catch {
      // Fall through to safe token extraction.
    }
  }

  // Only keep safe action-like tokens; never echo arbitrary payloads.
  const tokenMatch = /^[a-z0-9_.-]+/i.exec(trimmed);
  return tokenMatch ? tokenMatch[0].slice(0, MAX_DLP_ACTION_LENGTH) : "applied";
};

export const extractGatewayMetadata = (
  headers: HeaderSource | undefined,
): GatewayMetadata | undefined => {
  const rawCacheStatus = readHeader(headers, "cf-aig-cache-status")?.trim().toUpperCase();
  const cacheStatus =
    rawCacheStatus === "HIT" || rawCacheStatus === "MISS" ? rawCacheStatus : undefined;
  const dlpAction = sanitizeDlpAction(readHeader(headers, "cf-aig-dlp"));

  if (!cacheStatus && !dlpAction) {
    return undefined;
  }

  return {
    ...(cacheStatus ? { cacheStatus } : {}),
    ...(dlpAction ? { dlpAction } : {}),
  };
};

const unwrapError = (error: unknown): unknown =>
  RetryError.isInstance(error) && error.lastError !== undefined ? error.lastError : error;

const collectErrorText = (error: unknown): string => {
  if (APICallError.isInstance(error)) {
    return [error.message, error.responseBody ?? ""].join("\n");
  }
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "";
};

/** Whether AI Gateway DLP or Guardrails blocked the request or response. */
export const isDlpOrGuardrailsBlock = (
  statusCode: number | undefined,
  text: string,
  headers: HeaderSource | undefined,
) => {
  if (statusCode !== undefined && ![400, 403, 422].includes(statusCode)) {
    return false;
  }
  const dlpAction = sanitizeDlpAction(readHeader(headers, "cf-aig-dlp"));
  if (dlpAction && !/^(log|redact|mask|allow)$/i.test(dlpAction)) {
    return true;
  }
  return /\b(2016|2017)\b|guardrail|cf-aig-dlp|\bdlp\b/i.test(text);
};

export const mapUpstreamError = (
  error: unknown,
  context: { provider: ModelProvider },
): { status: number; message: string; code?: ErrorCode; params?: ErrorParams } => {
  const unwrapped = unwrapError(error);

  if (unwrapped instanceof ProviderConfigurationError) {
    return {
      status: 503,
      ...appError("gatewayConfigIncomplete"),
    };
  }

  if (
    unwrapped instanceof AiGatewayDoesNotExist ||
    unwrapped instanceof AiGatewayUnauthorizedError
  ) {
    return {
      status: 502,
      ...appError("gatewayInvalid"),
    };
  }

  const statusCode = APICallError.isInstance(unwrapped) ? unwrapped.statusCode : undefined;
  const headers = APICallError.isInstance(unwrapped) ? unwrapped.responseHeaders : undefined;
  const errorText = collectErrorText(unwrapped);

  if (/\b(2001|2009)\b|gateway does not exist|authentication active/i.test(errorText)) {
    return {
      status: 502,
      ...appError("gatewayInvalid"),
    };
  }

  if (isDlpOrGuardrailsBlock(statusCode, errorText, headers)) {
    return {
      status: 422,
      ...appError("dlpBlocked"),
    };
  }

  if (statusCode === 403 && /\b5035\b|workers paid|paid plan|requires a paid/i.test(errorText)) {
    return {
      status: 403,
      ...appError("paidPlanRequired"),
    };
  }

  if (statusCode === 429 || /\b429\b|rate limit|neurons|quota/i.test(errorText)) {
    return {
      status: 429,
      ...appError("rateLimited"),
    };
  }

  if (
    context.provider === "ai-gateway" &&
    (statusCode === 401 ||
      statusCode === 403 ||
      /byok|provider key|invalid api key|incorrect api key|unauthorized/i.test(errorText))
  ) {
    return {
      status: 502,
      ...appError("byokMissing"),
    };
  }

  return {
    status: 502,
    ...appError("providerError"),
  };
};
