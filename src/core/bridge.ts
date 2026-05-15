/**
 * `Bridge` — the RPC request/response correlation layer over a `Channel`.
 *
 * Replaces `post-robot`. Tiny and per-instance: an incrementing request id, a
 * pending-promise map, one channel listener, a timeout per request. No
 * module-global state, so many bridges (one per mini-app instance) coexist.
 *
 * Used by both ends:
 * - the client calls `handshake()`, `request()`, `requestPermission()`;
 * - the host listens via `on('rpc:request' | 'handshake:init' | ...)` and
 *   replies / pushes events with `send()`.
 */
import { Channel } from './channels';
import {
  APNA_PROTOCOL,
  ApnaMessage,
  HandshakeAck,
  MessageType,
  PermissionGrant,
  PermissionResponse,
  RpcError,
  RpcResponse,
  StreamEvent,
  StreamStart,
  StreamStop,
} from './protocol';
import { PermissionDeniedError } from '../interfaces/permissions';

export interface BridgeOptions {
  /** Per-running-instance id stamped on outbound requests. Generated if omitted. */
  instanceId?: string;
  /** Per-request timeout in milliseconds. Default 30000. */
  timeoutMs?: number;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface PendingStream {
  onEvent: (data: unknown) => void;
}

/** Inbound message types a consumer can subscribe to via `on()`. */
type InboundType =
  | typeof MessageType.HandshakeInit
  | typeof MessageType.RpcRequest
  | typeof MessageType.StreamStart
  | typeof MessageType.StreamStop
  | typeof MessageType.PermissionRequest
  | typeof MessageType.Event;

/** A bridge-level error carrying the protocol error `code`. */
export class BridgeError extends Error {
  readonly code: string;

