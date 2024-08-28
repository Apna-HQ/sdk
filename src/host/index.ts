import postRobot from 'post-robot';

interface IMethodHandlers {
    getPublicKey?: () => string | Promise<string>
    nostr?: {
      subscribeToEvents?: (filters: any[], onevent: (event: any) => void) => void
    }
}

export class ApnaHost {
    methodHandlers: IMethodHandlers = {}
  constructor(config: {
    methodHandlers: IMethodHandlers
  }) {
    this.methodHandlers = config.methodHandlers
    this.listenForHandshake();
    this.listenForMethodCalls();
  }

  // Listen for handshake initiation from mini apps
  listenForHandshake() {
    // @ts-ignore
    postRobot.on('handshake:init', (event) => {
      console.log('Received handshake from mini app:', event.data);
      return this.respondToHandshake(event.data);
    });
  }

  // Listen for handshake initiation from mini apps
  listenForMethodCalls() {
    // @ts-ignore
    postRobot.on('host:method-call', async (event) => {
      console.log('Received method-call from mini app:', event.data); 
      try {
        let returnValue
        switch (event.data.method) {
          case 'getPublicKey':
            returnValue = await this.methodHandlers[event.data.method as 'getPublicKey']!()
            break;

          case 'nostr.subscribeToEvents':
            returnValue = await this.methodHandlers.nostr!.subscribeToEvents!(event.data.args[0], event.data.args[1])
            break;
        
          default:
            returnValue = null
            break;
        }
        
        return {
            success: true,
            returnValue
        }
      } catch (error) {
        return {
            success: false,
            errorMessage: error?.toString()
        }
      }
    });
  }

  // Respond to the handshake message
  // @ts-ignore
  respondToHandshake(data) {
    // @ts-ignore
    postRobot.on('miniapp:data', (event) => {
        console.log('Received data from mini app:', event.data);
        return;
    });
    return {
      success: true,
      appId: data.appId,
      version: data.version,
      message: 'Handshake successful',
    };
  }

  // Send a message to the mini app
  // @ts-ignore
  sendMessage(iframe, type, payload) {
    postRobot.send(iframe.contentWindow, type, payload)
      .then((event) => {
        console.log('Response from mini app:', event.data);
      })
      .catch((err) => {
        console.error('Failed to send message to mini app:', err);
      });
  }
}

// // Example usage in the super app
// const host = new SuperAppHost();
// const iframe = document.getElementById('miniAppIframe');
// host.sendMessage(iframe, 'superapp:message', { someKey: 'someValue' });
