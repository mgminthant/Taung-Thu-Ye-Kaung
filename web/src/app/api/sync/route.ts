import { NextResponse } from "next/server";
import { syncKnowledgeBaseFull } from "@/lib/sync";

export async function POST() {
  try {
    await syncKnowledgeBaseFull();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
