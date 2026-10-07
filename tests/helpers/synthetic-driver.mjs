// Original test-only geometry and animation generated from numeric arrays.
// No third-party model, image, texture, or private input is used here.
export function encodeGLB(document, binary = new Uint8Array()) {
  const json = new TextEncoder().encode(JSON.stringify(document));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const binLength = Math.ceil(binary.byteLength / 4) * 4;
  const out = new Uint8Array(20 + jsonLength + (binLength ? 8 + binLength : 0));
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, out.length, true);
  view.setUint32(12, jsonLength, true); view.setUint32(16, 0x4e4f534a, true);
  out.fill(32, 20, 20 + jsonLength); out.set(json, 20);
  if (binLength) {
    view.setUint32(20 + jsonLength, binLength, true);
    view.setUint32(24 + jsonLength, 0x004e4942, true);
    out.set(new Uint8Array(binary.buffer ?? binary, binary.byteOffset ?? 0, binary.byteLength), 28 + jsonLength);
  }
  return out.buffer;
}

export function syntheticDriverGLB({bones = ['RootBone', 'WheelBone'], clips = ['DriveIdle', 'SteerLeft', 'SteerRight', 'SteeringDemo', 'SteeringRange'], mutate = () => {}} = {}) {
  const parts = [], accessors = [], bufferViews = [];
  let byteLength = 0;
  function accessor(values, Type, type, itemSize, bounds) {
    const array = new Type(values), bytes = new Uint8Array(array.buffer);
    const padding = (4 - byteLength % 4) % 4;
    if (padding) { parts.push(new Uint8Array(padding)); byteLength += padding; }
    const view = bufferViews.push({buffer: 0, byteOffset: byteLength, byteLength: bytes.length}) - 1;
    parts.push(bytes); byteLength += bytes.length;
    return accessors.push({bufferView: view, componentType: Type === Float32Array ? 5126 : 5123, count: values.length / itemSize, type, ...(bounds ?? {})}) - 1;
  }
  const position = accessor([-0.15, 0, 0, 0.15, 0, 0, 0, 0.6, 0], Float32Array, 'VEC3', 3, {min: [-0.15, 0, 0], max: [0.15, 0.6, 0]});
  const joints = accessor(Array(12).fill(0), Uint16Array, 'VEC4', 4);
  const weights = accessor([1,0,0,0, 1,0,0,0, 1,0,0,0], Float32Array, 'VEC4', 4);
  const indices = accessor([0,1,2], Uint16Array, 'SCALAR', 1);
  const times = accessor([0,.5,1,1.5,2], Float32Array, 'SCALAR', 1, {min:[0], max:[2]});
  const axis = [0,Math.cos(43*Math.PI/180),Math.sin(43*Math.PI/180)];
  const quaternions = [0,.5,1,1.5,2].flatMap(t=>{const half=-(t-1)*Math.PI/20;return [...axis.map(v=>v*Math.sin(half)),Math.cos(half)];});
  const rotations = accessor(quaternions, Float32Array, 'VEC4', 4);
  const nodes = [
    {name:'SyntheticRoot', children:[1,5]},
    {name:bones[0], children:[2]},
    {name:bones[1], translation:[0,1.105,.30], children:[3,4]},
    {name:'GripL', translation:[.245,0,0]},
    {name:'GripR', translation:[-.245,0,0]},
    {name:'OriginalTestTriangle', mesh:0, skin:0},
  ];
  const gltf = {
    asset:{version:'2.0', generator:'Original synthetic public regression fixture'}, scene:0,
    scenes:[{nodes:[0]}], nodes, buffers:[{byteLength}], bufferViews, accessors,
    meshes:[{primitives:[{attributes:{POSITION:position, JOINTS_0:joints, WEIGHTS_0:weights}, indices}]}],
    skins:[{joints:[1,2], skeleton:1}],
    animations:clips.map(name=>({name,samplers:[{input:times,output:rotations,interpolation:'LINEAR'}],channels:[{sampler:0,target:{node:2,path:'rotation'}}]})),
  };
  mutate(gltf);
  const binary = new Uint8Array(byteLength); let offset=0;
  for (const part of parts) { binary.set(part,offset); offset+=part.length; }
  return encodeGLB(gltf,binary);
}

export function localFile(buffer, name='driver.glb', extra={}) {
  return {name, type:'model/gltf-binary', size:buffer.byteLength, arrayBuffer:async()=>buffer.slice(0), ...extra};
}
export function deferred() {
  let resolve, reject;
  const promise = new Promise((a,b)=>{resolve=a;reject=b;});
  return {promise, resolve, reject};
}
