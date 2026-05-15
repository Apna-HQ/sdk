/**
 * `apna.social` v1 — the high-level, protocol-agnostic social contract
 * (notes, feeds, reactions, follows). Composes `apna.nostr` underneath.
 *
 * Versioned so the surface can evolve: a future `v2.ts` is added alongside
 * without breaking `v1`, and the host may advertise both at once during a
 * migration window.
 */
import { NostrEvent } from '../nostr/protocol';
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

/** A root note plus its direct replies. */
export interface NoteAndReplies {
  note: Note;
  replyNotes: Note[];
}

/** Pagination / time-window options for feed reads. */
export interface FeedOptions {
  since?: number;
  until?: number;
  limit?: number;
}

/** `apna.social.v1` — the abstracted social surface for mini-app developers. */
export interface ApnaSocialV1 {
  publishNote(content: string): Promise<Note>;
  reply(noteId: string, content: string): Promise<Note>;
  like(noteId: string): Promise<NostrEvent>;
  repost(noteId: string, quoteContent?: string): Promise<NostrEvent>;
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
}
