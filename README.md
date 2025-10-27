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
