import Colyseus, { Room } from "colyseus.js";
import type { ClientStateSnapshot, ClientPlayerState, ClientOrbState } from "@didactic-robot/types";
import type { InputIntent } from "didactic-robot-shared";
import { InterpolatedPlayer } from "./InterpolatedPlayer.js";
import type { OrbState } from "./OrbState.js";

interface GameRoomState {
  players: Map<string, any>;
  orbs: ArrayLike<any> & Iterable<any>;
}

type ConnectionListener = (connected: boolean) => void;
type StateListener = (snapshot: ClientStateSnapshot) => void;
type LatencyListener = (latencyMs: number) => void;

export class GameClient {
  private readonly client: Colyseus.Client;
  private room?: Room<GameRoomState>;

  private readonly players = new Map<string, InterpolatedPlayer>();
  private readonly orbs = new Map<string, OrbState>();
  private readonly playerColors = new Map<string, string>();

  private inputSequence = 0;
  private localPlayerId: string | null = null;

  private readonly connectionListeners = new Set<ConnectionListener>();
  private readonly stateListeners = new Set<StateListener>();
  private readonly latencyListeners = new Set<LatencyListener>();

  private latencyMs = Number.POSITIVE_INFINITY;
  private connected = false;
  private heartbeat?: ReturnType<typeof setInterval>;
  private readonly pendingPings = new Map<string, number>();

  private lastSnapshot: ClientStateSnapshot = {
    players: [],
    orbs: [],
    localPlayerId: null,
  };

  constructor(serverUrl: string) {
    this.client = new Colyseus.Client(serverUrl);
  }

  get playerEntities(): ReadonlyMap<string, InterpolatedPlayer> {
    return this.players;
  }

  get orbEntities(): ReadonlyMap<string, OrbState> {
    return this.orbs;
  }

  get localPlayer(): InterpolatedPlayer | undefined {
    if (!this.localPlayerId) {
      return undefined;
    }
    return this.players.get(this.localPlayerId);
  }

  getLatency(): number {
    return this.latencyMs;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(name: string) {
    if (this.room) {
      return;
    }
    try {
      this.room = await this.client.joinOrCreate<GameRoomState>("game", { name });
      this.localPlayerId = this.room.sessionId;
      this.connected = true;
      this.notifyConnection();
      this.setupStateListeners(this.room);
      this.setupRoomHandlers(this.room);
      this.startHeartbeat();
      this.notifyStateChanged();
    } catch (error) {
      console.error("Failed to join game room", error);
      this.handleDisconnect();
      throw error;
    }
  }

  disconnect() {
    if (this.room) {
      try {
        this.room.leave();
      } catch (error) {
        console.warn("Failed to leave room", error);
      }
    }
    this.handleDisconnect();
  }

  sendInput(moveX: number, moveY: number, dash = false, tagTargetId?: string | null) {
    if (!this.room) {
      return;
    }
    this.inputSequence += 1;
    const intent: InputIntent = {
      sequence: this.inputSequence,
      moveX,
      moveY,
      dash,
      tagTargetId,
    };
    this.room.send("input", intent);
  }

  update(deltaSeconds: number) {
    for (const player of this.players.values()) {
      player.update(deltaSeconds);
    }
  }

  subscribeConnection(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.connected);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  subscribeState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.lastSnapshot);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  subscribeLatency(listener: LatencyListener): () => void {
    this.latencyListeners.add(listener);
    listener(this.latencyMs);
    return () => {
      this.latencyListeners.delete(listener);
    };
  }

