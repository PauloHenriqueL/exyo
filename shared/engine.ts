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
  type Resource,
  type Resources,
  type Variant,
  type Vote,
} from "./types";

/** Limites da trilha: chegar a −7 ou a +7 em qualquer recurso derruba o Reino (o jogo vive entre −6 e +6). */
export const MIN_RES = -7;
export const MAX_RES = 7;

/** Histórias abertas ao mesmo tempo: uma raiz nova só entra quando há menos que isso em andamento. */
export const MAX_OPEN_STORIES = 2;
/** Uma raiz nova só abre se ainda houver pelo menos estas rodadas na roda (a roda fecha as próprias histórias). */
export const MIN_ROUNDS_TO_OPEN = 3;
/** Morte do velho Rei quando nada grave aconteceu na roda. */
export const DEFAULT_KING_DEATH = "de velhice, dormindo, depois de um reinado cheio de decisões difíceis";

/** Votação que trouxe uma carta. */
export interface Origin {
  card: string;
  outcome: Outcome;
}

export interface Scheduled {
  card: string;
  atRound: number;
  story: string; // id da carta raiz que abriu a história
  from: Origin;
}

/** Uma rodada jogada: qual carta, de qual história e o que o Conselho decidiu. */
export interface LogEntry {
  match: number;
  card: string;
  story: string;
  outcome: Outcome;
}

export interface MatchResult {
  goals: Record<string, Goal>;
  points: Record<string, number>;
  kingDeath: string;
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
  tokens: Record<string, number>; // pontos de influência (gastos a cada voto SIM/NÃO)
  goals: Record<string, Goal>;
  order: string[]; // fila da Mão do Rei: ordem dos jogadores na mesa
  hand: string; // Mão do Rei desta rodada: desempata pelo próprio voto
  /** Carta na mesa: a história a que pertence e a votação que a trouxe (null no começo de uma história). */
  current: { card: string; story: string; from: Origin | null } | null;
  log: LogEntry[];
  shared: string[]; // cartas compartilhadas (podem voltar na roda seguinte)
  kingDeath: string | null; // como o velho Rei vai morrer, se algo grave aconteceu nesta roda
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
    current: null,
    log: [],
    shared: dilemmas.filter((d) => d.shared).map((d) => d.id),
    kingDeath: null,
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
  const history = [...s.history, { goals: s.goals, points: scoreMatch(s, houses.ranges), kingDeath: s.kingDeath ?? DEFAULT_KING_DEATH }];
  const goals: Record<string, Goal> = {};
  for (const [pid, houseId] of Object.entries(s.houses)) {
    const house = houses.houses.find((h) => h.id === houseId)!;
    const used = new Set(history.map((m) => m.goals[pid]?.id));
    const fresh = house.goals.filter((g) => !used.has(g.id));
    goals[pid] = (fresh.length ? fresh : house.goals.filter((g) => g.id !== s.goals[pid]?.id))[0] ?? s.goals[pid];
  }
  // O velho Rei morre: as histórias da roda acabam com ele (o que ainda estava por vir não vem mais).
  return { ...s, match: s.match + 1, matchStartRound: s.round, history, goals, queue: [], current: null, kingDeath: null };
}

/** Cartas já jogadas na roda atual. */
export function playedThisMatch(s: Pick<GameState, "played" | "matchStartRound">): string[] {
  return s.played.slice(s.matchStartRound);
}

