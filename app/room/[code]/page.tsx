"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import type { ClientRoom } from "@/lib/store";

function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("jarebon_player_id") || "";
}

function useTimer(pageStartTime: number | null, timerDuration: number) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!pageStartTime) {
      setSecondsLeft(null);
      return;
    }
    const update = () => {
      const elapsed = Math.floor((Date.now() - pageStartTime) / 1000);
      setSecondsLeft(Math.max(0, timerDuration - elapsed));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [pageStartTime, timerDuration]);

  return secondsLeft;
}

// ---- Waiting Room ----
function WaitingRoom({
  room,
  playerId,
  code,
}: {
  room: ClientRoom;
  playerId: string;
  code: string;
}) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isHost = room.players[0]?.id === playerId;

  async function handleStart() {
    if (!title.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${code}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: playerId, title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-amber-50 p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-amber-900 text-center mb-1">じゃれ本</h1>
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-amber-900">参加者</h2>
            <span className="text-2xl font-mono font-bold text-amber-700 tracking-widest">
              {code}
            </span>
          </div>
          <ul className="space-y-2 mb-4">
            {room.players.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2">
                <span className="text-amber-400">{i === 0 ? "★" : "●"}</span>
                <span className={p.id === playerId ? "font-bold text-amber-900" : "text-gray-700"}>
                  {p.name}
                </span>
                {p.id === playerId && (
                  <span className="text-xs text-amber-500">(あなた)</span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-400 text-center">
            {room.players.length}/8人参加中 ／ ゲーム開始には3人以上必要
          </p>
        </div>

        {isHost && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-amber-900 mb-3">題名を決める</h2>
            <p className="text-xs text-gray-500 mb-3">
              不思議な言葉を組み合わせて題名をつけましょう。<br />
              例:「透明な虎と夢の砂漠」「時計を食べた少女」
            </p>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-amber-500 mb-3"
              placeholder="題名を入力..."
              maxLength={40}
            />
            {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
            <button
              onClick={handleStart}
              disabled={loading || !title.trim() || room.players.length < 3}
              className="w-full bg-amber-800 text-white py-3 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "..." : "ゲームスタート！"}
            </button>
          </div>
        )}

        {!isHost && (
          <div className="bg-white rounded-2xl p-5 shadow-sm text-center text-gray-500">
            ホストがゲームを開始するのを待っています...
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Writing Phase ----
function WritingPhase({
  room,
  playerId,
  code,
}: {
  room: ClientRoom;
  playerId: string;
  code: string;
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const secondsLeft = useTimer(room.pageStartTime, room.timerDuration);
  const isMyTurn = room.currentWriterId === playerId;
  const currentWriter = room.players.find((p) => p.id === room.currentWriterId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const contentRef = useRef(content);
  contentRef.current = content;

  useEffect(() => {
    if (isMyTurn) {
      setContent("");
      textareaRef.current?.focus();
    }
  }, [isMyTurn, room.currentPageIndex]);

  // Auto-submit when timer expires
  useEffect(() => {
    if (isMyTurn && secondsLeft === 0) {
      fetch(`/api/rooms/${code}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, content: contentRef.current || "（時間切れ）" }),
      }).catch(() => {});
    }
  }, [secondsLeft, isMyTurn, code, playerId]);

  async function handleSubmit() {
    if (!isMyTurn) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${code}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContent("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  const timerColor =
    secondsLeft !== null && secondsLeft <= 30
      ? "text-red-500"
      : "text-amber-700";

  const progressPct = Math.round(
    (room.currentPageIndex / room.totalPages) * 100
  );

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col p-4">
      {/* Header */}
      <div className="w-full max-w-lg mx-auto mb-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-amber-700 font-medium">
            {room.currentPageIndex + 1} / {room.totalPages} ページ
          </span>
          {secondsLeft !== null && (
            <span className={`text-2xl font-bold font-mono ${timerColor}`}>
              {Math.floor(secondsLeft / 60)}:
              {String(secondsLeft % 60).padStart(2, "0")}
            </span>
          )}
        </div>
        <div className="w-full bg-amber-200 rounded-full h-2">
          <div
            className="bg-amber-600 h-2 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="w-full max-w-lg mx-auto flex-1 flex flex-col gap-3">
        {/* Title */}
        <div className="bg-amber-100 border border-amber-300 rounded-2xl p-4">
          <p className="text-xs text-amber-600 mb-1 font-medium">題名</p>
          <p className="text-xl font-bold text-amber-900">{room.title}</p>
        </div>

        {/* Previous page */}
        {isMyTurn && room.visiblePage !== null && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-xs text-gray-400 mb-2 font-medium">前の人が書いたページ</p>
            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
              {room.visiblePage}
            </p>
          </div>
        )}
        {isMyTurn && room.currentPageIndex === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center text-gray-400 text-sm">
            最初のページです。題名から想像して書きましょう！
          </div>
        )}

        {/* Writing area or waiting */}
        {isMyTurn ? (
          <div className="bg-white rounded-2xl shadow-sm flex-1 flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-amber-900">
                あなたの番です！2分で書きましょう
              </p>
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 w-full p-4 resize-none focus:outline-none text-gray-800 leading-relaxed rounded-b-2xl min-h-48"
              placeholder="ここに物語を書いてください..."
              maxLength={400}
            />
            <div className="p-4 flex justify-between items-center border-t border-gray-100">
              <span className="text-xs text-gray-400">{content.length}/400文字</span>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                onClick={handleSubmit}
                disabled={loading || !content.trim()}
                className="bg-amber-800 text-white px-6 py-2 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "..." : "次へわたす →"}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-4xl mb-3">✏️</div>
            <p className="font-semibold text-gray-700 mb-1">
              {currentWriter?.name} さんが書いています
            </p>
            <p className="text-sm text-gray-400">
              書き終わったらあなたの番がきます
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Reading Phase ----
function ReadingPhase({ room }: { room: ClientRoom }) {
  // -1 = title, 0..n-1 = pages, null = idle/done
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cancelRef = useRef(false);

  // Build ordered script: [title, page0, page1, ...]
  const script = [
    { label: "題名", text: `題名。${room.title}` },
    ...room.pages.map((p, i) => ({
      label: `${i + 1}ページ目`,
      text: `${i + 1}ページ目。${p.playerName}さん。${p.content}`,
    })),
  ];

  const speakSegment = useCallback(
    (index: number) => {
      if (cancelRef.current || index >= script.length) {
        setSpeakingIndex(null);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(script[index].text);
      utterance.lang = "ja-JP";
      utterance.rate = 0.9;
      setSpeakingIndex(index === 0 ? -1 : index - 1);

      // Scroll the page card into view
      if (index > 0) {
        pageRefs.current[index - 1]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }

      utterance.onend = () => {
        if (!cancelRef.current) speakSegment(index + 1);
      };
      window.speechSynthesis.speak(utterance);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [script.length]
  );

  function startReading() {
    cancelRef.current = false;
    window.speechSynthesis.cancel();
    setIsPaused(false);
    speakSegment(0);
  }

  function togglePause() {
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }

  function stopReading() {
    cancelRef.current = true;
    window.speechSynthesis.cancel();
    setSpeakingIndex(null);
    setIsPaused(false);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRef.current = true;
      window.speechSynthesis.cancel();
    };
  }, []);

  const isReading = speakingIndex !== null;

  return (
    <div className="min-h-screen bg-amber-50 p-4">
      <div className="w-full max-w-lg mx-auto">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-amber-900 mb-1">完成！</h2>
          <p className="text-amber-700 mb-3">みんなで読みましょう</p>

          {/* TTS controls */}
          <div className="flex justify-center gap-2">
            {!isReading ? (
              <button
                onClick={startReading}
                className="bg-amber-800 text-white px-5 py-2 rounded-xl font-semibold hover:bg-amber-700 transition-colors flex items-center gap-2"
              >
                <span>▶</span> 読み上げ開始
              </button>
            ) : (
              <>
                <button
                  onClick={togglePause}
                  className="bg-amber-600 text-white px-5 py-2 rounded-xl font-semibold hover:bg-amber-500 transition-colors"
                >
                  {isPaused ? "▶ 再開" : "⏸ 一時停止"}
                </button>
                <button
                  onClick={stopReading}
                  className="border-2 border-amber-600 text-amber-700 px-4 py-2 rounded-xl font-semibold hover:bg-amber-100 transition-colors"
                >
                  ■ 停止
                </button>
              </>
            )}
          </div>
        </div>

        {/* Title card */}
        <div
          className={`border-2 rounded-2xl p-5 mb-4 text-center transition-colors ${
            speakingIndex === -1
              ? "bg-amber-300 border-amber-500"
              : "bg-amber-100 border-amber-300"
          }`}
        >
          <p className="text-xs text-amber-600 mb-1 font-medium">題名</p>
          <p className="text-2xl font-bold text-amber-900">{room.title}</p>
          {speakingIndex === -1 && (
            <p className="text-xs text-amber-600 mt-1 animate-pulse">読み上げ中...</p>
          )}
        </div>

        {/* Page cards */}
        <div className="space-y-4">
          {room.pages.map((page, i) => (
            <div
              key={i}
              ref={(el) => { pageRefs.current[i] = el; }}
              className={`rounded-2xl p-5 shadow-sm border-2 transition-colors ${
                speakingIndex === i
                  ? "bg-amber-50 border-amber-400"
                  : "bg-white border-transparent"
              }`}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-medium text-amber-600">
                  {i + 1}ページ目
                </span>
                <span className="text-xs text-gray-400">{page.playerName}</span>
              </div>
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                {page.content}
              </p>
              {speakingIndex === i && (
                <p className="text-xs text-amber-500 mt-2 animate-pulse">読み上げ中...</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              stopReading();
              window.location.href = "/";
            }}
            className="border-2 border-amber-800 text-amber-800 px-8 py-3 rounded-xl font-semibold hover:bg-amber-100 transition-colors"
          >
            トップに戻る
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Main Room Page ----
export default function RoomPage() {
  const params = useParams();
  const code = (params.code as string).toUpperCase();
  const [room, setRoom] = useState<ClientRoom | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [notFound, setNotFound] = useState(false);

  const handleRoomData = useCallback((data: ClientRoom) => {
    setRoom(data);
  }, []);

  useEffect(() => {
    const id = getPlayerId();
    setPlayerId(id);

    const evtSource = new EventSource(
      `/api/rooms/${code}/events?playerId=${encodeURIComponent(id)}`
    );

    evtSource.onmessage = (e) => {
      try {
        const data: ClientRoom = JSON.parse(e.data);
        handleRoomData(data);
      } catch {
        // ignore parse errors
      }
    };

    evtSource.onerror = () => {
      setNotFound(true);
      evtSource.close();
    };

    return () => evtSource.close();
  }, [code, handleRoomData]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">部屋が見つかりません</p>
          <button
            onClick={() => (window.location.href = "/")}
            className="text-amber-800 underline"
          >
            トップに戻る
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <p className="text-amber-700">読み込み中...</p>
      </div>
    );
  }

  if (room.status === "waiting") {
    return <WaitingRoom room={room} playerId={playerId} code={code} />;
  }
  if (room.status === "writing") {
    return <WritingPhase room={room} playerId={playerId} code={code} />;
  }
  return <ReadingPhase room={room} />;
}
