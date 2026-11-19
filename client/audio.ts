// AudioDirector: efeitos sonoros (Howler) + murmúrio do conselho sintetizado (Web Audio).
// Sons: Kenney "RPG Audio" e "Interface Sounds" (CC0) — ver client/public/audio/LICENSE-*.txt.
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
  | "bell"
  | "tick"
  | "confirm";

const FILES: Record<Sfx, { file: string; volume: number }> = {
  swordDraw: { file: "sword-draw", volume: 0.8 },
  swordClash: { file: "sword-clash", volume: 0.9 },
  swordRing: { file: "sword-ring", volume: 0.45 },
  cardFlip: { file: "card-flip", volume: 0.7 },
  cardPlace: { file: "card-place", volume: 0.6 },
  seal: { file: "seal", volume: 0.7 },
  coins: { file: "coins", volume: 0.6 },
  door: { file: "door", volume: 0.6 },
  bell: { file: "bell", volume: 0.5 },
  tick: { file: "tick", volume: 0.35 },
  confirm: { file: "confirm", volume: 0.5 },
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
  if (m) stopMurmur();
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

// ---------- murmúrio do conselho ----------
// Ruído marrom filtrado na faixa da voz, com volume oscilando como uma conversa distante.

let murmur: { stop: () => void } | null = null;

export function startMurmur() {
  if (muted || murmur) return;
  preload(); // cria o AudioContext do Howler, se ainda não existir
  const ctx = Howler.ctx as AudioContext | undefined;
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const seconds = 4;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;

  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 420;
  band.Q.value = 0.9;

  const formant = ctx.createBiquadFilter();
  formant.type = "peaking";
  formant.frequency.value = 900;
  formant.gain.value = 6;

  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(band).connect(formant).connect(gain).connect(Howler.masterGain ?? ctx.destination);
  src.start();

  // "Falas": o volume e o timbre sobem e descem em sílabas irregulares.
  let alive = true;
  const speak = () => {
    if (!alive) return;
    const t = ctx.currentTime;
    const level = 0.05 + Math.random() * 0.07;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setTargetAtTime(level, t, 0.08);
    gain.gain.setTargetAtTime(0.015, t + 0.25 + Math.random() * 0.5, 0.15);
    band.frequency.setTargetAtTime(320 + Math.random() * 260, t, 0.1);
    setTimeout(speak, 350 + Math.random() * 900);
  };
  speak();

  murmur = {
    stop: () => {
      alive = false;
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setTargetAtTime(0, t, 0.3);
      setTimeout(() => {
        try {
          src.stop();
        } catch {
          /* já parado */
        }
        src.disconnect();
      }, 1500);
    },
  };
}

export function stopMurmur() {
  murmur?.stop();
  murmur = null;
}
