/**
 * SettingsProvider — app-wide theme + language state.
 *
 * Holds the light/dark theme and the UI language (English / Myanmar),
 * persists them to AsyncStorage, and exposes the resolved palette (`colors`)
 * and translations (`t`) so every component re-renders on change.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { translations, type Lang, type Strings } from "./i18n";
import { getColors, type ThemeColors, type ThemeName } from "./theme";

const STORAGE_KEY = "farmerbot.settings.v1";

type SettingsState = {
  theme: ThemeName;
  lang: Lang;
};

type SettingsValue = SettingsState & {
  /** False until saved settings have been read (avoid a light-flash). */
  hydrated: boolean;
  isDark: boolean;
  colors: ThemeColors;
  t: Strings;
  toggleTheme: () => void;
  setLang: (lang: Lang) => void;
};

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SettingsState>({
    theme: "light",
    lang: "en",
  });
  const [hydrated, setHydrated] = useState(false);

  // Load saved settings once on mount.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<SettingsState>;
          setState({
            theme: parsed.theme === "dark" ? "dark" : "light",
            lang: parsed.lang === "mm" ? "mm" : "en",
          });
        }
      } catch {
        // Corrupt/absent settings → keep defaults.
      }
      setHydrated(true);
    })();
  }, []);

  // Persist settings whenever they change (once hydrated).
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {
      // best-effort persistence; ignore write failures
    });
  }, [state, hydrated]);

  const value = useMemo<SettingsValue>(
    () => ({
      ...state,
      hydrated,
      isDark: state.theme === "dark",
      colors: getColors(state.theme),
      t: translations[state.lang],
      toggleTheme: () =>
        setState((s) => ({
          ...s,
          theme: s.theme === "dark" ? "light" : "dark",
        })),
      setLang: (lang) => setState((s) => ({ ...s, lang })),
    }),
    [state, hydrated],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