  private setupRoomHandlers(room: Room<GameRoomState>) {
    room.onMessage("pong", (payload: { nonce: string }) => {
      const started = this.pendingPings.get(payload.nonce);
      if (typeof started === "number") {
        this.pendingPings.delete(payload.nonce);
        this.latencyMs = performance.now() - started;
        this.notifyLatency();
      }
    });

    room.onLeave(() => {
      this.handleDisconnect();
      setTimeout(() => {
        if (!this.room) {
          this.connect("Reconnecting").catch((error) => {
            console.error("Reconnect failed", error);
          });
        }
      }, 1000);
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    if (!this.room) {
      return;
    }

    const room = this.room;
    this.latencyMs = Number.POSITIVE_INFINITY;
    this.notifyLatency();
    const sendPing = () => {
      try {
        const nonce = crypto.randomUUID();
        this.pendingPings.set(nonce, performance.now());
        room.send("ping", { nonce });
      } catch (error) {
        console.warn("Ping failed", error);
        this.latencyMs = Number.POSITIVE_INFINITY;
        this.notifyLatency();
        this.connected = false;
        this.notifyConnection();
      }
    };

    this.heartbeat = setInterval(sendPing, 2000);
    sendPing();
  }

  private stopHeartbeat() {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = undefined;
    }
    this.pendingPings.clear();
  }

  private setupStateListeners(room: Room<GameRoomState>) {
    room.state.players.onAdd = (playerState: any, sessionId: string) => {
      const player = new InterpolatedPlayer(sessionId, playerState.name ?? "Player");
      player.setAuthoritativeState({
        id: sessionId,
        x: playerState.x,
        y: playerState.y,
        vx: playerState.vx,
        vy: playerState.vy,
        score: playerState.score,
        taggedBy: playerState.taggedBy ?? null,
        tagSlowMs: playerState.tagSlowMs ?? 0,
      });
      player.snapToAuthoritative();
      this.players.set(sessionId, player);
      this.notifyStateChanged();

      playerState.onChange = () => {
        player.name = playerState.name ?? player.name;
        player.setAuthoritativeState({
          id: sessionId,
          x: playerState.x,
          y: playerState.y,
          vx: playerState.vx,
          vy: playerState.vy,
          score: playerState.score,
          taggedBy: playerState.taggedBy ?? null,
          tagSlowMs: playerState.tagSlowMs ?? 0,
        });
        if (sessionId === this.localPlayerId && typeof playerState.lastProcessedInput === "number") {
          this.reconcileInputs(playerState.lastProcessedInput);
        }
        this.notifyStateChanged();
      };
    };

    room.state.players.onRemove = (_playerState: any, sessionId: string) => {
      this.players.delete(sessionId);
      this.playerColors.delete(sessionId);
      this.notifyStateChanged();
    };

    room.state.orbs.onAdd = (orbState: any) => {
      const orb: OrbState = {
        id: orbState.id,
        x: orbState.x,
        y: orbState.y,
        value: orbState.value,
      };
      this.orbs.set(orb.id, orb);
      this.notifyStateChanged();
      orbState.onChange = () => {
        const existing = this.orbs.get(orb.id);
        if (existing) {
          existing.x = orbState.x;
          existing.y = orbState.y;
          existing.value = orbState.value;
        }
        this.notifyStateChanged();
      };
    };

    room.state.orbs.onRemove = (orbState: any) => {
      this.orbs.delete(orbState.id);
      this.notifyStateChanged();
    };
  }

  private buildSnapshot(): ClientStateSnapshot {
    const players: ClientPlayerState[] = [];
    for (const player of this.players.values()) {
      players.push({
        id: player.id,
        name: player.name,
        x: player.renderX,
        y: player.renderY,
        score: player.score,
        color: this.getPlayerColor(player.id),
        taggedBy: player.taggedBy,
        tagSlowMs: player.tagSlowMs,
      });
    }

    const orbs: ClientOrbState[] = [];
    for (const orb of this.orbs.values()) {
      orbs.push({ ...orb });
    }

    return {
      players,
      orbs,
      localPlayerId: this.localPlayerId,
    };
  }

  private notifyStateChanged() {
    this.lastSnapshot = this.buildSnapshot();
    for (const listener of this.stateListeners) {
      listener(this.lastSnapshot);
    }
  }

  private notifyConnection() {
    for (const listener of this.connectionListeners) {
      listener(this.connected);
    }
  }

  private notifyLatency() {
    for (const listener of this.latencyListeners) {
      listener(this.latencyMs);
    }
  }

  private reconcileInputs(serverSequence: number) {
    this.inputSequence = Math.max(this.inputSequence, serverSequence);
  }

  private handleDisconnect() {
    this.stopHeartbeat();
    if (this.room && typeof (this.room as any).removeAllListeners === "function") {
      try {
        (this.room as any).removeAllListeners();
      } catch (error) {
        console.warn("Failed to remove room listeners", error);
      }
    }
    this.room = undefined;
    this.players.clear();
    this.orbs.clear();
    this.playerColors.clear();
    this.localPlayerId = null;
    this.connected = false;
    this.latencyMs = Number.POSITIVE_INFINITY;
    this.notifyLatency();
    this.notifyConnection();
    this.notifyStateChanged();
  }

  private getPlayerColor(id: string): string {
    let color = this.playerColors.get(id);
    if (!color) {
      const palette = ["#38bdf8", "#f97316", "#22c55e", "#a855f7", "#f472b6", "#facc15"];
      const index = this.playerColors.size % palette.length;
      color = palette[index];
      this.playerColors.set(id, color);
    }
    return color;
  }
}
