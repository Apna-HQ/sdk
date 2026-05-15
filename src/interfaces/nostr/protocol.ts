/**
 * `apna.nostr` — the low-level, protocol-native Nostr contract.
 *
 * This is the new versioned source of truth that replaces the flat `INostr`
 * (still in `./index.ts` until APNA-RD-SDK-009 removes it). It lives at
 * `interfaces/nostr/protocol.ts` rather than `interfaces/nostr.ts` on purpose:
 * a sibling `nostr.ts` file would shadow the still-consumed `nostr/index.ts`.
 */

/**
 * A Nostr REQ filter (NIP-01). Tag filters use `#<single-letter>` keys
 * (`'#e'`, `'#p'`, `'#t'`, …).
 *
 * NOTE: the tag-filter index is a broad `string` index rather than a tighter
 * template-literal `` `#${string}` `` key — tsdx's (old) Babel build cannot
 * parse template-literal index signatures. The value union is widened to
 * accommodate the typed scalar fields above it.
 */
export interface NostrFilter {
  ids?: string[];
  kinds?: number[];
  authors?: string[];
  since?: number;
  until?: number;
  limit?: number;
  search?: string;
  /** Tag filters, e.g. `'#e'`, `'#p'`, `'#t'` — plus the typed fields above. */
  [tagFilter: string]: string[] | number | number[] | string | undefined;
}

/**
 * An unsigned event template — what a mini-app hands to `signEvent` / `publish`.
 * `created_at` is optional; the host fills `Math.floor(Date.now() / 1000)` when
 * omitted.
 */
export interface EventTemplate {
  kind: number;
  content: string;
  tags: string[][];
  created_at?: number;
}

/** A signed, relay-ready Nostr event (NIP-01). */
export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  tags: string[][];
  sig: string;
}

/** NIP-04 / NIP-44 encryption surface (delegated to the host's active signer). */
export interface EncryptionApi {
  encrypt(pubkey: string, plaintext: string): Promise<string>;
  decrypt(pubkey: string, ciphertext: string): Promise<string>;
}

/** Handle returned by `subscribe` — call it to close the subscription. */
export type Unsubscribe = () => void;

/** Options accepted by read calls. */
export interface QueryOptions {
  /** Override the host's default relay set for this call. */
  relays?: string[];
  /** Override the host's default cache TTL, in seconds. */
  revalidate?: number;
}

/**
 * The low-level Nostr surface for power developers.
 *
 * Reads (`query` / `queryOne` / `subscribe`) route through the host's cached
 * HTTP endpoint when one was advertised at handshake; signs and publishes
 * (`signEvent` / `publish` / `nip04` / `nip44`) always go over the bridge so
 * the user's keys never leave the host.
 */
export interface ApnaNostr {
  query(
    filters: NostrFilter | NostrFilter[],
    opts?: QueryOptions
  ): Promise<NostrEvent[]>;
  queryOne(
    filter: NostrFilter,
    opts?: QueryOptions
  ): Promise<NostrEvent | null>;
  subscribe(
    filters: NostrFilter | NostrFilter[],
    onEvent: (event: NostrEvent) => void,
    opts?: QueryOptions
  ): Unsubscribe;
  getPublicKey(): Promise<string>;
  signEvent(template: EventTemplate): Promise<NostrEvent>;
  publish(template: EventTemplate): Promise<NostrEvent>;
  nip04: EncryptionApi;
  nip44: EncryptionApi;
}
