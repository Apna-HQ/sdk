/**
 * Channel adapters — the pluggable cross-context message transport beneath the
 * RPC bridge. The same protocol/handshake/RPC layers run over either topology;
 * only the `Channel` implementation differs.
 */
import { ApnaMessage } from '../protocol';
import { IframeChannel } from './iframe';
import { ExtensionChannel } from './extension';

/**
 * A bidirectional, per-instance message channel. Implementations hold no
 * module-global state, so many can coexist (one per running mini-app).
 */
export interface Channel {
  /** Post a protocol message to the peer. */
  send(message: ApnaMessage): void;
  /** Register an inbound-message handler. Returns an unsubscribe function. */
  onMessage(handler: (message: ApnaMessage) => void): () => void;
  /** Resolves once the channel can carry messages. */
  ready(): Promise<void>;
  /** Tear down listeners and release the channel. */
  dispose(): void;
}

export type ChannelKind = 'iframe' | 'extension';

export interface DetectChannelOptions {
  /** Explicit channel — used as-is, bypassing detection. */
  channel?: Channel;
  /** Force a channel kind instead of auto-detecting. */
  kind?: ChannelKind;
  /** Expected peer origin, forwarded to the constructed channel. */
  targetOrigin?: string;
}

/** Marker an Apna host-extension injects on the page's `window`. */
const EXTENSION_MARKERS = ['__APNA_EXTENSION__', '__apnaExtension'] as const;

/**
 * Pick the right `Channel` for the mini-app's runtime context:
 * - inside an iframe (`window.parent !== window`) → `IframeChannel`
 * - a host-extension marker is present on `window` → `ExtensionChannel`
 * - otherwise throw — pass an explicit `channel` or `kind` to override.
 *
 * This is the client (mini-app) entry point. The host constructs its
 * per-iframe `IframeChannel` directly.
 */
export function detectChannel(options: DetectChannelOptions = {}): Channel {
  if (options.channel) return options.channel;

  if (typeof window === 'undefined') {
    throw new Error('[apna] detectChannel must run in a browser context');
  }

  const kind = options.kind ?? inferKind();
  if (kind === 'iframe') {
    return new IframeChannel({
      getTarget: () => window.parent,
      targetOrigin: options.targetOrigin,
    });
  }
  return new ExtensionChannel({ targetOrigin: options.targetOrigin });
}

function inferKind(): ChannelKind {
  if (window.parent !== window) return 'iframe';
  if (EXTENSION_MARKERS.some((marker) => marker in window)) return 'extension';
  throw new Error(
    '[apna] No Apna host detected: not in an iframe and no host-extension ' +
      'present. Pass an explicit `channel` or `kind` to detectChannel().'
  );
}

export { IframeChannel } from './iframe';
export type { IframeChannelOptions } from './iframe';
export { ExtensionChannel, RELAY_TO_HOST, RELAY_TO_APP } from './extension';
export type { ExtensionChannelOptions } from './extension';
