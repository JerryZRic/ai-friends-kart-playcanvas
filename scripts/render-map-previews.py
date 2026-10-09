"""Render exact exported scene meshes into 16:9 overview cards using CPU Cycles.

Run after export-map-previews.ts, from the repository root:
  blender --background --python scripts/render-map-previews.py -- /tmp/map-previews

Requires Blender 4.3+ and Pillow in Blender's Python. Runtime/builds do not need
either dependency: the two WebP assets are committed. No generative image edits,
route smoothing, geometry substitutions or private asset sources are used.
"""
import hashlib
import json
import math
import os
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector
from PIL import Image


def xyz(values):
    return Vector((values[0], -values[2], values[1]))


def linear(value):
    return value / 12.92 if value < .04045 else ((value + .055) / 1.055) ** 2.4


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


args = sys.argv[sys.argv.index('--') + 1:]
inputs = Path(args[0] if args else '/tmp/ai-friends-map-previews')
root = Path(__file__).resolve().parents[1]
output = root / 'public' / 'map-previews'
output.mkdir(parents=True, exist_ok=True)
manifest = {
    'kind': 'offline-native-geometry-render',
    'renderer': f'Blender {bpy.app.version_string}, Cycles CPU',
    'description': 'Source-derived 3D overhead renders of the actual PlayCanvas menu scenes. These are not browser/GPU gameplay screenshots. Materials, water shading and lighting are approximate.',
    'resolution': [1280, 720],
    'generatorHashes': {path: sha(root / path) for path in ['scripts/export-map-previews.ts', 'scripts/render-map-previews.py']},
    'maps': {},
}

for map_id in ['coast', 'waterpark']:
    data = json.loads((inputs / f'{map_id}.json').read_text())
    # Refuse a stale export if scene code changed before rendering finished.
    for path, digest in data['sourceHashes'].items():
        assert sha(root / path) == digest, f'Source changed since export: {path}'
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for record in data['meshes']:
        positions = record['positions']
        vertices = [xyz(positions[i:i + 3]) for i in range(0, len(positions), 3)]
        indices = record['indices']
        mesh = bpy.data.meshes.new(record['name'])
        mesh.from_pydata(vertices, [], [indices[i:i + 3] for i in range(0, len(indices), 3)])
        mesh.update()
        if record['normals']:
            for polygon in mesh.polygons:
                polygon.use_smooth = True
            normals = record['normals']
            mesh.normals_split_custom_set_from_vertices([xyz(normals[i:i + 3]) for i in range(0, len(normals), 3)])
        obj = bpy.data.objects.new(record['name'], mesh)
        bpy.context.collection.objects.link(obj)
        material = bpy.data.materials.new(record['name'])
        material.use_nodes = True
        shader = material.node_tree.nodes.get('Principled BSDF')
        color = record['color'].lstrip('#')[:6]
        rgba = [linear(int(color[i:i + 2], 16) / 255) for i in (0, 2, 4)]
        shader.inputs['Base Color'].default_value = (*rgba, 1)
        shader.inputs['Roughness'].default_value = record['roughness']
        shader.inputs['Metallic'].default_value = record['metalness']
        mesh.materials.append(material)

    scene = bpy.context.scene
    world = bpy.data.worlds.new('Soft overview daylight')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (.45, .58, .64, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = .62
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 500))
    sun = bpy.context.object
    sun.rotation_euler = (math.radians(25), math.radians(-20), math.radians(-30))
    sun.data.energy = 1.75
    sun.data.angle = .11
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = False
    scene.cycles.seed = 17
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'Standard'

    points = [xyz(point) for point in data['route']['points']]
    anchors = [xyz(point) for point in data['route']['anchors']]
    mean = sum(points, Vector()) / len(points)
    xx = sum((p.x - mean.x) ** 2 for p in points)
    yy = sum((p.y - mean.y) ** 2 for p in points)
    xy = sum((p.x - mean.x) * (p.y - mean.y) for p in points)
    # Lay the route's major axis across the landscape card, without distorting it.
    angle = .5 * math.atan2(2 * xy, xx - yy)
    pitch = math.radians(68)
    right = Vector((math.cos(angle), math.sin(angle), 0))
    direction = Vector((math.sin(angle) * math.cos(pitch), -math.cos(angle) * math.cos(pitch), math.sin(pitch)))
    up = direction.cross(right)
    horizontal = [(p - mean).dot(right) for p in anchors]
    vertical = [(p - mean).dot(up) for p in anchors]
    target = mean + right * ((min(horizontal) + max(horizontal)) / 2) + up * ((min(vertical) + max(vertical)) / 2)
    aspect = 16 / 9
    # Fit all route edges and high landmarks inside a six-percent safe margin.
    scale = max(max(horizontal) - min(horizontal), (max(vertical) - min(vertical)) * aspect) / .88
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    scene.camera = camera
    camera.data.type = 'ORTHO'
    camera.data.sensor_fit = 'HORIZONTAL'
    camera.data.ortho_scale = scale
    camera.data.clip_start = .1
    camera.data.clip_end = 5000
    camera.location = target + direction * 1000
    camera.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update()
    projected = [world_to_camera_view(scene, camera, point) for point in anchors]
    bounds = [min(p.x for p in projected), min(p.y for p in projected), max(p.x for p in projected), max(p.y for p in projected)]
    assert min(bounds[:2]) >= .059 and max(bounds[2:]) <= .941, f'Clipped route: {bounds}'
    png = inputs / f'{map_id}-overview.png'
    scene.render.filepath = str(png)
    bpy.ops.render.render(write_still=True)
    destination = output / f'{map_id}-overview.webp'
    with Image.open(png) as image:
        image.convert('RGB').save(destination, 'WEBP', quality=92, method=6)
    manifest['maps'][map_id] = {
        'asset': f'map-previews/{map_id}-overview.webp',
        'sha256': sha(destination),
        'bytes': destination.stat().st_size,
        'sourceHashes': data['sourceHashes'],
        'meshBatches': len(data['meshes']),
        'triangles': sum(len(mesh['indices']) // 3 for mesh in data['meshes']),
        'routeLength': data['route']['length'],
        'routeBounds': {'min': data['route']['min'], 'max': data['route']['max']},
        'camera': {'projection': 'orthographic', 'elevationDegrees': 68, 'normalizedSafeBounds': bounds},
        'omittedAtmosphere': data['omittedAtmosphere'],
    }
    print('RENDERED', map_id, str(destination.name), flush=True)

# Check every captured source again before publishing provenance for the pair.
for record in manifest['maps'].values():
    for path, digest in record['sourceHashes'].items():
        assert sha(root / path) == digest, f'Source changed during render: {path}'
(root / 'docs' / 'map-preview-provenance.json').write_text(json.dumps(manifest, indent=2) + '\n')
