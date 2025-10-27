import { Room, Client } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";
import type { PlayerId } from "@didactic/types";

class Player extends Schema {
  @type("string")
  id!: PlayerId;

  @type("string")
  name = "Anonymous";
}

class State extends Schema {
  @type({ map: Player })
  players = new MapSchema<Player>();
}

export class GameRoom extends Room<State> {
  maxClients = 16;

  onCreate(): void {
    this.setState(new State());
  }

  onJoin(client: Client): void {
    const player = new Player();
    player.id = client.sessionId;
    this.state.players.set(player.id, player);
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
  }
}
