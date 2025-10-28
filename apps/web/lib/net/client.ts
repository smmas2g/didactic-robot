"use client";

import mitt from "mitt";
import type { Client, Room } from "colyseus.js";
import { Client as ColyseusClient } from "colyseus.js";
import type { GameStateSnapshot } from "@didactic-robot/types";

interface Events {
  connection: boolean;
  state: GameStateSnapshot;
}

class GameClient {
  private client: Client | null = null;
  private room: Room<GameStateSnapshot> | null = null;
  private emitter = mitt<Events>();
  private latency = Infinity;
  private heartbeat?: ReturnType<typeof setInterval>;
  private pendingPings = new Map<string, number>();
  private sessionId: string | null = null;

  connect() {
    if (this.room) return;

    const endpoint =
      process.env.NEXT_PUBLIC_SERVER_URL ?? "ws://localhost:2567";
    this.client = new ColyseusClient(endpoint);
    void this.joinRoom();
  }

  private async joinRoom() {
    try {
      this.room = await this.client!.joinOrCreate<GameStateSnapshot>("game");
      this.sessionId = this.room.sessionId;
      this.pendingPings.clear();
      this.emitter.emit("connection", true);
      this.room.onStateChange((state) => {
        this.emitter.emit("state", JSON.parse(JSON.stringify(state)));
      });
      this.room.onMessage("pong", (payload: { nonce: string }) => {
        const started = this.pendingPings.get(payload.nonce);
        if (started) {
          this.latency = performance.now() - started;
          this.pendingPings.delete(payload.nonce);
          this.emitter.emit("connection", true);
        }
      });
      this.room.onLeave(() => {
        this.sessionId = null;
        this.room = null;
        this.emitter.emit("connection", false);
        if (this.heartbeat) {
          clearInterval(this.heartbeat);
          this.heartbeat = undefined;
        }
        setTimeout(() => this.joinRoom(), 1000);
      });
      this.setupHeartbeat();
    } catch (error) {
      console.error("Failed to connect to game room", error);
      this.emitter.emit("connection", false);
      setTimeout(() => this.joinRoom(), 2000);
    }
  }

  private setupHeartbeat() {
    if (!this.room) return;
    const room = this.room;
    this.latency = Infinity;
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
    }

    const sendPing = () => {
      try {
        const nonce = crypto.randomUUID();
        this.pendingPings.set(nonce, performance.now());
        room.send("ping", { nonce });
      } catch (error) {
        console.warn("Ping failed", error);
        this.latency = Infinity;
        this.emitter.emit("connection", false);
      }
    };

    this.heartbeat = setInterval(sendPing, 2000);
    void sendPing();
  }

  sendInput(input: GameStateSnapshot["inputs"][number]) {
    if (!this.room) return;
    const payload = {
      ...input,
      id: this.sessionId ?? input.id,
    };
    this.room.send("input", payload);
  }

  getLatency() {
    return this.latency;
  }

  subscribeConnection(callback: (connected: boolean) => void) {
    this.emitter.on("connection", callback);
    return () => this.emitter.off("connection", callback);
  }

  subscribeState(callback: (state: GameStateSnapshot) => void) {
    this.emitter.on("state", callback);
    return () => this.emitter.off("state", callback);
  }
}

let singleton: GameClient | null = null;

export function createGameClient() {
  if (!singleton) {
    singleton = new GameClient();
    singleton.connect();
  }
  return singleton;
import { Client } from "colyseus.js";

let client: Client | null = null;

const DEFAULT_ENDPOINT = "ws://localhost:2567";

function resolveEndpoint(): string {
  const explicitEndpoint =
    process.env.NEXT_PUBLIC_COLYSEUS_ENDPOINT ??
    process.env.NEXT_PUBLIC_SERVER_URL;

  if (explicitEndpoint && explicitEndpoint.trim().length > 0) {
    return explicitEndpoint;
  }

  if (typeof window !== "undefined" && window.location) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host;
    return `${protocol}://${host}`;
  }

  return DEFAULT_ENDPOINT;
}

export function getColyseusClient(): Client {
  if (typeof window === "undefined") {
    throw new Error("getColyseusClient must be used in the browser.");
  }

  if (!client) {
    client = new Client(resolveEndpoint());
  }

  return client;
}

export function resetColyseusClient(): void {
  client = null;
}
