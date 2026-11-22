export const RESOURCES = ["health", "security", "military", "food", "wealth"] as const;
export type Resource = (typeof RESOURCES)[number];
export type Resources = Record<Resource, number>;

export const RESOURCE_LABEL: Record<Resource, string> = {
  health: "Saúde",
  security: "Segurança",
  military: "Força Militar",
  food: "Comida",
  wealth: "Riqueza",
};

export type Category = "war" | "feast" | "plague" | "diplomacy" | "trade" | "faith" | "crime" | "nature";

export type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  | { flag: string; eq?: boolean | number; gte?: number; lte?: number }
  | { res: Resource; gte?: number; lte?: number };

export type FlagValue = boolean | number;
export type FlagSet = FlagValue | { add: number };

export interface Variant {
  when?: Cond;
  text: string;
  effects: Partial<Resources>;
  setFlags?: Record<string, FlagSet>;
  inject?: { card: string; inRounds: number }[];
}

export type Outcome = "yes" | "no" | "tie";

export interface Dilemma {
  id: string;
  kind: "root" | "consequence";
  category: Category;
  title: string;
  prompt: string;
  question: string;
  requires?: Cond;
  /** Voto aberto: cada voto selado aparece para todos na hora e não pode ser trocado. */
  openVote?: boolean;
  /** Posição garantida no baralho, como fração da campanha (0 = primeira carta, 1 = última rodada). */
  placement?: { from: number; to: number };
  outcomes: Record<Outcome, Variant[]>;
}

export interface Goal {
  id: string;
  high: Resource[];
  moderate: Resource[];
}

export interface House {
  id: string;
  name: string;
  epithet: string;
  motto: string;
  colors: { primary: string; secondary: string; accent: string };
  goals: Goal[];
}

/** Economia de pontos de influência. */
export interface Economy {
  startingTokens: number; // pontos de influência de cada jogador no início da campanha
}

export interface HousesFile {
  ranges: { high: [number, number]; moderate: [number, number] };
  initialResources: Resources;
  economy: Economy;
  houses: House[];
}

export type Choice = "yes" | "no" | "abstain";
export interface Vote {
  choice: Choice;
  /** Pontos de influência gastos = peso do voto (mínimo 1 em SIM/NÃO; 0 ao se abster). */
  tokens: number;
}

export type Phase = "lobby" | "discussion" | "voting" | "reveal" | "intermission" | "end";

/** Carta como o cliente a vê: sem efeitos. */
/** O que acontece com o Reino se o desfecho vencer (já considerando as decisões anteriores). */
export interface OutcomePreview {
  effects: Partial<Resources>;
  later: boolean; // traz uma carta de consequência mais tarde
}

export interface PublicCard {
  preview: { yes: OutcomePreview; no: OutcomePreview };
  id: string;
  category: Category;
  title: string;
  prompt: string;
  question: string;
  openVote?: boolean;
}

export interface PublicPlayer {
  id: string;
  name: string;
  houseId: string | null;
  tokens: number;
  connected: boolean;
  hasVoted: boolean;
  isBot: boolean;
  isReady: boolean;
  isHand: boolean; // Mão do Rei desta rodada: num empate, o voto dela decide
  /** Em carta de Voto aberto: o voto selado, visível para todos. */
  openVote: Vote | null;
}

export interface RevealInfo {
  outcome: Outcome;
  yesWeight: number;
  noWeight: number;
  tiebreakByHand: boolean; // empate decidido pelo voto da Mão do Rei
  votes: Record<string, Vote>;
  text: string;
  deltas: Partial<Resources>; // variação do Reino nesta rodada
}

export interface FinalInfo {
  collapsed: boolean;
  /** Recurso que derrubou o Reino (−7 = falta, +7 = excesso). */
  collapse: { resource: Resource; value: number } | null;
  /** `goals[i]` e `matchPoints[i]` são da partida i+1; `points` é a soma. */
  scores: { playerId: string; houseId: string; goals: Goal[]; matchPoints: number[]; points: number; tokens: number }[];
  winnerIds: string[];
}

/** Intervalo entre partidas: só pontos, sem revelar objetivos (o da próxima é o outro da mesma Casa). */
export interface IntermissionInfo {
  finishedMatch: number;
  scores: { playerId: string; points: number; total: number }[];
}

/** Estado enviado a um jogador específico. */
export interface ClientView {
  roomCode: string;
  phase: Phase;
  round: number; // rodada dentro da partida atual
  totalRounds: number; // rodadas por partida
  match: number;
  totalMatches: number;
  minPlayers: number;
  maxPlayers: number;
  minHumans: number;
  deadline: number | null;
  players: PublicPlayer[];
  resources: Resources;
  card: PublicCard | null;
  reveal: RevealInfo | null;
  intermission: IntermissionInfo | null;
  final: FinalInfo | null;
  me: { id: string; goal: Goal | null; vote: Vote | null };
  ranges: HousesFile["ranges"];
}
