import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { clipBrand, clipTemplates, REPO_ROOT_PATH } from './vite-clip.ts';

// The API server listens on 127.0.0.1:5292 in dev; the web dev server proxies to it so cookies stay same-origin.
const API = 'http://127.0.0.1:5292';

export default defineConfig({
  plugins: [react(), ...clipBrand(), clipTemplates()],
  server: {
    host: '127.0.0.1',
    fs: { allow: [REPO_ROOT_PATH] },
    proxy: { '/api': API, '/auth': API, '/healthz': API },
  },
  preview: { host: '127.0.0.1', proxy: { '/api': API, '/auth': API, '/healthz': API } },
  build: { target: 'es2022', sourcemap: true },
});
