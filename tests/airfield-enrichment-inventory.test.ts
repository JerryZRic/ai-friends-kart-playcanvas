import {restorePostV100Buffer} from './helpers/post-v100-current';
import {postV100PortableClosure} from './helpers/post-v100-current';
import {menuPresentationSourcePaths,menuPresentationHash,restoreMenuPresentationBytes} from './helpers/menu-presentation-reviewed-revisions';
/** Immutable history and explicit Airfield-only incoming/reviewed output identities. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {airfieldSha as sha,airfieldFrozenBaseline,AIRFIELD_ORIGINAL_SOURCE_SHA256} from './helpers/airfield-enrichment-contract';
import {airfieldReviewedHash,airfieldReviewedPathsWithin,assertAirfieldReviewedBytes,AIRFIELD_REVIEWED_PATHS} from './helpers/airfield-enrichment-reviewed-revisions';
import {auditPublicationHash} from './helpers/audit-fixture-publication-revisions';
const raw=readFileSync('tests/fixtures/airfield-enrichment-original-inventory.json','utf8');assert.equal(sha(raw),'803c61344abe2f97fb9acaaf8c5960f64036938fff7e1248d8263e1db332b6cf');const original=JSON.parse(raw);
test('Airfield 870 independently frozen inputs and all13 original tests preserve exact historical bytes',()=>{
 assert.equal(original.baselineCommit,'fc5360139c00e0d60148afabd0d24ed85c272ed6');assert.equal(Object.keys(original.sourceInventory).length,870);
 assert.equal(sha(readFileSync('docs/scene-baselines/airfield-original/src/airfield-scenery.ts.txt')),AIRFIELD_ORIGINAL_SOURCE_SHA256);assert.deepEqual(airfieldFrozenBaseline().budget,{batches:20,triangles:94747,vertices:103278});
 const originals=Object.keys(original.sourceInventory).filter(p=>/^tests\/airfield-.*\.test\.ts$/.test(p));assert.equal(originals.length,13);for(const file of [...originals,'src/airfield-scenery.ts','docs/airfield-preview-provenance.json'])assert.equal(sha(readFileSync('docs/scene-baselines/airfield-original/'+file+'.txt')),original.sourceInventory[file]);
 for(const file of Object.keys(original.sourceInventory).filter(p=>p.startsWith('tests/fixtures/')||/enrichment-qa-files\.json$/.test(p)))assert.equal(sha(readFileSync(file)),auditPublicationHash(file,original.sourceInventory[file]),file+' exact historical bytes or explicitly pinned lossless transport revision');
});
test('Airfield restored historical assertions change only by the approved independently certified native ownership classification',()=>{
 const before=readFileSync('docs/scene-baselines/airfield-original/tests/airfield-gameplay.test.ts.txt','utf8');let expected="import {airfieldNativeBlockerComponents} from './helpers/airfield-enrichment-native-provenance';\n"+before;const start=expected.indexOf(' const componentRanges=new Map<any,any[]>();'),end=expected.indexOf('  let from=0;',start);assert.ok(start>=0&&end>start);expected=expected.slice(0,start)+" const componentRanges=new Map<any,any[]>(),certifiedBlockerComponents=airfieldNativeBlockerComponents(geometry);\n for(const solid of solids){\n  const components=certifiedBlockerComponents.get(solid)!;\n"+expected.slice(end);assert.equal(restorePostV100Buffer('tests/airfield-gameplay.test.ts',readFileSync('tests/airfield-gameplay.test.ts')).toString('utf8'),expected);
 for(const file of Object.keys(original.sourceInventory).filter(p=>/^tests\/airfield-.*\.test\.ts$/.test(p)&&p!=='tests/airfield-gameplay.test.ts'))assert.equal(restorePostV100Buffer(file,readFileSync(file)).toString('utf8'),readFileSync('docs/scene-baselines/airfield-original/'+file+'.txt','utf8'),file+' all original assertions, budgets and loops byte-identical');
});
test('Airfield review binds every current delta to exact immutable incoming bytes',()=>{
 const review=assertAirfieldReviewedBytes(readFileSync('tests/fixtures/airfield-enrichment-reviewed-changes.json','utf8')),changed:string[]=[];
 for(const [file,old]of Object.entries(original.sourceInventory)){const actual=sha(readFileSync(file));assert.equal(actual,airfieldReviewedHash(file,old),file+' exact current-or-original bytes');if(actual!==old)changed.push(file);}assert.deepEqual(changed.sort(),airfieldReviewedPathsWithin(original.sourceInventory).sort());
 assert.ok(review.certifiedIncomingAssertions.length>0);for(const row of review.certifiedIncomingAssertions){assert.ok(AIRFIELD_REVIEWED_PATHS.includes(row.path));assert.equal(row.incomingExpectedSha256,original.sourceInventory[row.path]);assert.ok(row.consumer);}
 const sourceFiles=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(dir+'/'+e.name):[dir+'/'+e.name]);assert.deepEqual(sourceFiles('src').filter(p=>!/^\.[a-z][a-z0-9-]+-\d+-[0-9a-f-]+\.ts$/.test(p.split('/').at(-1)!)).sort(),menuPresentationSourcePaths(original.sourceInventory).sort());
});
test('Airfield strict overlay rejects wrong incoming hashes,unlisted paths and tampered replacements',()=>{
 const text=readFileSync('tests/fixtures/airfield-enrichment-reviewed-changes.json','utf8'),review=assertAirfieldReviewedBytes(text),first=AIRFIELD_REVIEWED_PATHS[0];assert.ok(first);assert.throws(()=>airfieldReviewedHash(first,'0'.repeat(64)));
 const unlisted=structuredClone(review);unlisted.changes['src/unlisted-permission-bypass.ts']={previousSha256:'0'.repeat(64),currentSha256:'1'.repeat(64),scope:'unapproved'};assert.throws(()=>assertAirfieldReviewedBytes(JSON.stringify(unlisted)));
 const tampered=structuredClone(review);tampered.changes[first].currentSha256='f'.repeat(64);assert.throws(()=>assertAirfieldReviewedBytes(JSON.stringify(tampered)));
});
test('Airfield final manifest lists every actual source,retained test,baseline snapshot and QA/art dependency',()=>{
 const m=JSON.parse(readFileSync('docs/airfield-enrichment-qa-files.json','utf8'));assert.equal(m.state,'Final source and QA dependencies frozen');
 const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
 const excluded=(p:string)=>(p.startsWith('docs/qa/')&&/\.(png|jpg|webp)$/.test(p))||['public/assets/drivers/','public/assets/portraits/','public/models/food-karts/bundles/'].some(prefix=>p.startsWith(prefix));
 const exclusions=Object.fromEntries(Object.entries(original.sourceInventory).filter(([p])=>excluded(p)));assert.equal(Object.keys(exclusions).length,73);assert.deepEqual(m.excludedOriginalInputsSha256,exclusions);assert.deepEqual(m.originalInputCounts,{total:870,included:797,excluded:73});assert.deepEqual(m.portableOriginalSourceInputs,Object.keys(original.sourceInventory).filter(p=>!excluded(p)));for(const p of Object.keys(exclusions))assert.ok(!Object.hasOwn(m.finalFileSha256,p));for(const p of m.portableOriginalSourceInputs)assert.ok(Object.hasOwn(m.finalFileSha256,p));
 const required=[...walk('docs/scene-baselines/airfield-original'),...readdirSync('tests').filter(p=>p.startsWith('airfield-')&&p.endsWith('.test.ts')).map(p=>'tests/'+p),...readdirSync('tests/helpers').filter(p=>p.includes('airfield-enrichment')||p.startsWith('run-airfield-')).map(p=>'tests/helpers/'+p),...readdirSync('tests/fixtures').filter(p=>p.startsWith('airfield-enrichment-')).map(p=>'tests/fixtures/'+p),...readdirSync('scripts').filter(p=>p.includes('airfield-enrichment')||['verify-airfield-art-pixels.py','verify-airfield-visible-groups.py','verify-airfield-adjacent-pairs.py'].includes(p)).map(p=>'scripts/'+p)];
 postV100PortableClosure('airfield',m.finalFileSha256,required);for(const [p,h]of Object.entries(m.finalFileSha256))assert.equal(sha(readFileSync(p)),menuPresentationHash(p,h),p+' final exact source identity');
});

test('Airfield inherited consumers match the complete exact eleven-file transformation ledger',()=>{
 const bytes=readFileSync('tests/fixtures/airfield-enrichment-test-transformations.json','utf8');assert.equal(sha(bytes),'ff6b826d27bbb358bb3bc7c524e28771812719b086cae5c3440ca19c1c07a16f');const ledger=JSON.parse(bytes);assert.equal(ledger.files.length,11);
 for(const row of ledger.files){const text=restoreMenuPresentationBytes(row.path,readFileSync(row.path,'utf8'));assert.equal(sha(text),row.afterSha256);assert.equal(row.beforeSha256,original.sourceInventory[row.path]);const lines=text.match(/[^\n]*\n|[^\n]+$/g)??[];let offset=0;const ranges=row.hunks.map((h:any)=>{const at=h.startLine+offset;offset+=h.insertedLines.length-h.removedLines.length;return{...h,at};});for(const h of ranges.reverse()){assert.deepEqual(lines.slice(h.at,h.at+h.insertedLines.length),h.insertedLines);lines.splice(h.at,h.insertedLines.length,...h.removedLines);}assert.equal(sha(lines.join('')),row.beforeSha256,row.path+' exact inverse approved transformation');}
});
