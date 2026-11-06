import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  server: { proxy: { '/api': 'http://127.0.0.1:8080' } },
  build: { assetsInlineLimit: 0 },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.js'],
  },
});
