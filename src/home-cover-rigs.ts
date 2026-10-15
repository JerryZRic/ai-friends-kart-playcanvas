/** Approved source-space rigs. Coordinates are normalized top-left; amplitudes are source pixels. */
export interface CoverLobe {x:number;y:number;rx:number;ry:number;amplitude:number;rate:number;phase:number;}
export interface CoverRig {
 model:string;src:string;width:number;height:number;
 breath:{x:number;y:number;rx:number;ry:number;lift:number;spread:number;period:number};
 hair:readonly CoverLobe[];
 blink?:{src:string;width:number;height:number;patches:readonly (readonly [number,number,number,number])[];feather:number};
}
export const WHALE_RIG:CoverRig={
 model:'whale-mesh-v1',src:'./menu-art/whale-maid.png',width:1181,height:1331,
 breath:{x:.465,y:.53,rx:.22,ry:.16,lift:1.8,spread:5,period:4.8},
 hair:[{x:.15,y:.57,rx:.14,ry:.30,amplitude:3.2,rate:1.55,phase:0},{x:.82,y:.54,rx:.17,ry:.31,amplitude:3.2,rate:1.43,phase:.7}],
 blink:{src:'./menu-art/whale-maid-eyes-closed.png',width:1181,height:1332,patches:[[418,334,532,427],[548,279,662,376]],feather:7},
};
const soft=(id:string,breath:Partial<CoverRig['breath']>,hair:readonly CoverLobe[]):CoverRig=>({
 model:`${id}-mesh-v1`,src:`./menu-art/${id}-cover-v1.webp`,width:1024,height:1536,
 breath:{x:.5,y:.37,rx:.09,ry:.065,lift:1.3,spread:3,period:5.2,...breath},hair,
});
const lock=(x:number,y:number,rx:number,ry:number,phase=0):CoverLobe=>({x,y,rx,ry,phase,amplitude:2.6,rate:1.25});
/** No invented eyelids: the five new portraits retain their approved open eyes. */
export const COVER_RIGS:readonly CoverRig[]=[WHALE_RIG,
 soft('gemini',{},[lock(.17,.39,.11,.13),lock(.81,.39,.12,.15,.6)]),
 soft('gpt',{x:.50,y:.37},[lock(.17,.44,.12,.15),lock(.82,.43,.12,.15,.8)]),
 soft('claude',{x:.55,y:.40,rx:.065,ry:.065},[lock(.17,.43,.10,.13),lock(.83,.43,.11,.16,.5)]),
 // The staff occupies the left side. Keep it rigid; only the opposite outer hair moves.
 soft('grok',{x:.51,y:.35,rx:.075,ry:.065},[lock(.84,.43,.105,.15,.7)]),
 // Keep the book/hands below the collar and both boots fixed.
 soft('glm',{x:.50,y:.30,rx:.065,ry:.035,lift:.9},[lock(.18,.43,.11,.13),lock(.82,.43,.11,.15,.4)]),
];
export function getCoverRig(model:string):CoverRig|undefined{return COVER_RIGS.find(rig=>rig.model===model);}
