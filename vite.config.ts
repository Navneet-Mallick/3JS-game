import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Split vendor chunks for better caching
        manualChunks: {
          three:    ['three'],
          cannon:   ['cannon-es'],
          stdlib:   ['three-stdlib'],
        },
      },
    },
  },
});
