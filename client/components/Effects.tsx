import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const GENERIC = ["…", "Hmm…", "Ora…", "Mas e se…", "Escutem!", "Não sei não…"];

/** Balão de fala que aparece de tempos em tempos sobre o brasão enquanto o conselho debate. */
export function Chatter({ active, motto }: { active: boolean; motto: string }) {
  const reduce = useReducedMotion();
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    if (!active || reduce) {
      setLine(null);
      return;
    }
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const loop = (first: boolean) => {
      t = setTimeout(
        () => {
          if (!alive) return;
          setLine(Math.random() < 0.2 ? motto : GENERIC[Math.floor(Math.random() * GENERIC.length)]);
          t = setTimeout(() => {
            if (!alive) return;
            setLine(null);
            loop(false);
          }, 2200);
        },
        (first ? 600 : 2500) + Math.random() * 5000,
      );
    };
    loop(true);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [active, motto, reduce]);

  return (
    <AnimatePresence>
      {line && (
        <motion.span
          key={line}
          className="bubble"
          aria-hidden="true"
          initial={{ opacity: 0, y: 6, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 320, damping: 20 }}
        >
          {line}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
