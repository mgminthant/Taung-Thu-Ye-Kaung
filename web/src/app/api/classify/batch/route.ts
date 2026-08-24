import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncKnowledgeBaseFull } from "@/lib/sync";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export async function POST() {
  try {
    // Call backend batch classify endpoint.
    const res = await fetch(`${BACKEND_URL}/classify-article/batch`, {
      method: "POST",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    const results: Array<{
      id: string;
      categories?: string[];
      crops?: string[];
      tags?: string[];
      error?: string;
    }> = data.results ?? [];

    // Update each article in SQLite with the LLM suggestions.
    let updated = 0;
    for (const r of results) {
      if (r.error || !r.id) continue;

      const cats = r.categories ?? [];
      const crps = r.crops ?? [];
      const tags = r.tags ?? [];

      // Update legacy single-value fields.
      await prisma.article.update({
        where: { id: r.id },
        data: {
          category: cats[0] ?? "cultivation",
          crop: crps[0] ?? null,
          tags: tags.join(", "),
        },
      });

      // Replace junction table entries.
      await prisma.articleCategory.deleteMany({ where: { articleId: r.id } });
      if (cats.length) {
        await prisma.articleCategory.createMany({
          data: cats.map((c) => ({ articleId: r.id, category: c })),
        });
      }

      await prisma.articleCrop.deleteMany({ where: { articleId: r.id } });
      if (crps.length) {
        await prisma.articleCrop.createMany({
          data: crps.map((c) => ({ articleId: r.id, crop: c })),
        });
      }

      updated++;
    }

    // Keep the mobile bot's vector store in sync (crop/category/tags here drive
    // retrieval filtering, and they now live in the vector metadata).
    let syncWarning: string | null = null;
    try {
      await syncKnowledgeBaseFull();
    } catch (e) {
      syncWarning = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json({ updated, total: results.length, results, syncWarning });
  } catch {
    return NextResponse.json(
      { error: "Backend is not running. Start it with: uvicorn app.main:app --reload" },
      { status: 502 }
    );
  }
}
