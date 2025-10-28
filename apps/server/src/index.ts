import { createServer } from "http";
import express from "express";
import { Server } from "colyseus";
import { monitor } from "@colyseus/monitor";
import { GameRoom } from "./rooms/GameRoom.js";

const port = Number(process.env.PORT ?? 2567);

async function main() {
  const app = express();
  const httpServer = createServer(app);

  const gameServer = new Server({ server: httpServer });

  gameServer.define("game", GameRoom);

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

gameServer.onShutdown(() => {
  console.log("Shutting down game server");
});

gameServer.listen(port);

console.log(`Game server listening on :${port}`);
