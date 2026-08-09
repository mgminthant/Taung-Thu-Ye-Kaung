import Constants from "expo-constants";

/**
 * Resolve the host that the Metro bundler is served from.
 * - Web / simulator: hostUri is set by Expo.
 * - Expo Go on a physical phone: hostUri is your computer's LAN IP,
 *   so the backend at port 8000 on the same computer is reachable.
 * Falls back to localhost.
 */
function resolveApiHost(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    null;
  const host = hostUri?.split(":")[0];
  return host || "127.0.0.1";
}

export const API_BASE_URL = `http://${resolveApiHost()}:8000`;

export const SUGGESTED_QUESTIONS = [
  "Why are my rice leaves turning yellow?",
  "Tomato leaves are curling upward. What is wrong?",
  "How often should I water vegetable beds in hot weather?",
  "What does NPK mean for fertilizer?",
];
