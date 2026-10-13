import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneForUrl} from '../src/scene-routes';
test('single document routes preserve queries and exclude external, source and lookalike paths',()=>{
 const base=new URL('https://example.test/dev/');
 for(const [page,kind] of [['index.html','menu'],['garage.html','garage'],['coast.html','land'],['waterpark.html','water']] as const){
  const url=new URL(page+'?map=snow&driver=glm&seed=77',base);assert.equal(sceneForUrl(url,base),kind);assert.equal(url.searchParams.get('seed'),'77');
 }
 assert.equal(sceneForUrl(base,base),'menu');
 for(const href of ['https://else.test/dev/index.html','https://example.test/other/index.html','https://example.test/dev/source.html','https://example.test/dev/sub/coast.html','https://example.test/dev/coast.html.exe'])assert.equal(sceneForUrl(new URL(href),base),undefined);
});
