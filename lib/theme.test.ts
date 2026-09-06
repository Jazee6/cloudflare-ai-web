import { expect, test } from "bun:test";
import { parseThemePreference } from "@/lib/theme";

test("defaults invalid or missing theme preferences to system", () => {
  expect(parseThemePreference(undefined)).toBe("system");
  expect(parseThemePreference("invalid")).toBe("system");
});

test("accepts supported theme preferences", () => {
  expect(parseThemePreference("system")).toBe("system");
  expect(parseThemePreference("light")).toBe("light");
  expect(parseThemePreference("dark")).toBe("dark");
});
