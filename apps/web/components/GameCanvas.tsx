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
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
        pressedKeysRef.current.delete(event.code);
        updateKeyboardDirection();
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
