// Motor de regras puro: sem rede, sem banco, sem relógio.
import {
  RESOURCES,
  type Cond,
  type Dilemma,
  type Economy,
  type FlagValue,
  type Goal,
  type HousesFile,
  type Outcome,
  type Resources,
  type Variant,
  type Vote,
} from "./types";

export const MIN_RES = -10;
export const MAX_RES = 10;

export interface Scheduled {
  card: string;
  atRound: number;
}

export interface MatchResult {
  goals: Record<string, Goal>;
  points: Record<string, number>;
}

export interface GameState {
  round: number; // contador global da campanha; 0 = nenhuma rodada jogada ainda
  totalRounds: number; // rodadas por partida
  match: number; // partida atual (1, 2, …)
  totalMatches: number;
  matchStartRound: number; // valor de `round` quando a partida atual começou
  houses: Record<string, string>; // jogador → Casa
  history: MatchResult[]; // partidas já encerradas
  resources: Resources;
  flags: Record<string, FlagValue>;
  deck: string[]; // ids de cartas raiz, na ordem de compra
  queue: Scheduled[];
  played: string[];
  tokens: Record<string, number>; // fichas de voto
  goals: Record<string, Goal>;
  order: string[]; // fila da Mão do Rei: ordem dos jogadores na mesa
  hand: string; // Mão do Rei desta rodada: desempata pelo próprio voto
}

/** PRNG determinístico (mulberry32) para reproduzir partidas pela seed. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function evalCond(c: Cond | undefined, s: Pick<GameState, "resources" | "flags">): boolean {
  if (!c) return true;
  if ("all" in c) return c.all.every((x) => evalCond(x, s));
  if ("any" in c) return c.any.some((x) => evalCond(x, s));
  if ("not" in c) return !evalCond(c.not, s);
  const v: FlagValue = "flag" in c ? (s.flags[c.flag] ?? false) : s.resources[c.res];
  if ("eq" in c && c.eq !== undefined && v !== c.eq) return false;
  if (c.gte !== undefined && !(typeof v === "number" && v >= c.gte)) return false;
  if (c.lte !== undefined && !(typeof v === "number" && v <= c.lte)) return false;
  return true;
}

export function createGame(
  dilemmas: Dilemma[],
  houses: HousesFile,
  players: { id: string; houseId: string }[],
  seed: number,
  totalRounds = 12,
  totalMatches = 1,
  economy: Economy = houses.economy,
): GameState {
  const rand = rng(seed);
  const goals: Record<string, Goal> = {};
  const tokens: Record<string, number> = {};
  const houseOf: Record<string, string> = {};
  for (const p of players) {
    houseOf[p.id] = p.houseId;
    const house = houses.houses.find((h) => h.id === p.houseId);
    if (!house) throw new Error(`Casa desconhecida: ${p.houseId}`);
    goals[p.id] = house.goals[Math.floor(rand() * house.goals.length)];
    tokens[p.id] = economy.startingTokens;
  }
  const deck = buildDeck(dilemmas, rand, totalRounds * totalMatches);
  // A primeira Mão do Rei é sorteada (depois do baralho, para não mudar a ordem das cartas de uma seed).
  const order = players.map((p) => p.id);
  const hand = order[Math.floor(rand() * order.length)];
  return {
    round: 0,
    totalRounds,
    match: 1,
    totalMatches,
    matchStartRound: 0,
    houses: houseOf,
    history: [],
    resources: { ...houses.initialResources },
    flags: {},
    deck,
    queue: [],
    played: [],
    tokens,
    goals,
    order,
    hand,
  };
}

/**
 * Embaralha as cartas raiz; cartas com `placement` vão para uma posição sorteada dentro da faixa,
 * dada como fração das rodadas da campanha (assim a carta aparece qualquer que seja a duração).
 * Consequências também ocupam rodadas, por isso a faixa é aplicada a ~70% das rodadas.
 */
function buildDeck(dilemmas: Dilemma[], rand: () => number, campaignRounds: number): string[] {
  const roots = dilemmas.filter((d) => d.kind === "root");
  const deck = shuffle(roots.filter((d) => !d.placement).map((d) => d.id), rand);
  const rootRounds = Math.max(1, Math.floor(campaignRounds * 0.7));
  for (const d of roots.filter((x) => x.placement)) {
    const { from, to } = d.placement!;
    const lo = Math.max(0, Math.min(Math.floor(from * rootRounds), deck.length));
    const hi = Math.max(lo, Math.min(Math.floor(to * rootRounds), deck.length));
    deck.splice(lo + Math.floor(rand() * (hi - lo + 1)), 0, d.id);
  }
  return deck;
}

