import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog, defaultBuild, KART_SLOTS, validateBuild, type GarageState} from '../src/kart-build';
import {wholeCars, wholeCarForBuild, filterWholeCars, needsWholeCarConfirmation, sameKartBuild, copyWholeCarUndo} from '../src/kart-whole-cars';

test('whole cars are complete six-slot themes in numeric order and do not exclude individual mixing', () => {
 assert.equal(wholeCars.length, catalog.length / 6);
 assert.equal(new Set(wholeCars.map(car => car.id)).size, wholeCars.length);
 for (const car of wholeCars) {assert.ok(validateBuild(car.build)); assert.ok(KART_SLOTS.every(slot => catalog.find(part => part.id === car.build[slot])?.themeId === car.id)); assert.equal(wholeCarForBuild({...car.build})?.id, car.id);}
 assert.deepEqual(wholeCars.map(car => car.number), wholeCars.map(car => car.number).sort((a,b) => a-b));
 assert.equal(wholeCarForBuild(defaultBuild), undefined);
 assert.equal(filterWholeCars('NO SUCH CAR').length, 0);
 assert.ok(filterWholeCars(wholeCars[0].id.toUpperCase()).some(car => car.id === wholeCars[0].id));
});
test('applying a whole car protects unsaved mixed builds but browsing and unchanged builds need no confirmation', () => {
 const state: GarageState = {version: 1, activeBuild: {...defaultBuild}, namedBuilds: []};
 assert.equal(needsWholeCarConfirmation(state, wholeCars[0].build), true);
 assert.equal(needsWholeCarConfirmation(state, {...defaultBuild}), false);
 const saved = {...state, namedBuilds: [{id:'saved', name:'My mixed car', build:{...defaultBuild}}]};
 assert.equal(needsWholeCarConfirmation(saved, wholeCars[0].build), false);
 assert.equal(needsWholeCarConfirmation({...state, activeBuild:{...wholeCars[1].build}}, wholeCars[0].build), false);
 assert.deepEqual(state.activeBuild, defaultBuild);
});
test('undo snapshots restore exact six slots and workshop editing/filter context without aliasing', () => {
 const input = {build:{...defaultBuild}, comparison:{...wholeCars[0].build}, editingId:'mine', buildName:'  My mix  ', title:'Saved mix', description:'Description', slot:'wheels' as const, theme:wholeCars[2].id, query:'wheel', page:3};
 const snapshot = copyWholeCarUndo(input); input.build.body = wholeCars[0].build.body; input.comparison.motor = defaultBuild.motor;
 assert.ok(sameKartBuild(snapshot.build, defaultBuild)); assert.ok(sameKartBuild(snapshot.comparison, wholeCars[0].build));
 assert.equal(snapshot.editingId, 'mine'); assert.equal(snapshot.buildName, '  My mix  '); assert.equal(snapshot.theme, wholeCars[2].id); assert.equal(snapshot.page, 3);
});

test('whole-car UI keeps preview separate and protects save failure, cancellation and keyboard navigation', async () => {
 const {readFileSync} = await import('node:fs');
 const source = readFileSync('src/kart-garage.ts','utf8'), css = readFileSync('src/kart-whole-cars.css','utf8');
 assert.match(source, /data-garage-mode="cars"/); assert.match(source, /data-garage-mode="parts"/);
 assert.match(source, /点选只预览，不会替换你的搭配/);
 assert.doesNotMatch(source, /id="apply-theme"[^>]*disabled/);
 assert.doesNotMatch(source, /apply-theme.*toggleAttribute\('disabled'/);
 assert.match(source, /needsWholeCarConfirmation\(state, candidate.build\)/);
 assert.match(source, /if \(!saveGarageState\(result.state\)\).*尚未替换整车.*return;/);
 assert.match(source, /result.ok === false.*result.reason.*return;/);
 assert.match(source, /dialogOpener\?\.focus/); assert.match(source, /showModal\(\)/);
 assert.match(source, /compareBuild = \{\.\.\.restore.comparison\}/);
 assert.match(source, /current_free_test_visible|mode === 'cars' \? candidate.build : state.activeBuild/);
 assert.match(css, /canonical 1440 × 900/);
});
