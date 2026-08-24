import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@/generated/prisma/client";

const here = path.dirname(fileURLToPath(import.meta.url));

// DATABASE_URL is "file:./dev.db". The Prisma 7 CLI (via prisma.config.ts)
// resolves it against the web/ directory, so resolve the same way here —
// independent of the process working directory.
function resolveDbPath(url: string | undefined): string {
  if (!url || url === ":memory:") return url ?? "";
  const rest = url.startsWith("file:") ? url.slice(5) : url;
  if (path.isAbsolute(rest)) return rest;
  return path.resolve(here, "..", "..", rest);
}

const adapter = new PrismaBetterSqlite3({
  url: resolveDbPath(process.env.DATABASE_URL),
});

export const prisma = new PrismaClient({ adapter });

export type {
  Article,
  Feedback,
  QuestionLog,
} from "@/generated/prisma/client";
