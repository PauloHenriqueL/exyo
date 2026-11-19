// Balanceamento da economia de fichas e da Mão do Rei.
// Uso: npx tsx scripts/balance.ts [campanhas por combinação, padrão 2000]
//
// Bots "estrategistas": avaliam cada desfecho pelo próprio objetivo secreto, apostam fichas
// proporcionalmente ao que está em jogo, se abstêm quando tanto faz, roubam do Reino quando
// faltam fichas e disputam o Favor do Rei e a mão da princesa.
import { DILEMMAS, DILEMMA_BY_ID, HOUSES } from "../shared/content";
import {
  createGame,
  drawCard,
  isCollapsed,
  isMatchOver,
  pickVariant,
  resolveRound,
  rng,
  scoreGoal,
  startNextMatch,
  type GameState,
} from "../shared/engine";
import { RESOURCES, type Dilemma, type Economy, type Outcome, type Resource, type Resources, type Vote } from "../shared/types";

const N = Number(process.argv[2] ?? 2000);
const PLAYERS = HOUSES.houses.slice(0, 4).map((h, i) => ({ id: `p${i}`, houseId: h.id }));

function utility(s: GameState, pid: string, res: Resources): number {
  const goal = s.goals[pid];
  let u = scoreGoal(goal, res, HOUSES.ranges);
  for (const r of goal.high) u += 0.04 * Math.min(res[r], 10); // quanto mais alto, mais seguro
  for (const r of RESOURCES) {
    if (res[r] <= -10) u -= 12; // colapso: todos perdem
    else if (res[r] <= -7) u -= 1.2;
    else if (res[r] <= -5) u -= 0.4;
  }
  return u;
}

function outcomeValue(s: GameState, pid: string, card: Dilemma, o: Outcome): number {
  const v = pickVariant(card, o, s);
  const res = { ...s.resources };
  for (const r of RESOURCES) if (v.effects[r]) res[r] = Math.max(-10, Math.min(10, res[r] + v.effects[r]!));
  return utility(s, pid, res);
}

/** Recurso menos importante para mim agora (para roubar), ou null se roubar me prejudica. */
function stealTarget(s: GameState, pid: string): Resource | null {
  const goal = s.goals[pid];
  const opts: [Resource, number][] = [];
  for (const r of goal.moderate) if (s.resources[r] > 0) opts.push([r, s.resources[r]]);
  for (const r of goal.high) if (s.resources[r] >= 6) opts.push([r, s.resources[r] - 3]);
  opts.sort((a, b) => b[1] - a[1]);
  return opts.length ? opts[0][0] : null;
}

interface Stats {
  rounds: number;
  wantedMore: number;
  votes: number;
  steals: number;
  tiebreaks: number;
  handChanges: number;
  princessWins: number;
}

function botVote(s: GameState, pid: string, card: Dilemma, rand: () => number, st: Stats): Vote {
  let pref = outcomeValue(s, pid, card, "yes") - outcomeValue(s, pid, card, "no");
  const tokens = s.tokens[pid] ?? 0;

  // Favor do Rei: vale mais quando me aproxima de virar a Mão.
  if (card.kingFavor) {
    const maxOther = Math.max(...Object.entries(s.favor).filter(([p]) => p !== pid).map(([, f]) => f));
    const close = s.favor[pid] + card.kingFavor.amount >= maxOther ? 0.6 : 0.25;
    pref += (card.kingFavor.side === "yes" ? 1 : -1) * close * (s.hand === pid ? 0.5 : 1);
  }

  // A Mão da Princesa: quem quer o título aposta pesado no SIM.
  if (card.special === "princess") {
    const wants = s.hand !== pid && rand() < 0.75;
    if (wants) {
      const bid = Math.min(tokens, Math.max(1, Math.round(tokens * (0.35 + rand() * 0.35))));
      st.votes++;
      return { choice: "yes", tokens: bid };
    }
  }

  const noise = (rand() - 0.5) * 0.3;
  const p = pref + noise;
  if (Math.abs(p) < 0.35) {
    st.votes++;
    return { choice: "abstain", tokens: 0 };
  }
  const choice = p > 0 ? "yes" : "no";
  const want = Math.min(6, Math.round(Math.abs(p) * 1.6 + rand()));
  st.votes++;
  let steal: Resource | undefined;
  let available = tokens;
  if (want > tokens) {
    st.wantedMore++;
    const target = stealTarget(s, pid);
    if (target && rand() < 0.6) {
      steal = target;
      available += 1;
      st.steals++;
    }
  }
  return { choice, tokens: Math.min(want, available), ...(steal ? { steal } : {}) };
}

