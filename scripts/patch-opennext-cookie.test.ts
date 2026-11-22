import { describe, expect, test } from "bun:test";
import { patchCookieImport } from "./patch-opennext-cookie.mjs";

describe("patchCookieImport", () => {
  test("falls back to module namespace when cookie default export is missing", () => {
    const input =
      "cookieHeader=event.headers.get('cookie'),cookies=cookieHeader?import_cookie.default.parse(cookieHeader):{};";
    const expected =
      "cookieHeader=event.headers.get('cookie'),cookies=cookieHeader?(import_cookie.default??import_cookie).parse(cookieHeader):{};";

    expect(patchCookieImport(input)).toBe(expected);
  });

  test("handles numbered import_cookie identifiers", () => {
    expect(patchCookieImport("import_cookie2.default.parse(h)")).toBe(
      "(import_cookie2.default??import_cookie2).parse(h)",
    );
  });

  test("is idempotent across repeated invocations", () => {
    const input = "cookies=cookieHeader?import_cookie.default.parse(cookieHeader):{}";
    const once = patchCookieImport(input);
    const twice = patchCookieImport(once);

    expect(twice).toBe(once);
  });
});
