import {postV100HistoricalScene} from './post-v100-historical-scene';
/** All safety acceptance below reads actual final indexed triangles. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {FOREST_COURSE} from '../../src/maps/forest';
import {buildForestSceneGeometry} from '../../src/forest-scenery';
import {instrumentForest,type ForestPrimitive} from './forest-enrichment-provenance';
import {forestProtectedContract,forestPrimitivePayload,forestDigest,forestFileDigest} from './forest-enrichment-contract';
import {MeshOracle,ComponentOracle,area3D,area,boundsOf,hullXZ,height,projectedInterval,clipPolygon,coincidentOutwardPolygon,subtractTerrainBurial,supportCoverage,hitFraction,lerp,cross2,type V} from './emitted-scene-oracle';
const [stage,run,ledger]=process.argv.slice(2),started=Date.now();assert.ok(['baseline','candidate'].includes(stage));process.env.FOREST_ENRICHMENT_INSTRUMENT_MANIFEST=ledger;
const receipt=JSON.parse(readFileSync('tests/fixtures/forest-enrichment-protected.json','utf8'));
const path=stage==='baseline'?'docs/scene-baselines/forest-scenery.ts.txt':'src/forest-scenery.ts',source=readFileSync(path,'utf8'),sourceSha256=forestFileDigest(source);
if(stage==='baseline')assert.equal(sourceSha256,receipt.originalScenerySha256);
const historical=stage==='baseline'?null:await postV100HistoricalScene('forest',true);
const scene=historical?.instrumented??await instrumentForest(source),g=scene.geometry,protection=forestProtectedContract(scene);
const identities=scene.components.map(c=>({id:c.id,phase:c.phase,hash:forestDigest(forestPrimitivePayload(scene,c))}));
if(stage==='baseline'){
 writeFileSync(join(run,'baseline-contract.json'),JSON.stringify({sourceSha256,protection,identities}));
 console.log(JSON.stringify({stage,sourceSha256,protectedComponents:protection.protectedParts.length,emittedComponents:identities.length}));
}else{
 const baseline=JSON.parse(readFileSync(join(run,'baseline-contract.json'),'utf8'));assert.equal(baseline.sourceSha256,receipt.originalScenerySha256);assert.deepEqual(protection,baseline.protection,'road, terrain, original landmarks, bridge, fork, route, textures and shared scene inputs stay byte-for-number exact');
 assert.equal(forestDigest(g),historical!.ordinaryGeometrySha256,'instrumentation cannot alter runtime buffers');
 const remaining=new Map<string,number>();for(const p of baseline.identities)remaining.set(p.hash,(remaining.get(p.hash)??0)+1);
 const changed=scene.components.filter(c=>{const hash=forestDigest(forestPrimitivePayload(scene,c)),count=remaining.get(hash)??0;if(count){remaining.set(hash,count-1);return false;}return true;});
 assert.ok(changed.length>0,'candidate must have an actual geometry change');assert.ok(changed.every(c=>['foliage','lowmass'].includes(c.phase)),'only ordinary cedar and low-mass geometry may differ');assert.ok(changed.filter(c=>c.phase==='lowmass').every(c=>/^woodland-(bank|bed)-/.test(c.kind)),'additional changed understory needs explicit emitted ownership and support audit');
 const counts={batches:g.batches.length,vertices:g.batches.reduce((n,b)=>n+b.positions.length/3,0),triangles:g.batches.reduce((n,b)=>n+b.indices.length/3,0),trees:g.trees.length};
 assert.equal(counts.batches,21);assert.equal(counts.trees,99);assert.ok(counts.vertices<200000&&counts.triangles<110000,JSON.stringify(counts));
 for(const b of g.batches){assert.equal(b.positions.length%3,0);assert.equal(b.uvs.length,b.positions.length/3*2);assert.equal(b.indices.length%3,0);assert.ok(b.positions.every(Number.isFinite)&&b.uvs.every(Number.isFinite));assert.ok(b.indices.every(i=>Number.isInteger(i)&&i>=0&&i<b.positions.length/3));}
 const mesh=new MeshOracle(g.batches),parts=new ComponentOracle(mesh,scene.components),changedSet=new Set(changed),changedFaces=mesh.triangles.filter(q=>changedSet.has(parts.owner.get(q.id) as ForestPrimitive));
 assert.equal(parts.owner.size,counts.triangles);assert.ok(changedFaces.every(q=>area3D([q.a,q.b,q.c])>1e-10),'changed faces must have nonzero area');
 const terrainIds=new Set(mesh.triangles.filter(q=>q.batch==='Forest connected moss ridge terrain').map(q=>q.id));
 const groundAt=(p:V)=>{const q=mesh.query(p,p).find(q=>terrainIds.has(q.id)&&projectedInterval(q,p,p));assert.ok(q,'actual emitted terrain must cover point '+p);return height(q,p[0],p[2]);};
 let treeVertices=0,rootFootprints=0,cameraVertices=0;
 for(const [index,scope]of scene.scopes.filter(s=>s.kind==='tree').entries()){
  const tree=g.trees[index];assert.ok(tree);const members=scene.components.filter(c=>c.scope===scope.id),points=members.flatMap(c=>parts.points(c));assert.ok(points.length);
  for(const p of points){assert.ok(Math.hypot(p[0]-tree.position[0],p[2]-tree.position[2])<=tree.radius+1e-7,`tree ${index} emitted crown/root exceeds declared radius`);treeVertices++;}
  if(index<9)continue;assert.equal(members.filter(c=>c.method==='cedarCrown').length,scope.args[5]?5:3,'each ordinary tree owns its complete coherent crown layers');
  const trunk=members.find(c=>c.kind==='cedar-tapered-trunk');assert.ok(trunk);
  for(const c of members){
   if(c.method==='cedarCrown')assert.ok(parts.closedShell(c),'coherent crown is a closed consistently wound indexed shell');
   if(c.kind==='cedar-opaque-bough-fan'||c.method==='cedarCrown')assert.ok(parts.attachment(c,trunk)||members.some(branch=>branch.kind==='cedar-visible-bough-branch'&&parts.attachment(c,branch)),'new foliage must remain physically attached to its own trunk or branch');
   const b=g.batches.find(b=>b.name===c.batch)!;
   if(c.kind==='cedar-tapered-trunk'||c.kind==='cedar-grounded-root'){
    const path=c.args[2] as number[][],sides=c.args[4]??8,ring=c.kind==='cedar-tapered-trunk'?0:path.length-1;
    const foot=Array.from({length:sides},(_,i)=>b.positions.slice((c.vertexStart+ring*sides+i)*3,(c.vertexStart+ring*sides+i+1)*3));
    for(const p of foot)assert.ok(p[1]<groundAt(p)-.099999,c.kind+' complete emitted ring is grounded');
    const polygon=hullXZ(foot),coverage=supportCoverage(mesh,polygon,(q,overlap)=>terrainIds.has(q.id)&&overlap.every(p=>p[1]<height(q,p[0],p[2])-.099999));
    assert.ok(coverage.uncovered<1e-7,c.kind+' full emitted root footprint floats or leaves terrain');rootFootprints++;
   }
   for(const p of parts.points(c)){
    assert.ok(g.cameraObstacles.some(o=>!o.heightfield&&p.every((v,k)=>v>=o.min[k]-1e-8&&v<=o.max[k]+1e-8)),`${c.kind} emitted tree surface lacks camera coverage`);cameraVertices++;
   }
  }
 }
 assert.equal(scene.scopes.filter(s=>s.kind==='tree').length,99);
 let bankFootprints=0,bedFootprints=0,bankTerrainCells=0,bankCameraFaces=0,bedTopFaces=0,intentionalBedTreeContacts=0,intentionalBoundaryBaseContacts=0;const bankIntersections:any[]=[];
 const roadNames=new Set(['Forest packed cedar needle road','Forest observatory service stone']);
 const pointRoadDistance=(p:V,q:{a:V;b:V;c:V})=>{if(projectedInterval(q as any,p,p))return 0;return Math.min(...[q.a,q.b,q.c].map((a,i,points)=>{const b=points[(i+1)%3],dx=b[0]-a[0],dz=b[2]-a[2],u=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-u*dx,p[2]-a[2]-u*dz);}));};
 const masses=[...g.woodlandBanks,...g.woodlandBeds];assert.equal(g.props.filter(p=>p.kind.startsWith('woodland-')).length,masses.length);assert.equal(new Set(masses.map(b=>b.id)).size,masses.length);
 for(const bank of masses){
  const isBed='ownedTreeSeeds' in bank;
  const c=scene.components.find(c=>c.batch===bank.batch&&c.vertexStart===bank.vertexStart&&c.vertexEnd===bank.vertexEnd);assert.ok(c,'bank needs exact independent indexed ownership');
  assert.equal(c.indexStart,bank.indexStart);assert.equal(c.indexEnd,bank.indexEnd);if(!isBed)assert.equal(c.indexEnd-c.indexStart,90);assert.ok(parts.closedShell(c),'bank indexed mesh must be a closed consistently wound shell');
  const qs=parts.triangles.get(c)!,points=parts.points(c),bounds=boundsOf(points);assert.deepEqual(bounds,{min:bank.min,max:bank.max});
  const prop=g.props.find(p=>p.kind===bank.id);assert.ok(prop);assert.equal(prop.radius,bank.radius);
  for(const p of points)assert.ok(Math.hypot(p[0]-prop.x,p[2]-prop.z)<=bank.radius+1e-8,'complete indexed bank exceeds radius');
  const lower=points.filter(p=>Math.abs(p[1]-bank.bottom)<1e-9),footprint=hullXZ(lower);assert.equal(footprint.length,8);const authoredFootprint=hullXZ(bank.footprint);assert.equal(authoredFootprint.length,footprint.length);for(let i=0;i<footprint.length;i++)assert.ok(Math.hypot(authoredFootprint[i][0]-footprint[i][0],authoredFootprint[i][2]-footprint[i][2])<1e-8,'clipped indexed footprint agrees within10nanometres');
  let low=Infinity,high=-Infinity;const coverage=supportCoverage(mesh,footprint,(q,overlap)=>{if(!terrainIds.has(q.id))return false;bankTerrainCells++;for(const p of overlap){const y=height(q,p[0],p[2]);low=Math.min(low,y);high=Math.max(high,y);assert.ok(bank.bottom<y-.499999,'complete indexed bank base must be buried');}return true;});
  assert.ok(coverage.uncovered<1e-7,'bank complete base leaves emitted terrain');assert.ok(Math.abs(low-bank.terrainLow)<1e-7&&Math.abs(high-bank.terrainHigh)<1e-7,'authored extrema match actual clipped terrain');if(isBed)bedFootprints++;else bankFootprints++;
  const center=[prop.x,prop.y,prop.z];for(const q of mesh.query(center,center,prop.radius+5))if(roadNames.has(q.batch))assert.ok(pointRoadDistance(center,q)>prop.radius+4.999,'bank full emitted radius retains 5m road buffer');
  const blockers=g.cameraObstacles.filter(o=>o.kind===bank.id);assert.equal(blockers.length,1);assert.deepEqual(blockers[0].triangles,qs.map(q=>[q.a,q.b,q.c]));assert.deepEqual({min:blockers[0].min,max:blockers[0].max},bounds);bankCameraFaces+=qs.length;
  const ownedParts=new Set<ForestPrimitive>();
  if(isBed){
   const seeds=bank.ownedTreeSeeds as number[];assert.equal(new Set(seeds).size,seeds.length);assert.ok(seeds.length>0,'bed must anchor an explicitly owned ordinary tree');
   const ordinary=scene.scopes.filter(s=>s.kind==='tree').slice(9),inside=(p:V)=>footprint.every((a,i)=>cross2(a,footprint[(i+1)%footprint.length],p)>=1e-7);
   assert.deepEqual([...seeds].sort((a,b)=>a-b),ordinary.filter(s=>inside(s.args[0])).map(s=>s.args[3]).sort((a,b)=>a-b),'bed ownership lists exactly its actual interior ordinary trees');
   for(const seed of seeds){const owned=ordinary.filter(s=>s.args[3]===seed);assert.equal(owned.length,1,'one exact ordinary tree owner');const members=scene.components.filter(p=>p.scope===owned[0].id&&['cedar-tapered-trunk','cedar-grounded-root'].includes(p.kind));assert.ok(members.some(p=>parts.attachment(c,p)),'bed needs actual indexed contact or enclosure with its owned trunk/root');for(const part of members)ownedParts.add(part);intentionalBedTreeContacts++;}
   const rootContacts=(bank as any).ownedRootContacts??[];const contactKeys=new Set<string>();
   for(const contact of rootContacts){
    const owned=ordinary.filter(s=>s.args[3]===contact.treeSeed);assert.equal(owned.length,1,'boundary contact must name one actual ordinary tree seed');
    assert.ok(['cedar-tapered-trunk','cedar-grounded-root'].includes(contact.kind),'boundary ownership is restricted to the identified grounded tree base');const matches=scene.components.filter(p=>p.scope===owned[0].id&&p.kind===contact.kind&&p.batch===contact.batch&&p.vertexStart===contact.vertexStart&&p.vertexEnd===contact.vertexEnd&&p.indexStart===contact.indexStart&&p.indexEnd===contact.indexEnd);assert.equal(matches.length,1,'boundary contact identifies one exact final indexed trunk/root base member');
    const member=matches[0],key=member.batch+':'+member.indexStart;assert.ok(!contactKeys.has(key));contactKeys.add(key);assert.ok(!ownedParts.has(member),'boundary contact cannot duplicate full-tree ownership');assert.ok(parts.attachment(c,member),'exact boundary base member has actual indexed contact with bed');ownedParts.add(member);intentionalBoundaryBaseContacts++;
   }
   const top=qs.filter(q=>[q.a,q.b,q.c].every(p=>p[1]>bank.bottom+1e-7));assert.ok(top.length>0);const topIds=new Set(top.map(q=>q.id));
   const topCoverage=supportCoverage(mesh,footprint,q=>topIds.has(q.id));assert.ok(topCoverage.uncovered<1e-7,'bed closed top covers its complete footprint');
   for(const q of top){let covered=0;for(const ground of mesh.query(q.min,q.max)){if(!terrainIds.has(ground.id))continue;const overlap=clipPolygon([q.a,q.b,q.c],ground);if(area(overlap)<1e-10)continue;covered+=area(overlap);for(const p of overlap){const gap=p[1]-height(ground,p[0],p[2]);assert.ok(gap>=.049999&&gap<=.600001,'every emitted bed top stays positively separated from unchanged terrain');}}assert.ok(Math.abs(covered-area([q.a,q.b,q.c]))<1e-6,'entire bed top is grounded over real terrain');bedTopFaces++;}
  }
  for(const q of qs)for(const other of mesh.query(q.min,q.max)){
   if(parts.owner.get(other.id)===c||ownedParts.has(parts.owner.get(other.id) as ForestPrimitive)||terrainIds.has(other.id)||other.min.some((n,k)=>n>q.max[k]+1e-8)||other.max.some((n,k)=>n<q.min[k]-1e-8))continue;
   const intersections:V[]=[];
   for(const [a,b]of [[q.a,q.b],[q.b,q.c],[q.c,q.a]]){const t=hitFraction(other,a,b);if(t!==null)intersections.push(lerp(a,b,t));}
   for(const [a,b]of [[other.a,other.b],[other.b,other.c],[other.c,other.a]]){const t=hitFraction(q,a,b);if(t!==null)intersections.push(lerp(a,b,t));}
   if(intersections.some(p=>p[1]>groundAt(p)+1e-6))bankIntersections.push({bank:bank.id,face:q.id,other:other.id,batch:other.batch,otherComponent:parts.owner.get(other.id)?.kind,scope:(parts.owner.get(other.id) as ForestPrimitive)?.scope,reason:'exposed indexed surface crossing'});
  }
  for(const other of mesh.query(bounds.min,bounds.max))if(parts.owner.get(other.id)!==c&&!ownedParts.has(parts.owner.get(other.id) as ForestPrimitive)&&!terrainIds.has(other.id)&&[other.a,other.b,other.c].some(p=>p[1]>groundAt(p)+1e-6&&parts.inside(p,c)))bankIntersections.push({bank:bank.id,other:other.id,batch:other.batch,otherComponent:parts.owner.get(other.id)?.kind,scope:(parts.owner.get(other.id) as ForestPrimitive)?.scope,reason:'unrelated exposed source surface enclosed inside bank'});
 }
 assert.ok(bankFootprints>0&&bankFootprints<=12);assert.ok(bedFootprints>0&&bedFootprints<=4);const contactSummary=[...new Map(bankIntersections.map(q=>[q.bank+'|'+q.scope+'|'+q.otherComponent+'|'+q.reason,q])).values()];assert.deepEqual(contactSummary.slice(0,12),[],'new banks cannot penetrate or enclose unrelated exposed source geometry');
 let coflushPairs=0;const duplicates:any[]=[];
 for(const q of changedFaces)for(const other of mesh.query(q.min,q.max)){
  if(other.id<=q.id&&changedSet.has(parts.owner.get(other.id) as ForestPrimitive)||other.id===q.id||other.min.some((n,k)=>n>q.max[k]+1e-7)||other.max.some((n,k)=>n<q.min[k]-1e-7))continue;
  const overlap=coincidentOutwardPolygon(q,other)??coincidentOutwardPolygon(q,{...other,b:other.c,c:other.b});if(!overlap||area3D(overlap.polygon)<1e-7)continue;coflushPairs++;
  const exposed=subtractTerrainBurial(mesh,terrainIds,overlap.polygon).reduce((n,p)=>n+area3D(p),0);
  if(exposed>1e-7)duplicates.push({face:q.id,other:other.id,component:parts.owner.get(q.id)?.kind,otherComponent:parts.owner.get(other.id)?.kind,exposed});
 }
 assert.deepEqual(duplicates.slice(0,12),[],'changed surfaces have positive-area exposed duplicate skins');
 const report={auditScope:historical!.auditScope,executedSourceSha256:historical!.executedSourceSha256,sourceSha256,baselineSourceSha256:baseline.sourceSha256,counts,protectedComponents:protection.protectedParts.length,emittedComponents:scene.components.length,changedComponents:changed.length,changedFaces:changedFaces.length,treeVertices,rootFootprints,cameraVertices,bankFootprints,bedFootprints,bankTerrainCells,bankCameraFaces,bedTopFaces,intentionalBedTreeContacts,intentionalBoundaryBaseContacts,coflushPairs,durationSeconds:(Date.now()-started)/1000,maxRSSKiB:process.resourceUsage().maxRSS,limitations:['CPU indexed source geometry; no GPU, browser, native vehicle or performance claim','Camera coverage uses conservative source blocker volumes; separate whole-boom checks use actual indexed triangles','Exact original protected geometry is unchanged; unrelated original contacts are not re-certified']};
 assert.equal(forestFileDigest(readFileSync(path)),sourceSha256,'source stayed stable during audit');writeFileSync(join(run,'candidate-report.json'),JSON.stringify(report));
 if(process.env.FOREST_ENRICHMENT_AUDIT_DIR){mkdirSync(process.env.FOREST_ENRICHMENT_AUDIT_DIR,{recursive:true});writeFileSync(join(process.env.FOREST_ENRICHMENT_AUDIT_DIR,'geometry-report.json'),JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify(report));
}
