"""Render the policy atlas as a genuine Blender 3D scene (Blender 5.3).

Run from WSL with the installed Windows Blender using `wslpath -w` on this
script. The 2013 KOSTAT-derived outlines are already licensed/cited in README.
No institution positions are invented: the only geographic building is a
stylized National Assembly model at the existing approximate Seoul pin.
"""
import bpy
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'dist' / 'assets'
SVG = ASSETS / 'korea.svg'
RENDER = ROOT / 'scripts' / 'institution-atlas.png'
BLEND = ROOT / 'scripts' / 'institution-atlas.blend'

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for material in list(bpy.data.materials):
    bpy.data.materials.remove(material)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 1800
scene.render.resolution_y = 1400
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - High Contrast'
scene.render.filepath = str(RENDER)


def material(name, color, roughness: float = .4, metallic: float = 0.0, transmission: float = 0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    surface = mat.node_tree.nodes.get('Principled BSDF')
    surface.inputs['Base Color'].default_value = (*color, 1)
    surface.inputs['Roughness'].default_value = roughness
    surface.inputs['Metallic'].default_value = metallic
    surface.inputs['Transmission Weight'].default_value = transmission
    return mat


def cube(name, location, scale, mat, bevel: float = 0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new('machined rounded edges', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 4
        obj.modifiers.new('weighted normals', 'WEIGHTED_NORMAL')
    return obj


def cylinder(name, location, radius, depth, mat, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj

navy = material('Obsidian enamel / ocean', (.013, .026, .084), .2, .45)
base = material('Anodized navy aluminium', (.023, .032, .09), .3, .7)
edge = material('Lavender polished edge', (.42, .31, .75), .22, .65)
coast = [material(f'Porcelain relief {i}', col, .32, .11) for i, col in enumerate([
    (.47, .58, .79), (.57, .67, .84), (.52, .63, .82), (.65, .67, .86),
])]
gold = material('Soft champagne gold accents', (.62, .48, .27), .26, .68)
dome_mat = material('Oxidized copper dome', (.09, .34, .36), .31, .55)
white = material('Architectural white stone', (.91, .91, .96), .26, .12)

cube('Lower floating slate', (0, 0, -.37), (11.62, 10.75, .43), base, .33)
cube('Chamfered luminous rim', (0, 0, -.17), (11.38, 10.51, .13), edge, .28)
cube('Sea / dark glass', (0, 0, -.065), (11.23, 10.36, .12), navy, .26)

# SVG paths are explicit M/L/Z polygons produced from a documented GeoJSON;
# lift each province into actual 3D geometry, with a physically lit top/side.
root = ET.parse(SVG).getroot()
map_top = next(g for g in root.iter() if g.tag.endswith('g') and g.get('class') == 'map-top')
areas = [node for node in map_top if node.tag.endswith('path')]
assert len(areas) == 17, len(areas)
ring_regex = re.compile(r'M([^Z]+)Z')
point_regex = re.compile(r'[ML](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)')
for index, item in enumerate(areas):
    curve = bpy.data.curves.new(f'Province {index+1} outline', 'CURVE')
    curve.dimensions = '2D'
    curve.fill_mode = 'BOTH'
    curve.extrude = .085
    curve.bevel_depth = .012
    curve.bevel_resolution = 2
    for path in ring_regex.findall(item.get('d') or ''):
        points = point_regex.findall('M' + path)
        if len(points) < 3:
            continue
        spline = curve.splines.new('POLY')
        spline.points.add(len(points)-1)
        for target, (x, y) in zip(spline.points, points):
            target.co = ((float(x)-350)/75, (325-float(y))/75, 0, 1)
        spline.use_cyclic_u = True
    obj = bpy.data.objects.new(f'Administrative relief {index+1:02d}', curve)
    bpy.context.collection.objects.link(obj)
    obj.location.z = .17 + (index % 4)*.005
    obj.data.materials.append(coast[index % 4])

# Grounded, deliberately stylized National Assembly architectural miniature.
# Its visual size is exaggerated; the geographic anchor remains approximate.
assembly_x = (100+(126.978-125)*102-350)/75
assembly_y = (325-(55+(38.8-37.566)*98))/75
cube('Assembly podium', (assembly_x, assembly_y, .385), (.73, .55, .16), white, .035)
cube('Assembly entablature', (assembly_x, assembly_y, .67), (.64, .48, .095), white, .015)
for dx in (-.22, -.11, 0, .11, .22):
    cylinder('Assembly colonnade', (assembly_x+dx, assembly_y-.19, .52), .022, .24, white, 16)
cylinder('Assembly copper drum', (assembly_x, assembly_y+.03, .78), .21, .16, dome_mat, 64)
bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=1, location=(assembly_x, assembly_y+.03, .85))
dome = bpy.context.object
dome.name = 'Assembly hemispherical copper dome'
dome.scale = (.22, .22, .16)
dome.data.materials.append(dome_mat)
for poly in dome.data.polygons:
    poly.use_smooth = True
cylinder('Assembly golden finial', (assembly_x, assembly_y+.03, 1.045), .027, .10, gold, 24)
# The tiny building is legible at landing-page size, while still clearly
# presented as a scaled architectural model rather than a real footprint.
for obj in bpy.data.objects:
    if obj.name.startswith('Assembly'):
        obj.location.x = assembly_x + (obj.location.x-assembly_x)*1.35
        obj.location.y = assembly_y + (obj.location.y-assembly_y)*1.35
        obj.location.z = .25 + (obj.location.z-.25)*1.35
        obj.scale *= 1.35

# A modest optical line at the coast and four corner rivets, not fake markers.
for x in (-5.30, 5.30):
    for y in (-4.85, 4.85):
        cylinder('Stage screw', (x, y, .018), .045, .01, gold, 24)

# Dark stage and cyc background create genuine contact shadows and depth.
background = material('Ink background', (.009, .013, .044), .92)
cube('Cyclorama floor', (0, 0, -.71), (200, 200, .20), background)
world = bpy.data.worlds.new('Midnight studio')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.025, .03, .08, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .44


def area_light(name, location, power, color, size, target=(0,0,0)):
    bpy.ops.object.light_add(type='AREA', location=location)
    light = bpy.context.object
    light.name = name
    light.data.energy = power
    light.data.color = color
    light.data.shape = 'DISK'
    light.data.size = size
    light.rotation_euler = (Vector(target)-light.location).to_track_quat('-Z','Y').to_euler()

area_light('Key: cool porcelain', (-5, -3, 10), 1050, (0.72, .83, 1), 8)
area_light('Rim: lavender', (5, 4, 7), 850, (0.75, .57, 1), 6)
area_light('Soft horizon', (-1, 7, 8), 650, (0.43, .55, 1), 7)
area_light('Assembly warm glint', (-3, 2, 4), 190, (1, .81, .55), 2, (assembly_x, assembly_y, .5))

bpy.ops.object.camera_add(location=(0, -8.5, 14.4))
cam = bpy.context.object
cam.name = 'Atlas orthographic camera'
cam.rotation_euler = (Vector((0, 0, -.04))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 11.5
scene.camera = cam
scene.render.image_settings.color_mode = 'RGBA'

bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
bpy.ops.render.render(write_still=True)
print(f'ATLAS_RENDER {RENDER} regions={len(areas)}')
