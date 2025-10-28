import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { nanoid } from "nanoid";
import { InputIntent, normalizeDirection } from "./intents.js";
import { Orb } from "./Orb.js";
import { Player } from "./Player.js";
import {
  DASH_COOLDOWN_MS,
  DASH_DURATION_MS,
  DASH_FX_DURATION_MS,
  DASH_SPEED_BOOST,
  FRICTION,
  MAX_ACCELERATION,
  MAX_SPEED,
  ORB_RADIUS,
  ORB_RESPAWN_DELAY_MS,
  ORB_SCORE_VALUE,
  PLAYER_RADIUS,
  STARTING_ORB_COUNT,
  TAG_RADIUS,
  TAG_SLOW_DURATION_MS,
  TAG_SLOW_MULTIPLIER,
  TICK_INTERVAL_MS,
  WORLD_RADIUS,
} from "./constants.js";

interface PendingOrbRespawn {
  orbId: string;
  timeMs: number;
}

interface ProcessedIntent {
  directionX: number;
  directionY: number;
  dash: boolean;
  sequence: number;
  tagTargetId?: string | null;
}

export class World extends Schema {
  @type({ map: Player })
  players = new MapSchema<Player>();

  @type([Orb])
  orbs = new ArraySchema<Orb>();

  private readonly intentQueue = new Map<string, InputIntent[]>();
  private readonly orbRespawnQueue: PendingOrbRespawn[] = [];

  timeMs = 0;

  addPlayer(id: string, name: string) {
    const player = new Player(id, name);
    player.x = (Math.random() - 0.5) * WORLD_RADIUS * 0.75;
    player.y = (Math.random() - 0.5) * WORLD_RADIUS * 0.75;
    this.players.set(id, player);
    this.intentQueue.set(id, []);
  }

  removePlayer(id: string) {
    this.players.delete(id);
    this.intentQueue.delete(id);
  }

  enqueueIntent(id: string, intent: InputIntent) {
    const queue = this.intentQueue.get(id);
    if (!queue) {
      return;
    }
    queue.push(intent);
  }

  private normalizeIntent(intent: InputIntent): ProcessedIntent {
    const [directionX, directionY] = normalizeDirection(intent.moveX, intent.moveY);
    return {
      directionX,
      directionY,
      dash: Boolean(intent.dash),
      sequence: intent.sequence,
      tagTargetId: intent.tagTargetId ?? null,
    };
  }

  private processIntentQueue(id: string, fallbackSequence: number): ProcessedIntent {
    const queue = this.intentQueue.get(id);
    if (!queue || queue.length === 0) {
      return {
        directionX: 0,
        directionY: 0,
        dash: false,
        sequence: fallbackSequence,
        tagTargetId: null,
      };
    }

    queue.sort((a, b) => a.sequence - b.sequence);
    const latest = queue[queue.length - 1];
    queue.length = 0;
    return this.normalizeIntent(latest);
  }

