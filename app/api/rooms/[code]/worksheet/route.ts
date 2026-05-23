import { NextRequest, NextResponse } from "next/server";
import { startWorksheet } from "@/lib/store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { hostId } = await req.json();
  if (!hostId) {
    return NextResponse.json({ error: "hostId required" }, { status: 400 });
  }
  const room = startWorksheet(code, hostId);
  if (!room) {
    return NextResponse.json({ error: "Cannot start worksheet" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
