// Balanceamento: histórias longas, pontos de influência, limites ±7, objetivos e cartas.
// Uso: npx tsx scripts/balance.ts [campanhas, padrão 2000]
//   START=10,15,20   pontos de influência iniciais a comparar (padrão: o de houses.json)
//   INIT=2           valor inicial de todos os recursos (padrão: o de houses.json)
//   HIGH=3,6 MOD=-2,2  faixas dos objetivos (padrão: as de houses.json)
//   DETAIL=1         recursos no fim de cada partida e pontos por objetivo
//
// Dois tipos de mesa, 4 jogadores, campanha de 2×12 rodadas:
// - "estrategistas": avaliam SIM e NÃO pelo próprio objetivo (a mesma prévia que a carta mostra), fogem das
//   pontas da trilha, gastam pontos conforme o que está em jogo e guardam pontos para o resto da campanha;
// - "meio atenta": metade dos votos como os estrategistas, metade ao acaso (a mesa mais parecida com um playtest);
// - "ao acaso": SIM/NÃO/ABSTER sorteados, 1 ponto por voto.
import { DILEMMAS, DILEMMA_BY_ID, HOUSES } from "../shared/content";
import {
  MAX_RES,
  MIN_RES,
  collapseCause,
  createGame,
  drawCard,
  isMatchOver,
  pickVariant,
  resolveRound,
  rng,
  scoreGoal,
  scoreMatch,
  startNextMatch,
  storiesOf,
  type GameState,
} from "../shared/engine";
import { RESOURCES, type Dilemma, type HousesFile, type Outcome, type Resources, type Vote } from "../shared/types";

const N = Number(process.argv[2] ?? 2000);
const pair = (s: string | undefined, d: [number, number]): [number, number] => (s ? (s.split(",").map(Number) as [number, number]) : d);
const INIT = process.env.INIT !== undefined ? Number(process.env.INIT) : null;
const houses: HousesFile = {
  ...HOUSES,
  ranges: { high: pair(process.env.HIGH, HOUSES.ranges.high), moderate: pair(process.env.MOD, HOUSES.ranges.moderate) },
  initialResources:
    INIT === null ? HOUSES.initialResources : (Object.fromEntries(RESOURCES.map((r) => [r, INIT])) as Resources),
};
const START = (process.env.START ?? String(HOUSES.economy.startingTokens)).split(",").map(Number);
const PLAYERS = houses.houses.slice(0, 4).map((h, i) => ({ id: `p${i}`, houseId: h.id }));
const ROUNDS = 12;
const MATCHES = 2;

function utility(s: GameState, pid: string, res: Resources): number {
  const goal = s.goals[pid];
  let u = scoreGoal(goal, res, houses.ranges);
  for (const r of goal.high) u += 0.04 * Math.min(res[r], houses.ranges.high[1]);
  for (const r of RESOURCES) {
    const edge = Math.min(res[r] - MIN_RES, MAX_RES - res[r]); // casas até a ponta
    if (edge <= 0) u -= 12;
    else if (edge === 1) u -= 1.2;
    else if (edge === 2) u -= 0.4;
  }
  return u;
}

function outcomeValue(s: GameState, pid: string, card: Dilemma, o: Outcome): number {
  const v = pickVariant(card, o, s);
  const res = { ...s.resources };
  for (const r of RESOURCES) if (v.effects[r]) res[r] = Math.max(MIN_RES, Math.min(MAX_RES, res[r] + v.effects[r]!));
  return utility(s, pid, res);
}

type Mode = "strategic" | "half" | "random";

