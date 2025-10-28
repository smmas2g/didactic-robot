import Colyseus, { Room } from "colyseus.js";
import type { InputIntent } from "@didactic-robot/shared";
import { InterpolatedPlayer } from "./InterpolatedPlayer.js";
import type { OrbState } from "./OrbState.js";

interface GameRoomState {
  players: Map<string, any>;
  orbs: ArrayLike<any> & Iterable<any>;
}

export class GameClient {
  private readonly client: Colyseus.Client;
  private room?: Room<GameRoomState>;

  private readonly players = new Map<string, InterpolatedPlayer>();
  private readonly orbs = new Map<string, OrbState>();

  private inputSequence = 0;
  private localPlayerId: string | null = null;

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

  async connect(name: string) {
    this.room = await this.client.joinOrCreate<GameRoomState>("game", { name });
    this.localPlayerId = this.room.sessionId;
    this.setupStateListeners(this.room);
  }

  disconnect() {
    this.room?.leave();
    this.room = undefined;
    this.players.clear();
    this.orbs.clear();
    this.localPlayerId = null;
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

      playerState.onChange = () => {
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
      };
    };

    room.state.players.onRemove = (_playerState: any, sessionId: string) => {
      this.players.delete(sessionId);
    };

    room.state.orbs.onAdd = (orbState: any) => {
      const orb: OrbState = {
        id: orbState.id,
        x: orbState.x,
        y: orbState.y,
        value: orbState.value,
      };
      this.orbs.set(orb.id, orb);
      orbState.onChange = () => {
        const existing = this.orbs.get(orb.id);
        if (existing) {
          existing.x = orbState.x;
          existing.y = orbState.y;
          existing.value = orbState.value;
        }
      };
    };

    room.state.orbs.onRemove = (orbState: any) => {
      this.orbs.delete(orbState.id);
    };
  }

  private reconcileInputs(serverSequence: number) {
    // Client side prediction hooks would go here. For now we simply drop
    // any queued inputs older than the authoritative acknowledgement.
    this.inputSequence = Math.max(this.inputSequence, serverSequence);
  }
}
