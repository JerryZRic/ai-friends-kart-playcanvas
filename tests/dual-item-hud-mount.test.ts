import assert from 'node:assert/strict';
import test from 'node:test';
import {createRaceShell} from '../src/race-shell';
import {itemImage} from '../src/item-models';

/** Tiny DOM contract fixture: verifies created nodes and live selectors, not a screenshot. */
function fixture() {
  class Element extends EventTarget {
    id = ''; className = ''; type = ''; textContent = ''; hidden = false; disabled = false;
    dataset: Record<string, string> = {}; attrs: Record<string, string> = {}; style: Record<string, string> = {};
    children: Element[] = []; parentElement: Element | null = null; src = ''; alt = ''; markup = '';
    classList = {add() {}, remove() {}};
    setAttribute(name: string, value: string) { this.attrs[name] = value; }
    removeAttribute(name: string) { delete this.attrs[name]; if (name === 'src') this.src = ''; }
    appendChild(node: Element) {
      if (node.parentElement) node.parentElement.children = node.parentElement.children.filter(child => child !== node);
      node.parentElement = this; this.children.push(node); return node;
    }
    insertBefore(node: Element, before: Element) { node.parentElement = this; this.children.splice(this.children.indexOf(before), 0, node); }
    find(match: (node: Element) => boolean): Element | null {
      for (const node of this.children) { if (match(node)) return node; const found = node.find(match); if (found) return found; }
      return null;
    }
    querySelector(selector: string): Element | null {
      if (selector.startsWith('.')) return this.find(node => node.className === selector.slice(1));
      const action = selector.match(/^\[data-mobile-action="([^"]+)"\]$/)?.[1];
      return action ? this.find(node => node.dataset.mobileAction === action) : null;
    }
    set innerHTML(value: string) {
      this.markup = value; this.children = [];
      for (const match of value.matchAll(/<(?:img|span|strong|div)\b([^>]*)>/g)) {
        const node = new Element(), attrs = match[1];
        node.id = attrs.match(/\bid="([^"]+)"/)?.[1] ?? '';
        node.className = attrs.match(/\bclass="([^"]+)"/)?.[1] ?? '';
        node.hidden = /\bhidden\b/.test(attrs); this.appendChild(node);
      }
    }
    get innerHTML() { return this.markup; }
    focus() {}
  }
  const body = new Element(), bottom = body.appendChild(new Element()), primary = bottom.appendChild(new Element());
  primary.id = 'item'; primary.innerHTML = '<img id="itemImage" hidden><strong id="itemName"></strong><span id="itemHelp"></span>';
  for (const action of ['item', 'item-secondary']) {
    const button = body.appendChild(new Element()); button.dataset.mobileAction = action;
    button.innerHTML = '<img class="mobile-item-image" hidden><span class="mobile-item-symbol"></span><span class="mobile-item-label"></span>';
  }
  const doc = Object.assign(new EventTarget(), {
    body, createElement: () => new Element(), getElementById: (id: string) => body.find(node => node.id === id),
    querySelector: (selector: string) => body.querySelector(selector), querySelectorAll: () => [],
  });
  const shell = createRaceShell(doc as any, new Element() as any, {map: 'coast', driver: 'grok', music: null, audioFactory: () => null});
  return {shell, doc, body, bottom, primary, get: (id: string) => doc.getElementById(id)!, mobile: (action: string) => doc.querySelector(`[data-mobile-action="${action}"]`)!};
}

test('shell creates one fixed desktop slot pair before adapter click binding', () => {
  const f = fixture(), group = f.get('raceItemSlots'), secondary = f.get('item-secondary');
  assert.deepEqual(group.children.map(node => node.id), ['item', 'item-secondary']);
  assert.equal(group.parentElement, f.bottom); assert.equal(f.primary.parentElement, group);
  assert.equal(f.primary.attrs['aria-keyshortcuts'], 'E'); assert.equal(secondary.attrs['aria-keyshortcuts'], 'R');
  assert.equal(f.primary.type, 'button'); assert.equal(secondary.type, 'button');
  assert.ok(f.get('itemImageSecondary')); assert.ok(f.get('itemNameSecondary')); assert.ok(f.get('itemHelpSecondary'));
  f.shell.start(); f.shell.updateHUD({rank: 1, lap: 1, elapsed: 0, speed: 0, held: null, heldSecond: 'pulse'});
  assert.deepEqual(group.children.map(node => node.id), ['item', 'item-secondary']);
  assert.equal(f.primary.disabled, true); assert.equal(secondary.disabled, false);
  f.shell.dispose();
});

test('mobile HUD updates real icon children without replacing fixed E/R labels or using stale phase state', () => {
  const f = fixture(), snapshot = {rank: 1, lap: 1, elapsed: 0, speed: 0, held: 'boost' as const, heldSecond: 'shield' as const};
  f.shell.start(); f.shell.updateHUD(snapshot);
  const primary = f.mobile('item'), secondary = f.mobile('item-secondary');
  assert.equal(primary.querySelector('.mobile-item-image')!.src, itemImage('boost'));
  assert.equal(secondary.querySelector('.mobile-item-image')!.src, itemImage('shield'));
  assert.equal(primary.querySelector('.mobile-item-label')!.textContent, 'E 加速');
  assert.equal(secondary.querySelector('.mobile-item-label')!.textContent, 'R 护盾');
  f.shell.updateHUD({...snapshot, held: null});
  assert.equal(primary.disabled, true); assert.equal(primary.querySelector('.mobile-item-image')!.hidden, true);
  assert.equal(primary.querySelector('.mobile-item-symbol')!.hidden, false);
  assert.equal(secondary.disabled, false); assert.equal(secondary.querySelector('.mobile-item-label')!.textContent, 'R 护盾');
  f.shell.setPaused(true); assert.equal(primary.disabled, true); assert.equal(secondary.disabled, true);
  f.shell.setPaused(false); f.shell.updateHUD(snapshot); assert.equal(primary.disabled, false); assert.equal(secondary.disabled, false);
  f.shell.showMenu(); assert.equal(primary.disabled, true); assert.equal(secondary.disabled, true);
  f.shell.dispose();
});
