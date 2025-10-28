export type PlayerId = string;

export interface RoomMessage<TPayload = unknown> {
  type: string;
  payload: TPayload;
}
export interface GamePlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  score: number;
  isTagger: boolean;
}

export interface GameOrbState {
  id: string;
  x: number;
  y: number;
}

export interface GameInputState {
  id: string;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  dash: boolean;
  sequence: number;
}

export interface GameStateSnapshot {
  players: Record<string, GamePlayerState>;
  orbs: GameOrbState[];
  inputs: GameInputState[];
  roundTimeRemaining: number;
}

export const WORLD_WIDTH = 600;
export const WORLD_HEIGHT = 400;
export const ORB_RADIUS = 8;
export const PLAYER_RADIUS = 12;
export const PLAYER_MAX_SPEED = 200;
export const PLAYER_ACCELERATION = 600;
export const DASH_SPEED = 420;
export const DASH_COOLDOWN_MS = 1500;
