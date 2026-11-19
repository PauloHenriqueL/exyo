import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Room } from "colyseus.js";
import { HOUSES } from "../../shared/content";
import { RESOURCE_LABEL, type Choice, type ClientView } from "../../shared/types";
import { play } from "../audio";
import { Crest } from "../components/Crest";
import { Chatter, SwordClash } from "../components/Effects";
import { GoalText } from "../components/GoalText";
import { ResourceBoard } from "../components/ResourceBoard";
import { sendVote } from "../net";
import { useCountdown } from "../useCountdown";

const CATEGORY: Record<string, { label: string; icon: string; color: string }> = {
  war: { label: "Guerra", icon: "⚔", color: "#9e1b1b" },
  feast: { label: "Banquete", icon: "🍷", color: "#b07a1f" },
  plague: { label: "Peste", icon: "☠", color: "#4f6b3a" },
  diplomacy: { label: "Diplomacia", icon: "📜", color: "#3d6fa8" },
  trade: { label: "Comércio", icon: "🪙", color: "#c9a227" },
  faith: { label: "Fé", icon: "✝", color: "#7a6aa8" },
  crime: { label: "Intriga", icon: "🗡", color: "#4b2c5e" },
  nature: { label: "Natureza", icon: "🌩", color: "#6b4a2b" },
};

const CHOICE_LABEL: Record<Choice, string> = { yes: "SIM", no: "NÃO", abstain: "ABSTER" };
const OUTCOME_LABEL = { yes: "O conselho disse SIM", no: "O conselho disse NÃO", tie: "Indecisão do Conselho" };

export function Table({ view, room }: { view: ClientView; room: Room }) {
  const timer = useCountdown(view.deadline);
  const me = view.players.find((p) => p.id === view.me.id);
  const cat = view.card ? CATEGORY[view.card.category] : null;
  const war = view.card?.category === "war";
  // Espadas cruzam quando uma carta de Guerra entra na mesa e de novo na revelação.
  const clashKey = war && (view.phase === "discussion" || view.phase === "reveal") ? `${view.match}-${view.round}-${view.phase}` : null;

  return (
    <main className="table">
      <header className="table-head">
        <span>
          {view.totalMatches > 1 && (
            <>
              Partida <strong>{view.match}</strong>/{view.totalMatches} ·{" "}
            </>
          )}
          Rodada <strong>{view.round}</strong>/{view.totalRounds}
        </span>
        <span className="phase">
          {view.phase === "discussion" && "Discussão"}
          {view.phase === "voting" && "Votação"}
          {view.phase === "reveal" && "Revelação"}
        </span>
        <span className="timer" aria-live="polite">
          {timer}
        </span>
      </header>

      <div className="table-grid">
        <section className="card-area">
          <SwordClash trigger={clashKey} />
          <AnimatePresence mode="wait">
            {view.card && cat && (
              <motion.article
                key={`${view.card.id}-${view.match}-${view.round}`}
                className="card"
                style={{ borderColor: cat.color }}
                initial={{ rotateY: 180, y: -120, opacity: 0, scale: 0.6 }}
                animate={{ rotateY: 0, y: 0, opacity: 1, scale: 1 }}
                exit={{ x: 300, opacity: 0, rotate: 8 }}
                transition={{ type: "spring", stiffness: 120, damping: 16 }}
              >
                <span className="cat" style={{ background: cat.color }}>
                  {cat.icon} {cat.label}
                </span>
                <h2>{view.card.title}</h2>
                <p>{view.card.prompt}</p>
                <p className="question">{view.card.question}</p>
              </motion.article>
            )}
          </AnimatePresence>

          {view.phase === "discussion" && me && <ReadyPanel view={view} room={room} />}
          {view.phase === "voting" && me && <VotePanel view={view} room={room} tokens={me.tokens} />}
          {view.phase === "reveal" && view.reveal && <RevealPanel view={view} />}
        </section>

        <aside className="side">
          <ResourceBoard resources={view.resources} deltas={view.phase === "reveal" ? view.reveal?.deltas : null} />
          <Players view={view} />
          <GoalPanel view={view} />
        </aside>
      </div>
    </main>
  );
}

function ReadyPanel({ view, room }: { view: ClientView; room: Room }) {
  const me = view.players.find((p) => p.id === view.me.id)!;
  const humans = view.players.filter((p) => !p.isBot);
  const readyCount = humans.filter((p) => p.isReady).length;
  return (
    <div className="panel ready">
      <p className="muted">Debatam na chamada. Quando todos clicarem, a votação abre na hora — ou quando o tempo acabar.</p>
      <button
        className="btn primary"
        disabled={me.isReady}
        onClick={() => {
          play("confirm");
          room.send("ready");
        }}
      >
        {me.isReady ? "Aguardando os outros…" : "Pronto para votar"}
      </button>
      <p className="muted">
        {readyCount}/{humans.length} prontos
      </p>
    </div>
  );
}

