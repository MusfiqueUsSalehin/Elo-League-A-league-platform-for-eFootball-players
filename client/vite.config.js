import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // The API is reached through the dev server, so the browser sees one origin
    // and the session cookie works exactly as it will in production.
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
  build: {
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    restoreMocks: true,
    // Worker threads instead of child processes: child workers crash on startup
    // on some Windows setups (exit code 0xC0000409), and threads are as fast here.
    pool: 'threads',
  },
});