  private spawnOrb() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const id = nanoid(8);
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * (WORLD_RADIUS - ORB_RADIUS * 2);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (this.isSpaceFree(x, y)) {
        this.orbs.push(new Orb(id, x, y, ORB_SCORE_VALUE));
        return;
      }
    }
    // Fallback: force spawn even if crowded to avoid starvation.
    const fallbackId = nanoid(8);
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * (WORLD_RADIUS - ORB_RADIUS * 2);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    this.orbs.push(new Orb(fallbackId, x, y, ORB_SCORE_VALUE));
  }

  private isSpaceFree(x: number, y: number): boolean {
    for (const player of this.players.values()) {
      if (Math.hypot(player.x - x, player.y - y) < PLAYER_RADIUS + ORB_RADIUS) {
        return false;
      }
    }
    for (const orb of this.orbs) {
      if (Math.hypot(orb.x - x, orb.y - y) < ORB_RADIUS * 2) {
        return false;
      }
    }
    return true;
  }

  private ensureInitialOrbs() {
    while (this.orbs.length < STARTING_ORB_COUNT) {
      this.spawnOrb();
    }
  }

  private scheduleOrbRespawn(orbId: string) {
    this.orbRespawnQueue.push({ orbId, timeMs: ORB_RESPAWN_DELAY_MS });
  }

  private tickOrbRespawns(deltaMs: number) {
    for (let i = this.orbRespawnQueue.length - 1; i >= 0; i -= 1) {
      const respawn = this.orbRespawnQueue[i];
      respawn.timeMs -= deltaMs;
      if (respawn.timeMs <= 0) {
        this.orbRespawnQueue.splice(i, 1);
        this.spawnOrb();
      }
    }
  }

  private applyAcceleration(player: Player, intent: ProcessedIntent, deltaSeconds: number) {
    let accel = MAX_ACCELERATION;
    if (player.tagSlowMs > 0) {
      accel *= TAG_SLOW_MULTIPLIER;
    }
    const desiredVx = intent.directionX * MAX_SPEED;
    const desiredVy = intent.directionY * MAX_SPEED;
    const dvx = desiredVx - player.vx;
    const dvy = desiredVy - player.vy;
    const deltaSpeed = Math.hypot(dvx, dvy);
    if (deltaSpeed > 0) {
      const maxChange = accel * deltaSeconds;
      const scale = Math.min(1, maxChange / deltaSpeed);
      player.addVelocity(dvx * scale, dvy * scale);
    }
  }

  private resolveDash(player: Player, intent: ProcessedIntent) {
    if (!intent.dash || !player.canDash()) {
      return;
    }
    if (intent.directionX === 0 && intent.directionY === 0) {
      return;
    }
    player.triggerDash(DASH_DURATION_MS, DASH_COOLDOWN_MS, DASH_FX_DURATION_MS);
    player.setVelocity(
      player.vx + intent.directionX * DASH_SPEED_BOOST,
      player.vy + intent.directionY * DASH_SPEED_BOOST,
    );
  }

  private resolveTagging(player: Player, intent: ProcessedIntent) {
    if (!intent.tagTargetId || !player.isDashing()) {
      return;
    }
    const target = this.players.get(intent.tagTargetId);
    if (!target) {
      return;
    }
    const distance = Math.hypot(player.x - target.x, player.y - target.y);
    if (distance > TAG_RADIUS) {
      return;
    }
    target.applyTagSlow(TAG_SLOW_DURATION_MS, player.id);
    target.setVelocity(target.vx * TAG_SLOW_MULTIPLIER, target.vy * TAG_SLOW_MULTIPLIER);
  }

  private updatePlayer(player: Player, intent: ProcessedIntent, deltaMs: number) {
    const deltaSeconds = deltaMs / 1000;

    this.resolveDash(player, intent);
    this.resolveTagging(player, intent);
    this.applyAcceleration(player, intent, deltaSeconds);

    player.applyFriction(player.tagSlowMs > 0 ? Math.pow(FRICTION, 1.5) : FRICTION);

    const maxSpeed = player.isDashing() ? MAX_SPEED + DASH_SPEED_BOOST : MAX_SPEED;
    const speed = player.speed;
    if (speed > maxSpeed) {
      const clamp = maxSpeed / speed;
      player.setVelocity(player.vx * clamp, player.vy * clamp);
    }

    const moveX = player.vx * deltaSeconds;
    const moveY = player.vy * deltaSeconds;
    player.addPosition(moveX, moveY);
    player.clampPosition(WORLD_RADIUS - PLAYER_RADIUS);
    player.tickTimers(deltaMs);
    player.lastProcessedInput = intent.sequence;
  }

  private checkOrbCollection(player: Player) {
    for (let i = this.orbs.length - 1; i >= 0; i -= 1) {
      const orb = this.orbs[i];
      const dist = Math.hypot(player.x - orb.x, player.y - orb.y);
      if (dist < PLAYER_RADIUS + ORB_RADIUS) {
        player.score += orb.value;
        this.orbs.splice(i, 1);
        this.scheduleOrbRespawn(orb.id);
      }
    }
  }

  private resolvePlayerCollisions() {
    const players = Array.from(this.players.values());
    for (let i = 0; i < players.length; i += 1) {
      const a = players[i];
      for (let j = i + 1; j < players.length; j += 1) {
        const b = players[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        const minDist = PLAYER_RADIUS * 2;
        if (distance > 0 && distance < minDist) {
          const overlap = (minDist - distance) / 2;
          const nx = dx / distance;
          const ny = dy / distance;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
        }
      }
    }
  }

  update(deltaMs = TICK_INTERVAL_MS) {
    this.ensureInitialOrbs();
    this.tickOrbRespawns(deltaMs);

    for (const [id, player] of this.players.entries()) {
      const intent = this.processIntentQueue(id, player.lastProcessedInput);
      this.updatePlayer(player, intent, deltaMs);
      this.checkOrbCollection(player);
    }

    this.resolvePlayerCollisions();

    this.timeMs += deltaMs;
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
