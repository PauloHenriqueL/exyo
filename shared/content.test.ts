// Validação do conteúdo (cartas e Casas) e simulação de campanhas para balanceamento.
import { readdirSync } from "node:fs";
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

  it("há histórias suficientes: cada campanha joga umas 6, então o baralho precisa de pelo menos 8", () => {
    expect(DILEMMAS.filter((d) => d.kind === "root").length).toBeGreaterThanOrEqual(8);
  });

  it("toda história tem pelo menos 2 cartas depois da raiz, por qualquer caminho", () => {
    const continues = (id: string, o: "yes" | "no" | "tie") => DILEMMA_BY_ID[id].outcomes[o].every((v) => v.inject?.length);
    for (const r of DILEMMAS.filter((d) => d.kind === "root")) {
      for (const o of OUTCOMES) {
        expect(continues(r.id, o), `${r.id}.${o} não traz consequência`).toBe(true);
        for (const v of r.outcomes[o])
          for (const inj of v.inject ?? [])
            for (const o2 of ["yes", "no"] as const)
              for (const v2 of DILEMMA_BY_ID[inj.card].outcomes[o2])
                expect(!!v2.inject?.length || !!v2.kingDeath, `${r.id} → ${inj.card}.${o2} termina cedo demais`).toBe(true);
      }
    }
  });

  it("o empate segue o pior caminho: se SIM ou NÃO continua a história, o empate também (exceto quando o Rei morre)", () => {
    for (const d of DILEMMAS) {
      const continues = (["yes", "no"] as const).some((o) => d.outcomes[o].some((v) => v.inject?.length));
      if (continues) for (const v of d.outcomes.tie) expect(!!v.inject?.length || !!v.kingDeath, d.id).toBe(true);
    }
  });

  it("cartas compartilhadas existem e cada uma é trazida por mais de uma carta", () => {
    const shared = DILEMMAS.filter((d) => d.shared);
    expect(shared.length).toBeGreaterThanOrEqual(4);
    for (const c of shared) {
      const from = new Set(DILEMMAS.filter((d) => OUTCOMES.some((o) => d.outcomes[o].some((v) => v.inject?.some((i) => i.card === c.id)))).map((d) => d.id));
      expect(from.size, c.id).toBeGreaterThan(1);
    }
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

  it("todo recurso aparece em cartas suficientes (nenhum fica esquecido)", () => {
    const count: Record<string, number> = {};
    for (const d of DILEMMAS) for (const o of OUTCOMES) for (const v of d.outcomes[o]) for (const r of Object.keys(v.effects)) count[r] = (count[r] ?? 0) + 1;
    const total = Object.values(count).reduce((a, b) => a + b, 0);
    for (const r of RESOURCES) expect((count[r] ?? 0) / total, r).toBeGreaterThanOrEqual(0.12);
  });

  it("toda categoria de carta tem ilustração", () => {
    const arte = new Set(readdirSync(new URL("../client/public/art/cards/", import.meta.url)).map((f) => f.replace(/\.webp$/, "")));
    for (const d of DILEMMAS) expect(arte.has(d.category), `${d.id}: ${d.category}`).toBe(true);
  });

  it("textos curtos e diretos", () => {
    for (const d of DILEMMAS) {
      expect(d.prompt.length, `${d.id}: abertura`).toBeLessThanOrEqual(220);
      expect(d.question.length, `${d.id}: pergunta`).toBeLessThanOrEqual(90);
      for (const o of OUTCOMES) for (const v of d.outcomes[o]) expect(v.text.length, `${d.id}.${o}`).toBeLessThanOrEqual(130);
    }
  });

  it("efeitos cabem na trilha de −7 a +7: raiz ±1, nós do meio ±2, desfecho que fecha o caminho até ±3 em um recurso, empate nunca ajuda", () => {
    for (const d of DILEMMAS) {
      const cap = d.kind === "root" ? 1 : 2;
      for (const o of OUTCOMES)
        for (const v of d.outcomes[o]) {
          const vals = Object.values(v.effects) as number[];
          if (o === "tie") {
            for (const n of vals) expect(Math.abs(n), `${d.id}.tie`).toBeLessThanOrEqual(1);
            expect(vals.reduce((a, b) => a + b, 0), `${d.id}.tie: indecisão nunca ajuda`).toBeLessThanOrEqual(0);
            continue;
          }
          const closing = d.kind !== "root" && !v.inject?.length;
          for (const n of vals) expect(Math.abs(n), `${d.id}.${o}`).toBeLessThanOrEqual(closing ? 3 : cap);
          expect(vals.filter((n) => Math.abs(n) > cap).length, `${d.id}.${o}: só um recurso pode passar de ±${cap}`).toBeLessThanOrEqual(closing ? 1 : 0);
        }
    }
  });
});

describe("Casas", () => {
  it("valores iniciais cobrem exatamente os recursos do jogo", () => {
    expect(Object.keys(HOUSES.initialResources).sort()).toEqual([...RESOURCES].sort());
    for (const h of HOUSES.houses) for (const g of h.goals) for (const r of [...g.high, ...g.moderate]) expect(RESOURCES, `${g.id}: ${r}`).toContain(r);
  });

  it("cada Casa tem 2 objetivos com 5 recursos distintos", () => {
    for (const h of HOUSES.houses) {
      expect(h.goals.length).toBe(2);
      for (const g of h.goals) expect(new Set([...g.high, ...g.moderate]).size).toBe(5);
    }
  });
});

describe("simulação de campanhas (votos aleatórios)", () => {
  it("2 partidas de 12 rodadas: sem cartas repetidas e colapso dentro do esperado", () => {
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
          const t = d.state.tokens[p.id] ?? 0;
          const c = t > 0 ? (["yes", "no", "abstain"] as const)[Math.floor(rand() * 3)] : "abstain";
          votes[p.id] = { choice: c, tokens: c === "abstain" ? 0 : 1 };
        }
        s = resolveRound(d.state, d.card, votes).state;
        dead = isCollapsed(s);
      }
      if (dead) collapsed++;
      const story = s.played.filter((id) => !DILEMMA_BY_ID[id].shared);
      expect(new Set(story).size, `seed ${seed}: carta de história repetida`).toBe(story.length);
    }
    const rate = collapsed / N;
    console.log(`campanha 2×12: colapso em ${(rate * 100).toFixed(1)}% · baralho curto em ${shortDeck}`);
    expect(shortDeck).toBe(0);
    // Histórias longas com consequências de ±2 e desfechos de ±3: votando ao acaso o Reino cai em ~82% das
    // campanhas; uma mesa meio atenta, em ~7%; jogadores que olham a prévia, em ~1% (npm run balance).
    // Este limite só pega pioras.
    expect(rate).toBeLessThan(0.9);
  });
});
