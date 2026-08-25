"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import {
  BarChart3,
  BookOpenText,
  Leaf,
  LogOut,
  MessageSquareText,
  Moon,
  Sprout,
  Sun,
} from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { useAuth } from "@/lib/auth-context";

const NAV_KEYS = ["dashboard", "knowledge", "feedback", "analytics"] as const;
const NAV_HREFS = ["/", "/knowledge", "/feedback", "/analytics"];
const NAV_ICONS = [BarChart3, BookOpenText, MessageSquareText, Sprout];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const { logout } = useAuth();

  // next-themes resolves the stored/system theme only on the client; render
  // the default icon until mounted to avoid a hydration mismatch.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const navLabels = [
    t.sidebar.dashboard,
    t.sidebar.knowledge,
    t.sidebar.feedback,
    t.sidebar.analytics,
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-sidebar-border bg-sidebar-bg text-sidebar-fg">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary-light text-white shadow-sm">
          <Leaf className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">FarmBot</p>
          <p className="text-xs text-sidebar-muted">Admin Portal</p>
        </div>
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
        {NAV_KEYS.map((key, i) => {
          const href = NAV_HREFS[i];
          const Icon = NAV_ICONS[i];
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-sidebar-hover text-white"
                  : "text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
              }`}
            >
              <Icon className="size-4" />
              {navLabels[i]}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-1 border-t border-sidebar-border px-3 py-3">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex size-8 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-white"
          title={mounted && theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {mounted && theme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </button>
        <button
          onClick={() => setLocale(locale === "en" ? "my" : "en")}
          className="flex h-8 items-center rounded-md px-2 text-xs font-medium text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-white"
          title={locale === "en" ? "Myanmar" : "English"}
        >
          {locale === "en" ? "မြန်မာ" : "EN"}
        </button>
        <button
          onClick={() => {
            logout();
            router.push("/login");
          }}
          className="flex size-8 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-white"
          title="Logout"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );
}
