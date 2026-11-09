/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// خروجی build داخل همین پوشه (web/dist) ساخته می‌شود؛ محتوای آن باید در app/public/v2 کپی شود.
export default defineConfig({
  base: '/v2/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      // دو ورودی: برنامهٔ اصلی و «پنل مشتری» (/portal)
      input: { main: 'index.html', portal: 'portal.html' },
      output: {
        manualChunks: {
          antd: ['antd', '@ant-design/icons'],
          vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', '@tanstack/react-table', 'dayjs'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
