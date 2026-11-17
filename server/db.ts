import Database from "better-sqlite3";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR ?? path.resolve("data");
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, "game.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    phone_hash TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    room_code TEXT NOT NULL,
    seed INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    result_json TEXT
  );
  CREATE TABLE IF NOT EXISTS match_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT NOT NULL,
    at INTEGER NOT NULL,
    type TEXT NOT NULL,
    data_json TEXT NOT NULL
  );
`);

const PEPPER = process.env.PHONE_PEPPER ?? "dev-pepper-troque-em-producao";

export interface PlayerRow {
  id: string;
  name: string;
  token: string;
}

/** Mantém só dígitos; exige 10 a 13 dígitos (com ou sem DDI). */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  return digits.length <= 11 ? `55${digits}` : digits;
}

export function login(name: string, rawPhone: string): PlayerRow | null {
  const phone = normalizePhone(rawPhone);
  const cleanName = name.trim().slice(0, 24);
  if (!phone || !cleanName) return null;
  const phoneHash = createHash("sha256").update(phone + PEPPER).digest("hex");
  const existing = db.prepare("SELECT id, name, token FROM players WHERE phone_hash = ?").get(phoneHash) as PlayerRow | undefined;
  if (existing) {
    if (existing.name !== cleanName) db.prepare("UPDATE players SET name = ? WHERE id = ?").run(cleanName, existing.id);
    return { ...existing, name: cleanName };
  }
  const row: PlayerRow = { id: randomBytes(8).toString("hex"), name: cleanName, token: randomBytes(32).toString("hex") };
  db.prepare("INSERT INTO players (id, phone_hash, name, token, created_at) VALUES (?, ?, ?, ?, ?)").run(
    row.id, phoneHash, row.name, row.token, Date.now(),
  );
  return row;
}

export function playerByToken(token: string): PlayerRow | null {
  return (db.prepare("SELECT id, name, token FROM players WHERE token = ?").get(token) as PlayerRow | undefined) ?? null;
}

export function startMatch(id: string, roomCode: string, seed: number) {
  db.prepare("INSERT INTO matches (id, room_code, seed, started_at) VALUES (?, ?, ?, ?)").run(id, roomCode, seed, Date.now());
}

export function endMatch(id: string, result: unknown) {
  db.prepare("UPDATE matches SET ended_at = ?, result_json = ? WHERE id = ?").run(Date.now(), JSON.stringify(result), id);
}

export function logEvent(matchId: string, type: string, data: unknown) {
  db.prepare("INSERT INTO match_events (match_id, at, type, data_json) VALUES (?, ?, ?, ?)").run(
    matchId, Date.now(), type, JSON.stringify(data),
  );
}
