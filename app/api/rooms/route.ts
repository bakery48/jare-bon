import { NextRequest, NextResponse } from "next/server";
import { createRoom } from "@/lib/store";

export async function POST(req: NextRequest) {
  const { hostId } = await req.json();
  if (!hostId) {
    return NextResponse.json({ error: "hostId required" }, { status: 400 });
  }
  const room = createRoom(hostId);
  return NextResponse.json({ code: room.code });
}
