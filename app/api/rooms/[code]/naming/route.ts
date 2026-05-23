import { NextRequest, NextResponse } from "next/server";
import { startNaming, submitNames } from "@/lib/store";

// ホストがnamingフェーズを開始
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { hostId } = await req.json();
  if (!hostId) {
    return NextResponse.json({ error: "hostId required" }, { status: 400 });
  }
  const room = startNaming(code, hostId);
  if (!room) {
    return NextResponse.json({ error: "Cannot start naming" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

// プレイヤーが名前を提出
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { playerId, words } = await req.json();
  if (!playerId || !Array.isArray(words)) {
    return NextResponse.json({ error: "playerId and words required" }, { status: 400 });
  }
  const room = submitNames(code, playerId, words);
  if (!room) {
    return NextResponse.json({ error: "Cannot submit names" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
