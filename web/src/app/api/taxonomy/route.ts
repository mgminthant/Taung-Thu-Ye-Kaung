import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const TYPES = ["category", "crop"] as const;

/** Canonical value from an English name — lowercase snake_case, e.g. "Soil management" → soil_management. */
function toValue(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
}

export async function GET() {
  const items = await prisma.taxonomyTerm.findMany({
    orderBy: [{ type: "asc" }, { en: "asc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const type = String(body.type ?? "").trim();
  if (!TYPES.includes(type as (typeof TYPES)[number])) {
    return NextResponse.json(
      { error: "type must be 'category' or 'crop'" },
      { status: 400 }
    );
  }
  const en = String(body.en ?? "").trim();
  const mm = String(body.mm ?? "").trim();
  if (!en && !mm) {
    return NextResponse.json(
      { error: "Provide at least one name (English or Myanmar)" },
      { status: 400 }
    );
  }
  const value = toValue(en) || mm;
  const exists = await prisma.taxonomyTerm.findUnique({
    where: { type_value: { type, value } },
  });
  if (exists) {
    return NextResponse.json(
      { error: `"${en || mm}" already exists` },
      { status: 409 }
    );
  }
  const term = await prisma.taxonomyTerm.create({
    data: { type, value, en: en || mm, mm: mm || en },
  });
  return NextResponse.json({ term }, { status: 201 });
}
