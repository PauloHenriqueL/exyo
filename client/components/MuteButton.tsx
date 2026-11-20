import { useEffect, useState } from "react";
import { isMuted, onMuteChange, play, preload, setMuted } from "../audio";

export function MuteButton() {
  const [muted, setState] = useState(isMuted);
  useEffect(() => {
    const off = onMuteChange(setState);
    return () => {
      off();
    };
  }, []);

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    if (!next) {
      preload();
      play("cardPlace");
    }
  };

  return (
    <button className="mute" onClick={toggle} aria-pressed={muted} aria-label={muted ? "Ligar o som" : "Desligar o som"} title={muted ? "Ligar o som" : "Desligar o som"}>
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
