import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Lay version that tu package.json o goc repo de badge UI khong bao gio lech.
let APP_VERSION = '2.0.0';
try {
  const pkgPath = path.resolve(process.cwd(), '..', 'package.json');
  APP_VERSION = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || APP_VERSION;
} catch (e) { /* build khong can package.json goc */ }

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://localhost:3600',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:3600',
        changeOrigin: true
      },
      '/health': {
        target: 'http://localhost:3600',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
