# Didactic Robot

A pnpm-powered monorepo that pairs a Next.js web client with a Colyseus multiplayer server. Shared DTOs live in `packages/types` so both runtime targets stay in sync.

## Getting started

```bash
pnpm install
```

> **Note**
> Package installation requires access to the public npm registry.

### Useful scripts

- `pnpm dev` – start all workspace apps in parallel (requires dependencies installed)
- `pnpm build` – build every package and application
- `pnpm lint` – run ESLint across the monorepo
- `pnpm typecheck` – run TypeScript in `--noEmit` mode everywhere
- `pnpm format` – run Prettier checks in each package
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
