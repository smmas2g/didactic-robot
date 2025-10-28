import express from "express";
import { createServer } from "http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom.js";

const PORT = Number(process.env.PORT ?? 2567);

async function main(): Promise<void> {
  const app = express();
  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  const httpServer = createServer(app);

  const gameServer = new Server({
    transport: new WebSocketTransport({
      server: httpServer,
    }),
  });

  gameServer.define("game", GameRoom);

  await gameServer.listen(PORT);
  console.log(`Game server running at ws://localhost:${PORT}`);

  process.on("SIGTERM", async () => {
    console.log("Shutting down game server...");
    await gameServer.gracefullyShutdown();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
