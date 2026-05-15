import {
  ApnaIdentityV1,
  UserMetadata,
  UserProfile,
} from '../../interfaces/identity/v1';
import { CapabilityRuntime } from '../version';

/** Create `apna.identity.v1`, falling back to legacy Nostr host APIs. */
export function createIdentityV1(runtime: CapabilityRuntime): ApnaIdentityV1 {
  return {
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
