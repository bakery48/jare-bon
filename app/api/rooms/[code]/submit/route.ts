import { NextRequest, NextResponse } from "next/server";
import { submitPage } from "@/lib/store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { playerId, content } = await req.json();
  if (!playerId || content === undefined) {
    return NextResponse.json({ error: "playerId and content required" }, { status: 400 });
  }
  const room = submitPage(code, playerId, content);
  if (!room) {
    return NextResponse.json({ error: "Cannot submit page" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
