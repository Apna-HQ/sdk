# @apna/sdk

The TypeScript SDK for the **Apna** mini-app ecosystem — a versioned, capability-gated bridge between Nostr-rooted mini-apps and the Apna host (super-app).

`@apna/sdk` powers both sides of the bridge:

- The **mini-app** (client) — `ApnaApp` opens a session with its host, then calls capabilities like `apna.social.v1.feed(...)` over a transport-agnostic channel (iframe today, browser-extension topology supported).
- The **host** (super-app) — `ApnaHost` advertises a capability registry, enforces a permission gate on gated capabilities, and answers RPC over the same channel.

## Status

- Version: **0.3.x** — breaks 0.1.x consumers. The legacy `post-robot` transport, flat `apna.nostr.*` surface, and `INostr` interface are gone. See [Migration from 0.1.x](#migration-from-01x).
- License: MIT.

## Installation

```bash
npm install @apna/sdk
# or
yarn add @apna/sdk
```

The SDK ships four entry points so consumers only pay for what they use:

| Entry | Purpose |
|---|---|
| `@apna/sdk` | Core client (`ApnaApp`) + host (`ApnaHost`) + protocol modules + domain modules. Core bundle ~9.3 KB gzipped. |
| `@apna/sdk/react` | Optional React provider + `useApna` hook. |
| `@apna/sdk/ui` | Module Federation runtime helpers for design-component customization (`withDynamicComponent`, `useHostComponent`, `setCustomiseHighlight`). |
| `@apna/sdk/server` | DOM-free server SDK for mini-app **backends** — NIP-98-signed REST calls to the host (`apna.notifications.send`, `apna.nostr.publish`, …). |

## In a mini-app (client side)

```ts
import { ApnaApp } from '@apna/sdk';

const apna = new ApnaApp({ appId: 'my-mini-app' });

// Wait for the bridge to handshake with the host.
await apna.ready;

// High-level domain modules (versioned).
const me = await apna.identity.v1.me();
const feed = await apna.social.v1.feed('FOLLOWING_FEED', { limit: 50 });
await apna.social.v1.publishNote('Hello from my mini-app!');
const stopFeed = apna.social.v1.subscribeFeed(
  'FOLLOWING_FEED',
  { since: Math.floor(Date.now() / 1000) },
  (event) => {
    console.log('new social event', event.id);
  }
);

// Low-level protocol module — escape hatch for power paths.
const events = await apna.nostr.query([{ kinds: [1], authors: [me.pubkey], limit: 10 }]);

// Permissions surface — the host enforces, this is convenience UX.
await apna.permissions.request([
  { capability: 'social.v1.publishNote' },
  { capability: 'nostr.signEvent' },
]);

// Typed host → app events.
apna.on('customise:toggleHighlight', (enabled) => {
  // toggle a "design mode" overlay
});

stopFeed();
```

`apna.ready` resolves once the SDK has finished the `handshake:init` → `handshake:ack` round-trip with the host. Until then, calls queue. If the SDK is loaded **outside** a host (no iframe parent, no host extension), `apna.ready` rejects with `"[apna] No Apna host detected"`.

### React

```tsx
import { ApnaProvider, useApna } from '@apna/sdk/react';

export function App() {
  return (
    <ApnaProvider appId="my-mini-app">
      <Feed />
    </ApnaProvider>
  );
}

function Feed() {
  const { apna, social, identity } = useApna();
  // social → apna.social (latest), identity → apna.identity (latest)
}
```

### Design-component customization

The host can advertise a Module Federation `designRemote` URL. Mini-apps consume it via `@apna/sdk/ui`:

```tsx
import { withDynamicComponent } from '@apna/sdk/ui';
import { Button as LocalButton } from './components/ui/button';

export const Button = withDynamicComponent('Button', LocalButton);
// Renders LocalButton normally; renders the host-supplied <Button> when the
// user has chosen one in the host's Customise Mode.
```

## In a mini-app **backend** (server side)

For mini-apps that have a Node backend (push notifications, scheduled jobs), the server SDK provides a DOM-free, channel-free path. Calls are signed with the mini-app **publisher's** Nostr keypair using NIP-98 and POSTed to the host's HTTP capability endpoints.

```ts
import { createApnaServer } from '@apna/sdk/server';
import { nip19, finalizeEvent, getPublicKey } from 'nostr-tools';

const nsec = process.env.APNA_PUBLISHER_NSEC!;
const sk = nip19.decode(nsec).data as Uint8Array;

const apna = createApnaServer({
  httpEndpoint: 'https://apna.example/api/apna',
  signer: {
    getPublicKey: async () => getPublicKey(sk),
    signEvent: async (t) => finalizeEvent(t, sk),
  },
});

await apna.notifications.send({
  title: 'New reply',
  body: '@alice replied to your note',
  url: '/note/abc123',
});
```

> **Security:** the backend holds your publisher key. Treat it like an API secret. Don't expose `@apna/sdk/server` from any browser bundle. Rotate the key by re-publishing your app's metadata note with a new pubkey.

## In the host (super-app)

The host runs **one `ApnaHost` per mini-app instance**, isolated by an iframe channel:

```ts
import { ApnaHost, IframeChannel, type CapabilityHandlers } from '@apna/sdk';

const handlers: CapabilityHandlers = {
  'nostr.query':       { gating: 'open',  handler: async (filters) => /* relays */ [] },
  'nostr.signEvent':   { gating: 'gated', handler: async (tmpl)    => /* sign  */ {} },
  'social.v1.feed':    { gating: 'open',  handler: async (type, o) => /* …    */ [] },
  'social.v1.publishNote': { gating: 'gated', handler: async (content) => /* … */ {} },
  'identity.v1.me':    { gating: 'gated', handler: async () => /* active profile */ {} },
  // …
};

const host = new ApnaHost({
  handlers,
  channel: new IframeChannel({
    getTarget: () => iframe.contentWindow,
    filterBySource: true,            // host-side isolation between parallel iframes
  }),
  permissionGate,                    // optional — your store, your prompt
  designRemote: '/static/chunks/remoteEntry.js',
});

// Push a typed event to the mini-app.
host.emit({ type: 'event', name: 'customise:toggleHighlight', payload: true });
```

`gating` is part of the capability descriptor:

- `'open'` — reads. Never reach the permission gate. Examples: `nostr.query`, `social.v1.feed`.
- `'gated'` — writes / sensitive reads. The host's `PermissionGate` decides per call: standing grant → pass; no grant → prompt the user (allow/deny × once/session/always); deny → SDK throws `PermissionDeniedError`.

The full negotiation flow:

```
mini-app                                                  host
  │                                                         │
  ├─── handshake:init { appId, instanceId, sdkVersion } ──▶│
  │                                                         │ build capability registry
  │◀── handshake:ack  { instanceId, capabilities,           │ + permission gate
  │                     httpEndpoint?, designRemote? } ─────┤
  │                                                         │
  ├─── rpc:request    { id, capability, args } ───────────▶│
  │                                                         │ open? → run handler
  │                                                         │ gated? → gate.check()
  │                                                         │           ├ standing → run
  │                                                         │           └ miss → prompt user
  │◀── rpc:response   { id, ok, value | error } ────────────┤
  │                                                         │
  │◀── event { name, payload } ─────────────────────────────┤
```

## Permission gate

```ts
import { PermissionGate, type PermissionScope } from '@apna/sdk';

const gate = new PermissionGate({
  appId: 'social-mini-app',
  appName: 'Social',
  prompt: async ({ capabilities }) => {
    // Render your UI; return one decision per requested capability.
    return capabilities.map((cap) => ({
      capability: cap,
      decision: 'allow',
      scope: 'always' as PermissionScope, // 'once' | 'session' | 'always'
    }));
  },
});
```

`always` decisions persist in localStorage (host-side). `session` lives in memory until the modal closes. `once` is consumed by the next call. Users review and revoke from the host's settings page.

## Channel adapters

`@apna/sdk` is transport-agnostic. The protocol runs over any `Channel`:

```ts
interface Channel {
  send(message: ApnaMessage): void;
  onMessage(handler: (m: ApnaMessage) => void): () => void;
  ready(): Promise<void>;
  dispose(): void;
}
```

Built-ins:

| Channel | Topology |
|---|---|
| `IframeChannel` | Mini-app in an iframe, host page is the parent. |
| `ExtensionChannel` | Mini-app top-level, host is a browser extension content-script relay. |

`detectChannel()` infers from the runtime; pass `{ channel }` to override.

## Migration from 0.1.x

If you were on `@apna/sdk` 0.1.x, the redesign is breaking. The flat `apna.nostr.*` surface (`fetchFeed`, `getActiveUserProfile`, `publishNote`, `likeNote`, `replyToNote`, `repostNote`, `followUser`, `unfollowUser`, `fetchNote`, `fetchNoteAndReplies`, `fetchNoteLikes`, `fetchNoteReposts`, `fetchUserFeed`, `fetchUserProfile`, `fetchUserMetadata`, `updateProfileMetadata`) is gone. Mapping to the new versioned domain modules:

| Old 0.1.x | New 0.3.x |
|---|---|
| `apna.nostr.getActiveUserProfile()` | `apna.identity.v1.me()` — note `pubkey` is now hex, not nprofile |
| `apna.nostr.updateProfileMetadata(m)` | `apna.identity.v1.updateProfile(m)` |
| `apna.nostr.fetchFeed(type, since, until, limit)` | `apna.social.v1.feed(type, { since, until, limit })` |
| `apna.nostr.fetchUserFeed(npub, type, since, until, limit)` | `apna.social.v1.userFeed(npub, type, { since, until, limit })` |
| `apna.nostr.fetchNote(id)` | `apna.social.v1.note(id)` |
| `apna.nostr.fetchNoteAndReplies(id)` | `apna.social.v1.noteAndReplies(id)` |
| `apna.nostr.fetchNoteLikes(id, since)` | `apna.social.v1.noteLikes(id, since)` |
| `apna.nostr.fetchNoteReposts(id, since)` | `apna.social.v1.noteReposts(id, since)` |
| `apna.nostr.fetchUserProfile(pk)` | `apna.social.v1.userProfile(pk)` |
| `apna.nostr.fetchUserMetadata(pk)` | `apna.social.v1.userMetadata(pk)` |
| `apna.nostr.publishNote(content)` | `apna.social.v1.publishNote(content)` |
| `apna.nostr.likeNote(id)` | `apna.social.v1.like(id)` |
| `apna.nostr.likeNote(id)` | `apna.social.v1.react(id, '+')` |
| `apna.nostr.repostNote(id, '')` | `apna.social.v1.repost(id)` |
| `apna.nostr.repostNote(id, quote)` | `apna.social.v1.quoteRepost(id, quote)` |
| `apna.nostr.replyToNote(id, content)` | `apna.social.v1.reply(id, content)` |
| `apna.nostr.followUser(pk)` | `apna.social.v1.follow(pk)` |
| `apna.nostr.unfollowUser(pk)` | `apna.social.v1.unfollow(pk)` |

Realtime social paths are available on `apna.social.v1`: `subscribeFeed`, `subscribeUserFeed`, `subscribeThread`, `subscribeNotifications`, `subscribeMessages`, and `subscribeProfile`. Power paths (custom filters) move to the low-level `apna.nostr.*` protocol module: `apna.nostr.query`, `apna.nostr.queryOne`, `apna.nostr.subscribe`, `apna.nostr.signEvent`, `apna.nostr.publish`.

Host side: the old `{ methodHandlers: { nostr: { … } } }` shape is replaced by a flat `handlers: CapabilityHandlers` registry keyed by full capability string (e.g. `'nostr.signEvent'`, `'social.v1.publishNote'`). A temporary back-compat adapter accepts the old shape but it will be removed in a future release.

## Development

```bash
npm install         # or yarn
npm start           # tsdx watch
npm run build       # CJS / ESM / UMD output to dist/
npm test            # jest
npm run size        # bundle-size budget check
npm run release     # publish via np (interactive — requires npm OTP)
```

## License

MIT
