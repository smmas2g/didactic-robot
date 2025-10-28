declare module "@colyseus/monitor" {
  import type { RequestHandler } from "express";
  export function monitor(): RequestHandler;
}
