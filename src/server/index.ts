/**
 * @apna/sdk/server — DOM-free, channel-free SDK surface for mini-app backends.
 *
 * Usage (Node.js / edge runtime):
 *
 *   import { createApnaServer } from '@apna/sdk/server';
 *   import { finalizeEvent, getPublicKey } from 'nostr-tools';
 *   import * as nip19 from 'nostr-tools/nip19';
 *
 *   const sk = nip19.decode(process.env.PUBLISHER_NSEC).data; // Uint8Array
 *   const apna = createApnaServer({
 *     signer: {
 *       getPublicKey: async () => getPublicKey(sk),
 *       signEvent: async (template) => finalizeEvent(template, sk),
 *     },
 *     httpEndpoint: 'https://my-apna-host.example.com/api/apna',
 *   });
 *
 *   await apna.notifications.send({ title: 'Hello', body: 'World' });
 *
 * -----------------------------------------------------------------------
 * SECURITY EXPECTATION
 * -----------------------------------------------------------------------
 * The backend server holds the **publisher's Nostr private key** — the same
 * keypair that signed the mini-app's metadata event (the "app identity").
 * Every call to the host is authenticated with a NIP-98 signed token using
 * that key. The host verifies:
 *   1. The NIP-98 signature is valid and the event is recent (< 60 s).
 *   2. The signer's pubkey appears as the author of a published mini-app
 *      metadata note — i.e. the caller really is the app publisher.
 *
 * Do NOT expose the private key to the browser or commit it to source
 * control. Use an environment variable / secrets manager. Rotate it by
 * re-publishing the mini-app metadata with the new key.
 * -----------------------------------------------------------------------
 *
 * This module imports ONLY:
 *   - The shared type contracts from `../interfaces` (types-only, zero runtime).
 *   - Node's built-in `globalThis` for `fetch` (available natively in Node 18+).
 *
 * There are NO imports of browser-only APIs (`window`, `document`,
 * `postMessage`, channel adapters, React, etc.).
 */

import type {
  EventTemplate,
  NostrEvent,
  NostrFilter,
  QueryOptions,
  NotificationPayload,
} from '../interfaces';

/* -------------------------------------------------------------------------- */
/* Signer interface                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A minimal signing interface the caller supplies.
 *
 * Matches the shape produced by `nostr-tools` (`finalizeEvent` / `getPublicKey`)
 * and the NIP-07 browser provider, so any Nostr key-management library works.
 * On the server you typically construct this once with the publisher's private
 * key and pass it to `createApnaServer`.
 *
 * Example (nostr-tools):
 *   const sk = nip19.decode(process.env.PUBLISHER_NSEC).data;
 *   const signer: ServerSigner = {
 *     getPublicKey: async () => getPublicKey(sk),
 *     signEvent:   async (t) => finalizeEvent(t, sk),
 *   };
 */
export interface ServerSigner {
  /** Returns the hex-encoded public key of the publisher. */
  getPublicKey(): Promise<string>;
  /**
   * Signs an unsigned Nostr event template and returns the complete, signed
   * event including `id`, `pubkey`, `created_at`, and `sig`.
   */
  signEvent(template: EventTemplate): Promise<NostrEvent>;
}

/* -------------------------------------------------------------------------- */
/* createApnaServer options                                                    */
/* -------------------------------------------------------------------------- */

export interface CreateApnaServerOptions {
  /**
   * The mini-app publisher's Nostr signing interface.
   * Use `nostr-tools` `finalizeEvent` / `getPublicKey` on the server.
   */
  signer: ServerSigner;
  /**
   * The Apna host's HTTP capability base URL.
   * Typically `https://<host>/api/apna`, e.g. `https://apna.app/api/apna`.
   *
   * The server SDK calls:
   *   POST {httpEndpoint}/notifications/send
   *   POST {httpEndpoint}/nostr/query
   *   POST {httpEndpoint}/nostr/publish
   */
  httpEndpoint: string;
  /**
   * Injectable `fetch` implementation (defaults to `globalThis.fetch`).
   * Useful in tests or runtimes that require a polyfill.
   */
  fetchImpl?: typeof fetch;
}

/* -------------------------------------------------------------------------- */
/* NIP-98 token generation                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Build and sign a NIP-98 HTTP Authentication event (kind 27235).
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/98.md
 *
 * The resulting base64-encoded event is sent as `Authorization: Nostr <token>`.
 */
async function buildNip98Header(
  signer: ServerSigner,
  url: string,
  method: string
): Promise<string> {
  const normalizedMethod = method.toUpperCase();
  // NIP-98 kind 27235 event template.
  const template: EventTemplate = {
    kind: 27235,
    content: '',
    tags: [
      ['u', url],
      ['method', normalizedMethod],
    ],
    created_at: Math.floor(Date.now() / 1000),
  };
  const signed = await signer.signEvent(template);
  // Encode the full signed event as base64 and prefix with "Nostr ".
  // Use globalThis.btoa when available (Node 16+, browsers); fall back to
  // Buffer.from for older Node environments.
  const json = JSON.stringify(signed);
  const token: string =
    typeof (globalThis as { btoa?: (s: string) => string }).btoa === 'function'
      ? (globalThis as { btoa: (s: string) => string }).btoa(json)
      : Buffer.from(json).toString('base64');
  return `Nostr ${token}`;
}