function VotePanel({ view, room, tokens }: { view: ClientView; room: Room; tokens: number }) {
  const [choice, setChoice] = useState<Choice | null>(view.me.vote?.choice ?? null);
  const [spend, setSpend] = useState(view.me.vote?.tokens ?? 0);
  const voted = view.me.vote;
  const votedCount = view.players.filter((p) => p.hasVoted).length;

  const submit = () => {
    if (!choice) return;
    play("seal");
    if (choice !== "abstain" && spend > 0) play("coins", 150);
    sendVote(room, { choice, tokens: choice === "abstain" ? 0 : spend });
  };

  return (
    <div className="panel vote">
      <div className="choices" role="radiogroup" aria-label="Seu voto">
        {(["yes", "no", "abstain"] as Choice[]).map((c) => (
          <button key={c} role="radio" aria-checked={choice === c} className={`btn choice ${c} ${choice === c ? "on" : ""}`} onClick={() => setChoice(c)}>
            {CHOICE_LABEL[c]}
          </button>
        ))}
      </div>
      {choice && choice !== "abstain" && (
        <div className="stepper">
          <span>Fichas de Favor a gastar (você tem {tokens}):</span>
          <button className="btn small" onClick={() => setSpend(Math.max(0, spend - 1))} disabled={spend <= 0} aria-label="Menos fichas">
            −
          </button>
          <strong>{spend}</strong>
          <button className="btn small" onClick={() => setSpend(Math.min(tokens, spend + 1))} disabled={spend >= tokens} aria-label="Mais fichas">
            +
          </button>
          <span className="muted">peso do voto: {1 + spend}</span>
        </div>
      )}
      {choice === "abstain" && <p className="muted">Abster-se rende +1 Ficha de Favor.</p>}
      <button className="btn primary" disabled={!choice} onClick={submit}>
        {voted ? "Alterar voto" : "Selar voto"}
      </button>
      <p className="muted">
        {voted ? `Voto selado: ${CHOICE_LABEL[voted.choice]}${voted.tokens ? ` (+${voted.tokens} fichas)` : ""}. ` : ""}
        {votedCount}/{view.players.length} votaram.
      </p>
    </div>
  );
}

function RevealPanel({ view }: { view: ClientView }) {
  const r = view.reveal!;
  return (
    <div className="panel reveal">
      <div className="seals">
        {view.players.map((p, i) => {
          const v = r.votes[p.id];
          return (
            <motion.div
              key={p.id}
              className={`seal ${v?.choice}`}
              initial={{ rotateY: 180, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ delay: i * 0.4 }}
            >
              <span>{p.name}</span>
              <strong>{v ? CHOICE_LABEL[v.choice] : "—"}</strong>
              {v?.tokens ? <small>+{v.tokens} fichas</small> : null}
            </motion.div>
          );
        })}
      </div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: view.players.length * 0.4 + 0.2 }}>
        <h3>
          {OUTCOME_LABEL[r.outcome]} <span className="muted">(SIM {r.yesWeight} × NÃO {r.noWeight})</span>
        </h3>
        <p className="narrative">{r.text}</p>
        <p className="deltas">
          {Object.entries(r.deltas).map(([k, d]) => (
            <span key={k} className={d! > 0 ? "up" : "down"}>
              {RESOURCE_LABEL[k as keyof typeof RESOURCE_LABEL]} {d! > 0 ? `+${d}` : d}
            </span>
          ))}
        </p>
      </motion.div>
    </div>
  );
}

function Players({ view }: { view: ClientView }) {
  return (
    <ul className="players">
      {view.players.map((p) => {
        const h = HOUSES.houses.find((x) => x.id === p.houseId)!;
        return (
          <li key={p.id} className={`${p.connected ? "" : "off"} ${p.id === view.me.id ? "me" : ""}`}>
            <Crest house={h} size={28} />
            <span className="name-slot">
              {p.name}
              {p.isBot && " 🤖"}
              {!p.connected && " (desconectado)"}
              <Chatter active={view.phase === "discussion" && p.id !== view.me.id} motto={h.motto} />
            </span>
            <span title="Fichas de Favor">🎖 {p.tokens}</span>
            {view.phase === "voting" && <span>{p.hasVoted ? "✔" : "…"}</span>}
            {view.phase === "discussion" && <span title="Pronto para votar">{p.isReady ? "✔" : "…"}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function GoalPanel({ view }: { view: ClientView }) {
  const g = view.me.goal;
  if (!g) return null;
  return (
    <details className="panel goal">
      <summary>
        Seu objetivo secreto{view.totalMatches > 1 && ` · Partida ${view.match}`}
      </summary>
      <GoalText goal={g} ranges={view.ranges} />
    </details>
  );
}
