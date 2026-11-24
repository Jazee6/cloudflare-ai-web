import { expect, test } from "bun:test";
import { resolveSiteUrl } from "./site-url.ts";

test("resolveSiteUrl is undefined when unset or blank", () => {
  expect(resolveSiteUrl({})).toBeUndefined();
  expect(resolveSiteUrl({ SITE_URL: "  " })).toBeUndefined();
});

test("resolveSiteUrl drops trailing slashes, query and hash", () => {
  expect(resolveSiteUrl({ SITE_URL: "https://ai.example.com/" })).toBe("https://ai.example.com");
  expect(resolveSiteUrl({ SITE_URL: "https://ai.example.com/?a=1#b" })).toBe(
    "https://ai.example.com",
  );
});

test("resolveSiteUrl rejects relative and non-http URLs", () => {
  expect(() => resolveSiteUrl({ SITE_URL: "ai.example.com" })).toThrow();
  expect(() => resolveSiteUrl({ SITE_URL: "ftp://ai.example.com" })).toThrow();
});
