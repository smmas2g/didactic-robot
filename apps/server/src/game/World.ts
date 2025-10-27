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
  }
}
