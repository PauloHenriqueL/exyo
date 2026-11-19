import { useState } from "react";
import type { House } from "../../shared/types";

const SYMBOL: Record<string, string> = {
  aurivel: "⚖",
  ferrobranco: "⚔",
  verdemar: "❦",
  lumen: "☀",
  corvalis: "✦",
};

/** Brasão da Casa: ilustração em client/public/art/crests/<id>.webp; se faltar, o escudo desenhado em SVG. */
export function Crest({ house, size = 64 }: { house: House; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      <img
        className="crest-img"
        src={`/art/crests/${house.id}.webp`}
        width={size}
        height={size}
        alt={`Brasão da ${house.name}`}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }
  return <SvgCrest house={house} size={size} />;
}

function SvgCrest({ house, size }: { house: House; size: number }) {
  const { primary, secondary, accent } = house.colors;
  const id = `c-${house.id}`;
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 100 115" role="img" aria-label={`Brasão da ${house.name}`}>
      <defs>
        <clipPath id={id}>
          <path d="M5 5 H95 V55 C95 85 70 102 50 110 C30 102 5 85 5 55 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect x="0" y="0" width="50" height="115" fill={primary} />
        <rect x="50" y="0" width="50" height="115" fill={secondary} />
        <path d="M0 0 L100 115" stroke={accent} strokeWidth="6" opacity="0.35" />
      </g>
      <path d="M5 5 H95 V55 C95 85 70 102 50 110 C30 102 5 85 5 55 Z" fill="none" stroke="#2b1d0e" strokeWidth="4" />
      <circle cx="50" cy="50" r="22" fill={accent} stroke="#2b1d0e" strokeWidth="2" />
      <text x="50" y="60" textAnchor="middle" fontSize="28" fill="#2b1d0e">
        {SYMBOL[house.id] ?? "♜"}
      </text>
    </svg>
  );
}
