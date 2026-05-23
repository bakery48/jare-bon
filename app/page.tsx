"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

function generatePlayerId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getOrCreatePlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("jarebon_player_id");
  if (!id) {
    id = generatePlayerId();
    sessionStorage.setItem("jarebon_player_id", id);
  }
  return id;
}

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [hostName, setHostName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getOrCreatePlayerId();
  }, []);

  async function handleCreate() {
    if (!hostName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const playerId = getOrCreatePlayerId();
      sessionStorage.setItem("jarebon_player_name", hostName.trim());

      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await fetch(`/api/rooms/${data.code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, playerName: hostName.trim() }),
      });

      router.push(`/room/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!joinCode.trim() || !joinName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const playerId = getOrCreatePlayerId();
      sessionStorage.setItem("jarebon_player_name", joinName.trim());

      const res = await fetch(`/api/rooms/${joinCode.toUpperCase()}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, playerName: joinName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.push(`/room/${joinCode.toUpperCase()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-amber-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-5xl font-bold text-center mb-2 text-amber-900">
          じゃれ本
        </h1>
        <p className="text-center text-amber-700 mb-8 text-sm">
          みんなでつくる、不思議なリレー小説
        </p>

        {mode === "menu" && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setMode("create")}
              className="bg-amber-800 text-white py-4 rounded-2xl text-lg font-semibold hover:bg-amber-700 transition-colors"
            >
              部屋をつくる
            </button>
            <button
              onClick={() => setMode("join")}
              className="bg-white border-2 border-amber-800 text-amber-800 py-4 rounded-2xl text-lg font-semibold hover:bg-amber-50 transition-colors"
            >
              部屋に入る
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-amber-900 mb-4">部屋をつくる</h2>
            <label className="block text-sm text-amber-700 mb-1">あなたの名前</label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-amber-500 mb-4"
              placeholder="名前を入力"
              maxLength={20}
              autoFocus
            />
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setMode("menu"); setError(""); }}
                className="flex-1 border-2 border-gray-200 text-gray-500 py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                戻る
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || !hostName.trim()}
                className="flex-1 bg-amber-800 text-white py-3 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "..." : "つくる"}
              </button>
            </div>
          </div>
        )}

        {mode === "join" && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-amber-900 mb-4">部屋に入る</h2>
            <label className="block text-sm text-amber-700 mb-1">ルームコード</label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 text-2xl text-center tracking-widest font-mono focus:outline-none focus:border-amber-500 mb-3"
              placeholder="XXXX"
              maxLength={4}
              autoFocus
            />
            <label className="block text-sm text-amber-700 mb-1">あなたの名前</label>
            <input
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-amber-500 mb-4"
              placeholder="名前を入力"
              maxLength={20}
            />
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setMode("menu"); setError(""); }}
                className="flex-1 border-2 border-gray-200 text-gray-500 py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                戻る
              </button>
              <button
                onClick={handleJoin}
                disabled={loading || !joinCode.trim() || !joinName.trim()}
                className="flex-1 bg-amber-800 text-white py-3 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "..." : "入る"}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-amber-600 text-xs mt-6">
          3〜8人 ／ 30〜45分 ／ 10歳〜
        </p>
      </div>
    </main>
  );
}
