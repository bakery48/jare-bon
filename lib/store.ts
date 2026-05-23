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

export interface TitleProposal {
  playerId: string;
  playerName: string;
  title: string;
}

export type RoomStatus =
  | "waiting"
  | "worksheeting"  // 各自①②③を独立して行い題名案を提出
  | "selecting"     // ホストが題名案を1つ選ぶ
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
  titleProposals: TitleProposal[];
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
  titleProposals: TitleProposal[];
  hasSubmittedTitle: boolean;
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
    titleProposals: [],
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

// ホストがワークシートフェーズを開始
export function startWorksheet(code: string, hostId: string): Room | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;
  if (room.hostId !== hostId) return null;
  if (room.status !== "waiting") return null;
  if (room.players.length < 3) return null;
  room.status = "worksheeting";
  room.titleProposals = [];
  notifyRoom(code);
  return room;
}

// 各プレイヤーが①②③を終えて題名案を提出
export function proposeTitleByPlayer(
  code: string,
  playerId: string,
  title: string
): Room | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;
  if (room.status !== "worksheeting") return null;
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;
  // 既提出なら上書き
  const existing = room.titleProposals.findIndex((p) => p.playerId === playerId);
  const proposal: TitleProposal = { playerId, playerName: player.name, title: title.trim() };
  if (existing >= 0) room.titleProposals[existing] = proposal;
  else room.titleProposals.push(proposal);
  // 全員提出したら選択フェーズへ
  if (room.titleProposals.length >= room.players.length) {
    room.status = "selecting";
  }
  notifyRoom(code);
  return room;
}

// ホストが題名案を1つ選んでゲーム開始
export function selectTitle(
  code: string,
  hostId: string,
  title: string
): Room | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;
  if (room.hostId !== hostId) return null;
  if (room.status !== "selecting") return null;
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
    titleProposals: room.titleProposals,
    hasSubmittedTitle: room.titleProposals.some((p) => p.playerId === playerId),
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
