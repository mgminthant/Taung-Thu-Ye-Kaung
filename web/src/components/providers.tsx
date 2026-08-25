"use client";

import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LocaleProvider } from "@/lib/locale-context";
import { ToastProvider } from "@/components/toast";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <LocaleProvider>
          <ToastProvider>
            <AuthGate>{children}</AuthGate>
          </ToastProvider>
        </LocaleProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
