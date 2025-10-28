export type PlayerId = string;

export interface RoomMessage<TPayload = unknown> {
  type: string;
  payload: TPayload;
}

export interface ClientPlayerState {
  id: PlayerId;
  name: string;
  x: number;
  y: number;
  score: number;
  color: string;
  taggedBy: PlayerId | null;
  tagSlowMs: number;
}

export interface ClientOrbState {
  id: string;
  x: number;
  y: number;
  value: number;
}

export interface ClientStateSnapshot {
  players: ClientPlayerState[];
  orbs: ClientOrbState[];
  localPlayerId: PlayerId | null;
}

export interface ConnectionStateSummary {
  connected: boolean;
  latencyMs: number;
}
