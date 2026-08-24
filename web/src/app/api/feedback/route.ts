import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const useful = searchParams.get("useful");
  const q = searchParams.get("q")?.trim();
  const skip = Number(searchParams.get("skip") ?? 0) || 0;
  const take = Math.min(Number(searchParams.get("take") ?? 100) || 100, 500);

  const where = {
    ...(useful === "true" || useful === "false"
      ? { useful: useful === "true" }
      : {}),
    ...(q ? { OR: [{ message: { contains: q } }, { answer: { contains: q } }] } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.feedback.findMany({ where, orderBy: { ts: "desc" }, skip, take }),
    prisma.feedback.count({ where }),
  ]);

  return NextResponse.json({ items, total, skip, take });
}
