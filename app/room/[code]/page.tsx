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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isHost = room.players[0]?.id === playerId;

  async function handleStartNaming() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${code}/naming`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: playerId }),
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
            {room.players.length}/8人参加中 ／ 開始には3人以上必要
          </p>
        </div>

        {isHost && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-amber-900 mb-2">準備ができたら</h2>
            <p className="text-xs text-gray-500 mb-4">
              みんなで「題名ワークシート」をやって不思議な題名をつくります。
            </p>
            {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
            <button
              onClick={handleStartNaming}
              disabled={loading || room.players.length < 3}
              className="w-full bg-amber-800 text-white py-3 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "..." : "題名ワークシートへ →"}
            </button>
          </div>
        )}

        {!isHost && (
          <div className="bg-white rounded-2xl p-5 shadow-sm text-center text-gray-500">
            ホストの開始を待っています...
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Step badge ----
function StepBadge({ step, current }: { step: number; current: number }) {
  const active = step === current;
  const done = step < current;
  return (
    <span
      className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
        active
          ? "bg-amber-800 text-white"
          : done
          ? "bg-amber-300 text-amber-900"
          : "bg-gray-200 text-gray-400"
      }`}
    >
      {done ? "✓" : step}
    </span>
  );
}

// ---- ① Naming Phase ----
function NamingPhase({
  room,
  playerId,
  code,
}: {
  room: ClientRoom;
  playerId: string;
  code: string;
}) {
  const isHost = room.players[0]?.id === playerId;
  const alreadySubmitted = room.hasSubmittedNames;
  // 10 inputs
  const [words, setWords] = useState<string[]>(Array(10).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allNames = room.nameSubmissions.flatMap((s) => s.words).filter(Boolean);
  const submittedCount = room.nameSubmissions.length;

  async function handleSubmit() {
    const valid = words.map((w) => w.trim()).filter(Boolean);
    if (valid.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${code}/naming`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, words: valid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectWord(word: string) {
    if (!isHost) return;
    setLoading(true);
    try {
      await fetch(`/api/rooms/${code}/select-name`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: playerId, word }),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-amber-50 p-4">
      <div className="w-full max-w-sm mx-auto">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5">
          <StepBadge step={1} current={1} />
          <div className="h-px flex-1 bg-gray-200" />
          <StepBadge step={2} current={1} />
          <div className="h-px flex-1 bg-gray-200" />
          <StepBadge step={3} current={1} />
        </div>

        <h2 className="text-xl font-bold text-amber-900 mb-1">① 名前を集める</h2>
        <p className="text-sm text-gray-500 mb-4">
          人・場所・動物・食べ物など、思いつく「名前」を10個書いてみよう。
        </p>

        {!alreadySubmitted ? (
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <div className="grid grid-cols-2 gap-2 mb-4">
              {words.map((w, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-xs text-amber-400 w-5 text-right">{i + 1}</span>
                  <input
                    type="text"
                    value={w}
                    onChange={(e) => {
                      const next = [...words];
                      next[i] = e.target.value;
                      setWords(next);
                    }}
                    className="flex-1 border border-amber-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-500"
                    placeholder={`名前${i + 1}`}
                    maxLength={15}
                  />
                </div>
              ))}
            </div>
            {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={loading || words.every((w) => !w.trim())}
              className="w-full bg-amber-800 text-white py-2.5 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "..." : "提出する"}
            </button>
          </div>
        ) : (
          <div className="bg-amber-100 rounded-2xl p-4 mb-4 text-center text-amber-700 font-medium">
            提出済み ✓ — 他のみんなを待っています
          </div>
        )}

        {/* Submitted count */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <p className="text-xs text-gray-500 mb-3">
            提出済み: {submittedCount}/{room.players.length}人
          </p>
          <div className="flex flex-wrap gap-2">
            {room.players.map((p) => {
              const submitted = room.nameSubmissions.some((s) => s.playerId === p.id);
              return (
                <span
                  key={p.id}
                  className={`text-xs px-2 py-1 rounded-full ${
                    submitted ? "bg-amber-200 text-amber-800" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {submitted ? "✓ " : ""}{p.name}
                </span>
              );
            })}
          </div>
        </div>

        {/* Host: show all names and pick one */}
        {isHost && allNames.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm font-bold text-amber-900 mb-3">
              集まった名前（ホスト：1つ選んでください）
            </p>
            <div className="flex flex-wrap gap-2">
              {allNames.map((w, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectWord(w)}
                  disabled={loading}
                  className="bg-amber-50 border border-amber-300 text-amber-900 px-3 py-1.5 rounded-xl text-sm hover:bg-amber-200 transition-colors"
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isHost && allNames.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center text-gray-500 text-sm">
            ホストが名前を1つ選んでいます...
          </div>
        )}
      </div>
    </div>
  );
}