/* -------------------------------------------------------------------------- */
/* Authenticated fetch helper                                                  */
/* -------------------------------------------------------------------------- */

async function authedFetch(
  signer: ServerSigner,
  fetchImpl: typeof fetch,
  url: string,
  body: unknown
): Promise<unknown> {
  const authHeader = await buildNip98Header(signer, url, 'POST');
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: authHeader,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `[apna/server] HTTP ${res.status} for POST ${url}${text ? ': ' + text : ''}`
    );
  }
  // Return parsed JSON when available, otherwise undefined.
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as unknown;
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* ApnaServer surface                                                          */
/* -------------------------------------------------------------------------- */

/** The server-side notifications surface (send only — no SW/client methods). */
export interface ServerNotifications {
  /**
   * Fan out a push notification to all subscribed devices for this mini-app.
   *
   * Requires a NIP-98 token signed by the publisher's key. The host verifies
   * that the signer owns a published mini-app metadata note before dispatching.
   *
   * @param payload - Notification title, body, icon, url, and optional data.
   */
  send(payload: NotificationPayload): Promise<void>;
}

/** The server-side Nostr surface (query + publish — no signing delegation). */
export interface ServerNostr {
  /**
   * Query the host's Nostr relay pool.
   *
   * Uses a NIP-98-authenticated POST to `{httpEndpoint}/nostr/query`.
   * The host may cache the response.
   */
  query(
    filters: NostrFilter | NostrFilter[],
    opts?: QueryOptions
  ): Promise<NostrEvent[]>;
  /**
   * Sign (locally, via the `signer`) and publish an event to the host's relays.
   *
   * Uses a NIP-98-authenticated POST to `{httpEndpoint}/nostr/publish`.
   * The event is signed by the server before the request is sent.
   */
  publish(template: EventTemplate): Promise<NostrEvent>;
}

/** The assembled server SDK object returned by `createApnaServer`. */
export interface ApnaServer {
  /** Push-notification surface (send only). */
  notifications: ServerNotifications;
  /** Low-level Nostr surface (query + publish). */
  nostr: ServerNostr;
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Create a mini-app server SDK instance.
 *
 * Configured with the mini-app **publisher's** Nostr keypair (its root
 * identity). Every request to the host is authenticated with a NIP-98
 * signed token so the host can verify the caller is the app publisher.
 *
 * This function is safe to call in Node.js, Deno, edge runtimes, or any
 * environment that provides `fetch` (natively or via a polyfill). It imports
 * no browser-only APIs.
 *
 * @param options.signer       - Publisher's Nostr signer (getPublicKey + signEvent).
 * @param options.httpEndpoint - The host's HTTP capability base URL.
 * @param options.fetchImpl    - Optional fetch override (defaults to globalThis.fetch).
 */
export function createApnaServer(
  options: CreateApnaServerOptions
): ApnaServer {
  const { signer, httpEndpoint, fetchImpl } = options;
  const base = httpEndpoint.replace(/\/+$/, '');
  // Resolve fetch: prefer the injected impl, then globalThis.fetch.
  // We deliberately avoid importing `node-fetch` or any polyfill so the
  // module stays dependency-free and works with Node 18+ built-in fetch.
  const _fetch: typeof fetch =
    fetchImpl ??
    (globalThis as { fetch?: typeof fetch }).fetch ??
    (() => {
      throw new Error(
        '[apna/server] No global fetch available. Pass `fetchImpl` explicitly or upgrade to Node 18+.'
      );
    })();

  // --------------------------------------------------------------------------
  // notifications
  // --------------------------------------------------------------------------
  const notifications: ServerNotifications = {
    async send(payload: NotificationPayload): Promise<void> {
      const url = `${base}/notifications/send`;
      await authedFetch(signer, _fetch, url, payload);
    },
  };

  // --------------------------------------------------------------------------
  // nostr
  // --------------------------------------------------------------------------
  const nostr: ServerNostr = {
    async query(
      filters: NostrFilter | NostrFilter[],
      opts?: QueryOptions
    ): Promise<NostrEvent[]> {
      const url = `${base}/nostr/query`;
      const result = await authedFetch(signer, _fetch, url, { filters, ...opts });
      return result as NostrEvent[];
    },

    async publish(template: EventTemplate): Promise<NostrEvent> {
      // Sign the event server-side (the private key lives on the backend).
      const signed = await signer.signEvent(template);
      const url = `${base}/nostr/publish`;
      const result = await authedFetch(signer, _fetch, url, { event: signed });
      // Return the signed event (host may enrich it with relay info, but the
      // signed event itself is the canonical result).
      return (result as NostrEvent | undefined) ?? signed;
    },
  };

  return { notifications, nostr };
}
