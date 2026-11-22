import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Room } from "colyseus.js";
import { HOUSES } from "../../shared/content";
import { RESOURCE_LABEL, type Choice, type ClientView, type PublicPlayer, type Resource } from "../../shared/types";
import { play } from "../audio";
import { ChatBox } from "../components/ChatBox";
import { Crest } from "../components/Crest";
import { HandCrown } from "../components/HandCrown";
import { Chatter } from "../components/Effects";
import { GoalBoard } from "../components/GoalBoard";
import { OutcomePreview } from "../components/OutcomePreview";
import { ResourceBoard } from "../components/ResourceBoard";
import { ChatText, ResourceIcon } from "../components/ResourceIcon";
import { sendVote, type ChatMessage } from "../net";
import { useCountdown } from "../useCountdown";

const CATEGORY: Record<string, { label: string; icon: string; color: string }> = {
  war: { label: "Guerra", icon: "⚔", color: "#9e1b1b" },
  feast: { label: "Banquete", icon: "🍷", color: "#b07a1f" },
  plague: { label: "Peste", icon: "☠", color: "#4f6b3a" },
  diplomacy: { label: "Diplomacia", icon: "📜", color: "#3d6fa8" },
  trade: { label: "Comércio", icon: "🪙", color: "#c9a227" },
  crime: { label: "Intriga", icon: "🗡", color: "#4b2c5e" },
  nature: { label: "Natureza", icon: "🌩", color: "#6b4a2b" },
  faith: { label: "Fé", icon: "🕯", color: "#7a6aa8" },
};

/** Obras em domínio público usadas como ilustração de cada categoria (ver CREDITOS.md). */
const ART_CAPTION: Record<string, string> = {
  war: "Paolo Uccello, A Batalha de San Romano (c. 1438)",
  feast: "Pieter Bruegel, o Velho, Casamento Camponês (1568)",
  plague: "Pieter Bruegel, o Velho, O Triunfo da Morte (c. 1562)",
  diplomacy: "Hans Holbein, o Jovem, Os Embaixadores (1533)",
  trade: "Quentin Matsys, O Cambista e sua Mulher (1514)",
  crime: "Caravaggio, Os Trapaceiros (c. 1595)",
  nature: "Pieter Bruegel, o Velho, Caçadores na Neve (1565)",
  faith: "Jan van Eyck, Adoração do Cordeiro Místico (c. 1432)",
};

const CHOICE_LABEL: Record<Choice, string> = { yes: "SIM", no: "NÃO", abstain: "ABSTER" };
const OUTCOME_LABEL = { yes: "O conselho disse SIM", no: "O conselho disse NÃO", tie: "Indecisão do Conselho" };

export function Table({ view, room, chat }: { view: ClientView; room: Room; chat: Record<string, ChatMessage> }) {
  useCountdown(null); // re-render periódico (balões do chat somem sozinhos)
  const me = view.players.find((p) => p.id === view.me.id);
  const card = view.card;
  const cat = card ? CATEGORY[card.category] : null;

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
          {view.phase === "reveal" && "Resultado"}
        </span>
      </header>

      <div className="table-grid">
        <section className="card-area">
          <AnimatePresence mode="wait">
            {card && cat && (
              <motion.article
                key={`${card.id}-${view.match}-${view.round}`}
                className="card"
                initial={{ rotateY: 180, y: -120, opacity: 0, scale: 0.6 }}
                animate={{ rotateY: 0, y: 0, opacity: 1, scale: 1 }}
                exit={{ x: 300, opacity: 0, rotate: 8 }}
                transition={{ type: "spring", stiffness: 120, damping: 16 }}
              >
                <div className="card-art">
                  <img src={`/art/cards/${card.category}.webp`} alt="" decoding="async" />
                  <small className="art-caption">{ART_CAPTION[card.category]}</small>
                </div>
                <div className="badges">
                  <span className="cat" style={{ background: cat.color }}>
                    {cat.icon} {cat.label}
                  </span>
                  {card.openVote && <span className="badge open">👁 Voto aberto</span>}
                </div>
                <h2>{card.title}</h2>
                <p className="prompt">{card.prompt}</p>
                <p className="question">{card.question}</p>
                {card.preview && <OutcomePreview preview={card.preview} />}
                {card.openVote && (
                  <p className="rule open-rule">
                    <strong>👁 Voto aberto:</strong> cada voto aparece para todos assim que é selado e não pode mais ser trocado.
                  </p>
                )}
              </motion.article>
            )}
          </AnimatePresence>

          {view.phase === "discussion" && me && <ReadyPanel view={view} room={room} />}
          {view.phase === "voting" && me && <VotePanel key={`${view.match}-${view.round}`} view={view} room={room} me={me} />}
          {view.phase === "reveal" && view.reveal && <RevealPanel view={view} />}
          {view.phase === "reveal" && view.reveal && me && <ContinuePanel view={view} room={room} />}
        </section>

        <aside className="side">
          <ResourceBoard resources={view.resources} deltas={view.phase === "reveal" ? view.reveal?.deltas : null} />
          <Players view={view} chat={chat} />
          <ChatBox room={room} />
          <GoalPanel view={view} />
        </aside>
      </div>
    </main>
  );
}

