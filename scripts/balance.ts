// Balanceamento das fichas de voto.
// Uso: npx tsx scripts/balance.ts [campanhas por valor, padrão 2000]   (START=10,15,20 para escolher os valores)
//
// Bots "estrategistas": avaliam SIM e NÃO pelo próprio objetivo secreto (a mesma prévia que os jogadores
// veem na carta), apostam fichas conforme o que está em jogo e se abstêm quando tanto faz.
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
import { RESOURCES, type Dilemma, type Outcome, type Resources, type Vote } from "../shared/types";

const N = Number(process.argv[2] ?? 2000);
const PLAYERS = HOUSES.houses.slice(0, 4).map((h, i) => ({ id: `p${i}`, houseId: h.id }));
const START = (process.env.START ?? "8,10,12,15,20").split(",").map(Number);

function utility(s: GameState, pid: string, res: Resources): number {
  const goal = s.goals[pid];
  let u = scoreGoal(goal, res, HOUSES.ranges);
  for (const r of goal.high) u += 0.04 * Math.min(res[r], 10);
  for (const r of RESOURCES) {
    if (res[r] <= -10) u -= 12;
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

function run(startingTokens: number) {
  let collapses = 0, wantedMore = 0, votes = 0, abstains = 0, ties = 0, byHand = 0, rounds = 0, tokensEnd = 0, decided = 0;
  for (let seed = 1; seed <= N; seed++) {
    const rand = rng(seed * 7919 + startingTokens);
    let s = createGame(DILEMMAS, HOUSES, PLAYERS, seed, 12, 2, { startingTokens });
    let dead = false;
    while (!dead) {
      if (isMatchOver(s)) {
        if (s.match >= s.totalMatches) break;
        s = startNextMatch(s, HOUSES);
      }
      const d = drawCard(s, DILEMMA_BY_ID);
      if (!d.card) break;
      const vs: Record<string, Vote> = {};
      for (const p of PLAYERS) {
        const pref = outcomeValue(d.state, p.id, d.card, "yes") - outcomeValue(d.state, p.id, d.card, "no") + (rand() - 0.5) * 0.3;
        votes++;
        if (Math.abs(pref) < 0.35) {
          abstains++;
          vs[p.id] = { choice: "abstain", tokens: 0 };
          continue;
        }
        const want = Math.min(6, Math.round(Math.abs(pref) * 1.6 + rand()));
        const have = d.state.tokens[p.id] ?? 0;
        if (want > have) wantedMore++;
        vs[p.id] = { choice: pref > 0 ? "yes" : "no", tokens: Math.min(want, have) };
      }
      const r = resolveRound(d.state, d.card, vs);
      rounds++;
      if (r.outcome === "tie") ties++;
      if (r.tiebreakByHand) byHand++;
      s = r.state;
      dead = isCollapsed(s);
    }
    if (dead) collapses++;
    else {
      decided++;
      tokensEnd += PLAYERS.reduce((a, p) => a + s.tokens[p.id], 0) / PLAYERS.length;
    }
  }
  return {
    S: startingTokens,
    colapso: (collapses / N) * 100,
    escassez: (wantedMore / votes) * 100,
    abstencao: (abstains / votes) * 100,
    empate: (ties / rounds) * 100,
    mao: (byHand / rounds) * 100,
    fichasFim: decided ? tokensEnd / decided : 0,
  };
}

const f = (n: number) => n.toFixed(1).padStart(6);
console.log(`Campanhas por valor: ${N} (4 jogadores, 2×12 rodadas).`);
console.log(" S | colapso% | escassez% | abstenção% | empates% | desempate pela Mão% | fichas no fim");
for (const S of START) {
  const r = run(S);
  console.log(`${String(r.S).padStart(2)} |  ${f(r.colapso)}  |   ${f(r.escassez)}  |    ${f(r.abstencao)}  |  ${f(r.empate)}  |       ${f(r.mao)}        |  ${f(r.fichasFim)}`);
}
