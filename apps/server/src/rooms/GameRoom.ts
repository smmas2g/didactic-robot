import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import type { Client } from "colyseus";
import { Room } from "colyseus";

class Player extends Schema {
  @type("number")
  x = 0;

  @type("number")
  y = 0;
}

class Orb extends Schema {
  @type("number")
  x = 0;

  @type("number")
  y = 0;
}

class GameState extends Schema {
  @type({ map: Player })
  players = new MapSchema<Player>();

  @type([Orb])
  orbs = new ArraySchema<Orb>();
}

const MAP_SIZE = 100;
const ORB_COUNT = 10;
const UPDATE_INTERVAL_MS = 500;

export class GameRoom extends Room<GameState> {
  onCreate(): void {
    this.setState(new GameState());
    this.populateOrbs();

    this.setSimulationInterval(() => {
      this.mutateState();
    }, UPDATE_INTERVAL_MS);

    this.onMessage("ping", (client, payload: { nonce?: string }) => {
      client.send("pong", payload ?? {});
    });
  }

  onJoin(client: Client): void {
    const player = new Player();
    player.x = Math.random() * MAP_SIZE;
    player.y = Math.random() * MAP_SIZE;
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
  }

  private populateOrbs(): void {
    while (this.state.orbs.length < ORB_COUNT) {
      const orb = new Orb();
      orb.x = Math.random() * MAP_SIZE;
      orb.y = Math.random() * MAP_SIZE;
      this.state.orbs.push(orb);
    }
  }

  private mutateState(): void {
    this.state.players.forEach((player) => {
      player.x = (player.x + (Math.random() - 0.5) * 5 + MAP_SIZE) % MAP_SIZE;
      player.y = (player.y + (Math.random() - 0.5) * 5 + MAP_SIZE) % MAP_SIZE;
    });

    for (const orb of this.state.orbs) {
      orb.x = (orb.x + (Math.random() - 0.5) * 3 + MAP_SIZE) % MAP_SIZE;
      orb.y = (orb.y + (Math.random() - 0.5) * 3 + MAP_SIZE) % MAP_SIZE;
    }
  }
}
