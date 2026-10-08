/** Keyboard and touch are independent sources: releasing either cannot cancel the other. */
export function createWaterparkInput() {
  const keyboard = new Set<string>(), pointers = new Map<number, string>();
  return {
    keyDown(code: string) { keyboard.add(code); },
    keyUp(code: string) { keyboard.delete(code); },
    pointerDown(id: number, code: string) { pointers.set(id, code); },
    pointerUp(id: number) { pointers.delete(id); },
    pressed(code: string) { return keyboard.has(code) || [...pointers.values()].includes(code); },
    clear() { keyboard.clear(); pointers.clear(); },
  };
}

/** Menu controls keep native keyboard behavior; only the game surface drives. */
export function isWaterparkGameKeyTarget(target: EventTarget | null, canvas: HTMLCanvasElement) {
  if (target === canvas || target == null) return true;
  const element = target as HTMLElement;
  return element.tagName === 'BODY' || element.tagName === 'HTML';
}
