import { Vec3 } from 'playcanvas';

export type CircuitPoint = Readonly<{x: number; y: number; z: number}> | readonly [number, number, number];
export type CircuitOptions = {arcSteps?: number; legacySeamTangent?: boolean};
type CubicAxis = readonly [number, number, number, number];
type CubicSegment = {x: CubicAxis; y: CubicAxis; z: CubicAxis};

/** Map-neutral, closed centripetal Catmull–Rom curve with a metre-distance table.
 * Geometry is built once; every scene, racer and camera consumes this sampler.
 * The legacy seam option exists solely to verify the historical migration route. */
export class ClosedCircuit {
  readonly points: readonly Vec3[];
  readonly arcs: number[] = [0];
  readonly length: number;
  readonly arcSteps: number;
  private readonly legacySeamTangent: boolean;
  private readonly segments: readonly CubicSegment[];
  constructor(points: readonly CircuitPoint[], options: CircuitOptions = {}) {
    if (points.length < 4) throw new Error('A closed circuit needs at least four points');
    this.points = points.map(point => Array.isArray(point) ? new Vec3(point[0], point[1], point[2]) : new Vec3((point as Vec3).x, (point as Vec3).y, (point as Vec3).z));
    if (this.points.some(point => ![point.x, point.y, point.z].every(Number.isFinite))) throw new Error('Circuit points must be finite');
    // Coefficients are static. Avoid rebuilding tangent weights and temporary
    // vectors for every rider/camera/wake sample on mobile devices.
    this.segments = this.points.map((_, segment) => {
      const n = this.points.length, [p0, p1, p2, p3] = [-1, 0, 1, 2].map(i => this.points[(segment + i + n) % n]);
      let d0 = Math.sqrt(p0.clone().sub(p1).length()), d1 = Math.sqrt(p1.clone().sub(p2).length()), d2 = Math.sqrt(p2.clone().sub(p3).length());
      if (d1 < 1e-4) d1 = 1;
      if (d0 < 1e-4) d0 = d1;
      if (d2 < 1e-4) d2 = d1;
      const axis = (a: number, b: number, c: number, d: number): CubicAxis => {
        const m1 = ((b - a) / d0 - (c - a) / (d0 + d1) + (c - b) / d1) * d1;
        const m2 = ((c - b) / d1 - (d - b) / (d1 + d2) + (d - c) / d2) * d1;
        return [b, m1, -3 * b + 3 * c - 2 * m1 - m2, 2 * b - 2 * c + m1 + m2];
      };
      return {x: axis(p0.x, p1.x, p2.x, p3.x), y: axis(p0.y, p1.y, p2.y, p3.y), z: axis(p0.z, p1.z, p2.z, p3.z)};
    });
    // Include every control knot in the distance table. Centripetal segments
    // share tangent directions but not parameter speed; straddling a knot in a
    // table interval would otherwise create a small visible speed pulse.
    this.arcSteps = Number.isFinite(options.arcSteps) ? Math.max(64, Math.floor(options.arcSteps!)) : Math.ceil(1800 / points.length) * points.length;
    this.legacySeamTangent = options.legacySeamTangent === true;
    let previous = this.point(0), total = 0;
    for (let i = 1; i <= this.arcSteps; i++) {
      const next = this.point(i / this.arcSteps);
      total += next.clone().sub(previous).length(); this.arcs.push(total); previous = next;
    }
    if (total < 1e-6) throw new Error('Circuit length must be positive');
    this.length = total;
  }
  point(parameter: number): Vec3 {
    const n = this.points.length;
    const p = (((Number.isFinite(parameter) ? parameter : 0) % 1) + 1) % 1 * n;
    const index = Math.floor(p), t = p - index, segment = this.segments[index];
    const component = ([a, b, c, d]: CubicAxis) => a + b * t + c * t * t + d * t * t * t;
    return new Vec3(component(segment.x), component(segment.y), component(segment.z));
  }
  parameterAt(u: number): number {
    const target = Math.max(0, Math.min(1, Number.isFinite(u) ? u : 0)) * this.length;
    let low = 0, high = this.arcs.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.arcs[mid] < target) low = mid + 1;
      else if (this.arcs[mid] > target) high = mid - 1;
      else return mid / this.arcSteps;
    }
    const index = Math.max(0, Math.min(this.arcSteps - 1, high));
    const span = this.arcs[index + 1] - this.arcs[index];
    return (index + (span > 0 ? (target - this.arcs[index]) / span : 0)) / this.arcSteps;
  }
  sample(distance: number, lateral = 0) {
    const u = (((Number.isFinite(distance) ? distance : 0) / this.length) % 1 + 1) % 1;
    const parameter = this.parameterAt(u), p = this.point(parameter);
    const before = this.legacySeamTangent ? Math.max(0, parameter - .0001) : parameter - .0001;
    const after = this.legacySeamTangent ? Math.min(1, parameter + .0001) : parameter + .0001;
    const t = this.point(after).sub(this.point(before)).normalize();
    const n = new Vec3(t.z, 0, -t.x).normalize();
    p.add(n.clone().mulScalar(Number.isFinite(lateral) ? lateral : 0));
    return {p, t, n, u, angle: Math.atan2(t.x, t.z)};
  }
  /** Signed yaw change per metre; positive bends toward the positive lane side. */
  curvature(distance: number, lookAhead = 7): number {
    const span = Number.isFinite(lookAhead) && lookAhead > 0 ? lookAhead : 7;
    const a = this.sample(distance).t, b = this.sample(distance + span).t;
    return Math.atan2(a.z * b.x - a.x * b.z, a.x * b.x + a.z * b.z) / span;
  }
}
