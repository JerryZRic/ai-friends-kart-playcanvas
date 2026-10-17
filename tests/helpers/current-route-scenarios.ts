export const routeMaps=['airfield','caldera','desert','forest','garden','harvest','quarry','snow','workshop'] as const;
export function currentRouteScenarios(){
 const scenarios:Array<{map:string;character:string;preset:string;hz:number;branch:'alley'|'boulevard';reaction:number;corrective:boolean;nativeFrame:boolean}>=[];
 const builds=[['whale','default'],['whale','balanced'],['gemini','corner'],['gpt','straight'],['claude','start-hill'],['grok','impact'],['glm','balanced']];
 for(const map of routeMaps)for(const [character,preset]of builds)for(const branch of ['alley','boulevard']as const){
  for(const hz of [30,60,120,144,240])scenarios.push({map,character,preset,hz,branch,reaction:0,corrective:true,nativeFrame:true});
  scenarios.push({map,character,preset,hz:60,branch,reaction:3,corrective:true,nativeFrame:true});
  if(preset==='default')for(const reaction of [.2,.4,.6,.8,1,1.2,1.6,2,2.4])scenarios.push({map,character,preset,hz:60,branch,reaction,corrective:true,nativeFrame:true});
  if(map==='quarry')for(const hz of [30,60,120,144,240])scenarios.push({map,character,preset,hz,branch,reaction:0,corrective:false,nativeFrame:true});
  if(preset==='default')scenarios.push({map,character,preset,hz:60,branch,reaction:0,corrective:true,nativeFrame:false});
 }
 return scenarios;
}