/** Histórias vividas numa roda, na ordem em que começaram. */
export function storiesOf(s: Pick<GameState, "log">, match: number): { story: string; steps: LogEntry[] }[] {
  const out: { story: string; steps: LogEntry[] }[] = [];
  for (const e of s.log.filter((x) => x.match === match)) {
    let st = out.find((x) => x.story === e.story);
    if (!st) out.push((st = { story: e.story, steps: [] }));
    st.steps.push(e);
  }
  return out;
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
 * Compra a próxima carta. Poucas histórias longas, no máximo duas abertas ao mesmo tempo:
 * 1. a consequência cuja vez chegou;
 * 2. senão, uma história nova (carta raiz), se há menos de duas em andamento e a roda ainda tem rodadas para ela;
 * 3. senão, a próxima consequência pendente é adiantada (nada de raiz nova no meio das histórias);
 * 4. no fim da roda, sem nada pendente: uma crise do Reino (carta compartilhada que se resolve sozinha);
 * 5. só se não houver nenhuma, uma raiz mesmo no fim da roda.
 * Cartas raiz que ainda não cumprem `requires` ficam no baralho para depois.
 * A cada carta nova (menos a primeira da campanha) a Mão do Rei passa para o próximo da fila.
 */
export function drawCard(s0: GameState, byId: Record<string, Dilemma>): { state: GameState; card: Dilemma | null } {
  const s = s0.round > 0 ? { ...s0, hand: nextHand(s0) } : s0;
  const round = s.round + 1;
  const queue = [...s.queue].sort((a, b) => a.atRound - b.atRound);
  const take = (i: number) => {
    const [next] = queue.splice(i, 1);
    const current = { card: next.card, story: next.story, from: next.from };
    return { state: { ...s, round, queue, current, played: [...s.played, next.card] }, card: byId[next.card] };
  };
  const qi = queue.findIndex((q) => q.atRound <= round);
  if (qi >= 0) return take(qi);
  const open = new Set(queue.map((q) => q.story)).size;
  const left = s.totalRounds - (round - s.matchStartRound) + 1; // rodadas da roda, contando esta
  const idx = s.deck.findIndex((id) => evalCond(byId[id].requires, s));
  const root = () => {
    const id = s.deck[idx];
    const deck = s.deck.filter((_, i) => i !== idx);
    return { state: { ...s, round, deck, queue, current: { card: id, story: id, from: null }, played: [...s.played, id] }, card: byId[id] };
  };
  if (idx >= 0 && open < MAX_OPEN_STORIES && left >= MIN_ROUNDS_TO_OPEN) return root();
  if (queue.length) return take(0);
  // Fim da roda sem nada pendente: uma crise do Reino (carta compartilhada que se resolve sozinha, ainda não usada
  // nesta roda) em vez de começar uma história que a morte do Rei cortaria.
  if (left < MIN_ROUNDS_TO_OPEN) {
    const used = playedThisMatch(s);
    const closes = (id: string) => (["yes", "no", "tie"] as const).every((o) => byId[id].outcomes[o].every((v) => !v.inject?.length));
    const crises = s.shared.filter((id) => byId[id] && closes(id) && !used.includes(id));
    if (crises.length) {
      const id = crises[round % crises.length];
      return { state: { ...s, round, queue, current: { card: id, story: id, from: null }, played: [...s.played, id] }, card: byId[id] };
    }
  }
  if (idx >= 0) return root();
  return { state: { ...s, round, queue, current: null }, card: null };
}

/**
 * Votar SIM ou NÃO custa pontos de influência: pelo menos 1, e cada ponto é 1 de peso.
 * Quem está com 0 pontos só pode se abster (e abster-se rende 1 ponto para votar depois).
 */
export function isValidVote(v: Vote, available: number): boolean {
  if (!["yes", "no", "abstain"].includes(v.choice)) return false;
  if (!Number.isInteger(v.tokens) || v.tokens < 0 || v.tokens > available) return false;
  if (v.choice === "abstain") return v.tokens === 0;
  return v.tokens >= 1;
}

/**
 * Soma os pesos (peso = pontos de influência gastos). Num empate, vence o lado em que a Mão do Rei votou.
 * Se a Mão se absteve (ou todos se abstiveram), é Indecisão do Conselho.
 */
export function tally(
  votes: Record<string, Vote>,
  hand?: string,
): { outcome: Outcome; yesWeight: number; noWeight: number; tiebreakByHand: boolean } {
  let yesWeight = 0;
  let noWeight = 0;
  for (const v of Object.values(votes)) {
    if (v.choice === "yes") yesWeight += v.tokens;
    if (v.choice === "no") noWeight += v.tokens;
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

  // Consequências: cartas de história nunca se repetem; cartas compartilhadas saem no máximo uma vez por roda.
  const queue = [...s.queue];
  const story = s.current?.story ?? card.id;
  const thisMatch = playedThisMatch(s);
  for (const inj of variant.inject ?? []) {
    const used = s.shared.includes(inj.card) ? thisMatch.includes(inj.card) : s.played.includes(inj.card);
    if (!used && !queue.some((q) => q.card === inj.card)) {
      queue.push({ card: inj.card, atRound: s.round + inj.inRounds, story, from: { card: card.id, outcome } });
    }
  }
  const log = [...(s.log ?? []), { match: s.match, card: card.id, story, outcome }];
  const kingDeath = variant.kingDeath ?? s.kingDeath ?? null;

  // 3. Pontos de influência: votar gasta os pontos usados; abster-se rende 1.
  const tokens = { ...s.tokens };
  for (const [pid, v] of Object.entries(votes)) {
    const t = tokens[pid] ?? 0;
    tokens[pid] = v.choice === "abstain" ? t + 1 : t - v.tokens;
  }

  return { state: { ...s, resources, flags, queue, tokens, log, kingDeath }, outcome, yesWeight, noWeight, tiebreakByHand, variant, deltas };
}

export function isCollapsed(s: Pick<GameState, "resources">): boolean {
  return collapseCause(s) !== null;
}

/** Qual recurso derrubou o Reino: no fundo (−7, falta) ou no topo (+7, excesso). */
export function collapseCause(s: Pick<GameState, "resources">): { resource: Resource; value: number } | null {
  const r = RESOURCES.find((x) => s.resources[x] <= MIN_RES || s.resources[x] >= MAX_RES);
  return r ? { resource: r, value: s.resources[r] } : null;
}

export function scoreGoal(goal: Goal, res: Resources, ranges: HousesFile["ranges"]): number {
  const inRange = (v: number, [lo, hi]: [number, number]) => v >= lo && v <= hi;
  return (
    goal.high.filter((r) => inRange(res[r], ranges.high)).length +
    goal.moderate.filter((r) => inRange(res[r], ranges.moderate)).length
  );
}
