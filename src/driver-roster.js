// Stable slots for six distributed runtime characters and optional local replacements.
export const DRIVERS = Object.freeze([
  { id: 'whale', label: 'WHALE', color: '#77dcea' },
  { id: 'gemini', label: 'GEMINI', color: '#a5a4ff' },
  { id: 'gpt', label: 'GPT', color: '#f4e4c8' },
  { id: 'claude', label: 'CLAUDE', color: '#eeac8e' },
  { id: 'grok', label: 'GROK', color: '#b89bdb' },
  { id: 'glm', label: 'GLM', color: '#9cddad' },
].map(Object.freeze));
export const DEFAULT_DRIVER_ID = 'whale';
export function getDriver(id) { return DRIVERS.find(driver => driver.id === id) || DRIVERS[0]; }
export function raceOrder(selectedId = DEFAULT_DRIVER_ID) {
  const selected = getDriver(selectedId);
  return [selected, ...DRIVERS.filter(driver => driver.id !== selected.id)];
}
