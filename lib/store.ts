export interface Player {
  id: string;
  name: string;
}

export interface Page {
  playerId: string;
  playerName: string;
  content: string;
  pageNumber: number;
}

export interface WordSubmission {
  playerId: string;
  playerName: string;
  words: string[];
}

export type RoomStatus =
  | "waiting"
  | "naming"       // ① 名前を10個集める
  | "associating"  // ② 選ばれた名前から連想5つ
  | "titling"      // ③ ホストが組み合わせて題名を決める
  | "writing"
  | "reading";

export interface Room {
  code: string;
  hostId: string;
  status: RoomStatus;
  title: string;
  players: Player[];
  pages: Page[];
  totalPages: number;
  currentPageIndex: number;
  pageStartTime: number | null;
  timerDuration: number;
  // Title creation
  nameSubmissions: WordSubmission[];   // ① 全員の名前リスト
  selectedNameWord: string | null;     // ホストが選んだ名前
  assocSubmissions: WordSubmission[];  // ② 全員の連想リスト
}

export interface ClientRoom {
  code: string;
  status: RoomStatus;
  title: string;
  players: Player[];
  totalPages: number;
  currentPageIndex: number;
  currentWriterId: string | null;
  pageStartTime: number | null;
  timerDuration: number;
  visiblePage: string | null;
  pages: Page[];
  // Title creation (visible to all)
  nameSubmissions: WordSubmission[];
  selectedNameWord: string | null;
  assocSubmissions: WordSubmission[];
  hasSubmittedNames: boolean;
  hasSubmittedAssoc: boolean;
}

const rooms = new Map<string, Room>();
const sseClients = new Map<string, Set<(data: string) => void>>();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createRoom(hostId: string): Room {
  let code = generateCode();
  while (rooms.has(code)) {
    code = generateCode();
  }
  const room: Room = {
    code,
    hostId,
    status: "waiting",
    title: "",
    players: [],
    pages: [],
    totalPages: 8,
    currentPageIndex: 0,
    pageStartTime: null,
    timerDuration: 120,
    nameSubmissions: [],
    selectedNameWord: null,
    assocSubmissions: [],
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function joinRoom(
  code: string,
  playerId: string,
  playerName: string
): Room | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;
  if (room.status !== "waiting") return null;
  if (room.players.length >= 8) return null;
  if (room.players.find((p) => p.id === playerId)) return room;
  room.players.push({ id: playerId, name: playerName });
  notifyRoom(code);
  return room;
}

// ホストが題名ワークシートフェーズを開始
export function startNaming(code: string, hostId: string): Room | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;
  if (room.hostId !== hostId) return null;
  if (room.status !== "waiting") return null;
  if (room.players.length < 3) return null;
  room.status = "naming";
  room.nameSubmissions = [];
  notifyRoom(code);
  return room;
}

// 各プレイヤーが名前を10個提出
export function submitNames(
  code: string,
  playerId: string,
  words: string[]
): Room | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;
  if (room.status !== "naming") return null;
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;
  // 既提出なら上書き
  const existing = room.nameSubmissions.findIndex((s) => s.playerId === playerId);
  const submission: WordSubmission = { playerId, playerName: player.name, words };
  if (existing >= 0) room.nameSubmissions[existing] = submission;
  else room.nameSubmissions.push(submission);
  notifyRoom(code);
  return room;
}

// ホストが1つの名前を選んで連想フェーズへ
export function selectNameWord(
  code: string,
  hostId: string,
  word: string
): Room | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;
  if (room.hostId !== hostId) return null;
  if (room.status !== "naming") return null;
  room.selectedNameWord = word;
  room.status = "associating";
  room.assocSubmissions = [];
  notifyRoom(code);
  return room;
}

// 各プレイヤーが連想を5つ提出
export function submitAssociations(
  code: string,
  playerId: string,
  words: string[]
): Room | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;
  if (room.status !== "associating") return null;
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;
  const existing = room.assocSubmissions.findIndex((s) => s.playerId === playerId);
  const submission: WordSubmission = { playerId, playerName: player.name, words };
  if (existing >= 0) room.assocSubmissions[existing] = submission;
  else room.assocSubmissions.push(submission);
  notifyRoom(code);
  return room;
}

// ホストが組み合わせて題名を確定 → writingフェーズへ
export function setTitle(
  code: string,
  hostId: string,
  title: string
): Room | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;
  if (room.hostId !== hostId) return null;
  if (room.status !== "associating" && room.status !== "titling") return null;
  if (!title.trim()) return null;
  room.title = title.trim();
  room.status = "writing";
  room.currentPageIndex = 0;
  room.pageStartTime = Date.now();
  notifyRoom(code);
  return room;
}

export function submitPage(
  code: string,
  playerId: string,
  content: string
): Room | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;
  if (room.status !== "writing") return null;

  const currentWriterId = getCurrentWriterId(room);
  if (currentWriterId !== playerId) return null;

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;

  room.pages.push({
    playerId,
    playerName: player.name,
    content: content.trim(),
    pageNumber: room.currentPageIndex,
  });

  room.currentPageIndex++;

  if (room.currentPageIndex >= room.totalPages) {
    room.status = "reading";
    room.pageStartTime = null;
  } else {
    room.pageStartTime = Date.now();
  }

  notifyRoom(code);
  return room;
}

export function getCurrentWriterId(room: Room): string | null {
  if (room.status !== "writing") return null;
  if (room.players.length === 0) return null;
  return room.players[room.currentPageIndex % room.players.length].id;
}

export function toClientRoom(room: Room, playerId: string): ClientRoom {
  const currentWriterId = getCurrentWriterId(room);
  let visiblePage: string | null = null;

  if (room.status === "writing" && room.currentPageIndex > 0) {
    if (playerId === currentWriterId) {
      visiblePage = room.pages[room.currentPageIndex - 1].content;
    }
  }

  return {
    code: room.code,
    status: room.status,
    title: room.title,
    players: room.players,
    totalPages: room.totalPages,
    currentPageIndex: room.currentPageIndex,
    currentWriterId,
    pageStartTime: room.pageStartTime,
    timerDuration: room.timerDuration,
    visiblePage,
    pages: room.status === "reading" ? room.pages : [],
    nameSubmissions: room.nameSubmissions,
    selectedNameWord: room.selectedNameWord,
    assocSubmissions: room.assocSubmissions,
    hasSubmittedNames: room.nameSubmissions.some((s) => s.playerId === playerId),
    hasSubmittedAssoc: room.assocSubmissions.some((s) => s.playerId === playerId),
  };
}

export function subscribeRoom(
  code: string,
  callback: (data: string) => void
): () => void {
  const key = code.toUpperCase();
  if (!sseClients.has(key)) {
    sseClients.set(key, new Set());
  }
  sseClients.get(key)!.add(callback);
  return () => {
    sseClients.get(key)?.delete(callback);
  };
}

function notifyRoom(code: string) {
  const key = code.toUpperCase();
  const clients = sseClients.get(key);
  if (!clients) return;
  clients.forEach((cb) => cb("update"));
}
