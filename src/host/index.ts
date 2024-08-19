import postRobot from 'post-robot';

export class ApnaHost {
  constructor() {
    this.listenForHandshake();
  }

  // Listen for handshake initiation from mini apps
  listenForHandshake() {
    // @ts-ignore
    postRobot.on('handshake:init', (event) => {
      console.log('Received handshake from mini app:', event.data);
      return this.respondToHandshake(event.data);
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
