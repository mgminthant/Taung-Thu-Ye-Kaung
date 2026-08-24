"use client";

import {
  createContext,
  useContext,
  useCallback,
  useSyncExternalStore,
} from "react";

type AuthContextType = {
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

const HARDCODED_USERS: Record<string, string> = {
  admin: "admin123",
  farmer: "farmer12345678",
};

const AUTH_KEY = "farmbot_admin_auth";

// Own-tab localStorage writes don't fire "storage", so push those through
// this listener set; cross-tab changes arrive via the storage event.
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  listeners.add(callback);
  return () => {
    window.removeEventListener("storage", callback);
    listeners.delete(callback);
  };
}

function getSnapshot() {
  return localStorage.getItem(AUTH_KEY) === "true";
}

// Server render has no localStorage — start logged out; React switches to the
// client snapshot right after hydration without a mismatch.
function getServerSnapshot() {
  return false;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const login = useCallback((username: string, password: string) => {
    if (HARDCODED_USERS[username] === password) {
      localStorage.setItem(AUTH_KEY, "true");
      listeners.forEach((cb) => cb());
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    listeners.forEach((cb) => cb());
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
