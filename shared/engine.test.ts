import { describe, expect, it } from "vitest";
import { DILEMMAS, DILEMMA_BY_ID, HOUSES } from "./content";
import {
  campaignPoints,
  createGame,
  drawCard,
  evalCond,
  isCollapsed,
  isMatchOver,
  isValidVote,
  collapseCause,
  DEFAULT_KING_DEATH,
  pickVariant,
  storiesOf,
  matchRound,
  previewOutcomes,
  resolveRound,
  scoreGoal,
  startNextMatch,
  tally,
  type GameState,
} from "./engine";
import type { Vote } from "./types";

/** Joga uma roda inteira; votos variam com a rodada para percorrer caminhos diferentes. */
function playMatch(s: ReturnType<typeof createGame>) {
  while (!isMatchOver(s)) {
    const d = drawCard(s, DILEMMA_BY_ID);
    const pick = (["yes", "no", "abstain"] as const)[(d.state.round * 7 + s.order.length) % 3];
    s = resolveRound(d.state, d.card!, { a: { choice: pick, tokens: pick === "abstain" ? 0 : 1 }, b: { choice: "abstain", tokens: 0 } }).state;
  }
  return s;
}

const players = [
  { id: "a", houseId: "aurivel" },
  { id: "b", houseId: "ferrobranco" },
  { id: "c", houseId: "verdemar" },
  { id: "d", houseId: "lumen" },
];

describe("tally", () => {
  it("peso = pontos de influência gastos", () => {
    const votes: Record<string, Vote> = {
      a: { choice: "yes", tokens: 1 },
      b: { choice: "yes", tokens: 1 },
      c: { choice: "no", tokens: 3 },
      d: { choice: "abstain", tokens: 0 },
    };
    expect(tally(votes)).toEqual({ outcome: "no", yesWeight: 2, noWeight: 3, tiebreakByHand: false });
  });
  it("todos abstendo = empate", () => {
    expect(tally({ a: { choice: "abstain", tokens: 0 } }).outcome).toBe("tie");
  });
});

describe("isValidVote", () => {
  it("votar SIM/NÃO custa pelo menos 1 ponto; sem pontos, só abster", () => {
    expect(isValidVote({ choice: "yes", tokens: 2 }, 1)).toBe(false);
    expect(isValidVote({ choice: "abstain", tokens: 1 }, 3)).toBe(false);
    expect(isValidVote({ choice: "no", tokens: 1 }, 1)).toBe(true);
    expect(isValidVote({ choice: "yes", tokens: 0 }, 5)).toBe(false);
    expect(isValidVote({ choice: "yes", tokens: 1 }, 0)).toBe(false);
    expect(isValidVote({ choice: "abstain", tokens: 0 }, 0)).toBe(true);
  });
});

describe("evalCond", () => {
  const s = { resources: { ...HOUSES.initialResources, food: -1 }, flags: { x: true, rep: -2 } };
  it("flags, recursos e combinadores", () => {
    expect(evalCond({ flag: "x", eq: true }, s)).toBe(true);
    expect(evalCond({ flag: "y", eq: true }, s)).toBe(false);
    expect(evalCond({ flag: "rep", lte: -2 }, s)).toBe(true);
    expect(evalCond({ res: "food", lte: 0 }, s)).toBe(true);
    expect(evalCond({ all: [{ flag: "x", eq: true }, { not: { flag: "y", eq: true } }] }, s)).toBe(true);
  });
});

