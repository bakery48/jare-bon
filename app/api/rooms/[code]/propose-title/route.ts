import { NextRequest, NextResponse } from "next/server";
import { proposeTitleByPlayer } from "@/lib/store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { playerId, title } = await req.json();
  if (!playerId || !title?.trim()) {
    return NextResponse.json({ error: "playerId and title required" }, { status: 400 });
  }
  const room = proposeTitleByPlayer(code, playerId, title);
  if (!room) {
    return NextResponse.json({ error: "Cannot propose title" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
