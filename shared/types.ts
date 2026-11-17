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

export interface HousesFile {
  ranges: { high: [number, number]; moderate: [number, number] };
  initialResources: Resources;
  houses: House[];
}

export type Choice = "yes" | "no" | "abstain";
export interface Vote {
  choice: Choice;
  tokens: number;
}

export type Phase = "lobby" | "discussion" | "voting" | "reveal" | "end";

/** Carta como o cliente a vê: sem efeitos. */
export interface PublicCard {
  id: string;
  category: Category;
  title: string;
  prompt: string;
  question: string;
}

export interface PublicPlayer {
  id: string;
  name: string;
  houseId: string | null;
  tokens: number;
  connected: boolean;
  hasVoted: boolean;
  isBot: boolean;
}

export interface RevealInfo {
  outcome: Outcome;
  yesWeight: number;
  noWeight: number;
  votes: Record<string, Vote>;
  text: string;
  deltas: Partial<Resources>;
}

export interface FinalInfo {
  collapsed: boolean;
  scores: { playerId: string; houseId: string; goal: Goal; points: number; tokens: number }[];
  winnerIds: string[];
}

/** Estado enviado a um jogador específico. */
export interface ClientView {
  roomCode: string;
  phase: Phase;
  round: number;
  totalRounds: number;
  minPlayers: number;
  maxPlayers: number;
  minHumans: number;
  deadline: number | null;
  players: PublicPlayer[];
  resources: Resources;
  card: PublicCard | null;
  reveal: RevealInfo | null;
  final: FinalInfo | null;
  me: { id: string; goal: Goal | null; vote: Vote | null };
  ranges: HousesFile["ranges"];
}
