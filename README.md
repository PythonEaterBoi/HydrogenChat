# Hydrogen Chat

A warm, distraction-free chat space powered by **Gemini 4 Hydrogen**. Built with React, Vite, and a small Express server that streams responses from Google's Gemini API.

## Run locally

Requires Node.js 22.12+ (including the test runner).

```bash
npm install
cp .env.example .env
# Add your GEMINI_API_KEY to .env (optional if you prefer to enter it in the app)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). For a production build, run `npm run build && npm start`.

Get an API key from [Google AI Studio](https://aistudio.google.com/apikey). If you don't set `GEMINI_API_KEY` on the server, open **Settings** in the app and paste a key there. Keys entered in the app live in **session storage for that browser tab only**; they are sent to this server over the same-origin `/api/chat` request, then to Google. Never put a key in frontend source code or a `VITE_` environment variable. Use HTTPS in production.

The default model ID is `gemini-4-hydrogen`. You can override it with `GEMINI_MODEL` if your Gemini provider uses a different ID. The Gemini API must be available to your server; this sandbox may not allow outbound requests to Google, so live responses require running it in an environment with Google API access.

## Features

- Streaming multi-turn chat with stop and retry controls, Markdown and code blocks
- Quick, balanced, deep, and extra-deep thinking levels
- Locally saved conversations, search, rename, delete, and Markdown export
- Keyboard shortcuts: `Enter` to send, `Shift+Enter` for a new line, `⌘/Ctrl+K` to search, `⌘/Ctrl+O` for a new chat
- Responsive layout with a collapsible sidebar and an API-key connection flow

Conversations are saved in your browser's local storage; no chat database is used. Clearing your browser data removes them. If a server API key is configured, anyone who can reach the app can use it; add your own authentication and rate limiting before exposing a keyed deployment publicly.

## Checks

```bash
npm test
npm run build
```
