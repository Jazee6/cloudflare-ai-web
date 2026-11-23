import { expect, test } from "bun:test";
import { appError, ERROR_MESSAGES } from "@/lib/error-codes";
import { isMessageKey, translate, translateCount, translateError, translateText } from "@/lib/i18n";
import { languageScript, parseLanguagePreference, resolveLocale } from "@/lib/locale";
import { en } from "@/locales/en";
import { zhCN, zhCNErrors } from "@/locales/zh-CN";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test("every Chinese message keeps the English placeholders", () => {
  for (const [key, text] of Object.entries(en)) {
    expect([key, placeholders(zhCN[key as keyof typeof en])]).toEqual([key, placeholders(text)]);
  }
  for (const [code, text] of Object.entries(ERROR_MESSAGES)) {
    expect([code, placeholders(zhCNErrors[code as keyof typeof ERROR_MESSAGES])]).toEqual([
      code,
      placeholders(text),
    ]);
  }
});

test("translate fills placeholders", () => {
  expect(translate("en", "tool.ran", { name: "search" })).toBe("Ran search");
  expect(translate("zh-CN", "tool.ran", { name: "search" })).toBe("已运行 search");
});

test("translateCount picks the plural form", () => {
  expect(translateCount("en", "settings.usage.days", 1)).toBe("1 day");
  expect(translateCount("en", "settings.usage.days", 30)).toBe("30 days");
  expect(translateCount("zh-CN", "settings.usage.days", 30)).toBe("30 天");
});

test("translateError translates by code and leaves other errors as they are", () => {
  expect(translateError("zh-CN", appError("webpageHttpStatus", { status: 500 }))).toBe(
    "目标网页返回了 HTTP 500。",
  );
  expect(translateError("en", appError("rateLimited"))).toBe(ERROR_MESSAGES.rateLimited);
  expect(translateError("zh-CN", { message: "Upstream said no" })).toBe("Upstream said no");
  expect(translateError("zh-CN", { message: "raw", code: "notACode" })).toBe("raw");
  expect(translateError("zh-CN", { message: "" })).toBe("发生未知错误，请重试。");
});

test("translateText translates message keys only", () => {
  expect(isMessageKey("auth.passwordRequired")).toBe(true);
  expect(translateText("zh-CN", "auth.passwordRequired")).toBe("请输入密码。");
  expect(translateText("zh-CN", "Plain text")).toBe("Plain text");
});

test("the system language resolves to the first supported browser language", () => {
  expect(resolveLocale("system", ["zh-TW", "en-US"])).toBe("zh-CN");
  expect(resolveLocale("system", ["en-GB", "zh-CN"])).toBe("en");
  expect(resolveLocale("system", ["fr-FR", "zh-HK"])).toBe("zh-CN");
  expect(resolveLocale("system", ["fr-FR"])).toBe("en");
  expect(resolveLocale("en", ["zh-CN"])).toBe("en");
  expect(parseLanguagePreference("zh-CN")).toBe("zh-CN");
  expect(parseLanguagePreference("ja")).toBe("system");
});

test("the pre-paint script sets the same language as resolveLocale", () => {
  const run = (stored: string | null, languages: string[]) => {
    const root = { lang: "" };
    new Function("localStorage", "navigator", "document", languageScript)(
      { getItem: () => stored },
      { languages, language: languages[0] },
      { documentElement: root },
    );
    return root.lang;
  };
  for (const [stored, languages] of [
    [null, ["zh-TW", "en"]],
    [null, ["en-GB", "zh-CN"]],
    [null, ["fr-FR"]],
    ["en", ["zh-CN"]],
    ["zh-CN", ["en-US"]],
    ["bogus", ["zh-CN"]],
  ] as const) {
    expect(run(stored, [...languages])).toBe(
      resolveLocale(parseLanguagePreference(stored), languages),
    );
  }
});
