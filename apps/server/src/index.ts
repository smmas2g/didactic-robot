import { Server, matchMaker } from "colyseus";
import { createServer } from "http";
import { GameRoom } from "./rooms/GameRoom.js";

const port = Number(process.env.PORT ?? 2567);

const { WebSocketTransport } = await import("@colyseus/ws-transport");
const httpServer = createServer();

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
