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
