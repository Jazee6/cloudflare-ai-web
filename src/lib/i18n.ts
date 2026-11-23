import {
  type AppError,
  ERROR_MESSAGES,
  type ErrorCode,
  type ErrorParams,
  interpolate,
  isErrorCode,
} from "@/lib/error-codes";
import { type Locale, readLocale } from "@/lib/locale";
import { en, type MessageKey } from "@/locales/en";
import { zhCN, zhCNErrors } from "@/locales/zh-CN";

export type TranslateParams = ErrorParams;

/** Keys that have `_one` / `_other` forms and are picked by count. */
export type CountKey = MessageKey extends infer Key
  ? Key extends `${infer Base}_other`
    ? Base
    : never
  : never;

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { en, "zh-CN": zhCN };
const ERRORS: Record<Locale, Record<ErrorCode, string>> = {
  en: ERROR_MESSAGES,
  "zh-CN": zhCNErrors,
};

const pluralRules = new Map<Locale, Intl.PluralRules>();
const getPluralRules = (locale: Locale) => {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  return rules;
};

export const isMessageKey = (value: unknown): value is MessageKey =>
  typeof value === "string" && Object.hasOwn(en, value);

/** Text that may be a message key, such as a validation message from a schema. */
export const translateText = (locale: Locale, text: string) =>
  isMessageKey(text) ? translate(locale, text) : text;

export const translate = (locale: Locale, key: MessageKey, params?: TranslateParams) =>
  interpolate(DICTIONARIES[locale][key] ?? en[key], params);

export const translateCount = (
  locale: Locale,
  key: CountKey,
  count: number,
  params?: TranslateParams,
) => {
  const form = getPluralRules(locale).select(count) === "one" ? "one" : "other";
  return translate(locale, `${key}_${form}` as MessageKey, {
    count: count.toLocaleString(locale),
    ...params,
  });
};

/** An error with a known code is translated; any other error, such as raw upstream text, is not. */
export const translateError = (
  locale: Locale,
  { message, code, params }: Pick<AppError, "message" | "params"> & { code?: string },
) => {
  if (isErrorCode(code)) {
    return interpolate(ERRORS[locale][code], params);
  }
  return message.trim() || ERRORS[locale].unknownError;
};

/** Translation outside React, for toasts raised from callbacks. */
export const translateNow = (key: MessageKey, params?: TranslateParams) =>
  translate(readLocale(), key, params);

export const translateErrorNow = (error: Parameters<typeof translateError>[1]) =>
  translateError(readLocale(), error);
