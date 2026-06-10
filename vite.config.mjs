import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// UI source ada di ui/, output build ke dist/
// API dev di-proxy ke server Express lokal di port 3000
export default defineConfig({
  root: 'ui',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
