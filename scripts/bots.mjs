// Uso: npm run dev (em outro terminal) e depois: node scripts/bots.mjs CODIGO_DA_SALA
// 3 bots que entram na sala, escolhem Casa e votam aleatoriamente.
import { Client } from "colyseus.js";
const code = process.argv[2]; const URL = process.env.SERVER_URL ?? "http://localhost:2567";
const houses = ["ferrobranco", "verdemar", "lumen"];
for (let i = 0; i < Number(process.env.BOTS ?? 3); i++) {
  const r = await fetch(URL + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Bot " + (i + 1), phone: "3199900000" + i }) });
  const { token } = await r.json();
  const room = await new Client(URL).joinOrCreate("kingdom", { roomCode: code, token });
  let picked = false, votedRound = -1;
  room.onMessage("view", (v) => {
    if (v.phase === "lobby" && !picked) { picked = true; room.send("pickHouse", { houseId: houses[i] }); }
    if ((v.phase === "prologue" || v.phase === "discussion" || v.phase === "intermission") && !v.players.find((p) => p.id === v.me.id)?.isReady) setTimeout(() => room.send("ready"), 1000);
    if (v.phase === "voting" && votedRound !== v.round) {
      votedRound = v.round; const c = ["yes", "no", "abstain"][Math.floor(Math.random() * 3)];
      const me = v.players.find((p) => p.id === v.me.id);
      setTimeout(() => room.send("vote", { choice: c, tokens: c === "abstain" ? 0 : Math.min(me.tokens, 1) }), 500 + i * 300);
    }
    if (v.phase === "end") { console.log("bot", i, "fim", JSON.stringify(v.final.scores.map(s => s.points))); process.exitCode = 0; }
  });
}
