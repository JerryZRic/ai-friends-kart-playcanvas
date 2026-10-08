/** Types for the official optional script shipped by pinned PlayCanvas 2.23.1. */
declare module 'playcanvas/scripts/esm/planar-renderer.mjs' {
  import { Entity, Script, Texture, Vec3 } from 'playcanvas';
  export class PlanarRenderer extends Script {
    static scriptName: string;
    sceneCameraEntity: Entity | null;
    mode: 'reflection' | 'refraction';
    scale: number;
    mipmaps: boolean;
    depth: boolean;
    planePoint: Vec3;
    planeNormal: Vec3;
    obliqueClipping: boolean;
    clipBias: number;
    _destroyRenderTarget(): void;
    updateRenderTarget(): void;
    frameUpdate(): Texture | null;
  }
}
