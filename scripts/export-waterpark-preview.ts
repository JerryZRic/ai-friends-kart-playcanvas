import {writeFileSync} from 'node:fs';
import {createWaterparkDesign,sampleCamera} from '../src/waterpark-design';
const meshes=createWaterparkDesign();
writeFileSync(process.argv[2]||'/tmp/waterpark-design.json',JSON.stringify({meshes,cameras:[{name:'straight',...sampleCamera(26)},{name:'bridge',...sampleCamera(158)}]}));
console.log(JSON.stringify({batches:meshes.length,triangles:meshes.reduce((a,m)=>a+m.indices.length/3,0),vertices:meshes.reduce((a,m)=>a+m.positions.length/3,0)}));
