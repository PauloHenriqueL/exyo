import { Room, type Client } from "colyseus";
import type { Delayed } from "@colyseus/timer";
import { randomBytes } from "node:crypto";
import { DILEMMAS, DILEMMA_BY_ID, HOUSES } from "../shared/content";
import {
  createGame,
  drawCard,
  isCollapsed,
  isMatchOver,
  isValidVote,
  matchRound,
  previewOutcomes,
  resolveRound,
  scoreMatch,
  startNextMatch,
  type GameState,
} from "../shared/engine";
import { RESOURCES, type ClientView, type Dilemma, type FinalInfo, type IntermissionInfo, type Phase, type RevealInfo, type Vote } from "../shared/types";
import { endMatch, logEvent, playerByToken, startMatch, type PlayerRow } from "./db";

const MIN_PLAYERS = Number(process.env.MIN_PLAYERS ?? 3); // mesa mínima (humanos + bots)
const MIN_HUMANS = Number(process.env.MIN_HUMANS ?? 2); // abaixo de MIN_PLAYERS, bots completam a mesa
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS ?? 4);
// Sem cronômetro: cada fase avança quando todos os jogadores conectados clicam (ou votam).
const TOTAL_ROUNDS = Number(process.env.TOTAL_ROUNDS ?? 12); // rodadas por partida
const TOTAL_MATCHES = Number(process.env.TOTAL_MATCHES ?? 2); // partidas por campanha (o Reino é herdado)
const IDLE_DISPOSE_MS = 30 * 60 * 1000;

interface Seat {
  id: string;
  name: string;
  houseId: string | null;
  sessionId: string | null;
  isBot?: boolean;
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
  private ready = new Set<string>(); // quem já clicou "pronto" na fase atual
  private collapsePending = false; // o Reino caiu na última revelação
  private reveal: RevealInfo | null = null;
  private intermission: IntermissionInfo | null = null;
  private final: FinalInfo | null = null;
  private deadline: number | null = null;
  private idleTimer: Delayed | null = null;

  onCreate(options: { roomCode?: string }) {
    this.roomCode = String(options.roomCode ?? "").toUpperCase();
    this.setMetadata({ roomCode: this.roomCode });

    this.onMessage("pickHouse", (client, msg: { houseId: string }) => this.pickHouse(client, msg?.houseId));
    this.onMessage("vote", (client, msg: Vote) => this.castVote(client, msg));
    this.onMessage("ready", (client) => this.markReady(client));
    this.onMessage("start", (client) => this.seatOf(client) && this.startGame());
    this.onMessage("chat", (client, msg: { text?: string }) => this.chat(client, msg?.text));
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
    if (this.seats.every((s) => s.isBot || !s.sessionId)) {
      this.idleTimer = this.clock.setTimeout(() => this.disconnect(), IDLE_DISPOSE_MS);
    }
    // Quem caiu não segura a mesa: a fase pode avançar só com os que ficaram.
    if (!this.checkProgress()) this.broadcastViews();
  }

  /** Jogadores que contam para avançar: bots e humanos conectados. */
  private waitsFor(s: Seat) {
    return !s.isBot && !!s.sessionId;
  }

  /** Avança a fase se todos os conectados já clicaram/votaram. Devolve true se avançou. */
  private checkProgress(): boolean {
    if (!this.seats.some((s) => this.waitsFor(s))) return false; // ninguém na mesa: fica parado
    if (this.phase === "voting") {
      // Todos votaram, menos quem está desconectado (o voto dele vira abstenção). Bots sempre votam.
      const done = this.seats.every((s) => this.votes[s.id] || (!s.isBot && !s.sessionId));
      if (done) this.endVoting();
      return done;
    }
    if (!["discussion", "reveal", "intermission"].includes(this.phase)) return false;
    if (!this.seats.every((s) => !this.waitsFor(s) || this.ready.has(s.id))) return false;
    if (this.phase === "discussion") this.startVoting();
    else if (this.phase === "reveal" && this.collapsePending) this.finish(true);
    else this.nextRound();
    return true;
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

  /** Balão de fala: texto curto ou emoji, repassado a todos. Limite de tamanho e de 1 mensagem a cada 1,2 s. */
  private lastChat = new Map<string, number>();
  private chat(client: Client, raw: unknown) {
    const seat = this.seatOf(client);
    if (!seat || typeof raw !== "string") return;
    const text = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!text) return;
    const now = Date.now();
    if (now - (this.lastChat.get(seat.id) ?? 0) < 1200) return;
    this.lastChat.set(seat.id, now);
    this.broadcast("chat", { playerId: seat.id, text, at: now });
  }

