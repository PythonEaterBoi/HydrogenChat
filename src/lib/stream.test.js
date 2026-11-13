import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamReply } from './stream.js';

function responseWithEvents(...chunks) {
  const encoder = new TextEncoder();
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('streamReply', () => {
  it('handles SSE events split across network chunks', async () => {
    const fetchMock = vi.fn().mockResolvedValue(responseWithEvents(
      'data: {"type":"del',
      'ta","text":"Hi"}\n\ndata: {"type":"delta","text":" there"}\n\n',
      'data: {"type":"done"}\n\n',
    ));
    vi.stubGlobal('fetch', fetchMock);
    const parts = [];
    await streamReply({ messages: [{ role: 'user', content: 'Hello' }], thinkingLevel: 'low', apiKey: 'tab-key', onDelta: (text) => parts.push(text) });
    expect(parts).toEqual(['Hi', ' there']);
    expect(fetchMock.mock.calls[0][1].headers['x-gemini-api-key']).toBe('tab-key');
  });

  it('surfaces API errors and incomplete streams', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Check your key.' }) }));
    await expect(streamReply({ messages: [], onDelta() {} })).rejects.toThrow('Check your key.');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseWithEvents('data: {"type":"delta","text":"Half"}\n\n')));
    await expect(streamReply({ messages: [], onDelta() {} })).rejects.toThrow('interrupted');
  });
});
