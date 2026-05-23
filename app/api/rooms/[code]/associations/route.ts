import { NextRequest, NextResponse } from "next/server";
import { submitAssociations } from "@/lib/store";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { playerId, words } = await req.json();
  if (!playerId || !Array.isArray(words)) {
    return NextResponse.json({ error: "playerId and words required" }, { status: 400 });
  }
  const room = submitAssociations(code, playerId, words);
  if (!room) {
    return NextResponse.json({ error: "Cannot submit associations" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
