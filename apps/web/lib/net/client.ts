"use client";

import { GameClient } from "didactic-robot-client";

let client: GameClient | null = null;
let connectPromise: Promise<void> | null = null;

const DEFAULT_ENDPOINT = "ws://localhost:2567";

function resolveEndpoint(): string {
  const explicit =
    process.env.NEXT_PUBLIC_COLYSEUS_ENDPOINT ??
    process.env.NEXT_PUBLIC_SERVER_URL;

  if (explicit && explicit.trim().length > 0) {
    return explicit;
  }

  if (typeof window !== "undefined" && window.location) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}`;
  }

  return DEFAULT_ENDPOINT;
}

function defaultName(): string {
  if (typeof window === "undefined") {
    return "Web Player";
  }
  const nonce = Math.floor(Math.random() * 900) + 100;
  return `Pilot ${nonce}`;
}

export function getGameClient(): GameClient {
  if (typeof window === "undefined") {
    throw new Error("getGameClient must be called in a browser context.");
  }

  if (!client) {
    client = new GameClient(resolveEndpoint());
  }

  if (!connectPromise) {
    connectPromise = client.connect(defaultName()).catch((error) => {
      console.error("Failed to connect to Colyseus server", error);
      connectPromise = null;
    });
  }

  return client;
}

export function resetGameClient(): void {
  connectPromise = null;
  if (client) {
    client.disconnect();
  }
  client = null;
}
