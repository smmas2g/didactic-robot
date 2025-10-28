"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  Dispatch,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from "react";
import { Container, Graphics, Stage, useTick } from "@pixi/react";
import type { Graphics as PixiGraphics } from "pixi.js";

type Vector2 = {
  x: number;
  y: number;
};

export interface GameCanvasProps {
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const JOYSTICK_RADIUS = 60;
const PLAYER_SPEED = 3;

const normalizeVector = (vector: Vector2): Vector2 => {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

interface PlayerControllerProps {
  width: number;
  height: number;
  playerPosition: Vector2;
  setPlayerPosition: Dispatch<SetStateAction<Vector2>>;
  keyboardDirectionRef: MutableRefObject<Vector2>;
  joystickVectorRef: MutableRefObject<Vector2>;
}

const PlayerController = ({
  width,
  height,
  playerPosition,
  setPlayerPosition,
  keyboardDirectionRef,
  joystickVectorRef,
}: PlayerControllerProps) => {
  useTick((delta) => {
    const keyboard = keyboardDirectionRef.current;
    const joystick = joystickVectorRef.current;
    const direction = getCombinedDirection(keyboard, joystick);

    if (direction.x === 0 && direction.y === 0) {
      return;
    }

    setPlayerPosition((prev) => ({
      x: clamp(prev.x + direction.x * PLAYER_SPEED * delta, 20, width - 20),
      y: clamp(prev.y + direction.y * PLAYER_SPEED * delta, 20, height - 20),
    }));
  });

  const drawPlayer = useCallback((graphics: PixiGraphics) => {
    graphics.clear();
    graphics.beginFill(0x4ade80);
    graphics.drawCircle(0, 0, 20);
    graphics.endFill();
  }, []);

  return (
    <Container x={playerPosition.x} y={playerPosition.y}>
      <Graphics draw={drawPlayer} />
    </Container>
  );
};

const getKeyboardDirection = (keys: Set<string>): Vector2 => {
  const direction: Vector2 = { x: 0, y: 0 };

  if (keys.has("KeyW")) direction.y -= 1;
  if (keys.has("KeyS")) direction.y += 1;
  if (keys.has("KeyA")) direction.x -= 1;
  if (keys.has("KeyD")) direction.x += 1;

  return normalizeVector(direction);
};

const getCombinedDirection = (keyboard: Vector2, joystick: Vector2): Vector2 => {
  const combined = { x: keyboard.x + joystick.x, y: keyboard.y + joystick.y };
  const magnitude = Math.hypot(combined.x, combined.y);

  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }

  if (magnitude <= 1) {
    return combined;
  }

  return {
    x: combined.x / magnitude,
    y: combined.y / magnitude,
  };
};

export const GameCanvas = ({
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: GameCanvasProps) => {
  const [playerPosition, setPlayerPosition] = useState<Vector2>({
    x: width / 2,
    y: height / 2,
  });
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const keyboardDirectionRef = useRef<Vector2>({ x: 0, y: 0 });
  const joystickVectorRef = useRef<Vector2>({ x: 0, y: 0 });
  const [joystickState, setJoystickState] = useState({
    active: false,
    offsetX: 0,
    offsetY: 0,
  });
  const joystickPointerId = useRef<number | null>(null);

  const updateKeyboardDirection = useCallback(() => {
    keyboardDirectionRef.current = getKeyboardDirection(
      pressedKeysRef.current,
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
        pressedKeysRef.current.add(event.code);
        updateKeyboardDirection();
import { Application, Graphics } from "pixi.js";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { GameInputState, GameStateSnapshot } from "@didactic-robot/types";
import { createGameClient } from "../lib/net/client";
import { useGameStore } from "../lib/net/state";
import { MobileControls } from "./MobileControls";

const PLAYER_COLORS = ["#38bdf8", "#f97316", "#22c55e", "#a855f7"];

function buildFallbackState(time: number): GameStateSnapshot {
  const players: GameStateSnapshot["players"] = {};
  for (let i = 0; i < 4; i += 1) {
    const angle = (time / 2000 + i / 4) * Math.PI * 2;
    players[`bot-${i}`] = {
      id: `bot-${i}`,
      name: `Bot ${i + 1}`,
      x: 200 + Math.cos(angle) * 120,
      y: 200 + Math.sin(angle) * 120,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      score: Math.floor((time / 1000 + i * 3) % 100),
      isTagger: i === 0,
    };
  }

  return {
    players,
    orbs: [
      { id: "orb-1", x: 300, y: 260 },
      { id: "orb-2", x: 120, y: 140 },
      { id: "orb-3", x: 380, y: 90 },
    ],
    inputs: [],
    roundTimeRemaining: Math.max(0, 180 - Math.floor(time / 1000)),
  };
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const clientRef = useRef(createGameClient());
  const inputRef = useRef<GameInputState>({
    id: "local",
    up: false,
    down: false,
    left: false,
    right: false,
    dash: false,
    sequence: 0,
  });
  const { snapshot, setSnapshot } = useGameStore();

  const pushInput = useCallback(() => {
    inputRef.current.sequence = performance.now();
    clientRef.current.sendInput({ ...inputRef.current });
  }, []);

  const updateDirection = useCallback(
    (direction: Partial<Pick<GameInputState, "up" | "down" | "left" | "right">>) => {
      Object.assign(inputRef.current, direction);
      pushInput();
    },
    [pushInput]
  );

  const triggerDash = useCallback(() => {
    inputRef.current.dash = true;
    pushInput();
    inputRef.current.dash = false;
  }, [pushInput]);

  useEffect(() => {
    const client = clientRef.current;
    const unsubState = client.subscribeState((nextSnapshot) => {
      setSnapshot(nextSnapshot);
    });

    return () => {
      unsubState();
    };
  }, [setSnapshot]);

  useEffect(() => {
    let frameId: number | null = null;

    const animate = (time: number) => {
      if (useGameStore.getState().snapshot) {
        frameId = requestAnimationFrame(animate);
        return;
      }
      setSnapshot(buildFallbackState(time));
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (!useGameStore.getState().snapshot) {
        setSnapshot(null);
      }
    };
  }, [setSnapshot]);

  const ensureApp = useCallback(() => {
    if (!canvasRef.current || appRef.current) return;

    const app = new Application();
    void app.init({
      background: "#020617",
      resizeTo: canvasRef.current,
      antialias: true,
    });

    canvasRef.current.appendChild(app.canvas);
    appRef.current = app;
  }, []);

  useEffect(() => {
    ensureApp();

    const app = appRef.current;
    if (!app) return;

    const container = new Graphics();
    app.stage.addChild(container);

    const draw = () => {
      const nextSnapshot = useGameStore.getState().snapshot;
      container.clear();
      container.removeChildren();
      container.lineStyle({ width: 2, color: 0x1e293b, alignment: 0 });
      container.beginFill(0x0f172a, 1);
      container.drawRoundedRect(40, 40, 520, 320, 24);
      container.endFill();

      if (!nextSnapshot) return;

      nextSnapshot.orbs.forEach((orb) => {
        container.beginFill(0xfacc15, 1);
        container.drawCircle(orb.x, orb.y, 8);
        container.endFill();
      });

      Object.values(nextSnapshot.players).forEach((player) => {
        container.beginFill(parseInt(player.color.replace("#", ""), 16));
        container.drawCircle(player.x, player.y, 12);
        container.endFill();

        container.lineStyle({ width: 2, color: player.isTagger ? 0xf87171 : 0x38bdf8 });
        container.drawCircle(player.x, player.y, player.isTagger ? 18 : 14);
        container.lineStyle({ width: 0 });
      });
    };

    app.ticker.add(draw);

    return () => {
      app.ticker.remove(draw);
      container.destroy({ children: true });
    };
  }, [ensureApp]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      switch (event.key) {
        case "w":
        case "ArrowUp":
          updateDirection({ up: true });
          break;
        case "s":
        case "ArrowDown":
          updateDirection({ down: true });
          break;
        case "a":
        case "ArrowLeft":
          updateDirection({ left: true });
          break;
        case "d":
        case "ArrowRight":
          updateDirection({ right: true });
          break;
        case " ":
        case "Shift":
          triggerDash();
          break;
        default:
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
        pressedKeysRef.current.delete(event.code);
        updateKeyboardDirection();
      switch (event.key) {
        case "w":
        case "ArrowUp":
          updateDirection({ up: false });
          break;
        case "s":
        case "ArrowDown":
          updateDirection({ down: false });
          break;
        case "a":
        case "ArrowLeft":
          updateDirection({ left: false });
          break;
        case "d":
        case "ArrowRight":
          updateDirection({ right: false });
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
  }, [updateKeyboardDirection]);

  const handleJoystickUpdate = useCallback((offsetX: number, offsetY: number) => {
    const clampedX = clamp(offsetX, -JOYSTICK_RADIUS, JOYSTICK_RADIUS);
    const clampedY = clamp(offsetY, -JOYSTICK_RADIUS, JOYSTICK_RADIUS);
    const magnitude = Math.hypot(clampedX, clampedY);

    if (magnitude === 0) {
      joystickVectorRef.current = { x: 0, y: 0 };
    } else {
      const intensity = Math.min(magnitude, JOYSTICK_RADIUS) / JOYSTICK_RADIUS;
      joystickVectorRef.current = {
        x: (clampedX / magnitude) * intensity,
        y: (clampedY / magnitude) * intensity,
      };
    }

    setJoystickState((state) => ({
      ...state,
      offsetX: clampedX,
      offsetY: clampedY,
    }));
  }, []);

  const resetJoystick = useCallback(() => {
    joystickPointerId.current = null;
    joystickVectorRef.current = { x: 0, y: 0 };
    setJoystickState((state) => ({ ...state, active: false, offsetX: 0, offsetY: 0 }));
  }, []);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerId.current !== null) {
      return;
    }

    event.preventDefault();
    const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    joystickPointerId.current = event.pointerId;

    handleJoystickUpdate(event.clientX - centerX, event.clientY - centerY);
    setJoystickState((state) => ({ ...state, active: true }));
    (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
  }, [handleJoystickUpdate]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerId.current !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    handleJoystickUpdate(event.clientX - centerX, event.clientY - centerY);
  }, [handleJoystickUpdate]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerId.current !== event.pointerId) {
      return;
    }

    event.preventDefault();
    (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
    resetJoystick();
  }, [resetJoystick]);

  const joystickStyles = useMemo<CSSProperties[]>(() => {
    const baseStyle: CSSProperties = {
      width: JOYSTICK_RADIUS * 2,
      height: JOYSTICK_RADIUS * 2,
      borderRadius: "50%",
      background: "rgba(255, 255, 255, 0.1)",
      border: "2px solid rgba(255, 255, 255, 0.2)",
      position: "relative",
      touchAction: "none",
    };

    const knobStyle: CSSProperties = {
      width: JOYSTICK_RADIUS,
      height: JOYSTICK_RADIUS,
      borderRadius: "50%",
      background: joystickState.active
        ? "rgba(74, 222, 128, 0.8)"
        : "rgba(255, 255, 255, 0.5)",
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: `translate(calc(-50% + ${joystickState.offsetX / 2}px), calc(-50% + ${joystickState.offsetY / 2}px))`,
      transition: joystickState.active ? "none" : "transform 150ms ease",
    };

    return [baseStyle, knobStyle];
  }, [joystickState]);

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        maxWidth: "100%",
        background: "#10132d",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <Stage
        width={width}
        height={height}
        options={{
          backgroundAlpha: 0,
          antialias: true,
        }}
      >
        <PlayerController
          width={width}
          height={height}
          playerPosition={playerPosition}
          setPlayerPosition={setPlayerPosition}
          keyboardDirectionRef={keyboardDirectionRef}
          joystickVectorRef={joystickVectorRef}
        />
      </Stage>

      <div
        style={{
          position: "absolute",
          left: 24,
          bottom: 24,
        }}
      >
        <div
          role="application"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={joystickStyles[0]}
        >
          <div style={joystickStyles[1]} />
        </div>
      </div>
    </div>
  );
};

export default GameCanvas;
  }, [triggerDash, updateDirection]);

  useEffect(() => () => {
    const app = appRef.current;
    if (app) {
      app.destroy(true);
      appRef.current = null;
    }
  }, []);

  const roundTime = snapshot?.roundTimeRemaining ?? 0;
  const players = useMemo(() => {
    return Object.values(snapshot?.players ?? {}).sort((a, b) => b.score - a.score);
  }, [snapshot]);

  const handleDirectionalChange = useCallback(
    (direction: Partial<Record<"up" | "down" | "left" | "right", boolean>>) => {
      updateDirection(direction);
    },
    [updateDirection]
  );

  const handleEmote = useCallback((emoji: string) => {
    console.info("Emote", emoji);
  }, []);

  return (
    <div className="relative flex h-[640px] flex-col" ref={canvasRef}>
      <div className="pointer-events-none absolute left-4 top-4 space-y-1 text-sm text-slate-200">
        <p className="text-xs uppercase tracking-wide text-slate-400">
          Round Time
        </p>
        <p className="text-xl font-semibold">{roundTime}s</p>
      </div>
      <div className="pointer-events-none absolute right-4 top-4 w-48 rounded-lg bg-slate-900/70 p-3 text-xs text-slate-200">
        <p className="mb-2 text-sm font-semibold text-slate-100">Leaderboard</p>
        <ul className="space-y-1">
          {players.map((player) => (
            <li key={player.id} className="flex items-center justify-between">
              <span>{player.name}</span>
              <span className="font-semibold">{player.score}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex items-center justify-center text-sm text-slate-400">
        WASD / Arrow Keys to move • Space to dash
      </div>
      <MobileControls
        onDirectionalChange={handleDirectionalChange}
        onDash={triggerDash}
        onEmote={handleEmote}
      />
    </div>
  );
}
