import { motion } from "framer-motion";
import { RESOURCES, RESOURCE_LABEL, type Resources } from "../../shared/types";

import { MAX_RES, MIN_RES } from "../../shared/engine";
import { ResourceIcon } from "./ResourceIcon";
/** Casas de −7 a +7; as das pontas derrubam o Reino. */
const CELLS = Array.from({ length: MAX_RES - MIN_RES + 1 }, (_, i) => i + MIN_RES);

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
                <ResourceIcon r={r} /> {RESOURCE_LABEL[r]}
              </span>
              <strong className={v <= MIN_RES + 2 || v >= MAX_RES - 2 ? "danger" : ""}>
                {v > 0 ? `+${v}` : v}
                {d ? <span className={d > 0 ? "up" : "down"}> ({d > 0 ? `+${d}` : d})</span> : null}
              </strong>
            </div>
            <div className="cells">
              {CELLS.map((c) => (
                <div key={c} className={`cell ${c === 0 ? "zero" : ""} ${c <= MIN_RES || c >= MAX_RES ? "doom" : ""}`}>
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
