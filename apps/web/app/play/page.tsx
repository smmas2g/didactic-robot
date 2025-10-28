"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { ConnectionBanner } from "../../components/ConnectionBanner";

const GameCanvas = dynamic(() => import("../../components/GameCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-slate-300">
      Booting arena...
    </div>
  ),
});

export default function PlayPage() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-950">
      <ConnectionBanner />
      <div className="flex-1">
        <Suspense fallback={<div className="p-8 text-slate-300">Loading...</div>}>
          <GameCanvas />
        </Suspense>
      </div>
    </main>
import { useEffect, useMemo, useRef, useState } from "react";
import type { Room } from "colyseus.js";

import { getColyseusClient } from "../../lib/net/client";

type CollectionEntry = {
  id: string;
  state: Record<string, unknown>;
};

type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof (value as { toJSON?: () => unknown }).toJSON === "function") {
    return (value as { toJSON: () => unknown }).toJSON();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }

  if (value instanceof Map) {
    const asRecord: Record<string, unknown> = {};
    value.forEach((mapValue, key) => {
      asRecord[String(key)] = normalizeValue(mapValue);
    });
    return asRecord;
  }

  if (typeof value === "object") {
    const asRecord: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      asRecord[key] = normalizeValue(entry);
    });
    return asRecord;
  }

  return value;
}

function toCollectionEntries(collection: unknown): CollectionEntry[] {
  const entries: CollectionEntry[] = [];

  if (!collection) {
    return entries;
  }

  const ensureRecord = (value: unknown): Record<string, unknown> => {
    const normalized = normalizeValue(value);
    if (normalized !== null && typeof normalized === "object" && !Array.isArray(normalized)) {
      return normalized as Record<string, unknown>;
    }
    return { value: normalized ?? null };
  };

  if (typeof (collection as { forEach?: unknown }).forEach === "function") {
    (collection as { forEach: (callback: (value: unknown, key: unknown) => void) => void }).forEach(
      (value: unknown, key: unknown) => {
        entries.push({
          id: String(key),
          state: ensureRecord(value),
        });
      },
    );
    return entries;
  }

  if (Array.isArray(collection)) {
    collection.forEach((value, index) => {
      const id =
        typeof value === "object" && value && "id" in (value as Record<string, unknown>)
          ? String((value as Record<string, unknown>).id)
          : String(index);
      entries.push({ id, state: ensureRecord(value) });
    });
    return entries;
  }

  if (typeof collection === "object") {
    Object.entries(collection as Record<string, unknown>).forEach(([key, value]) => {
      entries.push({ id: key, state: ensureRecord(value) });
    });
  }

  return entries;
}

