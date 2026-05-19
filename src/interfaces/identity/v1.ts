/**
 * `apna.identity` v1 — the high-level, protocol-agnostic root-identity contract.
 *
 * Domain modules compose `apna.nostr` underneath; mini-app developers using this
 * surface never touch Nostr concepts. Versioned so the surface can evolve: a
 * future `v2.ts` is added alongside without breaking `v1`.
 */

/** Free-form profile metadata (Nostr kind-0 content). */
export interface UserMetadata {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  website?: string;
  nip05?: string;
  lud06?: string;
  lud16?: string;
  [key: string]: unknown;
}

/** A resolved user profile: identity + metadata + social graph. */
export interface UserProfile {
  /** Hex public key. */
  pubkey: string;
  /** bech32 `npub` form of `pubkey`. */
  npub: string;
  metadata: UserMetadata;
  /** Hex pubkeys this user follows. */
  following: string[];
  /** Hex pubkeys that follow this user. */
  followers: string[];
}

/** `apna.identity.v1` — the active user and other users' root identities. */
export interface ApnaIdentityV1 {
  /** The currently signed-in user's profile. */
  me(): Promise<UserProfile>;
  /** Resolve any user's profile by hex pubkey or `npub`. */
  profile(pubkeyOrNpub: string): Promise<UserProfile>;
  /** Update the signed-in user's metadata (publishes a kind-0 event). */
  updateProfile(metadata: UserMetadata): Promise<UserProfile>;
}
