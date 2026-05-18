export * from './react';

import { detectChannel, Channel } from '../core/channels';
import { Bridge } from '../core/bridge';
import { Transport } from '../core/transport';
import { HttpClient } from '../core/http';
import {
  CapabilityDescriptor,
  EventMessage,
  EventName,
  MessageType,
} from '../core/protocol';
import {
  ApnaNostrWithLegacy,
  createNostrProtocol,
} from '../protocols/nostr';
import {
  ApnaIdentityDomain,
  createIdentityDomain,
} from '../domains/identity';
import { ApnaSocialDomain, createSocialDomain } from '../domains/social';
import { createPermissionsClient } from '../permissions';
import { ApnaPermissions } from '../interfaces/permissions';
import { createWidgetsClient } from '../widgets';
import { ApnaWidgets } from '../interfaces/widgets';
import { createBitcoinProtocol, ApnaBitcoin } from '../protocols/bitcoin';
import { createEthereumProtocol, ApnaEthereum } from '../protocols/ethereum';

/** SDK version reported to the host at handshake. */
const SDK_VERSION = '2.0.0';

export interface ApnaAppConfig {
  /** Stable id of this mini-app (its publisher-rooted identity / app id). */
  appId: string;
  /** Explicit channel override. Omit to auto-detect (iframe vs host-extension). */
  channel?: Channel;
}

/**
 * `ApnaApp` — the mini-app side of the bridge.
 *
 * Detects its channel, performs the handshake over the new `Bridge`, builds a
 * `Transport`, and exposes the host's capabilities.
 */
export class ApnaApp {
  readonly appId: string;
  readonly instanceId: string;
  /** Resolves once the handshake has completed and the transport is ready. */
  readonly ready: Promise<void>;
  /** Low-level Nostr protocol module. */
  readonly nostr: ApnaNostrWithLegacy;
  /** High-level identity domain. Latest methods are mirrored at `.v1`. */
  readonly identity: ApnaIdentityDomain;
  /** High-level social domain. Latest methods are mirrored at `.v1`. */
  readonly social: ApnaSocialDomain;
  /** Client-side permissions convenience module. */
  readonly permissions: ApnaPermissions;
  /** Mini-app authored widgets metadata module. */
  readonly widgets: ApnaWidgets;
  /** Low-level Bitcoin module. Throws when the host does not support it. */
  readonly bitcoin: ApnaBitcoin;
  /** Low-level Ethereum module. Throws when the host does not support it. */
  readonly ethereum: ApnaEthereum;

  private readonly channel: Channel;
  private readonly bridge: Bridge;
  private readonly eventListeners = new Map<
    EventName,
    Set<(payload: unknown) => void>
  >();
  private transport?: Transport;
  private capabilities: CapabilityDescriptor[] = [];
  private httpEndpoint?: string;
  private designRemote?: string;

  constructor(config: ApnaAppConfig) {
    this.appId = config.appId;
    this.channel = detectChannel({ channel: config.channel });
    this.bridge = new Bridge(this.channel);
    this.instanceId = this.bridge.instanceId;
    this.nostr = createNostrProtocol({
      transport: () => this.getTransport(),
      call: (capability, args) => this.callCapability(capability, args),
    });
    this.identity = createIdentityDomain({
      call: (capability, args) => this.callCapability(capability, args),
      callSupported: (capability, args, fallbackCapability, fallbackArgs) =>
        this.callSupportedCapability(
          capability,
          args,
          fallbackCapability,
          fallbackArgs
        ),
    });
    this.social = createSocialDomain({
      call: (capability, args) => this.callCapability(capability, args),
      callSupported: (capability, args, fallbackCapability, fallbackArgs) =>
        this.callSupportedCapability(
          capability,
          args,
          fallbackCapability,
          fallbackArgs
        ),
    });
    this.permissions = createPermissionsClient({
      bridge: this.bridge,
      call: (capability, args) => this.callCapability(capability, args),
    });
    this.widgets = createWidgetsClient({
      call: (capability, args) => this.callCapability(capability, args),
      isCapabilitySupported: (capability) =>
        this.isCapabilitySupported(capability),
    });
    this.bitcoin = createBitcoinProtocol({
      transport: () => this.getTransport(),
      isCapabilitySupported: (capability) =>
        this.isCapabilitySupported(capability),
    });
    this.ethereum = createEthereumProtocol({
      transport: () => this.getTransport(),
      isCapabilitySupported: (capability) =>
        this.isCapabilitySupported(capability),
    });
    this.ready = this.init();
  }

  /** Capability descriptors negotiated at handshake. */
  getCapabilities(): CapabilityDescriptor[] {
    return this.capabilities;
  }

  /** The host's design-component Module Federation remote, if advertised. */
  getDesignRemote(): string | undefined {
    return this.designRemote;
  }

  /** Tear down the bridge and channel. */
  dispose(): void {
    this.eventListeners.clear();
    this.bridge.dispose();
    this.channel.dispose();
  }

  /** Subscribe to typed host -> app events. */
  on(event: EventName, handler: (payload: unknown) => void): () => void {
    let listeners = this.eventListeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.eventListeners.set(event, listeners);
    }
    listeners.add(handler);
    return () => {
      this.eventListeners.get(event)?.delete(handler);
    };
  }

  private async init(): Promise<void> {
    await this.channel.ready();
    const ack = await this.bridge.handshake({
      appId: this.appId,
      sdkVersion: SDK_VERSION,
    });
    this.capabilities = ack.capabilities ?? [];
    this.httpEndpoint = ack.httpEndpoint;
    this.designRemote = ack.designRemote;
    const httpClient = this.httpEndpoint
      ? new HttpClient({ endpoint: this.httpEndpoint })
      : undefined;
    this.transport = new Transport({
      bridge: this.bridge,
      httpClient,
      capabilities: this.capabilities,
    });
    this.bridge.on(MessageType.Event, this.handleEvent);
  }

  private readonly handleEvent = (message: EventMessage): void => {
    // Until `apna.on` lands (APNA-RD-HOST-014), keep the one legacy event the
    // ecosystem depends on working: FAB "Customise Mode" -> highlight toggle.
    if (message.event === EventName.CustomiseToggleHighlight) {
      const w = window as unknown as { toggleHighlight?: () => void };
      w.toggleHighlight?.();
    }
    this.eventListeners
      .get(message.event)
      ?.forEach((handler) => handler(message.payload));
  };

  private async callCapability(
    capability: string,
    args: unknown[]
  ): Promise<unknown> {
    await this.ready;
    // `transport` is assigned by `init()` before `ready` resolves.
    return this.transport!.call(capability, args);
  }

  private async callSupportedCapability(
    capability: string,
    args: unknown[],
    fallbackCapability?: string,
    fallbackArgs?: unknown[]
  ): Promise<unknown> {
    await this.ready;
    const hasPrimary = this.capabilities.some(
      (descriptor) => descriptor.capability === capability
    );
    const selected = hasPrimary || !fallbackCapability
      ? capability
      : fallbackCapability;
    const selectedArgs = selected === capability ? args : fallbackArgs ?? args;
    return this.transport!.call(selected, selectedArgs);
  }

  private getTransport(): Transport {
    if (!this.transport) {
      throw new Error('[apna] ApnaApp is not ready yet');
    }
    return this.transport;
  }

  private isCapabilitySupported(capability: string): boolean {
    return this.capabilities.some(
      (descriptor) => descriptor.capability === capability
    );
  }
}
