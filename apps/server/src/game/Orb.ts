import { Schema, type } from "@colyseus/schema";

export class Orb extends Schema {
  @type("string")
  id: string;

  @type("float32")
  x: number;

  @type("float32")
  y: number;

  @type("uint8")
  value: number;

  constructor(id: string, x: number, y: number, value: number) {
    super();
    this.id = id;
    this.x = x;
    this.y = y;
    this.value = value;
  }
}