function ReadyPanel({ view, room }: { view: ClientView; room: Room }) {
  const me = view.players.find((p) => p.id === view.me.id)!;
  const humans = view.players.filter((p) => !p.isBot && p.connected);
  const readyCount = humans.filter((p) => p.isReady).length;
  return (
    <div className="panel ready">
      {me.isHand && <p className="hand-note">👑 Você é a Mão do Rei: leia a carta em voz alta e, num empate, seu voto decide.</p>}
      <p className="muted">Leiam a carta e o que acontece com SIM e com NÃO, e debatam na chamada, sem pressa. A votação abre quando todos clicarem.</p>
      <button
        className="btn primary"
        disabled={me.isReady}
        onClick={() => {
          play("seal");
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

function VotePanel({ view, room, me }: { view: ClientView; room: Room; me: PublicPlayer }) {
  const voted = view.me.vote;
  const [choice, setChoice] = useState<Choice | null>(voted?.choice ?? null);
  const [spend, setSpend] = useState(voted?.tokens || 1);
  const votedCount = view.players.filter((p) => p.hasVoted).length;
  const locked = !!(view.card?.openVote && voted); // voto aberto é definitivo
  const voting = choice === "yes" || choice === "no";
  const max = me.tokens;
  const broke = max <= 0; // sem pontos de influência: só dá para se abster
  const spendNow = Math.max(1, Math.min(spend, max));

  const submit = () => {
    if (!choice || locked) return;
    play("seal");
    if (choice !== "abstain") play("coins", 150);
    sendVote(room, { choice, tokens: choice === "abstain" ? 0 : spendNow });
  };

  return (
    <div className="panel vote">
      {me.isHand && <p className="hand-note">👑 Você é a Mão do Rei: num empate, seu voto decide.</p>}
      {view.card?.openVote && <p className="hand-note">👁 Voto aberto: seu voto aparece para todos assim que for selado, e não dá para trocar.</p>}
      <div className="choices" role="radiogroup" aria-label="Seu voto">
        {(["yes", "no", "abstain"] as Choice[]).map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={choice === c}
            disabled={locked || (broke && c !== "abstain")}
            className={`selo ${c} ${choice === c ? "on" : ""}`}
            onClick={() => setChoice(c)}
          >
            <span className="selo-cera" aria-hidden="true" />
            {me.houseId && <img className="selo-sinete" src={`/art/crests/${me.houseId}.webp`} alt="" aria-hidden="true" />}
            <span className="selo-txt">{CHOICE_LABEL[c]}</span>
          </button>
        ))}
      </div>
      {broke && !locked && <p className="hand-note">Você não tem pontos de influência: só pode se abster. Abster-se rende 1 ponto para votar depois.</p>}
      {voting && !locked && !broke && (
        <div className="stepper">
          <span>Pontos de influência a gastar (você tem {me.tokens}):</span>
          <button className="btn small" onClick={() => setSpend(Math.max(1, spendNow - 1))} disabled={spendNow <= 1} aria-label="Menos pontos">
            −
          </button>
          <strong>{spendNow}</strong>
          <button className="btn small" onClick={() => setSpend(Math.min(max, spendNow + 1))} disabled={spendNow >= max} aria-label="Mais pontos">
            +
          </button>
          <span className="muted">peso do voto: {spendNow}</span>
        </div>
      )}
      {choice === "abstain" && !locked && !broke && <p className="muted">Abster-se rende +1 ponto de influência.</p>}
      <button className="btn primary" disabled={!choice || locked || (broke && choice !== "abstain")} onClick={submit}>
        {locked ? "Voto selado" : voted ? "Alterar voto" : "Selar voto"}
      </button>
      <p className="muted">
        {voted ? `Voto selado: ${CHOICE_LABEL[voted.choice]}${voted.tokens ? ` (${voted.tokens} ${voted.tokens === 1 ? "ponto" : "pontos"})` : ""}. ` : ""}
        {votedCount}/{view.players.length} votaram.
      </p>
    </div>
  );
}

/** Depois do resultado, o jogo espera cada um ler e clicar em Continuar. */
function ContinuePanel({ view, room }: { view: ClientView; room: Room }) {
  const me = view.players.find((p) => p.id === view.me.id)!;
  const humans = view.players.filter((p) => !p.isBot && p.connected);
  const readyCount = humans.filter((p) => p.isReady).length;
  return (
    <div className="panel ready">
      <button
        className="btn primary"
        disabled={me.isReady}
        onClick={() => {
          play("cardPlace");
          room.send("ready");
        }}
      >
        {me.isReady ? "Aguardando os outros…" : "Li o resultado · Continuar"}
      </button>
      <p className="muted">
        {readyCount}/{humans.length} prontos para a próxima carta
      </p>
    </div>
  );
}

function RevealPanel({ view }: { view: ClientView }) {
  const r = view.reveal!;
  const after = view.players.length * 0.4 + 0.2;
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
              <span>
                {p.name}
                {p.isHand && " 👑"}
              </span>
              <strong>{v ? CHOICE_LABEL[v.choice] : "—"}</strong>
              {v?.tokens ? <small>{v.tokens} {v.tokens === 1 ? "ponto" : "pontos"}</small> : null}
            </motion.div>
          );
        })}
      </div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: after }}>
        <h3>
          {OUTCOME_LABEL[r.outcome]} <span className="muted">(SIM {r.yesWeight} × NÃO {r.noWeight})</span>
        </h3>
        {r.tiebreakByHand && <p className="event">⚖ Empate! Decidiu o voto da Mão do Rei.</p>}
        <p className="narrative">{r.text}</p>
        <p className="deltas">
          {Object.entries(r.deltas).map(([k, d]) => (
            <span key={k} className={d! > 0 ? "up" : "down"}>
              <ResourceIcon r={k as Resource} /> {RESOURCE_LABEL[k as Resource]} {d! > 0 ? `+${d}` : d}
            </span>
          ))}
          {Object.keys(r.deltas).length === 0 && <span className="muted">O Reino não mudou.</span>}
        </p>
      </motion.div>
    </div>
  );
}

