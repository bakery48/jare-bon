import { NextRequest, NextResponse } from "next/server";
import { getRoom, toClientRoom } from "@/lib/store";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const playerId = req.nextUrl.searchParams.get("playerId") || "";
  const room = getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  return NextResponse.json(toClientRoom(room, playerId));
}
