import { Vec3 } from 'playcanvas';

export const HALF = 7.2;
export const MAX_SPEED = 42;
export const UP = new Vec3(0, 1, 0);
export const TRACK_POINTS = [
  [0, 2.4, -140], [95, 4.5, -125], [160, 7, -40],
  [135, 4.5, 50], [70, 2.6, 90], [35, 2.4, 155],
  [-70, 4, 160], [-145, 6, 100], [-155, 3.2, 0], [-110, 2.4, -85],
].map(([x, y, z]) => new Vec3(x, y, z));
export const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
export const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));
export const scaled = (p: Vec3, direction: Vec3, amount: number) => p.add(direction.clone().mulScalar(amount));
export const radians = (degrees: number) => degrees * Math.PI / 180;
export const degrees = (radians: number) => radians * 180 / Math.PI;

/** Closed centripetal Catmull–Rom spline, with the original 1,800-step arc table.
 * Distances are real metres along the circuit, not spline parameters. */
export class CoastCircuit {
  readonly points = TRACK_POINTS;
  readonly arcs: number[] = [0];
  readonly length: number;
  constructor() {
    let previous = this.point(0), total = 0;
    for (let i = 1; i <= 1800; i++) {
      const next = this.point(i / 1800);
      total += next.clone().sub(previous).length();
      this.arcs.push(total);
      previous = next;
    }
    this.length = total;
  }
  point(parameter: number): Vec3 {
    const n = this.points.length;
    const p = ((parameter % 1) + 1) % 1 * n;
    const segment = Math.floor(p), t = p - segment;
    const [p0, p1, p2, p3] = [-1, 0, 1, 2].map(i => this.points[(segment + i + n) % n]);
    let d0 = Math.sqrt(p0.clone().sub(p1).length());
    let d1 = Math.sqrt(p1.clone().sub(p2).length());
    let d2 = Math.sqrt(p2.clone().sub(p3).length());
    if (d1 < 1e-4) d1 = 1;
    if (d0 < 1e-4) d0 = d1;
    if (d2 < 1e-4) d2 = d1;
    const component = (a: number, b: number, c: number, d: number) => {
      const m1 = ((b - a) / d0 - (c - a) / (d0 + d1) + (c - b) / d1) * d1;
      const m2 = ((c - b) / d1 - (d - b) / (d1 + d2) + (d - c) / d2) * d1;
      return b + m1 * t + (-3 * b + 3 * c - 2 * m1 - m2) * t * t + (2 * b - 2 * c + m1 + m2) * t * t * t;
    };
    return new Vec3(component(p0.x, p1.x, p2.x, p3.x), component(p0.y, p1.y, p2.y, p3.y), component(p0.z, p1.z, p2.z, p3.z));
  }
  parameterAt(u: number): number {
    const target = clamp(u, 0, 1) * this.length;
    let low = 0, high = this.arcs.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.arcs[mid] < target) low = mid + 1;
      else if (this.arcs[mid] > target) high = mid - 1;
      else return mid / 1800;
    }
    const index = Math.max(0, high);
    return (index + (target - this.arcs[index]) / (this.arcs[index + 1] - this.arcs[index])) / 1800;
  }
  sample(distance: number, lateral = 0) {
    const u = ((distance / this.length) % 1 + 1) % 1;
    const parameter = this.parameterAt(u);
    const p = this.point(parameter);
    // Match the original finite-difference tangent, including its seam convention.
    const t = this.point(Math.min(1, parameter + .0001)).sub(this.point(Math.max(0, parameter - .0001))).normalize();
    const n = new Vec3(t.z, 0, -t.x).normalize();
    scaled(p, n, lateral); // Positive lane points to the driver's LEFT.
    return { p, t, n, u };
  }
}
export const circuit = new CoastCircuit();
export const LENGTH = circuit.length;
export const sample = (distance: number, lateral = 0) => circuit.sample(distance, lateral);
