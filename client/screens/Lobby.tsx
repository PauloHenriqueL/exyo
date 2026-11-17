import { useState } from "react";
import type { Room } from "colyseus.js";
import { HOUSES } from "../../shared/content";
import type { ClientView } from "../../shared/types";
import { Crest } from "../components/Crest";

export function Lobby({ view, room }: { view: ClientView; room: Room }) {
  const [copied, setCopied] = useState(false);
  const link = location.href;
  const myHouse = view.players.find((p) => p.id === view.me.id)?.houseId;
  const ready = view.players.length >= view.minHumans && view.players.every((p) => p.houseId);
  const bots = Math.max(0, view.minPlayers - view.players.length);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sem permissão de clipboard */
    }
  };

  return (
    <main className="page">
      <header className="lobby-head">
        <h1>Sala {view.roomCode}</h1>
        <button className="btn" onClick={copy}>
          {copied ? "Link copiado!" : "Copiar link da sala"}
        </button>
      </header>

      <section className="panel">
        <h2>
          Conselheiros ({view.players.length}/{view.maxPlayers})
        </h2>
        <ul className="seats">
          {view.players.map((p) => {
            const h = HOUSES.houses.find((x) => x.id === p.houseId);
            return (
              <li key={p.id} className={p.id === view.me.id ? "me" : ""}>
                <span>{p.name}</span>
                <span className="muted">{h ? h.name : "escolhendo Casa…"}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2>Escolha sua Casa</h2>
        <div className="houses">
          {HOUSES.houses.map((h) => {
            const owner = view.players.find((p) => p.houseId === h.id);
            const mine = h.id === myHouse;
            return (
              <button
                key={h.id}
                className={`house ${mine ? "mine" : ""}`}
                disabled={!!owner && !mine}
                onClick={() => room.send("pickHouse", { houseId: h.id })}
                style={{ borderColor: h.colors.primary }}
              >
                <Crest house={h} />
                <strong>{h.name}</strong>
                <span className="muted">{h.epithet}</span>
                <em>“{h.motto}”</em>
                {owner && <span className="owner">{mine ? "Sua Casa" : owner.name}</span>}
              </button>
            );
          })}
        </div>
        <div className="start-row">
          <button className="btn primary" disabled={!ready} onClick={() => room.send("start")}>
            Iniciar partida{bots ? ` (+${bots} bot)` : ` com ${view.players.length} conselheiros`}
          </button>
          <p className="muted">
            {ready
              ? bots
                ? `Com ${view.players.length} conselheiros, um bot ocupa uma Casa livre e vota sozinho. Com ${view.minPlayers} ou mais, não entra bot.`
                : `Com ${view.maxPlayers} conselheiros a partida começa sozinha. Seu objetivo secreto é sorteado no início.`
              : `Mínimo de ${view.minHumans} conselheiros, todos com Casa escolhida.`}
          </p>
        </div>
      </section>
    </main>
  );
}
