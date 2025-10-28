import express from "express";
import { createServer } from "http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom.js";

const PORT = Number(process.env.PORT ?? 2567);

async function main(): Promise<void> {
  const app = express();

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  const httpServer = createServer(app);

  const gameServer = new Server({
    transport: new WebSocketTransport({
      server: httpServer,
    }),
  });

  gameServer.define("game", GameRoom);

  const shutdown = async (signal: NodeJS.Signals) => {
    console.log(`Received ${signal}, shutting down server...`);
    await gameServer.gracefullyShutdown();
    httpServer.close();
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await gameServer.listen(PORT);

  console.log(`🚀 Game server listening on http://localhost:${PORT}`);
}

void main().catch((error) => {
  console.error("Failed to start server", error);
  process.exitCode = 1;
});
