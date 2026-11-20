// Validação do conteúdo (cartas e Casas) e simulação de campanhas para balanceamento.
import { describe, expect, it } from "vitest";
import { DILEMMAS, DILEMMA_BY_ID, HOUSES } from "./content";
import { createGame, drawCard, isCollapsed, isMatchOver, resolveRound, rng, startNextMatch } from "./engine";
import { RESOURCES, type Cond, type Vote } from "./types";

const OUTCOMES = ["yes", "no", "tie"] as const;

function flagsRead(c: Cond | undefined, acc: Set<string>) {
  if (!c) return;
  if ("all" in c) c.all.forEach((x) => flagsRead(x, acc));
  else if ("any" in c) c.any.forEach((x) => flagsRead(x, acc));
  else if ("not" in c) flagsRead(c.not, acc);
  else if ("flag" in c) acc.add(c.flag);
}

describe("conteúdo das cartas", () => {
  it("ids únicos", () => {
    const ids = DILEMMAS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("toda carta tem SIM/NÃO/empate, com uma variante padrão (sem `when`) por último", () => {
    for (const d of DILEMMAS) {
      for (const o of OUTCOMES) {
        const vs = d.outcomes[o];
        expect(vs?.length, `${d.id}.${o}`).toBeGreaterThan(0);
        expect(vs[vs.length - 1].when, `${d.id}.${o}: última variante precisa ser a padrão`).toBeUndefined();
        for (const v of vs) {
          expect(v.text.trim(), `${d.id}.${o} sem texto`).not.toBe("");
          for (const k of Object.keys(v.effects)) expect(RESOURCES, `${d.id}.${o}: recurso ${k}`).toContain(k);
        }
      }
    }
  });

  it("injeções apontam para cartas de consequência existentes", () => {
    for (const d of DILEMMAS)
      for (const o of OUTCOMES)
        for (const v of d.outcomes[o])
          for (const inj of v.inject ?? []) {
            expect(DILEMMA_BY_ID[inj.card], `${d.id} injeta ${inj.card}`).toBeDefined();
            expect(DILEMMA_BY_ID[inj.card].kind).toBe("consequence");
            expect(inj.inRounds).toBeGreaterThan(0);
          }
  });

  it("toda consequência é injetada por alguma carta", () => {
    const injected = new Set(DILEMMAS.flatMap((d) => OUTCOMES.flatMap((o) => d.outcomes[o].flatMap((v) => (v.inject ?? []).map((i) => i.card)))));
    for (const d of DILEMMAS.filter((x) => x.kind === "consequence")) expect(injected.has(d.id), d.id).toBe(true);
  });

  it("sem flags mortas: toda flag escrita é lida em algum lugar, e toda flag lida é escrita", () => {
    const written = new Set<string>();
    const read = new Set<string>();
    for (const d of DILEMMAS) {
      flagsRead(d.requires, read);
      for (const o of OUTCOMES)
        for (const v of d.outcomes[o]) {
          flagsRead(v.when, read);
          Object.keys(v.setFlags ?? {}).forEach((f) => written.add(f));
        }
    }
    expect([...written].filter((f) => !read.has(f)), "escritas e nunca lidas").toEqual([]);
    expect([...read].filter((f) => !written.has(f)), "lidas e nunca escritas").toEqual([]);
  });

  it("há cartas iniciais suficientes para uma campanha de 2 partidas sem repetir", () => {
    expect(DILEMMAS.filter((d) => d.kind === "root").length).toBeGreaterThanOrEqual(24);
  });
});

describe("clareza das cartas", () => {
  it("SIM e NÃO sempre mudam algum recurso (a prévia nunca fica vazia)", () => {
    for (const d of DILEMMAS) {
      for (const o of ["yes", "no"] as const) {
        const padrao = d.outcomes[o][d.outcomes[o].length - 1];
        expect(Object.keys(padrao.effects).length, `${d.id}.${o}`).toBeGreaterThan(0);
      }
    }
  });

  it("sem cartas de religião", () => {
    const texto = JSON.stringify(DILEMMAS).toLowerCase();
    for (const palavra of ["bispo", "bruxa", "clero", "igreja", "relíquia", "herege"]) expect(texto, palavra).not.toContain(palavra);
  });

  it("textos das cartas são longos o bastante para imersão", () => {
    for (const d of DILEMMAS) expect(d.prompt.length, d.id).toBeGreaterThan(220);
  });
});

describe("Casas", () => {
  it("cada Casa tem 2 objetivos com 5 recursos distintos", () => {
    for (const h of HOUSES.houses) {
      expect(h.goals.length).toBe(2);
      for (const g of h.goals) expect(new Set([...g.high, ...g.moderate]).size).toBe(5);
    }
  });
});

describe("simulação de campanhas (votos aleatórios)", () => {
  it("2 partidas de 12 rodadas: colapso raro e sem cartas repetidas", () => {
    const players = HOUSES.houses.slice(0, 4).map((h, i) => ({ id: `p${i}`, houseId: h.id }));
    const N = 4000;
    let collapsed = 0;
    let shortDeck = 0;
    for (let seed = 1; seed <= N; seed++) {
      const rand = rng(seed * 7919);
      let s = createGame(DILEMMAS, HOUSES, players, seed, 12, 2);
      let dead = false;
      while (!dead) {
        if (isMatchOver(s)) {
          if (s.match >= s.totalMatches) break;
          s = startNextMatch(s, HOUSES);
        }
        const d = drawCard(s, DILEMMA_BY_ID);
        if (!d.card) {
          shortDeck++;
          break;
        }
        const votes: Record<string, Vote> = {};
        for (const p of players) {
          const c = (["yes", "no", "abstain"] as const)[Math.floor(rand() * 3)];
          const t = d.state.tokens[p.id] ?? 0;
          votes[p.id] = { choice: c, tokens: c !== "abstain" && t > 0 && rand() < 0.3 ? 1 : 0 };
        }
        s = resolveRound(d.state, d.card, votes).state;
        dead = isCollapsed(s);
      }
      if (dead) collapsed++;
      expect(new Set(s.played).size, `seed ${seed}: carta repetida`).toBe(s.played.length);
    }
    const rate = collapsed / N;
    console.log(`campanha 2×12: colapso em ${(rate * 100).toFixed(1)}% · baralho curto em ${shortDeck}`);
    expect(shortDeck).toBe(0);
    // Uma partida isolada fica perto de 1%; em 24 rodadas a deriva negativa dos empates se acumula (~18%).
    // Este limite só pega pioras de balanceamento — o valor-alvo é decisão de design.
    expect(rate).toBeLessThan(0.2);
  });
});
