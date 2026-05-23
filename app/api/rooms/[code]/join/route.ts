import { NextRequest, NextResponse } from "next/server";
import { joinRoom } from "@/lib/store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { playerId, playerName } = await req.json();
  if (!playerId || !playerName?.trim()) {
    return NextResponse.json({ error: "playerId and playerName required" }, { status: 400 });
  }
  const room = joinRoom(code, playerId, playerName.trim());
  if (!room) {
    return NextResponse.json({ error: "Cannot join room" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
