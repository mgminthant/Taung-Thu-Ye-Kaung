<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FarmBot Admin Portal — project conventions

Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4 + Prisma 7 + SQLite
(+ Recharts for charts). Run commands from this `web/` directory.

## Tech specifics
- **Prisma 7**: uses `prisma.config.ts` (datasource URL, seed command) and a
  driver adapter. SQLite adapter = `@prisma/adapter-better-sqlite3`. Do NOT use
  `@prisma/client` directly — the shared client is `src/lib/db.ts`, which loads
  `.env` via `dotenv/config` and resolves `file:./dev.db` against `web/`.
- Generated client lives in `src/generated/prisma` (gitignored) — regenerate
  with `npx prisma generate` after schema changes. `npx prisma db push` applies
  schema to SQLite (`web/dev.db`, gitignored). `npm run db:seed` re-imports
  `data/agriculture.csv` + `backend/feedback.jsonl` (articles are insert-if-missing,
  feedback is truncate + re-import).
- **Next 16 gotchas**: page `params`/`searchParams` are `Promise`s (await them);
  dynamic route handlers use `RouteContext<'/path/[id]'>` and `await ctx.params`.
- Run: `npm run dev`, `npm run build`, `npm run lint`, `npm run db:studio`.

## Data flow
- Portal pages are server components reading SQLite via `prisma`; writes go
  through API routes in `src/app/api/` (knowledge CRUD, feedback list).
- Admin edits to articles are preserved by the seed (insert-if-missing).
- The backend `../backend/` (FastAPI, CSV + ChromaDB) is the mobile app's
  backend; this portal's SQLite is the admin side. Sync between them is a
  future step.
- `QuestionLog` (interaction dataset, prd.md §17) is empty — backend must log
  one row per chat turn before the Analytics page can show intent data.
