# Hydrogen Chat

A warm, distraction-free chat space powered by **Gemini 4 Hydrogen**. It is a fully static React + Vite app: the browser talks directly to Google's Gemini API, so it can be hosted on GitHub Pages with no server.

## Publish on GitHub Pages

1. Merge this code into `main`.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` (or run the **Deploy to GitHub Pages** workflow manually). The workflow in `.github/workflows/deploy.yml` tests, builds, and publishes the site.

The site will be live at `https://<username>.github.io/HydrogenChat/`. Asset paths are relative, so it also works on a custom domain without changes.

## Using the app

Open **Settings** and paste a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey). Each visitor uses their own key:

- The key is stored only in the visitor's browser and sent only to Google's Gemini API.
- By default it is forgotten when the tab closes; tick **Remember on this device** to keep it.
- Never put a key in the source code — everything in a GitHub Pages site is public.

The default model ID is `gemini-4-hydrogen`. If your key uses a different model name, change **Model ID** in Settings.

## Run locally

Requires Node.js 22.12+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test
npm run build      # outputs the static site to dist/
npm run preview    # serves the built site
```

## Features

- Streaming multi-turn chat with stop and retry controls, Markdown and code blocks
- Quick, balanced, deep, and extra-deep thinking levels
- Locally saved conversations, search, rename, delete, and Markdown export
- Keyboard shortcuts: `Enter` to send, `Shift+Enter` for a new line, `⌘/Ctrl+K` to search, `⌘/Ctrl+O` for a new chat
- Responsive layout with a collapsible sidebar

Conversations are saved in your browser's local storage; clearing your browser data removes them.
