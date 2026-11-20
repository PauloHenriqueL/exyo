import { useEffect, useRef } from "react";
import type { ClientView } from "../shared/types";
import { play, setAmbience, setMusic, type Ambience, type Music } from "./audio";

/** Ambiente de fundo de cada tipo de carta: conversa do conselho, ou natureza lá fora. */
const AMBIENCE_BY_CATEGORY: Record<string, Ambience> = {
  nature: "floresta",
  plague: "passaros",
  war: "conselho",
  feast: "conselho",
  diplomacy: "conselho",
  trade: "conselho",
  faith: "conselho",
  crime: "conselho",
};
const SOMETIMES: Music[] = ["minstrel-dance", "peasantry"];

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

    // Ambiente e música: ambiente na discussão e na votação; música na abertura, no intervalo, no fim,
    // nas cartas de Banquete e, de vez em quando (1 em 4 cartas), baixinho durante a discussão.
    if (view.phase === "discussion" || view.phase === "voting") {
      setAmbience(AMBIENCE_BY_CATEGORY[view.card?.category ?? ""] ?? "conselho");
    } else if (view.phase === "reveal") {
      // mantém o ambiente da carta
    } else {
      setAmbience(null);
    }
    if (view.phase === "intermission") setMusic("peasantry");
    else if (view.phase === "end") setMusic(view.final?.collapsed ? null : "kings-feast");
    else if (view.phase === "discussion" && newCard) {
      const pick: Music | null =
        view.card?.category === "feast" ? "kings-feast" : Math.random() < 0.25 ? SOMETIMES[Math.floor(Math.random() * SOMETIMES.length)] : null;
      setMusic(pick);
    } else if (view.phase === "lobby") setMusic(null);


    if (phaseChanged && view.phase === "reveal" && view.reveal) {
      view.players.forEach((_, i) => play("seal", i * 400));
      const after = view.players.length * 400 + 200;
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
    }

    if (phaseChanged && view.phase === "end" && view.final?.collapsed) play("swordRing");
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

  useEffect(
    () => () => {
      setAmbience(null);
      setMusic(null);
    },
    [],
  );
}
