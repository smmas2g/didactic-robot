"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Application, Graphics } from "pixi.js";
import type {
  GameInputState,
  GameStateSnapshot,
} from "@didactic-robot/types";

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

export default function GameCanvas(): JSX.Element {
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
    (
      direction: Partial<Pick<GameInputState, "up" | "down" | "left" | "right">>,
    ) => {
      Object.assign(inputRef.current, direction);
      pushInput();
    },
    [pushInput],
  );

  const triggerDash = useCallback(() => {
    inputRef.current.dash = true;
    pushInput();
    inputRef.current.dash = false;
  }, [pushInput]);

  useEffect(() => {
    const client = clientRef.current;
    const unsubscribe = client.subscribeState((nextSnapshot) => {
      setSnapshot(nextSnapshot);
    });

    return () => {
      unsubscribe();
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
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      if (!useGameStore.getState().snapshot) {
        setSnapshot(null);
      }
    };
  }, [setSnapshot]);

  const ensureApp = useCallback(() => {
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

      if (!nextSnapshot) {
        return;
      }

      nextSnapshot.orbs.forEach((orb) => {
        container.beginFill(0xfacc15, 1);
        container.drawCircle(orb.x, orb.y, 8);
        container.endFill();
      });

      Object.values(nextSnapshot.players).forEach((player) => {
        container.beginFill(parseInt(player.color.replace("#", ""), 16));
        container.drawCircle(player.x, player.y, 12);
        container.endFill();

        container.lineStyle({
          width: 2,
          color: player.isTagger ? 0xf87171 : 0x38bdf8,
        });
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
  }, [triggerDash, updateDirection]);

  useEffect(
    () => () => {
      const app = appRef.current;
      if (app) {
        app.destroy(true);
        appRef.current = null;
      }
    },
    [],
  );

  const roundTime = snapshot?.roundTimeRemaining ?? 0;
  const players = useMemo(() => {
    return Object.values(snapshot?.players ?? {}).sort(
      (a, b) => b.score - a.score,
    );
  }, [snapshot]);

  const handleDirectionalChange = useCallback(
    (direction: Partial<Record<"up" | "down" | "left" | "right", boolean>>) => {
      updateDirection(direction);
    },
    [updateDirection],
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
