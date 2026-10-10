import test from 'node:test';
import assert from 'node:assert/strict';
import {KART_SLOTS} from '../src/kart-build';
import {KART_SLOT_ICONS} from '../src/kart-slot-icons';

test('every garage slot has its own original decorative SVG silhouette', () => {
  assert.deepEqual(Object.keys(KART_SLOT_ICONS), [...KART_SLOTS]);
  assert.equal(new Set(Object.values(KART_SLOT_ICONS)).size, 6);
  assert.ok(Object.isFrozen(KART_SLOT_ICONS));
  for (const slot of KART_SLOTS) {
    const icon = KART_SLOT_ICONS[slot];
    assert.match(icon, /^<svg /);
    assert.match(icon, /viewBox="0 0 64 64"/);
    assert.match(icon, /aria-hidden="true"/);
    assert.match(icon, /focusable="false"/);
    assert.match(icon, /stroke="currentColor"/);
    assert.match(icon, /<path /);
    assert.doesNotMatch(icon, /<(?:script|image|foreignObject|text)\b|\bon\w+=|\bhref=/i);
    assert.ok(icon.endsWith('</svg>'));
  }
});
