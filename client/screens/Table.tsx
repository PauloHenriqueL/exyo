import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Room } from "colyseus.js";
import { HOUSES } from "../../shared/content";
import { RESOURCES, RESOURCE_LABEL, type Choice, type ClientView, type PublicPlayer, type Resource } from "../../shared/types";
import { play } from "../audio";
import { Crest } from "../components/Crest";
import { Chatter } from "../components/Effects";
import { GoalBoard } from "../components/GoalBoard";
import { HandCrown } from "../components/HandCrown";
import { ResourceBoard } from "../components/ResourceBoard";
import { sendVote, type ChatMessage } from "../net";
import { ChatBox } from "../components/ChatBox";
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

/** Obras em domínio público usadas como ilustração de cada categoria (ver CREDITOS.md). */
const ART_CAPTION: Record<string, string> = {
  war: "Paolo Uccello, A Batalha de San Romano (c. 1438)",
  feast: "Pieter Bruegel, o Velho, Casamento Camponês (1568)",
  plague: "Pieter Bruegel, o Velho, O Triunfo da Morte (c. 1562)",
  diplomacy: "Hans Holbein, o Jovem, Os Embaixadores (1533)",
  trade: "Quentin Matsys, O Cambista e sua Mulher (1514)",
  faith: "Jan van Eyck, Adoração do Cordeiro Místico (c. 1432)",
  crime: "Caravaggio, Os Trapaceiros (c. 1595)",
  nature: "Pieter Bruegel, o Velho, Caçadores na Neve (1565)",
  princess: "Petrus Christus, Retrato de uma Jovem (c. 1470)",
};

const CHOICE_LABEL: Record<Choice, string> = { yes: "SIM", no: "NÃO", abstain: "ABSTER" };
const OUTCOME_LABEL = { yes: "O conselho disse SIM", no: "O conselho disse NÃO", tie: "Indecisão do Conselho" };
const SIDE_LABEL = { yes: "SIM", no: "NÃO" };

const nameOf = (view: ClientView, id: string | null | undefined) => view.players.find((p) => p.id === id)?.name ?? "—";

