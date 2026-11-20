import { RESOURCES, RESOURCE_LABEL, type OutcomePreview as Preview } from "../../shared/types";
import { ResourceIcon } from "./ResourceIcon";

function Side({ label, side, p }: { label: string; side: "yes" | "no"; p: Preview }) {
  const changes = RESOURCES.filter((r) => p.effects[r]);
  return (
    <div className={`preview-side ${side}`}>
      <strong className="preview-title">{label}</strong>
      {changes.length === 0 ? (
        <span className="preview-none">o Reino não muda</span>
      ) : (
        <ul>
          {changes.map((r) => {
            const d = p.effects[r]!;
            return (
              <li key={r} className={d > 0 ? "up" : "down"}>
                <ResourceIcon r={r} />
                <span className="preview-num">{d > 0 ? `+${d}` : `−${Math.abs(d)}`}</span>
                <span>{RESOURCE_LABEL[r]}</span>
              </li>
            );
          })}
        </ul>
      )}
      {p.later && <span className="preview-later">↻ traz consequências mais tarde</span>}
    </div>
  );
}

/** O que acontece com o Reino em cada resposta, para todos entenderem o que está em jogo antes de votar. */
export function OutcomePreview({ preview }: { preview: { yes: Preview; no: Preview } }) {
  return (
    <div className="preview" aria-label="Resultado de cada resposta">
      <Side label="Se SIM" side="yes" p={preview.yes} />
      <Side label="Se NÃO" side="no" p={preview.no} />
    </div>
  );
}
