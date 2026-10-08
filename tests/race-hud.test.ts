import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountRaceHud,RACE_HUD_MARKUP} from '../src/race-hud';

const read=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const ids=(html:string)=>[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
const controls=['game','map','raceSubtitle','camera','sound','pause','raceSettings','rank','lap','timer','speed','charge','chargeLabel','item','itemImage','itemName','itemHelp','toast','count','lookHint','pausePanel','resumeRace','restartRace','pauseChangeMap','pauseMenu'];

test('both tracks use one shared HUD template and stylesheet with no duplicated gameplay IDs',()=>{
  for(const [page,entry] of [['coast.html','src/game.ts'],['waterpark.html','src/waterpark-play.ts']]){
    const html=read(page),combined=ids(html+RACE_HUD_MARKUP);
    assert.match(html,/<link rel="stylesheet" href="\/src\/race-ui.css">/);
    assert.match(html,/<div id="raceHud"><\/div>/);
    assert.doesNotMatch(html,/<style>/,'track pages cannot fork race interface CSS');
    for(const id of controls){
      assert.equal(combined.filter(value=>value===id).length,1,`${page}: ${id}`);
      assert.equal(ids(html).includes(id),false,`${page}: ${id} comes only from shared markup`);
    }
    assert.equal(new Set(combined).size,combined.length,`${page} has no duplicate IDs`);
    assert.match(read(entry),/mountRaceHud\(/,`${entry} mounts the canonical race UI`);
    for(const id of ['overlay','title','subtitle','desc','results','start','startText','raceMainMenu'])assert.ok(combined.includes(id),`${page}: ${id}`);
  }
  for(const key of ['ArrowLeft','ArrowRight','ShiftLeft','Space','KeyS','KeyW'])assert.match(RACE_HUD_MARKUP,new RegExp(`data-key="${key}"`));
  assert.match(RACE_HUD_MARKUP,/id="pausePanel"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(RACE_HUD_MARKUP,/id="itemImage"[^>]*hidden/);
});

test('mount applies map identity through text and keeps common controls intact',()=>{
  const elements=new Map<string,{textContent:string;attributes:Record<string,string>;setAttribute(name:string,value:string):void}>();
  const host={html:'',set innerHTML(value:string){this.html=value;for(const id of ids(value))elements.set(id,{textContent:'',attributes:{},setAttribute(name,value){this.attributes[name]=value;}});}};
  const doc={getElementById:(id:string)=>id==='raceHud'?host:elements.get(id)};
  const canvas=mountRaceHud({subtitle:'WATERPARK GRAND PRIX',canvasLabel:'水上乐园六人三圈竞速'},doc as unknown as Document);
  assert.equal(host.html,RACE_HUD_MARKUP);
  assert.equal(canvas,elements.get('game'));
  assert.equal(elements.get('raceSubtitle')!.textContent,'WATERPARK GRAND PRIX');
  assert.equal(elements.get('game')!.attributes['aria-label'],'水上乐园六人三圈竞速');
  for(const id of controls)assert.ok(elements.has(id));
  assert.throws(()=>mountRaceHud({subtitle:'',canvasLabel:''},{getElementById:()=>null} as unknown as Document),/Missing shared race HUD mount/);
});
