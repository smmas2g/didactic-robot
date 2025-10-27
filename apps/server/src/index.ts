import http from "http";
import express from "express";
import { Server } from "colyseus";
import { GameRoom } from "./GameRoom";

const PORT = Number(process.env.PORT) || 2567;

async function bootstrap(): Promise<void> {
  const app = express();

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  const httpServer = http.createServer(app);
  const gameServer = new Server({ server: httpServer });

  gameServer.define("game", GameRoom);

  httpServer.listen(PORT, () => {
    console.log(`🚀 Colyseus server listening on port ${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exitCode = 1;
});
