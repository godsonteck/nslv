import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Use root-relative assets in Vercel so SPA routes such as /login load the
  // same bundles as /. Keep relative paths for the packaged Electron app.
  base: process.env.VERCEL ? '/' : './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Ensure modules load without crossorigin attribute issues on file://
    // This is required for Electron packaged apps
    target: 'es2020',
    modulePreload: {
      polyfill: false,
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});

