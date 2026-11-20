import { RESOURCES, RESOURCE_LABEL, type ClientView, type Goal, type Resources } from "../../shared/types";

import { ResourceIcon } from "./ResourceIcon";
const CELLS = Array.from({ length: 21 }, (_, i) => i - 10);
const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/**
 * Objetivo secreto como cópia da trilha de estabilidade do Reino: em cada recurso, a faixa que
 * o jogador quer atingir fica marcada e o valor atual aparece no lugar certo.
 */
export function GoalBoard({ goal, ranges, resources }: { goal: Goal; ranges: ClientView["ranges"]; resources: Resources }) {
  return (
    <div className="goal-board" aria-label="Seu objetivo secreto na trilha do Reino">
      {RESOURCES.map((r) => {
        const kind = goal.high.includes(r) ? "high" : "moderate";
        const [lo, hi] = ranges[kind];
        const v = resources[r];
        const ok = v >= lo && v <= hi;
        return (
          <div key={r} className={`goal-track ${ok ? "ok" : ""}`}>
            <div className="goal-label">
              <span>
                <ResourceIcon r={r} /> {RESOURCE_LABEL[r]}
              </span>
              <span className="goal-range">
                {kind === "high" ? "alto" : "moderado"} · {fmt(lo)} a {fmt(hi)} <b>{ok ? "✓" : fmt(v)}</b>
              </span>
            </div>
            <div className="goal-cells">
              {CELLS.map((c) => (
                <span key={c} className={`gcell ${c >= lo && c <= hi ? "target" : ""} ${c === 0 ? "zero" : ""}`}>
                  {c === v && <span className="gmarker" title={`Agora: ${fmt(v)}`} />}
                </span>
              ))}
            </div>
          </div>
        );
      })}
      <p className="goal-legend">
        <span className="gcell target legend-swatch" /> faixa do seu objetivo · <span className="gmarker legend-dot" /> valor atual · ✓ cumprido (1 ponto)
      </p>
    </div>
  );
}
