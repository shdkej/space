"""Render the mobile policy atlas as a separate, text-free portrait scene.

From the policycock directory, in WSL:
  '/mnt/c/Program Files/Blender Foundation/Blender 5.3/blender.exe' \
    --background --factory-startup --python "$(wslpath -w scripts/render-policy-diagram-mobile.py)"

Ten independent policy pedestals follow the two HTML columns, five per column.
The lower three isolated trays are an unrelated agency CATEGORY index, not
policy ownership, location, chronology, or administrative connections.
"""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
PNG = ROOT / 'scripts' / 'policy-diagram-mobile.png'
BLEND = ROOT / 'scripts' / 'policy-diagram-mobile.blend'

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 750
scene.render.resolution_y = 1600
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.color_depth = '8'
scene.render.filepath = str(PNG)
scene.render.film_transparent = False
scene.eevee.taa_render_samples = 32
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'


def mat(name, color, metallic=0.0, rough=.35, transmission=0.0, emission=None, strength=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = rough
    shader.inputs['Transmission Weight'].default_value = transmission
    if emission is not None:
        shader.inputs['Emission Color'].default_value = (*emission, 1)
        shader.inputs['Emission Strength'].default_value = strength
    return material


def block(name, pos, size, material, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel:
        edge = obj.modifiers.new('Soft precision chamfer', 'BEVEL')
        edge.width = bevel
        edge.segments = 3
        obj.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
    return obj


def disc(name, pos, radius, depth, material, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                        depth=depth, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
    return obj


ink = mat('Deep midnight enamel', (.010, .018, .055), .28, .42)
slate = mat('Midnight blue slate', (.024, .040, .105), .56, .27)
upper = mat('Smoky blue glass', (.070, .100, .225), .39, .17, .14)
lower = mat('Agency indigo glass', (.052, .070, .157), .34, .22, .12)
edge = mat('Frosted lilac rim', (.43, .32, .72), .54, .26,
           emission=(.40, .23, .73), strength=.19)
pearl = mat('Opaline upper keys', (.56, .63, .89), .33, .24)
bright = mat('Archive core ivory', (.70, .71, .94), .26, .22,
             emission=(.35, .30, .76), strength=.28)
mark = mat('Dim agency index pins', (.38, .41, .70), .35, .31)
subtle = mat('Recessed separation line', (.13, .16, .33), .42, .29)

# The orthographic width is 7.5 units and the portrait height is 16 units.
# This dark physical sheet extends behind live HTML text without raster labels.
block('Gallery ground', (0, 0, -.42), (200, 200, .20), ink)
block('Portrait floating atlas footprint', (0, 0, -.17),
      (7.24, 15.55, .27), slate, .20)
block('Portrait dark glass enamel', (0, 0, -.018),
      (7.04, 15.34, .056), ink, .15)

# Image coordinates: x 25%/75%; y 240, 335, 430, 525, 620 of 1600.
# The front of each shallow plinth reads behind the corresponding HTML card.
for column, x in enumerate((-1.875, 1.875)):
    for row in range(5):
        n = column * 5 + row + 1
        y = 5.60 - .95 * row
        block(f'Policy {n:02d} independent lilac plinth',
              (x, y, .12), (2.91, .76, .17), edge, .075)
        block(f'Policy {n:02d} dark glass volume',
              (x, y, .25), (2.81, .68, .18), upper, .065)
        # One key per policy, offset left where the HTML card has its name.
        disc(f'Policy {n:02d} opaline key', (x - .97, y, .365),
             .115, .10, pearl, 40)
        disc(f'Policy {n:02d} inset key', (x - .97, y, .427),
             .055, .035, bright, 32)

# A quiet blank gutter separates the registers. There are deliberately no
# arrows, routes, wires, hub, or shared pedestal between policy and agency.
block('Quiet register divide', (0, -.06, .026), (6.55, .012, .014),
      subtle, .004)

# Three separate low trays echo the agency catalogue's mobile reflow:
# ministries tall on left; offices above administrations on right. These
# positions and indexed slots do NOT claim a real-world relationship.
for category, cx, cy, width, height, count, columns in [
    ('Bu ministry category', -1.79, -2.22, 3.07, 2.95, 19, 4),
    ('Cheo office category', 1.79, -1.12, 3.07, .86, 6, 3),
    ('Cheong administration category', 1.79, -3.01, 3.07, 2.12, 19, 4),
]:
    block(f'{category} lilac underlay', (cx, cy, .07),
          (width, height, .23), edge, .11)
    block(f'{category} isolated indigo tray', (cx, cy, .21),
          (width - .10, height - .10, .20), lower, .09)
    rows = math.ceil(count / columns)
    spacing_x = .57 if columns == 4 else .72
    spacing_y = min(.46, (height - .46) / max(rows - 1, 1))
    for i in range(count):
        row, col = divmod(i, columns)
        px = cx + (col - (columns - 1) / 2) * spacing_x
        py = cy + ((rows - 1) / 2 - row) * spacing_y
        block(f'{category} index {i+1:02d}', (px, py, .34),
              (.25, .18, .065), mark, .024)
        block(f'{category} index {i+1:02d} facet', (px, py, .378),
              (.18, .09, .014), pearl, .005)

world = bpy.data.worlds.new('Quiet navy ambient')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.034, .043, .12, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .42


def light(name, position, energy, color, size):
    bpy.ops.object.light_add(type='AREA', location=position)
    obj = bpy.context.object
    obj.name = name
    obj.data.energy = energy
    obj.data.color = color
    obj.data.shape = 'DISK'
    obj.data.size = size
    obj.rotation_euler = (Vector((0, 0, 0)) - obj.location).to_track_quat('-Z', 'Y').to_euler()


light('Broad porcelain key', (-5, -3, 9), 1150, (.72, .82, 1), 9)
light('Quiet lilac rim', (5, 3, 8), 900, (.71, .53, 1), 8)
light('Front cool fill', (0, -6, 6), 460, (.47, .60, 1), 8)

bpy.ops.object.camera_add(location=(0, 0, 28))
camera = bpy.context.object
camera.name = 'Mobile plan orthographic diagram camera'
camera.rotation_euler = (Vector((0, 0, 0)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 16.0  # Portrait vertical span; horizontal span is 7.5.
scene.camera = camera

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
bpy.ops.render.render(write_still=True)
print(f'POLICY_DIAGRAM_MOBILE_RENDER png={PNG} blend={BLEND} upper=2x5 lower=19/6/19 resolution=750x1600')
