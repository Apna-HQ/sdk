import {
  ApnaSocialV1,
  DirectMessage,
  DirectMessageOptions,
  FeedOptions,
  FeedType,
  Note,
  NoteAndReplies,
  SocialInboxOptions,
  SocialNotification,
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

function subscribe<T>(
  runtime: CapabilityRuntime,
  capability: string,
  args: unknown[],
  onEvent: (event: T) => void
): () => void {
  if (!runtime.subscribe) {
    throw new Error(`[apna] '${capability}' subscriptions are not available`);
  }
  return runtime.subscribe(capability, args, (event) => onEvent(event as T));
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
    react: (noteId: string, content = '+') =>
      runtime.callSupported(
        'social.v1.react',
        [noteId, content],
        'nostr.likeNote',
        [noteId]
      ) as Promise<NostrEvent>,
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
    quoteRepost: (noteId: string, content: string) =>
      runtime.callSupported(
        'social.v1.quoteRepost',
        [noteId, content],
        'social.v1.repost',
        [noteId, content]
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
    updateProfile: (metadata: UserMetadata) =>
      runtime.callSupported(
        'social.v1.updateProfile',
        [metadata],
        'identity.v1.updateProfile',
        [metadata]
      ) as Promise<UserProfile>,
    notifications: (opts?: SocialInboxOptions) =>
      runtime.callSupported('social.v1.notifications', [
        opts,
      ]) as Promise<SocialNotification[]>,
    messages: (opts?: DirectMessageOptions) =>
      runtime.callSupported('social.v1.messages', [
        opts,
      ]) as Promise<DirectMessage[]>,
    sendDirectMessage: (pubkeyOrNpub: string, content: string) =>
      runtime.callSupported('social.v1.sendDirectMessage', [
        pubkeyOrNpub,
        content,
      ]) as Promise<DirectMessage>,
    subscribeFeed: (
      feedType: FeedType,
      opts: FeedOptions | undefined,
      onEvent: (event: NostrEvent) => void
    ) =>
      subscribe<NostrEvent>(
        runtime,
        'social.v1.subscribeFeed',
        [feedType, opts],
        onEvent
      ),
    subscribeUserFeed: (
      pubkeyOrNpub: string,
      feedType: FeedType,
      opts: FeedOptions | undefined,
      onEvent: (event: NostrEvent) => void
    ) =>
      subscribe<NostrEvent>(
        runtime,
        'social.v1.subscribeUserFeed',
        [pubkeyOrNpub, feedType, opts],
        onEvent
      ),
    subscribeThread: (
      noteId: string,
      opts: FeedOptions | undefined,
      onEvent: (event: NostrEvent) => void
    ) =>
      subscribe<NostrEvent>(
        runtime,
        'social.v1.subscribeThread',
        [noteId, opts],
        onEvent
      ),
    subscribeNotifications: (
      opts: SocialInboxOptions | undefined,
      onEvent: (event: SocialNotification) => void
    ) =>
      subscribe<SocialNotification>(
        runtime,
        'social.v1.subscribeNotifications',
        [opts],
        onEvent
      ),
    subscribeMessages: (
      opts: DirectMessageOptions | undefined,
      onEvent: (event: DirectMessage) => void
    ) =>
      subscribe<DirectMessage>(
        runtime,
        'social.v1.subscribeMessages',
        [opts],
        onEvent
      ),
    subscribeProfile: (
      pubkeyOrNpub: string,
      onEvent: (event: UserProfile) => void
    ) =>
      subscribe<UserProfile>(
        runtime,
        'social.v1.subscribeProfile',
        [pubkeyOrNpub],
        onEvent
      ),
  };
}
