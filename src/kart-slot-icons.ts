import type {KartSlot} from './kart-build';

/** Original, local SVG drawings. Never interpolate catalog text into this markup. */
const svg = (drawing: string) => `<svg class="kart-slot-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${drawing}</svg>`;

/** Part silhouettes deliberately work without colour, emoji fonts or remote images. */
export const KART_SLOT_ICONS: Readonly<Record<KartSlot, string>> = Object.freeze({
  body: svg(`
    <path d="M6 40v-8l9-4 9-13h19l10 14 5 4v11h-8a7 7 0 0 0-14 0H23a7 7 0 0 0-14 0H6Z" fill="currentColor" fill-opacity=".24"/>
    <path d="m21 28 7-9h12l7 10-26-1Z" fill="currentColor" fill-opacity=".72" stroke-width="2"/>
    <path d="M6 35h7m37 0h8M27 34h5M18 49h29"/>
  `),
  chassis: svg(`
    <path d="m20 10 31 8-9 36-31-8 9-36Z" fill="currentColor" fill-opacity=".16"/>
    <path d="m23 17 19 5-6 25-19-5 6-25Z"/>
    <path d="m21 25 19 5m-21 5 19 5M9 16l47 12M5 38l47 12" stroke-width="4"/>
    <path d="m8 11-3 12m54-1-3 12M5 33 2 45m53-1-3 12" stroke-width="4"/>
  `),
  motor: svg(`
    <path d="M17 19h24c8 0 12 6 12 13s-4 13-12 13H17Z" fill="currentColor" fill-opacity=".24"/>
    <ellipse cx="17" cy="32" rx="8" ry="13" fill="currentColor" fill-opacity=".3"/>
    <path d="M3 32h14m36 0h8" stroke-width="5"/>
    <path d="M32 22v20m9-19v5m0 8v5M23 18v-5h7m-7 33v5h7"/>
  `),
  transmission: svg(`
    <path d="m23 8 3 5 6-1 2 6 6 2-1 6 4 4-4 5 1 6-6 2-2 6-6-1-3 5-6-3-5 2-4-5-6-1 1-7-3-4 4-5-1-6 6-2 2-6 6 1 4-4Z" transform="translate(3 -3) scale(.83)" fill="currentColor" fill-opacity=".26"/>
    <circle cx="22" cy="23" r="6"/>
    <path d="m46 29 3 4 5-1 2 5 5 2-1 5 3 4-4 4-1 5-5 1-3 4-5-2-5 1-2-5-5-2 1-5-3-4 4-4 1-5 5-1 3-4Z" transform="translate(6 3) scale(.83)" fill="currentColor" fill-opacity=".26"/>
    <circle cx="45" cy="41" r="5"/>
  `),
  battery: svg(`
    <path d="M16 17v-7h10v7m12 0v-7h10v7" fill="currentColor" fill-opacity=".55"/>
    <rect x="9" y="17" width="46" height="37" rx="5" fill="currentColor" fill-opacity=".22"/>
    <path d="M9 25h46M16 34h8m-4-4v8m21-4h7"/>
    <path d="m33 30-8 13h7l-2 9 10-14h-8Z" fill="currentColor" stroke-width="1.7"/>
  `),
  wheels: svg(`
    <path d="M24 9h14c11 0 19 10 19 23s-8 23-19 23H24" fill="currentColor" fill-opacity=".28"/>
    <ellipse cx="24" cy="32" rx="17" ry="23" fill="currentColor" fill-opacity=".18"/>
    <ellipse cx="24" cy="32" rx="9" ry="14" fill="currentColor" fill-opacity=".15"/>
    <ellipse cx="24" cy="32" rx="3" ry="5" fill="currentColor"/>
    <path d="m37 12 9 2m-4 6 9 2m-7 7 10 1m-10 9 10-1m-13 10 10-3"/>
  `),
});
