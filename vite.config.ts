import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
});
