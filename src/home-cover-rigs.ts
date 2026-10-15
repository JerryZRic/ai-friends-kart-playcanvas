/** Approved source-space rigs. Coordinates are normalized top-left; amplitudes are source pixels. */
export interface CoverLobe {x:number;y:number;rx:number;ry:number;amplitude:number;rate:number;phase:number;}
export interface CoverBlinkTiming {period:number;offset:number;close:number;hold:number;open:number;}
export const DEFAULT_BLINK_TIMING:CoverBlinkTiming={period:4,offset:1.1,close:.06,hold:.11,open:.09};
export interface CoverRig {
 model:string;src:string;width:number;height:number;
 breath:{x:number;y:number;rx:number;ry:number;lift:number;spread:number;period:number};
 hair:readonly CoverLobe[];
 blink?:{src:string;width:number;height:number;patches:readonly (readonly [number,number,number,number])[];feather:number;timing?:CoverBlinkTiming};
}
export const WHALE_RIG:CoverRig={
 model:'whale-mesh-v1',src:'./menu-art/whale-maid.png',width:1181,height:1331,
 breath:{x:.465,y:.53,rx:.22,ry:.16,lift:1.8,spread:5,period:4.8},
 hair:[{x:.15,y:.57,rx:.14,ry:.30,amplitude:3.2,rate:1.55,phase:0},{x:.82,y:.54,rx:.17,ry:.31,amplitude:3.2,rate:1.43,phase:.7}],
 blink:{src:'./menu-art/whale-maid-eyes-closed.png',width:1181,height:1332,patches:[[418,334,532,427],[548,279,662,376]],feather:7},
};
const soft=(id:string,breath:Partial<CoverRig['breath']>,hair:readonly CoverLobe[]):CoverRig=>({
 model:`${id}-mesh-v1`,src:`./menu-art/${id}-cover-v1.webp`,width:1024,height:1536,
 breath:{x:.5,y:.37,rx:.09,ry:.065,lift:3.9,spread:9,period:5.2,...breath},hair,
});
const lock=(x:number,y:number,rx:number,ry:number,phase=0):CoverLobe=>({x,y,rx,ry,phase,amplitude:7.8,rate:1.25});
/** Only inspected, registered eyelid assets are enabled; remaining portraits retain open eyes. */
export const COVER_RIGS:readonly CoverRig[]=[WHALE_RIG,
 {...soft('gemini',{},[lock(.17,.39,.11,.13),lock(.81,.39,.12,.15,.6)]),blink:{src:'./menu-art/gemini-eyes-closed.png',width:1024,height:1536,patches:[[389,222,450,273],[470,187,532,238]],feather:4,timing:{period:4.3,offset:.7,close:.06,hold:.10,open:.09}}},
 {...soft('gpt',{x:.50,y:.37},[lock(.17,.44,.12,.15),lock(.82,.43,.12,.15,.8)]),blink:{src:'./menu-art/gpt-eyes-closed.png',width:1024,height:1536,patches:[[414, 229, 472, 276], [495, 193, 552, 241]],feather:4,timing:{period:4.6,offset:1.3,close:.06,hold:.11,open:.09}}},
 {...soft('claude',{x:.55,y:.40,rx:.065,ry:.065},[lock(.17,.43,.10,.13),lock(.83,.43,.11,.16,.5)]),blink:{src:'./menu-art/claude-eyes-closed.png',width:1024,height:1536,patches:[[425, 197, 477, 237], [495, 159, 549, 202]],feather:4,timing:{period:4.8,offset:0.4,close:.06,hold:.11,open:.09}}},
 // The staff occupies the left side. Keep it rigid; only the opposite outer hair moves.
 {...soft('grok',{x:.51,y:.35,rx:.075,ry:.065},[lock(.84,.43,.105,.15,.7)]),blink:{src:'./menu-art/grok-eyes-closed.png',width:1024,height:1536,patches:[[419, 242, 473, 280], [495, 207, 553, 250]],feather:4,timing:{period:3.8,offset:1.5,close:.06,hold:.11,open:.09}}},
 // Keep the book/hands below the collar and both boots fixed.
 {...soft('glm',{x:.50,y:.30,rx:.065,ry:.035,lift:2.7},[lock(.18,.43,.11,.13),lock(.82,.43,.11,.15,.4)]),blink:{src:'./menu-art/glm-eyes-closed.png',width:1024,height:1536,patches:[[411, 193, 465, 234], [490, 158, 542, 202]],feather:4,timing:{period:4.7,offset:0.9,close:.06,hold:.11,open:.09}}},
];
export function getCoverRig(model:string):CoverRig|undefined{return COVER_RIGS.find(rig=>rig.model===model);}
