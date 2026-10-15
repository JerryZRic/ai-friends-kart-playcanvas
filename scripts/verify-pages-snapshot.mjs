import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export function validateConfig(c){
 assert.equal(c.schemaVersion,1);assert.equal(c.repository,'JerryZRic/ai-friends-kart-playcanvas');
 assert.ok(['root','dev','cover-preview'].includes(c.target));
 const expectedBranch={root:'main',dev:'dev','cover-preview':'feature/home-portraits-live2d'}[c.target];assert.equal(c.sourceBranch,expectedBranch);
 for(const field of ['runId','artifactId','deploymentId'])assert.ok(Number.isSafeInteger(c.baseline[field])&&c.baseline[field]>0);
 assert.match(c.baseline.commit,/^[a-f0-9]{40}$/);assert.match(c.baseline.artifactDigest,/^sha256:[a-f0-9]{64}$/);
 assert.ok(['dev','feature/home-portraits-live2d','main'].includes(c.baseline.branch));
 assert.deepEqual(Object.keys(c.expectedRefs).sort(),['main','dev','feature/home-portraits-live2d'].sort());
 for(const [branch,sha] of Object.entries(c.expectedRefs)){if(branch===expectedBranch)assert.equal(sha,'CURRENT');else assert.match(sha,/^[a-f0-9]{40}$/);}
 return c;
}
export async function verifyPublishedBaseline(c,api,currentSha){
 const run=await api(`actions/runs/${c.baseline.runId}`);
 assert.equal(run.status,'completed','Baseline run is not complete');assert.equal(run.conclusion,'success','Baseline run did not succeed');
 assert.equal(run.head_sha,c.baseline.commit);assert.equal(run.head_branch,c.baseline.branch);
 const artifact=await api(`actions/artifacts/${c.baseline.artifactId}`);
 assert.equal(artifact.name,'github-pages');assert.equal(artifact.expired,false,'Baseline artifact expired');
 assert.equal(artifact.digest,c.baseline.artifactDigest);assert.equal(artifact.workflow_run.id,c.baseline.runId);assert.equal(artifact.workflow_run.head_sha,c.baseline.commit);
 const deployments=await api('deployments?environment=github-pages&per_page=100');
 for(const deployment of deployments){
  const statuses=await api(`deployments/${deployment.id}/statuses?per_page=100`);
  const newest=statuses[0]?.state;
  if(['queued','pending','in_progress','waiting'].includes(newest)||!newest){
   assert.equal(deployment.sha,currentSha,'Another Pages deployment is pending; refuse a potentially stale snapshot');
   continue;
  }
  if(newest==='success'||(newest==='inactive'&&statuses.some(s=>s.state==='success'))){
   assert.equal(deployment.id,c.baseline.deploymentId,'Latest successful Pages deployment changed; repin rather than roll back');
   assert.equal(deployment.sha,c.baseline.commit);
   const success=statuses.find(s=>s.state==='success');
   assert.ok(success?.log_url?.includes(`/actions/runs/${c.baseline.runId}/`),'Published deployment does not originate in pinned successful run');
   return;
  }
  // A newer failed/error deployment is never evidence of a successful publication.
 }
 throw new Error('No verifiable recent successful github-pages deployment');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const c=validateConfig(JSON.parse(await readFile('docs/pages-snapshot.json','utf8')));
 assert.equal(process.env.GITHUB_REPOSITORY,c.repository);
 assert.equal(process.env.GITHUB_REF,`refs/heads/${c.sourceBranch}`);
 const current=process.env.GITHUB_SHA;assert.match(current||'',/^[a-f0-9]{40}$/);
 for(const [branch,pin] of Object.entries(c.expectedRefs)){
  const actual=execFileSync('git',['ls-remote','origin',`refs/heads/${branch}`],{encoding:'utf8'}).trim().split(/\s+/)[0];
  assert.equal(actual,pin==='CURRENT'?current:pin,`${branch} moved; refresh exact input refs`);
 }
 assert.ok(process.env.GH_TOKEN,'Missing workflow token');
 const api=async path=>{
  const response=await fetch(`https://api.github.com/repos/${c.repository}/${path}`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(30000)});
  assert.ok(response.ok,`GitHub read ${path}: HTTP ${response.status}`);return response.json();
 };
 await verifyPublishedBaseline(c,api,current);console.log(`Verified ${c.target} input and published baseline ${c.baseline.commit}`);
}
