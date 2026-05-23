import { NextRequest } from "next/server";
import { getRoom, toClientRoom, subscribeRoom } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const playerId = req.nextUrl.searchParams.get("playerId") || "";

  const room = getRoom(code);
  if (!room) {
    return new Response("Room not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // client disconnected
        }
      };

      // Send initial state
      const currentRoom = getRoom(code);
      if (currentRoom) {
        send(toClientRoom(currentRoom, playerId));
      }

      const unsubscribe = subscribeRoom(code, () => {
        const updated = getRoom(code);
        if (updated) {
          send(toClientRoom(updated, playerId));
        }
      });

      req.signal.addEventListener("abort", () => {
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
