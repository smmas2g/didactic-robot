import { randomUUID } from "node:crypto";
import {
  DASH_COOLDOWN_MS,
  DASH_SPEED,
  GameInputState,
  GameOrbState,
  GamePlayerState,
  GameStateSnapshot,
  ORB_RADIUS,
  PLAYER_ACCELERATION,
  PLAYER_MAX_SPEED,
  PLAYER_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@didactic-robot/types";

interface InternalPlayer extends GamePlayerState {
  vx: number;
  vy: number;
  dashReadyAt: number;
  intent: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    dashQueued: boolean;
  };
}

export class World {
  private players = new Map<string, InternalPlayer>();
  private orbs: GameOrbState[] = [];
  private roundTimeRemaining = 180;
  private taggerId: string | null = null;

  constructor(private now: () => number = () => Date.now()) {
    for (let i = 0; i < 5; i += 1) {
      this.spawnOrb();
    }
  }

  addPlayer(id: string, name: string, color: string) {
    const player: InternalPlayer = {
      id,
      name,
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
      color,
      score: 0,
      isTagger: this.players.size === 0,
      vx: 0,
      vy: 0,
      dashReadyAt: this.now(),
      intent: {
        up: false,
        down: false,
        left: false,
        right: false,
        dashQueued: false,
      },
    };
    this.players.set(id, player);
    if (player.isTagger) {
      this.taggerId = id;
    }
  }

  removePlayer(id: string) {
    const wasTagger = this.taggerId === id;
    this.players.delete(id);
    if (wasTagger) {
      const next = this.players.keys().next().value ?? null;
      this.taggerId = next;
      if (next) {
        const tagger = this.players.get(next);
        if (tagger) tagger.isTagger = true;
      }
    }
  }

  applyInput(id: string, input: GameInputState) {
    const player = this.players.get(id);
    if (!player) return;

    player.intent.up = input.up;
    player.intent.down = input.down;
    player.intent.left = input.left;
    player.intent.right = input.right;
    if (input.dash) {
      player.intent.dashQueued = true;
    }
  }

  update(deltaSeconds: number) {
    this.players.forEach((player) => {
      const accelX = Number(player.intent.right) - Number(player.intent.left);
      const accelY = Number(player.intent.down) - Number(player.intent.up);

      player.vx += accelX * PLAYER_ACCELERATION * deltaSeconds;
      player.vy += accelY * PLAYER_ACCELERATION * deltaSeconds;

      const speedBeforeDash = Math.hypot(player.vx, player.vy);
      if (player.intent.dashQueued && this.now() >= player.dashReadyAt) {
        const magnitude = Math.max(1, speedBeforeDash);
        player.vx = (player.vx / magnitude) * DASH_SPEED;
        player.vy = (player.vy / magnitude) * DASH_SPEED;
        player.dashReadyAt = this.now() + DASH_COOLDOWN_MS;
        player.intent.dashQueued = false;
      }

      player.vx *= 0.9;
      player.vy *= 0.9;

      const speed = Math.hypot(player.vx, player.vy);
      if (speed > PLAYER_MAX_SPEED) {
        const scale = PLAYER_MAX_SPEED / speed;
        player.vx *= scale;
        player.vy *= scale;
      }

      player.x += player.vx * deltaSeconds;
      player.y += player.vy * deltaSeconds;

      player.x = Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH - PLAYER_RADIUS, player.x));
      player.y = Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, player.y));
    });

    this.handleOrbCollection();
    this.handleTags();

    this.roundTimeRemaining = Math.max(0, this.roundTimeRemaining - deltaSeconds);
  }

  private handleOrbCollection() {
    this.orbs = this.orbs.filter((orb) => {
      const collector = Array.from(this.players.values()).find((player) =>
        Math.hypot(player.x - orb.x, player.y - orb.y) <= PLAYER_RADIUS + ORB_RADIUS
      );
      if (!collector) return true;
      collector.score += 1;
      this.spawnOrb();
      return false;
    });
  }

  private handleTags() {
    if (!this.taggerId) return;
    const tagger = this.players.get(this.taggerId);
    if (!tagger) return;

    const victim = Array.from(this.players.values()).find(
      (player) => player.id !== tagger.id && Math.hypot(player.x - tagger.x, player.y - tagger.y) < PLAYER_RADIUS * 1.6
    );

    if (!victim) return;

    tagger.isTagger = false;
    victim.isTagger = true;
    this.taggerId = victim.id;
  }

  private spawnOrb() {
    this.orbs.push({
      id: randomUUID(),
      x: Math.random() * (WORLD_WIDTH - ORB_RADIUS * 2) + ORB_RADIUS,
      y: Math.random() * (WORLD_HEIGHT - ORB_RADIUS * 2) + ORB_RADIUS,
    });
  }

  toSnapshot(): GameStateSnapshot {
    const players: Record<string, GamePlayerState> = {};
    this.players.forEach((player) => {
      players[player.id] = {
        id: player.id,
        name: player.name,
        x: player.x,
        y: player.y,
        color: player.color,
        score: player.score,
        isTagger: player.isTagger,
      };
    });

    return {
      players,
      orbs: this.orbs.map((orb) => ({ ...orb })),
      inputs: [],
      roundTimeRemaining: Math.floor(this.roundTimeRemaining),
    };
  }
}
