import { Channel, IframeChannel } from '../core/channels';
import { Bridge } from '../core/bridge';
import {
  APNA_PROTOCOL,
  CapabilityDescriptor,
  EventName,
  HandshakeInit,
  MessageType,
  PermissionGrant,
  PermissionRequest,
  RpcRequest,
  StreamStart,
  StreamStop,
} from '../core/protocol';
import { CapabilityHandlers } from '../interfaces/host';
import { INostr } from '../interfaces/nostr';

/**
 * Legacy host config shape — `{ methodHandlers: { nostr: INostr } }`. Kept so
 * `apna-app` keeps working unchanged until APNA-RD-HOST-009 swaps it for the
 * namespaced `CapabilityHandlers` registry. See `adaptLegacyMethodHandlers`.
 */
export interface IHostMethodHandlers {
  nostr?: INostr;
}

export interface ApnaHostConfig {
  /** New: namespaced/versioned capability registry. */
  handlers?: CapabilityHandlers;
  /** Legacy: old `{ nostr: {...} }` method-handlers object (host-shape shim). */
  methodHandlers?: IHostMethodHandlers;
  /**
   * Channel to communicate over. Defaults to an auto-binding `IframeChannel`
   * that latches onto the first mini-app iframe that handshakes — preserving
   * the legacy "just construct it" behavior. APNA-RD-HOST-013 will pass an
   * explicit per-iframe channel for true parallel-instance isolation.
   */
  channel?: Channel;
  /** Optional HTTP read endpoint to advertise at handshake. */
  httpEndpoint?: string;
  /** Optional design-component Module Federation remote to advertise. */
  designRemote?: string;
  /** Host-supplied permission gate. If omitted, gated calls pass through. */
  permissionGate?: {
    check(capability: string): Promise<'allow' | 'deny'>;
    request?(capabilities: string[]): Promise<PermissionGrant[]>;
    query?(): PermissionGrant[];
    revoke?(capability: string): void;
  };
}

/**
 * `ApnaHost` — the host (super-app) side of the bridge, one per mini-app
 * instance. Dispatches `rpc:request`s against a `CapabilityHandlers` registry,
 * answers the handshake, and pushes typed events to the mini-app.
 *
 * Transitional: a `permissionGate` is NOT yet wired (APNA-RD-HOST-010/-014) —
 * every call currently passes straight through to its handler.
 */
export class ApnaHost {
  private readonly handlers: CapabilityHandlers;
  private readonly channel: Channel;
  private readonly bridge: Bridge;
  private readonly httpEndpoint?: string;
  private readonly designRemote?: string;
  private readonly permissionGate?: NonNullable<ApnaHostConfig['permissionGate']>;
  private readonly streamCleanups = new Map<number, () => void>();
  /** instanceId of the connected mini-app, learned at handshake. */
  private connectedInstanceId: string | null = null;

  constructor(config: ApnaHostConfig) {
    this.handlers =
      config.handlers ?? adaptLegacyMethodHandlers(config.methodHandlers);
    this.channel = config.channel ?? new IframeChannel({ autoBind: true });
    this.httpEndpoint = config.httpEndpoint;
    this.designRemote = config.designRemote;
    this.permissionGate = config.permissionGate;
    this.bridge = new Bridge(this.channel);
    this.bridge.on(MessageType.HandshakeInit, this.onHandshake);
    this.bridge.on(MessageType.RpcRequest, this.onRpcRequest);
    this.bridge.on(MessageType.PermissionRequest, this.onPermissionRequest);
    this.bridge.onStreamStart(this.onStreamStart);
    this.bridge.on(MessageType.StreamStop, this.onStreamStop);
  }

  /** Push a typed event to the connected mini-app. */
  emit(event: EventName, payload?: unknown): void {
    if (!this.connectedInstanceId) {
      console.warn('[apna] ApnaHost.emit: no mini-app connected yet');
      return;
    }
    this.bridge.send({
      protocol: APNA_PROTOCOL,
      type: MessageType.Event,
      instanceId: this.connectedInstanceId,
      event,
      payload,
    });
  }

  /**
   * Legacy compat for the old `sendMessage(iframe, 'superapp:message', payload)`.
   * The only message the ecosystem sent this way is the Customise-Mode toggle;
   * translate it to a typed event. Superseded by `emit` (APNA-RD-HOST-014).
   */
  sendMessage(
    _iframe: unknown,
    type: string,
    payload?: { type?: string }
  ): void {
    if (
      type === 'superapp:message' &&
      payload?.type === 'customise:toggleHighlight'
    ) {
      this.emit(EventName.CustomiseToggleHighlight);
      return;
    }
    console.warn(
      `[apna] ApnaHost.sendMessage: unsupported legacy message '${type}'`
    );
  }

  /** Tear down listeners and the channel. */
  dispose(): void {
    this.streamCleanups.forEach((cleanup) => cleanup());
    this.streamCleanups.clear();
    this.bridge.dispose();
    this.channel.dispose();
  }

  private readonly onHandshake = (message: HandshakeInit): void => {
    this.connectedInstanceId = message.instanceId;
    const capabilities: CapabilityDescriptor[] = Object.keys(this.handlers).map(
      (capability) => ({
        capability,
        gating: this.handlers[capability].gating,
      })
    );
    if (this.permissionGate) {
      capabilities.push(
        { capability: 'permissions.query', gating: 'open' },
        { capability: 'permissions.revoke', gating: 'gated' }
      );
    }
    this.bridge.send({
      protocol: APNA_PROTOCOL,
      type: MessageType.HandshakeAck,
      instanceId: message.instanceId,
      capabilities,
      httpEndpoint: this.httpEndpoint,
      designRemote: this.designRemote,
    });
  };

