// Motor de regras puro: sem rede, sem banco, sem relógio.
import {
  RESOURCES,
  type Cond,
  type Dilemma,
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

export interface GameState {
  round: number; // 0 = nenhuma rodada jogada ainda
  totalRounds: number;
  resources: Resources;
  flags: Record<string, FlagValue>;
  deck: string[]; // ids de cartas raiz, na ordem de compra
  queue: Scheduled[];
  played: string[];
  tokens: Record<string, number>;
  goals: Record<string, Goal>;
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
): GameState {
  const rand = rng(seed);
  const goals: Record<string, Goal> = {};
  const tokens: Record<string, number> = {};
  for (const p of players) {
    const house = houses.houses.find((h) => h.id === p.houseId);
    if (!house) throw new Error(`Casa desconhecida: ${p.houseId}`);
    goals[p.id] = house.goals[Math.floor(rand() * house.goals.length)];
    tokens[p.id] = 0;
  }
  return {
    round: 0,
    totalRounds,
    resources: { ...houses.initialResources },
    flags: {},
    deck: shuffle(dilemmas.filter((d) => d.kind === "root").map((d) => d.id), rand),
    queue: [],
    played: [],
    tokens,
    goals,
  };
}

/** Compra a próxima carta: primeiro consequências vencidas, depois o baralho (pulando as que não cumprem `requires`). */
export function drawCard(s: GameState, byId: Record<string, Dilemma>): { state: GameState; card: Dilemma | null } {
  const round = s.round + 1;
  const queue = [...s.queue].sort((a, b) => a.atRound - b.atRound);
  const qi = queue.findIndex((q) => q.atRound <= round);
  if (qi >= 0) {
    const [next] = queue.splice(qi, 1);
    return { state: { ...s, round, queue, played: [...s.played, next.card] }, card: byId[next.card] };
  }
  const deck = [...s.deck];
  while (deck.length) {
    const id = deck.shift()!;
    if (evalCond(byId[id].requires, s)) {
      return { state: { ...s, round, deck, queue, played: [...s.played, id] }, card: byId[id] };
    }
  }
  return { state: { ...s, round, deck, queue }, card: null };
}

export function isValidVote(v: Vote, available: number): boolean {
  if (!["yes", "no", "abstain"].includes(v.choice)) return false;
  if (!Number.isInteger(v.tokens) || v.tokens < 0 || v.tokens > available) return false;
  if (v.choice === "abstain" && v.tokens !== 0) return false;
  return true;
}

export function tally(votes: Record<string, Vote>): { outcome: Outcome; yesWeight: number; noWeight: number } {
  let yesWeight = 0;
  let noWeight = 0;
  for (const v of Object.values(votes)) {
    if (v.choice === "yes") yesWeight += 1 + v.tokens;
    if (v.choice === "no") noWeight += 1 + v.tokens;
  }
  const outcome: Outcome = yesWeight > noWeight ? "yes" : noWeight > yesWeight ? "no" : "tie";
  return { outcome, yesWeight, noWeight };
}

export function pickVariant(card: Dilemma, outcome: Outcome, s: GameState): Variant {
  const v = card.outcomes[outcome].find((x) => evalCond(x.when, s));
  if (!v) throw new Error(`Carta ${card.id} sem variante padrão para ${outcome}`);
  return v;
}

export function resolveRound(
  s: GameState,
  card: Dilemma,
  votes: Record<string, Vote>,
): { state: GameState; outcome: Outcome; yesWeight: number; noWeight: number; variant: Variant; deltas: Partial<Resources> } {
  const { outcome, yesWeight, noWeight } = tally(votes);
  const variant = pickVariant(card, outcome, s);

  const resources = { ...s.resources };
  const deltas: Partial<Resources> = {};
  for (const r of RESOURCES) {
    const d = variant.effects[r];
    if (!d) continue;
    const before = resources[r];
    resources[r] = Math.max(MIN_RES, Math.min(MAX_RES, before + d));
    deltas[r] = resources[r] - before;
  }

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

  const tokens = { ...s.tokens };
  for (const [pid, v] of Object.entries(votes)) {
    tokens[pid] = v.choice === "abstain" ? (tokens[pid] ?? 0) + 1 : (tokens[pid] ?? 0) - v.tokens;
  }

  return { state: { ...s, resources, flags, queue, tokens }, outcome, yesWeight, noWeight, variant, deltas };
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
