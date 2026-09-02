import { createContext, useContext } from "react";
import ko from "./ko.json";
import en from "./en.json";

export type Lang = "ko" | "en";

const dictionaries: Record<Lang, Record<string, string>> = { ko, en };

export function detectLang(): Lang {
  return navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en";
}

/*
 * Bound nouns, kept on the same line as the word that governs them.
 *
 * Korean never breaks inside a word — word-break: keep-all sees to that — but
 * it will happily break at the space in "싫어했던 것들뿐이다", stranding a noun
 * that cannot stand on its own at the head of a line while the clause that
 * governs it sits on the one above. It is the most jarring wrap the language
 * has, and no CSS property knows about it: the fault is grammatical, not
 * metrical.
 *
 * The space becomes a no-break space. A word joiner would forbid the break
 * too, but it is zero-width — it removes the space rather than holding it, and
 * the two words run together.
 *
 * Only nouns that cannot be a word by themselves are listed. Anything that can
 * stand alone is free to start a line.
 */
/* [^ ] rather than the shorter escape: every route into this file has eaten
   a backslash at least once, and a pattern with a dead escape in it matches
   nothing and says nothing about it */
const NBSP = String.fromCharCode(160);
const GLUE = /([^ ]) (것|수|때|뿐|줄|만큼|대로|채|따름|나름)/g;

/** the same line, with nothing bound left dangling at the head of one */
const bind = (text: string, lang: Lang) =>
  lang === "ko" ? text.replace(GLUE, "$1" + NBSP + "$2") : text;

export function translate(lang: Lang, key: string): string {
  return bind(dictionaries[lang][key] ?? key, lang);
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
