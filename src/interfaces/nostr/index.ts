export interface INostr {

    // LOW-LEVEL APIs

    // utils
    /**
     * Encodes a value into a bech32-encoded Nostr identifier string.
     *
     * @description Use this method when you need to convert internal Nostr data structures into
     * human-readable, shareable identifiers (like npub, note, nprofile, etc.).
     *
     * @example
     * // Encode a public key to npub format
     * const npub = nostr.encode('npub', publicKeyHex );
     *
     * @param type - The type of identifier to create (npub, note, nprofile, etc.)
     * @param data - The data to encode, must match the expected structure for the prefix
     * @returns A bech32-encoded string with the specified prefix (e.g., npub1...)
     */
    encode: <Prefix extends keyof Prefixes>(type: Prefix, data: Prefixes[Prefix]) => string,
    
    /**
     * Decodes a bech32-encoded Nostr identifier string back into its component data.
     *
     * @description Use this method when you receive a Nostr identifier (like an npub or note ID)
     * and need to extract the underlying data for processing.
     *
     * @example
     * // Decode an npub to get the hex public key
     * const { type, data } = nostr.decode('npub1abc123...');
     * // data contains the hex public key
     *
     * @param nip19String - A bech32-encoded string with a valid Nostr prefix
     * @returns An object containing the decoded data and type information
     */
    decode: <Prefix extends keyof Prefixes>(nip19String: string) => DecodeValue<Prefix>,
    
    // data fetch
    /**
     * Fetches a single Nostr event matching the provided filter.
     *
     * @description Use this when you need to retrieve a specific event by its ID or
     * when you're certain your filter will match exactly one event.
     *
     * @example
     * // Fetch a specific note by ID
     * const event = await nostr.fetchEvent({ ids: ['note1abc123...'], limit: 1 });
     *
     * @param eventFilter - Filter criteria to match a single event (limit is set to 1)
     * @param relaysOverride - Optional array of relay URLs to query instead of default relays
     * @returns A single Nostr event matching the filter
     */
    fetchEvent: (eventFilter: ISingleEventFilter, relaysOverride?: string[]) => Promise<IEvent> | IEvent,
    
    /**
     * Fetches multiple Nostr events matching the provided filter.
     *
     * @description Use this when you need to retrieve multiple events based on criteria
     * such as author, kind, tags, or time range.
     *
     * @example
     * // Fetch recent notes from a specific author
     * const events = await nostr.fetchEvents({
     *   kinds: [1],
     *   authors: ['pubkey123...'],
     *   limit: 20
     * });
     *
     * @param eventFilter - Filter criteria to match events
     * @param relaysOverride - Optional array of relay URLs to query instead of default relays
     * @returns An array of Nostr events matching the filter
     */
    fetchEvents: (eventFilter: IEventFilter, relaysOverride?: string[]) => Promise<IEvent[]> | IEvent[],
    
    /**
     * Subscribes to a stream of events matching the provided filter.
     *
     * @description Use this when you need real-time updates of events as they are published
     * to relays. This is ideal for live feeds, chat applications, or notifications.
     *
     * @example
     * // Subscribe to new notes from followed users
     * await nostr.subscribeToEvents(
     *   { kinds: [1], authors: followedPubkeys, since: Math.floor(Date.now() / 1000) },
     *   (event) => {
     *     console.log('New note received:', event.content);
     *   }
     * );
     *
     * @param eventFilter - Filter criteria for events to subscribe to
     * @param onevent - Callback function that will be called for each matching event
     * @param relaysOverride - Optional array of relay URLs to subscribe to instead of default relays
     * @returns A Promise that resolves when the subscription is established
     */
    subscribeToEvents: (eventFilter: IEventFilter, onevent: (event: IEvent) => void, relaysOverride?: string[]) => Promise<void> | void,
    
    // signing and publishing
    /**
     * Signs an unsigned event with the user's private key and publishes it to relays.
     *
     * @description Use this when you need complete control over event creation and want to
     * manually construct an event before signing and publishing it. This is the lowest-level
     * method for publishing content to the Nostr network.
     *
     * @example
     * // Create and publish a custom event
     * const unsignedEvent = {
     *   kind: 1,
     *   content: 'Hello Nostr!',
     *   created_at: Math.floor(Date.now() / 1000),
     *   tags: [['t', 'nostr']],
     *   pubkey: '', // Will be filled by the implementation
     *   id: '', // Will be calculated by the implementation
     * };
     * const signedEvent = await nostr.signAndPublishEvent(unsignedEvent);
     *
     * @param event - The unsigned event to sign and publish
     * @param relaysOverride - Optional array of relay URLs to publish to instead of default relays
     * @returns The signed and published event with its signature
     */
    signAndPublishEvent: (event: IUnsignedEvent, relaysOverride?: string[]) => Promise<IEvent> | IEvent,


    // HIGH-LEVEL APIs
    
    // user-scope
    /**
     * Gets the profile information of the currently active user.
     *
     * @description Use this to retrieve the current user's profile data, including
     * their metadata, following list, and followers. This is useful for displaying
     * user information or checking the authentication state.
     *
     * @example
     * // Get the current user's profile
     * const myProfile = await nostr.getActiveUserProfile();
     * console.log(`Logged in as: ${myProfile.metadata.name}`);
     *
     * @returns The profile information of the currently active user
     */
    getActiveUserProfile: () => Promise<IUserProfile> | IUserProfile,
    
    /**
     * Fetches the metadata for a specific user by their npub.
     *
     * @description Use this when you need basic profile information about a user
     * without their following/follower lists. This is lighter weight than fetchUserProfile.
     *
     * @example
     * // Get a user's display name and about text
     * const metadata = await nostr.fetchUserMetadata('npub1abc123...');
     * console.log(`${metadata.name}: ${metadata.about}`);
     *
     * @param npub - The npub (public key in bech32 format) of the user
     * @returns The user's metadata (name, about, picture, etc.)
     */
    fetchUserMetadata: (npub: string) => Promise<IUserMetadata> | IUserMetadata,
    
    /**
     * Updates the current user's profile metadata.
     *
     * @description Use this to update the current user's profile information such as
     * name, about, picture, and other metadata fields. This will publish a kind 0 event.
     *
     * @example
     * // Update the user's profile
     * await nostr.updateProfileMetadata({
     *   name: 'New Name',
     *   about: 'Updated bio information',
     *   picture: 'https://example.com/new-avatar.jpg'
     * });
     *
     * @param profile - Object containing the metadata fields to update
     * @returns The updated user profile
     */
    updateProfileMetadata: (profile: IUserMetadata) => Promise<IUserProfile> | IUserProfile,
    
    /**
     * Fetches the complete profile information for a user by their npub.
     *
     * @description Use this when you need comprehensive information about a user,
     * including their metadata, following list, and followers. This is useful for
     * displaying user profiles.
     *
     * @example
     * // Get a user's complete profile
     * const profile = await nostr.fetchUserProfile('npub1abc123...');
     * console.log(`${profile.metadata.name} follows ${profile.following.length} users`);
     *
     * @param npub - The npub (public key in bech32 format) of the user
     * @returns The complete user profile information
     */
    fetchUserProfile: (npub: string) => Promise<IUserProfile> | IUserProfile,
    
    /**
     * Follows a user by adding them to the current user's following list.
     *
     * @description Use this to make the current user follow another user. This will
     * update and publish a kind 3 contact list event.
     *
     * @example
     * // Follow a user
     * await nostr.followUser('npub1abc123...');
     *
     * @param npub - The npub (public key in bech32 format) of the user to follow
     * @returns A Promise that resolves when the follow operation is complete
     */
    followUser: (npub: string) => Promise<void> | void,
    
    /**
     * Unfollows a user by removing them from the current user's following list.
     *
     * @description Use this to make the current user unfollow another user. This will
     * update and publish a kind 3 contact list event.
     *
     * @example
     * // Unfollow a user
     * await nostr.unfollowUser('npub1abc123...');
     *
     * @param npub - The npub (public key in bech32 format) of the user to unfollow
     * @returns A Promise that resolves when the unfollow operation is complete
     */
    unfollowUser: (npub: string) => Promise<void> | void,

    // note-scope
    /**
     * Fetches a single note by its ID.
     *
     * @description Use this to retrieve a specific note when you have its ID.
     * Optionally includes reaction events (likes, reposts) related to the note.
     *
     * @example
     * // Fetch a note with its reactions
     * const note = await nostr.fetchNote('note1abc123...', true);
     * console.log(`Note has ${note.reactions?.likes.length || 0} likes`);
     *
     * @param noteId - The ID of the note to fetch (in bech32 'note' format)
     * @param returnReactions - Whether to include reactions (likes, reposts) in the result
     * @returns The note event with optional reaction data
     */
    fetchNote: (noteId: string, returnReactions?: Boolean) => Promise<INote> | INote,
    
    /**
     * Fetches a note and all its replies.
     *
     * @description Use this to retrieve a thread of conversation - a note and all direct
     * replies to it. Useful for displaying threaded discussions.
     *
     * @example
     * // Fetch a note and its replies
     * const thread = await nostr.fetchNoteAndReplies('note1abc123...');
     * console.log(`Thread has ${thread.replyNotes.length} replies`);
     *
     * @param noteId - The ID of the root note to fetch (in bech32 'note' format)
     * @param returnReactions - Whether to include reactions in the results
     * @returns An object containing the note and an array of reply notes
     */
    fetchNoteAndReplies: (noteId: string, returnReactions?: Boolean) => Promise<INoteAndReplies> | INoteAndReplies,
    
    /**
     * Publishes a new note with the given content.
     *
     * @description Use this to create and publish a new standalone note (kind 1 event).
     * This is the primary method for posting content to the Nostr network.
     *
     * @example
     * // Publish a simple note
     * const note = await nostr.publishNote('Hello Nostr world!');
     * console.log(`Published note with ID: ${note.id}`);
     *
     * @param content - The text content of the note
     * @returns The published note event
     */
    publishNote: (content: string) => Promise<INote> | INote,
    
    /**
     * Reposts a note, optionally with additional quote content.
     *
     * @description Use this to repost another user's note to your followers, similar to
     * a retweet. You can add your own commentary with the quoteContent parameter.
     *
     * @example
     * // Repost a note with a comment
     * const repost = await nostr.repostNote('note1abc123...', 'Check out this great post!');
     *
     * @param noteId - The ID of the note to repost (in bech32 'note' format)
     * @param quoteContent - Optional text to add as commentary on the repost
     * @returns The repost event
     */
    repostNote: (noteId: string, quoteContent: string) => Promise<INoteRepost> | INoteRepost,
    
    /**
     * Likes a note, publishing a kind 7 reaction event.
     *
     * @description Use this to like/upvote a note. This publishes a kind 7 reaction
     * event that references the original note.
     *
     * @example
     * // Like a note
     * const reaction = await nostr.likeNote('note1abc123...');
     *
     * @param noteId - The ID of the note to like (in bech32 'note' format)
     * @returns The published like reaction event
     */
    likeNote: (noteId: string) => Promise<INoteLike> | INoteLike,
    
    /**
     * Fetches all likes for a specific note.
     *
     * @description Use this to retrieve all the like reactions for a note.
     * Useful for displaying like counts or listing users who liked a note.
     *
     * @example
     * // Get all likes for a note
     * const likes = await nostr.fetchNoteLikes('note1abc123...');
     * console.log(`Note has ${likes.length} likes`);
     *
     * @param noteId - The ID of the note to fetch likes for (in bech32 'note' format)
     * @param since - Optional timestamp to fetch likes only after this time
     * @returns An array of like reaction events
     */
    fetchNoteLikes: (noteId: string, since?: number) => Promise<INoteLike[]> | INoteLike[],
    
    /**
     * Fetches all reposts of a specific note.
     *
     * @description Use this to retrieve all the repost events for a note.
     * Useful for displaying repost counts or listing users who reposted a note.
     *
     * @example
     * // Get all reposts for a note
     * const reposts = await nostr.fetchNoteReposts('note1abc123...');
     * console.log(`Note has ${reposts.length} reposts`);
     *
     * @param noteId - The ID of the note to fetch reposts for (in bech32 'note' format)
     * @param since - Optional timestamp to fetch reposts only after this time
     * @returns An array of repost events
     */
    fetchNoteReposts: (noteId: string, since?: number) => Promise<INoteRepost[]> | INoteRepost[],
    
    /**
     * Replies to a note with the given content.
     *
     * @description Use this to create and publish a reply to an existing note.
     * The reply will include proper reference tags to the parent note.
     *
     * @example
     * // Reply to a note
     * const reply = await nostr.replyToNote('note1abc123...', 'This is my response!');
     *
     * @param noteId - The ID of the note to reply to (in bech32 'note' format)
     * @param content - The text content of the reply
     * @returns The published reply note event
     */
    replyToNote: (noteId: string, content: string) => Promise<INoteReply> | INoteReply,

    // feed-scope
    /**
     * Fetches a feed of events based on the specified feed type.
     *
     * @description Use this to retrieve a timeline of events based on predefined
     * feed types (e.g., global, following). Useful for displaying home timelines.
     *
     * @example
     * // Get the latest posts from followed users
     * const feed = await nostr.fetchFeed('FOLLOWING_FEED', Math.floor(Date.now()/1000) - 86400);
     *
     * @param feedType - The type of feed to fetch (e.g., 'FOLLOWING_FEED', 'NOTES_FEED')
     * @param since - Optional timestamp to fetch events only after this time
     * @param until - Optional timestamp to fetch events only before this time
     * @param limit - Optional maximum number of events to fetch
     * @returns An array of events constituting the feed
     */
    fetchFeed: (feedType: string, since?: number, until?: number, limit?: number) => Promise<IEvent[]> | IEvent[],
    
    /**
     * Fetches a feed of events from a specific user.
     *
     * @description Use this to retrieve a timeline of events from a specific user,
     * filtered by feed type. Useful for displaying user profiles or user-specific timelines.
     *
     * @example
     * // Get the latest notes from a specific user
     * const userFeed = await nostr.fetchUserFeed('npub1abc123...', 'NOTES_FEED', null, null, 20);
     *
     * @param npub - The npub (public key in bech32 format) of the user
     * @param feedType - The type of feed to fetch (e.g., 'FOLLOWING_FEED', 'NOTES_FEED')
     * @param since - Optional timestamp to fetch events only after this time
     * @param until - Optional timestamp to fetch events only before this time
     * @param limit - Optional maximum number of events to fetch
     * @returns An array of events constituting the user's feed
     */
    fetchUserFeed: (npub: string, feedType: string, since?: number, until?: number, limit?: number) => Promise<IEvent[]> | IEvent[],
    
    /**
     * Subscribes to a feed of events, receiving updates in real-time.
     *
     * @description Use this to get real-time updates for a feed. Events matching
     * the feed type will be passed to the callback function as they are received.
     * Ideal for live timelines and notifications.
     *
     * @example
     * // Subscribe to real-time updates from followed users
     * await nostr.subscribeToFeed('FOLLOWING_FEED', (event) => {
     *   console.log('New event in feed:', event.content);
     * }, Math.floor(Date.now() / 1000));
     *
     * @param feedType - The type of feed to subscribe to
     * @param onevent - Callback function that will be called for each matching event
     * @param since - Optional timestamp to receive events only after this time
     * @param until - Optional timestamp to receive events only before this time
     * @param limit - Optional maximum number of events to receive
     * @returns A Promise that resolves when the subscription is established
     */
    subscribeToFeed: (feedType: string, onevent: (event: IEvent) => void, since?: number, until?: number, limit?: number) => Promise<void> | void,
    
    /**
     * Subscribes to a feed of events from a specific user.
     *
     * @description Use this to get real-time updates for a specific user's feed.
     * Events from the user matching the feed type will be passed to the callback
     * function as they are received. Useful for monitoring specific users' activity.
     *
     * @example
     * // Subscribe to real-time updates from a specific user
     * await nostr.subscribeToUserFeed('npub1abc123...', 'NOTES_FEED', (event) => {
     *   console.log('New post from user:', event.content);
     * });
     *
     * @param npub - The npub (public key in bech32 format) of the user
     * @param feedType - The type of feed to subscribe to
     * @param onevent - Callback function that will be called for each matching event
     * @param since - Optional timestamp to receive events only after this time
     * @param until - Optional timestamp to receive events only before this time
     * @param limit - Optional maximum number of events to receive
     * @returns A Promise that resolves when the subscription is established
     */
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

export type FeedType = "GLOBAL_FEED" | "FOLLOWING_FEED" | "NOTES_FEED"

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