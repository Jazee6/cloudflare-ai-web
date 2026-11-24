import * as v from "valibot";
import type { Locale } from "@/lib/locale";

const nonEmpty = v.pipe(v.string(), v.trim(), v.nonEmpty());

/** Text for every Interface Language, or per language as `{ "en": ..., "zh-CN": ... }`. */
const localizedText = v.union([
  nonEmpty,
  v.pipe(
    v.object({ en: v.optional(nonEmpty), "zh-CN": v.optional(nonEmpty) }),
    v.check((value) => Boolean(value.en ?? value["zh-CN"])),
  ),
]);

const httpUrl = v.pipe(
  v.string(),
  v.trim(),
  v.url(),
  v.check((value) => /^https?:\/\//i.test(value)),
);

export const announcementSchema = v.object({
  title: localizedText,
  description: v.optional(localizedText),
  url: v.optional(httpUrl),
});

/** The deployment's Announcement, shown to all visitors until dismissed. */
export type Announcement = v.InferOutput<typeof announcementSchema>;
type LocalizedText = Announcement["title"];

export const ANNOUNCEMENT_DISMISSED_KEY = "cf-ai-announcement-dismissed";

/**
 * Reads the Announcement from the `APP_ANNOUNCEMENT` JSON, e.g.
 * `{"title":"New","description":{"en":"...","zh-CN":"..."},"url":"https://..."}`.
 * Without it there is none; an invalid value is ignored with a warning.
 */
export const getAnnouncement = (): Announcement | undefined => {
  const raw = process.env.APP_ANNOUNCEMENT?.trim();
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = v.safeParse(announcementSchema, JSON.parse(raw));
    if (parsed.success) {
      return parsed.output;
    }
  } catch {
    // Reported below.
  }
  console.warn(
    "Ignoring APP_ANNOUNCEMENT: expected JSON with a title, an optional description and url",
  );
  return undefined;
};

export const localizeText = (text: LocalizedText, locale: Locale) =>
  typeof text === "string" ? text : (text[locale] ?? text.en ?? text["zh-CN"] ?? "");

/** A short fingerprint of the content, so a dismissed Announcement reappears once it changes. */
export const announcementId = (announcement: Announcement) => {
  const content = JSON.stringify(announcement);
  let hash = 5381;
  for (let index = 0; index < content.length; index++) {
    hash = Math.imul(hash, 33) ^ content.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};
