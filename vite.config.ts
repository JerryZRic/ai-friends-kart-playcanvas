import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { target: 'es2022', sourcemap: true, rollupOptions: { input: { main: 'index.html', waterpark: 'waterpark.html', study: 'waterpark-study.html' } } } });
