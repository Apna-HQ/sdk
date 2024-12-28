export interface INostrClient {
    PublishEvent: (event: any) => void
}

export interface INostr {
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