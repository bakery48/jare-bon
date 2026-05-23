import { NextRequest, NextResponse } from "next/server";
import { selectNameWord } from "@/lib/store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { hostId, word } = await req.json();
  if (!hostId || !word?.trim()) {
    return NextResponse.json({ error: "hostId and word required" }, { status: 400 });
  }
  const room = selectNameWord(code, hostId, word.trim());
  if (!room) {
    return NextResponse.json({ error: "Cannot select name word" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
