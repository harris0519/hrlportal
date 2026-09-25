import { defineConfig } from 'vite';

export default defineConfig({
  base: '/hrlportal/',
  server: { proxy: { '/api': 'http://localhost:3001' } },
});
