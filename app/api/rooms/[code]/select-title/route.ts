import { NextRequest, NextResponse } from "next/server";
import { selectTitle } from "@/lib/store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { hostId, title } = await req.json();
  if (!hostId || !title?.trim()) {
    return NextResponse.json({ error: "hostId and title required" }, { status: 400 });
  }
  const room = selectTitle(code, hostId, title);
  if (!room) {
    return NextResponse.json({ error: "Cannot select title" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
