// AudioDirector: efeitos sonoros, ambiente de fundo e música (Howler).
// Efeitos: Kenney "RPG Audio" (CC0). Ambientes e músicas: OpenGameArt (CC0). Ver client/public/audio/LICENSE-*.txt.
import { Howl, Howler } from "howler";

export type Sfx =
  | "swordDraw"
  | "swordClash"
  | "swordRing"
  | "cardFlip"
  | "cardPlace"
  | "seal"
  | "coins"
  | "door"
  | "tick";

const FILES: Record<Sfx, { file: string; volume: number }> = {
  swordDraw: { file: "sword-draw", volume: 0.8 },
  swordClash: { file: "sword-clash", volume: 0.9 },
  swordRing: { file: "sword-ring", volume: 0.45 },
  cardFlip: { file: "card-flip", volume: 0.7 },
  cardPlace: { file: "card-place", volume: 0.6 },
  seal: { file: "seal", volume: 0.7 },
  coins: { file: "coins", volume: 0.6 },
  door: { file: "door", volume: 0.6 },
  tick: { file: "tick", volume: 0.35 },
};

const MUTE_KEY = "exyo.muted";
const cache: Partial<Record<Sfx, Howl>> = {};
const listeners = new Set<(muted: boolean) => void>();

let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
})();
Howler.mute(muted);

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  Howler.mute(m);
  if (m) {
    setAmbience(null);
    setMusic(null);
  }
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    /* sem storage: vale só para esta aba */
  }
  listeners.forEach((fn) => fn(m));
}

export function onMuteChange(fn: (muted: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function howl(name: Sfx): Howl {
  return (cache[name] ??= new Howl({ src: [`/audio/${FILES[name].file}.ogg`], volume: FILES[name].volume, preload: true }));
}

/** Toca um efeito, opcionalmente depois de `delayMs`. */
export function play(name: Sfx, delayMs = 0) {
  if (muted) return;
  if (delayMs > 0) setTimeout(() => !muted && howl(name).play(), delayMs);
  else howl(name).play();
}

/** Pré-carrega tudo (chamado na primeira interação para não atrasar o primeiro som). */
export function preload() {
  (Object.keys(FILES) as Sfx[]).forEach(howl);
}

// ---------- ambiente de fundo e música ----------
// Um ambiente por vez (conversa do conselho, floresta, pássaros) e uma música por vez, com fade.

export type Ambience = "conselho" | "floresta" | "passaros";
export type Music = "kings-feast" | "minstrel-dance" | "peasantry";

const AMBIENCE: Record<Ambience, { src: string; volume: number }> = {
  conselho: { src: "/audio/ambiente/conselho.ogg", volume: 0.16 },
  floresta: { src: "/audio/ambiente/floresta.mp3", volume: 0.35 },
  passaros: { src: "/audio/ambiente/passaros.mp3", volume: 0.25 },
};
const MUSIC: Record<Music, { src: string; volume: number }> = {
  "kings-feast": { src: "/audio/musica/kings-feast.mp3", volume: 0.16 },
  "minstrel-dance": { src: "/audio/musica/minstrel-dance.mp3", volume: 0.16 },
  peasantry: { src: "/audio/musica/peasantry.ogg", volume: 0.18 },
};
const FADE_MS = 1500;

function makeLoop(src: string, volume: number, stream: boolean) {
  // html5 = streaming: a música toca enquanto baixa, sem carregar 5 MB antes.
  return new Howl({ src: [src], loop: true, volume: 0, html5: stream, preload: !stream });
}

let ambienceNow: { name: Ambience; howl: Howl } | null = null;
let musicNow: { name: Music; howl: Howl } | null = null;

function fadeOutAndStop(h: Howl) {
  h.fade(h.volume(), 0, FADE_MS);
  setTimeout(() => h.stop(), FADE_MS + 50);
}

/** Troca o ambiente de fundo (null = silêncio). Repetir o mesmo ambiente não reinicia o som. */
export function setAmbience(name: Ambience | null) {
  if (ambienceNow?.name === name) return;
  if (ambienceNow) fadeOutAndStop(ambienceNow.howl);
  ambienceNow = null;
  if (!name || muted) return;
  const { src, volume } = AMBIENCE[name];
  const h = makeLoop(src, volume, false);
  h.play();
  h.fade(0, volume, FADE_MS);
  ambienceNow = { name, howl: h };
}

/** Troca a música (null = sem música). */
export function setMusic(name: Music | null) {
  if (musicNow?.name === name) return;
  if (musicNow) fadeOutAndStop(musicNow.howl);
  musicNow = null;
  if (!name || muted) return;
  const { src, volume } = MUSIC[name];
  const h = makeLoop(src, volume, true);
  h.play();
  h.fade(0, volume, FADE_MS * 2);
  musicNow = { name, howl: h };
}
