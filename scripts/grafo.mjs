// Editor de cartas em grafo: abre http://localhost:5180 e salva direto em content/dilemmas.json.
// Uso: npm run grafo   (PORTA=5181 npm run grafo para trocar a porta)
// Sem dependências: um servidor HTTP do Node que entrega ferramentas/grafo.html e lê/grava o arquivo de cartas.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { formatDilemmas } from "./formatDilemmas.mjs";

const root = new URL("../", import.meta.url);
const CARDS = new URL("content/dilemmas.json", root);
const HOUSES = new URL("content/houses.json", root);
const PAGE = new URL("ferramentas/grafo.html", root);
const BACKUPS = new URL("data/backup-cartas/", root);
const PORT = Number(process.env.PORTA ?? 5180);

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

/** Checagem mínima antes de gravar; as regras completas ficam no próprio editor e no `npm test`. */
function checkShape(file) {
  if (!file || !Array.isArray(file.dilemmas)) return "o arquivo precisa ter a lista `dilemmas`";
  const ids = new Set();
  for (const c of file.dilemmas) {
    if (!c.id || typeof c.id !== "string") return "carta sem id";
    if (ids.has(c.id)) return `id repetido: ${c.id}`;
    ids.add(c.id);
    for (const o of ["yes", "no", "tie"]) {
      if (!Array.isArray(c.outcomes?.[o]) || !c.outcomes[o].length) return `${c.id}: falta o desfecho ${o}`;
    }
  }
  return null;
}

createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    return send(res, 200, readFileSync(PAGE), "text/html; charset=utf-8");
  }
  if (req.method === "GET" && url.pathname === "/api/cartas") return send(res, 200, readFileSync(CARDS));
  if (req.method === "GET" && url.pathname === "/api/casas") return send(res, 200, readFileSync(HOUSES));
  if (req.method === "PUT" && url.pathname === "/api/cartas") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const file = JSON.parse(body);
        const problem = checkShape(file);
        if (problem) return send(res, 400, JSON.stringify({ ok: false, error: problem }));
        // Guarda a versão anterior antes de sobrescrever (data/ não vai para o git).
        mkdirSync(BACKUPS, { recursive: true });
        copyFileSync(CARDS, new URL(`dilemmas-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, BACKUPS));
        writeFileSync(CARDS, formatDilemmas(file));
        send(res, 200, JSON.stringify({ ok: true, cards: file.dilemmas.length }));
      } catch (e) {
        send(res, 400, JSON.stringify({ ok: false, error: String(e.message ?? e) }));
      }
    });
    return;
  }
  send(res, 404, JSON.stringify({ ok: false, error: "não encontrado" }));
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Editor de cartas em http://localhost:${PORT}  (salva em content/dilemmas.json; Ctrl+C para sair)`);
});
