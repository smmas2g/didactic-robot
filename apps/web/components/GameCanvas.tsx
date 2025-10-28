"use client";

import { Application, Graphics } from "pixi.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientStateSnapshot } from "@didactic-robot/types";
import { getGameClient } from "../lib/net/client";
import { useGameStore } from "../lib/net/state";
import { MobileControls } from "./MobileControls";

const WORLD_RADIUS = 40;
const PLAYER_RADIUS = 1.1;
const ORB_RADIUS = 0.75;
const VIEW_PADDING = 24;
const TAG_TARGET_RADIUS = 3.5;

const PLAYER_COLORS = ["#38bdf8", "#f97316", "#22c55e", "#a855f7"] as const;

type DirectionState = Record<"up" | "down" | "left" | "right", boolean>;

type MoveVector = { moveX: number; moveY: number };

function buildFallbackState(time: number): ClientStateSnapshot {
  const players: ClientStateSnapshot["players"] = [];
  for (let i = 0; i < 4; i += 1) {
    const angle = (time / 2000 + i / 4) * Math.PI * 2;
    players.push({
      id: `bot-${i}`,
      name: `Bot ${i + 1}`,
      x: Math.cos(angle) * WORLD_RADIUS * 0.65,
      y: Math.sin(angle) * WORLD_RADIUS * 0.65,
      score: Math.floor((time / 1000 + i * 7) % 120),
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      taggedBy: null,
      tagSlowMs: 0,
    });
  }

  const orbs: ClientStateSnapshot["orbs"] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (time / 3000 + i / 6) * Math.PI * 2;
    orbs.push({
      id: `orb-${i}`,
      x: Math.cos(angle) * WORLD_RADIUS * 0.4,
      y: Math.sin(angle) * WORLD_RADIUS * 0.4,
      value: 1,
    });
  }

  return {
    players,
    orbs,
    localPlayerId: null,
  };
}

function directionFromState(direction: DirectionState): MoveVector {
  const x = Number(direction.right) - Number(direction.left);
  const y = Number(direction.down) - Number(direction.up);
  if (x === 0 && y === 0) {
    return { moveX: 0, moveY: 0 };
  }
  const magnitude = Math.hypot(x, y);
  return { moveX: x / magnitude, moveY: y / magnitude };
}

function combineDirections(a: DirectionState, b: DirectionState): DirectionState {
  return {
    up: a.up || b.up,
    down: a.down || b.down,
    left: a.left || b.left,
    right: a.right || b.right,
  };
}

function toCanvas(x: number, center: number, scale: number): number {
  return center + x * scale;
}

function findTagTarget(client: ReturnType<typeof getGameClient>, tagRadius: number): string | null {
  const local = client.localPlayer;
  if (!local) {
    return null;
  }

  let bestId: string | null = null;
  let bestDistance = tagRadius;

  for (const player of client.playerEntities.values()) {
    if (player.id === local.id) {
      continue;
    }
    const dx = player.renderX - local.renderX;
    const dy = player.renderY - local.renderY;
    const dist = Math.hypot(dx, dy);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestId = player.id;
    }
  }

  return bestId;
}

