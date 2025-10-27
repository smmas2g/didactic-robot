import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Switch, Transition } from '@headlessui/react';
import { BoltIcon, FaceSmileIcon } from '@heroicons/react/24/solid';
import { clsx } from 'clsx';

type Vector = {
  x: number;
  y: number;
  intensity: number;
};

type Position = {
  x: number;
  y: number;
};

type PaletteKey = 'vibrant' | 'sunset' | 'deepSea';

type Palette = {
  player: string;
  target: string;
  accent: string;
};

const palettes: Record<PaletteKey, Palette> = {
  vibrant: {
    player: '#2E86AB',
    target: '#F6C85F',
    accent: '#F26419',
  },
  sunset: {
    player: '#FF6F61',
    target: '#355070',
    accent: '#FF9F1C',
  },
  deepSea: {
    player: '#00A6A6',
    target: '#F4D35E',
    accent: '#7B2CBF',
  },
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const randomPosition = () => ({
  x: 20 + Math.random() * 60,
  y: 20 + Math.random() * 60,
});

const supportsVibration = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;

const triggerHaptics = () => {
  if (supportsVibration()) {
    navigator.vibrate?.(35);
  }
  (navigator as any)?.haptics?.impactOccurred?.('medium');
};

const useAnimationFrame = (callback: (delta: number) => void) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let frameId: number;
    const loop = (time: number) => {
      if (lastTimeRef.current != null) {
        const delta = (time - lastTimeRef.current) / 1000;
        callbackRef.current(delta);
      }
      lastTimeRef.current = time;
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);
};

type JoystickProps = {
  onChange: (vector: Vector) => void;
  inputScale: number;
  accentColor: string;
};