describe("partida", () => {
  it("a mesma seed gera o mesmo baralho e as mesmas metas", () => {
    const g1 = createGame(DILEMMAS, HOUSES, players, 42);
    const g2 = createGame(DILEMMAS, HOUSES, players, 42);
    expect(g1.deck).toEqual(g2.deck);
    expect(g1.goals).toEqual(g2.goals);
  });

  it("aceitar a Embaixada de Veneza traz a Caravana Saqueada, que mostra de onde veio", () => {
    let s = createGame(DILEMMAS, HOUSES, players, 1);
    s = { ...s, deck: ["embaixada_de_veneza", ...s.deck.filter((d) => d !== "embaixada_de_veneza")] };
    const drawn = drawCard(s, DILEMMA_BY_ID);
    expect(drawn.card?.id).toBe("embaixada_de_veneza");
    expect(drawn.state.current).toEqual({ card: "embaixada_de_veneza", story: "embaixada_de_veneza", from: null });
    const yes: Record<string, Vote> = { a: { choice: "yes", tokens: 2 }, b: { choice: "abstain", tokens: 0 } };
    const r = resolveRound(drawn.state, drawn.card!, yes);
    expect(r.state.flags.rota_de_veneza).toBe(true);
    expect(r.state.queue).toEqual([
      { card: "caravana_saqueada", atRound: 2, story: "embaixada_de_veneza", from: { card: "embaixada_de_veneza", outcome: "yes" } },
    ]);
    expect(r.state.tokens.a).toBe(drawn.state.tokens.a - 2); // votar gasta os pontos usados
    expect(r.state.tokens.b).toBe(drawn.state.tokens.b + 1); // abster rende 1

    const next = drawCard(r.state, DILEMMA_BY_ID);
    expect(next.card?.id).toBe("caravana_saqueada");
    expect(next.state.current).toEqual({ card: "caravana_saqueada", story: "embaixada_de_veneza", from: { card: "embaixada_de_veneza", outcome: "yes" } });
  });

  it("chegar a −7 derruba o Reino (falta)", () => {
    let s = createGame(DILEMMAS, HOUSES, players, 3);
    s = { ...s, resources: { ...s.resources, health: -6 }, round: 1 };
    const r = resolveRound(s, DILEMMA_BY_ID["embaixada_de_veneza"], { a: { choice: "no", tokens: 1 } });
    expect(r.state.resources.health).toBe(-7);
    expect(r.deltas.health).toBe(-1);
    expect(isCollapsed(r.state)).toBe(true);
    expect(collapseCause(r.state)).toEqual({ resource: "health", value: -7 });
  });

  it("chegar a +7 também derruba o Reino (excesso), e nada passa das pontas", () => {
    const s = { ...createGame(DILEMMAS, HOUSES, players, 3), resources: { health: 6, faith: 6, military: 6, food: 6, wealth: 6 } };
    expect(isCollapsed(s)).toBe(false);
    const card = DILEMMA_BY_ID["embaixada_de_veneza"];
    const up = Object.entries(pickVariant(card, "yes", s).effects).find(([, n]) => n! > 0)![0] as keyof typeof s.resources;
    const r = resolveRound(s, card, { a: { choice: "yes", tokens: 1 } });
    expect(r.state.resources[up]).toBe(7);
    expect(collapseCause(r.state)).toEqual({ resource: up, value: 7 });
    const big = { ...s, resources: { ...s.resources, [up]: 7 } };
    expect(resolveRound(big, card, { a: { choice: "yes", tokens: 1 } }).state.resources[up]).toBe(7);
  });

  it("pontuação conta recursos dentro das faixas", () => {
    const goal = HOUSES.houses[0].goals[0];
    // aurivel_a — alto: Saúde, Força Militar, Riqueza · moderado: Religião, Comida
    const res = { health: 3, military: 6, wealth: 2, faith: 0, food: 5 };
    // alto: health(3 ok), military(6 ok), wealth(2 não) · moderado: faith(0 ok), food(5 não)
    expect(scoreGoal(goal, res, HOUSES.ranges)).toBe(3);
  });

  it("uma partida inteira com votos aleatórios termina sem erros", () => {
    let s = createGame(DILEMMAS, HOUSES, players, 7);
    for (let i = 0; i < 12 && !isCollapsed(s); i++) {
      const d = drawCard(s, DILEMMA_BY_ID);
      if (!d.card) break;
      s = resolveRound(d.state, d.card, { a: { choice: i % 2 ? "yes" : "no", tokens: 1 } }).state;
    }
    expect(s.round).toBeGreaterThan(0);
  });
});