// ---- ② Association Phase ----
function AssociatingPhase({
  room,
  playerId,
  code,
}: {
  room: ClientRoom;
  playerId: string;
  code: string;
}) {
  const isHost = room.players[0]?.id === playerId;
  const alreadySubmitted = room.hasSubmittedAssoc;
  const [words, setWords] = useState<string[]>(Array(5).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [titlePreview, setTitlePreview] = useState("");

  const allAssocWords = room.assocSubmissions.flatMap((s) => s.words).filter(Boolean);
  const allNameWords = room.nameSubmissions.flatMap((s) => s.words).filter(Boolean);
  const submittedCount = room.assocSubmissions.length;

  async function handleSubmit() {
    const valid = words.map((w) => w.trim()).filter(Boolean);
    if (valid.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${code}/associations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, words: valid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetTitle() {
    if (!titlePreview.trim()) return;
    setLoading(true);
    try {
      await fetch(`/api/rooms/${code}/title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: playerId, title: titlePreview }),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-amber-50 p-4">
      <div className="w-full max-w-sm mx-auto">
        <div className="flex items-center gap-2 mb-5">
          <StepBadge step={1} current={2} />
          <div className="h-px flex-1 bg-amber-300" />
          <StepBadge step={2} current={2} />
          <div className="h-px flex-1 bg-gray-200" />
          <StepBadge step={3} current={2} />
        </div>

        <h2 className="text-xl font-bold text-amber-900 mb-1">② 連想する</h2>
        <div className="bg-amber-100 border border-amber-300 rounded-xl px-4 py-2 mb-3 inline-block">
          <span className="text-xs text-amber-600">選ばれた名前：</span>
          <span className="font-bold text-amber-900 ml-1">{room.selectedNameWord}</span>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          「{room.selectedNameWord}」から思いつくことを自由に5つ書いてみよう。
        </p>

        {!alreadySubmitted ? (
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <div className="space-y-2 mb-4">
              {words.map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-amber-400 w-4 text-right">{i + 1}</span>
                  <input
                    type="text"
                    value={w}
                    onChange={(e) => {
                      const next = [...words];
                      next[i] = e.target.value;
                      setWords(next);
                    }}
                    className="flex-1 border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                    placeholder={`連想${i + 1}`}
                    maxLength={20}
                  />
                </div>
              ))}
            </div>
            {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={loading || words.every((w) => !w.trim())}
              className="w-full bg-amber-800 text-white py-2.5 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "..." : "提出する"}
            </button>
          </div>
        ) : (
          <div className="bg-amber-100 rounded-2xl p-4 mb-4 text-center text-amber-700 font-medium">
            提出済み ✓ — 他のみんなを待っています
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <p className="text-xs text-gray-500 mb-2">
            提出済み: {submittedCount}/{room.players.length}人
          </p>
          <div className="flex flex-wrap gap-2">
            {room.players.map((p) => {
              const submitted = room.assocSubmissions.some((s) => s.playerId === p.id);
              return (
                <span
                  key={p.id}
                  className={`text-xs px-2 py-1 rounded-full ${
                    submitted ? "bg-amber-200 text-amber-800" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {submitted ? "✓ " : ""}{p.name}
                </span>
              );
            })}
          </div>
        </div>

        {/* Host: combine ②+① to make title */}
        {isHost && allAssocWords.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm font-bold text-amber-900 mb-1">③ 組み合わせて題名をつくる</p>
            <p className="text-xs text-gray-500 mb-3">
              「連想語」＋「名前」をあべこべに組み合わせて不思議な題名に！<br />
              タップで題名欄に入力されます。自由に編集もできます。
            </p>
            <div className="mb-3">
              <p className="text-xs text-amber-600 font-medium mb-1">連想語（②）</p>
              <div className="flex flex-wrap gap-1.5">
                {allAssocWords.map((w, i) => (
                  <button
                    key={`a-${i}`}
                    onClick={() => setTitlePreview((prev) => w + (prev ? "の" + prev : ""))}
                    className="bg-blue-50 border border-blue-200 text-blue-800 px-2.5 py-1 rounded-lg text-sm hover:bg-blue-100 transition-colors"
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <p className="text-xs text-amber-600 font-medium mb-1">名前（①）</p>
              <div className="flex flex-wrap gap-1.5">
                {allNameWords.map((w, i) => (
                  <button
                    key={`n-${i}`}
                    onClick={() => setTitlePreview((prev) => (prev ? prev + "の" : "") + w)}
                    className="bg-green-50 border border-green-200 text-green-800 px-2.5 py-1 rounded-lg text-sm hover:bg-green-100 transition-colors"
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-1">題名プレビュー（直接編集もOK）</p>
            <input
              type="text"
              value={titlePreview}
              onChange={(e) => setTitlePreview(e.target.value)}
              className="w-full border-2 border-amber-300 rounded-xl px-4 py-3 text-base font-bold text-amber-900 focus:outline-none focus:border-amber-500 mb-3"
              placeholder="ここに題名が入ります"
              maxLength={40}
            />
            <button
              onClick={handleSetTitle}
              disabled={loading || !titlePreview.trim()}
              className="w-full bg-amber-800 text-white py-3 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "..." : "この題名でスタート！"}
            </button>
          </div>
        )}

        {!isHost && (
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center text-gray-500 text-sm">
            ホストが題名をつくっています...
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
  if (room.status === "naming") {
    return <NamingPhase room={room} playerId={playerId} code={code} />;
  }
  if (room.status === "associating") {
    return <AssociatingPhase room={room} playerId={playerId} code={code} />;
  }
  if (room.status === "writing") {
    return <WritingPhase room={room} playerId={playerId} code={code} />;
  }
  return <ReadingPhase room={room} />;
}