/** Rodada atual dentro da partida (1..totalRounds). */
export function matchRound(s: Pick<GameState, "round" | "matchStartRound">): number {
  return s.round - s.matchStartRound;
}

export function isMatchOver(s: GameState): boolean {
  return matchRound(s) >= s.totalRounds;
}

export function scoreMatch(s: GameState, ranges: HousesFile["ranges"]): Record<string, number> {
  return Object.fromEntries(Object.entries(s.goals).map(([pid, g]) => [pid, scoreGoal(g, s.resources, ranges)]));
}

/**
 * Encerra a partida atual (guardando metas e pontos no histórico) e abre a próxima.
 * O Reino continua como está: recursos, fichas, flags, consequências pendentes e cartas já jogadas.
 * Cada jogador recebe um objetivo da própria Casa que ainda não teve.
 */
export function startNextMatch(s: GameState, houses: HousesFile): GameState {
  const history = [...s.history, { goals: s.goals, points: scoreMatch(s, houses.ranges) }];
  const goals: Record<string, Goal> = {};
  for (const [pid, houseId] of Object.entries(s.houses)) {
    const house = houses.houses.find((h) => h.id === houseId)!;
    const used = new Set(history.map((m) => m.goals[pid]?.id));
    const fresh = house.goals.filter((g) => !used.has(g.id));
    goals[pid] = (fresh.length ? fresh : house.goals.filter((g) => g.id !== s.goals[pid]?.id))[0] ?? s.goals[pid];
  }
  return { ...s, match: s.match + 1, matchStartRound: s.round, history, goals };
}

/** Pontos somados de todas as partidas (encerradas + a atual). */
export function campaignPoints(s: GameState, ranges: HousesFile["ranges"]): Record<string, number> {
  const current = scoreMatch(s, ranges);
  return Object.fromEntries(
    Object.keys(s.houses).map((pid) => [pid, s.history.reduce((acc, m) => acc + (m.points[pid] ?? 0), 0) + (current[pid] ?? 0)]),
  );
}

/** Próximo da fila da Mão do Rei (volta ao topo depois do último). */
export function nextHand(s: Pick<GameState, "order" | "hand">): string {
  const i = s.order.indexOf(s.hand);
  return s.order[(i + 1) % s.order.length];
}

/**
 * Compra a próxima carta: primeiro consequências vencidas, depois o baralho. Cartas que ainda não cumprem `requires` ficam no baralho para depois.
 * A cada carta nova (menos a primeira da campanha) a Mão do Rei passa para o próximo da fila.
 */
export function drawCard(s0: GameState, byId: Record<string, Dilemma>): { state: GameState; card: Dilemma | null } {
  const s = s0.round > 0 ? { ...s0, hand: nextHand(s0) } : s0;
  const round = s.round + 1;
  const queue = [...s.queue].sort((a, b) => a.atRound - b.atRound);
  const qi = queue.findIndex((q) => q.atRound <= round);
  if (qi >= 0) {
    const [next] = queue.splice(qi, 1);
    return { state: { ...s, round, queue, played: [...s.played, next.card] }, card: byId[next.card] };
  }
  const idx = s.deck.findIndex((id) => evalCond(byId[id].requires, s));
  if (idx >= 0) {
    const id = s.deck[idx];
    const deck = s.deck.filter((_, i) => i !== idx);
    return { state: { ...s, round, deck, queue, played: [...s.played, id] }, card: byId[id] };
  }
  return { state: { ...s, round, queue }, card: null };
}

export function isValidVote(v: Vote, available: number): boolean {
  if (!["yes", "no", "abstain"].includes(v.choice)) return false;
  if (!Number.isInteger(v.tokens) || v.tokens < 0 || v.tokens > available) return false;
  if (v.choice === "abstain" && v.tokens !== 0) return false;
  return true;
}

/**
 * Soma os pesos (1 + fichas). Num empate, vence o lado em que a Mão do Rei votou.
 * Se a Mão se absteve (ou todos se abstiveram), é Indecisão do Conselho.
 */
