import { afterEach, expect, test } from "bun:test";
import { announcementId, getAnnouncement, localizeText } from "@/lib/announcement";

const original = process.env.APP_ANNOUNCEMENT;
afterEach(() => {
  if (original === undefined) {
    delete process.env.APP_ANNOUNCEMENT;
  } else {
    process.env.APP_ANNOUNCEMENT = original;
  }
});

test("getAnnouncement parses title, description and url from JSON", () => {
  process.env.APP_ANNOUNCEMENT = JSON.stringify({
    title: " New ",
    description: { en: "Image generation", "zh-CN": "会话内生图" },
    url: "https://example.com/changelog",
  });
  expect(getAnnouncement()).toEqual({
    title: "New",
    description: { en: "Image generation", "zh-CN": "会话内生图" },
    url: "https://example.com/changelog",
  });
});

test("getAnnouncement accepts a path on this site", () => {
  process.env.APP_ANNOUNCEMENT = JSON.stringify({
    title: "New",
    url: " /settings/providers?x=1#a ",
  });
  expect(getAnnouncement()).toEqual({ title: "New", url: "/settings/providers?x=1#a" });
});

test("getAnnouncement ignores missing, invalid or unsafe values", () => {
  delete process.env.APP_ANNOUNCEMENT;
  expect(getAnnouncement()).toBeUndefined();
  for (const value of [
    "plain text",
    JSON.stringify({ description: "No title" }),
    JSON.stringify({ title: "  " }),
    JSON.stringify({ title: {} }),
    JSON.stringify({ title: "Hi", url: "javascript:alert(1)" }),
    JSON.stringify({ title: "Hi", url: "//evil.example" }),
    JSON.stringify({ title: "Hi", url: "/\\evil.example" }),
    JSON.stringify({ title: "Hi", url: "settings" }),
  ]) {
    process.env.APP_ANNOUNCEMENT = value;
    expect(getAnnouncement()).toBeUndefined();
  }
});

test("localizeText picks the Interface Language and falls back to the other", () => {
  expect(localizeText("Hi", "zh-CN")).toBe("Hi");
  expect(localizeText({ en: "Hi", "zh-CN": "你好" }, "zh-CN")).toBe("你好");
  expect(localizeText({ en: "Hi" }, "zh-CN")).toBe("Hi");
  expect(localizeText({ "zh-CN": "你好" }, "en")).toBe("你好");
});

test("announcementId changes with any part of the content", () => {
  const base = announcementId({ title: "Hi" });
  expect(announcementId({ title: "Hi" })).toBe(base);
  expect(announcementId({ title: "Hi!" })).not.toBe(base);
  expect(announcementId({ title: "Hi", description: "More" })).not.toBe(base);
  expect(announcementId({ title: "Hi", url: "https://example.com" })).not.toBe(base);
});
