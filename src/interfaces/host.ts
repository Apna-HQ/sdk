/**
 * Host-side capability registry contract.
 *
 * The host (`apna-app` or any other) implements a `CapabilityHandlers` map and
 * hands it to `ApnaHost`. Keys are fully-qualified, versioned capability
 * strings, e.g. `nostr.query`, `social.v1.publishNote`, `identity.v1.me`.
 */
import { Gating } from '../core/protocol';

/** One capability the host implements. */
export interface CapabilityHandler {
  /** Invoked with the `rpc:request` args; its resolved value is returned. */
  handler: (...args: any[]) => Promise<unknown>;
  /** Whether the call must pass the permission gate before `handler` runs. */
  gating: Gating;
}

/**
 * The full namespaced/versioned registry the host advertises and dispatches
 * against, keyed by capability string.
 */
export type CapabilityHandlers = Record<string, CapabilityHandler>;
