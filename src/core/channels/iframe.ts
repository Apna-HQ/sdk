/**
 * `IframeChannel` — the postMessage channel for the iframe topology
 * (host-app + iframe mini-apps).
 *
 * One class serves both ends:
 * - **Client-side** (inside the mini-app iframe): `getTarget` returns
 *   `window.parent`.
 * - **Host-side, fixed** (one per known mini-app iframe): `getTarget` returns
 *   that iframe's `contentWindow`, `filterBySource` is on, and an `instanceId`
 *   is supplied — so N iframes never cross-talk.
 * - **Host-side, auto-bind** (`autoBind: true`): no target is known up front;
 *   the channel binds its target to `event.source` of the first inbound Apna
 *   message (the mini-app's handshake) and thereafter only accepts messages
 *   from that source. This is what the legacy single-`ApnaHost` path uses.
 *
 * Every instance attaches and detaches its own `message` listener; there is no
 * shared/static state, so many channels can coexist.
 */
import { ApnaMessage, isApnaMessage } from '../protocol';
import { Channel } from './index';

export interface IframeChannelOptions {
  /**
   * Resolves the window to post messages TO. Client-side:
   * `() => window.parent`. Host-side (fixed): `() => iframe.contentWindow`.
   * Optional when `autoBind` is set — the target is then learned from the
   * first inbound message.
   */
  getTarget?: () => Window | null;
  /**
   * Host-side: bind the target to `event.source` of the first inbound Apna
   * message and filter all later inbound messages to that source.
   */
  autoBind?: boolean;
  /** Window to listen on for inbound `message` events. Default: `window`. */
  listenOn?: Window;
  /**
   * Expected peer origin for validation. Default `'*'` (no origin check) —
   * production callers should pass the real origin.
   */
  targetOrigin?: string;
  /**
   * Host-side isolation: only accept inbound messages whose `event.source` is
   * the target window. Leave off client-side (the only peer is the parent).
   * Implied once `autoBind` has bound a target.
   */
  filterBySource?: boolean;
  /**
   * Only accept inbound messages carrying this `instanceId` — host-side
   * parallel-iframe isolation. Host-inbound messages all carry an `instanceId`.
   */
  instanceId?: string;
}

export class IframeChannel implements Channel {
  private readonly getTargetOpt?: () => Window | null;
  private readonly autoBind: boolean;
  private readonly listenOn: Window;
  private readonly targetOrigin: string;
  private readonly filterBySource: boolean;
  private readonly instanceId?: string;
  private readonly handlers = new Set<(message: ApnaMessage) => void>();
  private boundTarget: Window | null = null;
  private listening = false;
  private disposed = false;

  constructor(options: IframeChannelOptions) {
    this.getTargetOpt = options.getTarget;
    this.autoBind = options.autoBind ?? false;
    this.listenOn = options.listenOn ?? (window as Window);
    this.targetOrigin = options.targetOrigin ?? '*';
    this.filterBySource = options.filterBySource ?? false;
    this.instanceId = options.instanceId;
  }

  /** The currently bound target (after auto-bind), if any. */
  get target(): Window | null {
    return this.resolveTarget();
  }

  send(message: ApnaMessage): void {
    if (this.disposed) return;
    const target = this.resolveTarget();
    if (!target) {
      console.warn('[apna] IframeChannel.send: target window not available');
      return;
    }
    target.postMessage(message, this.targetOrigin);
  }

  onMessage(handler: (message: ApnaMessage) => void): () => void {
    this.handlers.add(handler);
    this.ensureListening();
    return () => {
      this.handlers.delete(handler);
      if (this.handlers.size === 0) this.stopListening();
    };
  }

  /** Resolves once the target window is available. */
  ready(): Promise<void> {
    // Auto-bind channels learn their target from the first inbound message and
    // never proactively send before that — so they are "ready" immediately.
    if (this.autoBind || this.resolveTarget()) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const tick = (): void => {
        if (this.disposed) {
          reject(new Error('[apna] IframeChannel disposed before ready'));
          return;
        }
        if (this.resolveTarget()) {
          resolve();
          return;
        }
        if (Date.now() - start > 10_000) {
          reject(
            new Error('[apna] IframeChannel target window never became available')
          );
          return;
        }
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  dispose(): void {
    this.disposed = true;
    this.handlers.clear();
    this.boundTarget = null;
    this.stopListening();
  }

  private resolveTarget(): Window | null {
    return this.boundTarget ?? this.getTargetOpt?.() ?? null;
  }

  private readonly onWindowMessage = (event: MessageEvent): void => {
    if (this.disposed) return;
    if (this.targetOrigin !== '*' && event.origin !== this.targetOrigin) return;
    if (!isApnaMessage(event.data)) return;

    // Auto-bind: latch onto the first sender as this channel's peer.
    if (this.autoBind && !this.boundTarget && event.source) {
      this.boundTarget = event.source as Window;
    }

    // Source isolation: explicit `filterBySource`, or implied once auto-bound.
    if (this.filterBySource || (this.autoBind && this.boundTarget)) {
      const target = this.resolveTarget();
      if (target && event.source !== target) return;
    }

    const message = event.data;
    if (
      this.instanceId !== undefined &&
      'instanceId' in message &&
      message.instanceId !== this.instanceId
    ) {
      return;
    }
    this.handlers.forEach((handler) => handler(message));
  };

  private ensureListening(): void {
    if (this.listening || this.disposed) return;
    this.listenOn.addEventListener('message', this.onWindowMessage);
    this.listening = true;
  }

  private stopListening(): void {
    if (!this.listening) return;
    this.listenOn.removeEventListener('message', this.onWindowMessage);
    this.listening = false;
  }
}