  constructor(error: RpcError) {
    super(error.message);
    this.name = 'BridgeError';
    this.code = error.code;
    // Restore the prototype chain — `extends Error` loses it when the SDK is
    // transpiled below ES2015 (tsdx/Babel), breaking `instanceof`.
    Object.setPrototypeOf(this, BridgeError.prototype);
  }
}

/** Mint a per-running-instance id (uses `crypto.randomUUID` when available). */
export function generateInstanceId(): string {
  // Typed loosely so the build doesn't depend on `Crypto.randomUUID` being in
  // the ambient DOM lib (it isn't in every TS lib config tsdx builds against).
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return (
    'inst-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  );
}

function toError(error?: RpcError): Error {
  if (!error) {
    return new BridgeError({ code: 'unknown', message: '[apna] request failed' });
  }
  if (error.code === 'permission-denied') {
    return new PermissionDeniedError(error.message);
  }
  return new BridgeError(error);
}

export class Bridge {
  /** Per-running-instance id stamped on every outbound request. */
  readonly instanceId: string;

  private readonly channel: Channel;
  private readonly timeoutMs: number;
  private readonly pending = new Map<number, Pending>();
  private readonly streams = new Map<number, PendingStream>();
  private readonly listeners = new Map<
    InboundType,
    Set<(message: ApnaMessage) => void>
  >();
  private handshakePending: Pending | null = null;
  private nextId = 1;
  private offMessage: (() => void) | null;
  private disposed = false;

  constructor(channel: Channel, options: BridgeOptions = {}) {
    this.channel = channel;
    this.instanceId = options.instanceId ?? generateInstanceId();
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.offMessage = this.channel.onMessage(this.route);
  }

  /* ----------------------------- client side ----------------------------- */

  /** Open a session: send `handshake:init`, resolve with the host's `handshake:ack`. */
  handshake(payload: {
    appId: string;
    sdkVersion: string;
  }): Promise<HandshakeAck> {
    if (this.disposed) {
      return Promise.reject(new Error('[apna] Bridge disposed'));
    }
    if (this.handshakePending) {
      return Promise.reject(new Error('[apna] handshake already in progress'));
    }
    return new Promise<HandshakeAck>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.handshakePending = null;
        reject(
          new BridgeError({
            code: 'timeout',
            message: `[apna] handshake timed out after ${this.timeoutMs}ms`,
          })
        );
      }, this.timeoutMs);
      this.handshakePending = {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      };
      this.channel.send({
        protocol: APNA_PROTOCOL,
        type: MessageType.HandshakeInit,
        appId: payload.appId,
        instanceId: this.instanceId,
        sdkVersion: payload.sdkVersion,
      });
    });
  }

  /** Invoke a host capability; resolves with its return value. */
  request(capability: string, args: unknown[] = []): Promise<unknown> {
    if (this.disposed) {
      return Promise.reject(new Error('[apna] Bridge disposed'));
    }
    const id = this.nextId++;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new BridgeError({
            code: 'timeout',
            message: `[apna] rpc '${capability}' timed out after ${this.timeoutMs}ms`,
          })
        );
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.channel.send({
        protocol: APNA_PROTOCOL,
        type: MessageType.RpcRequest,
        id,
        instanceId: this.instanceId,
        capability,
        args,
      });
    });
  }

  /** Proactively ask the host to prompt for one or more gated capabilities. */
  requestPermission(capabilities: string[]): Promise<PermissionGrant[]> {
    if (this.disposed) {
      return Promise.reject(new Error('[apna] Bridge disposed'));
    }
    const id = this.nextId++;
    return new Promise<PermissionGrant[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new BridgeError({
            code: 'timeout',
            message: `[apna] permission request timed out after ${this.timeoutMs}ms`,
          })
        );
      }, this.timeoutMs);
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
      this.channel.send({
        protocol: APNA_PROTOCOL,
        type: MessageType.PermissionRequest,
        id,
        instanceId: this.instanceId,
        capabilities,
      });
    });
  }

  /**
   * Start a host-backed stream over the bridge. The returned function closes
   * the stream locally and asks the host to release its subscription.
   */
  stream(
    capability: string,
    args: unknown[] = [],
    onEvent: (data: unknown) => void
  ): () => void {
    if (this.disposed) {
      throw new Error('[apna] Bridge disposed');
    }
    const id = this.nextId++;
    this.streams.set(id, { onEvent });
    this.channel.send({
      protocol: APNA_PROTOCOL,
      type: MessageType.StreamStart,
      id,
      instanceId: this.instanceId,
      capability,
      args,
    });
    return () => {
      if (!this.streams.delete(id) || this.disposed) return;
      this.channel.send({
        protocol: APNA_PROTOCOL,
        type: MessageType.StreamStop,
        id,
        instanceId: this.instanceId,
      });
    };
  }

  /* ------------------------------ host side ------------------------------ */

  /** Subscribe to an inbound message type. Returns an unsubscribe function. */
  on<T extends InboundType>(
    type: T,
    handler: (message: Extract<ApnaMessage, { type: T }>) => void
  ): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    const wrapped = handler as (message: ApnaMessage) => void;
    set.add(wrapped);
    return () => {
      this.listeners.get(type)?.delete(wrapped);
    };
  }

  /** Low-level passthrough — used by the host to send responses / events. */
  send(message: ApnaMessage): void {
    if (this.disposed) return;
    this.channel.send(message);
  }

  /** Host helper: subscribe to client stream starts. */
  onStreamStart(handler: (message: StreamStart) => void): () => void {
    return this.on(MessageType.StreamStart, handler);
  }

  /** Host helper: emit one payload for an active client stream. */
  emitStreamEvent(
    stream: Pick<StreamStart, 'id' | 'instanceId'>,
    payload: unknown
  ): void {
    this.send({
      protocol: APNA_PROTOCOL,
      type: MessageType.StreamEvent,
      id: stream.id,
      instanceId: stream.instanceId,
      payload,
    });
  }

  /** Host helper: stop an active client stream, optionally with an error. */
  stopStream(
    stream: Pick<StreamStart, 'id' | 'instanceId'>,
    error?: RpcError
  ): void {
    this.send({
      protocol: APNA_PROTOCOL,
      type: MessageType.StreamStop,
      id: stream.id,
      instanceId: stream.instanceId,
      error,
    });
  }

  /* ------------------------------ lifecycle ------------------------------ */

  /** Reject all pending promises, drop listeners, and detach the channel. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const disposedError = new Error('[apna] Bridge disposed');
    this.pending.forEach((entry) => {
      clearTimeout(entry.timer);
      entry.reject(disposedError);
    });
    this.pending.clear();
    this.streams.clear();
    if (this.handshakePending) {
      clearTimeout(this.handshakePending.timer);
      this.handshakePending.reject(disposedError);
      this.handshakePending = null;
    }
    this.listeners.clear();
    this.offMessage?.();
    this.offMessage = null;
  }

  /* ------------------------------- routing ------------------------------- */

  private readonly route = (message: ApnaMessage): void => {
    if (this.disposed) return;
    switch (message.type) {
      case MessageType.RpcResponse:
      case MessageType.PermissionResponse:
        this.settle(message);
        return;
      case MessageType.StreamEvent:
        this.deliverStreamEvent(message);
        return;
      case MessageType.StreamStop:
        this.handleStreamStop(message);
        this.dispatch(message.type, message);
        return;
      case MessageType.HandshakeAck:
        this.settleHandshake(message);
        return;
      case MessageType.HandshakeInit:
      case MessageType.RpcRequest:
      case MessageType.StreamStart:
      case MessageType.PermissionRequest:
      case MessageType.Event:
        this.dispatch(message.type, message);
        return;
      default:
        return;
    }
  };

  private settle(message: RpcResponse | PermissionResponse): void {
    const entry = this.pending.get(message.id);
    if (!entry) return;
    this.pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.ok) {
      entry.resolve(
        message.type === MessageType.RpcResponse
          ? message.value
          : message.grants
      );
    } else {
      entry.reject(toError(message.error));
    }
  }

  private settleHandshake(message: HandshakeAck): void {
    const entry = this.handshakePending;
    if (!entry) return;
    if (message.instanceId !== this.instanceId) return;
    this.handshakePending = null;
    clearTimeout(entry.timer);
    entry.resolve(message);
  }

  private deliverStreamEvent(message: StreamEvent): void {
    const entry = this.streams.get(message.id);
    if (!entry) return;
    if (message.instanceId !== this.instanceId) return;
    entry.onEvent(message.payload);
  }

  private handleStreamStop(message: StreamStop): void {
    const entry = this.streams.get(message.id);
    if (!entry) return;
    if (message.instanceId !== this.instanceId) return;
    this.streams.delete(message.id);
  }

  private dispatch(type: InboundType, message: ApnaMessage): void {
    const set = this.listeners.get(type);
    if (!set) return;
    set.forEach((handler) => handler(message));
  }
}
