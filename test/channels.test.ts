import {
  detectChannel,
  IframeChannel,
  ExtensionChannel,
  RELAY_TO_APP,
  RELAY_TO_HOST,
} from '../src/core/channels';
import { APNA_PROTOCOL, MessageType, ApnaMessage } from '../src/core/protocol';

function rpcRequest(instanceId: string, id = 1): ApnaMessage {
  return {
    protocol: APNA_PROTOCOL,
    type: MessageType.RpcRequest,
    id,
    instanceId,
    capability: 'nostr.query',
    args: [],
  };
}

describe('IframeChannel', () => {
  it('two channels bound to different targets do not cross-talk', () => {
    const bus = new EventTarget();
    const winA = {} as Window;
    const winB = {} as Window;

    const chA = new IframeChannel({
      getTarget: () => winA,
      listenOn: bus as unknown as Window,
      filterBySource: true,
      instanceId: 'A',
    });
    const chB = new IframeChannel({
      getTarget: () => winB,
      listenOn: bus as unknown as Window,
      filterBySource: true,
      instanceId: 'B',
    });

    const a: ApnaMessage[] = [];
    const b: ApnaMessage[] = [];
    chA.onMessage((m) => a.push(m));
    chB.onMessage((m) => b.push(m));

    bus.dispatchEvent(
      new MessageEvent('message', {
        data: rpcRequest('A'),
        source: winA as unknown as MessageEventSource,
        origin: '',
      })
    );
    bus.dispatchEvent(
      new MessageEvent('message', {
        data: rpcRequest('B'),
        source: winB as unknown as MessageEventSource,
        origin: '',
      })
    );

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect((a[0] as { instanceId: string }).instanceId).toBe('A');
    expect((b[0] as { instanceId: string }).instanceId).toBe('B');

    chA.dispose();
    chB.dispose();
  });

  it('ignores non-Apna messages and rejects on origin mismatch', () => {
    const bus = new EventTarget();
    const target = {} as Window;
    const ch = new IframeChannel({
      getTarget: () => target,
      listenOn: bus as unknown as Window,
      targetOrigin: 'https://host.example',
    });
    const received: ApnaMessage[] = [];
    ch.onMessage((m) => received.push(m));

    // Foreign (non-Apna) message.
    bus.dispatchEvent(
      new MessageEvent('message', { data: { hello: 'world' }, origin: 'https://host.example' })
    );
    // Apna message from the wrong origin.
    bus.dispatchEvent(
      new MessageEvent('message', { data: rpcRequest('A'), origin: 'https://evil.example' })
    );

    expect(received).toHaveLength(0);

    // Apna message from the right origin gets through.
    bus.dispatchEvent(
      new MessageEvent('message', { data: rpcRequest('A'), origin: 'https://host.example' })
    );
    expect(received).toHaveLength(1);

    ch.dispose();
  });

  it('stops delivering after dispose / unsubscribe', () => {
    const bus = new EventTarget();
    const ch = new IframeChannel({
      getTarget: () => ({} as Window),
      listenOn: bus as unknown as Window,
    });
    const received: ApnaMessage[] = [];
    const off = ch.onMessage((m) => received.push(m));

    off();
    bus.dispatchEvent(new MessageEvent('message', { data: rpcRequest('A'), origin: '' }));
    expect(received).toHaveLength(0);

    ch.dispose();
  });
});

describe('ExtensionChannel', () => {
  it('wraps outbound as to-host and only accepts to-app envelopes', () => {
    const bus = new EventTarget() as unknown as Window;
    const posted: unknown[] = [];
    // Minimal Window stand-in: an EventTarget plus a postMessage spy.
    (bus as unknown as { postMessage: (m: unknown) => void }).postMessage = (m) =>
      posted.push(m);

    const ch = new ExtensionChannel({ window: bus });
    const received: ApnaMessage[] = [];
    ch.onMessage((m) => received.push(m));

    ch.send(rpcRequest('X'));
    expect(posted).toHaveLength(1);
    expect((posted[0] as { __apnaRelay: string }).__apnaRelay).toBe(RELAY_TO_HOST);

    // Our own outbound envelope echoed back must be ignored.
    (bus as unknown as EventTarget).dispatchEvent(
      new MessageEvent('message', {
        data: { __apnaRelay: RELAY_TO_HOST, message: rpcRequest('X') },
        origin: '',
      })
    );
    expect(received).toHaveLength(0);

    // A genuine inbound (to-app) envelope is delivered.
    (bus as unknown as EventTarget).dispatchEvent(
      new MessageEvent('message', {
        data: { __apnaRelay: RELAY_TO_APP, message: rpcRequest('Y') },
        origin: '',
      })
    );
    expect(received).toHaveLength(1);
    expect((received[0] as { instanceId: string }).instanceId).toBe('Y');

    ch.dispose();
  });
});

describe('detectChannel', () => {
  it('returns an explicit channel as-is', () => {
    const explicit = new ExtensionChannel({ window: new EventTarget() as unknown as Window });
    expect(detectChannel({ channel: explicit })).toBe(explicit);
  });

  it('honors a forced kind', () => {
    expect(detectChannel({ kind: 'iframe' })).toBeInstanceOf(IframeChannel);
    expect(detectChannel({ kind: 'extension' })).toBeInstanceOf(ExtensionChannel);
  });

  it('detects the extension topology from a window marker', () => {
    const w = window as unknown as Record<string, unknown>;
    expect(() => detectChannel()).toThrow(/No Apna host detected/);
    w.__APNA_EXTENSION__ = true;
    try {
      expect(detectChannel()).toBeInstanceOf(ExtensionChannel);
    } finally {
      delete w.__APNA_EXTENSION__;
    }
  });
});
