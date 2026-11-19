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
  matchRound,
  resolveRound,
  scoreGoal,
  startNextMatch,
  tally,
} from "./engine";
import type { Dilemma, Vote } from "./types";

const players = [
  { id: "a", houseId: "aurivel" },
  { id: "b", houseId: "ferrobranco" },
  { id: "c", houseId: "verdemar" },
  { id: "d", houseId: "lumen" },
];

describe("tally", () => {
  it("peso = 1 + fichas", () => {
    const votes: Record<string, Vote> = {
      a: { choice: "yes", tokens: 0 },
      b: { choice: "yes", tokens: 0 },
      c: { choice: "no", tokens: 2 },
      d: { choice: "abstain", tokens: 0 },
    };
    expect(tally(votes)).toEqual({ outcome: "no", yesWeight: 2, noWeight: 3, tiebreakByHand: false });
  });
  it("todos abstendo = empate", () => {
    expect(tally({ a: { choice: "abstain", tokens: 0 } }).outcome).toBe("tie");
  });
});

describe("isValidVote", () => {
  it("rejeita fichas além do saldo e fichas na abstenção", () => {
    expect(isValidVote({ choice: "yes", tokens: 2 }, 1)).toBe(false);
    expect(isValidVote({ choice: "abstain", tokens: 1 }, 3)).toBe(false);
    expect(isValidVote({ choice: "no", tokens: 1 }, 1)).toBe(true);
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
    const yes: Record<string, Vote> = { a: { choice: "yes", tokens: 0 }, b: { choice: "abstain", tokens: 0 } };
    const r = resolveRound(drawn.state, drawn.card!, yes);
    expect(r.state.flags.viajantes_aceitos).toBe(true);
    expect(r.state.queue).toEqual([{ card: "segredo_dos_viajantes", atRound: 4 }]);
    expect(r.state.tokens.b).toBe(drawn.state.tokens.b + 1);

    let st = r.state;
    for (let i = 0; i < 3; i++) {
      const d = drawCard(st, DILEMMA_BY_ID);
      if (i === 2) expect(d.card?.id).toBe("segredo_dos_viajantes");
      st = resolveRound(d.state, d.card!, {}).state;
    }
  });

  it("recursos ficam presos entre -10 e 10 e colapso é detectado", () => {
    let s = createGame(DILEMMAS, HOUSES, players, 3);
    s = { ...s, resources: { ...s.resources, health: -9 }, round: 1 };
    const r = resolveRound(s, DILEMMA_BY_ID["segunda_onda"], { a: { choice: "no", tokens: 0 } });
    expect(r.state.resources.health).toBe(-10);
    expect(r.deltas.health).toBe(-1);
    expect(isCollapsed(r.state)).toBe(true);
  });

  it("pontuação conta recursos dentro das faixas", () => {
    const goal = HOUSES.houses[0].goals[0];
    const res = { health: 0, military: 5, security: 3, food: 10, wealth: 2 };
    // high: security(3 ok), food(10 ok), wealth(2 não) · moderate: health(0 ok), military(5 não)
    expect(scoreGoal(goal, res, HOUSES.ranges)).toBe(3);
  });

  it("uma partida inteira com votos aleatórios termina sem erros", () => {
    let s = createGame(DILEMMAS, HOUSES, players, 7);
    for (let i = 0; i < 12 && !isCollapsed(s); i++) {
      const d = drawCard(s, DILEMMA_BY_ID);
      if (!d.card) break;
      s = resolveRound(d.state, d.card, { a: { choice: i % 2 ? "yes" : "no", tokens: 0 } }).state;
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
    s = { ...s, resources: { ...s.resources, food: -5 }, deck: ["banquete_da_colheita", "cometa", ...s.deck.filter((d) => d !== "banquete_da_colheita" && d !== "cometa")] };
    const d = drawCard(s, DILEMMA_BY_ID);
    expect(d.card?.id).toBe("cometa");
    expect(d.state.deck[0]).toBe("banquete_da_colheita");
  });
});

describe("Mão do Rei, Favor do Rei e roubo", () => {
  const base = () => createGame(DILEMMAS, HOUSES, players, 3, 12, 2, { startingTokens: 10, handBonus: 5, startingFavor: 5 });
  const plain: Dilemma = {
    id: "teste",
    kind: "root",
    category: "trade",
    title: "Teste",
    prompt: "",
    question: "",
    outcomes: {
      yes: [{ text: "sim", effects: { wealth: 1 } }],
      no: [{ text: "não", effects: { wealth: -1 } }],
      tie: [{ text: "empate", effects: {} }],
    },
  };
  const favorCard: Dilemma = { ...plain, id: "favor", kingFavor: { side: "yes", amount: 1, reason: "o Rei gosta" } };

  it("começo: todos com as fichas iniciais e Favor 5; a Mão sorteada tem o bônus", () => {
    const s = base();
    expect(players.map((p) => p.id)).toContain(s.hand);
    for (const p of players) {
      expect(s.favor[p.id]).toBe(5);
      expect(s.tokens[p.id]).toBe(p.id === s.hand ? 15 : 10);
    }
  });

  it("empate: vence o lado em que a Mão do Rei votou", () => {
    const s = { ...base(), hand: "a" };
    const votes: Record<string, Vote> = { a: { choice: "no", tokens: 0 }, b: { choice: "yes", tokens: 0 } };
    const r = resolveRound(s, plain, votes);
    expect(r.outcome).toBe("no");
    expect(r.tiebreakByHand).toBe(true);
  });

  it("empate com a Mão abstendo continua Indecisão", () => {
    const s = { ...base(), hand: "a" };
    const votes: Record<string, Vote> = { a: { choice: "abstain", tokens: 0 }, b: { choice: "yes", tokens: 1 }, c: { choice: "no", tokens: 1 } };
    const r = resolveRound(s, plain, votes);
    expect(r.outcome).toBe("tie");
    expect(r.tiebreakByHand).toBe(false);
  });

  it("roubar do Reino: recurso −1, +1 ficha já usável no voto", () => {
    const s = { ...base(), hand: "a", tokens: { a: 0, b: 0, c: 0, d: 0 } };
    expect(isValidVote({ choice: "yes", tokens: 1, steal: "food" }, 0)).toBe(true);
    expect(isValidVote({ choice: "yes", tokens: 2, steal: "food" }, 0)).toBe(false);
    expect(isValidVote({ choice: "abstain", tokens: 0, steal: "food" }, 3)).toBe(false);
    const r = resolveRound(s, plain, { b: { choice: "yes", tokens: 1, steal: "food" } });
    expect(r.state.resources.food).toBe(s.resources.food - 1);
    expect(r.state.tokens.b).toBe(0); // +1 roubada −1 apostada
    expect(r.steals).toEqual([{ playerId: "b", resource: "food" }]);
    expect(r.deltas.food).toBe(-1);
  });

  it("roubo pode derrubar o Reino", () => {
    const s = { ...base(), resources: { ...base().resources, health: -9 } };
    const r = resolveRound(s, plain, { b: { choice: "yes", tokens: 0, steal: "health" } });
    expect(isCollapsed(r.state)).toBe(true);
  });

  it("votar no lado do Rei rende Favor e o maior Favor vira a Mão (+bônus)", () => {
    const s = { ...base(), hand: "a" };
    const tokensB = s.tokens.b;
    const r = resolveRound(s, favorCard, { b: { choice: "yes", tokens: 0 }, c: { choice: "no", tokens: 0 } });
    expect(r.favorGains).toEqual({ b: 1 });
    expect(r.state.favor.b).toBe(6);
    expect(r.state.hand).toBe("b");
    expect(r.handChange).toEqual({ from: "a", to: "b", reason: "favor", bonus: 5 });
    expect(r.state.tokens.b).toBe(tokensB + 5);
  });

  it("empate no topo do Favor não tira a Mão de ninguém", () => {
    const s = { ...base(), hand: "a" };
    const r = resolveRound(s, favorCard, { b: { choice: "yes", tokens: 0 }, c: { choice: "yes", tokens: 0 } });
    expect(r.state.hand).toBe("a");
    expect(r.handChange).toBeNull();
  });

  it("A Mão da Princesa: maior aposta no SIM vira a Mão, trava o título e zera o Favor", () => {
    const princess = DILEMMA_BY_ID["a_mao_da_princesa"];
    expect(princess.special).toBe("princess");
    const s = { ...base(), hand: "a", favor: { a: 9, b: 2, c: 5, d: 5 } };
    const votes: Record<string, Vote> = {
      a: { choice: "no", tokens: 3 },
      b: { choice: "yes", tokens: 4 },
      c: { choice: "yes", tokens: 2 },
    };
    const r = resolveRound(s, princess, votes);
    expect(r.outcome).toBe("yes");
    expect(r.princess).toEqual({ winnerId: "b" });
    expect(r.state.hand).toBe("b");
    expect(r.state.handLocked).toBe(true);
    expect(Object.values(r.state.favor).every((f) => f === 0)).toBe(true);
    // Travado: mais favor não muda a Mão até a próxima partida.
    const favorCard2 = { ...favorCard };
    const r2 = resolveRound(r.state, favorCard2, { c: { choice: "yes", tokens: 0 } });
    expect(r2.state.hand).toBe("b");
    expect(startNextMatch(r2.state, HOUSES).handLocked).toBe(false);
  });

  it("A Mão da Princesa: empate de apostas e de favor = ninguém casa", () => {
    const princess = DILEMMA_BY_ID["a_mao_da_princesa"];
    const s = { ...base(), hand: "a", favor: { a: 5, b: 5, c: 5, d: 5 } };
    const r = resolveRound(s, princess, { b: { choice: "yes", tokens: 2 }, c: { choice: "yes", tokens: 2 } });
    expect(r.princess).toEqual({ winnerId: null });
    expect(r.state.hand).toBe("a");
    expect(r.state.favor.b).toBe(5);
  });

  it("a carta da princesa sempre aparece na campanha, qualquer que seja a duração", () => {
    for (const rounds of [4, 8, 12]) {
      for (let seed = 1; seed <= 150; seed++) {
        let s = createGame(DILEMMAS, HOUSES, players, seed, rounds, 2);
        const total = rounds * 2;
        while (s.round < total) {
          if (isMatchOver(s)) s = startNextMatch(s, HOUSES);
          const d = drawCard(s, DILEMMA_BY_ID);
          if (!d.card) break;
          s = resolveRound(d.state, d.card, { a: { choice: "abstain", tokens: 0 } }).state;
        }
        expect(s.played, `rodadas ${rounds}, seed ${seed}`).toContain("a_mao_da_princesa");
      }
    }
  });
});
