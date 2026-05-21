import {
  ApnaIdentityV1,
  UserMetadata,
  UserProfile,
} from '../../interfaces/identity/v1';
import { CapabilityRuntime } from '../version';

/** Create `apna.identity.v1`, falling back to legacy Nostr host APIs. */
export function createIdentityV1(runtime: CapabilityRuntime): ApnaIdentityV1 {
  return {
    activePubkey: async () => {
      try {
        const result = await runtime.callSupported(
          'identity.v1.activePubkey',
          [],
          'nostr.getPublicKey',
          []
        );
        return coerceActivePubkey(result);
      } catch {
        const profile = await runtime.callSupported(
          'identity.v1.me',
          [],
          'nostr.getActiveUserProfile'
        );
        return coerceActivePubkey(profile);
      }
    },
    me: () =>
      runtime.callSupported(
        'identity.v1.me',
        [],
        'nostr.getActiveUserProfile'
      ) as Promise<UserProfile>,
    profile: (pubkeyOrNpub: string) =>
      runtime.callSupported(
        'identity.v1.profile',
        [pubkeyOrNpub],
        'nostr.fetchUserProfile',
        [pubkeyOrNpub]
      ) as Promise<UserProfile>,
    updateProfile: (metadata: UserMetadata) =>
      runtime.callSupported(
        'identity.v1.updateProfile',
        [metadata],
        'nostr.updateProfileMetadata',
        [metadata]
      ) as Promise<UserProfile>,
  };
}

function coerceActivePubkey(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (value && typeof value === 'object') {
    const pubkey = (value as { pubkey?: unknown }).pubkey;
    if (typeof pubkey === 'string' && pubkey.length > 0) {
      return pubkey;
    }
  }

  throw new Error('[apna] active pubkey unavailable');
}
