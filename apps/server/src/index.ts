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
import { Server, matchMaker } from "colyseus";
import { createServer } from "http";
import { createServer } from "http";
import express from "express";
import { Server } from "colyseus";
import { monitor } from "@colyseus/monitor";
import { GameRoom } from "./rooms/GameRoom.js";

const port = Number(process.env.PORT ?? 2567);

const { WebSocketTransport } = await import("@colyseus/ws-transport");
const httpServer = createServer();
async function main() {
  const app = express();
  const httpServer = createServer(app);

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
  app.use("/colyseus", monitor());

  httpServer.listen(port, () => {
    console.log(`🚀 Colyseus server listening on :${port}`);
  });
}

void main();
import express from "express";
import { createServer } from "http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom.js";

const app = express();
app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 2567);
const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
  }),
});

gameServer.define("game", GameRoom);

await gameServer.listen(port);

console.log(`Game server running at ws://localhost:${port}`);

process.on("SIGTERM", async () => {
  console.log("Shutting down game server...");
  await gameServer.gracefullyShutdown();
  process.exit(0);
});

export { matchMaker };
gameServer.onShutdown(() => {
  console.log("Shutting down game server");
});

gameServer.listen(port);

console.log(`Game server listening on :${port}`);
