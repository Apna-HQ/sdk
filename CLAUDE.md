# CLAUDE.md — @apna/sdk

TypeScript SDK that provides the **capability-gated bridge** between Apna
**mini-apps** and the Apna **host** (super-app). Two-layer, two-topology,
versioned. Replaces the pre-0.3 `post-robot` RPC core with a purpose-built
channel + bridge + transport stack.

Published as `@apna/sdk` and consumed by both `apna-app` (host side) and
`social-mini-app` (client side).

## Stack

- TypeScript library, built with **tsdx** (outputs CJS / ESM / UMD to `dist/`)
- Zero `dependencies` (channels + bridge are hand-rolled). Optional
  `peerDependencies`: `react` / `react-dom` for the React entry,
  `@module-federation/enhanced` only for `./ui`
- **Four entry points** in `package.json` export map: `.`, `./react`,
  `./ui`, `./server` — each has its own `size-limit` budget
- Core `.` bundle stays **under 10 KB** (CJS 9.25 / ESM 9.31 KB at v0.3.x);
  `./server` under 5 KB. Keep it lean — run `npm run size` after changes

## Layout (`src/`)

- `index.ts` — public entry: re-exports client + host + protocols + domains
  + permissions + channels
- `core/` — transport primitives
  - `protocol.ts` — wire message envelopes, `APNA_PROTOCOL` tag, gating type,
    `CapabilityDescriptor`, type guards
  - `channels/` — `Channel` interface, `IframeChannel`, `ExtensionChannel`,
    `detectChannel()`. **Per-instance** — no module globals
  - `bridge.ts` — RPC correlation, `handshake()`, `request()`, `stream()`
    primitive for bridge-only subscriptions, `BridgeError`
  - `http.ts` + `transport.ts` — optional HTTP read client + router that
    picks HTTP vs bridge per capability gating
- `client/` — mini-app side (`ApnaApp`). `client/react/` — `ApnaProvider`,
  `useApna`
- `host/` — super-app side (`ApnaHost` — per-instance, isolated). Legacy
  `{ methodHandlers: { nostr: { … } } }` shape is accepted via a temporary
  adapter; new code passes a flat `handlers: CapabilityHandlers` registry
- `protocols/` — `apna.nostr` (low-level: query, signEvent, publish, …);
  `bitcoin` / `ethereum` stubs that throw until a host advertises them
- `domains/` — versioned domain modules composed from protocols:
  `apna.identity.v1` + `apna.social.v1`. `version.ts` resolves the latest
  negotiated version while keeping explicit `.v1` pins addressable
- `permissions/` — `apna.permissions` (request / query / revoke). Enforcement
  is host-side — this module is convenience/UX
- `ui/` — `@apna/sdk/ui` entry: `withDynamicComponent`,
  `setCustomiseHighlight`, `useHostComponent`, Module Federation helpers
- `server/` — `@apna/sdk/server` entry: `createApnaServer({ signer,
  httpEndpoint })` for mini-app backends. DOM-free, channel-free,
  NIP-98-signed `fetch` calls. Bring your own `ServerSigner` — no crypto dep
- `interfaces/` — shared contracts (single source of truth). Domain-versioned
  (`identity/v1`, `social/v1`); `host.ts` defines `CapabilityHandlers`.
  The legacy flat `INostr` was removed in 0.3.x

## Conventions

- `client` and `host` are two ends of the same bridge — a change to one
  side's message contract must be mirrored on the other and reflected in
  `core/protocol.ts` + `interfaces/`
- `interfaces/` is the source of truth — don't duplicate types in modules
- **Versioned over breaking** — when extending a domain, add `v2` alongside
  `v1`; don't mutate `v1` in place
- Watch the **10 KB core budget** — run `npm run size` after changes; avoid
  heavy deps in the core entry. `./ui` and `./server` have their own budgets
- This is a published package — public API changes are breaking. Bump the
  version in `package.json` deliberately; release via `np` (`npm run release`)
- Prettier: 80 cols, semicolons, single quotes, ES5 trailing commas

## Commands

- `npm start` — `tsdx watch` (rebuild on change)
- `npm run build` — build CJS/ESM/UMD
- `npm test` — `tsdx test` (jest)
- `npm run lint` — `tsdx lint` (also a pre-commit hook)
- `npm run size` / `npm run analyze` — check / inspect bundle size per entry
- `npm run release` — publish via `np` (interactive; requires npm OTP or a
  granular access token with 2FA-bypass)

> This project has its own git repo (`sdk/.git`).
> After changing code, run `graphify update .` to keep the knowledge graph current.