const Joystick = ({ onChange, inputScale, accentColor }: JoystickProps) => {
  const [isActive, setIsActive] = useState(false);
  const [handlePosition, setHandlePosition] = useState<Position>({ x: 0, y: 0 });
  const baseRef = useRef<HTMLDivElement | null>(null);

  const handlePointerMove = useCallback(
    (event: PointerEvent | React.PointerEvent<HTMLDivElement>) => {
      if (!baseRef.current) return;
      const rect = baseRef.current.getBoundingClientRect();
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      const delta = {
        x: event.clientX - center.x,
        y: event.clientY - center.y,
      };
      const radius = rect.width / 2;
      const distance = Math.min(Math.hypot(delta.x, delta.y), radius);
      const angle = Math.atan2(delta.y, delta.x);
      const normalized = distance / radius;
      const x = Math.cos(angle) * normalized;
      const y = Math.sin(angle) * normalized;

      setHandlePosition({
        x: x * (radius - 12),
        y: y * (radius - 12),
      });
      onChange({ x, y, intensity: normalized });
    },
    [onChange],
  );

  const reset = useCallback(() => {
    setIsActive(false);
    setHandlePosition({ x: 0, y: 0 });
    onChange({ x: 0, y: 0, intensity: 0 });
  }, [onChange]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      setIsActive(true);
      baseRef.current?.setPointerCapture(event.pointerId);
      handlePointerMove(event);
    },
    [handlePointerMove],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      baseRef.current?.releasePointerCapture(event.pointerId);
      reset();
    },
    [reset],
  );

  useEffect(() => {
    const handleWindowPointerUp = () => {
      if (isActive) {
        reset();
      }
    };
    window.addEventListener('pointerup', handleWindowPointerUp);
    return () => window.removeEventListener('pointerup', handleWindowPointerUp);
  }, [isActive, reset]);

  return (
    <div
      ref={baseRef}
      className={clsx(
        'relative h-32 w-32 select-none rounded-full border border-white/20 bg-white/5 backdrop-blur',
        'touch-none',
      )}
      style={{
        transform: `scale(${inputScale})`,
        borderColor: isActive ? `${accentColor}bb` : undefined,
        boxShadow: isActive ? `0 0 0 3px ${accentColor}44` : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={(event) => isActive && handlePointerMove(event)}
      onPointerUp={handlePointerUp}
    >
      <div className="absolute inset-2 rounded-full border border-white/10"></div>
      <div
        className={clsx(
          'absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70',
          'transition-transform duration-75 ease-linear',
        )}
        style={{
          transform: `translate(calc(-50% + ${handlePosition.x}px), calc(-50% + ${handlePosition.y}px))`,
        }}
      />
    </div>
  );
};

type ActionButtonsProps = {
  onDash: () => void;
  onEmote: () => void;
  isDashing: boolean;
  inputScale: number;
  accentColor: string;
};

const ActionButtons = ({ onDash, onEmote, isDashing, inputScale, accentColor }: ActionButtonsProps) => (
  <div
    className="flex flex-col gap-3"
    style={{ transform: `scale(${inputScale})` }}
  >
    <button
      type="button"
      onClick={onDash}
      className={clsx(
        'flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 font-semibold text-white shadow-lg backdrop-blur transition',
        isDashing ? 'scale-95' : 'active:scale-95',
      )}
      style={{
        background: isDashing ? accentColor : 'rgba(255,255,255,0.18)',
        boxShadow: `0 15px 35px -20px ${accentColor}`,
      }}
    >
      <BoltIcon className="h-5 w-5" />
      Dash
    </button>
    <button
      type="button"
      onClick={onEmote}
      className="flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 font-semibold text-white shadow-lg backdrop-blur transition active:scale-95"
      style={{
        background: 'rgba(255,255,255,0.18)',
        boxShadow: `0 12px 28px -18px ${accentColor}`,
      }}
    >
      <FaceSmileIcon className="h-5 w-5" />
      Emote
    </button>
  </div>
);

const App = () => {
  const [direction, setDirection] = useState<Vector>({ x: 0, y: 0, intensity: 0 });
  const [playerPos, setPlayerPos] = useState<Position>({ x: 50, y: 50 });
  const [targetPos, setTargetPos] = useState<Position>(() => randomPosition());
  const [isDashing, setIsDashing] = useState(false);
  const dashTimeoutRef = useRef<number | null>(null);
  const [emoteVisible, setEmoteVisible] = useState(false);
  const emoteTimeoutRef = useRef<number | null>(null);
  const [tagCount, setTagCount] = useState(0);
  const [lastTagTimestamp, setLastTagTimestamp] = useState<number | null>(null);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [paletteKey, setPaletteKey] = useState<PaletteKey>('vibrant');
  const [inputScale, setInputScale] = useState(1);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const palette = palettes[paletteKey];

  const handleDirectionChange = useCallback((vector: Vector) => {
    setDirection(vector);
  }, []);

  const dash = useCallback(() => {
    if (dashTimeoutRef.current) {
      window.clearTimeout(dashTimeoutRef.current);
    }
    setIsDashing(true);
    dashTimeoutRef.current = window.setTimeout(() => {
      setIsDashing(false);
    }, 280);
  }, []);

  const emote = useCallback(() => {
    if (emoteTimeoutRef.current) {
      window.clearTimeout(emoteTimeoutRef.current);
    }
    setEmoteVisible(true);
    emoteTimeoutRef.current = window.setTimeout(() => setEmoteVisible(false), 1600);
  }, []);

  useEffect(() => () => {
    if (dashTimeoutRef.current) {
      window.clearTimeout(dashTimeoutRef.current);
    }
    if (emoteTimeoutRef.current) {
      window.clearTimeout(emoteTimeoutRef.current);
    }
  }, []);

  const handleTag = useCallback(() => {
    setTargetPos(randomPosition());
    setTagCount((count) => count + 1);
    setLastTagTimestamp(Date.now());
    triggerHaptics();
  }, []);

  const [fieldBounds, setFieldBounds] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateScale = () => {
      const width = window.innerWidth;
      if (width < 480) {
        setInputScale(0.75);
      } else if (width < 768) {
        setInputScale(0.9);
      } else {
        setInputScale(1);
      }
      const rect = fieldRef.current?.getBoundingClientRect();
      if (rect) {
        setFieldBounds({ width: rect.width, height: rect.height });
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const motionMultiplier = isReducedMotion ? 0.65 : 1;

  const speedBase = useMemo(() => 32 * motionMultiplier, [motionMultiplier]);

  useAnimationFrame((delta) => {
    setPlayerPos((prev) => {
      const dashMultiplier = isDashing ? 2.15 : 1;
      const intensityMultiplier = 0.4 + direction.intensity * 0.6;
      const next = {
        x: clamp(prev.x + direction.x * speedBase * dashMultiplier * intensityMultiplier * delta, 5, 95),
        y: clamp(prev.y + direction.y * speedBase * dashMultiplier * intensityMultiplier * delta, 5, 95),
      };

      const collisionThreshold = 6;
      const distance = Math.hypot(next.x - targetPos.x, next.y - targetPos.y);
      if (distance < collisionThreshold) {
        handleTag();
      }

      return next;
    });
  });

  const tagRecently = lastTagTimestamp ? Date.now() - lastTagTimestamp < 1200 : false;

  const orbSize = useMemo(() => {
    const base = fieldBounds.width ? Math.max(48, fieldBounds.width * 0.08) : 56;
    return isReducedMotion ? base * 0.9 : base;
  }, [fieldBounds.width, isReducedMotion]);

  const paletteOptions = useMemo(
    () => [
      { id: 'vibrant', label: 'Vibrant' },
      { id: 'sunset', label: 'Sunset' },
      { id: 'deepSea', label: 'Deep Sea' },
    ],
    [],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <main className="relative flex flex-1 flex-col">
        <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white">Didactic Robot Arena</h1>
              <p className="text-sm text-slate-300">Glide, dash, and emote to tag the glowing orb.</p>
            </div>
            <div className="flex flex-col items-stretch gap-3 text-sm sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <Switch
                  checked={isReducedMotion}
                  onChange={setIsReducedMotion}
                  className={clsx(
                    'relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border border-white/20 transition',
                    isReducedMotion ? 'bg-emerald-500/80' : 'bg-slate-600',
                  )}
                >
                  <span className="sr-only">Toggle reduced motion</span>
                  <span
                    aria-hidden="true"
                    className={clsx(
                      'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition',
                      isReducedMotion ? 'translate-x-7' : 'translate-x-1',
                    )}
                  />
                </Switch>
                <span className="font-medium text-slate-200">Reduced motion</span>
              </div>
              <label className="flex items-center gap-3">
                <span className="font-medium text-slate-200">Palette</span>
                <select
                  value={paletteKey}
                  onChange={(event) => setPaletteKey(event.target.value as PaletteKey)}
                  className="rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-slate-100 shadow-inner focus:border-emerald-400 focus:outline-none"
                >
                  {paletteOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </header>

          <section
            ref={fieldRef}
            className={clsx(
              'relative mx-auto flex w-full max-w-4xl flex-1 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-4 shadow-2xl',
              'aspect-[3/4] sm:aspect-[4/5] lg:aspect-[5/4]',
              isReducedMotion ? '' : 'transition-all duration-500',
            )}
          >
            <div className="relative h-full w-full">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_65%)]" />

              <div
                className="absolute left-4 top-4 z-10 rounded-full border px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur"
                style={{
                  borderColor: `${palette.accent}55`,
                  backgroundColor: `${palette.accent}22`,
                }}
              >
                Tags: {tagCount}
              </div>

              <Transition
                as={Fragment}
                show={!!tagRecently}
                enter="transition-opacity duration-200"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="transition-opacity duration-300"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div
                  className="pointer-events-none absolute left-1/2 top-6 z-20 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold text-white backdrop-blur"
                  style={{
                    backgroundColor: `${palette.accent}33`,
                    boxShadow: `0 12px 30px -18px ${palette.accent}`,
                  }}
                >
                  Tagged!
                </div>
              </Transition>

              <div
                className={clsx(
                  'absolute flex items-center justify-center rounded-full border border-white/10 text-lg font-semibold text-white shadow-lg',
                  isReducedMotion ? '' : 'animate-pulse-soft',
                )}
                style={{
                  width: orbSize,
                  height: orbSize,
                  left: `${playerPos.x}%`,
                  top: `${playerPos.y}%`,
                  backgroundColor: palette.player,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <span className="pointer-events-none select-none text-base font-semibold">You</span>
                <Transition
                  as={Fragment}
                  show={emoteVisible}
                  enter="transition-transform duration-200"
                  enterFrom="-translate-y-4 opacity-0"
                  enterTo="-translate-y-8 opacity-100"
                  leave="transition-opacity duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute -top-4 text-2xl">✨</div>
                </Transition>
              </div>

              <div
                className={clsx(
                  'absolute flex items-center justify-center rounded-full border text-sm font-medium text-slate-900 shadow-2xl',
                  tagRecently && !isReducedMotion ? 'scale-105 transition-transform duration-200' : '',
                )}
                style={{
                  width: orbSize * 0.85,
                  height: orbSize * 0.85,
                  left: `${targetPos.x}%`,
                  top: `${targetPos.y}%`,
                  backgroundColor: palette.target,
                  borderColor: `${palette.accent}66`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                Tag me!
              </div>
            </div>
          </section>
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-between px-6 sm:px-12">
          <div className="pointer-events-auto origin-bottom-left">
            <Joystick onChange={handleDirectionChange} inputScale={inputScale} accentColor={palette.accent} />
          </div>
          <div className="pointer-events-auto origin-bottom-right">
            <ActionButtons
              onDash={dash}
              onEmote={emote}
              isDashing={isDashing}
              inputScale={inputScale}
              accentColor={palette.accent}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
