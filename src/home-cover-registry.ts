/** Only approved, shipped portraits participate. Pending art is never fetched. */
export type HomeCoverId = 'deepseek'|'gemini'|'gpt'|'claude'|'grok'|'glm';
export interface HomeCover {
 id:HomeCoverId;
 src:string;
 approved:boolean;
 /** Non-destructive portrait framing inside the shared title-stage box. */
 framing?:{scale:number;x:number;y:number};
 /** Present only after static approval, rig QA and runtime licensing review. */
 model?:string;
}
export const HOME_COVERS:readonly HomeCover[]=Object.freeze([
 {id:'deepseek',src:'./menu-art/whale-maid.png',approved:true},
 ...(['gemini','gpt','claude','grok','glm'] as const).map(id=>({id,src:`./menu-art/${id}-cover-v1.webp`,approved:true,framing:{scale:1.65,x:0,y:0}})),
]);
export const FALLBACK_HOME_COVER=HOME_COVERS[0];
export function chooseHomeCover(covers:readonly HomeCover[]=HOME_COVERS,random:()=>number=Math.random):HomeCover {
 const ready=covers.filter(cover=>cover.approved);
 if(!ready.length)return FALLBACK_HOME_COVER;
 const roll=random();
 const index=Number.isFinite(roll)?Math.min(ready.length-1,Math.max(0,Math.floor(roll*ready.length))):0;
 return ready[index];
}
const documentCovers=new WeakMap<Document,HomeCover>();
/** SPA return and menu remount preserve selection; a new document rolls again. */
export function getDocumentHomeCover(doc:Document):HomeCover {
 let cover=documentCovers.get(doc);
 if(!cover){cover=chooseHomeCover();documentCovers.set(doc,cover);}
 return cover;
}
