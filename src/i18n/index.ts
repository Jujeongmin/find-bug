import { createContext, useContext } from "react";
import en from "./en.json";

export type Lang = "ko" | "en" | "ja" | "zh-Hant" | "zh-Hans";

/** the order they are offered in, and what each one calls itself */
export const LANGS: { id: Lang; label: string }[] = [
  { id: "ko", label: "한국어" },
  { id: "en", label: "EN" },
  { id: "ja", label: "日本語" },
  { id: "zh-Hant", label: "繁體" },
  { id: "zh-Hans", label: "简体" },
];

type Dict = Record<string, string>;

/**
 * One language is fetched, not five.
 *
 * All five dictionaries used to be imported here, which put a hundred and
 * fifty kilobytes of text nobody was going to read into the file that has to
 * arrive before the first frame. English stays: it is the floor under every
 * other language, so every screen may need it. The rest come when they are
 * chosen — during the loading screen, which is what that screen is for.
 */
const LOADERS: Record<Lang, () => Promise<{ default: Dict }>> = {
  ko: () => import("./ko.json"),
  en: () => Promise.resolve({ default: en as Dict }),
  ja: () => import("./ja.json"),
  "zh-Hant": () => import("./zh-Hant.json"),
  "zh-Hans": () => import("./zh-Hans.json"),
};

/** English, as a plain table rather than the shape its literal happens to be */
const base = en as Dict;

const dictionaries: Partial<Record<Lang, Dict>> = { en: base };

/**
 * Fetch one, if it is not already here.
 *
 * Resolves either way: a dictionary that fails to arrive leaves the language
 * reading English, which is the same thing a missing key already does and is
 * a great deal better than a game that will not open.
 */
export async function loadLang(lang: Lang): Promise<void> {
  if (dictionaries[lang]) return;
  try {
    dictionaries[lang] = (await LOADERS[lang]()).default;
  } catch {
    /* English is the floor */
  }
}

/**
 * Which language the browser is asking for.
 *
 * Chinese is the awkward one: zh-TW and zh-HK are traditional, zh-CN and
 * zh-SG simplified, and a bare "zh" is neither on its own — the script tag
 * is what decides, and most browsers only send the region.
 */
const LANG_KEY = "fb_lang";

/** the language the player chose last time, if the browser kept it */
function storedLang(): Lang | null {
  try {
    const raw = localStorage.getItem(LANG_KEY);
    return LANGS.some((l) => l.id === raw) ? (raw as Lang) : null;
  } catch {
    return null;
  }
}

/**
 * Remember it. The choice used to live in React state alone, so a reload put
 * the player back into whatever their browser asks for — and someone reading
 * the game in their second language has a browser that asks for their first.
 */
export function rememberLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* private browsing — it just will not persist */
  }
}

export function detectLang(): Lang {
  const chosen = storedLang();
  if (chosen) return chosen;
  const tag = navigator.language.toLowerCase();
  if (tag.startsWith("ko")) return "ko";
  if (tag.startsWith("ja")) return "ja";
  if (tag.startsWith("zh")) {
    return /hant|tw|hk|mo/.test(tag) ? "zh-Hant" : "zh-Hans";
  }
  return "en";
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
  /*
   * English is the floor under every other language.
   *
   * A key with no translation yet used to render as the key itself —
   * "office.dev.step2" in the middle of a sentence — which is worse than any
   * translation and looks like a crash rather than a gap. A language being
   * partly done is a normal state for a game that is still being written.
   */
  const hit = dictionaries[lang]?.[key] ?? base[key] ?? key;
  return bind(hit, lang);
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
