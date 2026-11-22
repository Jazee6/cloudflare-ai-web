import { expect, test } from "bun:test";
import { parseThemePreference, resolveTheme } from "@/lib/theme";

test("defaults invalid or missing theme preferences to system", () => {
  expect(parseThemePreference(undefined)).toBe("system");
  expect(parseThemePreference(null)).toBe("system");
  expect(parseThemePreference("invalid")).toBe("system");
});

test("accepts supported theme preferences", () => {
  expect(parseThemePreference("system")).toBe("system");
  expect(parseThemePreference("light")).toBe("light");
  expect(parseThemePreference("dark")).toBe("dark");
});

test("resolves system preference from the color scheme", () => {
  expect(resolveTheme("system", true)).toBe("dark");
  expect(resolveTheme("system", false)).toBe("light");
  expect(resolveTheme("light", true)).toBe("light");
});
