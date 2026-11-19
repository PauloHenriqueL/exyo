import { motion } from "framer-motion";
import type { Room } from "colyseus.js";
import { HOUSES } from "../../shared/content";
import type { ClientView } from "../../shared/types";
import { play } from "../audio";
import { Crest } from "../components/Crest";
import { GoalText } from "../components/GoalText";
import { ResourceBoard } from "../components/ResourceBoard";
import { useCountdown } from "../useCountdown";

/** Intervalo entre partidas: pontos (sem revelar objetivos), o Reino herdado e o novo objetivo secreto. */
export function Intermission({ view, room }: { view: ClientView; room: Room }) {
  const info = view.intermission!;
  const timer = useCountdown(view.deadline);
  const me = view.players.find((p) => p.id === view.me.id);
  const humans = view.players.filter((p) => !p.isBot);
  const readyCount = humans.filter((p) => p.isReady).length;
  const sorted = [...info.scores].sort((a, b) => b.total - a.total);

  return (
    <main className="page intermission">
      <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="kicker">
          Fim da Partida {info.finishedMatch} de {view.totalMatches}
        </p>
        <h1>O Reino segue</h1>
        <p className="lead">Os recursos, as Fichas de Favor e tudo o que foi decidido continuam. Só os objetivos mudam.</p>
      </motion.header>

      <div className="final-grid">
        <section>
          <h2>Placar parcial</h2>
          {sorted.map((s, i) => {
            const p = view.players.find((x) => x.id === s.playerId);
            const h = HOUSES.houses.find((x) => x.id === p?.houseId);
            return (
              <motion.div
                key={s.playerId}
                className={`panel score ${s.playerId === view.me.id ? "mine" : ""}`}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + 0.25 * i }}
              >
                {h && <Crest house={h} size={40} />}
                <div>
                  <strong>
                    {p?.name} {p?.isBot && "🤖"}
                  </strong>
                  <p className="muted">{h?.name}</p>
                </div>
                <span className="points">
                  {s.points}/5
                  <small> nesta partida</small>
                </span>
              </motion.div>
            );
          })}
          <p className="hint on-dark">Os objetivos de cada Casa só serão revelados no placar final.</p>
        </section>

        <aside className="side">
          {view.me.goal && (
            <motion.div
              className="panel goal new-goal"
              initial={{ rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ delay: 0.9, type: "spring", stiffness: 120, damping: 14 }}
            >
              <h2>Seu novo objetivo secreto</h2>
              <GoalText goal={view.me.goal} ranges={view.ranges} />
            </motion.div>
          )}
          <ResourceBoard resources={view.resources} />
          {me && (
            <div className="panel ready">
              <button
                className="btn primary"
                disabled={me.isReady}
                onClick={() => {
                  play("confirm");
                  room.send("ready");
                }}
              >
                {me.isReady ? "Aguardando os outros…" : `Começar a Partida ${view.match}`}
              </button>
              <p className="muted">
                {readyCount}/{humans.length} prontos · começa sozinho em {timer}
              </p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
