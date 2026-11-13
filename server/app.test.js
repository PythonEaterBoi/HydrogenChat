import { Readable } from 'node:stream';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';

const userMessage = [{ role: 'user', content: 'Hello, Hydrogen' }];
const postChat = (app, messages = userMessage) => request(app).post('/api/chat').send({ messages, thinkingLevel: 'low' });

function sseStream(...chunks) {
  return Readable.from(chunks.map((chunk) => Buffer.from(chunk)));
}

describe('Hydrogen API', () => {
  it('reports model and server-side key availability without exposing the key', async () => {
    const response = await request(createApp({ apiKey: 'secret-test-key' })).get('/api/config');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ model: 'gemini-4-hydrogen', configured: true });
    expect(JSON.stringify(response.body)).not.toContain('secret-test-key');
  });

  it('requires a key and validates the conversation before calling Gemini', async () => {
    const fetchImpl = vi.fn();
    const app = createApp({ fetchImpl, apiKey: '' });
    expect((await postChat(app)).status).toBe(401);
    expect((await postChat(app, [{ role: 'assistant', content: 'Not a user' }])).status).toBe(400);
    expect((await request(app).post('/api/chat').send({ messages: userMessage, thinkingLevel: 'minimal' })).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('streams only visible text and sends multi-turn history to Gemini 4 Hydrogen', async () => {
    const first = 'data: {"candidates":[{"content":{"parts":[{"text":"hidden","thought":true},{"text":"Hello"}]}}]}\n\n';
    const second = 'data: {"candidates":[{"content":{"parts":[{"text":" there!"}]},"finishReason":"STOP"}]}\n\n';
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, body: sseStream(first.slice(0, 23), first.slice(23) + second.slice(0, 32), second.slice(32)) });
    const app = createApp({ fetchImpl, apiKey: '' });
    const messages = [userMessage[0], { role: 'assistant', content: 'Hi!' }, { role: 'user', content: 'Say hello again' }];
    const response = await request(app).post('/api/chat').set('x-gemini-api-key', 'browser-test-key').send({ messages, thinkingLevel: 'medium' });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.text).toContain('"type":"delta","text":"Hello"');
    expect(response.text).toContain('"type":"delta","text":" there!"');
    expect(response.text).not.toContain('hidden');
    expect(response.text).toContain('"type":"done"');
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain('/models/gemini-4-hydrogen:streamGenerateContent?alt=sse');
    expect(options.headers['x-goog-api-key']).toBe('browser-test-key');
    expect(JSON.parse(options.body)).toMatchObject({
      contents: [
        { role: 'user', parts: [{ text: 'Hello, Hydrogen' }] },
        { role: 'model', parts: [{ text: 'Hi!' }] },
        { role: 'user', parts: [{ text: 'Say hello again' }] },
      ],
      generationConfig: { thinkingConfig: { thinkingLevel: 'medium' } },
    });
  });

  it('turns provider errors into useful responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: { message: 'quota' } }) });
    const response = await postChat(createApp({ fetchImpl, apiKey: 'test-key' }));
    expect(response.status).toBe(429);
    expect(response.body.error).toMatch(/rate-limiting/);
  });

  it('reports an empty stream instead of silently completing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, body: sseStream('data: {"candidates":[{"finishReason":"SAFETY"}]}\n\n') });
    const response = await postChat(createApp({ fetchImpl, apiKey: 'test-key' }));
    expect(response.text).toContain('safety settings');
    expect(response.text).toContain('"type":"done"');
  });
});