export default function GameCanvas(): JSX.Element {
  const client = useMemo(() => getGameClient(), []);
  const snapshot = useGameStore((state) => state.snapshot);
  const setSnapshot = useGameStore((state) => state.setSnapshot);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const containerRef = useRef<Graphics | null>(null);
  const fallbackRef = useRef<ClientStateSnapshot | null>(null);
  const snapshotRef = useRef<ClientStateSnapshot | null>(null);

  const keyboardState = useRef<DirectionState>({ up: false, down: false, left: false, right: false });
  const touchState = useRef<DirectionState>({ up: false, down: false, left: false, right: false });
  const currentVector = useRef<MoveVector>({ moveX: 0, moveY: 0 });
  const lastSentVector = useRef<MoveVector>({ moveX: NaN, moveY: NaN });
  const lastSentAt = useRef<number>(0);
  const movementLoopRef = useRef<number | null>(null);

  const [connected, setConnected] = useState(client.isConnected());
  const [fallbackSnapshot, setFallbackSnapshot] = useState<ClientStateSnapshot | null>(null);

  useEffect(() => client.subscribeConnection(setConnected), [client]);
  useEffect(() => {
    const unsubscribe = client.subscribeState((next) => {
      snapshotRef.current = next;
      setSnapshot(next);
    });
    return unsubscribe;
  }, [client, setSnapshot]);

  useEffect(() => {
    fallbackRef.current = fallbackSnapshot;
  }, [fallbackSnapshot]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const networkPlayerCount = snapshot?.players.length ?? 0;

  useEffect(() => {
    if (connected && networkPlayerCount > 0) {
      setFallbackSnapshot(null);
      return undefined;
    }

    let frame: number;
    const loop = (time: number) => {
      setFallbackSnapshot(buildFallbackState(time));
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [connected, networkPlayerCount]);

  const sendMovementVector = useCallback(
    (vector: MoveVector) => {
      client.sendInput(vector.moveX, vector.moveY, false);
      lastSentVector.current = vector;
      lastSentAt.current = performance.now();
    },
    [client]
  );

  const ensureMovementLoop = useCallback(() => {
    if (movementLoopRef.current !== null) {
      return;
    }

    const tick = (time: number) => {
      const nextFrame = requestAnimationFrame(tick);
      movementLoopRef.current = nextFrame;

      const vector = currentVector.current;
      const isMoving = vector.moveX !== 0 || vector.moveY !== 0;
      const shouldResend = isMoving && time - lastSentAt.current >= 100;

      if (shouldResend) {
        sendMovementVector(vector);
        return;
      }

      if (!isMoving && time - lastSentAt.current >= 200) {
        cancelAnimationFrame(nextFrame);
        movementLoopRef.current = null;
      }
    };

    movementLoopRef.current = requestAnimationFrame(tick);
  }, [sendMovementVector]);

  const stopMovementLoop = useCallback(() => {
    if (movementLoopRef.current !== null) {
      cancelAnimationFrame(movementLoopRef.current);
      movementLoopRef.current = null;
    }
  }, []);

  const updateMovement = useCallback(() => {
    const combined = combineDirections(keyboardState.current, touchState.current);
    const nextVector = directionFromState(combined);

    currentVector.current = nextVector;
    ensureMovementLoop();

    const hasChanged =
      !Number.isFinite(lastSentVector.current.moveX) ||
      Math.abs(lastSentVector.current.moveX - nextVector.moveX) >= 0.001 ||
      Math.abs(lastSentVector.current.moveY - nextVector.moveY) >= 0.001;

    if (hasChanged) {
      sendMovementVector(nextVector);
    }
  }, [ensureMovementLoop, sendMovementVector]);

  useEffect(() => {
    updateMovement();
  }, [updateMovement]);

  const triggerDash = useCallback(() => {
    const vector = currentVector.current;
    const targetId = findTagTarget(client, TAG_TARGET_RADIUS);
    client.sendInput(vector.moveX, vector.moveY, true, targetId);
  }, [client]);

  const handleDirectionalChange = useCallback(
    (direction: Partial<DirectionState>) => {
      Object.assign(touchState.current, direction);
      updateMovement();
    },
    [updateMovement]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      switch (event.key) {
        case "w":
        case "ArrowUp":
          keyboardState.current.up = true;
          updateMovement();
          break;
        case "s":
        case "ArrowDown":
          keyboardState.current.down = true;
          updateMovement();
          break;
        case "a":
        case "ArrowLeft":
          keyboardState.current.left = true;
          updateMovement();
          break;
        case "d":
        case "ArrowRight":
          keyboardState.current.right = true;
          updateMovement();
          break;
        case " ":
        case "Shift":
          event.preventDefault();
          triggerDash();
          break;
        default:
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.key) {
        case "w":
        case "ArrowUp":
          keyboardState.current.up = false;
          updateMovement();
          break;
        case "s":
        case "ArrowDown":
          keyboardState.current.down = false;
          updateMovement();
          break;
        case "a":
        case "ArrowLeft":
          keyboardState.current.left = false;
          updateMovement();
          break;
        case "d":
        case "ArrowRight":
          keyboardState.current.right = false;
          updateMovement();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [triggerDash, updateMovement]);

  useEffect(() => () => {
    stopMovementLoop();
  }, [stopMovementLoop]);

  useEffect(() => {
    if (!canvasRef.current || appRef.current) {
      return;
    }

    const app = new Application();
    void app.init({
      background: "#020617",
      resizeTo: canvasRef.current,
      antialias: true,
    });

    canvasRef.current.appendChild(app.canvas);
    const container = new Graphics();
    app.stage.addChild(container);

    appRef.current = app;
    containerRef.current = container;

    const tick = () => {
      if (!appRef.current || !containerRef.current) {
        return;
      }

      const deltaSeconds = appRef.current.ticker.elapsedMS / 1000;
      client.update(deltaSeconds);

      const width = appRef.current.renderer.width;
      const height = appRef.current.renderer.height;
      const scale = (Math.min(width, height) - VIEW_PADDING * 2) / (WORLD_RADIUS * 2);
      const centerX = width / 2;
      const centerY = height / 2;

      const graphics = containerRef.current;
      graphics.clear();
      graphics.lineStyle({ width: 2, color: 0x1e293b, alignment: 0 });
      graphics.beginFill(0x0f172a, 0.95);
      graphics.drawCircle(centerX, centerY, WORLD_RADIUS * scale);
      graphics.endFill();

      const drawOrb = (x: number, y: number) => {
        graphics.beginFill(0xfacc15);
        graphics.drawCircle(toCanvas(x, centerX, scale), toCanvas(y, centerY, scale), Math.max(4, ORB_RADIUS * scale));
        graphics.endFill();
      };

      const drawPlayer = (x: number, y: number, color: string, options?: { highlighted?: boolean; slowed?: boolean }) => {
        const radius = Math.max(6, PLAYER_RADIUS * scale * (options?.highlighted ? 1.2 : 1));
        const strokeColor = options?.highlighted ? 0x38bdf8 : 0x1f2937;
        graphics.lineStyle({ width: options?.highlighted ? 3 : 2, color: strokeColor });
        graphics.beginFill(parseInt(color.replace("#", ""), 16));
        graphics.drawCircle(toCanvas(x, centerX, scale), toCanvas(y, centerY, scale), radius);
        graphics.endFill();
        graphics.lineStyle({ width: 0 });
        if (options?.slowed) {
          graphics.lineStyle({ width: 2, color: 0xf87171 });
          graphics.drawCircle(toCanvas(x, centerX, scale), toCanvas(y, centerY, scale), radius + 6);
          graphics.lineStyle({ width: 0 });
        }
      };

      const activeSnapshot = snapshotRef.current;
      const colorById = new Map<string, string>();
      if (activeSnapshot) {
        for (const player of activeSnapshot.players) {
          colorById.set(player.id, player.color);
        }
      }

      if (client.playerEntities.size > 0) {
        for (const orb of client.orbEntities.values()) {
          drawOrb(orb.x, orb.y);
        }

        const localId = client.localPlayer?.id ?? null;
        for (const player of client.playerEntities.values()) {
          const color = colorById.get(player.id) ?? "#38bdf8";
          drawPlayer(player.renderX, player.renderY, color, {
            highlighted: player.id === localId,
            slowed: player.tagSlowMs > 0,
          });
        }
      } else {
        const fallback = fallbackRef.current;
        if (fallback) {
          fallback.orbs.forEach((orb) => drawOrb(orb.x, orb.y));
          fallback.players.forEach((player) => {
            drawPlayer(player.x, player.y, player.color);
          });
        }
      }
    };

    app.ticker.add(tick);

    return () => {
      app.ticker.remove(tick);
      container.destroy({ children: true });
      app.destroy(true);
      appRef.current = null;
      containerRef.current = null;
    };
  }, [client]);

  const displaySnapshot = snapshot && snapshot.players.length > 0 ? snapshot : fallbackSnapshot;
  const sortedPlayers = useMemo(() => {
    if (!displaySnapshot) {
      return [] as ClientStateSnapshot["players"];
    }
    return [...displaySnapshot.players].sort((a, b) => b.score - a.score);
  }, [displaySnapshot]);

  return (
    <div className="relative flex h-[640px] flex-col" ref={canvasRef}>
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex items-center justify-center text-sm text-slate-400">
        WASD / Arrow Keys to move • Space or Shift to dash
      </div>
      <div className="pointer-events-none absolute right-4 top-4 w-52 rounded-lg bg-slate-900/80 p-3 text-xs text-slate-200">
        <p className="mb-2 text-sm font-semibold text-slate-100">Leaderboard</p>
        <ul className="space-y-1">
          {sortedPlayers.map((player) => (
            <li key={player.id} className="flex items-center justify-between">
              <span className="truncate" title={player.name}>
                {player.name}
              </span>
              <span className="font-semibold">{player.score}</span>
            </li>
          ))}
        </ul>
      </div>
      <MobileControls
        onDirectionalChange={handleDirectionalChange}
        onDash={triggerDash}
        onEmote={(emoji) => console.info("Emote", emoji)}
      />
    </div>
  );
}
