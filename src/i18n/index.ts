import { createContext, useContext } from "react";
import ko from "./ko.json";
import en from "./en.json";

export type Lang = "ko" | "en";

const dictionaries: Record<Lang, Record<string, string>> = { ko, en };

export function detectLang(): Lang {
  return navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en";
}

export function translate(lang: Lang, key: string): string {
  return dictionaries[lang][key] ?? key;
}

/** translate with {placeholder} substitution */
export function translateParams(
  lang: Lang,
  key: string,
  params: Record<string, string>
): string {
  return translate(lang, key).replace(/\{(\w+)\}/g, (m, name) =>
    name in params ? params[name] : m
  );
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  tp: (key: string, params: Record<string, string>) => string;
}

export const I18nContext = createContext<I18nValue>({
  lang: "ko",
  setLang: () => {},
  t: (k) => k,
  tp: (k) => k,
});

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
