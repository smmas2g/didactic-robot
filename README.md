# Didactic Robot

This monorepo contains the web client and game server for a PixiJS-powered multiplayer roam & tag sandbox prototype. It uses pnpm workspaces to share configuration and types across packages.

## Packages

- `apps/web` – Next.js frontend that renders the Pixi-based game canvas and connects to the game server.
- `apps/server` – Colyseus-powered authoritative game server that simulates the world and broadcasts snapshots.
- `packages/types` – Shared TypeScript definitions consumed by both the client and the server.

## Development

```bash
pnpm install
pnpm dev --filter web # Starts the Next.js dev server on http://localhost:3000
pnpm dev --filter server # Starts the Colyseus game server
```
