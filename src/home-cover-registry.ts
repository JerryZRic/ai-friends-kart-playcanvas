/** Only approved, shipped portraits participate. Pending art is never fetched. */
export type HomeCoverId = 'deepseek'|'gemini'|'gpt'|'claude'|'grok'|'glm';
export interface HomeCover {
 id:HomeCoverId;
 src:string;
 approved:boolean;
 /** Non-destructive portrait framing inside the shared title-stage box. */
 framing?:{scale:number;x:number;y:number};
 /** Approved custom 2D animation identifier; no Cubism runtime. */
 model?:string;
}
export const HOME_COVERS:readonly HomeCover[]=Object.freeze([
 {id:'deepseek',src:'./menu-art/whale-maid.png',approved:true,model:'whale-mesh-v1'},
 ...(['gemini','gpt','claude','grok','glm'] as const).map(id=>({id,src:`./menu-art/${id}-cover-v1.webp`,approved:true,model:`${id}-mesh-v1`,framing:{scale:1.65,x:0,y:0}})),
]);
export const FALLBACK_HOME_COVER=HOME_COVERS[0];
export function chooseHomeCover(covers:readonly HomeCover[]=HOME_COVERS,random:()=>number=Math.random):HomeCover {
 const ready=covers.filter(cover=>cover.approved);
 if(!ready.length)return FALLBACK_HOME_COVER;
 const sample=random();
 const roll=Number.isFinite(sample)?Math.min(1,Math.max(0,sample)):0;
 const whale=ready.find(cover=>cover.id==='deepseek');
 const others=ready.filter(cover=>cover.id!=='deepseek');
 if(whale&&(!others.length||roll<0.35))return whale;
 // Reserve 35% for the original portrait; divide the remainder by the
 // current eligible count so adding approved characters needs no weight edits.
 const pool=whale?others:ready;
 const normalized=whale?(roll-0.35)/0.65:roll;
 return pool[Math.min(pool.length-1,Math.floor(normalized*pool.length))];
}
const documentCovers=new WeakMap<Document,HomeCover>();
/** SPA return and menu remount preserve selection; a new document rolls again. */
export function getDocumentHomeCover(doc:Document):HomeCover {
 let cover=documentCovers.get(doc);
 if(!cover){cover=chooseHomeCover();documentCovers.set(doc,cover);}
 return cover;
}
