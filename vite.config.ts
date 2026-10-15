import { defineConfig } from 'vite';
import {devBuildVersion} from './scripts/build-identity.ts';
export default defineConfig({ define: {__GAME_BUILD_VERSION__: JSON.stringify(devBuildVersion(process.env.DEV_BUILD_SHA, process.env.GAME_BUILD_CHANNEL))}, base: './', build: { target: 'es2022', sourcemap: true, rollupOptions: { input: { main: 'index.html', garage: 'garage.html', coast: 'coast.html', waterpark: 'waterpark.html', study: 'waterpark-study.html', balance: 'balance-lab.html' } } } });

