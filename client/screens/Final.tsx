import { motion } from "framer-motion";
import { HOUSES } from "../../shared/content";
import { RESOURCE_LABEL, type ClientView } from "../../shared/types";
import { Crest } from "../components/Crest";
import { ResourceBoard } from "../components/ResourceBoard";

export function Final({ view }: { view: ClientView }) {
  const f = view.final!;
  const sorted = [...f.scores].sort((a, b) => b.points - a.points || b.tokens - a.tokens);
  return (
    <main className="page">
      <h1 className={f.collapsed ? "danger" : ""}>{f.collapsed ? "O Reino caiu. Todos perderam." : "Fim do reinado"}</h1>
      <div className="final-grid">
        <section>
          {sorted.map((s, i) => {
            const h = HOUSES.houses.find((x) => x.id === s.houseId)!;
            const p = view.players.find((x) => x.id === s.playerId);
            const win = f.winnerIds.includes(s.playerId);
            return (
              <motion.div
                key={s.playerId}
                className={`panel score ${win ? "winner" : ""}`}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 * i }}
              >
                <Crest house={h} size={48} />
                <div>
                  <strong>
                    {p?.name} — {h.name} {win && "👑"}
                  </strong>
                  <p className="muted">
                    Altos: {s.goal.high.map((r) => RESOURCE_LABEL[r]).join(", ")} · Moderados:{" "}
                    {s.goal.moderate.map((r) => RESOURCE_LABEL[r]).join(", ")}
                  </p>
                </div>
                <span className="points">
                  {s.points}/5 <small>🎖{s.tokens}</small>
                </span>
              </motion.div>
            );
          })}
          <button className="btn" onClick={() => (location.href = "/")}>
            Nova sala
          </button>
        </section>
        <ResourceBoard resources={view.resources} />
      </div>
    </main>
  );
}
