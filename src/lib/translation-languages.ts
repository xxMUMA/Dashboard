export const translationLanguages = {
  en: "English",
  ms: "Malay",
  "zh-CN": "Chinese (Simplified)",
  es: "Spanish",
  fr: "French",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  hi: "Hindi",
} as const;

export type TranslationLanguage = keyof typeof translationLanguages;

export function isTranslationLanguage(value: unknown): value is TranslationLanguage {
  return typeof value === "string" && Object.hasOwn(translationLanguages, value);
}
