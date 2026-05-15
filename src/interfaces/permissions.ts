/**
 * `apna.permissions` — the gating/permissions control contract.
 *
 * Enforcement is host-side: a `gated` capability call passes through the host's
 * permission gate before its handler runs. This client-side surface is
 * convenience/UX — letting a mini-app prompt upfront and reflect grant state in
 * its own UI — plus the typed error a denied call surfaces.
 */

/**
 * How long a permission decision stands:
 * - `always`  — persisted; not re-prompted on future launches.
 * - `session` — lasts the lifetime of this running instance.
 * - `once`    — consumed by a single call; re-prompted next time.
 */
export type PermissionScope = 'always' | 'once' | 'session';

/** Whether the user allowed or denied the capability. */
export type PermissionDecision = 'allow' | 'deny';

/** A single standing permission decision for a capability. */
export interface Permission {
  /** Fully-qualified capability string, e.g. `nostr.signEvent`. */
  capability: string;
  decision: PermissionDecision;
  scope: PermissionScope;
}

/** `apna.permissions` — request, inspect, and revoke capability grants. */
export interface ApnaPermissions {
  /** Proactively prompt the user for one or more gated capabilities. */
  request(capabilities: string[]): Promise<Permission[]>;
  /** Current standing grants for this mini-app. */
  query(): Promise<Permission[]>;
  /** Revoke a previously-granted capability. */
  revoke(capability: string): Promise<void>;
}

/**
 * Thrown when a `gated` capability call is rejected because the user has not
 * granted it (the host returned an `rpc:response` with code `permission-denied`).
 */
export class PermissionDeniedError extends Error {
  /** The capability that was denied, when known. */
  readonly capability?: string;

  constructor(message: string, capability?: string) {
    super(message);
    this.name = 'PermissionDeniedError';
    this.capability = capability;
    // Restore the prototype chain — `extends Error` loses it when the SDK is
    // transpiled below ES2015 (tsdx/Babel), breaking `instanceof`.
    Object.setPrototypeOf(this, PermissionDeniedError.prototype);
  }
}