const CHAT_SHOW_MS = 7000;

function Players({ view, chat }: { view: ClientView; chat: Record<string, ChatMessage> }) {
  const now = Date.now();
  return (
    <ul className="players">
      {view.players.map((p) => {
        const h = HOUSES.houses.find((x) => x.id === p.houseId)!;
        const ov = p.openVote;
        return (
          <li key={p.id} className={`${p.connected ? "" : "off"} ${p.id === view.me.id ? "me" : ""} ${p.isHand ? "hand" : ""}`}>
            <span className="crest-wrap">
              <Crest house={h} size={44} />
              {p.isHand && <HandCrown />}
            </span>
            <span className="name-slot">
              <span className="name">
                {p.name}
                {p.isBot && " 🤖"}
                {!p.connected && " (desconectado)"}
                {/* Falas automáticas só para bots; jogadores falam pelo chat. */}
                {p.isBot && <Chatter active={view.phase === "discussion"} motto={h.motto} />}
                <AnimatePresence>
                  {chat[p.id] && now - chat[p.id].at < CHAT_SHOW_MS && (
                    <motion.span
                      key={chat[p.id].at}
                      className="bubble chat"
                      initial={{ opacity: 0, y: 6, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                    >
                      <ChatText text={chat[p.id].text} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <small className="sub">
                {p.isHand ? `Mão do Rei · ${h.name}` : h.name}
                {ov && ` · votou ${CHOICE_LABEL[ov.choice]}${ov.tokens ? ` (${ov.tokens})` : ""}`}
              </small>
            </span>
            <span title="Pontos de influência" className="tokens">
              🎖 {p.tokens}
            </span>
            {view.phase === "voting" && <span>{p.hasVoted ? "✔" : "…"}</span>}
            {(view.phase === "discussion" || view.phase === "reveal") && <span title="Pronto">{p.isReady ? "✔" : "…"}</span>}
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
      <GoalBoard goal={g} ranges={view.ranges} resources={view.resources} />
    </details>
  );
}
