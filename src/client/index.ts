import postRobot from 'post-robot';
import { INostr, INostrClient } from '../interfaces/nostr';


export class ApnaApp {
    // @ts-ignore
    constructor(config) {
        // @ts-ignore
        this.config = config;
        // @ts-ignore
        this.sdkVersion = '1.0.0';

        this.#initSDK()
    }

    // Initialize the SDK
    #initSDK() {
        this.#handshake();
        this.#listenForMessages();
    }

    // Perform a handshake with the parent window (super app)
    #handshake() {
        postRobot.send(window.parent, 'handshake:init', {
            // @ts-ignore
            appId: this.config.appId,
            // @ts-ignore
            version: this.sdkVersion,
            // @ts-ignore
        }).then((event) => {
            console.log('Received handshake response from super app:', event.data);
            // Additional logic after handshake
            // @ts-ignore
        }).catch((err) => {
            console.error('Handshake failed:', err);
        });
    }

    // Register a listener for incoming messages from the parent
    #listenForMessages() {
        // @ts-ignore
        postRobot.on('superapp:message', (event) => {
            console.log('Received message from super app:', event.data);
            // Handle the message
            return this.#handleMessage(event.data);
        });
    }

    // Handle messages received from the parent window
    // @ts-ignore
    #handleMessage(data) {
        if (data.type === 'handshake:response') {
            console.log('Handshake response received:', data);
            return { success: true };
        } else {
            console.log('Handling other message types:', data);
            // Process the message
            return { success: true, message: 'Processed successfully' };
        }
    }

    // Example method for sending data to the super app
    // @ts-ignore
    #sendData(data) {
        postRobot.send(window.parent, 'miniapp:data', data)
            // @ts-ignore
            .then((event) => {
                console.log('Response from super app:', event.data);
            })
            // @ts-ignore
            .catch((err) => {
                console.error('Failed to send data:', err);
            });
    }

    #callHostMethod = async (callData: {method: string, args: any[]}): Promise<any> => {
        const response: {success: boolean, returnValue?: any, errorMessage?: string} = await postRobot.send(window.parent, 'host:method-call', callData)
            // @ts-ignore
            .then((event) => {
                console.log('return value from super app:', event.data);
                return {
                    // @ts-ignore
                    success: event.data.success,
                    // @ts-ignore
                    returnValue: event.data.returnValue,
                    // @ts-ignore
                    errorMessage: event.data.errorMessage
                };
            })
            // @ts-ignore
            .catch((err) => {
                console.error('Failed to send data:', err);
                return {
                    success: false,
                    errorMessage: err.toString()
                }
            });
        if (response.success) {
            return response.returnValue
        } else {
            throw new Error(response.errorMessage)
        }

        
    }

    #createHostMethodProxy<T>(proxyHandler: (method: string, ...args: any) => void): T {
        const handler: ProxyHandler<any> = {
          get(_, methodName: string) {
            return (...args: any[]) => {
              console.log(`Called ${methodName} with arguments:`, args);
              return proxyHandler(methodName, ...args)
            };
          },
        };
        return new Proxy({}, handler) as T;
      }

    #hostMethodProxyHandler = (module: string) => {
        return (method: string, ...args: any[]) => {
            return this.#callHostMethod({
                method: `${module}.${method}`,
                args
            })
        }
    }
    
    // Initialising modules
    NostrClient = this.#createHostMethodProxy<INostrClient>(this.#hostMethodProxyHandler("NostrClient"))
    Nostr = this.#createHostMethodProxy<INostr>(this.#hostMethodProxyHandler("Nostr"))

}

// const { NostrClient, Nostr } = new ApnaApp({})
// NostrClient.PublishEvent({})
// const a = new Nostr("here")
// a.publishNote("test")
