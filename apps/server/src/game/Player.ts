import { Schema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string")
  id: string;

  @type("string")
  name: string;

  @type("float32")
  x = 0;

  @type("float32")
  y = 0;

  @type("float32")
  vx = 0;

  @type("float32")
  vy = 0;

  @type("float32")
  dashCooldownMs = 0;

  @type("float32")
  dashTimeRemainingMs = 0;

  @type("float32")
  dashFxMs = 0;

  @type("float32")
  tagSlowMs = 0;

  @type("string")
  taggedBy: string | null = null;

  @type("uint16")
  score = 0;

  @type("uint32")
  lastProcessedInput = 0;

  constructor(id: string, name: string) {
    super();
    this.id = id;
    this.name = name;
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vy);
  }

  applyFriction(friction: number) {
    this.vx *= friction;
    this.vy *= friction;
  }

  addVelocity(dx: number, dy: number) {
    this.vx += dx;
    this.vy += dy;
  }

  setVelocity(vx: number, vy: number) {
    this.vx = vx;
    this.vy = vy;
  }

  addPosition(dx: number, dy: number) {
    this.x += dx;
    this.y += dy;
  }

  clampPosition(radius: number) {
    const dist = Math.hypot(this.x, this.y);
    if (dist > radius) {
      const scale = radius / dist;
      this.x *= scale;
      this.y *= scale;
      this.vx = 0;
      this.vy = 0;
    }
  }

  tickTimers(deltaMs: number) {
    this.dashCooldownMs = Math.max(0, this.dashCooldownMs - deltaMs);
    this.dashTimeRemainingMs = Math.max(0, this.dashTimeRemainingMs - deltaMs);
    this.dashFxMs = Math.max(0, this.dashFxMs - deltaMs);
    this.tagSlowMs = Math.max(0, this.tagSlowMs - deltaMs);
    if (this.tagSlowMs === 0) {
      this.taggedBy = null;
    }
  }

  isDashing(): boolean {
    return this.dashTimeRemainingMs > 0;
  }

  canDash(): boolean {
    return this.dashCooldownMs <= 0;
  }

  triggerDash(durationMs: number, cooldownMs: number, fxMs: number) {
    this.dashTimeRemainingMs = durationMs;
    this.dashCooldownMs = cooldownMs;
    this.dashFxMs = fxMs;
  }

  applyTagSlow(durationMs: number, taggedBy: string | null) {
    this.tagSlowMs = durationMs;
    this.taggedBy = taggedBy;
  }
}
