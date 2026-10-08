import * as pc from 'playcanvas';

/**
 * Original, texture-free water for the isolated waterpark visual study.
 * Mesh TEXCOORD0 is measured in metres: x = signed distance from the channel
 * centre, y = distance along the route. Those coordinates follow curved lanes.
 * The host owns animation: setParameter('time', elapsedSeconds) each frame.
 * Do not add a precision qualifier: PlayCanvas injects matching stage defaults.
 */
export const WATERPARK_WATER_VERTEX_SHADER = /* glsl */ `
attribute vec3 aPosition;
attribute vec2 aUv0;
uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform mat4 matrix_view;
uniform float time;
varying vec3 vWaterWorld;
varying vec2 vWaterRoute;
varying float vWaterDepth;

void main(void) {
    vec4 world = matrix_model * vec4(aPosition, 1.0);
    // Long, low swells stay below 8 cm in total, preserving the ride surface.
    float swell = sin(dot(world.xz, vec2(0.18, 0.31)) - time * 0.8) * 0.044;
    swell += sin(dot(world.xz, vec2(-0.43, 0.16)) - time * 1.1) * 0.024;
    swell += sin(dot(world.xz, vec2(0.64, 0.53)) - time * 1.35) * 0.009;
    world.y += swell;
    vWaterWorld = world.xyz;
    vWaterRoute = aUv0;
    vWaterDepth = -(matrix_view * world).z;
    gl_Position = matrix_viewProjection * world;
}
`;

