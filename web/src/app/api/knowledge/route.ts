import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncKnowledgeBase } from "@/lib/sync";

export const dynamic = "force-dynamic";

const includeRelations = {
  categories: { select: { category: true } },
  crops: { select: { crop: true } },
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim();
  const crop = searchParams.get("crop")?.trim();
  const skip = Number(searchParams.get("skip") ?? 0) || 0;
  const take = Math.min(Number(searchParams.get("take") ?? 100) || 100, 500);

  const where = {
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { content: { contains: q } },
            { id: { contains: q } },
            { categories: { some: { category: { contains: q } } } },
            { crops: { some: { crop: { contains: q } } } },
          ],
        }
      : {}),
    ...(category
      ? { categories: { some: { category } } }
      : {}),
    ...(crop
      ? { crops: { some: { crop } } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      include: includeRelations,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
    prisma.article.count({ where }),
  ]);

  return NextResponse.json({ items, total, skip, take });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const exists = await prisma.article.findUnique({ where: { id } });
  if (exists) {
    return NextResponse.json(
      { error: `Article id "${id}" already exists` },
      { status: 409 }
    );
  }

  const cats = Array.isArray(body.categories)
    ? body.categories.map((c: string) => String(c).trim().toLowerCase()).filter(Boolean)
    : [String(body.category ?? "general").trim().toLowerCase()];
  const crps = Array.isArray(body.crops)
    ? body.crops.map((c: string) => String(c).trim().toLowerCase()).filter(Boolean)
    : body.crop
      ? [String(body.crop).trim().toLowerCase()]
      : [];

  const article = await prisma.article.create({
    data: {
      id,
      title: String(body.title ?? ""),
      category: cats[0] ?? "general",
      crop: crps[0] ?? null,
      content: String(body.content ?? ""),
      source: body.source ? String(body.source) : null,
      tags: body.tags ? String(body.tags) : null,
      region: body.region ? String(body.region) : null,
      language: String(body.language ?? "my"),
      categories: cats.length
        ? { create: cats.map((c: string) => ({ category: c })) }
        : undefined,
      crops: crps.length
        ? { create: crps.map((c: string) => ({ crop: c })) }
        : undefined,
    },
    include: includeRelations,
  });
  let syncWarning: string | null = null;
  try {
    await syncKnowledgeBase("create", article.id);
  } catch (e) {
    syncWarning = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json({ article, syncWarning }, { status: 201 });
}
