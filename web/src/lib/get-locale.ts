import { cookies } from "next/headers";
import en from "@/locales/en";
import my from "@/locales/my";
import type { Translations } from "@/locales/en";

export async function getTranslations(): Promise<Translations> {
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value;
  return locale === "my" ? my : en;
}
