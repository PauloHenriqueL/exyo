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
  pickVariant,
  matchRound,
  previewOutcomes,
  resolveRound,
  scoreGoal,
  startNextMatch,
  tally,
} from "./engine";
import type { Vote } from "./types";

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

  it("aceitar os viajantes agenda o Segredo dos Viajantes 3 rodadas depois", () => {
    let s = createGame(DILEMMAS, HOUSES, players, 1);
    s = { ...s, deck: ["viajantes_do_leste", ...s.deck.filter((d) => d !== "viajantes_do_leste")] };
    const drawn = drawCard(s, DILEMMA_BY_ID);
    expect(drawn.card?.id).toBe("viajantes_do_leste");
    const yes: Record<string, Vote> = { a: { choice: "yes", tokens: 2 }, b: { choice: "abstain", tokens: 0 } };
    const r = resolveRound(drawn.state, drawn.card!, yes);
    expect(r.state.flags.viajantes_aceitos).toBe(true);
    expect(r.state.queue).toEqual([{ card: "segredo_dos_viajantes", atRound: 4 }]);
    expect(r.state.tokens.a).toBe(drawn.state.tokens.a - 2); // votar gasta os pontos usados
    expect(r.state.tokens.b).toBe(drawn.state.tokens.b); // abster não custa nem rende

    let st = r.state;
    for (let i = 0; i < 3; i++) {
      const d = drawCard(st, DILEMMA_BY_ID);
      if (i === 2) expect(d.card?.id).toBe("segredo_dos_viajantes");
      st = resolveRound(d.state, d.card!, {}).state;
    }
  });

  it("chegar a −7 derruba o Reino (falta)", () => {
    let s = createGame(DILEMMAS, HOUSES, players, 3);
    s = { ...s, resources: { ...s.resources, health: -6 }, round: 1 };
    const r = resolveRound(s, DILEMMA_BY_ID["segunda_onda"], { a: { choice: "no", tokens: 1 } });
    expect(r.state.resources.health).toBe(-7);
    expect(r.deltas.health).toBe(-1);
    expect(isCollapsed(r.state)).toBe(true);
    expect(collapseCause(r.state)).toEqual({ resource: "health", value: -7 });
  });

  it("chegar a +7 também derruba o Reino (excesso), e nada passa das pontas", () => {
    const s = { ...createGame(DILEMMAS, HOUSES, players, 3), resources: { health: 6, security: 6, military: 6, food: 6, wealth: 6 } };
    expect(isCollapsed(s)).toBe(false);
    const card = DILEMMA_BY_ID["viajantes_do_leste"];
    const up = Object.entries(pickVariant(card, "yes", s).effects).find(([, n]) => n! > 0)![0] as keyof typeof s.resources;
    const r = resolveRound(s, card, { a: { choice: "yes", tokens: 1 } });
    expect(r.state.resources[up]).toBe(7);
    expect(collapseCause(r.state)).toEqual({ resource: up, value: 7 });
    const big = { ...s, resources: { ...s.resources, [up]: 7 } };
    expect(resolveRound(big, card, { a: { choice: "yes", tokens: 1 } }).state.resources[up]).toBe(7);
  });

  it("pontuação conta recursos dentro das faixas", () => {
    const goal = HOUSES.houses[0].goals[0];
    const res = { health: 0, military: 5, security: 3, food: 6, wealth: 2 };
    // high: security(3 ok), food(6 ok), wealth(2 não) · moderate: health(0 ok), military(5 não)
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
  function playMatch(s: ReturnType<typeof createGame>) {
    while (!isMatchOver(s)) {
      const d = drawCard(s, DILEMMA_BY_ID);
      s = resolveRound(d.state, d.card!, { a: { choice: "abstain", tokens: 0 }, b: { choice: "yes", tokens: 0 } }).state;
    }
    return s;
  }

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

  it("nenhuma carta se repete nas 24 rodadas", () => {
    let s = playMatch(createGame(DILEMMAS, HOUSES, players, 21, 12, 2));
    s = playMatch(startNextMatch(s, HOUSES));
    expect(s.round).toBe(24);
    expect(new Set(s.played).size).toBe(24);
  });

  it("carta cujo requisito ainda não vale fica no baralho para depois", () => {
    let s = createGame(DILEMMAS, HOUSES, players, 1);
    s = { ...s, resources: { ...s.resources, food: -5 }, deck: ["banquete_da_colheita", "celeiro_real", ...s.deck.filter((d) => d !== "banquete_da_colheita" && d !== "celeiro_real")] };
    const d = drawCard(s, DILEMMA_BY_ID);
    expect(d.card?.id).toBe("celeiro_real");
    expect(d.state.deck[0]).toBe("banquete_da_colheita");
  });
});

describe("prévia do resultado na carta", () => {
  it("mostra os efeitos do SIM e do NÃO e avisa quando há consequência depois", () => {
    const s = createGame(DILEMMAS, HOUSES, players, 2);
    const p = previewOutcomes(s, DILEMMA_BY_ID["viajantes_do_leste"]);
    expect(p.yes.effects).toEqual({ food: -1, wealth: 1 });
    expect(p.yes.later).toBe(true);
    expect(p.no.effects).toEqual({ security: 1 });
  });

  it("considera as decisões anteriores (variante ligada a flag)", () => {
    const s = { ...createGame(DILEMMAS, HOUSES, players, 2), flags: { guarda_reforcada: true } };
    const p = previewOutcomes(s, DILEMMA_BY_ID["segredo_dos_viajantes"]);
    expect(p.yes.effects).toEqual({ security: 2, wealth: -1 });
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
    const r = resolveRound(s, DILEMMA_BY_ID["viajantes_do_leste"], tie);
    expect(r.outcome).toBe("no");
    expect(r.tiebreakByHand).toBe(true);
  });
});
