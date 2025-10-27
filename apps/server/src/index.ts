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