  private markReady(client: Client) {
    const seat = this.seatOf(client);
    if (!seat || !["discussion", "reveal", "intermission"].includes(this.phase)) return;
    this.ready.add(seat.id);
    if (!this.checkProgress()) this.broadcastViews();
  }

  private castVote(client: Client, vote: Vote) {
    const seat = this.seatOf(client);
    if (!seat || this.phase !== "voting" || !this.game) return;
    // Voto aberto: o voto selado é definitivo.
    if (this.card?.openVote && this.votes[seat.id]) return;
    const v = { choice: vote?.choice, tokens: Number(vote?.tokens ?? 0) } as Vote;
    if (!isValidVote(v, this.game.tokens[seat.id] ?? 0)) return;
    this.votes[seat.id] = v;
    if (!this.checkProgress()) this.broadcastViews();
  }

  // ---------- máquina de estados ----------

  private startGame() {
    if (this.phase !== "lobby" || this.seats.length < MIN_HUMANS || !this.seats.every((s) => s.houseId)) return;
    this.fillWithBots();
    const seed = randomBytes(4).readUInt32LE();
    this.matchId = randomBytes(8).toString("hex");
    this.game = createGame(
      DILEMMAS,
      HOUSES,
      this.seats.map((s) => ({ id: s.id, houseId: s.houseId! })),
      seed,
      TOTAL_ROUNDS,
      TOTAL_MATCHES,
    );
    // Sem lock(): uma sala trancada some do matchmaking, e quem recarrega a página cairia numa sala nova
    // com o mesmo código. Quem não tem cadeira continua barrado em onAuth depois que a partida começa.
    startMatch(this.matchId, this.roomCode, seed);
    logEvent(this.matchId, "start", {
      seats: this.seats.map(({ id, houseId }) => ({ id, houseId })),
      goals: this.game.goals,
      economy: HOUSES.economy,
    });
    this.nextRound();
  }

  /** Com menos de MIN_PLAYERS humanos, bots ocupam Casas livres até completar a mesa. */
  private fillWithBots() {
    let n = 1;
    while (this.seats.length < MIN_PLAYERS) {
      const free = HOUSES.houses.filter((h) => !this.seats.some((s) => s.houseId === h.id));
      const house = free[Math.floor(Math.random() * free.length)];
      this.seats.push({ id: `bot-${n}`, name: `Autômato ${n}`, houseId: house.id, sessionId: null, isBot: true });
      n++;
    }
  }

  /** Bot vota sozinho, com um pequeno atraso: SIM/NÃO/ABSTER ao acaso; aposta 0–2 fichas. */
  private scheduleBotVotes() {
    for (const bot of this.seats.filter((s) => s.isBot)) {
      this.clock.setTimeout(() => {
        if (this.phase !== "voting" || !this.game || this.votes[bot.id]) return;
        const choice = (["yes", "no", "abstain"] as const)[Math.floor(Math.random() * 3)];
        const available = this.game.tokens[bot.id] ?? 0;
        const tokens = choice === "abstain" ? 0 : Math.min(available, Math.floor(Math.random() * 3));
        this.votes[bot.id] = { choice, tokens };
        if (!this.checkProgress()) this.broadcastViews();
      }, 1500 + Math.random() * 4000);
    }
  }

  private setPhase(phase: Phase) {
    this.phase = phase;
    this.ready = new Set();
    this.deadline = null;
    this.broadcastViews();
  }

