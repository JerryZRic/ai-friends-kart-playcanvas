import {defineConfig} from 'vite';
export default defineConfig({base:'./',publicDir:false,build:{outDir:'dist-cover-preview',emptyOutDir:true,rollupOptions:{input:'cover-preview.html'}}});
