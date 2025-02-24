export interface INostr {

    // LOW-LEVEL APIs

    // PublishEvent: (signer: (unsignedEvent: UnsignedEvent) => IEvent, unsignedEvent: UnsignedEvent, relays?: string[]) => void,
    // FetchEvent: (eventFilters: IEventFilter[], relays?: string[]) => void,
    // FetchAllEvents: (eventFilters: IEventFilter[], relays?: string[]) => void,
    // SubscribeToEvents: (eventFilters: IEventFilter[], eventHandler: (e: IEvent) => void, relays?: string[]) => void,


    // HIGH-LEVEL APIs
    
    // user-scope
    getActiveUserProfile: () => Promise<IUserProfile> | IUserProfile,
    getAvailableUserProfiles: () => Promise<IUserProfile[]> | IUserProfile[],
    switchUserProfile: (npub: string) => Promise<IUserProfile> | IUserProfile,
    fetchUserMetadata: (npub: string) => Promise<IUserMetadata> | IUserMetadata,
    updateProfileMetadata: (profile: IUserMetadata) => Promise<IUserProfile> | IUserProfile,
    fetchUserProfile: (npub: string) => Promise<IUserProfile> | IUserProfile,
    followUser: (npub: string) => Promise<void> | void,
    unfollowUser: (npub: string) => Promise<void> | void,

    // note-scope
    fetchNote: (noteId: string, returnReactions?: Boolean) => Promise<INote> | INote,
    fetchNoteAndReplies: (noteId: string, returnReactions?: Boolean) => Promise<INoteAndReplies> | INoteAndReplies,
    publishNote: (content: string) => Promise<INote> | INote,
    repostNote: (noteId: string, quoteContent: string) => Promise<INoteRepost> | INoteRepost,
    likeNote: (noteId: string) => Promise<INoteLike> | INoteLike,
    replyToNote: (noteId: string, content: string) => Promise<INoteReply> | INoteReply,

    // feed-scope
    fetchFeed: (feedType: string, since?: number, until?: number, limit?: number) => Promise<IEvent[]> | IEvent[],
    fetchUserFeed: (npub: string, feedType: string, since?: number, until?: number, limit?: number) => Promise<IEvent[]> | IEvent[],
    subscribeToFeed: (feedType: string, onevent: (event: IEvent) => void, withReactions?: Boolean) => Promise<void> | void,
    subscribeToUserFeed: (npub: string, feedType: FeedType, onevent: (event: IEvent) => void, withReactions?: Boolean) => Promise<void> | void,
    subscribeToUserNotifications?: (onevent: (event: IEvent) => void) => Promise<void> | void
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

// interface UnsignedEvent extends Omit<IEvent, "sig"> {}

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

export interface IEventFilter {
    // [key: `#${string}`]: string[] | undefined;
    [key: string]: string[] | undefined | number | number[] | string;
    ids?: string[];
    kinds?: number[];
    authors?: string[];
    since?: number;
    until?: number;
    limit?: number;
    search?: string;
}