describe("campanha de 2 partidas", () => {
  it("a partida acaba depois de 12 rodadas e a próxima herda o Reino", () => {
    let s = createGame(DILEMMAS, HOUSES, players, 11, 12, 2);
    s = playMatch(s);
    expect(s.round).toBe(12);
    expect(matchRound(s)).toBe(12);

    const before = s;
    const next = startNextMatch(s, HOUSES);
    expect(next.match).toBe(2);
    expect(matchRound(next)).toBe(0);
    expect(isMatchOver(next)).toBe(false);
    // Reino herdado: recursos, fichas, flags, fila e cartas jogadas.
    expect(next.resources).toEqual(before.resources);
    expect(next.tokens).toEqual(before.tokens);
    expect(next.flags).toEqual(before.flags);
    expect(next.queue).toEqual(before.queue);
    expect(next.played).toEqual(before.played);
    expect(next.tokens.a).toBeGreaterThan(0); // "a" absteve-se 12 vezes
  });

  it("cada jogador recebe o outro objetivo da própria Casa", () => {
    const s = createGame(DILEMMAS, HOUSES, players, 5, 12, 2);
    const next = startNextMatch(s, HOUSES);
    for (const p of players) {
      const house = HOUSES.houses.find((h) => h.id === p.houseId)!;
      expect(next.goals[p.id].id).not.toBe(s.goals[p.id].id);
      expect(house.goals.map((g) => g.id)).toContain(next.goals[p.id].id);
    }
    expect(next.history).toHaveLength(1);
    expect(next.history[0].goals).toEqual(s.goals);
  });

  it("os pontos da campanha somam as partidas", () => {
    let s = createGame(DILEMMAS, HOUSES, players, 9, 12, 2);
    s = playMatch(s);
    const first = Object.fromEntries(players.map((p) => [p.id, scoreGoal(s.goals[p.id], s.resources, HOUSES.ranges)]));
    s = playMatch(startNextMatch(s, HOUSES));
    const second = Object.fromEntries(players.map((p) => [p.id, scoreGoal(s.goals[p.id], s.resources, HOUSES.ranges)]));
    const total = campaignPoints(s, HOUSES.ranges);
    for (const p of players) expect(total[p.id]).toBe(first[p.id] + second[p.id]);
  });

  it("cartas de história nunca se repetem; compartilhadas, no máximo uma vez por roda", () => {
    for (let seed = 1; seed <= 200; seed++) {
      let s = playMatch(createGame(DILEMMAS, HOUSES, players, seed, 12, 2));
      s = playMatch(startNextMatch(s, HOUSES));
      expect(s.round).toBe(24);
      const story = s.played.filter((id) => !DILEMMA_BY_ID[id].shared);
      expect(new Set(story).size, `seed ${seed}`).toBe(story.length);
      for (const half of [s.played.slice(0, 12), s.played.slice(12)]) {
        const shared = half.filter((id) => DILEMMA_BY_ID[id].shared);
        expect(new Set(shared).size, `seed ${seed}`).toBe(shared.length);
      }
    }
  });

  it("carta cujo requisito ainda não vale fica no baralho para depois", () => {
    const byId = { ...DILEMMA_BY_ID, as_chuvas: { ...DILEMMA_BY_ID.as_chuvas, requires: { res: "food" as const, gte: 0 } } };
    let s = createGame(DILEMMAS, HOUSES, players, 1);
    s = { ...s, resources: { ...s.resources, food: -5 }, deck: ["as_chuvas", "os_mongois", ...s.deck.filter((d) => d !== "as_chuvas" && d !== "os_mongois")] };
    const d = drawCard(s, byId);
    expect(d.card?.id).toBe("os_mongois");
    expect(d.state.deck[0]).toBe("as_chuvas");
  });
});

describe("histórias longas", () => {
  const pending = (card: string, story: string, atRound: number) => ({ card, atRound, story, from: { card: story, outcome: "yes" as const } });

  it("com duas histórias abertas, a próxima consequência é adiantada em vez de abrir uma raiz", () => {
    const s = { ...createGame(DILEMMAS, HOUSES, players, 5), round: 3, queue: [pending("caravana_saqueada", "embaixada_de_veneza", 9), pending("a_morte_negra", "peste_no_porto", 8)] };
    const d = drawCard(s, DILEMMA_BY_ID);
    expect(d.card?.id).toBe("a_morte_negra");
    expect(d.state.deck).toEqual(s.deck);
  });

  it("com uma só história aberta e nada na vez, abre uma história nova", () => {
    const s = { ...createGame(DILEMMAS, HOUSES, players, 5), round: 3, queue: [pending("caravana_saqueada", "embaixada_de_veneza", 9)] };
    const d = drawCard(s, DILEMMA_BY_ID);
    expect(d.card?.kind).toBe("root");
    expect(d.state.current?.from).toBeNull();
  });

  it("no fim da roda, sem nada pendente, vem uma crise do Reino em vez de uma história que não terminaria", () => {
    const s = { ...createGame(DILEMMAS, HOUSES, players, 5), round: 11 };
    const d = drawCard(s, DILEMMA_BY_ID);
    expect(d.card?.shared).toBe(true);
    for (const o of ["yes", "no", "tie"] as const) for (const v of d.card!.outcomes[o]) expect(v.inject).toBeUndefined();
  });

  it("a morte do Rei fecha as histórias da roda e guarda como ele morreu", () => {
    let s: GameState = { ...createGame(DILEMMAS, HOUSES, players, 5, 12, 2), round: 12, queue: [pending("caravana_saqueada", "embaixada_de_veneza", 13)] };
    s = resolveRound(s, DILEMMA_BY_ID["doenca_na_capital"], { a: { choice: "no", tokens: 1 } }).state;
    expect(s.kingDeath).toMatch(/peste/);
    const next = startNextMatch(s, HOUSES);
    expect(next.queue).toEqual([]);
    expect(next.kingDeath).toBeNull();
    expect(next.history[0].kingDeath).toMatch(/peste/);
    expect(startNextMatch(createGame(DILEMMAS, HOUSES, players, 5, 12, 2), HOUSES).history[0].kingDeath).toBe(DEFAULT_KING_DEATH);
  });

  it("uma carta compartilhada já usada na roda não é trazida de novo, mas volta na roda seguinte", () => {
    const base = createGame(DILEMMAS, HOUSES, players, 5, 12, 2);
    const used = { ...base, round: 4, played: ["a", "b", "cofres_vazios", "c"] };
    const card = DILEMMA_BY_ID["herdeiro_assassinado"]; // NÃO traz Os Cofres Vazios
    expect(resolveRound(used, card, { a: { choice: "no", tokens: 1 } }).state.queue).toEqual([]);
    const nextRoda = { ...used, round: 14, matchStartRound: 12, match: 2 };
    expect(resolveRound(nextRoda, card, { a: { choice: "no", tokens: 1 } }).state.queue.map((q) => q.card)).toEqual(["cofres_vazios"]);
  });

  it("as histórias vividas ficam registradas por roda", () => {
    let s = createGame(DILEMMAS, HOUSES, players, 8, 12, 2);
    s = playMatch(s);
    const st = storiesOf(s, 1);
    expect(st.reduce((a, x) => a + x.steps.length, 0)).toBe(12);
    for (const x of st) expect(x.steps[0].card).toBe(x.story);
  });
});

