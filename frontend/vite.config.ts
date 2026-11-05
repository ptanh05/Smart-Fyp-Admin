/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  let apiUrl = (env.VITE_API_BASE_URL || '').trim();

  if (apiUrl.includes('smart-fyp-admin-backend.onrender.com')) {
    apiUrl = apiUrl.replace('smart-fyp-admin-backend.onrender.com', 'smart-fyp-admin.onrender.com');
  }
  if (apiUrl.includes('smart-fyp-backend.onrender.com')) {
    apiUrl = apiUrl.replace('smart-fyp-backend.onrender.com', 'smart-fyp-admin.onrender.com');
  }

  const defaultProdApi = 'https://smart-fyp-admin.onrender.com/app';

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiUrl || (mode === 'production' ? defaultProdApi : 'http://localhost:8001/app')),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
    },
    server: {
      port: 5174,
      host: true,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
    },
  };
});
