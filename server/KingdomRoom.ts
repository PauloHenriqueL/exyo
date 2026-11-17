import { Room, type Client } from "colyseus";
import type { Delayed } from "@colyseus/timer";
import { randomBytes } from "node:crypto";
import { DILEMMAS, DILEMMA_BY_ID, HOUSES } from "../shared/content";
import {
  createGame,
  drawCard,
  isCollapsed,
  isValidVote,
  resolveRound,
  scoreGoal,
  type GameState,
} from "../shared/engine";
import type { ClientView, Dilemma, FinalInfo, Phase, RevealInfo, Vote } from "../shared/types";
import { endMatch, logEvent, playerByToken, startMatch, type PlayerRow } from "./db";

const MIN_PLAYERS = Number(process.env.MIN_PLAYERS ?? 3);
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS ?? 4);
const DISCUSSION_MS = Number(process.env.DISCUSSION_SEC ?? 300) * 1000;
const VOTE_MS = Number(process.env.VOTE_SEC ?? 45) * 1000;
const REVEAL_MS = Number(process.env.REVEAL_SEC ?? 12) * 1000;
const TOTAL_ROUNDS = Number(process.env.TOTAL_ROUNDS ?? 12);
const IDLE_DISPOSE_MS = 30 * 60 * 1000;

interface Seat {
  id: string;
  name: string;
  houseId: string | null;
  sessionId: string | null;
}

export class KingdomRoom extends Room {
  maxClients = 8; // folga para reconexões; as cadeiras são limitadas a MAX_PLAYERS
  autoDispose = false;

  private roomCode = "";
  private matchId = "";
  private phase: Phase = "lobby";
  private seats: Seat[] = [];
  private game: GameState | null = null;
  private card: Dilemma | null = null;
  private votes: Record<string, Vote> = {};
  private reveal: RevealInfo | null = null;
  private final: FinalInfo | null = null;
  private deadline: number | null = null;
  private timer: Delayed | null = null;
  private idleTimer: Delayed | null = null;

  onCreate(options: { roomCode?: string }) {
    this.roomCode = String(options.roomCode ?? "").toUpperCase();
    this.setMetadata({ roomCode: this.roomCode });

    this.onMessage("pickHouse", (client, msg: { houseId: string }) => this.pickHouse(client, msg?.houseId));
    this.onMessage("vote", (client, msg: Vote) => this.castVote(client, msg));
    this.onMessage("start", (client) => this.seatOf(client) && this.startGame());
  }

  onAuth(_client: Client, options: { token?: string }): PlayerRow {
    const player = options.token ? playerByToken(options.token) : null;
    if (!player) throw new Error("Sessão inválida. Faça login de novo.");
    const seated = this.seats.some((s) => s.id === player.id);
    if (!seated && (this.phase !== "lobby" || this.seats.length >= MAX_PLAYERS)) {
      throw new Error("A sala está cheia ou a partida já começou.");
    }
    return player;
  }

  onJoin(client: Client, _options: unknown, player: PlayerRow) {
    this.idleTimer?.clear();
    let seat = this.seats.find((s) => s.id === player.id);
    if (seat) {
      // Reconexão (ou outra aba): a sessão nova assume a cadeira.
      const old = this.clients.find((c) => c.sessionId === seat!.sessionId && c.sessionId !== client.sessionId);
      seat.sessionId = client.sessionId;
      seat.name = player.name;
      old?.leave(4000);
    } else {
      seat = { id: player.id, name: player.name, houseId: null, sessionId: client.sessionId };
      this.seats.push(seat);
    }
    this.broadcastViews();
  }

  onLeave(client: Client) {
    const seat = this.seats.find((s) => s.sessionId === client.sessionId);
    if (seat) {
      seat.sessionId = null;
      // No lobby, quem sai libera a cadeira.
      if (this.phase === "lobby") this.seats = this.seats.filter((s) => s !== seat);
    }
    if (this.seats.every((s) => !s.sessionId)) {
      this.idleTimer = this.clock.setTimeout(() => this.disconnect(), IDLE_DISPOSE_MS);
    }
    this.broadcastViews();
  }

  // ---------- ações ----------

  private seatOf(client: Client) {
    return this.seats.find((s) => s.sessionId === client.sessionId);
  }

  private pickHouse(client: Client, houseId: string) {
    const seat = this.seatOf(client);
    if (!seat || this.phase !== "lobby") return;
    if (!HOUSES.houses.some((h) => h.id === houseId)) return;
    if (this.seats.some((s) => s.houseId === houseId && s !== seat)) return; // ordem de chegada
    seat.houseId = houseId;
    this.broadcastViews();
    // Mesa cheia: começa sozinho. Com menos, alguém aperta "Iniciar partida".
    if (this.seats.length === MAX_PLAYERS && this.seats.every((s) => s.houseId)) {
      this.clock.setTimeout(() => this.startGame(), 1500);
    }
  }

