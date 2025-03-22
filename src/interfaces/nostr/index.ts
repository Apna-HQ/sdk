export interface INostr {

    // LOW-LEVEL APIs

    // utils
    encode: <Prefix extends keyof Prefixes>(prefix: Prefix, value: DecodeValue<Prefix>) => `${Prefix}1${string}`,
    decode: <Prefix extends keyof Prefixes>(nip19String: `${Prefix}1${string}`) => DecodeValue<Prefix>,
    
    // data fetch
    fetchEvent: (eventFilter: ISingleEventFilter, relaysOverride?: string[]) => Promise<IEvent> | IEvent,
    fetchEvents: (eventFilter: IEventFilter, relaysOverride?: string[]) => Promise<IEvent[]> | IEvent[],
    subscribeToEvents: (eventFilter: IEventFilter, onevent: (event: IEvent) => void, relaysOverride?: string[]) => Promise<void> | void,
    
    // signing and publishing
    signAndPublishEvent: (event: IUnsignedEvent, relaysOverride?: string[]) => Promise<IEvent> | IEvent,


    // HIGH-LEVEL APIs
    
    // user-scope
    getActiveUserProfile: () => Promise<IUserProfile> | IUserProfile,
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
    fetchNoteLikes: (noteId: string, since?: number) => Promise<INoteLike[]> | INoteLike[],
    fetchNoteReposts: (noteId: string, since?: number) => Promise<INoteRepost[]> | INoteRepost[],
    replyToNote: (noteId: string, content: string) => Promise<INoteReply> | INoteReply,

    // feed-scope
    fetchFeed: (feedType: string, since?: number, until?: number, limit?: number) => Promise<IEvent[]> | IEvent[],
    fetchUserFeed: (npub: string, feedType: string, since?: number, until?: number, limit?: number) => Promise<IEvent[]> | IEvent[],
    subscribeToFeed: (feedType: string, onevent: (event: IEvent) => void, since?: number, until?: number, limit?: number) => Promise<void> | void,
    subscribeToUserFeed: (npub: string, feedType: FeedType, onevent: (event: IEvent) => void, since?: number, until?: number, limit?: number) => Promise<void> | void,
}

export type ProfilePointer = {
    pubkey: string;
    relays?: string[];
};
export type EventPointer = {
    id: string;
    relays?: string[];
    author?: string;
    kind?: number;
};
export type AddressPointer = {
    identifier: string;
    pubkey: string;
    kind: number;
    relays?: string[];
};
type Prefixes = {
    nprofile: ProfilePointer;
    nrelay: string;
    nevent: EventPointer;
    naddr: AddressPointer;
    nsec: Uint8Array;
    npub: string;
    note: string;
};
type DecodeValue<Prefix extends keyof Prefixes> = {
    type: Prefix;
    data: Prefixes[Prefix];
};
export type DecodeResult = {
    [P in keyof Prefixes]: DecodeValue<P>;
}[keyof Prefixes];

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

export interface IUnsignedEvent {
    content: string;
    created_at: number;
    id: string;
    kind: number;
    pubkey: string;
    tags: ITag[];
    relays?: string[];
}

export interface IEvent extends IUnsignedEvent {
    sig: string;
}

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

export interface ISingleEventFilter extends IEventFilter {
    limit: 1
}