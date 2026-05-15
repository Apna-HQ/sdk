import {
  ApnaSocialV1,
  FeedOptions,
  FeedType,
  Note,
  NoteAndReplies,
} from '../../interfaces/social/v1';
import { NostrEvent } from '../../interfaces/nostr/protocol';
import { UserMetadata, UserProfile } from '../../interfaces/identity/v1';
import { CapabilityRuntime } from '../version';

function feedArgs(feedType: FeedType, opts?: FeedOptions): unknown[] {
  return [feedType, opts?.since, opts?.until, opts?.limit];
}

function userFeedArgs(
  pubkeyOrNpub: string,
  feedType: FeedType,
  opts?: FeedOptions
): unknown[] {
  return [pubkeyOrNpub, feedType, opts?.since, opts?.until, opts?.limit];
}

/** Create `apna.social.v1`, falling back to legacy Nostr host APIs. */
export function createSocialV1(runtime: CapabilityRuntime): ApnaSocialV1 {
  return {
    publishNote: (content: string) =>
      runtime.callSupported(
        'social.v1.publishNote',
        [content],
        'nostr.publishNote',
        [content]
      ) as Promise<Note>,
    reply: (noteId: string, content: string) =>
      runtime.callSupported(
        'social.v1.reply',
        [noteId, content],
        'nostr.replyToNote',
        [noteId, content]
      ) as Promise<Note>,
    like: (noteId: string) =>
      runtime.callSupported(
        'social.v1.like',
        [noteId],
        'nostr.likeNote',
        [noteId]
      ) as Promise<NostrEvent>,
    repost: (noteId: string, quoteContent?: string) =>
      runtime.callSupported(
        'social.v1.repost',
        [noteId, quoteContent],
        'nostr.repostNote',
        [noteId, quoteContent]
      ) as Promise<NostrEvent>,
    note: (noteId: string, withReactions?: boolean) =>
      runtime.callSupported(
        'social.v1.note',
        [noteId, withReactions],
        'nostr.fetchNote',
        [noteId, withReactions]
      ) as Promise<Note>,
    noteAndReplies: (noteId: string, withReactions?: boolean) =>
      runtime.callSupported(
        'social.v1.noteAndReplies',
        [noteId, withReactions],
        'nostr.fetchNoteAndReplies',
        [noteId, withReactions]
      ) as Promise<NoteAndReplies>,
    noteLikes: (noteId: string, since?: number) =>
      runtime.callSupported(
        'social.v1.noteLikes',
        [noteId, since],
        'nostr.fetchNoteLikes',
        [noteId, since]
      ) as Promise<NostrEvent[]>,
    noteReposts: (noteId: string, since?: number) =>
      runtime.callSupported(
        'social.v1.noteReposts',
        [noteId, since],
        'nostr.fetchNoteReposts',
        [noteId, since]
      ) as Promise<NostrEvent[]>,
    feed: (feedType: FeedType, opts?: FeedOptions) =>
      runtime.callSupported(
        'social.v1.feed',
        [feedType, opts],
        'nostr.fetchFeed',
        feedArgs(feedType, opts)
      ) as Promise<NostrEvent[]>,
    userFeed: (
      pubkeyOrNpub: string,
      feedType: FeedType,
      opts?: FeedOptions
    ) =>
      runtime.callSupported(
        'social.v1.userFeed',
        [pubkeyOrNpub, feedType, opts],
        'nostr.fetchUserFeed',
        userFeedArgs(pubkeyOrNpub, feedType, opts)
      ) as Promise<NostrEvent[]>,
    follow: (pubkeyOrNpub: string) =>
      runtime.callSupported(
        'social.v1.follow',
        [pubkeyOrNpub],
        'nostr.followUser',
        [pubkeyOrNpub]
      ) as Promise<void>,
    unfollow: (pubkeyOrNpub: string) =>
      runtime.callSupported(
        'social.v1.unfollow',
        [pubkeyOrNpub],
        'nostr.unfollowUser',
        [pubkeyOrNpub]
      ) as Promise<void>,
    userProfile: (pubkeyOrNpub: string) =>
      runtime.callSupported(
        'social.v1.userProfile',
        [pubkeyOrNpub],
        'nostr.fetchUserProfile',
        [pubkeyOrNpub]
      ) as Promise<UserProfile>,
    userMetadata: (pubkeyOrNpub: string) =>
      runtime.callSupported(
        'social.v1.userMetadata',
        [pubkeyOrNpub],
        'nostr.fetchUserMetadata',
        [pubkeyOrNpub]
      ) as Promise<UserMetadata>,
  };
}