  private castVote(client: Client, vote: Vote) {
    const seat = this.seatOf(client);
    if (!seat || this.phase !== "voting" || !this.game) return;
    const v = { choice: vote?.choice, tokens: Number(vote?.tokens ?? 0) } as Vote;
    if (!isValidVote(v, this.game.tokens[seat.id] ?? 0)) return;
    this.votes[seat.id] = v;
    if (this.seats.every((s) => this.votes[s.id])) this.endVoting();
    else this.broadcastViews();
  }

  // ---------- máquina de estados ----------

  private startGame() {
    if (this.phase !== "lobby" || this.seats.length < MIN_PLAYERS || !this.seats.every((s) => s.houseId)) return;
    const seed = randomBytes(4).readUInt32LE();
    this.matchId = randomBytes(8).toString("hex");
    this.game = createGame(
      DILEMMAS,
      HOUSES,
      this.seats.map((s) => ({ id: s.id, houseId: s.houseId! })),
      seed,
      TOTAL_ROUNDS,
    );
    this.lock();
    startMatch(this.matchId, this.roomCode, seed);
    logEvent(this.matchId, "start", { seats: this.seats.map(({ id, houseId }) => ({ id, houseId })), goals: this.game.goals });
    this.nextRound();
  }

  private setPhase(phase: Phase, ms: number | null, then?: () => void) {
    this.timer?.clear();
    this.phase = phase;
    this.deadline = ms ? Date.now() + ms : null;
    if (ms && then) this.timer = this.clock.setTimeout(then, ms);
    this.broadcastViews();
  }

  private nextRound() {
    if (!this.game) return;
    if (this.game.round >= this.game.totalRounds) return this.finish(false);
    const { state, card } = drawCard(this.game, DILEMMA_BY_ID);
    if (!card) return this.finish(false);
    this.game = state;
    this.card = card;
    this.votes = {};
    this.reveal = null;
    logEvent(this.matchId, "draw", { round: state.round, card: card.id });
    this.setPhase("discussion", DISCUSSION_MS, () => this.startVoting());
  }

  private startVoting() {
    this.setPhase("voting", VOTE_MS, () => this.endVoting());
  }

  private endVoting() {
    if (!this.game || !this.card || this.phase !== "voting") return;
    for (const s of this.seats) this.votes[s.id] ??= { choice: "abstain", tokens: 0 };
    const r = resolveRound(this.game, this.card, this.votes);
    this.game = r.state;
    this.reveal = {
      outcome: r.outcome,
      yesWeight: r.yesWeight,
      noWeight: r.noWeight,
      votes: { ...this.votes },
      text: r.variant.text,
      deltas: r.deltas,
    };
    logEvent(this.matchId, "resolve", { round: this.game.round, card: this.card.id, ...this.reveal, resources: this.game.resources });
    const collapsed = isCollapsed(this.game);
    this.setPhase("reveal", REVEAL_MS, () => (collapsed ? this.finish(true) : this.nextRound()));
  }

  private finish(collapsed: boolean) {
    if (!this.game) return;
    const scores = this.seats.map((s) => {
      const goal = this.game!.goals[s.id];
      return {
        playerId: s.id,
        houseId: s.houseId!,
        goal,
        points: collapsed ? 0 : scoreGoal(goal, this.game!.resources, HOUSES.ranges),
        tokens: this.game!.tokens[s.id] ?? 0,
      };
    });
    let winnerIds: string[] = [];
    if (!collapsed) {
      const best = Math.max(...scores.map((s) => s.points));
      const top = scores.filter((s) => s.points === best);
      const bestTokens = Math.max(...top.map((s) => s.tokens));
      winnerIds = top.filter((s) => s.tokens === bestTokens).map((s) => s.playerId);
    }
    this.final = { collapsed, scores, winnerIds };
    this.card = null;
    endMatch(this.matchId, { ...this.final, resources: this.game.resources });
    this.setPhase("end", null);
  }

  // ---------- visão por jogador ----------

  private viewFor(seat: Seat | undefined): ClientView {
    const g = this.game;
    return {
      roomCode: this.roomCode,
      phase: this.phase,
      round: g?.round ?? 0,
      totalRounds: g?.totalRounds ?? TOTAL_ROUNDS,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      deadline: this.deadline,
      players: this.seats.map((s) => ({
        id: s.id,
        name: s.name,
        houseId: s.houseId,
        tokens: g?.tokens[s.id] ?? 0,
        connected: !!s.sessionId,
        hasVoted: !!this.votes[s.id],
      })),
      resources: g?.resources ?? { ...HOUSES.initialResources },
      card: this.card
        ? { id: this.card.id, category: this.card.category, title: this.card.title, prompt: this.card.prompt, question: this.card.question }
        : null,
      reveal: this.reveal,
      final: this.final,
      me: {
        id: seat?.id ?? "",
        goal: (seat && g?.goals[seat.id]) || null,
        vote: (seat && this.phase === "voting" && this.votes[seat.id]) || null,
      },
      ranges: HOUSES.ranges,
    };
  }

  private broadcastViews() {
    for (const client of this.clients) {
      const seat = this.seats.find((s) => s.sessionId === client.sessionId);
      client.send("view", this.viewFor(seat));
    }
  }
}
