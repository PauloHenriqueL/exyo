import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

function Sword({ hilt = "#c9a227" }: { hilt?: string }) {
  return (
    <svg viewBox="0 0 40 220" width="40" height="220" aria-hidden="true">
      <defs>
        <linearGradient id="blade" x1="0" x2="1">
          <stop offset="0" stopColor="#f4f6f8" />
          <stop offset="0.5" stopColor="#b9c2cb" />
          <stop offset="1" stopColor="#7d8791" />
        </linearGradient>
      </defs>
      <path d="M20 0 L28 22 V150 H12 V22 Z" fill="url(#blade)" stroke="#3a3f45" strokeWidth="1.5" />
      <path d="M20 8 V148" stroke="#8a939c" strokeWidth="1.2" />
      <rect x="0" y="150" width="40" height="9" rx="3" fill={hilt} stroke="#4a3610" strokeWidth="1.5" />
      <rect x="15" y="159" width="10" height="42" rx="3" fill="#5a3a1e" stroke="#2b1d0e" strokeWidth="1.5" />
      <path d="M15 168 h10 M15 177 h10 M15 186 h10" stroke="#2b1d0e" strokeWidth="1" opacity=".7" />
      <circle cx="20" cy="208" r="8" fill={hilt} stroke="#4a3610" strokeWidth="1.5" />
    </svg>
  );
}

const SPARKS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1);
  const dist = 70 + ((i * 37) % 60);
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, size: 4 + (i % 3) * 2 };
});

/** Duas espadas cruzam sobre a carta, com clarão e faíscas. Dispara de novo a cada `trigger` diferente. */
export function SwordClash({ trigger }: { trigger: string | null }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!trigger || reduce) return;
    setShown(trigger);
    const t = setTimeout(() => setShown(null), 2200);
    return () => clearTimeout(t);
  }, [trigger, reduce]);

  const hit = 0.95; // segundos até as lâminas se encontrarem (casa com o som de choque)
  return (
    <AnimatePresence>
      {shown && (
        <motion.div key={shown} className="clash" aria-hidden="true" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.4 } }}>
          <motion.div
            className="sword"
            initial={{ x: -320, y: 40, rotate: -120, opacity: 0 }}
            animate={{ x: -38, y: 0, rotate: -38, opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.4, ease: [0.5, 0, 0.9, 0.6] }}
          >
            <Sword />
          </motion.div>
          <motion.div
            className="sword"
            initial={{ x: 320, y: 40, rotate: 120, opacity: 0 }}
            animate={{ x: 38, y: 0, rotate: 38, opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.4, ease: [0.5, 0, 0.9, 0.6] }}
          >
            <Sword hilt="#b8bec6" />
          </motion.div>
          <motion.div
            className="flash"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.8, 2.4], opacity: [0, 1, 0] }}
            transition={{ delay: hit, duration: 0.5 }}
          />
          {SPARKS.map((s, i) => (
            <motion.span
              key={i}
              className="spark"
              style={{ width: s.size, height: s.size }}
              initial={{ x: 0, y: -30, opacity: 0 }}
              animate={{ x: s.x, y: s.y - 30 + 40, opacity: [0, 1, 0] }}
              transition={{ delay: hit, duration: 0.7, ease: "easeOut" }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

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