describe("prévia do resultado na carta", () => {
  it("mostra os efeitos do SIM e do NÃO e avisa quando há consequência depois", () => {
    const s = createGame(DILEMMAS, HOUSES, players, 2);
    const p = previewOutcomes(s, DILEMMA_BY_ID["embaixada_de_veneza"]);
    expect(p.yes.effects).toEqual({ health: 1, wealth: 1, military: -1 });
    expect(p.yes.later).toBe(true);
    expect(p.no.effects).toEqual({ military: 1, health: -1 });
  });

  it("considera as decisões anteriores (variante ligada a flag)", () => {
    const s = { ...createGame(DILEMMAS, HOUSES, players, 2), flags: { rota_de_veneza: true } };
    const p = previewOutcomes(s, DILEMMA_BY_ID["peste_no_porto"]);
    expect(p.yes.effects).toEqual({ health: -1, wealth: 1 });
  });

  it("todos começam com as fichas iniciais e o empate sem Mão do Rei é Indecisão do Conselho", () => {
    const s = createGame(DILEMMAS, HOUSES, players, 3);
    for (const pl of players) expect(s.tokens[pl.id]).toBe(HOUSES.economy.startingTokens);
    expect(tally({ a: { choice: "yes", tokens: 1 }, b: { choice: "no", tokens: 1 } }).outcome).toBe("tie");
  });
});

describe("Mão do Rei", () => {
  const tie: Record<string, Vote> = { a: { choice: "no", tokens: 0 }, b: { choice: "yes", tokens: 0 }, c: { choice: "abstain", tokens: 0 } };

  it("empate: vence o lado em que a Mão do Rei votou", () => {
    expect(tally(tie, "a")).toMatchObject({ outcome: "no", tiebreakByHand: true });
    expect(tally(tie, "b")).toMatchObject({ outcome: "yes", tiebreakByHand: true });
  });

  it("empate com a Mão abstendo (ou todos abstendo) continua Indecisão", () => {
    expect(tally(tie, "c")).toMatchObject({ outcome: "tie", tiebreakByHand: false });
    expect(tally({ a: { choice: "abstain", tokens: 0 } }, "a")).toMatchObject({ outcome: "tie", tiebreakByHand: false });
  });

  it("sem empate, a Mão não muda nada", () => {
    const votes: Record<string, Vote> = { a: { choice: "no", tokens: 0 }, b: { choice: "yes", tokens: 1 } };
    expect(tally(votes, "a")).toMatchObject({ outcome: "yes", tiebreakByHand: false });
  });

  it("a primeira é sorteada; depois passa ao próximo da mesa a cada carta, também entre partidas", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) seen.add(createGame(DILEMMAS, HOUSES, players, seed).hand);
    expect(seen.size).toBeGreaterThan(1);

    let s = createGame(DILEMMAS, HOUSES, players, 5, 3, 2);
    const ids = players.map((p) => p.id);
    const start = ids.indexOf(s.hand);
    const hands: string[] = [];
    for (let i = 0; i < 6; i++) {
      if (isMatchOver(s)) s = startNextMatch(s, HOUSES);
      const d = drawCard(s, DILEMMA_BY_ID);
      hands.push(d.state.hand);
      s = resolveRound(d.state, d.card!, {}).state;
    }
    expect(hands).toEqual([0, 1, 2, 3, 4, 5].map((i) => ids[(start + i) % ids.length]));
  });

  it("resolveRound usa a Mão da rodada", () => {
    const s = { ...createGame(DILEMMAS, HOUSES, players, 3), hand: "a" };
    const r = resolveRound(s, DILEMMA_BY_ID["embaixada_de_veneza"], tie);
    expect(r.outcome).toBe("no");
    expect(r.tiebreakByHand).toBe(true);
  });
});
