import { Client, Room } from "colyseus";
import { MapSchema, ArraySchema, Schema, type } from "@colyseus/schema";

class Player extends Schema {
  @type("number")
  public x: number = 0;

  @type("number")
  public y: number = 0;
}

class Orb extends Schema {
  @type("number")
  public x: number = 0;

  @type("number")
  public y: number = 0;
}

class GameState extends Schema {
  @type({ map: Player })
  public players = new MapSchema<Player>();

  @type([Orb])
  public orbs = new ArraySchema<Orb>();
}

const MAP_SIZE = 100;
const ORB_COUNT = 10;

export class GameRoom extends Room<GameState> {
  public onCreate(): void {
    this.setState(new GameState());
    this.populateOrbs();

    this.setSimulationInterval(() => this.mutateState(), 500);
  }

  public onJoin(client: Client): void {
    const player = new Player();
    player.x = Math.random() * MAP_SIZE;
    player.y = Math.random() * MAP_SIZE;

    this.state.players.set(client.sessionId, player);
  }

  public onLeave(client: Client): void {
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
