import {assertMenuPresentationDependency} from './menu-presentation-reviewed-revisions';
/** Bounded little-endian full-output archive. Candidate never writes a baseline. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {closeSync,existsSync,openSync,readFileSync,readSync,writeSync} from 'node:fs';
import {join} from 'node:path';
import {airfieldSha} from './airfield-enrichment-contract';
export const airfieldCameraExpectedPath='tests/fixtures/airfield-enrichment-camera-outputs.json';
export function airfieldCameraPlan(){
 const text=readFileSync('tests/helpers/airfield-enrichment-camera-frozen.json','utf8');assert.equal(airfieldSha(text),'3e9b75eef6f98647fbc3813ce5248d0a6805b7668bdc46626e79f7e3959c333a','Frozen camera inputs and protected dependency inventory');
 const plan=JSON.parse(text);
 for(const [path,sha]of Object.entries(plan.protected))assertMenuPresentationDependency(path,sha,airfieldSha(readFileSync(path)));
 assert.equal(airfieldSha(readFileSync('docs/airfield-enrichment-cameras.json')),plan.reviewViewsSha256);
 assert.equal(airfieldSha(readFileSync('tests/fixtures/airfield-enrichment-original-geometry.json')),plan.originalGeometryFixtureSha256);
 return plan;
}
export class AirfieldCameraRecords{
 private size=48;private buffer=Buffer.alloc(4096*48);private prior=Buffer.alloc(4096*48);private used=0;private fd:number;
 private outputs=createHash('sha256');private labels=createHash('sha256');private phaseOutputs=createHash('sha256');private phaseLabels=createHash('sha256');private phaseStart=0;private phaseName='';
 private phases:Record<string,unknown>={};private pendingLabels:string[]=[];
 rows=0;changedRows=0;changes:any[]=[];
 constructor(private baseline:boolean,run:string,suite:string){this.fd=openSync(join(run,'baseline-'+suite+'-outputs.bin'),baseline?'wx':'r');}
 begin(name:string){if(this.phaseName)this.endPhase();this.phaseName=name;this.phaseStart=this.rows;this.phaseOutputs=createHash('sha256');this.phaseLabels=createHash('sha256');}
 record(label:string,row:readonly number[]){
  assert.equal(row.length,6);assert.ok(row.every(Number.isFinite),label+' finite exact output');
  for(let i=0;i<6;i++)this.buffer.writeDoubleLE(row[i],this.used+i*8);
  const bytes=this.buffer.subarray(this.used,this.used+this.size);this.phaseOutputs.update(bytes);this.phaseLabels.update(label+'\n');this.labels.update(label+'\n');this.pendingLabels.push(label);this.used+=this.size;this.rows++;
  if(this.used===this.buffer.length)this.flush();
 }
 private flush(){
  if(!this.used)return;const bytes=this.buffer.subarray(0,this.used);this.outputs.update(bytes);
  if(this.baseline){let written=0;while(written<this.used)written+=writeSync(this.fd,bytes,written,this.used-written);}
  else{let read=0;while(read<this.used){const n=readSync(this.fd,this.prior,read,this.used-read,null);assert.ok(n>0,'Candidate produced more rows than immutable baseline');read+=n;}
   if(!bytes.equals(this.prior.subarray(0,this.used)))for(let offset=0;offset<this.used;offset+=this.size){const after=bytes.subarray(offset,offset+this.size),before=this.prior.subarray(offset,offset+this.size);if(after.equals(before))continue;this.changedRows++;if(this.changes.length<24)this.changes.push({row:this.rows-this.used/this.size+offset/this.size,label:this.pendingLabels[offset/this.size],before:Array.from({length:6},(_,i)=>before.readDoubleLE(i*8)),after:Array.from({length:6},(_,i)=>after.readDoubleLE(i*8))});}
  }this.used=0;this.pendingLabels=[];
 }
 private endPhase(){this.phases[this.phaseName]={rows:this.rows-this.phaseStart,outputSha256:this.phaseOutputs.digest('hex'),labelSha256:this.phaseLabels.digest('hex')};}
 finish(){if(this.phaseName)this.endPhase();this.flush();if(!this.baseline)assert.equal(readSync(this.fd,this.prior,0,1,null),0,'Candidate omitted baseline rows');closeSync(this.fd);return{encoding:'6 binary64 little-endian values per row, exact bytes including signed zero',rows:this.rows,outputSha256:this.outputs.digest('hex'),labelSha256:this.labels.digest('hex'),phases:this.phases,changedRows:this.changedRows,changes:this.changes};}
}
export function assertAirfieldCameraExpected(stage:string,suite:string,records:any){
 if(!existsSync(airfieldCameraExpectedPath)){assert.equal(stage,'baseline','Freeze immutable-original full-output digests before any candidate execution');return;}
 const frozenBytes=readFileSync(airfieldCameraExpectedPath,'utf8');assert.equal(airfieldSha(frozenBytes),'596e883062ddd1683ebae3f3aedfcdae4bf04e7faf8100af15003674a5b39f67','Independently frozen original binary64 output fixture remains exact');const expected=JSON.parse(frozenBytes);
 assert.equal(expected.baselineSourceSha256,'a5414a810f061a5cb4da169f9c8f5577d377c2e76fb6c7aa6dca0eaf80f99cb2');
 assert.deepEqual({rows:records.rows,outputSha256:records.outputSha256,labelSha256:records.labelSha256,phases:records.phases},expected[suite],'Every original full-output digest and row/input label count is frozen');
 assert.equal(records.changedRows,0,JSON.stringify(records.changes));
}
