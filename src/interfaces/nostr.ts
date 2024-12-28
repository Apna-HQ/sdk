export interface INostr {

    // LOW-LEVEL APIs
    // NostrClient.PublishEvent(signer=()=>{}, event={}, relays=[])
    // NostrClient.FetchEvent(eventFilters=[{}], relays=[])
    // NostrClient.FetchAllEvents(eventFilters=[{}], relays=[])
    // NostrClient.SubscribeToEvents(eventFilters=[{}], relays=[], eventHandler=(e)=>{})
    // NostrClient.Unsubscribe(subscription)

    // HIGH-LEVEL APIs
    getProfile: () => any,
    getNpubProfile: (npub: string) => any,
    updateProfile: (profile: any) => void,
    followNpub: (npub: string) => void,
    unfollowNpub: (npub: string) => void,
    publishNote: (content: string) => void,
    repostNote: (noteId: string, quoteContent: string) => void,
    likeNote: (noteId: string) => void,
    replyToNote: (noteId: string, content: string) => void,
    subscribeToFeed: (feedType: string, onevent: (event: any) => void) => void,
    subscribeToNpubFeed: (npub: string, feedType: string, onevent: (event: any) => void) => void,
    subscribeToNotifications: (onevent: (event: any) => void) => void
}