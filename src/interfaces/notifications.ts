/**
 * `apna.notifications` — the push-notification contract.
 *
 * Two consumers share this shape: the client surface (`subscribe` /
 * `unsubscribe`, run in the mini-app's page) and the server surface (`send`,
 * run from the mini-app's backend via `@apna/sdk/server`).
 */

/** A Web Push subscription, as produced by the browser Push API. */
export interface PushSubscriptionInfo {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/** The payload delivered to a push notification. */
export interface NotificationPayload {
  title: string;
  body: string;
  /** Optional icon URL. */
  icon?: string;
  /** Optional deep-link / URL opened on click. */
  url?: string;
  /** Optional opaque data forwarded to the service worker. */
  data?: unknown;
}

/** `apna.notifications` — subscribe/unsubscribe on the client, send on the server. */
export interface ApnaNotifications {
  /** Register the service worker and subscribe this device to push. */
  subscribe(): Promise<PushSubscriptionInfo>;
  /** Remove this device's push subscription. */
  unsubscribe(): Promise<void>;
  /**
   * Send a push notification. Available from `@apna/sdk/server` (a mini-app
   * backend authenticated with the publisher's Nostr keypair).
   */
  send(payload: NotificationPayload): Promise<void>;
}
