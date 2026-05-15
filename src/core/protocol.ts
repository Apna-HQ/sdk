/**
 * Apna SDK wire protocol.
 *
 * The shared client <-> host message contract that every transport construct
 * (channels, bridge, host) builds on. This file is intentionally
 * dependency-free and runtime-light: types, a couple of const tag literals,
 * and small type guards only. No `post-robot`, no React, no DOM access.
 *
 * Both ends of the bridge MUST agree on this file — a change here is a change
 * to the protocol and must be mirrored in the host implementation.
 */

/** Protocol version tag stamped on every envelope. Bump on breaking changes. */
export const APNA_PROTOCOL = 'apna/1' as const;
export type ApnaProtocol = typeof APNA_PROTOCOL;

/* -------------------------------------------------------------------------- */
/* Capabilities                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Whether a capability needs user consent before its handler runs.
 * - `open`  — public/read-only data, no prompt (e.g. `nostr.query`).
 * - `gated` — needs a permission grant (e.g. `nostr.signEvent`).
 */
export type Gating = 'open' | 'gated';

/**
 * A capability the host implements, as advertised in the handshake.
 * `capability` is the fully-qualified, versioned capability string, e.g.
 * `nostr.query`, `social.v1.publishNote`, `identity.v1.me`.
 */
export interface CapabilityDescriptor {
  capability: string;
  gating: Gating;
}

/* -------------------------------------------------------------------------- */
/* Message type tags                                                          */
/* -------------------------------------------------------------------------- */

