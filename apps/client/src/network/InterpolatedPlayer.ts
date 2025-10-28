export interface AuthoritativePlayerState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  taggedBy: string | null;
  tagSlowMs: number;
}

export class InterpolatedPlayer {
  readonly id: string;
  name: string;

  private targetX = 0;
  private targetY = 0;
  private targetVx = 0;
  private targetVy = 0;

  private interpolatedX = 0;
  private interpolatedY = 0;

  private smoothing = 12;

  score = 0;
  taggedBy: string | null = null;
  tagSlowMs = 0;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  setAuthoritativeState(state: AuthoritativePlayerState) {
    this.targetX = state.x;
    this.targetY = state.y;
    this.targetVx = state.vx;
    this.targetVy = state.vy;
    this.score = state.score;
    this.taggedBy = state.taggedBy;
    this.tagSlowMs = state.tagSlowMs;
  }

  snapToAuthoritative() {
    this.interpolatedX = this.targetX;
    this.interpolatedY = this.targetY;
  }

  update(deltaSeconds: number) {
    const lerpFactor = 1 - Math.exp(-this.smoothing * deltaSeconds);
    this.interpolatedX += (this.targetX - this.interpolatedX) * lerpFactor;
    this.interpolatedY += (this.targetY - this.interpolatedY) * lerpFactor;
  }

  get renderX(): number {
    return this.interpolatedX;
  }

  get renderY(): number {
    return this.interpolatedY;
  }
}