  private nextRound() {
    if (!this.game) return;
    if (isMatchOver(this.game)) {
      return this.game.match < this.game.totalMatches ? this.startIntermission() : this.finish(false);
    }
    const { state, card } = drawCard(this.game, DILEMMA_BY_ID);
    if (!card) return this.finish(false);
    this.game = state;
    this.card = card;
    this.votes = {};
    this.ready = new Set();
    this.reveal = null;
    this.intermission = null;
    logEvent(this.matchId, "draw", { match: state.match, round: matchRound(state), card: card.id, hand: state.hand });
    this.setPhase("discussion");
  }

  private startVoting() {
    this.setPhase("voting");
    this.scheduleBotVotes();
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
      tiebreakByHand: r.tiebreakByHand,
      votes: { ...this.votes },
      text: r.variant.text,
      deltas: r.deltas,
    };
    logEvent(this.matchId, "resolve", { round: this.game.round, card: this.card.id, ...this.reveal, resources: this.game.resources });
    this.collapsePending = isCollapsed(this.game);
    this.setPhase("reveal");
  }

  /** Fim de uma partida que não é a última: placar parcial (sem objetivos) e o Reino segue para a próxima. */
  private startIntermission() {
    if (!this.game) return;
    const points = scoreMatch(this.game, HOUSES.ranges);
    const finishedMatch = this.game.match;
    this.game = startNextMatch(this.game, HOUSES);
    const history = this.game.history;
    const total = (pid: string) => history.reduce((acc, m) => acc + (m.points[pid] ?? 0), 0);
    this.intermission = {
      finishedMatch,
      scores: this.seats.map((s) => ({ playerId: s.id, points: points[s.id] ?? 0, total: total(s.id) })),
    };
    this.card = null;
    this.reveal = null;
    this.votes = {};
    this.ready = new Set();
    logEvent(this.matchId, "intermission", { finishedMatch, points, newGoals: this.game.goals, resources: this.game.resources });
    this.setPhase("intermission");
  }

  private finish(collapsed: boolean) {
    if (!this.game) return;
    const g = this.game;
    const current = scoreMatch(g, HOUSES.ranges);
    const scores = this.seats.map((s) => {
      const goals = [...g.history.map((m) => m.goals[s.id]), g.goals[s.id]];
      const matchPoints = [...g.history.map((m) => m.points[s.id] ?? 0), current[s.id] ?? 0];
      return {
        playerId: s.id,
        houseId: s.houseId!,
        goals,
        matchPoints: collapsed ? matchPoints.map(() => 0) : matchPoints,
        points: collapsed ? 0 : matchPoints.reduce((a, b) => a + b, 0),
        tokens: g.tokens[s.id] ?? 0,
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
    this.intermission = null;
    endMatch(this.matchId, { ...this.final, resources: this.game.resources });
    this.setPhase("end");
  }

  // ---------- visão por jogador ----------

  private viewFor(seat: Seat | undefined): ClientView {
    const g = this.game;
    return {
      roomCode: this.roomCode,
      phase: this.phase,
      round: g ? matchRound(g) : 0,
      totalRounds: g?.totalRounds ?? TOTAL_ROUNDS,
      match: g?.match ?? 1,
      totalMatches: g?.totalMatches ?? TOTAL_MATCHES,
      minPlayers: MIN_PLAYERS,
      minHumans: MIN_HUMANS,
      maxPlayers: MAX_PLAYERS,
      deadline: this.deadline,
      players: this.seats.map((s) => ({
        id: s.id,
        name: s.name,
        houseId: s.houseId,
        tokens: g?.tokens[s.id] ?? 0,
        connected: s.isBot || !!s.sessionId,
        isBot: !!s.isBot,
        hasVoted: !!this.votes[s.id],
        isReady: !!s.isBot || this.ready.has(s.id),
        isHand: g?.hand === s.id,
        openVote: (this.card?.openVote && this.phase === "voting" && this.votes[s.id]) || null,
      })),
      resources: g?.resources ?? { ...HOUSES.initialResources },
      card: this.card
        ? {
            id: this.card.id,
            category: this.card.category,
            title: this.card.title,
            prompt: this.card.prompt,
            question: this.card.question,
            openVote: this.card.openVote,
            preview: g ? previewOutcomes(g, this.card) : { yes: { effects: {}, later: false }, no: { effects: {}, later: false } },
          }
        : null,
      reveal: this.reveal,
      intermission: this.intermission,
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
