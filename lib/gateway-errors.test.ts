import { APICallError } from "@ai-sdk/provider";
import { RetryError } from "ai";
import { AiGatewayDoesNotExist, AiGatewayUnauthorizedError } from "ai-gateway-provider";
import { expect, test } from "bun:test";
import {
  extractGatewayMetadata,
  mapUpstreamError,
  ProviderConfigurationError,
} from "@/lib/gateway-errors";

test("extractGatewayMetadata reads cache status and sanitizes DLP headers", () => {
  const headers = new Headers({
    "CF-Aig-Cache-Status": "hit",
    "cf-aig-dlp": '{"action":"redact","matched":"secret-pii"}',
  });

  expect(extractGatewayMetadata(headers)).toEqual({
    cacheStatus: "HIT",
    dlpAction: "redact",
  });

  expect(extractGatewayMetadata(new Headers())).toBeUndefined();
});

test("mapUpstreamError maps gateway, BYOK, DLP, paid-plan, and quota errors safely", () => {
  expect(
    mapUpstreamError(new ProviderConfigurationError("CF_AI_GATEWAY_TOKEN"), {
      provider: "ai-gateway",
    }).status,
  ).toBe(503);

  expect(
    mapUpstreamError(new AiGatewayDoesNotExist("missing"), { provider: "ai-gateway" }).status,
  ).toBe(502);

  expect(
    mapUpstreamError(new AiGatewayUnauthorizedError("bad token"), { provider: "ai-gateway" })
      .status,
  ).toBe(502);

  const dlpError = new APICallError({
    message: "Blocked by DLP",
    url: "https://gateway.ai.cloudflare.com/v1/acc/gw",
    requestBodyValues: {},
    statusCode: 422,
    responseHeaders: { "cf-aig-dlp": "block" },
    responseBody: "sensitive user secret should never leak",
  });
  const dlpMapped = mapUpstreamError(dlpError, { provider: "ai-gateway" });
  expect(dlpMapped.status).toBe(422);
  expect(dlpMapped.message).not.toContain("sensitive user secret");

  const paidError = new APICallError({
    message: "Workers AI error",
    url: "https://api.cloudflare.com",
    requestBodyValues: {},
    statusCode: 403,
    responseBody: JSON.stringify({ errors: [{ code: 5035, message: "Workers Paid required" }] }),
  });
  expect(mapUpstreamError(paidError, { provider: "workers-ai" }).status).toBe(403);

  const retryRateLimit = new RetryError({
    message: "Failed after retries",
    reason: "maxRetriesExceeded",
    errors: [
      new APICallError({
        message: "Too many requests",
        url: "https://gateway.ai.cloudflare.com",
        requestBodyValues: {},
        statusCode: 429,
      }),
    ],
  });
  expect(mapUpstreamError(retryRateLimit, { provider: "workers-ai" }).status).toBe(429);

  const byokError = new APICallError({
    message: "Incorrect API key provided: sk-secret",
    url: "https://gateway.ai.cloudflare.com",
    requestBodyValues: {},
    statusCode: 401,
  });
  const byokMapped = mapUpstreamError(byokError, { provider: "ai-gateway" });
  expect(byokMapped.status).toBe(502);
  expect(byokMapped.message).not.toContain("sk-secret");
});
