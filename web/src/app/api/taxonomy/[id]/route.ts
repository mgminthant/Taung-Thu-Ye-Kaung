import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Edit a taxonomy term's display names. The canonical ``value`` key is
 * intentionally immutable here: it is stored on ArticleCategory/ArticleCrop
 * rows and used by the backend's crop filter, so renaming it would silently
 * detach existing articles from the term.
 */
export async function PUT(
  req: NextRequest,
  ctx: RouteContext<"/api/taxonomy/[id]">
) {
  const { id } = await ctx.params;
  const termId = Number(id);
  if (!Number.isInteger(termId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  const en = String(body.en ?? "").trim();
  const mm = String(body.mm ?? "").trim();
  if (!en && !mm) {
    return NextResponse.json(
      { error: "Provide at least one name (English or Myanmar)" },
      { status: 400 }
    );
  }

  const exists = await prisma.taxonomyTerm.findUnique({ where: { id: termId } });
  if (!exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const term = await prisma.taxonomyTerm.update({
    where: { id: termId },
    data: { en: en || exists.mm, mm: mm || exists.en },
  });
  return NextResponse.json({ term });
}

/** Remove a taxonomy term. Articles keep their stored labels (plain strings). */
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/taxonomy/[id]">
) {
  const { id } = await ctx.params;
  const termId = Number(id);
  if (!Number.isInteger(termId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await prisma.taxonomyTerm.delete({ where: { id: termId } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
