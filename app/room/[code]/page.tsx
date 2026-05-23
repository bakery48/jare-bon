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

  async function handleStart() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${code}/worksheet`, {
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
            <p className="text-xs text-gray-500 mb-4">
              全員揃ったら「題名ワークシート」へ進みましょう。
              各自がワークシートをやって、不思議な題名を1つ提案します。
            </p>
            {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
            <button
              onClick={handleStart}
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

// ---- Worksheet Phase (各自で①②③) ----
function WorksheetPhase({
  room,
  playerId,
  code,
}: {
  room: ClientRoom;
  playerId: string;
  code: string;
}) {
  // Local step: 1=名前入力, 2=連想入力, 3=組み合わせ＆提出
  const [step, setStep] = useState(1);
  const [nameWords, setNameWords] = useState<string[]>(Array(10).fill(""));
  const [chosenName, setChosenName] = useState<string | null>(null);
  const [assocWords, setAssocWords] = useState<string[]>(Array(5).fill(""));
  const [titlePreview, setTitlePreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validNames = nameWords.map((w) => w.trim()).filter(Boolean);
  const validAssoc = assocWords.map((w) => w.trim()).filter(Boolean);
  const submittedCount = room.titleProposals.length;
  const alreadySubmitted = room.hasSubmittedTitle;

  async function handlePropose() {
    if (!titlePreview.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${code}/propose-title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, title: titlePreview }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }

  if (alreadySubmitted) {
    return (
      <div className="min-h-screen bg-amber-50 p-4 flex items-center justify-center">
        <div className="w-full max-w-sm text-center">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <p className="text-4xl mb-3">✅</p>
            <p className="font-bold text-amber-900 mb-1">題名案を提出しました</p>
            <p className="text-sm text-gray-400 mb-4">他の人を待っています...</p>
            <div className="text-left">
              <p className="text-xs text-gray-400 mb-2">
                提出済み: {submittedCount}/{room.players.length}人
              </p>
              <div className="flex flex-wrap gap-2">
                {room.players.map((p) => {
                  const done = room.titleProposals.some((t) => t.playerId === p.id);
                  return (
                    <span
                      key={p.id}
                      className={`text-xs px-2 py-1 rounded-full ${
                        done ? "bg-amber-200 text-amber-800" : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {done ? "✓ " : ""}{p.name}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50 p-4">
      <div className="w-full max-w-sm mx-auto">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5">
          {[1, 2, 3].map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => step > s && setStep(s)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                  s === step
                    ? "bg-amber-800 text-white"
                    : s < step
                    ? "bg-amber-300 text-amber-900 cursor-pointer"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {s < step ? "✓" : s}
              </button>
              {i < 2 && <div className={`h-px flex-1 ${s < step ? "bg-amber-300" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: 名前を10個 */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-bold text-amber-900 mb-1">① 名前を10個書く</h2>
            <p className="text-sm text-gray-500 mb-4">
              人・場所・動物・食べ物など、思いつく「名前」を何でも10個。
            </p>
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
              <div className="grid grid-cols-2 gap-2">
                {nameWords.map((w, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="text-xs text-amber-400 w-5 text-right shrink-0">{i + 1}</span>
                    <input
                      type="text"
                      value={w}
                      onChange={(e) => {
                        const next = [...nameWords];
                        next[i] = e.target.value;
                        setNameWords(next);
                      }}
                      className="flex-1 border border-amber-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-500 min-w-0"
                      placeholder={`名前${i + 1}`}
                      maxLength={15}
                    />
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={validNames.length === 0}
              className="w-full bg-amber-800 text-white py-3 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              次へ →
            </button>
          </div>
        )}

        {/* Step 2: 1つ選んで連想5つ */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-bold text-amber-900 mb-1">② 1つ選んで連想する</h2>
            <p className="text-sm text-gray-500 mb-3">
              ①の名前から<strong>1つだけ</strong>選んで、そこから思いつくことを自由に5つ書く。
            </p>
            {/* 名前を選ぶ */}
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
              <p className="text-xs text-amber-700 font-medium mb-2">どれを選ぶ？（タップで選択）</p>
              <div className="flex flex-wrap gap-2">
                {validNames.map((w, i) => (
                  <button
                    key={i}
                    onClick={() => setChosenName(w)}
                    className={`px-3 py-1.5 rounded-xl text-sm border-2 transition-colors ${
                      chosenName === w
                        ? "bg-amber-800 text-white border-amber-800"
                        : "bg-white border-amber-200 text-amber-900 hover:bg-amber-50"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {chosenName && (
              <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
                <p className="text-xs text-amber-700 font-medium mb-1">
                  「{chosenName}」から思いつくこと
                </p>
                <div className="space-y-2">
                  {assocWords.map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-amber-400 w-4 text-right shrink-0">{i + 1}</span>
                      <input
                        type="text"
                        value={w}
                        onChange={(e) => {
                          const next = [...assocWords];
                          next[i] = e.target.value;
                          setAssocWords(next);
                        }}
                        className="flex-1 border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                        placeholder={`連想${i + 1}`}
                        maxLength={20}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border-2 border-gray-200 text-gray-500 py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                ← 戻る
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!chosenName || validAssoc.length === 0}
                className="flex-1 bg-amber-800 text-white py-3 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                次へ →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: ②+① で組み合わせ → 提出 */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-bold text-amber-900 mb-1">③ 組み合わせて題名に</h2>
            <p className="text-sm text-gray-500 mb-1">
              「②の言葉」＋「①の名前」を<strong>あべこべ</strong>に組み合わせ、
              現実にはあり得ない不思議な題名をつくる。
            </p>
            <p className="text-xs text-amber-600 mb-4">タップで題名欄に追加されます</p>

            <div className="bg-white rounded-2xl p-4 shadow-sm mb-3">
              <p className="text-xs text-gray-500 mb-2 font-medium">② 連想語</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {validAssoc.map((w, i) => (
                  <button
                    key={i}
                    onClick={() => setTitlePreview((p) => p ? p + w : w)}
                    className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-xl text-sm hover:bg-blue-100 transition-colors"
                  >
                    {w}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mb-2 font-medium">① 名前</p>
              <div className="flex flex-wrap gap-2">
                {validNames.map((w, i) => (
                  <button
                    key={i}
                    onClick={() => setTitlePreview((p) => p ? p + w : w)}
                    className="bg-green-50 border border-green-200 text-green-800 px-3 py-1.5 rounded-xl text-sm hover:bg-green-100 transition-colors"
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
              <p className="text-xs text-gray-400 mb-1">題名（直接編集もOK）</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={titlePreview}
                  onChange={(e) => setTitlePreview(e.target.value)}
                  className="flex-1 border-2 border-amber-300 rounded-xl px-3 py-2 text-base font-bold text-amber-900 focus:outline-none focus:border-amber-500"
                  placeholder="例：縞模様の東京"
                  maxLength={40}
                />
                <button
                  onClick={() => setTitlePreview("")}
                  className="text-gray-400 px-2 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setStep(2)}
                className="flex-1 border-2 border-gray-200 text-gray-500 py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                ← 戻る
              </button>
              <button
                onClick={handlePropose}
                disabled={loading || !titlePreview.trim()}
                className="flex-1 bg-amber-800 text-white py-3 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "..." : "提案する！"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Selecting Phase (ホストが題名を選ぶ) ----
function SelectingPhase({
  room,
  playerId,
  code,
}: {
  room: ClientRoom;
  playerId: string;
  code: string;
}) {
  const isHost = room.players[0]?.id === playerId;
  const [loading, setLoading] = useState(false);

  async function handleSelect(title: string) {
    setLoading(true);
    try {
      await fetch(`/api/rooms/${code}/select-title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: playerId, title }),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-amber-50 p-4 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <h2 className="text-xl font-bold text-amber-900 text-center mb-1">
          みんなの題名案
        </h2>
        <p className="text-center text-amber-700 text-sm mb-5">
          {isHost ? "1つ選んでゲームをスタート！" : "ホストが題名を選んでいます..."}
        </p>
        <div className="space-y-3">
          {room.titleProposals.map((p) => (
            <div key={p.playerId} className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">{p.playerName}</p>
              <p className="text-lg font-bold text-amber-900 mb-2">{p.title}</p>
              {isHost && (
                <button
                  onClick={() => handleSelect(p.title)}
                  disabled={loading}
                  className="w-full bg-amber-800 text-white py-2 rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  この題名でスタート！
                </button>
              )}
            </div>
          ))}
        </div>
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
    secondsLeft !== null && secondsLeft <= 30 ? "text-red-500" : "text-amber-700";
  const progressPct = Math.round((room.currentPageIndex / room.totalPages) * 100);

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col p-4">
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
        <div className="bg-amber-100 border border-amber-300 rounded-2xl p-4">
          <p className="text-xs text-amber-600 mb-1 font-medium">題名</p>
          <p className="text-xl font-bold text-amber-900">{room.title}</p>
        </div>

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
            <p className="text-sm text-gray-400">書き終わったらあなたの番がきます</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Reading Phase ----
function ReadingPhase({ room }: { room: ClientRoom }) {
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cancelRef = useRef(false);

  const script = [
    { text: `題名。${room.title}` },
    ...room.pages.map((p, i) => ({
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
                <span className="text-xs font-medium text-amber-600">{i + 1}ページ目</span>
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
  if (room.status === "worksheeting") {
    return <WorksheetPhase room={room} playerId={playerId} code={code} />;
  }
  if (room.status === "selecting") {
    return <SelectingPhase room={room} playerId={playerId} code={code} />;
  }
  if (room.status === "writing") {
    return <WritingPhase room={room} playerId={playerId} code={code} />;
  }
  return <ReadingPhase room={room} />;
}