export function Table({ view, room, chat }: { view: ClientView; room: Room; chat: Record<string, ChatMessage> }) {
  const timer = useCountdown(view.deadline);
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
          {view.phase === "reveal" && "Revelação"}
        </span>
        <span className="timer" aria-live="polite">
          {timer}
        </span>
      </header>

      <div className="table-grid">
        <section className="card-area">
          <AnimatePresence mode="wait">
            {card && cat && (
              <motion.article
                key={`${card.id}-${view.match}-${view.round}`}
                className={`card ${card.special === "princess" ? "princess" : ""}`}
                style={{ borderColor: cat.color }}
                initial={{ rotateY: 180, y: -120, opacity: 0, scale: 0.6 }}
                animate={{ rotateY: 0, y: 0, opacity: 1, scale: 1 }}
                exit={{ x: 300, opacity: 0, rotate: 8 }}
                transition={{ type: "spring", stiffness: 120, damping: 16 }}
              >
                <div className="card-art">
                  <img
                    src={card.special === "princess" ? "/art/cards/princess.webp" : `/art/cards/${card.category}.webp`}
                    alt=""
                    decoding="async"
                  />
                  <small className="art-caption">{ART_CAPTION[card.special === "princess" ? "princess" : card.category]}</small>
                </div>
                <div className="badges">
                  <span className="cat" style={{ background: cat.color }}>
                    {cat.icon} {cat.label}
                  </span>
                  {card.openVote && <span className="badge open">👁 Voto aberto</span>}
                  {card.kingFavor && <span className="badge favor">👑 Favor do Rei</span>}
                  {card.special === "princess" && <span className="badge princess">💍 Carta especial</span>}
                </div>
                <h2>{card.title}</h2>
                <p className="prompt">{card.prompt}</p>
                <p className="question">{card.question}</p>
                {card.kingFavor && (
                  <p className="rule favor-rule">
                    <strong>👑 Favor do Rei:</strong> quem votar <b>{SIDE_LABEL[card.kingFavor.side]}</b> ganha +{card.kingFavor.amount} de
                    Favor do Rei, vença ou perca a votação. <em>{card.kingFavor.reason}</em>
                  </p>
                )}
                {card.openVote && (
                  <p className="rule open-rule">
                    <strong>👁 Voto aberto:</strong> cada voto aparece para todos assim que é selado e não pode mais ser trocado.
                  </p>
                )}
                {card.ruleText && (
                  <p className="rule princess-rule">
                    <strong>💍 Regra especial:</strong> {card.ruleText}
                  </p>
                )}
              </motion.article>
            )}
          </AnimatePresence>

          {view.phase === "discussion" && me && <ReadyPanel view={view} room={room} />}
          {view.phase === "voting" && me && <VotePanel key={`${view.match}-${view.round}`} view={view} room={room} me={me} />}
          {view.phase === "reveal" && view.reveal && <RevealPanel view={view} />}
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
  const humans = view.players.filter((p) => !p.isBot);
  const readyCount = humans.filter((p) => p.isReady).length;
  return (
    <div className="panel ready">
      {me.isHand && <p className="hand-note">👑 Você é a Mão do Rei: leia a carta em voz alta e, num empate, seu voto decide.</p>}
      <p className="muted">Debatam na chamada. Quando todos clicarem, a votação abre na hora — ou quando o tempo acabar.</p>
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
  const [spend, setSpend] = useState(voted?.tokens ?? 0);
  const [steal, setSteal] = useState<Resource | null>(voted?.steal ?? null);
  const votedCount = view.players.filter((p) => p.hasVoted).length;
  const locked = !!(view.card?.openVote && voted); // voto aberto é definitivo
  const canSteal = choice === "yes" || choice === "no";
  const max = me.tokens + (canSteal && steal ? 1 : 0);
  const spendNow = Math.min(spend, max);

  const submit = () => {
    if (!choice || locked) return;
    play("seal");
    if (choice !== "abstain" && spendNow > 0) play("coins", 150);
    sendVote(room, {
      choice,
      tokens: choice === "abstain" ? 0 : spendNow,
      ...(canSteal && steal ? { steal } : {}),
    });
  };

  return (
    <div className="panel vote">
      {view.card?.openVote && <p className="hand-note">👁 Voto aberto: seu voto aparece para todos assim que for selado, e não dá para trocar.</p>}
      <div className="choices" role="radiogroup" aria-label="Seu voto">
        {(["yes", "no", "abstain"] as Choice[]).map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={choice === c}
            disabled={locked}
            className={`selo ${c} ${choice === c ? "on" : ""}`}
            onClick={() => setChoice(c)}
          >
            <span className="selo-cera" aria-hidden="true" />
            {me.houseId && <img className="selo-sinete" src={`/art/crests/${me.houseId}.webp`} alt="" aria-hidden="true" />}
            <span className="selo-txt">{CHOICE_LABEL[c]}</span>
          </button>
        ))}
      </div>
      {canSteal && !locked && (
        <>
          <div className="stepper">
            <span>Fichas de voto a apostar (você tem {me.tokens}):</span>
            <button className="btn small" onClick={() => setSpend(Math.max(0, spendNow - 1))} disabled={spendNow <= 0} aria-label="Menos fichas">
              −
            </button>
            <strong>{spendNow}</strong>
            <button className="btn small" onClick={() => setSpend(Math.min(max, spendNow + 1))} disabled={spendNow >= max} aria-label="Mais fichas">
              +
            </button>
            <span className="muted">peso do voto: {1 + spendNow}</span>
          </div>
          <fieldset className="steal">
            <legend>🗡 Roubar do Reino? (1 recurso perde 1 ponto, você ganha +1 ficha agora)</legend>
            <div className="steal-options">
              <button className={`btn small ${steal === null ? "on" : ""}`} onClick={() => setSteal(null)} aria-pressed={steal === null}>
                Não roubar
              </button>
              {RESOURCES.map((r) => (
                <button key={r} className={`btn small ${steal === r ? "on" : ""}`} onClick={() => setSteal(r)} aria-pressed={steal === r}>
                  {RESOURCE_LABEL[r]} −1
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}
      {choice === "abstain" && !locked && <p className="muted">Abster-se rende +1 ficha de voto. Quem se abstém não pode roubar do Reino.</p>}
      <button className="btn primary" disabled={!choice || locked} onClick={submit}>
        {locked ? "Voto selado" : voted ? "Alterar voto" : "Selar voto"}
      </button>
      <p className="muted">
        {voted
          ? `Voto selado: ${CHOICE_LABEL[voted.choice]}${voted.tokens ? ` (+${voted.tokens} fichas)` : ""}${voted.steal ? ` · roubou ${RESOURCE_LABEL[voted.steal]}` : ""}. `
          : ""}
        {votedCount}/{view.players.length} votaram.
      </p>
    </div>
  );
}

function RevealPanel({ view }: { view: ClientView }) {
  const r = view.reveal!;
  const after = view.players.length * 0.4 + 0.2;
  const gainers = Object.keys(r.favorGains);
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
              {v?.tokens ? <small>+{v.tokens} fichas</small> : null}
              {v?.steal ? <small>🗡 {RESOURCE_LABEL[v.steal]} −1</small> : null}
            </motion.div>
          );
        })}
      </div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: after }}>
        <h3>
          {OUTCOME_LABEL[r.outcome]} <span className="muted">(SIM {r.yesWeight} × NÃO {r.noWeight})</span>
        </h3>
        {r.tiebreakByHand && <p className="event">⚖ Empate! Decidiu o voto da Mão do Rei.</p>}
        <KingReaction view={view} />
        <p className="narrative">{r.text}</p>
        <p className="deltas">
          {Object.entries(r.deltas).map(([k, d]) => (
            <span key={k} className={d! > 0 ? "up" : "down"}>
              {RESOURCE_LABEL[k as Resource]} {d! > 0 ? `+${d}` : d}
            </span>
          ))}
        </p>
        {r.steals.length > 0 && (
          <p className="event">
            🗡 Roubaram do Reino:{" "}
            {r.steals.map((s) => `${nameOf(view, s.playerId)} (${RESOURCE_LABEL[s.resource]} −1)`).join(", ")}
          </p>
        )}
        {gainers.length > 0 && (
          <p className="event">👑 Ganharam Favor do Rei: {gainers.map((id) => `${nameOf(view, id)} (+${r.favorGains[id]})`).join(", ")}</p>
        )}
        {r.princess && (
          <p className="event big">
            💍{" "}
            {r.princess.winnerId
              ? `${nameOf(view, r.princess.winnerId)} se casa com a princesa Elara e é a Mão do Rei até o fim desta partida. O Favor do Rei de todos voltou a zero.`
              : "Empate entre os pretendentes: a princesa recusou todos."}
          </p>
        )}
        {r.handChange && r.handChange.reason === "favor" && (
          <motion.p className="event big" initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ delay: after + 0.4, type: "spring" }}>
            👑 {nameOf(view, r.handChange.to)} conquistou o Favor do Rei e agora é a Mão do Rei
            {r.handChange.bonus ? ` (+${r.handChange.bonus} fichas)` : ""}.
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

