import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {reconstructFoodKartPart} from '../../scripts/verify-food-kart-assets.mjs';

export const foodKartManifest = JSON.parse(readFileSync('public/models/food-karts/manifest.json', 'utf8'));

/** Parse the shipped theme ZIPs, never private source files or synthetic meshes.
 * The verifier bounds and caches ZIP reads and checks every reconstruction. */
export function foodKartFixtureBytes(part: any): ArrayBuffer {
  const bytes = reconstructFoodKartPart(foodKartManifest, part);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), part.originalSha256);
  return Uint8Array.from(bytes).buffer;
}
