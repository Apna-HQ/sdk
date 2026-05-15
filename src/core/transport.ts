/**
 * `Transport` — the per-call HTTP-vs-bridge router.
 *
 * One uniform `(capability, args)` call surface for every SDK module. A call
 * goes over the cached HTTP path when ALL of:
 *   - the host advertised an `httpEndpoint` (an `HttpClient` was supplied), and
 *   - the capability's negotiated `gating` is `open` (read-only / public).
 * Otherwise it goes over the bridge — which is also where everything `gated`
 * (signs, writes, permissioned reads) goes, so keys + consent stay host-side.
 */
import { Bridge } from './bridge';
import { HttpClient } from './http';
import { CapabilityDescriptor, Gating } from './protocol';

export interface TransportOptions {
  bridge: Bridge;
  /** Present only when the host advertised an `httpEndpoint`. */
  httpClient?: HttpClient;
  /** Capability descriptors negotiated at handshake (carry the `gating` class). */
  capabilities: CapabilityDescriptor[];
}

export class Transport {
  private readonly bridge: Bridge;
  private readonly httpClient?: HttpClient;
  private readonly gating = new Map<string, Gating>();

  constructor(options: TransportOptions) {
    this.bridge = options.bridge;
    this.httpClient = options.httpClient;
    options.capabilities.forEach((descriptor) => {
      this.gating.set(descriptor.capability, descriptor.gating);
    });
  }

  /** Invoke a capability — routed to HTTP cache when eligible, else the bridge. */
  call(capability: string, args: unknown[] = []): Promise<unknown> {
    if (this.httpClient && this.isHttpEligible(capability)) {
      return this.httpClient.call(capability, args);
    }
    return this.bridge.request(capability, args);
  }

  /**
   * Subscribe to a streaming capability. Prefers the host's SSE endpoint for
   * open reads, then falls back to bridge streaming when HTTP is unavailable or
   * the capability is gated.
   */
  subscribe(
    capability: string,
    args: unknown[],
    onEvent: (data: unknown) => void
  ): () => void {
    if (this.httpClient && this.isHttpEligible(capability)) {
      return this.httpClient.subscribe(capability, args, onEvent);
    }
    return this.bridge.stream(capability, args, onEvent);
  }

  /** True if the capability is `open`-gated and an HTTP client is available. */
  private isHttpEligible(capability: string): boolean {
    return this.gating.get(capability) === 'open';
  }
}
