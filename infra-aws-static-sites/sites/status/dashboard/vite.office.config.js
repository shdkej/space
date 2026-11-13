import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('./office', import.meta.url)),
  base: '/office/',
  plugins: [react()],
  build: { outDir: '../../dist/office', emptyOutDir: true },
});
