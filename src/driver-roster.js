import {characterIdentity} from './character-identity.js';
// Stable slots for six distributed runtime characters and optional local replacements.
export const DRIVERS = Object.freeze([
  { id: 'whale', color: '#77dcea' },
  { id: 'gemini', color: '#a5a4ff' },
  { id: 'gpt', color: '#f4e4c8' },
  { id: 'claude', color: '#eeac8e' },
  { id: 'grok', color: '#b89bdb' },
  { id: 'glm', color: '#9cddad' },
].map(driver => Object.freeze({...driver,...characterIdentity(driver.id)})));
export const DEFAULT_DRIVER_ID = 'whale';
export function getDriver(id) { return DRIVERS.find(driver => driver.id === id) || DRIVERS[0]; }
export function raceOrder(selectedId = DEFAULT_DRIVER_ID) {
  const selected = getDriver(selectedId);
  return [selected, ...DRIVERS.filter(driver => driver.id !== selected.id)];
}
