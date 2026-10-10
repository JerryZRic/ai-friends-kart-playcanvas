/** Reproducible race setup, deliberately independent of graphics preferences. */
export type Difficulty='easy'|'normal'|'hard';
export type RaceOptions={difficulty:Difficulty;seed:number};
export const DEFAULT_RACE_OPTIONS:Readonly<RaceOptions>=Object.freeze({difficulty:'normal',seed:20261010});
export function parseRaceOptions(search:string):RaceOptions{
 const p=new URLSearchParams(search),difficulty=p.get('difficulty'),raw=p.get('seed');
 const seed=raw!==null&&/^\d{1,10}$/.test(raw)?Number(raw):NaN;
 return {difficulty:difficulty==='easy'||difficulty==='hard'?difficulty:'normal',seed:Number.isInteger(seed)&&seed>=0&&seed<=0xffffffff?seed:DEFAULT_RACE_OPTIONS.seed};
}
/** Includes the leading question mark, ready to append to a bare race entry. */
export function raceOptionsQuery(options:RaceOptions):string{
 const clean=parseRaceOptions(new URLSearchParams({difficulty:options.difficulty,seed:String(options.seed)}).toString());
 return '?'+new URLSearchParams({difficulty:clean.difficulty,seed:String(clean.seed)}).toString();
}
