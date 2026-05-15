/**
 * `ExtensionChannel` — the channel for the host-extension topology, where the
 * mini-app IS the top-level page and the host is a browser extension.
 *
 * The mini-app and a content-script relay share the page's `window`, so a
 * plain `ApnaMessage` posted to `window` can't tell "outbound to host" from
 * "inbound from host". This channel wraps every message in a tiny
 * direction-tagged `RelayEnvelope`:
 *
 *   SDK  --{ __apnaRelay: 'to-host', message }-->  content-script relay  -->  extension background
 *   SDK  <--{ __apnaRelay: 'to-app',  message }--  content-script relay  <--  extension background
 *
 * No host-extension exists yet, so this is lightly exercised (a mock relay in
 * unit tests) — but it implements the exact same `Channel` interface as
 * `IframeChannel`, so the protocol/bridge layers run over it unchanged.
 */
import { ApnaMessage, isApnaMessage } from '../protocol';
import { Channel } from './index';

/** Direction tags the SDK and the content-script relay agree on. */
export const RELAY_TO_HOST = 'apna-relay:to-host' as const;
export const RELAY_TO_APP = 'apna-relay:to-app' as const;

interface RelayEnvelope {
  __apnaRelay: typeof RELAY_TO_HOST | typeof RELAY_TO_APP;
  message: ApnaMessage;
}

function isRelayEnvelope(value: unknown): value is RelayEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const env = value as Record<string, unknown>;
  return (
    (env.__apnaRelay === RELAY_TO_HOST || env.__apnaRelay === RELAY_TO_APP) &&
    isApnaMessage(env.message)
  );
}

export interface ExtensionChannelOptions {
  /** Window to post to / listen on. Default: `window`. */
  window?: Window;
  /** Expected origin for validation. Default `'*'`. */
  targetOrigin?: string;
}

export class ExtensionChannel implements Channel {
  private readonly win: Window;
  private readonly targetOrigin: string;
  private readonly handlers = new Set<(message: ApnaMessage) => void>();
  private listening = false;
  private disposed = false;

  constructor(options: ExtensionChannelOptions = {}) {
    this.win = options.window ?? (window as Window);
    this.targetOrigin = options.targetOrigin ?? '*';
  }

  send(message: ApnaMessage): void {
    if (this.disposed) return;
    const envelope: RelayEnvelope = { __apnaRelay: RELAY_TO_HOST, message };
    this.win.postMessage(envelope, this.targetOrigin);
  }

  onMessage(handler: (message: ApnaMessage) => void): () => void {
    this.handlers.add(handler);
    this.ensureListening();
    return () => {
      this.handlers.delete(handler);
      if (this.handlers.size === 0) this.stopListening();
    };
  }

  /**
   * Resolves immediately — the content-script relay is injected at
   * `document_start`, so it is present before the mini-app's SDK runs. Real
   * protocol readiness is established by the handshake at the bridge layer.
   */
  ready(): Promise<void> {
    return Promise.resolve();
  }

  dispose(): void {
    this.disposed = true;
    this.handlers.clear();
    this.stopListening();
  }

  private readonly onWindowMessage = (event: MessageEvent): void => {
    if (this.disposed) return;
    if (this.targetOrigin !== '*' && event.origin !== this.targetOrigin) return;
    if (!isRelayEnvelope(event.data)) return;
    // Only accept messages the relay tagged as inbound-to-app; ignore our own
    // outbound `to-host` envelopes echoed back on the shared window.
    if (event.data.__apnaRelay !== RELAY_TO_APP) return;
    const message = event.data.message;
    this.handlers.forEach((handler) => handler(message));
  };

  private ensureListening(): void {
    if (this.listening || this.disposed) return;
    this.win.addEventListener('message', this.onWindowMessage);
    this.listening = true;
  }

  private stopListening(): void {
    if (!this.listening) return;
    this.win.removeEventListener('message', this.onWindowMessage);
    this.listening = false;
  }
}
