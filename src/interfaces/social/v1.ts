/**
 * `apna.social` v1 — the high-level, protocol-agnostic social contract
 * (notes, feeds, reactions, follows). Composes `apna.nostr` underneath.
 *
 * Versioned so the surface can evolve: a future `v2.ts` is added alongside
 * without breaking `v1`, and the host may advertise both at once during a
 * migration window.
 */
import { NostrEvent, Unsubscribe } from '../nostr/protocol';
import { UserMetadata, UserProfile } from '../identity/v1';

/** Predefined feed timelines. */
export type FeedType = 'GLOBAL_FEED' | 'FOLLOWING_FEED' | 'NOTES_FEED';

/** Like / repost reactions attached to a note. */
export interface NoteReactions {
  likes: NostrEvent[];
  reposts: NostrEvent[];
}

/** A note (Nostr kind-1 event), optionally with its reactions. */
export interface Note extends NostrEvent {
  kind: 1;
  reactions?: NoteReactions;
}

/** A public-key mention the host should encode as a `p` tag. */
export interface NoteMention {
  pubkey: string;
  relay?: string;
  marker?: string;
}

/** Options used when publishing notes, replies, and quote reposts. */
export interface NotePublishOptions {
  mentions?: NoteMention[];
  tags?: string[][];
}

/** A root note plus its direct replies. */
export interface NoteAndReplies {
  note: Note;
  replyNotes: Note[];
}

/** A Nostr encrypted direct message event (NIP-04, kind 4). */
export interface DirectMessage extends NostrEvent {
  kind: 4;
  /** Peer pubkey from the conversation, when the host can infer it. */
  peerPubkey?: string;
  /** Plaintext when the host can decrypt the message for the active user. */
  plaintext?: string;
  /** True when this message was authored by the active user. */
  outgoing?: boolean;
}

/** A social notification derived from Nostr replies/reactions/reposts. */
export interface SocialNotification {
  id: string;
  type: 'reply' | 'reaction' | 'repost' | 'quote' | 'mention';
  event: NostrEvent;
  targetEventId?: string;
  actorPubkey: string;
  created_at: number;
  read?: boolean;
}

/** Pagination / time-window options for feed reads. */
export interface FeedOptions {
  since?: number;
  until?: number;
  limit?: number;
}

/** Options for notification and DM reads/subscriptions. */
export interface SocialInboxOptions extends FeedOptions {
  pubkey?: string;
}

/** Options for DM reads/subscriptions. */
export interface DirectMessageOptions extends FeedOptions {
  peerPubkey?: string;
}

/** Options for profile suggestion lookup. */
export interface ProfileSuggestionOptions {
  limit?: number;
  includeFollowing?: boolean;
}

/** Upload a media blob through the host, usually to a Blossom server. */
export interface MediaUploadOptions {
  data: ArrayBuffer | Uint8Array | number[] | string;
  contentType?: string;
  fileName?: string;
  server?: string;
  description?: string;
}

/** Public descriptor returned after a media upload. */
export interface MediaUploadDescriptor {
  url: string;
  sha256: string;
  size: number;
  type?: string;
  uploaded?: number;
}

/** Shared callback shape for social subscriptions. */
export type SocialEventHandler<T> = (event: T) => void;

/** `apna.social.v1` — the abstracted social surface for mini-app developers. */
export interface ApnaSocialV1 {
  publishNote(content: string, options?: NotePublishOptions): Promise<Note>;
  reply(
    noteId: string,
    content: string,
    options?: NotePublishOptions
  ): Promise<Note>;
  react(noteId: string, content?: string): Promise<NostrEvent>;
  like(noteId: string): Promise<NostrEvent>;
  repost(noteId: string, quoteContent?: string): Promise<NostrEvent>;
  quoteRepost(
    noteId: string,
    content: string,
    options?: NotePublishOptions
  ): Promise<NostrEvent>;
  note(noteId: string, withReactions?: boolean): Promise<Note>;
  noteAndReplies(
    noteId: string,
    withReactions?: boolean
  ): Promise<NoteAndReplies>;
  noteLikes(noteId: string, since?: number): Promise<NostrEvent[]>;
  noteReposts(noteId: string, since?: number): Promise<NostrEvent[]>;
  feed(feedType: FeedType, opts?: FeedOptions): Promise<NostrEvent[]>;
  userFeed(
    pubkeyOrNpub: string,
    feedType: FeedType,
    opts?: FeedOptions
  ): Promise<NostrEvent[]>;
  follow(pubkeyOrNpub: string): Promise<void>;
  unfollow(pubkeyOrNpub: string): Promise<void>;
  userProfile(pubkeyOrNpub: string): Promise<UserProfile>;
  userMetadata(pubkeyOrNpub: string): Promise<UserMetadata>;
  profileSuggestions(
    query?: string,
    opts?: ProfileSuggestionOptions
  ): Promise<UserProfile[]>;
  updateProfile(metadata: UserMetadata): Promise<UserProfile>;
  uploadMedia(opts: MediaUploadOptions): Promise<MediaUploadDescriptor>;
  notifications(opts?: SocialInboxOptions): Promise<SocialNotification[]>;
  messages(opts?: DirectMessageOptions): Promise<DirectMessage[]>;
  sendDirectMessage(
    pubkeyOrNpub: string,
    content: string
  ): Promise<DirectMessage>;
  subscribeFeed(
    feedType: FeedType,
    opts: FeedOptions | undefined,
    onEvent: SocialEventHandler<NostrEvent>
  ): Unsubscribe;
  subscribeUserFeed(
    pubkeyOrNpub: string,
    feedType: FeedType,
    opts: FeedOptions | undefined,
    onEvent: SocialEventHandler<NostrEvent>
  ): Unsubscribe;
  subscribeThread(
    noteId: string,
    opts: FeedOptions | undefined,
    onEvent: SocialEventHandler<NostrEvent>
  ): Unsubscribe;
  subscribeNotifications(
    opts: SocialInboxOptions | undefined,
    onEvent: SocialEventHandler<SocialNotification>
  ): Unsubscribe;
  subscribeMessages(
    opts: DirectMessageOptions | undefined,
    onEvent: SocialEventHandler<DirectMessage>
  ): Unsubscribe;
  subscribeProfile(
    pubkeyOrNpub: string,
    onEvent: SocialEventHandler<UserProfile>
  ): Unsubscribe;
}
