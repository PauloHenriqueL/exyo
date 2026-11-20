import { Client, type Room } from "colyseus.js";
import type { ClientView, Vote } from "../shared/types";

export const SERVER_URL = import.meta.env.DEV ? `http://${location.hostname}:2567` : location.origin;

export interface Session {
  id: string;
  name: string;
  token: string;
}

const KEY = "conselho.session";

export function loadSession(): Session | null {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

export function saveSession(s: Session | null) {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* sem storage: segue sem persistir */
  }
}

export async function login(name: string, phone: string): Promise<Session> {
  const res = await fetch(`${SERVER_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, phone }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Falha no login");
  return data;
}

export function roomCodeFromUrl(): string | null {
  const m = location.pathname.match(/^\/sala\/([A-Za-z0-9]{3,8})/);
  return m ? m[1].toUpperCase() : null;
}

export function newRoomCode(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => abc[Math.floor(Math.random() * abc.length)]).join("");
}

const client = new Client(SERVER_URL);

export interface ChatMessage {
  playerId: string;
  text: string;
  at: number;
}

export async function joinRoom(
  roomCode: string,
  token: string,
  onView: (v: ClientView) => void,
  onChat: (m: ChatMessage) => void,
): Promise<Room> {
  const room = await client.joinOrCreate("kingdom", { roomCode, token });
  room.onMessage("view", onView);
  room.onMessage("chat", onChat);
  return room;
}

export function sendVote(room: Room, vote: Vote) {
  room.send("vote", vote);
}
