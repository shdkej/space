"""Render a non-semantic Milky Way atmosphere for HTML policy leads.

Run from the Policycock site root with Blender 5.3 in background mode.
All dots are atmospheric texture; the ten interactive nodes and their relations
belong exclusively to HTML/CSS, not to this scene.
"""
from pathlib import Path
import math
import random
import bpy

ROOT = Path(__file__).resolve().parent.parent
OUT_PNG = ROOT / 'scripts' / 'galaxy.png'
OUT_BLEND = ROOT / 'scripts' / 'galaxy.blend'
rng = random.Random(20261116)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for material in list(bpy.data.materials):
    bpy.data.materials.remove(material)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1800
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(OUT_PNG)
scene.render.film_transparent = False
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'Medium High Contrast'
scene.render.engine = 'BLENDER_EEVEE'
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
scene.world.color = (0.004, 0.006, 0.019)

# Deep, diffuse clouds: layered procedural noise is painted onto actual geometry.
mat = bpy.data.materials.new('Ink and diffuse galactic dust')
mat.use_nodes = True
nodes = mat.node_tree.nodes
nodes.clear()
links = mat.node_tree.links
output = nodes.new('ShaderNodeOutputMaterial')
emission = nodes.new('ShaderNodeEmission')
emission.inputs['Strength'].default_value = 1.0
links.new(emission.outputs['Emission'], output.inputs['Surface'])
texcoord = nodes.new('ShaderNodeTexCoord')
large_noise = nodes.new('ShaderNodeTexNoise')
large_noise.inputs['Scale'].default_value = 2.4
large_noise.inputs['Detail'].default_value = 5.0
large_noise.inputs['Roughness'].default_value = 0.68
fine_noise = nodes.new('ShaderNodeTexNoise')
fine_noise.inputs['Scale'].default_value = 13.0
fine_noise.inputs['Detail'].default_value = 3.0
fine_noise.inputs['Roughness'].default_value = 0.7
links.new(texcoord.outputs['Generated'], large_noise.inputs['Vector'])
links.new(texcoord.outputs['Generated'], fine_noise.inputs['Vector'])
combine = nodes.new('ShaderNodeMixRGB')
combine.blend_type = 'MULTIPLY'
combine.inputs[0].default_value = 0.32
links.new(large_noise.outputs['Fac'], combine.inputs[1])
links.new(fine_noise.outputs['Fac'], combine.inputs[2])
ramp = nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.interpolation = 'EASE'
for index, (position, color) in enumerate([
    (0.0, (0.003, 0.006, 0.019, 1)),
    (0.38, (0.006, 0.011, 0.033, 1)),
    (0.60, (0.014, 0.020, 0.059, 1)),
    (0.77, (0.029, 0.027, 0.075, 1)),
    (1.0, (0.048, 0.042, 0.095, 1)),
]):
    item = ramp.color_ramp.elements[index] if index < 2 else ramp.color_ramp.elements.new(position)
    item.position = position
    item.color = color
links.new(combine.outputs['Color'], ramp.inputs['Fac'])
links.new(ramp.outputs['Color'], emission.inputs['Color'])
mesh = bpy.data.meshes.new('Cloud canvas')
mesh.from_pydata([(-10, -6, -3), (10, -6, -3), (10, 6, -3), (-10, 6, -3)], [], [(0, 1, 2, 3)])
canvas = bpy.data.objects.new('Full-bleed nebular canvas', mesh)
bpy.context.collection.objects.link(canvas)
canvas.data.materials.append(mat)

# An elliptical diagonal dust lane, deliberately diffuse and without a hub.
# Hundreds of tiny separate geometry dots add real depth, not a ten-node diagram.
colors = [
    ('cold silver blue', (0.42, 0.57, 0.85, 1)),
    ('lavender', (0.60, 0.44, 0.81, 1)),
    ('muted pearl', (0.67, 0.69, 0.86, 1)),
    ('deep azure', (0.29, 0.40, 0.72, 1)),
    ('pale lilac', (0.76, 0.67, 0.90, 1)),
]
star_materials = []
for name, color in colors:
    material = bpy.data.materials.new('Starlight - ' + name)
    material.use_nodes = True
    nt = material.node_tree
    nt.nodes.clear()
    surface = nt.nodes.new('ShaderNodeEmission')
    surface.inputs['Color'].default_value = color
    surface.inputs['Strength'].default_value = 1.4
    output = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(surface.outputs[0], output.inputs['Surface'])
    star_materials.append(material)

verts = [(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)]
faces = [(0, 1, 2, 3)]
# One mesh per hue allows 1,550 individually scattered points with only five draw objects.
for hue_index, material in enumerate(star_materials):
    points = []
    polygons = []
    for i in range(310):
        if rng.random() < 0.76:
            x = rng.uniform(-9.1, 9.1)
            lane = 0.27 * x + 0.48 * math.sin(0.48 * x)
            spread = rng.choice([0.58, 1.08, 1.9])
            y = lane + rng.gauss(0, spread)
        else:
            x, y = rng.uniform(-9.25, 9.25), rng.uniform(-5.1, 5.1)
        if abs(y) > 5.1:
            continue
        # Hundreds of subpixel sparks and a few small discernible points.
        size = rng.choices([rng.uniform(0.009, 0.015), rng.uniform(0.016, 0.026),
                            rng.uniform(0.028, 0.048)], weights=[60, 31, 9])[0]
        z = rng.uniform(-1.3, 0.5)
        start = len(points)
        points.extend((x + size * math.cos(2 * math.pi * j / 8),
                       y + size * math.sin(2 * math.pi * j / 8), z)
                      for j in range(8))
        polygons.append(tuple(start+j for j in range(8)))
    star_mesh = bpy.data.meshes.new('Scattered tiny stardots mesh %d' % hue_index)
    star_mesh.from_pydata(points, [], polygons)
    star_mesh.materials.append(material)
    obj = bpy.data.objects.new('Unlabelled atmospheric sparks %d' % hue_index, star_mesh)
    bpy.context.collection.objects.link(obj)

camera_data = bpy.data.cameras.new('Orthographic atmospheric camera')
camera = bpy.data.objects.new('Atmospheric camera', camera_data)
bpy.context.collection.objects.link(camera)
camera.location = (0, 0, 12)
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 18.0
scene.camera = camera

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
bpy.ops.render.render(write_still=True)
print('GALAXY_RENDER_OK', OUT_BLEND, OUT_PNG, scene.render.resolution_x, scene.render.resolution_y)
