import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // En desarrollo, las llamadas a /api van al servidor de FRIDAY.
  server: { proxy: { '/api': 'http://localhost:8787' } },
});