/** Nas cartas de Favor do Rei, o Rei reage ao desfecho; na carta da princesa, ela aparece. */
function KingReaction({ view }: { view: ClientView }) {
  const r = view.reveal!;
  const card = view.card;
  if (card?.special === "princess" && r.princess) {
    return (
      <div className="king-reaction">
        <img src="/art/princess.webp" alt="A princesa Elara" width={72} height={96} />
        <p>{r.princess.winnerId ? "A princesa Elara aceita o pretendente." : "A princesa Elara recusa todos os pretendentes."}</p>
      </div>
    );
  }
  if (!card?.kingFavor) return null;
  const pleased = r.outcome === card.kingFavor.side;
  return (
    <motion.div
      className={`king-reaction ${pleased ? "pleased" : "displeased"}`}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
    >
      <img src={pleased ? "/art/king-pleased.webp" : "/art/king.webp"} alt="O Rei Osric" width={72} height={96} />
      <p>{pleased ? "O Rei Osric celebra com a corte: o conselho decidiu como ele queria." : "O Rei Osric franze a testa. Não era isso que ele queria."}</p>
    </motion.div>
  );
}

const CHAT_SHOW_MS = 7000;

function Players({ view, chat }: { view: ClientView; chat: Record<string, ChatMessage> }) {
  const now = Date.now();
  const maxFavor = Math.max(10, ...view.players.map((p) => p.favor));
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
            <span className="favor-meter" title={`Favor do Rei: ${p.favor}`} aria-label={`Favor do Rei de ${p.name}: ${p.favor}`}>
              <motion.span className="fill" animate={{ height: `${(p.favor / maxFavor) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 18 }} />
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
                      {chat[p.id].text}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <small className="sub">
                <b className="favor-txt">Favor {p.favor}</b> · {p.isHand ? (view.handLocked ? "Mão do Rei 💍" : "Mão do Rei") : h.name}
                {ov && ` · votou ${CHOICE_LABEL[ov.choice]}${ov.tokens ? ` +${ov.tokens}` : ""}${ov.steal ? " 🗡" : ""}`}
              </small>
            </span>
            <span title="Fichas de voto" className="tokens">
              🎖 {p.tokens}
            </span>
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
      <GoalBoard goal={g} ranges={view.ranges} resources={view.resources} />
    </details>
  );
}
