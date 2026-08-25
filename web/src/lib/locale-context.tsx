"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import en from "@/locales/en";
import my from "@/locales/my";
import type { Translations } from "@/locales/en";

type Locale = "en" | "my";

const locales: Record<Locale, Translations> = { en, my };

let _current: Locale = "en";

function readLocale(): Locale {
  if (typeof window === "undefined") return _current;
  try {
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved === "en" || saved === "my") { _current = saved; return saved; }
  } catch { /* noop */ }
  const match = document.cookie.split("; ").find((c) => c.startsWith("locale="));
  const val = match?.split("=")[1];
  if (val === "my" || val === "en") { _current = val; return val; }
  return _current;
}

function subscribe(cb: () => void): () => void {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translations;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => {},
  t: en,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, readLocale, () => "en" as Locale);
  const router = useRouter();

  const setLocale = useCallback((l: Locale) => {
    _current = l;
    localStorage.setItem("locale", l);
    document.cookie = `locale=${l}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }, [router]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: locales[locale] }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
