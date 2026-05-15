import { HttpClient } from '../src/core/http';
import { Transport } from '../src/core/transport';
import { Bridge } from '../src/core/bridge';
import { Channel } from '../src/core/channels';
import {
  ApnaMessage,
  MessageType,
  RpcRequest,
  StreamStart,
  StreamStop,
} from '../src/core/protocol';

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

class MockChannel implements Channel {
  sent: ApnaMessage[] = [];
  send(message: ApnaMessage): void {
    this.sent.push(message);
  }
  onMessage(): () => void {
    return () => undefined;
  }
  ready(): Promise<void> {
    return Promise.resolve();
  }
  dispose(): void {
    /* no-op */
  }
  rpcRequests(): RpcRequest[] {
    return this.sent.filter(
      (m): m is RpcRequest => m.type === MessageType.RpcRequest
    );
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

describe('HttpClient', () => {
  it('POSTs to {endpoint}/{method} with { capability, args } and returns JSON', async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body)) });
      return jsonResponse([{ id: 'e1' }]);
    }) as unknown as typeof fetch;

    // Trailing slash on the endpoint must be normalized away.
    const http = new HttpClient({ endpoint: 'https://h/api/nostr/', fetchImpl });
    const result = await http.call('nostr.query', [{ kinds: [1] }]);

    expect(result).toEqual([{ id: 'e1' }]);
    expect(calls[0].url).toBe('https://h/api/nostr/query');
    expect(calls[0].body).toEqual({
      capability: 'nostr.query',
      args: [{ kinds: [1] }],
    });
  });

  it('dedupes identical concurrent calls into a single fetch', async () => {
    let fetchCount = 0;
    let resolveFetch!: (r: Response) => void;
    const fetchImpl = (async () => {
      fetchCount++;
      return new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
    }) as unknown as typeof fetch;
    const http = new HttpClient({ endpoint: 'https://h/api/nostr', fetchImpl });

    const p1 = http.call('nostr.query', [{ kinds: [1] }]);
    const p2 = http.call('nostr.query', [{ kinds: [1] }]);
    expect(fetchCount).toBe(1);
    expect(p1).toBe(p2);

    resolveFetch(jsonResponse([]));
    await p1;

    // After the in-flight entry settles, a fresh call fetches again.
    const p3 = http.call('nostr.query', [{ kinds: [1] }]);
    expect(fetchCount).toBe(2);
    resolveFetch(jsonResponse([]));
    await p3;
  });

  it('rejects on a non-OK HTTP response', async () => {
    const fetchImpl = (async () =>
      ({
        ok: false,
        status: 502,
        json: async () => ({}),
        text: async () => 'relay failure',
      } as unknown as Response)) as unknown as typeof fetch;
    const http = new HttpClient({ endpoint: 'https://h/api/nostr', fetchImpl });
    await expect(http.call('nostr.query', [])).rejects.toThrow(/HTTP 502/);
  });
});

describe('Transport', () => {
  it('routes open reads to HTTP and gated calls to the bridge', async () => {
    let fetchCount = 0;
    const fetchImpl = (async () => {
      fetchCount++;
      return jsonResponse([]);
    }) as unknown as typeof fetch;
    const http = new HttpClient({ endpoint: 'https://h/api/nostr', fetchImpl });
    const channel = new MockChannel();
    const bridge = new Bridge(channel);
    const transport = new Transport({
      bridge,
      httpClient: http,
      capabilities: [
        { capability: 'nostr.query', gating: 'open' },
        { capability: 'nostr.signEvent', gating: 'gated' },
      ],
    });

    await transport.call('nostr.query', [{ kinds: [1] }]);
    expect(fetchCount).toBe(1);
    expect(channel.rpcRequests()).toHaveLength(0);

    // Gated call — must go over the bridge, not HTTP. (Left unresolved; we only
    // assert it was dispatched to the channel.)
    transport.call('nostr.signEvent', [{ kind: 1 }]).catch(() => undefined);
    expect(fetchCount).toBe(1);
    const rpc = channel.rpcRequests();
    expect(rpc).toHaveLength(1);
    expect(rpc[0].capability).toBe('nostr.signEvent');

    bridge.dispose();
  });

  it('bridges a capability with no open descriptor', () => {
    const fetchImpl = (async () => jsonResponse([])) as unknown as typeof fetch;
    const http = new HttpClient({ endpoint: 'https://h/api/nostr', fetchImpl });
    const channel = new MockChannel();
    const bridge = new Bridge(channel);
    const transport = new Transport({
      bridge,
      httpClient: http,
      capabilities: [],
    });

    transport.call('unknown.capability', []).catch(() => undefined);
    expect(channel.rpcRequests()).toHaveLength(1);
    bridge.dispose();
  });

  it('routes open reads over the bridge when no httpClient is configured', () => {
    const channel = new MockChannel();
    const bridge = new Bridge(channel);
    const transport = new Transport({
      bridge,
      capabilities: [{ capability: 'nostr.query', gating: 'open' }],
    });
    transport.call('nostr.query', [{ kinds: [1] }]).catch(() => undefined);
    expect(channel.rpcRequests()).toHaveLength(1);
    bridge.dispose();
  });

  it('falls back to bridge streaming when no httpClient is configured', () => {
    const channel = new MockChannel();
    const bridge = new Bridge(channel, { instanceId: 'inst-subscribe' });
    const transport = new Transport({
      bridge,
      capabilities: [{ capability: 'nostr.subscribe', gating: 'open' }],
    });

    const unsubscribe = transport.subscribe(
      'nostr.subscribe',
      [{ kinds: [1] }],
      () => undefined
    );

    expect(channel.streamStarts()).toMatchObject([
      {
        type: MessageType.StreamStart,
        instanceId: 'inst-subscribe',
        capability: 'nostr.subscribe',
        args: [{ kinds: [1] }],
      },
    ]);

    unsubscribe();
    expect(channel.streamStops()).toMatchObject([
      {
        type: MessageType.StreamStop,
        id: channel.streamStarts()[0].id,
        instanceId: 'inst-subscribe',
      },
    ]);

    bridge.dispose();
  });
});