export default function PlayPage(): JSX.Element {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [players, setPlayers] = useState<CollectionEntry[]>([]);
  const [orbs, setOrbs] = useState<CollectionEntry[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [ping, setPing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnectDelay, setReconnectDelay] = useState<number | null>(null);

  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    const client = getColyseusClient();
    let disposed = false;

    const clearReconnectTimer = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const clearPingTimer = () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };

    const syncFromState = (state: unknown) => {
      if (disposed) {
        return;
      }
      const schemaState = state as { players?: unknown; orbs?: unknown };
      setPlayers(toCollectionEntries(schemaState.players));
      setOrbs(toCollectionEntries(schemaState.orbs));
    };

    const subscribeCollection = (collection: unknown, room: Room) => {
      if (!collection) {
        return;
      }

      const maybeSchema = collection as {
        onAdd?: (callback: (item: unknown, key: unknown) => void) => void;
        onChange?: (callback: (item: unknown, key: unknown) => void) => void;
        onRemove?: (callback: (item: unknown, key: unknown) => void) => void;
      };

      const listener = () => syncFromState(room.state);

      maybeSchema.onAdd?.((_, __) => listener());
      maybeSchema.onChange?.((_, __) => listener());
      maybeSchema.onRemove?.((_, __) => listener());
    };

    const clearRoomReference = () => {
      roomRef.current = null;
      setSessionId(null);
      setPlayers([]);
      setOrbs([]);
      setPing(null);
      clearPingTimer();
    };

    function scheduleReconnect() {
      if (disposed) {
        return;
      }

      clearReconnectTimer();
      reconnectAttemptsRef.current += 1;
      const attempt = reconnectAttemptsRef.current;
      const delay = Math.min(30000, Math.pow(2, attempt - 1) * 1000);
      setReconnectDelay(delay);
      setConnectionState("connecting");

      reconnectTimeoutRef.current = setTimeout(async () => {
        reconnectTimeoutRef.current = null;
        if (!disposed) {
          await connect();
        }
      }, delay);
    }

    const startPing = (room: Room) => {
      clearPingTimer();
      pingIntervalRef.current = setInterval(async () => {
        if (disposed) {
          return;
        }

        const startTime = performance.now();
        try {
          await client.getAvailableRooms("GameRoom");
          if (!disposed) {
            setPing(Math.round(performance.now() - startTime));
          }
        } catch (pingError) {
          if (!disposed) {
            setPing(null);
            console.warn("Ping request failed", pingError);
          }
        }
      }, 5000);
    };

    const bindRoom = (room: Room) => {
      roomRef.current = room;
      reconnectAttemptsRef.current = 0;
      setReconnectDelay(null);
      setConnectionState("connected");
      setError(null);
      setSessionId(room.sessionId);

      syncFromState(room.state);
      subscribeCollection((room.state as { players?: unknown }).players, room);
      subscribeCollection((room.state as { orbs?: unknown }).orbs, room);

      room.onStateChange((newState) => {
        syncFromState(newState);
      });

      room.onLeave(() => {
        if (disposed) {
          return;
        }
        setConnectionState("disconnected");
        clearRoomReference();
        scheduleReconnect();
      });

      room.onError((code, message) => {
        if (disposed) {
          return;
        }
        setConnectionState("error");
        setError(message ?? `Room error (${code})`);
        clearRoomReference();
        scheduleReconnect();
      });

      startPing(room);
    };

    async function connect() {
      if (disposed) {
        return;
      }
      setConnectionState("connecting");
      try {
        const room = await client.joinOrCreate("GameRoom");
        if (disposed) {
          await room.leave();
          return;
        }
        bindRoom(room);
      } catch (joinError) {
        if (disposed) {
          return;
        }
        console.error("Failed to join GameRoom", joinError);
        setError(joinError instanceof Error ? joinError.message : String(joinError));
        scheduleReconnect();
      }
    }

    connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      clearPingTimer();
      if (roomRef.current) {
        roomRef.current.leave();
        roomRef.current = null;
      }
    };
  }, []);

  const reconnectMessage = useMemo(() => {
    if (reconnectDelay === null) {
      return null;
    }
    const seconds = Math.round(reconnectDelay / 1000);
    return `Reconnecting in ${seconds}s...`;
  }, [reconnectDelay]);

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <h1 className="page-title">Play</h1>
        <dl className="status-list">
          <div>
            <dt>Status</dt>
            <dd>{connectionState}</dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>{sessionId ?? "—"}</dd>
          </div>
          <div>
            <dt>Ping</dt>
            <dd>{ping !== null ? `${ping}ms` : "—"}</dd>
          </div>
          {reconnectMessage ? (
            <div className="status-warning">
              <dt>Reconnect</dt>
              <dd>{reconnectMessage}</dd>
            </div>
          ) : null}
        </dl>
        {error ? <p className="status-error">{error}</p> : null}
      </header>

      <main className="content-grid">
        <section className="panel">
          <header className="panel-header">
            <h2>Players</h2>
            <span>{players.length}</span>
          </header>
          <div className="panel-body">
            {players.length === 0 ? (
              <p className="empty-state">Waiting for players…</p>
            ) : (
              players.map((player) => (
                <article key={player.id} className="entity-card">
                  <header>
                    <span className="entity-title">Player {player.id}</span>
                    {player.id === sessionId ? <span className="entity-badge">You</span> : null}
                  </header>
                  <pre>{JSON.stringify(player.state, null, 2)}</pre>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <header className="panel-header">
            <h2>Orbs</h2>
            <span>{orbs.length}</span>
          </header>
          <div className="panel-body">
            {orbs.length === 0 ? (
              <p className="empty-state">No orbs detected.</p>
            ) : (
              orbs.map((orb) => (
                <article key={orb.id} className="entity-card">
                  <header>
                    <span className="entity-title">Orb {orb.id}</span>
                  </header>
                  <pre>{JSON.stringify(orb.state, null, 2)}</pre>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