export const WATERPARK_WATER_FRAGMENT_SHADER = /* glsl */ `
uniform float time;
uniform float waterHalfWidth;
// Route position, half-length, opacity, and feather of the optional bridge shade.
uniform vec4 bridgeShadow;
uniform vec3 view_position;
varying vec3 vWaterWorld;
varying vec2 vWaterRoute;
varying float vWaterDepth;

float waterHash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}

float waterNoise(vec2 p) {
    vec2 cell = floor(p);
    vec2 local = fract(p);
    vec2 blend = local * local * (3.0 - 2.0 * local);
    return mix(mix(waterHash(cell), waterHash(cell + vec2(1.0, 0.0)), blend.x),
               mix(waterHash(cell + vec2(0.0, 1.0)), waterHash(cell + vec2(1.0)), blend.x), blend.y);
}

float waterCloud(vec2 p) {
    // Rotated octaves prevent the noise lattice from reading as a checkerboard.
    mat2 turn = mat2(0.8, -0.6, 0.6, 0.8);
    float result = waterNoise(p) * 0.57;
    p = turn * p * 2.03 + vec2(13.1, 7.7);
    result += waterNoise(p) * 0.29;
    p = turn * p * 2.01 + vec2(5.3, 21.2);
    return result + waterNoise(p) * 0.14;
}

void main(void) {
    vec2 route = vWaterRoute;
    vec2 flow = vec2(route.x, route.y - time * 1.65);
    float depthFade = 1.0 - smoothstep(90.0, 250.0, vWaterDepth);

    // Wide colour pools, then longer ribbons of faster current: two distinct scales.
    float pool = waterCloud(flow * vec2(0.13, 0.057));
    float current = waterCloud(flow * vec2(0.31, 0.105) + vec2(8.7, time * 0.045));
    float warp = waterNoise(flow * vec2(0.18, 0.11) + 37.0);
    vec3 azure = vec3(0.018, 0.43, 0.66);
    vec3 turquoise = vec3(0.018, 0.76, 0.79);
    vec3 water = mix(azure, turquoise, smoothstep(0.20, 0.79, pool));
    water += vec3(0.025, 0.072, 0.055) * (current - 0.38);

    // Three directional swells plus a softer small ripple, with analytic normals.
    vec2 world = vWaterWorld.xz;
    vec2 gradient = cos(dot(world, vec2(0.18, 0.31)) - time * 0.8) * vec2(0.18, 0.31) * 0.044;
    gradient += cos(dot(world, vec2(-0.43, 0.16)) - time * 1.1) * vec2(-0.43, 0.16) * 0.024;
    gradient += cos(dot(world, vec2(0.64, 0.53)) - time * 1.35) * vec2(0.64, 0.53) * 0.009;
    gradient += cos(dot(world, vec2(1.91, 1.22)) - time * 2.2 + warp * 1.1) * vec2(1.91, 1.22) * 0.005 * depthFade;
    vec3 normal = normalize(vec3(-gradient.x * 3.5, 1.0, -gradient.y * 3.5));
    vec3 toEye = normalize(view_position - vWaterWorld);
    float fresnel = pow(1.0 - max(dot(normal, toEye), 0.0), 3.0);
    water = mix(water, vec3(0.47, 0.86, 0.94), fresnel * 0.34);
    vec3 halfLight = normalize(toEye + normalize(vec3(-0.34, 0.81, -0.48)));
    float sunSheen = pow(max(dot(normal, halfLight), 0.0), 34.0);
    water += vec3(1.0, 0.97, 0.82) * sunSheen * 0.42;

    // Gently warped transverse reflection strokes, broken into irregular islands.
    // No multiplication of orthogonal sine waves, which produces a tiled grid.
    float phase = flow.y * 1.1 + flow.x * 0.16 + (warp - 0.5) * 5.0;
    float ridge = 0.5 + 0.5 * sin(phase);
    float antialias = min(fwidth(phase) * 0.13, 0.15);
    float stroke = smoothstep(0.91 - antialias, 0.985 + antialias, ridge);
    float islands = smoothstep(0.50, 0.69, waterNoise(flow * vec2(0.34, 0.22) + vec2(5.0, 12.0)));
    float reflection = stroke * islands * depthFade;
    water = mix(water, vec3(0.72, 0.97, 0.97), reflection * 0.44);

    // Fine white edge foam follows route coordinates, including around the bend.
    float edgeDistance = max(waterHalfWidth - abs(route.x), 0.0);
    float edgeWobble = waterNoise(vec2(flow.y * 0.42, route.x * 0.28));
    float edgeWidth = 0.18 + edgeWobble * 0.32;
    float foamAA = max(fwidth(edgeDistance), 0.035);
    float contactFoam = 1.0 - smoothstep(edgeWidth, edgeWidth + foamAA + 0.10, edgeDistance);
    float bankWash = (1.0 - smoothstep(0.25, 1.55, edgeDistance)) * (0.28 + current * 0.42);
    water = mix(water, vec3(0.29, 0.88, 0.85), bankWash);
    float separatedFoam = 1.0 - smoothstep(0.08, 0.17 + foamAA, abs(edgeDistance - 0.73 - edgeWobble * 0.42));
    separatedFoam *= smoothstep(0.52, 0.73, waterNoise(vec2(flow.y * 0.65, route.x)));
    float foam = max(contactFoam * 0.92, separatedFoam * 0.70 * depthFade);
    water = mix(water, vec3(0.88, 0.99, 0.95), foam);

    // A deliberately authored soft shadow for the bridge; native custom materials
    // do not automatically consume the StandardMaterial shadow-map chunks.
    float shadeDistance = abs(route.y - bridgeShadow.x);
    float shadow = 1.0 - smoothstep(bridgeShadow.y, bridgeShadow.y + max(bridgeShadow.w, 0.01), shadeDistance);
    shadow *= clamp(bridgeShadow.z, 0.0, 1.0);
    water = mix(water, water * vec3(0.46, 0.64, 0.77), shadow);
    water = mix(water, vec3(0.59, 0.82, 0.86), smoothstep(180.0, 480.0, vWaterDepth) * 0.48);
    gl_FragColor = vec4(water, 1.0);
}
`;

/** Create an opaque, depth-writing material. The host owns its lifetime and time. */
export function createWaterparkWaterMaterial(_app: pc.Application): pc.ShaderMaterial {
  const material = new pc.ShaderMaterial({
    uniqueName: 'original-waterpark-turquoise-flow-v1',
    attributes: { aPosition: pc.SEMANTIC_POSITION, aUv0: pc.SEMANTIC_TEXCOORD0 },
    vertexGLSL: WATERPARK_WATER_VERTEX_SHADER,
    fragmentGLSL: WATERPARK_WATER_FRAGMENT_SHADER,
  });
  material.name = 'Waterpark · turquoise current and bank foam';
  material.cull = pc.CULLFACE_NONE;
  material.blendType = pc.BLEND_NONE;
  material.depthWrite = true;
  material.setParameter('time', 0);
  material.setParameter('waterHalfWidth', 12);
  material.setParameter('bridgeShadow', [0, 0, 0, 1.5]);
  return material;
}
