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

/** Lado da votação que agrada ao Rei: quem votar nele ganha Favor do Rei, ganhe ou perca a votação. */
export interface KingFavor {
  side: "yes" | "no";
  amount: number;
  reason: string; // ligado ao gosto do Rei (ver content/king.json)
}

export interface Dilemma {
  id: string;
  kind: "root" | "consequence";
  category: Category;
  title: string;
  prompt: string;
  question: string;
  requires?: Cond;
  kingFavor?: KingFavor;
  /** Voto aberto: cada voto selado aparece para todos na hora e não pode ser trocado. */
  openVote?: boolean;
  /** Regra especial da carta (ex.: "princess" = A Mão da Princesa). */
  special?: "princess";
  /** Posição garantida no baralho, como fração da campanha (0 = primeira carta, 1 = última rodada). */
  placement?: { from: number; to: number };
  /** Texto da regra especial, mostrado na carta. */
  ruleText?: string;
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

/** Números da economia de fichas e do Favor do Rei (balanceados em scripts/balance.ts). */
export interface Economy {
  startingTokens: number; // fichas de voto de cada jogador no início
  handBonus: number; // fichas extras ao se tornar a Mão do Rei (inclusive no início)
  startingFavor: number; // Favor do Rei de cada jogador no início
}

export interface HousesFile {
  ranges: { high: [number, number]; moderate: [number, number] };
  initialResources: Resources;
  economy: Economy;
  houses: House[];
}

export interface King {
  name: string;
  epithet: string;
  intro: string;
  likes: { title: string; text: string }[];
  dislikes: { title: string; text: string }[];
}

export type Choice = "yes" | "no" | "abstain";
export interface Vote {
  choice: Choice;
  tokens: number;
  /** Roubar do Reino: o recurso perde 1 ponto e o jogador ganha 1 ficha (só votando SIM/NÃO, 1x por rodada). */
  steal?: Resource;
}

export type Phase = "lobby" | "prologue" | "discussion" | "voting" | "reveal" | "intermission" | "end";

/** Carta como o cliente a vê: sem efeitos. */
export interface PublicCard {
  id: string;
  category: Category;
  title: string;
  prompt: string;
  question: string;
  kingFavor?: KingFavor;
  openVote?: boolean;
  special?: "princess";
  ruleText?: string;
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
  favor: number; // Favor do Rei
  isHand: boolean; // tem o token de Mão do Rei (desempata)
  /** Em carta de Voto aberto: o voto selado, visível para todos. */
  openVote: Vote | null;
}

export interface HandChange {
  from: string | null;
  to: string;
  reason: "favor" | "princess";
  bonus: number;
}

export interface RevealInfo {
  outcome: Outcome;
  yesWeight: number;
  noWeight: number;
  votes: Record<string, Vote>;
  text: string;
  deltas: Partial<Resources>; // variação total do Reino nesta rodada (roubos + carta)
  tiebreakByHand: boolean; // empate decidido pelo voto da Mão do Rei
  steals: { playerId: string; resource: Resource }[];
  favorGains: Record<string, number>;
  handChange: HandChange | null;
  /** Carta da princesa com SIM vencedor: quem ficou com a mão dela (null = empate, ninguém). */
  princess: { winnerId: string | null } | null;
}

export interface FinalInfo {
  collapsed: boolean;
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
  handId: string | null;
  handLocked: boolean; // título travado pela carta da princesa até o fim da partida
  ranges: HousesFile["ranges"];
}
