import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { target: 'es2022', sourcemap: true, rollupOptions: { input: { main: 'index.html', garage: 'garage.html', coast: 'coast.html', waterpark: 'waterpark.html', study: 'waterpark-study.html' } } } });
