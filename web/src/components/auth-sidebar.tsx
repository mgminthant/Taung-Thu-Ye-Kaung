"use client";

import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/sidebar";
import LoginPage from "@/app/login/page";

export function AuthSidebar({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
