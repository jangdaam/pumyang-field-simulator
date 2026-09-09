import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: local('./github-pages'),
  base: '/pumyang-field-simulator/',
  publicDir: local('./public'),
  plugins: [react()],
  resolve: { alias: { 'next/image': local('./github-pages/image.tsx') } },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: local('./dist-pages'), emptyOutDir: true },
});
