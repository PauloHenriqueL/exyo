import { motion } from "framer-motion";

/** Token da Mão do Rei: o mesmo `layoutId` faz a coroa voar de um jogador para o outro quando o título muda. */
export function HandCrown({ size = 22 }: { size?: number }) {
  return (
    <motion.span
      layoutId="hand-crown"
      className="hand-crown"
      title="Mão do Rei: desempata as votações"
      aria-label="Mão do Rei"
      transition={{ type: "spring", stiffness: 160, damping: 18 }}
    >
      <svg viewBox="0 0 64 48" width={size} height={(size * 48) / 64} aria-hidden="true">
        <path d="M4 40 L8 10 L22 24 L32 4 L42 24 L56 10 L60 40 Z" fill="#e8c24a" stroke="#6b4a10" strokeWidth="3" strokeLinejoin="round" />
        <rect x="4" y="38" width="56" height="8" rx="2" fill="#c9a227" stroke="#6b4a10" strokeWidth="3" />
        <circle cx="32" cy="28" r="4" fill="#9e1b1b" />
        <circle cx="18" cy="31" r="3" fill="#3d6fa8" />
        <circle cx="46" cy="31" r="3" fill="#3f6b3a" />
      </svg>
    </motion.span>
  );
}
