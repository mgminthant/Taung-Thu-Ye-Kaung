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

/**
 * Google Sign-In (expo-auth-session).
 *
 * Create TWO OAuth client IDs in Google Cloud Console (no redirect URI entry
 * needed — Google derives it from these values):
 *  - Android client: package com.anonymous.taungthuyekhaung
 *      + SHA-1 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
 *  - iOS client:     bundle com.anonymous.taung-thu-ye-khaung
 *
 * Paste both IDs below AND in backend/.env as GOOGLE_CLIENT_IDS=ios_id,android_id.
 * Empty strings disable the Google button.
 */
export const GOOGLE_IOS_CLIENT_ID = "514857218839-5pcbrnspcu1sbhk90jv2727shj1eidsg.apps.googleusercontent.com";
export const GOOGLE_ANDROID_CLIENT_ID = "514857218839-lc61t5us8mh1f51t15llo25g67q2od63.apps.googleusercontent.com";
