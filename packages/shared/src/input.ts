export interface InputIntent {
  sequence: number;
  moveX: number;
  moveY: number;
  dash?: boolean;
  tagTargetId?: string | null;
}

export function normalizeDirection(moveX: number, moveY: number): [number, number, number] {
  const magnitude = Math.hypot(moveX, moveY);
  if (magnitude === 0) {
    return [0, 0, 0];
  }
  return [moveX / magnitude, moveY / magnitude, magnitude];
}
