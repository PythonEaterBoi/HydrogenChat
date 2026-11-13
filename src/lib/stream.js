// Read the normalized SSE events sent by our own /api/chat endpoint.
export async function streamReply({ messages, thinkingLevel, apiKey, signal, onDelta, onNotice }) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-gemini-api-key': apiKey } : {}),
    },
    body: JSON.stringify({ messages, thinkingLevel }),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${response.status}).`);
  }
  if (!response.body) throw new Error('Your browser could not read the response stream.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;

  const consume = (block) => {
    const data = block.split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data) return;

    let event;
    try {
      event = JSON.parse(data);
    } catch {
      return;
    }
    if (event.type === 'delta') onDelta(event.text);
    if (event.type === 'notice') onNotice?.(event.message);
    if (event.type === 'error') throw new Error(event.message);
    if (event.type === 'done') completed = true;
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
    if (!completed) throw new Error('The response was interrupted. Please retry.');
  } finally {
    reader.releaseLock();
  }
}
