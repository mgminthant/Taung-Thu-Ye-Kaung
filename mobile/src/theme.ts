/**
 * Shared palette + layout constants used across all components.
 * Keeping them in one file makes it easy to restyle the whole app.
 */
export const colors = {
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
} as const;
