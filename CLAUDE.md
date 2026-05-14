# CLAUDE.md — @apna/sdk

TypeScript SDK that provides the communication layer between Apna **mini-apps**
and the Apna **host** super-app. Built on `post-robot` for secure cross-window
messaging, with a focus on exposing the host's Nostr capabilities to mini-apps.

Published as `@apna/sdk` and consumed by both `apna-app` (host side) and
`social-mini-app` (client side).

## Stack

- TypeScript library, built with **tsdx** (outputs CJS / ESM / UMD to `dist/`)
- `post-robot` — cross-window RPC
- React 19 — optional `ApnaProvider` / `useApna` integration
- Size-limited: each bundle capped at 10 KB — keep the SDK lean

## Layout (`src/`)

- `index.ts` — public entry point
- `client/` — mini-app side (`ApnaApp`); `client/react/` — `ApnaProvider`, `useApna`
- `host/` — super-app side, registered by `apna-app`
- `interfaces/` — shared TypeScript contracts; `interfaces/nostr/` — Nostr API surface

## Conventions

- `client` and `host` are two ends of the same bridge — a change to one side's
  message contract must be mirrored on the other, and reflected in `interfaces/`.
- `interfaces/` is the shared contract; treat it as the source of truth and keep
  it in sync with both consumers.
- Watch the **10 KB size budget** — run `npm run size` after changes; avoid heavy deps.
- This is a published package — public API changes are breaking. Bump the version
  in `package.json` deliberately.
- Prettier: 80 cols, semicolons, single quotes, ES5 trailing commas.

## Commands

- `npm start` — `tsdx watch` (rebuild on change)
- `npm run build` — build CJS/ESM/UMD
- `npm test` — `tsdx test`
- `npm run lint` — `tsdx lint` (also runs as a pre-commit hook)
- `npm run size` / `npm run analyze` — check/inspect bundle size
- `npm run release` — publish via `np`

> This project has its own git repo (`sdk/.git`).
> After changing code, run `graphify update .` to keep the knowledge graph current.
