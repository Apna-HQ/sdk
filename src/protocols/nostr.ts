import { Transport } from '../core/transport';
import {
  ApnaNostr,
  EventTemplate,
  NostrEvent,
  NostrFilter,
  QueryOptions,
  Unsubscribe,
} from '../interfaces/nostr/protocol';
import { INostr } from '../interfaces/nostr';

export type ApnaNostrWithLegacy = ApnaNostr & INostr;

export interface NostrProtocolOptions {
  transport: () => Transport;
  call: (capability: string, args: unknown[]) => Promise<unknown>;
}

/** Create the low-level Nostr protocol module, with legacy method fallback. */
export function createNostrProtocol(
  options: NostrProtocolOptions
): ApnaNostrWithLegacy {
  const module: ApnaNostr = {
    query: (filters: NostrFilter | NostrFilter[], opts?: QueryOptions) =>
      options.call('nostr.query', [filters, opts]) as Promise<NostrEvent[]>,
    queryOne: (filter: NostrFilter, opts?: QueryOptions) =>
      options.call('nostr.queryOne', [filter, opts]) as Promise<NostrEvent | null>,
    subscribe: (
      filters: NostrFilter | NostrFilter[],
      onEvent: (event: NostrEvent) => void,
      opts?: QueryOptions
    ): Unsubscribe =>
      options
        .transport()
        .subscribe('nostr.subscribe', [filters, opts], (event) =>
          onEvent(event as NostrEvent)
        ),
    getPublicKey: () =>
      options.call('nostr.getPublicKey', []) as Promise<string>,
    signEvent: (template: EventTemplate) =>
      options.call('nostr.signEvent', [template]) as Promise<NostrEvent>,
    publish: (template: EventTemplate) =>
      options.call('nostr.publish', [template]) as Promise<NostrEvent>,
    nip04: {
      encrypt: (pubkey: string, plaintext: string) =>
        options.call('nostr.nip04.encrypt', [pubkey, plaintext]) as Promise<string>,
      decrypt: (pubkey: string, ciphertext: string) =>
        options.call('nostr.nip04.decrypt', [pubkey, ciphertext]) as Promise<string>,
    },
    nip44: {
      encrypt: (pubkey: string, plaintext: string) =>
        options.call('nostr.nip44.encrypt', [pubkey, plaintext]) as Promise<string>,
      decrypt: (pubkey: string, ciphertext: string) =>
        options.call('nostr.nip44.decrypt', [pubkey, ciphertext]) as Promise<string>,
    },
  };

  return new Proxy(module as unknown as Record<string, unknown>, {
    get: (target, method: string) => {
      if (method in target) return target[method];
      return (...args: unknown[]): Promise<unknown> =>
        options.call('nostr.' + method, args);
    },
  }) as unknown as ApnaNostrWithLegacy;
}