function runConfig(eco: Economy) {
  const st: Stats = { rounds: 0, wantedMore: 0, votes: 0, steals: 0, tiebreaks: 0, handChanges: 0, princessWins: 0 };
  let collapses = 0;
  let initialHandWins = 0;
  let finalHandWins = 0;
  let decided = 0;
  let tokenSum = 0;
  let spreadSum = 0;
  for (let seed = 1; seed <= N; seed++) {
    const rand = rng(seed * 7919 + eco.startingTokens * 31 + eco.handBonus);
    let s = createGame(DILEMMAS, HOUSES, PLAYERS, seed, 12, 2, eco);
    const initialHand = s.hand;
    let dead = false;
    while (!dead) {
      if (isMatchOver(s)) {
        if (s.match >= s.totalMatches) break;
        s = startNextMatch(s, HOUSES);
      }
      const d = drawCard(s, DILEMMA_BY_ID);
      if (!d.card) break;
      const votes: Record<string, Vote> = {};
      for (const p of PLAYERS) votes[p.id] = botVote(d.state, p.id, d.card, rand, st);
      const r = resolveRound(d.state, d.card, votes);
      st.rounds++;
      if (r.tiebreakByHand) st.tiebreaks++;
      if (r.handChange) st.handChanges++;
      if (r.princess?.winnerId) st.princessWins++;
      s = r.state;
      dead = isCollapsed(s);
    }
    if (dead) {
      collapses++;
      continue;
    }
    const pts: Record<string, number> = {};
    for (const p of PLAYERS) {
      pts[p.id] = s.history.reduce((a, m) => a + (m.points[p.id] ?? 0), 0) + scoreGoal(s.goals[p.id], s.resources, HOUSES.ranges);
    }
    const best = Math.max(...Object.values(pts));
    const top = PLAYERS.filter((p) => pts[p.id] === best);
    const bt = Math.max(...top.map((p) => s.tokens[p.id]));
    const winners = top.filter((p) => s.tokens[p.id] === bt).map((p) => p.id);
    decided++;
    if (winners.includes(initialHand)) initialHandWins += 1 / winners.length;
    if (winners.includes(s.hand)) finalHandWins += 1 / winners.length;
    const toks = PLAYERS.map((p) => s.tokens[p.id]);
    tokenSum += toks.reduce((a, b) => a + b, 0) / toks.length;
    spreadSum += Math.max(...toks) - Math.min(...toks);
  }
  return {
    S: eco.startingTokens,
    B: eco.handBonus,
    colapso: (collapses / N) * 100,
    vitMaoInicial: decided ? (initialHandWins / decided) * 100 : 0,
    vitMaoFinal: decided ? (finalHandWins / decided) * 100 : 0,
    trocasMao: st.handChanges / N,
    desempates: (st.tiebreaks / st.rounds) * 100,
    escassez: (st.wantedMore / st.votes) * 100,
    roubos: st.steals / N,
    fichasFim: decided ? tokenSum / decided : 0,
    diferencaFim: decided ? spreadSum / decided : 0,
  };
}

const list = (env: string | undefined, def: number[]) => (env ? env.split(",").map(Number) : def);
const START = list(process.env.START, [5, 8, 10, 12, 15]);
const BONUS = list(process.env.BONUS, [0, 2, 3, 5, 8]);
const rows = [];
for (const S of START) for (const B of BONUS) rows.push(runConfig({ startingTokens: S, handBonus: B, startingFavor: HOUSES.economy.startingFavor }));

const fmt = (n: number, d = 1) => n.toFixed(d).padStart(6);
console.log(`Campanhas por combinação: ${N} (4 jogadores, 2×12 rodadas). Justo para a Mão inicial = 25%.`);
console.log(" S   B | colapso% | vit.Mão0% | vit.MãoFim% | trocas Mão | desempate% | escassez% | roubos | fichas fim | diferença");
for (const r of rows) {
  console.log(
    `${String(r.S).padStart(2)} ${String(r.B).padStart(3)} |  ${fmt(r.colapso)}  |   ${fmt(r.vitMaoInicial)}  |    ${fmt(r.vitMaoFinal)}   |   ${fmt(r.trocasMao, 2)}   |   ${fmt(r.desempates)}   |  ${fmt(r.escassez)}   | ${fmt(r.roubos)} |   ${fmt(r.fichasFim)}   | ${fmt(r.diferencaFim)}`,
  );
}

// Critério: a Mão inicial não pode ser favorita demais (perto de 25%), fichas devem ser escassas
// às vezes (escassez 10–30%: decisões de quanto apostar importam) e o colapso não deve subir.
const score = (r: (typeof rows)[number]) =>
  Math.abs(r.vitMaoInicial - 25) * 1.5 + Math.abs(r.escassez - 20) * 0.5 + r.colapso * 0.5 + (r.trocasMao < 1 ? 5 : 0);
const best = [...rows].sort((a, b) => score(a) - score(b));
console.log("\nMelhores combinações (menor penalidade):");
for (const r of best.slice(0, 5)) console.log(`  S=${r.S} B=${r.B} → penalidade ${score(r).toFixed(2)}`);
