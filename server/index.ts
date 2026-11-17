import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { KingdomRoom } from "./KingdomRoom";
import { login } from "./db";

const PORT = Number(process.env.PORT ?? 2567);
const app = express();
app.use(express.json());

// Em dev o front roda no Vite (outra porta).
app.use("/api", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.post("/api/login", (req, res) => {
  const player = login(String(req.body?.name ?? ""), String(req.body?.phone ?? ""));
  if (!player) return res.status(400).json({ error: "Informe um nome e um telefone com DDD." });
  res.json({ id: player.id, name: player.name, token: player.token });
});

if (process.env.NODE_ENV === "production") {
  const dist = path.resolve("dist");
  app.use(express.static(dist));
  app.get(/^\/(?!api|matchmake).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const httpServer = createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
gameServer.define("kingdom", KingdomRoom).filterBy(["roomCode"]);

httpServer.listen(PORT, () => console.log(`Servidor em http://localhost:${PORT}`));
