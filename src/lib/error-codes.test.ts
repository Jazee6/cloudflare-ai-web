import { expect, test } from "bun:test";
import {
  appError,
  ERROR_MESSAGES,
  errorMessage,
  errorResponse,
  isUnauthorizedError,
  parseAppError,
  serializeError,
} from "@/lib/error-codes";
import { checkApiAccess } from "@/server/api-access";

test("appError fills placeholders into the English message", () => {
  expect(appError("webpageHttpStatus", { status: 404 })).toEqual({
    code: "webpageHttpStatus",
    params: { status: 404 },
    message: "Target webpage returned HTTP 404.",
  });
  expect(appError("rateLimited")).toEqual({
    code: "rateLimited",
    message: ERROR_MESSAGES.rateLimited,
  });
});

test("a serialized error reads back with its code and params", () => {
  const error = appError("tooManyReferenceImages", { max: 4 });
  expect(parseAppError(serializeError(error))).toEqual(error);
});

test("text that is not a serialized error is kept as the message, without a code", () => {
  expect(parseAppError("  upstream exploded  ")).toEqual({ message: "upstream exploded" });
  expect(parseAppError('{"message":"raw","code":"notACode"}')).toEqual({ message: "raw" });
  expect(parseAppError("{not json")).toEqual({ message: "{not json" });
});

test("errorResponse sends the error as JSON with its status and headers", async () => {
  const response = errorResponse(appError("catalogChanged"), {
    status: 409,
    headers: { "Cache-Control": "no-store" },
  });
  expect(response.status).toBe(409);
  expect(response.headers.get("Content-Type")).toBe("application/json");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({
    code: "catalogChanged",
    message: errorMessage("catalogChanged"),
  });
});

test("the access gate answers with the unauthorized code", async () => {
  const original = process.env.APP_PASSWORD;
  process.env.APP_PASSWORD = "secret";
  try {
    const response = await checkApiAccess(
      new Request("https://example.com/api/chat", { method: "POST" }),
    );
    expect(response?.status).toBe(401);
    expect(isUnauthorizedError(await response!.text())).toBe(true);
  } finally {
    if (original === undefined) {
      delete process.env.APP_PASSWORD;
    } else {
      process.env.APP_PASSWORD = original;
    }
  }
});