export const MessageType = {
  HandshakeInit: 'handshake:init',
  HandshakeAck: 'handshake:ack',
  RpcRequest: 'rpc:request',
  RpcResponse: 'rpc:response',
  StreamStart: 'stream:start',
  StreamEvent: 'stream:event',
  StreamStop: 'stream:stop',
  PermissionRequest: 'permission:request',
  PermissionResponse: 'permission:response',
  Event: 'event',
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

/* -------------------------------------------------------------------------- */
/* Host -> app events                                                         */
/* -------------------------------------------------------------------------- */

/** Names of typed events the host can push to a mini-app. */
export const EventName = {
  /** FAB "Customise Mode" toggle — mini-app highlights customizable components. */
  CustomiseToggleHighlight: 'customise:toggleHighlight',
  /** Active user profile changed in the host. */
  ProfileSwitched: 'profile:switched',
  /** Updated design-component (Module Federation) selections for this app. */
  DesignSelections: 'design:selections',
  /** A permission grant for this app changed (granted/revoked). */
  PermissionsChanged: 'permissions:changed',
} as const;
export type EventName = (typeof EventName)[keyof typeof EventName];

/* -------------------------------------------------------------------------- */
/* Envelopes                                                                  */
/* -------------------------------------------------------------------------- */

/** Fields stamped on every Apna message so a channel can filter foreign traffic. */
interface BaseEnvelope {
  protocol: ApnaProtocol;
  type: MessageType;
}

/** client -> host: open a session. */
export interface HandshakeInit extends BaseEnvelope {
  type: typeof MessageType.HandshakeInit;
  /** Stable id of the mini-app (its publisher-rooted identity / app id). */
  appId: string;
  /** Per-running-instance id, minted by the client. Echoed on every message. */
  instanceId: string;
  /** SDK version of the mini-app, for host-side compatibility decisions. */
  sdkVersion: string;
}

/** host -> client: session accepted, capabilities negotiated. */
export interface HandshakeAck extends BaseEnvelope {
  type: typeof MessageType.HandshakeAck;
  /** Echoed back so the client can confirm the channel binding. */
  instanceId: string;
  /** Everything this host implements, with gating class per capability. */
  capabilities: CapabilityDescriptor[];
  /** Optional cached-read HTTP base, e.g. `https://host/api/nostr`. */
  httpEndpoint?: string;
  /** Optional Module Federation `remoteEntry.js` URL for host design components. */
  designRemote?: string;
}

/** client -> host: invoke a capability. */
export interface RpcRequest extends BaseEnvelope {
  type: typeof MessageType.RpcRequest;
  /** Correlation id, unique per request on a given bridge. */
  id: number;
  instanceId: string;
  /** Fully-qualified capability string, e.g. `social.v1.publishNote`. */
  capability: string;
  args: unknown[];
}

/** Structured error returned on a failed rpc / permission response. */
export interface RpcError {
  /**
   * Machine-readable error code. Known codes:
   * - `permission-denied` — a gated capability was not granted.
   * - `not-implemented`   — the host does not advertise this capability.
   * - `handler-error`     — the capability handler threw.
   * - `timeout`           — no response before the bridge timeout.
   */
  code: string;
  message: string;
}

/** host -> client: result of an `rpc:request`. */
export interface RpcResponse extends BaseEnvelope {
  type: typeof MessageType.RpcResponse;
  /** Matches the originating `RpcRequest.id`. */
  id: number;
  ok: boolean;
  /** Present when `ok` is true. */
  value?: unknown;
  /** Present when `ok` is false. `error.code` may be `permission-denied`. */
  error?: RpcError;
}

/** client -> host: start a streaming capability subscription. */
export interface StreamStart extends BaseEnvelope {
  type: typeof MessageType.StreamStart;
  /** Correlation id, unique per stream on a given bridge. */
  id: number;
  instanceId: string;
  /** Fully-qualified streaming capability string, e.g. `nostr.subscribe`. */
  capability: string;
  args: unknown[];
}

/** host -> client: one event emitted by a started stream. */
export interface StreamEvent extends BaseEnvelope {
  type: typeof MessageType.StreamEvent;
  /** Matches the originating `StreamStart.id`. */
  id: number;
  instanceId: string;
  payload?: unknown;
}

/** either side -> peer: stop a started stream. */
export interface StreamStop extends BaseEnvelope {
  type: typeof MessageType.StreamStop;
  /** Matches the originating `StreamStart.id`. */
  id: number;
  instanceId: string;
  /** Present when the stream ended because of an error. */
  error?: RpcError;
}

/** client -> host: proactively ask for one or more gated capabilities upfront. */
export interface PermissionRequest extends BaseEnvelope {
  type: typeof MessageType.PermissionRequest;
  id: number;
  instanceId: string;
  /** Fully-qualified capability strings the mini-app wants granted. */
  capabilities: string[];
}

/** A single decision in a permission response. */
export interface PermissionGrant {
  capability: string;
  decision: 'allow' | 'deny';
  scope: 'always' | 'once' | 'session';
}

/** host -> client: result of a `permission:request`. */
export interface PermissionResponse extends BaseEnvelope {
  type: typeof MessageType.PermissionResponse;
  /** Matches the originating `PermissionRequest.id`. */
  id: number;
  ok: boolean;
  grants?: PermissionGrant[];
  error?: RpcError;
}

/** host -> app: a typed push event (no response expected). */
export interface EventMessage extends BaseEnvelope {
  type: typeof MessageType.Event;
  instanceId: string;
  event: EventName;
  payload?: unknown;
}

/** The discriminated union of every message that can cross the bridge. */
export type ApnaMessage =
  | HandshakeInit
  | HandshakeAck
  | RpcRequest
  | RpcResponse
  | StreamStart
  | StreamEvent
  | StreamStop
  | PermissionRequest
  | PermissionResponse
  | EventMessage;

/* -------------------------------------------------------------------------- */
/* Type guards                                                                */
/* -------------------------------------------------------------------------- */

/** True if `value` looks like a well-formed Apna protocol message. */
export function isApnaMessage(value: unknown): value is ApnaMessage {
  if (typeof value !== 'object' || value === null) return false;
  const msg = value as Record<string, unknown>;
  return (
    msg.protocol === APNA_PROTOCOL && typeof msg.type === 'string'
  );
}

/** Narrow an `ApnaMessage` to a specific `type`. */
export function isMessageOfType<T extends MessageType>(
  msg: ApnaMessage,
  type: T
): msg is Extract<ApnaMessage, { type: T }> {
  return msg.type === type;
}
