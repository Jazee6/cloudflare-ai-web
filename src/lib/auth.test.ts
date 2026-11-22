import { expect, test } from "bun:test";
import {
  constantTimeCompare,
  createSessionToken,
  isRequestAuthorized,
  verifySessionToken,
} from "@/lib/auth";

test("constantTimeCompare accepts equal strings", async () => {
  expect(await constantTimeCompare("abc", "abc")).toBe(true);
});

test("constantTimeCompare rejects different strings and lengths", async () => {
  expect(await constantTimeCompare("abc", "abd")).toBe(false);
  expect(await constantTimeCompare("abc", "ab")).toBe(false);
});

test("verifySessionToken accepts a freshly created token", async () => {
  const password = "test-password";
  const token = await createSessionToken(password);
  expect(await verifySessionToken(token, password)).toBe(true);
});

test("verifySessionToken rejects a token after the password changes", async () => {
  const token = await createSessionToken("password-a");
  expect(await verifySessionToken(token, "password-b")).toBe(false);
});

test("verifySessionToken rejects tampered and malformed proofs", async () => {
  const password = "test-password";
  const token = await createSessionToken(password);
  const [expiry, proof] = token.split(".");

  expect(await verifySessionToken(`${expiry}.${"a".repeat(proof.length)}`, password)).toBe(false);
  expect(await verifySessionToken(`${expiry}.%%%`, password)).toBe(false);
  expect(await verifySessionToken("not-a-valid-token", password)).toBe(false);
});

test("isRequestAuthorized rejects malformed cookies without throwing", async () => {
  const originalPassword = process.env.APP_PASSWORD;
  process.env.APP_PASSWORD = "password";
  try {
    const request = new Request("https://example.com/api/chat", {
      headers: { cookie: "theme=dark;cf-ai-auth=9999999999.%%%" },
    });
    expect(await isRequestAuthorized(request)).toBe(false);
  } finally {
    process.env.APP_PASSWORD = originalPassword;
  }
});

test("verifySessionToken rejects an expired token", async () => {
  const originalNow = Date.now;
  const issuedAt = originalNow();
  try {
    Date.now = () => issuedAt;
    const token = await createSessionToken("password");
    Date.now = () => issuedAt + 31 * 24 * 60 * 60 * 1000;
    expect(await verifySessionToken(token, "password")).toBe(false);
  } finally {
    Date.now = originalNow;
  }
});
