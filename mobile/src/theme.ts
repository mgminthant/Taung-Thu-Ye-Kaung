/**
 * Theme palettes + helper types.
 *
 * Components should read the active palette via `useSettings()` (see
 * `settings.tsx`) rather than importing `lightColors` directly, so styles
 * react to the light/dark switcher in the sidebar.
 */
export const lightColors = {
  /** App background (soft green). */
  bg: "#eef5ea",
  /** Brand green used for buttons, accents and user bubbles. */
  primary: "#2f6b45",
  /** Darkest text colour (titles, user text on green). */
  textDark: "#1f3d2a",
  /** Main message body text. */
  textBody: "#24382c",
  /** Secondary / muted text. */
  muted: "#5f7a64",
  /** Even fainter text (timestamps, placeholders). */
  mutedLight: "#8aa093",
  /** Input borders / chips. */
  border: "#c5d6c8",
  /** Lighter dividers (header underline, bubble borders). */
  borderLight: "#d7e5d9",
  /** Card / bubble background. */
  white: "#ffffff",
  /** Destructive action colour (Delete). */
  danger: "#b23b3b",
  /** Drawer panel background. */
  drawerBg: "#f7fbf5",
  /** Highlighted row in the drawer. */
  activeBg: "#e3f0e6",
  /** Dim overlay behind the drawer. */
  backdrop: "rgba(31, 61, 42, 0.35)",
  /** Dim overlay behind modals. */
  modalBackdrop: "rgba(31, 61, 42, 0.4)",
  /** Divider inside the ⋮ actions menu. */
  menuDivider: "#eef2ec",
} as const;

export const darkColors: ThemeColors = {
  bg: "#0e1510",
  primary: "#3f8f5f",
  textDark: "#e6f0e8",
  textBody: "#d4e2d8",
  muted: "#8fa898",
  mutedLight: "#6b8173",
  border: "#2c4234",
  borderLight: "#223326",
  white: "#1a251d",
  danger: "#e07b7b",
  drawerBg: "#121c15",
  activeBg: "#1f3a29",
  backdrop: "rgba(0, 0, 0, 0.55)",
  modalBackdrop: "rgba(0, 0, 0, 0.6)",
  menuDivider: "#243326",
};

/** Palette shape — any color key → a CSS color string. */
export type ThemeColors = {
  [K in keyof typeof lightColors]: string;
};

export type ThemeName = "light" | "dark";

/** Resolve the active palette for a theme name. */
export function getColors(theme: ThemeName): ThemeColors {
  return theme === "dark" ? darkColors : lightColors;
}
