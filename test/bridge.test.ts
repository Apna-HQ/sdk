import { Bridge, BridgeError } from '../src/core/bridge';
import { Channel } from '../src/core/channels';
import {
  APNA_PROTOCOL,
  ApnaMessage,
  HandshakeAck,
  MessageType,
  RpcRequest,
  StreamEvent,
  StreamStart,
  StreamStop,
} from '../src/core/protocol';
import { PermissionDeniedError } from '../src/interfaces/permissions';

class MockChannel implements Channel {
  sent: ApnaMessage[] = [];
  private handlers = new Set<(m: ApnaMessage) => void>();

  send(message: ApnaMessage): void {
    this.sent.push(message);
  }
  onMessage(handler: (message: ApnaMessage) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
  ready(): Promise<void> {
    return Promise.resolve();
  }
  dispose(): void {
    this.handlers.clear();
  }
  /** Simulate an inbound message from the peer. */
  inject(message: ApnaMessage): void {
    this.handlers.forEach((h) => h(message));
  }
  /** The id the bridge assigned to the Nth `rpc:request` it sent. */
  rpcRequestAt(index: number): RpcRequest {
    const reqs = this.sent.filter(
      (m): m is RpcRequest => m.type === MessageType.RpcRequest
    );
    return reqs[index];
  }
  streamStarts(): StreamStart[] {
    return this.sent.filter(
      (m): m is StreamStart => m.type === MessageType.StreamStart
    );
  }
  streamStops(): StreamStop[] {
    return this.sent.filter(
      (m): m is StreamStop => m.type === MessageType.StreamStop
    );
  }
}

function rpcResponse(id: number, value: unknown): ApnaMessage {
  return { protocol: APNA_PROTOCOL, type: MessageType.RpcResponse, id, ok: true, value };
}

describe('Bridge', () => {
  it('correlates concurrent requests to their own responses', async () => {
    const ch = new MockChannel();
    const bridge = new Bridge(ch);

    const p1 = bridge.request('nostr.query', [{ kinds: [1] }]);
    const p2 = bridge.request('nostr.queryOne', [{ ids: ['x'] }]);
    const p3 = bridge.request('identity.v1.me', []);

    const id1 = ch.rpcRequestAt(0).id;
    const id2 = ch.rpcRequestAt(1).id;
    const id3 = ch.rpcRequestAt(2).id;
    expect(new Set([id1, id2, id3]).size).toBe(3);

    // Respond out of order.
    ch.inject(rpcResponse(id2, 'two'));
    ch.inject(rpcResponse(id3, 'three'));
    ch.inject(rpcResponse(id1, 'one'));

    await expect(p1).resolves.toBe('one');
    await expect(p2).resolves.toBe('two');
    await expect(p3).resolves.toBe('three');

    bridge.dispose();
  });

  it('rejects on timeout', async () => {
    const ch = new MockChannel();
    const bridge = new Bridge(ch, { timeoutMs: 20 });
    const p = bridge.request('nostr.query', []);
    await expect(p).rejects.toBeInstanceOf(BridgeError);
    await p.catch((e: BridgeError) => expect(e.code).toBe('timeout'));
    bridge.dispose();
  });

  it('maps a permission-denied error to PermissionDeniedError', async () => {
    const ch = new MockChannel();
    const bridge = new Bridge(ch);
    const p = bridge.request('nostr.signEvent', [{ kind: 1 }]);
    const id = ch.rpcRequestAt(0).id;
    ch.inject({
      protocol: APNA_PROTOCOL,
      type: MessageType.RpcResponse,
      id,
      ok: false,
      error: { code: 'permission-denied', message: 'denied by user' },
    });
    await expect(p).rejects.toBeInstanceOf(PermissionDeniedError);
    bridge.dispose();
  });

  it('rejects in-flight requests on dispose', async () => {
    const ch = new MockChannel();
    const bridge = new Bridge(ch);
    const p = bridge.request('nostr.query', []);
    bridge.dispose();
    await expect(p).rejects.toThrow(/disposed/);
  });

  it('ignores responses with an unknown id', () => {
    const ch = new MockChannel();
    const bridge = new Bridge(ch);
    // No pending request with id 999 — must not throw.
    expect(() => ch.inject(rpcResponse(999, 'orphan'))).not.toThrow();
    bridge.dispose();
  });

  it('resolves handshake on a matching ack and ignores mismatched ones', async () => {
    const ch = new MockChannel();
    const bridge = new Bridge(ch, { instanceId: 'inst-1' });
    const p = bridge.handshake({ appId: 'demo', sdkVersion: '2.0.0' });

    // Ack for a different instance — ignored.
    const wrongAck: HandshakeAck = {
      protocol: APNA_PROTOCOL,
      type: MessageType.HandshakeAck,
      instanceId: 'inst-other',
      capabilities: [],
    };
    ch.inject(wrongAck);

    // Correct ack — resolves.
    const ack: HandshakeAck = {
      protocol: APNA_PROTOCOL,
      type: MessageType.HandshakeAck,
      instanceId: 'inst-1',
      capabilities: [{ capability: 'nostr.query', gating: 'open' }],
      httpEndpoint: 'https://host.example/api/nostr',
    };
    ch.inject(ack);

    await expect(p).resolves.toMatchObject({
      instanceId: 'inst-1',
      httpEndpoint: 'https://host.example/api/nostr',
    });
    bridge.dispose();
  });

  it('delivers inbound events to on() subscribers', () => {
    const ch = new MockChannel();
    const bridge = new Bridge(ch);
    const seen: string[] = [];
    const off = bridge.on(MessageType.Event, (msg) => seen.push(msg.event));

    ch.inject({
      protocol: APNA_PROTOCOL,
      type: MessageType.Event,
      instanceId: bridge.instanceId,
      event: 'profile:switched',
    });
    expect(seen).toEqual(['profile:switched']);

    off();
    ch.inject({
      protocol: APNA_PROTOCOL,
      type: MessageType.Event,
      instanceId: bridge.instanceId,
      event: 'permissions:changed',
    });
    expect(seen).toEqual(['profile:switched']);

    bridge.dispose();
  });

  it('starts bridge streams, delivers events, and sends stop on unsubscribe', () => {
    const ch = new MockChannel();
    const bridge = new Bridge(ch, { instanceId: 'inst-stream' });
    const seen: unknown[] = [];

    const unsubscribe = bridge.stream(
      'nostr.subscribe',
      [{ kinds: [1] }],
      (event) => seen.push(event)
    );

    expect(ch.streamStarts()).toMatchObject([
      {
        type: MessageType.StreamStart,
        instanceId: 'inst-stream',
        capability: 'nostr.subscribe',
        args: [{ kinds: [1] }],
      },
    ]);

    const start = ch.streamStarts()[0];
    const event: StreamEvent = {
      protocol: APNA_PROTOCOL,
      type: MessageType.StreamEvent,
      id: start.id,
      instanceId: 'inst-stream',
      payload: { id: 'event-1' },
    };
    ch.inject(event);
    expect(seen).toEqual([{ id: 'event-1' }]);

    unsubscribe();
    expect(ch.streamStops()).toMatchObject([
      {
        type: MessageType.StreamStop,
        id: start.id,
        instanceId: 'inst-stream',
      },
    ]);

    bridge.dispose();
  });

  it('offers host helpers for stream start and event emission', () => {
    const ch = new MockChannel();
    const bridge = new Bridge(ch);
    const starts: StreamStart[] = [];
    bridge.onStreamStart((message) => {
      starts.push(message);
      bridge.emitStreamEvent(message, { ok: true });
      bridge.stopStream(message);
    });

    ch.inject({
      protocol: APNA_PROTOCOL,
      type: MessageType.StreamStart,
      id: 7,
      instanceId: 'hosted',
      capability: 'nostr.subscribe',
      args: [],
    });

    expect(starts).toHaveLength(1);
    expect(ch.sent).toMatchObject([
      {
        type: MessageType.StreamEvent,
        id: 7,
        instanceId: 'hosted',
        payload: { ok: true },
      },
      {
        type: MessageType.StreamStop,
        id: 7,
        instanceId: 'hosted',
      },
    ]);

    bridge.dispose();
  });
});
