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

const chunk = (text, finishReason) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, ...(finishReason ? { finishReason } : {}) }] })}\n\n`;
const request = { messages: [{ role: 'user', content: 'Hello' }], thinkingLevel: 'low', apiKey: 'tab-key' };

describe('streamReply', () => {
  it('calls Gemini directly and handles SSE events split across network chunks', async () => {
    const first = chunk('Hi');
    const fetchMock = vi.fn().mockResolvedValue(responseWithEvents(
      first.slice(0, 20),
      first.slice(20) + chunk(' there'),
      `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'hmm', thought: true }] }, finishReason: 'STOP' }] })}\n\n`,
    ));
    vi.stubGlobal('fetch', fetchMock);
    const parts = [];
    await streamReply({ ...request, messages: [...request.messages, { role: 'assistant', content: 'Yo' }, { role: 'user', content: 'Again' }], onDelta: (text) => parts.push(text) });
    expect(parts).toEqual(['Hi', ' there']);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-4-hydrogen:streamGenerateContent?alt=sse');
    expect(options.headers['x-goog-api-key']).toBe('tab-key');
    const body = JSON.parse(options.body);
    expect(body.contents.map((item) => item.role)).toEqual(['user', 'model', 'user']);
    expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe('low');
  });

  it('uses a custom model ID when one is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(responseWithEvents(chunk('Ok', 'STOP')));
    vi.stubGlobal('fetch', fetchMock);
    await streamReply({ ...request, model: 'models/other-model', onDelta() {} });
    expect(fetchMock.mock.calls[0][0]).toContain('/models/other-model:streamGenerateContent');
  });

  it('surfaces API errors, missing keys, and incomplete streams', async () => {
    await expect(streamReply({ ...request, apiKey: '', onDelta() {} })).rejects.toThrow('Add a Gemini API key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }));
    await expect(streamReply({ ...request, onDelta() {} })).rejects.toThrow('not accepted');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    await expect(streamReply({ ...request, onDelta() {} })).rejects.toThrow('“gemini-4-hydrogen” is not available');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(streamReply({ ...request, onDelta() {} })).rejects.toThrow('Could not reach Gemini');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseWithEvents(chunk('Half'))));
    await expect(streamReply({ ...request, onDelta() {} })).rejects.toThrow('interrupted');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseWithEvents('data: {"candidates":[{"finishReason":"SAFETY"}]}\n\n')));
    await expect(streamReply({ ...request, onDelta() {} })).rejects.toThrow('safety');
  });

  it('reports responses that end early', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseWithEvents(chunk('Long', 'MAX_TOKENS'))));
    const onNotice = vi.fn();
    await streamReply({ ...request, onDelta() {}, onNotice });
    expect(onNotice).toHaveBeenCalledWith('Response ended early (max tokens).');
  });
});
