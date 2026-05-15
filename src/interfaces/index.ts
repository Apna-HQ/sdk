/**
 * Shared contract barrel — the single source of truth for both the SDK client
 * and any host implementation.
 *
 * The legacy flat `INostr` (`./nostr`) is still re-exported for consumers that
 * have not migrated yet; it is removed in APNA-RD-SDK-009 once the `compat`
 * alias and domain modules land. New code should import the versioned,
 * namespaced contracts below.
 */

// Legacy flat Nostr contract — removed in APNA-RD-SDK-009.
export * from './nostr';

// New versioned contracts.
export * from './nostr/protocol';
export * from './identity';
export * from './social';
export * from './ui';
export * from './notifications';
export * from './permissions';
export * from './host';

// `FeedType` is exported by both the legacy `./nostr` and the new `./social`
// (identical union). Re-export the new one explicitly to resolve the ambiguity;
// this line goes away with the legacy contract in APNA-RD-SDK-009.
export type { FeedType } from './social/v1';