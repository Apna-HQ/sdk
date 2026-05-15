/**
 * `HttpClient` — the optional cached-read path.
 *
 * When the host advertised an `httpEndpoint` at handshake, read-only,
 * `open`-gated capabilities route here instead of over the bridge: a plain
 * `POST` the host's Next.js backend can cache (`unstable_cache` / CDN), shared
 * across every mini-app and user.
 *
 * Wire contract (uniform across all capabilities — see `transport.ts`):
 * - `call`      → `POST {endpoint}/{method}` with body `{ capability, args }`,
 *                 response is the capability's JSON return value.
 * - `subscribe` → `EventSource` on
 *                 `GET {endpoint}/subscribe?capability=…&args=…`, one JSON
 *                 frame per event.
 *
 * NOTE for APNA-RD-HOST-008: the host's `/api/nostr/query` + `/api/nostr/subscribe`
 * routes (built in HOST-005/006) currently take `{ filters, relays?, revalidate? }`
 * / `?filters=&relays=`. They must be aligned to this uniform
 * `{ capability, args }` shape so HTTP and bridge are interchangeable transports
 * for the same `(capability, args)` call. Those routes are not wired to anything
 * yet, so the change is safe.
 */

/** Minimal `EventSource` shape — injectable for tests / non-browser runtimes. */
export interface EventSourceLike {
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  close(): void;
}
export type EventSourceCtor = (url: string) => EventSourceLike;

export interface HttpClientOptions {
  /** Base URL the host advertised, e.g. `https://host/api/nostr`. */
  endpoint: string;
  /** In-flight promise dedup TTL in ms. Default 10000. */
  dedupTtlMs?: number;
  /** Injectable `fetch` (defaults to the global). */
  fetchImpl?: typeof fetch;
  /** Injectable `EventSource` constructor (defaults to the global). */
  eventSourceCtor?: EventSourceCtor;
}

/** Deterministic stringify so dedup keys are stable regardless of key order. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') +
    '}'
  );
}

export class HttpClient {
  private readonly endpoint: string;
  private readonly dedupTtlMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly eventSourceCtor?: EventSourceCtor;
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(options: HttpClientOptions) {
    this.endpoint = options.endpoint.replace(/\/+$/, '');
    this.dedupTtlMs = options.dedupTtlMs ?? 10_000;
    this.fetchImpl =
      options.fetchImpl ??
      ((globalThis as { fetch?: typeof fetch }).fetch as typeof fetch);
    this.eventSourceCtor =
      options.eventSourceCtor ??
      (typeof EventSource !== 'undefined'
        ? (url: string) => new EventSource(url) as unknown as EventSourceLike
        : undefined);
  }

  /** POST a read-only capability call; identical in-flight calls are de-duped. */
  call(capability: string, args: unknown[] = []): Promise<unknown> {
    const key = capability + '|' + stableStringify(args);
    const existing = this.inflight.get(key);
    if (existing) return existing;

    const method = capability.split('.').pop() || capability;
    const url = `${this.endpoint}/${method}`;
    const promise = this.fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ capability, args }),
    }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(
          `[apna] HTTP ${res.status} for '${capability}'${text ? ': ' + text : ''}`
        );
      }
      return (await res.json()) as unknown;
    });

    this.inflight.set(key, promise);
    const clear = (): void => {
      if (this.inflight.get(key) === promise) this.inflight.delete(key);
    };
    promise.then(clear, clear);
    setTimeout(clear, this.dedupTtlMs);
    return promise;
  }

  /** Open an SSE stream for a read-only capability. Returns an unsubscribe fn. */
  subscribe(
    capability: string,
    args: unknown[],
    onEvent: (data: unknown) => void
  ): () => void {
    if (!this.eventSourceCtor) {
      throw new Error('[apna] EventSource is not available in this runtime');
    }
    const params = new URLSearchParams({
      capability,
      args: JSON.stringify(args),
    });
    const source = this.eventSourceCtor(
      `${this.endpoint}/subscribe?${params.toString()}`
    );
    source.onmessage = (event) => {
      try {
        onEvent(JSON.parse(event.data));
      } catch {
        // Ignore malformed frames (e.g. heartbeat comments slip through as '').
      }
    };
    return () => source.close();
  }
}
