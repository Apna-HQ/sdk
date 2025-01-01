export interface INostr {

    // LOW-LEVEL APIs

    // PublishEvent: (signer: (unsignedEvent: UnsignedEvent) => IEvent, unsignedEvent: UnsignedEvent, relays?: string[]) => void,
    // FetchEvent: (eventFilters: IEventFilter[], relays?: string[]) => void,
    // FetchAllEvents: (eventFilters: IEventFilter[], relays?: string[]) => void,
    // SubscribeToEvents: (eventFilters: IEventFilter[], eventHandler: (e: IEvent) => void, relays?: string[]) => void,


    // HIGH-LEVEL APIs
    
    // user-scope
    getActiveUserProfile: () => IUserProfile,
    fetchUserMetadata: (npub: string) => IUserMetadata,
    updateProfileMetadata: (profile: IUserMetadata) => IUserProfile,
    fetchUserProfile: (npub: string) => IUserProfile,
    followUser: (npub: string) => void,
    unfollowUser: (npub: string) => void,

    // note-scope
    fetchNote: (noteId: string, returnReactions?: Boolean) => INote,
    fetchNoteAndReplies: (noteId: string, returnReactions?: Boolean) => INoteAndReplies,
    publishNote: (content: string) => INote,
    repostNote: (noteId: string, quoteContent: string) => INoteRepost,
    likeNote: (noteId: string) => INoteLike,
    replyToNote: (noteId: string, content: string) => INoteReply,

    // feed-scope
    subscribeToFeed: (feedType: string, onevent: (event: IEvent) => void, withReactions?: Boolean) => void,
    subscribeToUserFeed: (npub: string, feedType: FeedType, onevent: (event: IEvent) => void, withReactions?: Boolean) => void,
    subscribeToUserNotifications?: (onevent: (event: IEvent) => void) => void
}

export interface IUserProfile {
    nprofile: string,
    metadata: IUserMetadata,
    following: string[],
    followers: string[]
}

export interface IUserMetadata {
    name?: string,
    about?: string
    [metadataKey: string]: any
}

interface ITag {
    [index: number]: string;
}

interface IEvent {
    content: string;
    created_at: number;
    id: string;
    kind: number;
    pubkey: string;
    sig: string;
    tags: ITag[];
    relays?: string[];
}

interface UnsignedEvent extends Omit<IEvent, "sig"> {}

export interface INoteReactions {
    likes: INoteLike[],
    reposts: INoteRepost[]
}

export interface INote extends IEvent {
    kind: 1
    reactions?: INoteReactions
}

export interface INoteRepost extends IEvent {
    kind: 1 | 6
}

export interface INoteLike extends IEvent {
    kind: 7
}

export interface INoteReply extends INote {}

export interface INoteAndReplies {
    note: INote,
    replyNotes: INoteReply[]
}

export type FeedType = "FOLLOWING_FEED" | "NOTES_FEED"

export type IEventTagFilterKey = `#${string}`

export interface IEventFilter {
    [key: IEventTagFilterKey]: string[] | undefined;
    ids?: string[];
    kinds?: number[];
    authors?: string[];
    since?: number;
    until?: number;
    limit?: number;
    search?: string;
}