import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { API_BASE_URL } from "../config";

const AUTH_KEY = "farmerbot.auth.v1";

export type AuthUser = {
  userId: string;
  displayName: string;
  isGuest: boolean;
};

type AuthState = {
  user: AuthUser | null;
  hydrated: boolean;
};

type AuthValue = AuthState & {
  login: (username: string, password: string) => Promise<{ error?: string }>;
  signup: (username: string, password: string) => Promise<{ error?: string }>;
  signInWithGoogle: (idToken: string) => Promise<{ error?: string }>;
  continueAsGuest: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, hydrated: false });

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(AUTH_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as AuthUser;
          if (parsed?.userId) setState({ user: parsed, hydrated: true });
        }
      } catch { /* ignore */ }
      setState((s) => ({ ...s, hydrated: true }));
    })();
  }, []);

  const persist = useCallback(async (user: AuthUser) => {
    setState({ user, hydrated: true });
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const trimmed = username.trim();
    if (!trimmed) return { error: "Username is required" };
    if (!password) return { error: "Password is required" };

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed, password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.detail || "Login failed" };

      const user: AuthUser = {
        userId: data.userId,
        displayName: data.displayName,
        isGuest: false,
      };
      await persist(user);
      return {};
    } catch {
      return { error: "Cannot reach server" };
    }
  }, [persist]);

  const signup = useCallback(async (username: string, password: string) => {
    const trimmed = username.trim();
    if (!trimmed) return { error: "Username is required" };
    if (trimmed.length < 3) return { error: "Username must be at least 3 characters" };
    if (!password || password.length < 4) return { error: "Password must be at least 4 characters" };

    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed, password, displayName: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.detail || "Signup failed" };

      const user: AuthUser = {
        userId: data.userId,
        displayName: data.displayName,
        isGuest: false,
      };
      await persist(user);
      return {};
    } catch {
      return { error: "Cannot reach server" };
    }
  }, [persist]);

  /** Exchange a Google id_token (from expo-auth-session) for an app session. */
  const signInWithGoogle = useCallback(async (idToken: string) => {
    if (!idToken) return { error: "Google sign-in failed" };

    try {
      const res = await fetch(`${API_BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.detail || "Google sign-in failed" };

      const user: AuthUser = {
        userId: data.userId,
        displayName: data.displayName,
        isGuest: false,
      };
      await persist(user);
      return {};
    } catch {
      return { error: "Cannot reach server" };
    }
  }, [persist]);

  const continueAsGuest = useCallback(() => {
    const id = `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const user: AuthUser = { userId: id, displayName: "Guest", isGuest: true };
    persist(user);
  }, [persist]);

  const logout = useCallback(async () => {
    setState({ user: null, hydrated: true });
    await AsyncStorage.removeItem(AUTH_KEY);
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, signup, signInWithGoogle, continueAsGuest, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
