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
import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { Room, Client } from "colyseus";
import type { GameInputState, GameStateSnapshot } from "@didactic-robot/types";
import { World } from "../game/World.js";

class PlayerState extends Schema {
  @type("string")
  id!: string;

  @type("string")
  name!: string;

  @type("number")
  x = 0;

  @type("number")
  y = 0;

  @type("string")
  color = "#38bdf8";

  @type("number")
  score = 0;

  @type("boolean")
  isTagger = false;
}

class OrbState extends Schema {
  @type("string")
  id!: string;

  @type("number")
  x = 0;

  @type("number")
  y = 0;
}

class InputState extends Schema {
  @type("string")
  id!: string;

  @type("number")
  sequence = 0;
}

class GameState extends Schema {
  @type({ map: PlayerState })
  players = new MapSchema<PlayerState>();

  @type([OrbState])
  orbs = new ArraySchema<OrbState>();

  @type([InputState])
  inputs = new ArraySchema<InputState>();

  @type("number")
  roundTimeRemaining = 180;
}

const PLAYER_COLORS = ["#38bdf8", "#f97316", "#22c55e", "#a855f7", "#f472b6", "#facc15"];

export class GameRoom extends Room<GameState> {
  maxClients = 20;
  private world = new World();

  onCreate() {
    this.setState(new GameState());
    this.onMessage("input", (client, message: GameInputState) => {
      this.world.applyInput(client.sessionId, message);
      this.trackInput(message);
    });

    this.onMessage("ping", (client, payload: { nonce: string }) => {
      client.send("pong", payload);
    });

    this.setSimulationInterval((deltaTime) => {
      this.world.update(deltaTime / 1000);
      this.syncState(this.world.toSnapshot());
    }, 50);
  }

  onJoin(client: Client) {
    const color = PLAYER_COLORS[this.clients.length % PLAYER_COLORS.length];
    this.world.addPlayer(client.sessionId, `Racer ${this.clients.length}`, color);
  }

  onLeave(client: Client) {
    this.world.removePlayer(client.sessionId);
    this.state.players.delete(client.sessionId);
  }

  private trackInput(input: GameInputState) {
    const summary = new InputState();
    summary.id = input.id;
    summary.sequence = input.sequence;
    this.state.inputs.push(summary);
    if (this.state.inputs.length > 10) {
      this.state.inputs.shift();
    }
  }

  private syncState(snapshot: GameStateSnapshot) {
    this.state.roundTimeRemaining = snapshot.roundTimeRemaining;

    // Sync players
    const seen = new Set(Object.keys(snapshot.players));
    Array.from(this.state.players.keys()).forEach((id) => {
      if (!seen.has(id)) {
        this.state.players.delete(id);
      }
    });

    Object.values(snapshot.players).forEach((player) => {
      let current = this.state.players.get(player.id);
      if (!current) {
        current = new PlayerState();
        current.id = player.id;
        current.name = player.name;
        this.state.players.set(player.id, current);
      }
      current.x = player.x;
      current.y = player.y;
      current.color = player.color;
      current.score = player.score;
      current.isTagger = player.isTagger;
    });

    this.state.orbs.splice(0, this.state.orbs.length);
    snapshot.orbs.forEach((orb) => {
      const stateOrb = new OrbState();
      stateOrb.id = orb.id;
      stateOrb.x = orb.x;
      stateOrb.y = orb.y;
      this.state.orbs.push(stateOrb);
    });
  }
}
