import { Client, Room } from "colyseus";
import { World, TICK_INTERVAL_MS, InputIntent } from "../game/index.js";

interface JoinOptions {
  name?: string;
}

export class GameRoom extends Room<World> {
  maxClients = 16;

  onCreate() {
    this.setState(new World());

    this.setSimulationInterval((deltaTime) => {
      this.state.update(deltaTime);
    }, TICK_INTERVAL_MS);

    this.onMessage("input", (client, intent: InputIntent) => {
      this.handleIntent(client, intent);
    });
  }

  onJoin(client: Client, options: JoinOptions) {
    const name = (options?.name ?? "Player").slice(0, 24);
    this.state.addPlayer(client.sessionId, name);
  }

  onLeave(client: Client) {
    this.state.removePlayer(client.sessionId);
  }

  private handleIntent(client: Client, intent: InputIntent) {
    this.state.enqueueIntent(client.sessionId, intent);
  }
}