  private readonly onRpcRequest = (message: RpcRequest): void => {
    void this.dispatch(message);
  };

  private readonly onPermissionRequest = (
    message: PermissionRequest
  ): void => {
    void this.handlePermissionRequest(message);
  };

  private readonly onStreamStart = (message: StreamStart): void => {
    void this.startStream(message);
  };

  private readonly onStreamStop = (message: StreamStop): void => {
    this.stopStream(message.id);
  };

  private async dispatch(message: RpcRequest): Promise<void> {
    if (message.capability === 'permissions.query') {
      this.bridge.send({
        protocol: APNA_PROTOCOL,
        type: MessageType.RpcResponse,
        id: message.id,
        ok: true,
        value: this.permissionGate?.query?.() ?? [],
      });
      return;
    }
    if (message.capability === 'permissions.revoke') {
      const capability = String(message.args[0] ?? '');
      this.permissionGate?.revoke?.(capability);
      this.emit(EventName.PermissionsChanged, { capability });
      this.bridge.send({
        protocol: APNA_PROTOCOL,
        type: MessageType.RpcResponse,
        id: message.id,
        ok: true,
      });
      return;
    }

    const entry = this.handlers[message.capability];
    if (!entry) {
      this.bridge.send({
        protocol: APNA_PROTOCOL,
        type: MessageType.RpcResponse,
        id: message.id,
        ok: false,
        error: {
          code: 'not-implemented',
          message: `[apna] capability '${message.capability}' not implemented`,
        },
      });
      return;
    }
    try {
      const allowed = await this.ensureAllowed(message.capability, entry.gating);
      if (!allowed) {
        this.bridge.send({
          protocol: APNA_PROTOCOL,
          type: MessageType.RpcResponse,
          id: message.id,
          ok: false,
          error: {
            code: 'permission-denied',
            message: `[apna] permission denied for '${message.capability}'`,
          },
        });
        return;
      }
      const value = await entry.handler(...message.args);
      this.bridge.send({
        protocol: APNA_PROTOCOL,
        type: MessageType.RpcResponse,
        id: message.id,
        ok: true,
        value,
      });
    } catch (error) {
      this.bridge.send({
        protocol: APNA_PROTOCOL,
        type: MessageType.RpcResponse,
        id: message.id,
        ok: false,
        error: {
          code: 'handler-error',
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private async handlePermissionRequest(
    message: PermissionRequest
  ): Promise<void> {
    try {
      const grants =
        (await this.permissionGate?.request?.(message.capabilities)) ??
        message.capabilities.map((capability) => ({
          capability,
          decision: 'allow' as const,
          scope: 'session' as const,
        }));
      this.bridge.send({
        protocol: APNA_PROTOCOL,
        type: MessageType.PermissionResponse,
        id: message.id,
        ok: true,
        grants,
      });
    } catch (error) {
      this.bridge.send({
        protocol: APNA_PROTOCOL,
        type: MessageType.PermissionResponse,
        id: message.id,
        ok: false,
        error: {
          code: 'handler-error',
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private async startStream(message: StreamStart): Promise<void> {
    const entry = this.handlers[message.capability];
    if (!entry) {
      this.bridge.stopStream(message, {
        code: 'not-implemented',
        message: `[apna] capability '${message.capability}' not implemented`,
      });
      return;
    }

    try {
      const allowed = await this.ensureAllowed(message.capability, entry.gating);
      if (!allowed) {
        this.bridge.stopStream(message, {
          code: 'permission-denied',
          message: `[apna] permission denied for '${message.capability}'`,
        });
        return;
      }

      const cleanup = await entry.handler(...message.args, (payload: unknown) => {
        this.bridge.emitStreamEvent(message, payload);
      });
      if (typeof cleanup === 'function') {
        this.streamCleanups.set(message.id, cleanup as () => void);
      }
    } catch (error) {
      this.bridge.stopStream(message, {
        code: 'handler-error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private stopStream(id: number): void {
    this.streamCleanups.get(id)?.();
    this.streamCleanups.delete(id);
  }

  private async ensureAllowed(
    capability: string,
    gating: 'open' | 'gated'
  ): Promise<boolean> {
    if (gating === 'open' || !this.permissionGate) return true;
    return (await this.permissionGate.check(capability)) === 'allow';
  }
}

/**
 * Host-shape shim — flatten the legacy `{ nostr: { method... } }` object into a
 * flat `CapabilityHandlers` registry keyed `nostr.<method>`. Temporary: removed
 * when `apna-app` adopts the real registry in APNA-RD-HOST-009.
 */
function adaptLegacyMethodHandlers(
  methodHandlers?: IHostMethodHandlers
): CapabilityHandlers {
  const registry: CapabilityHandlers = {};
  if (!methodHandlers) return registry;
  Object.keys(methodHandlers).forEach((namespace) => {
    const module = (methodHandlers as Record<
      string,
      Record<string, unknown> | undefined
    >)[namespace];
    if (!module) return;
    Object.keys(module).forEach((method) => {
      const fn = module[method];
      if (typeof fn !== 'function') return;
      registry[`${namespace}.${method}`] = {
        // Legacy handlers predate the permission gate — treat as open.
        gating: 'open',
        handler: (...args: unknown[]) =>
          Promise.resolve((fn as (...a: unknown[]) => unknown)(...args)),
      };
    });
  });
  return registry;
}
