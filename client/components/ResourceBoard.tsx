import { motion } from "framer-motion";
import { RESOURCES, RESOURCE_LABEL, type Resources } from "../../shared/types";

const ICON: Record<string, string> = { health: "✚", security: "🛡", military: "⚔", food: "🌾", wealth: "🪙" };
const CELLS = Array.from({ length: 21 }, (_, i) => i - 10);

export function ResourceBoard({ resources, deltas }: { resources: Resources; deltas?: Partial<Resources> | null }) {
  return (
    <div className="board" aria-label="Recursos do Reino">
      {RESOURCES.map((r, idx) => {
        const v = resources[r];
        const d = deltas?.[r];
        return (
          <div key={r} className="track">
            <div className="track-label">
              <span>
                {ICON[r]} {RESOURCE_LABEL[r]}
              </span>
              <strong className={v <= -7 ? "danger" : ""}>
                {v > 0 ? `+${v}` : v}
                {d ? <span className={d > 0 ? "up" : "down"}> ({d > 0 ? `+${d}` : d})</span> : null}
              </strong>
            </div>
            <div className="cells">
              {CELLS.map((c) => (
                <div key={c} className={`cell ${c === 0 ? "zero" : ""} ${c <= -8 ? "doom" : ""}`}>
                  {c === v && (
                    <motion.div
                      layoutId={`marker-${r}`}
                      className="marker"
                      transition={{ type: "spring", stiffness: 260, damping: 22, delay: d ? idx * 0.3 : 0 }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
