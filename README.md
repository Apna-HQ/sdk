# Apna SDK

A TypeScript SDK for building mini-apps that integrate with the Apna super app ecosystem, with a focus on Nostr protocol integration.

## Overview

The Apna SDK provides a seamless communication layer between mini-apps and the Apna super app. It enables mini-apps to leverage the capabilities of the super app, particularly its Nostr protocol implementation, without having to implement these features themselves.

## Features

- **Cross-Window Communication**: Secure communication between mini-apps and the super app using post-robot
- **Nostr Protocol Integration**: Access to Nostr functionality through a simple API
- **React Integration**: Ready-to-use React components and hooks for easy integration
- **TypeScript Support**: Full TypeScript definitions for improved developer experience

## Installation

```bash
npm install @apna/sdk
# or
yarn add @apna/sdk
```

## Usage

### In a Mini-App

#### Basic Usage

```typescript
import { ApnaApp } from '@apna/sdk';

// Initialize the SDK
const apna = new ApnaApp({ appId: 'your-mini-app-id' });

// Use Nostr functionality
async function getProfile() {
  try {
    const profile = await apna.nostr.getActiveUserProfile();
    console.log('Current user profile:', profile);
  } catch (error) {
    console.error('Failed to get profile:', error);
  }
}

// Send data to the super app
apna.sendData({ type: 'custom-event', payload: { key: 'value' } });
```

#### React Integration

```tsx
import React from 'react';
import { ApnaProvider, useApna } from '@apna/sdk';

function App() {
  return (
    <ApnaProvider>
      <YourApp />
    </ApnaProvider>
  );
}

function YourApp() {
  const { nostr } = useApna();
  
  async function handlePublishNote() {
    try {
      const note = await nostr.publishNote('Hello from my mini-app!');
      console.log('Published note:', note);
    } catch (error) {
      console.error('Failed to publish note:', error);
    }
  }
  
  return (
    <div>
      <h1>My Mini App</h1>
      <button onClick={handlePublishNote}>Publish Note</button>
    </div>
  );
}
```

### In the Super App (Host)

```typescript
import { ApnaHost } from '@apna/sdk';

// Initialize the host with method handlers
const host = new ApnaHost({
  methodHandlers: {
    nostr: {
      // Implement the Nostr interface methods
      getActiveUserProfile: async () => {
        // Your implementation
        return {
          nprofile: 'npub1...',
          metadata: { name: 'User', about: 'About me' },
          following: [],
          followers: []
        };
      },
      publishNote: async (content) => {
        // Your implementation
        return { /* note object */ };
      },
      // Implement other methods...
    }
  }
});

// Send a message to a mini-app
const iframe = document.getElementById('mini-app-iframe');
host.sendMessage(iframe, 'superapp:message', { type: 'customise:toggleHighlight' });
```

## Nostr API

The SDK provides a comprehensive API for interacting with the Nostr protocol:

### User Management

- `getActiveUserProfile()`: Get the currently active user profile
- `fetchUserMetadata(npub)`: Fetch metadata for a specific user
- `updateProfileMetadata(profile)`: Update the current user's profile metadata
- `followUser(npub)`: Follow a user
- `unfollowUser(npub)`: Unfollow a user

### Content Management

- `fetchNote(noteId)`: Fetch a specific note
- `fetchNoteAndReplies(noteId)`: Fetch a note and its replies
- `publishNote(content)`: Publish a new note
- `repostNote(noteId, quoteContent)`: Repost a note with optional quote content
- `likeNote(noteId)`: Like a note
- `replyToNote(noteId, content)`: Reply to a note

### Feed Management

- `fetchFeed(feedType, since, until, limit)`: Fetch a feed of notes
- `fetchUserFeed(npub, feedType, since, until, limit)`: Fetch a user's feed
- `subscribeToFeed(feedType, onevent)`: Subscribe to a feed for real-time updates
- `subscribeToUserFeed(npub, feedType, onevent)`: Subscribe to a user's feed

## Development

```bash
# Install dependencies
npm install

# Start development mode
npm start

# Build the library
npm run build

# Run tests
npm test
```

## License

MIT