function run(startingTokens: number, mode: Mode) {
  let low = 0, high = 0, votes = 0, abstains = 0, broke = 0, ties = 0, byHand = 0, rounds = 0, allAbstain = 0;
  let tokensEnd = 0, points = 0, matches = 0;
  let roots = 0, storyLen = 0, stories = 0, cut = 0, shortStories = 0, crises = 0;
  const finalRes: Record<string, number[]> = Object.fromEntries(RESOURCES.map((r) => [r, []]));
  for (let seed = 1; seed <= N; seed++) {
    const rand = rng(seed * 7919 + startingTokens);
    let s = createGame(DILEMMAS, houses, PLAYERS, seed, ROUNDS, MATCHES, { startingTokens });
    let dead = false;
    while (!dead) {
      if (isMatchOver(s)) {
        // histórias da roda: quantas abriram, quantas cartas cada uma teve, quantas ficaram pela metade
        for (const st of storiesOf(s, s.match)) {
          if (DILEMMA_BY_ID[st.story].kind !== "root") { crises++; continue; } // crise do Reino que fecha a roda
          stories++;
          storyLen += st.steps.length;
          if (st.steps.length < 3) shortStories++;
        }
        roots += s.log.filter((e) => e.match === s.match && e.card === e.story).length;
        cut += new Set(s.queue.map((q) => q.story)).size;
        const pts = scoreMatch(s, houses.ranges);
        points += PLAYERS.reduce((a, p) => a + pts[p.id], 0) / PLAYERS.length;
        matches++;
        for (const r of RESOURCES) finalRes[r].push(s.resources[r]);
        for (const p of PLAYERS) {
          const g = s.goals[p.id].id;
          (goalPts[g] ??= []).push(pts[p.id]);
        }
        if (s.match >= s.totalMatches) break;
        s = startNextMatch(s, houses);
      }
      const d = drawCard(s, DILEMMA_BY_ID);
      if (!d.card) break;
      const roundsLeft = ROUNDS * MATCHES - d.state.round + 1;
      const vs: Record<string, Vote> = {};
      for (const p of PLAYERS) {
        const have = d.state.tokens[p.id] ?? 0;
        votes++;
        if (have <= 0) {
          broke++;
          abstains++;
          vs[p.id] = { choice: "abstain", tokens: 0 };
          continue;
        }
        if (mode === "random" || (mode === "half" && rand() < 0.5)) {
          const c = (["yes", "no", "abstain"] as const)[Math.floor(rand() * 3)];
          if (c === "abstain") abstains++;
          vs[p.id] = { choice: c, tokens: c === "abstain" ? 0 : 1 };
          continue;
        }
        const pref = outcomeValue(d.state, p.id, d.card, "yes") - outcomeValue(d.state, p.id, d.card, "no") + (rand() - 0.5) * 0.3;
        // Quanto menos pontos por rodada restante, mais importante o voto precisa ser.
        const threshold = 0.3 * Math.max(1, roundsLeft / have / 1.6);
        if (Math.abs(pref) < threshold) {
          abstains++;
          vs[p.id] = { choice: "abstain", tokens: 0 };
          continue;
        }
        const want = Math.max(1, Math.min(4, Math.round(Math.abs(pref) * 1.2 + rand() * 0.5)));
        vs[p.id] = { choice: pref > 0 ? "yes" : "no", tokens: Math.min(want, have) };
      }
      if (Object.values(vs).every((v) => v.choice === "abstain")) allAbstain++;
      const r = resolveRound(d.state, d.card, vs);
      rounds++;
      if (r.outcome === "tie") ties++;
      if (r.tiebreakByHand) byHand++;
      s = r.state;
      const cause = collapseCause(s);
      if (cause) {
        dead = true;
        if (cause.value > 0) high++;
        else low++;
      }
    }
    if (!dead) tokensEnd += PLAYERS.reduce((a, p) => a + s.tokens[p.id], 0) / PLAYERS.length;
  }
  const alive = N - low - high;
  return {
    colapso: ((low + high) / N) * 100,
    baixo: (low / N) * 100,
    alto: (high / N) * 100,
    abstencao: (abstains / votes) * 100,
    semPontos: (broke / votes) * 100,
    empate: (ties / rounds) * 100,
    mao: (byHand / rounds) * 100,
    ninguem: (allAbstain / rounds) * 100,
    pontos: matches ? points / matches : 0,
    finalRes,
    sobra: alive ? tokensEnd / alive : 0,
    raizesPorRoda: matches ? roots / matches : 0,
    cartasPorHistoria: stories ? storyLen / stories : 0,
    cortadasPorRoda: matches ? cut / matches : 0,
    curtas: stories ? (shortStories / stories) * 100 : 0,
    crisesPorRoda: matches ? crises / matches : 0,
  };
}

const goalPts: Record<string, number[]> = {};
const f = (n: number) => n.toFixed(1).padStart(5);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
console.log(
  `Campanhas: ${N} por linha (4 jogadores, ${MATCHES}×${ROUNDS} rodadas). Recursos iniciais ${JSON.stringify(houses.initialResources.health)}, ` +
    `alto ${houses.ranges.high.join("..")}, moderado ${houses.ranges.moderate.join("..")}, limites ${MIN_RES}/${MAX_RES}.`,
);
console.log("mesa        | pts | colapso% (−7 / +7) | abstenção% | sem pontos% | empates% | Mão% | ninguém votou% | pontos/partida | sobra");
for (const S of START) {
  for (const mode of ["strategic", "half", "random"] as Mode[]) {
    for (const k of Object.keys(goalPts)) delete goalPts[k];
    const r = run(S, mode);
    console.log(`  ${mode}: ${r.raizesPorRoda.toFixed(2)} histórias por roda (+ ${r.crisesPorRoda.toFixed(2)} crise) · ${r.cartasPorHistoria.toFixed(2)} cartas por história · ${r.curtas.toFixed(1)}% com menos de 3 cartas · ${r.cortadasPorRoda.toFixed(2)} cortadas pela morte do Rei por roda`);
    if (process.env.DETAIL && mode === "strategic") {
      console.log("  recurso no fim de cada partida (média):", RESOURCES.map((x) => `${x} ${avg(r.finalRes[x]).toFixed(1)}`).join(" · "));
      console.log("  pontos por objetivo:", Object.entries(goalPts).sort().map(([g, xs]) => `${g} ${avg(xs).toFixed(2)}`).join(" · "));
    }
    console.log(
      `${mode === "strategic" ? "estrategista" : mode === "half" ? "meio atenta " : "ao acaso   "} | ${String(S).padStart(3)} | ${f(r.colapso)} (${f(r.baixo)} / ${f(r.alto)}) |    ${f(r.abstencao)}   |    ${f(r.semPontos)}    |  ${f(r.empate)}  | ${f(r.mao)} |      ${f(r.ninguem)}     |      ${r.pontos.toFixed(2)}      | ${f(r.sobra)}`,
    );
  }
}
