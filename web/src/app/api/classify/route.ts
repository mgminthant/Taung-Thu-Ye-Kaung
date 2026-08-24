import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, content, language } = body ?? {};

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json(
      { error: "title and content are required" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/classify-article?title=${encodeURIComponent(title)}&content=${encodeURIComponent(content)}&language=${encodeURIComponent(language ?? "my")}`,
      { method: "POST" }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Backend is not running. Start it with: uvicorn app.main:app --reload" },
      { status: 502 }
    );
  }
}
