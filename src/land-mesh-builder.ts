import * as pc from 'playcanvas';
import type {LandGeometryBatch, LandSurfaceTexture} from './land-scenery';
const vec = (x: number, y: number, z: number) => new pc.Vec3(x,y,z);

/** Pure low-level batched primitives; no renderer, random state or external assets. */
export class LandMeshBatch implements LandGeometryBatch {
  positions: number[] = []; indices: number[] = []; uvs: number[] = [];
  constructor(public name: string, public color: string, public roughness = .9,
    public texture: LandSurfaceTexture = 'none', public metalness = 0) {}
  vertex(p: pc.Vec3, uv?: number[]) {
    this.positions.push(p.x, p.y, p.z); this.uvs.push(...(uv ?? [p.x * .15, p.z * .15]));
  }
  tri(a: pc.Vec3, b: pc.Vec3, c: pc.Vec3) {
    const i = this.positions.length / 3;
    this.vertex(a); this.vertex(b); this.vertex(c); this.indices.push(i, i + 1, i + 2);
  }
  quad(a: pc.Vec3, b: pc.Vec3, c: pc.Vec3, d: pc.Vec3) {
    const i = this.positions.length / 3;
    this.vertex(a); this.vertex(b); this.vertex(c); this.vertex(d);
    this.indices.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
  }
  box(p: pc.Vec3, size: pc.Vec3, yaw = 0) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const at = (x: number, y: number, z: number) => vec(p.x + x * c + z * s, p.y + y, p.z - x * s + z * c);
    const [x, y, z] = [size.x / 2, size.y / 2, size.z / 2];
    const corners = [at(-x,-y,-z),at(x,-y,-z),at(-x,y,-z),at(x,y,-z),at(-x,-y,z),at(x,-y,z),at(-x,y,z),at(x,y,z)];
    for (const face of [[0,1,2,3],[5,4,7,6],[4,0,6,2],[1,5,3,7],[2,3,6,7],[4,5,0,1]]) {
      const i = this.positions.length / 3;
      face.forEach((index, k) => this.vertex(corners[index], [(k % 2) * Math.max(size.x,size.z) * .3, Math.floor(k / 2) * size.y * .3]));
      this.indices.push(i,i+2,i+1,i+1,i+2,i+3);
    }
  }
  cone(p: pc.Vec3, radius: number, height: number, sides = 7, seed = 0) {
    const peak = p.clone().add(vec(0,height,0));
    for (let i = 0; i < sides; i++) {
      const a = (i / sides * Math.PI * 2) + seed, b = ((i + 1) / sides * Math.PI * 2) + seed;
      this.tri(vec(p.x + Math.cos(a)*radius,p.y,p.z + Math.sin(a)*radius), peak,
        vec(p.x + Math.cos(b)*radius,p.y,p.z + Math.sin(b)*radius));
    }
  }
}


/** Round low-poly solid suitable for columns, wheels and planters. */
export function cylinder(batch: LandMeshBatch, p: pc.Vec3, radius: number, height: number, sides = 10) {
  for(let i=0;i<sides;i++) {
    const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2;
    const pa=vec(p.x+Math.cos(a)*radius,p.y,p.z+Math.sin(a)*radius);
    const pb=vec(p.x+Math.cos(b)*radius,p.y,p.z+Math.sin(b)*radius);
    const qa=pa.clone().add(vec(0,height,0)),qb=pb.clone().add(vec(0,height,0));
    batch.quad(pa,pb,qa,qb);batch.tri(qa,qb,vec(p.x,p.y+height,p.z));
  }
}

export function ellipsoid(batch: LandMeshBatch, p: pc.Vec3, r: pc.Vec3, sides = 8, rings = 4) {
  const at=(i:number,j:number)=>{
    const u=i/sides*Math.PI*2,v=j/rings*Math.PI;
    return vec(p.x+Math.cos(u)*Math.sin(v)*r.x,p.y+Math.cos(v)*r.y,p.z+Math.sin(u)*Math.sin(v)*r.z);
  };
  for(let j=0;j<rings;j++)for(let i=0;i<sides;i++)batch.quad(at(i,j),at(i+1,j),at(i,j+1),at(i+1,j+1));
}
