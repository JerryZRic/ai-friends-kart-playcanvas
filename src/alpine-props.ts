import selected from './generated/alpine-props.json';

export type AlpinePropKind = '04_ridge_picnic_table' | '12_ranger_relief_map_station';
export type AlpineMaterialFamily = 'wood' | 'bark' | 'stone' | 'darkStone' | 'white' | 'red' | 'yellow' | 'pine' | 'pineTips';
export interface AlpinePropPrimitive {
  readonly family: AlpineMaterialFamily;
  readonly sourcePrimitive: number;
  readonly sourceMaterial: string;
  readonly sourcePbr: { readonly baseColorFactor: readonly number[]; readonly metallicFactor: number; readonly roughnessFactor: number };
  readonly sourceNormalsSha256: string;
  readonly positions: readonly number[];
  readonly indices: readonly number[];
  readonly uvs: readonly number[];
}
export interface AlpineProp {
  readonly kind: AlpinePropKind;
  readonly source: { readonly title: string; readonly file: string; readonly sha256: string; readonly lod: 0; readonly triangles: number };
  readonly materials: readonly AlpinePropPrimitive[];
  readonly bounds: { readonly min: readonly number[]; readonly max: readonly number[] };
  /** Full projected convex hull, including bench/canopy overhangs. Y is zero.
   * Reserve every point, not merely the support feet or the origin. */
  readonly footprint: readonly (readonly number[])[];
  /** Exact authored vertices within 1 micrometre of global minimum Y.
   * These are source grounding evidence, not newly authored physics bodies. */
  readonly groundContacts: readonly (readonly number[])[];
  /** Original vertices within 5 cm of the global minimum. Some secondary feet
   * can sit higher than the global contact plane; these are not all contacts. */
  readonly supportBand: { readonly height: number; readonly points: readonly (readonly number[])[] };
}

/** Read-only local geometry. The scene builder owns unit-scale placement,
 * shared-material batching, component ranges, clearance and camera triangles.
 * No independent loader, renderer, collision path or network request exists. */
export const ALPINE_PROPS: readonly AlpineProp[] = selected.props as unknown as readonly AlpineProp[];
export function getAlpineProp(kind: AlpinePropKind): AlpineProp {
  const prop = ALPINE_PROPS.find(p => p.kind === kind);
  if (!prop) throw new Error(`Unknown selected Alpine prop: ${kind}`);
  return prop;
}
