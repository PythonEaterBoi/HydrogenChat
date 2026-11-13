// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import App from './App.jsx';

function streamedResponse(text) {
  const bytes = new TextEncoder().encode(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] })}\n\n`);
  return {
    ok: true,
    body: new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }),
  };
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  vi.stubGlobal('requestAnimationFrame', (callback) => setTimeout(callback, 0));
  vi.stubGlobal('fetch', vi.fn(async () => streamedResponse('Hello from Gemini!')));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('chat interface', () => {
  it('lets a user connect a session key and send a streaming message', async () => {
    render(<App />);
    expect(screen.getByText(/What’s on your mind/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Write & refine/ }));
    expect(screen.getByRole('textbox', { name: 'Message Hydrogen' }).value).toContain('thoughtful');
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(screen.getByRole('dialog', { name: /Make this space yours/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Your API key'), { target: { value: 'my-session-key' } });
    fireEvent.click(screen.getByRole('button', { name: /Save preferences/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(screen.getByText('Hello from Gemini!')).toBeInTheDocument());
    expect(sessionStorage.getItem('hydrogen.session-key.v1')).toBe('my-session-key');
    expect(localStorage.getItem('hydrogen.remembered-key.v1')).toBeNull();
    const post = fetch.mock.calls[0];
    expect(post[0]).toContain('generativelanguage.googleapis.com/v1beta/models/gemini-4-hydrogen:streamGenerateContent');
    expect(post[1].headers['x-goog-api-key']).toBe('my-session-key');
    expect(JSON.parse(post[1].body).contents[0].parts[0].text).toContain('thoughtful');
  });

  it('opens settings and search from the sidebar', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Search conversations/ }));
    expect(screen.getByRole('dialog', { name: 'Search conversations' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close search' }));
    fireEvent.click(screen.getByRole('button', { name: /Personal workspace/ }));
    expect(screen.getByRole('dialog', { name: /Make this space yours/ })).toBeInTheDocument();
  });

  it('can rename, search, and delete a conversation', async () => {
    sessionStorage.setItem('hydrogen.session-key.v1', 'test-key');
    render(<App />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Message Hydrogen' }), { target: { value: 'Help me plan a trip' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(screen.getByText('Hello from Gemini!')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /More options for Help me plan a trip/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const rename = screen.getByRole('textbox', { name: 'Rename conversation' });
    fireEvent.change(rename, { target: { value: 'My travel plans' } });
    fireEvent.keyDown(rename, { key: 'Enter' });
    expect(screen.getByRole('button', { name: /More options for My travel plans/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Search conversations/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search your conversations' }), { target: { value: 'travel' } });
    expect(within(screen.getByRole('dialog', { name: 'Search conversations' })).getByRole('button', { name: 'My travel plans' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close search' }));
    fireEvent.click(screen.getByRole('button', { name: /More options for My travel plans/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByRole('dialog', { name: 'Delete this conversation?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete conversation' }));
    expect(screen.getByText(/Your chats will find a home here/)).toBeInTheDocument();
  });

  it('keeps the prompt and offers retry when Gemini rejects a request', async () => {
    sessionStorage.setItem('hydrogen.session-key.v1', 'wrong-key');
    let attempts = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      attempts++;
      return attempts === 1
        ? { ok: false, status: 403, json: async () => ({ error: { message: 'denied' } }) }
        : streamedResponse('It works now.');
    }));
    render(<App />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Message Hydrogen' }), { target: { value: 'Tell me a story' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(screen.getByText(/API key was not accepted/)).toBeInTheDocument());
    expect(document.querySelector('.user-bubble')).toHaveTextContent('Tell me a story');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText('It works now.')).toBeInTheDocument());
    expect(attempts).toBe(2);
  });

  it('can remember the key on this device and use a custom model ID', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Personal workspace/ }));
    fireEvent.change(screen.getByLabelText('Your API key'), { target: { value: 'kept-key' } });
    fireEvent.click(screen.getByLabelText('Remember on this device'));
    fireEvent.change(screen.getByLabelText('Model ID'), { target: { value: 'my-model' } });
    fireEvent.click(screen.getByRole('button', { name: /Save preferences/ }));
    expect(localStorage.getItem('hydrogen.remembered-key.v1')).toBe('kept-key');
    expect(sessionStorage.getItem('hydrogen.session-key.v1')).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: 'Message Hydrogen' }), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(screen.getByText('Hello from Gemini!')).toBeInTheDocument());
    expect(fetch.mock.calls[0][0]).toContain('/models/my-model:streamGenerateContent');
    expect(fetch.mock.calls[0][1].headers['x-goog-api-key']).toBe('kept-key');
  });
});
