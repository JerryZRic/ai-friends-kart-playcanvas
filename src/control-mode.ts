/** Shared input preference and primary-device classification; never UA/width based. */
export type ControlMode = 'auto' | 'touch' | 'desktop';
export type EffectiveControlMode = Exclude<ControlMode, 'auto'>;
export type ControlCapabilities = {touchPoints: number; coarse: boolean; fine: boolean; hover: boolean; anyCoarse: boolean; pointerMedia: boolean};
export const CONTROL_PREFERENCE_EVENT = 'racecontrolpreferencechange';
export const CONTROL_MODE_OPTIONS = '<option value="auto">自动识别</option><option value="touch">触屏按键</option><option value="desktop">键盘鼠标</option>';
const KEY = 'kart-control-mode';
const preferences = new WeakMap<Document, ControlMode>();
export const normalizeControlMode = (value: unknown): ControlMode => value === 'touch' || value === 'desktop' ? value : 'auto';
export function readControlPreference(win?: Window | null): ControlMode {
  try { return normalizeControlMode((win ?? globalThis.window)?.localStorage?.getItem(KEY)); } catch { return 'auto'; }
}
export function controlPreference(doc: Document) { return preferences.get(doc) ?? readControlPreference(doc.defaultView); }
export function setControlPreference(doc: Document, mode: ControlMode) {
  const preference = normalizeControlMode(mode); let saved = false;
  preferences.set(doc, preference);
  try { const storage = (doc.defaultView ?? globalThis.window)?.localStorage; if (storage) { storage.setItem(KEY, preference); saved = true; } } catch { /* Session preference remains usable. */ }
  doc.dispatchEvent?.(new CustomEvent(CONTROL_PREFERENCE_EVENT, {detail: {preference, saved}}));
  return saved;
}
export function bindControlPreferenceSelect(doc: Document, selector: HTMLSelectElement) {
  const sync = () => { selector.value = controlPreference(doc); };
  const change = () => setControlPreference(doc, normalizeControlMode(selector.value));
  sync(); selector.addEventListener('change', change); doc.addEventListener?.(CONTROL_PREFERENCE_EVENT, sync);
  return () => { selector.removeEventListener('change', change); doc.removeEventListener?.(CONTROL_PREFERENCE_EVENT, sync); };
}
export function resolveControlMode(preference: ControlMode, input: ControlCapabilities, observed: EffectiveControlMode | null = null): EffectiveControlMode {
  if (preference !== 'auto') return preference;
  if (observed) return observed;
  // A primary mouse/trackpad wins over a secondary touchscreen on hybrid PCs.
  if (input.fine && input.hover) return 'desktop';
  if (input.touchPoints > 0 && (input.coarse || (input.anyCoarse && !input.hover) || !input.pointerMedia)) return 'touch';
  return 'desktop';
}
