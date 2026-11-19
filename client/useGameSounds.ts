import { useEffect, useRef } from "react";
import type { ClientView } from "../shared/types";
import { play, startMurmur, stopMurmur } from "./audio";

/** Toca os sons de cada transição da partida, a partir da visão que chega do servidor. */
export function useGameSounds(view: ClientView | null) {
  const prev = useRef<ClientView | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = view;
    if (!view) return;

    const phaseChanged = before?.phase !== view.phase;
    const newCard = view.card && (before?.card?.id !== view.card.id || before?.round !== view.round);
    const war = view.card?.category === "war";

    if (view.phase === "discussion" && newCard) {
      play("cardFlip");
      play("cardPlace", 450);
      if (war) {
        play("swordDraw", 600);
        play("swordClash", 950);
        play("swordRing", 1000);
      }
    }

    if (view.phase === "discussion") startMurmur();
    else stopMurmur();

    if (phaseChanged && view.phase === "voting") play("confirm");

    if (phaseChanged && view.phase === "reveal" && view.reveal) {
      view.players.forEach((_, i) => play("seal", i * 400));
      const after = view.players.length * 400 + 200;
      play("bell", after);
      if (war) {
        play("swordClash", after);
        play("swordRing", after + 60);
      }
      const meBefore = before?.players.find((p) => p.id === view.me.id)?.tokens;
      const meNow = view.players.find((p) => p.id === view.me.id)?.tokens;
      if (meBefore !== undefined && meNow !== undefined && meBefore !== meNow) play("coins", after + 300);
    }

    if (phaseChanged && view.phase === "intermission") {
      play("door");
      play("bell", 700);
    }

    if (phaseChanged && view.phase === "end") play(view.final?.collapsed ? "swordRing" : "bell");
  }, [view]);

  // Tique-taque nos últimos 5 segundos da votação.
  const deadline = view?.phase === "voting" ? view.deadline : null;
  useEffect(() => {
    if (!deadline) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let s = 5; s >= 1; s--) {
      const ms = deadline - s * 1000 - Date.now();
      if (ms > 0) timers.push(setTimeout(() => play("tick"), ms));
    }
    return () => timers.forEach(clearTimeout);
  }, [deadline]);

  useEffect(() => () => stopMurmur(), []);
}
