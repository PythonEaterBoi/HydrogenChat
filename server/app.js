import express from 'express';

const DEFAULT_MODEL = 'gemini-4-hydrogen';
const THINKING_LEVELS = new Set(['low', 'medium', 'high', 'xhigh']);
const MAX_MESSAGES = 60;
const MAX_MESSAGE_LENGTH = 24_000;
const MAX_TOTAL_LENGTH = 160_000;

const SYSTEM_INSTRUCTION = `You are Hydrogen, a thoughtful AI assistant powered by Gemini 4 Hydrogen. Be warm, direct, and genuinely useful. Give clear answers without unnecessary preamble. When a question is ambiguous, make a reasonable assumption or ask a concise clarifying question. Use Markdown when it helps readability, and format code in fenced blocks with a language name. Be honest about uncertainty and never claim to have done something you have not done.`;

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return 'Send between 1 and 60 messages.';
  }

  let totalLength = 0;
  for (const message of messages) {
    if (!message || !['user', 'assistant'].includes(message.role) ||
        typeof message.content !== 'string' || !message.content.trim() ||
        message.content.length > MAX_MESSAGE_LENGTH) {
      return 'Each message needs a role and text of at most 24,000 characters.';
    }
    totalLength += message.content.length;
  }

  if (totalLength > MAX_TOTAL_LENGTH) return 'This conversation is too long. Start a new chat to continue.';
  if (messages.at(-1).role !== 'user') return 'The last message must be from you.';
  return null;
}

function providerError(status, body) {
  if (status === 400) return body?.error?.message || 'Gemini could not process that request.';
  if (status === 401 || status === 403) return 'That Gemini API key was not accepted. Check your key and try again.';
  if (status === 404) return 'Gemini 4 Hydrogen is not available for this API key or project yet.';
  if (status === 429) return 'Gemini is rate-limiting requests right now. Please wait a moment and retry.';
  return status >= 500
    ? 'Gemini is temporarily unavailable. Please try again shortly.'
    : body?.error?.message || 'Gemini could not complete that request.';
}

function sendEvent(res, event) {
  if (!res.destroyed) res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// A small, dependency-free parser for Google's streamGenerateContent SSE response.
// The Gemini API sends text deltas in candidates[0].content.parts.
export async function relayGeminiStream(stream, res) {
  const decoder = new TextDecoder();
  let buffer = '';
  let sentText = false;
  let finishReason = '';

  const consume = (block) => {
    const data = block.split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data || data === '[DONE]') return;

    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }

    const candidate = payload.candidates?.[0];
    const text = candidate?.content?.parts
      ?.filter((part) => typeof part.text === 'string' && !part.thought)
      .map((part) => part.text)
      .join('');

    if (text) {
      sentText = true;
      sendEvent(res, { type: 'delta', text });
    }
    if (candidate?.finishReason) finishReason = candidate.finishReason;
  };

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop();
    for (const block of blocks) consume(block);
  }

  buffer += decoder.decode();
  if (buffer.trim()) consume(buffer);

  if (!sentText) {
    sendEvent(res, {
      type: 'error',
      message: finishReason === 'SAFETY'
        ? 'Gemini could not respond to this request because of its safety settings.'
        : 'Gemini returned an empty response. Please try again.',
    });
  } else if (finishReason && !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(finishReason)) {
    sendEvent(res, { type: 'notice', message: `Response ended early (${finishReason.toLowerCase().replaceAll('_', ' ')}).` });
  }
  sendEvent(res, { type: 'done' });
}

export function createApp({ fetchImpl = globalThis.fetch, apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || DEFAULT_MODEL } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/config', (_req, res) => {
    res.json({ model, configured: Boolean(apiKey) });
  });

  app.post('/api/chat', async (req, res) => {
    const { messages, thinkingLevel = 'low' } = req.body || {};
    const validationError = validateMessages(messages);
    if (validationError) return res.status(400).json({ error: validationError });
    if (!THINKING_LEVELS.has(thinkingLevel)) return res.status(400).json({ error: 'Choose a valid thinking level.' });

    const browserKey = req.get('x-gemini-api-key')?.trim();
    const key = browserKey || apiKey;
    if (!key) return res.status(401).json({ error: 'Add a Gemini API key in Settings to start chatting.' });
    if (typeof key !== 'string' || key.length > 256 || /[\r\n]/.test(key)) {
      return res.status(400).json({ error: 'That API key does not look valid.' });
    }

    const controller = new AbortController();
    res.on('close', () => controller.abort());

    try {
      const upstream = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: messages.map(({ role, content }) => ({
              role: role === 'assistant' ? 'model' : 'user',
              parts: [{ text: content }],
            })),
            generationConfig: { thinkingConfig: { thinkingLevel } },
          }),
          signal: controller.signal,
        },
      );

      if (!upstream.ok) {
        const body = await upstream.json().catch(() => null);
        return res.status(upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502)
          .json({ error: providerError(upstream.status, body) });
      }
      if (!upstream.body) return res.status(502).json({ error: 'Gemini did not return a stream.' });

      res.set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders();
      await relayGeminiStream(upstream.body, res);
      res.end();
    } catch (error) {
      if (controller.signal.aborted) return;
      if (res.headersSent) {
        sendEvent(res, { type: 'error', message: 'The connection to Gemini was interrupted. Please retry.' });
        res.end();
      } else {
        res.status(502).json({ error: 'Could not reach Gemini. Please check your connection and try again.' });
      }
      if (process.env.NODE_ENV !== 'test') console.error('Gemini request failed:', error?.message);
    }
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'That message is too large.' });
    res.status(400).json({ error: 'Invalid request body.' });
  });

  return app;
}
