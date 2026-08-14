import en from "./en";
import mm from "./mm";
import type { Lang, Strings } from "./types";

export type { Lang, Strings };

/** Locale → translation map. Add new locales here (and in types.ts). */
export const translations: Record<Lang, Strings> = { en, mm };
