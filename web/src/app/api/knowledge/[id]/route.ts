import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncKnowledgeBase } from "@/lib/sync";

export const dynamic = "force-dynamic";

const includeRelations = {
  categories: { select: { category: true } },
  crops: { select: { crop: true } },
};

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/knowledge/[id]">
) {
  const { id } = await ctx.params;
  const article = await prisma.article.findUnique({
    where: { id },
    include: includeRelations,
  });
  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ article });
}

export async function PUT(
  req: NextRequest,
  ctx: RouteContext<"/api/knowledge/[id]">
) {
  const { id } = await ctx.params;
  const body = await req.json();
  const exists = await prisma.article.findUnique({ where: { id } });
  if (!exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (Array.isArray(body.categories)) {
    const cats = body.categories.map((c: string) => String(c).trim().toLowerCase()).filter(Boolean);
    await prisma.articleCategory.deleteMany({ where: { articleId: id } });
    if (cats.length) {
      await prisma.articleCategory.createMany({
        data: cats.map((c: string) => ({ articleId: id, category: c })),
      });
    }
  }

  if (Array.isArray(body.crops)) {
    const crps = body.crops.map((c: string) => String(c).trim().toLowerCase()).filter(Boolean);
    await prisma.articleCrop.deleteMany({ where: { articleId: id } });
    if (crps.length) {
      await prisma.articleCrop.createMany({
        data: crps.map((c: string) => ({ articleId: id, crop: c })),
      });
    }
  }

  const cats = Array.isArray(body.categories)
    ? body.categories.map((c: string) => String(c).trim().toLowerCase()).filter(Boolean)
    : undefined;
  const crps = Array.isArray(body.crops)
    ? body.crops.map((c: string) => String(c).trim().toLowerCase()).filter(Boolean)
    : undefined;

  const article = await prisma.article.update({
    where: { id },
    data: {
      title: String(body.title ?? exists.title),
      category: cats ? (cats[0] ?? exists.category) : (body.category ? String(body.category) : exists.category),
      crop: crps !== undefined
        ? (crps[0] ?? null)
        : body.crop !== undefined
          ? (body.crop ? String(body.crop) : null)
          : exists.crop,
      content: String(body.content ?? exists.content),
      source: body.source !== undefined ? (body.source ? String(body.source) : null) : exists.source,
      tags: body.tags !== undefined ? (body.tags ? String(body.tags) : null) : exists.tags,
      region: body.region !== undefined ? (body.region ? String(body.region) : null) : exists.region,
      language: String(body.language ?? exists.language),
    },
    include: includeRelations,
  });
  let syncWarning: string | null = null;
  try {
    await syncKnowledgeBase("update", id);
  } catch (e) {
    syncWarning = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json({ article, syncWarning });
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/knowledge/[id]">
) {
  const { id } = await ctx.params;
  const exists = await prisma.article.findUnique({ where: { id } });
  if (!exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.article.delete({ where: { id } }); // CASCADE deletes junction rows
  let syncWarning: string | null = null;
  try {
    await syncKnowledgeBase("delete", id);
  } catch (e) {
    syncWarning = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json({ ok: true, syncWarning });
}
