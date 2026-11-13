import 'dotenv/config';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import { createApp } from './app.js';

const app = createApp();
const server = createServer(app);
const port = Number(process.env.PORT) || 5173;

if (process.env.NODE_ENV === 'production') {
  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: { server },
      allowedHosts: ['.e2b.app'],
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

server.listen(port, '0.0.0.0', () => {
  console.log(`Hydrogen is ready at http://localhost:${port}`);
});