export function tally(
  votes: Record<string, Vote>,
  hand?: string,
): { outcome: Outcome; yesWeight: number; noWeight: number; tiebreakByHand: boolean } {
  let yesWeight = 0;
  let noWeight = 0;
  for (const v of Object.values(votes)) {
    if (v.choice === "yes") yesWeight += 1 + v.tokens;
    if (v.choice === "no") noWeight += 1 + v.tokens;
  }
  let outcome: Outcome = yesWeight > noWeight ? "yes" : noWeight > yesWeight ? "no" : "tie";
  let tiebreakByHand = false;
  const handVote = hand ? votes[hand]?.choice : undefined;
  if (outcome === "tie" && (handVote === "yes" || handVote === "no")) {
    outcome = handVote;
    tiebreakByHand = true;
  }
  return { outcome, yesWeight, noWeight, tiebreakByHand };
}

export function pickVariant(card: Dilemma, outcome: Outcome, s: GameState): Variant {
  const v = card.outcomes[outcome].find((x) => evalCond(x.when, s));
  if (!v) throw new Error(`Carta ${card.id} sem variante padrão para ${outcome}`);
  return v;
}

export interface RoundResult {
  state: GameState;
  outcome: Outcome;
  yesWeight: number;
  noWeight: number;
  tiebreakByHand: boolean;
  variant: Variant;
  deltas: Partial<Resources>;
}

const clamp = (v: number) => Math.max(MIN_RES, Math.min(MAX_RES, v));

/** Prévia mostrada na carta: efeitos do SIM e do NÃO no estado atual do Reino. */
export function previewOutcomes(s: GameState, card: Dilemma): { yes: { effects: Partial<Resources>; later: boolean }; no: { effects: Partial<Resources>; later: boolean } } {
  const one = (o: "yes" | "no") => {
    const v = pickVariant(card, o, s);
    return { effects: { ...v.effects }, later: !!v.inject?.length };
  };
  return { yes: one("yes"), no: one("no") };
}

export function resolveRound(s: GameState, card: Dilemma, votes: Record<string, Vote>): RoundResult {
  const resources = { ...s.resources };

  // 1. Votação (empate: decide o voto da Mão do Rei).
  const { outcome, yesWeight, noWeight, tiebreakByHand } = tally(votes, s.hand);
  const variant = pickVariant(card, outcome, s);

  // 2. Efeitos da carta.
  for (const r of RESOURCES) {
    const d = variant.effects[r];
    if (d) resources[r] = clamp(resources[r] + d);
  }
  const deltas: Partial<Resources> = {};
  for (const r of RESOURCES) if (resources[r] !== s.resources[r]) deltas[r] = resources[r] - s.resources[r];

  const flags = { ...s.flags };
  for (const [k, v] of Object.entries(variant.setFlags ?? {})) {
    flags[k] = typeof v === "object" ? (typeof flags[k] === "number" ? (flags[k] as number) : 0) + v.add : v;
  }

  const queue = [...s.queue];
  for (const inj of variant.inject ?? []) {
    if (!s.played.includes(inj.card) && !queue.some((q) => q.card === inj.card)) {
      queue.push({ card: inj.card, atRound: s.round + inj.inRounds });
    }
  }

  // 3. Fichas de voto: abster rende 1; votar gasta as fichas apostadas.
  const tokens = { ...s.tokens };
  for (const [pid, v] of Object.entries(votes)) {
    const t = tokens[pid] ?? 0;
    tokens[pid] = v.choice === "abstain" ? t + 1 : t - v.tokens;
  }

  return { state: { ...s, resources, flags, queue, tokens }, outcome, yesWeight, noWeight, tiebreakByHand, variant, deltas };
}

export function isCollapsed(s: Pick<GameState, "resources">): boolean {
  return RESOURCES.some((r) => s.resources[r] <= MIN_RES);
}

export function scoreGoal(goal: Goal, res: Resources, ranges: HousesFile["ranges"]): number {
  const inRange = (v: number, [lo, hi]: [number, number]) => v >= lo && v <= hi;
  return (
    goal.high.filter((r) => inRange(res[r], ranges.high)).length +
    goal.moderate.filter((r) => inRange(res[r], ranges.moderate)).length
  );
}
