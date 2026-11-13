// Talks to the Gemini API straight from the browser, so the app can be hosted
// as plain static files (GitHub Pages) with no server of its own.
export const DEFAULT_MODEL = 'gemini-4-hydrogen';
const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

const SYSTEM_INSTRUCTION = 'You are Hydrogen, a thoughtful AI assistant powered by Gemini 4 Hydrogen. Be warm, direct, and genuinely useful. Give clear answers without unnecessary preamble. When a question is ambiguous, make a reasonable assumption or ask a concise clarifying question. Use Markdown when it helps readability, and format code in fenced blocks with a language name. Be honest about uncertainty and never claim to have done something you have not done.';

function providerError(status, body, model) {
  const detail = body?.error?.message;
  if (status === 400 && /api key/i.test(detail || '')) return 'That Gemini API key was not accepted. Check your key and try again.';
  if (status === 400) return detail || 'Gemini could not process that request.';
  if (status === 401 || status === 403) return 'That Gemini API key was not accepted. Check your key and try again.';
  if (status === 404) return `The model “${model}” is not available for this API key. Check the model ID in Settings.`;
  if (status === 429) return 'Gemini is rate-limiting requests right now. Please wait a moment and retry.';
  if (status >= 500) return 'Gemini is temporarily unavailable. Please try again shortly.';
  return detail || `Gemini could not complete that request (${status}).`;
}

export async function streamReply({ messages, thinkingLevel, apiKey, model = DEFAULT_MODEL, signal, onDelta, onNotice }) {
  if (!apiKey) throw new Error('Add a Gemini API key in Settings to start chatting.');
  const modelId = (model || DEFAULT_MODEL).trim().replace(/^models\//, '');

  let response;
  try {
    response = await fetch(`${API_ROOT}/${encodeURIComponent(modelId)}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: messages.map(({ role, content }) => ({
          role: role === 'assistant' ? 'model' : 'user',
          parts: [{ text: content }],
        })),
        generationConfig: { thinkingConfig: { thinkingLevel } },
      }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Could not reach Gemini. Please check your connection and try again.');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(providerError(response.status, body, modelId));
  }
  if (!response.body) throw new Error('Your browser could not read the response stream.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sentText = false;
  let finishReason = '';
  let blockReason = '';

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
    if (payload.error) throw new Error(payload.error.message || 'Gemini could not complete that request.');
    if (payload.promptFeedback?.blockReason) blockReason = payload.promptFeedback.blockReason;

    const candidate = payload.candidates?.[0];
    const text = candidate?.content?.parts
      ?.filter((part) => typeof part.text === 'string' && !part.thought)
      .map((part) => part.text)
      .join('');
    if (text) { sentText = true; onDelta(text); }
    if (candidate?.finishReason) finishReason = candidate.finishReason;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop();
      for (const block of blocks) consume(block);
    }
    buffer += decoder.decode();
    if (buffer.trim()) consume(buffer);
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw error;
    if (error instanceof TypeError) throw new Error('The connection to Gemini was interrupted. Please retry.');
    throw error;
  } finally {
    reader.releaseLock();
  }

  if (!sentText) {
    throw new Error(finishReason === 'SAFETY' || blockReason
      ? 'Gemini could not respond to this request because of its safety settings.'
      : 'Gemini returned an empty response. Please try again.');
  }
  if (!finishReason) throw new Error('The response was interrupted. Please retry.');
  if (!['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(finishReason)) {
    onNotice?.(`Response ended early (${finishReason.toLowerCase().replaceAll('_', ' ')}).`);
  }
}
