"""Render Policycock's text-free conceptual atlas in Blender 5.3.

Run under Blender from WSL:
  '/mnt/c/Program Files/Blender Foundation/Blender 5.3/blender.exe' \
    --background --factory-startup --python "$(wslpath -w scripts/render-policy-diagram.py)"

This is a catalogue illustration, not a map or a statement of agency-policy
responsibility. The ten upper policy objects meet only at an archival hub; the
three lower agency-category trays have no links to the upper system.
"""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
PNG = ROOT / 'scripts' / 'policy-diagram.png'
BLEND = ROOT / 'scripts' / 'policy-diagram.blend'

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1800
scene.render.resolution_y = 1050
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.filepath = str(PNG)
scene.render.film_transparent = False
scene.render.image_settings.color_depth = '8'
scene.eevee.taa_render_samples = 32
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'


def mat(name, color, metallic=0.0, rough=.35, transmission=0.0, emission=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = rough
    p.inputs['Transmission Weight'].default_value = transmission
    if emission:
        p.inputs['Emission Color'].default_value = (*emission, 1)
        p.inputs['Emission Strength'].default_value = strength
    return m


def block(name, pos, size, material, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.object
    o.name = name
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if bevel:
        b = o.modifiers.new('Soft precision chamfer', 'BEVEL')
        b.width = bevel
        b.segments = 3
        o.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
    return o


def disc(name, pos, radius, depth, material, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                        depth=depth, location=pos)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(material)
    o.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
    return o


def route(name, a, b, material, radius=.018):
    direction = Vector(b)-Vector(a)
    middle = (Vector(a)+Vector(b)) / 2
    o = disc(name, middle, radius, direction.length, material, 12)
    o.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    return o


ink = mat('Deep midnight enamel', (.010, .018, .055), .28, .42)
slate = mat('Midnight blue slate', (.024, .040, .105), .56, .27)
upper = mat('Smoky blue glass', (.070, .100, .225), .39, .17, .14)
lower = mat('Agency indigo glass', (.052, .070, .157), .34, .22, .12)
edge = mat('Frosted lilac rim', (.43, .32, .72), .54, .26, emission=(.40,.23,.73), strength=.19)
trace = mat('Muted lavender archive routes', (.31, .28, .53), .36, .32, emission=(.23,.17,.45), strength=.12)
pearl = mat('Opaline upper keys', (.56, .63, .89), .33, .24)
bright = mat('Archive core ivory', (.70, .71, .94), .26, .22, emission=(.35,.30,.76), strength=.28)
mark = mat('Dim agency index pins', (.38, .41, .70), .35, .31)
subtle = mat('Recessed separation line', (.13, .16, .33), .42, .29)

# Physical floating slab, with a deliberately generous dark perimeter.
block('Gallery ground', (0,0,-.42), (200,200,.20), ink)
block('Floating atlas footprint', (0,0,-.17), (15.8,8.15,.27), slate, .20)
block('Top glass enamel', (0,0,-.018), (15.5,7.87,.056), ink, .15)

# Upper register: two even rows of five unique, unlabelled policy pedestals.
# The ten direct routes end at a NEUTRAL catalogue hub; never at an agency.
xs = [-6.12, -3.06, 0, 3.06, 6.12]
ys = [2.62, .78]
for row, y in enumerate(ys):
    for col, x in enumerate(xs):
        n = row*5+col+1
        a = (x, y, .064)
        b = (0, 3.46, .064)
        route(f'Policy {n:02d} to neutral archive hub', a, b, trace, .012)

for row, y in enumerate(ys):
    for col, x in enumerate(xs):
        n = row*5+col+1
        block(f'Policy {n:02d} plinth', (x,y,.12), (2.72,1.12,.17), edge, .10)
        block(f'Policy {n:02d} dark glass volume', (x,y,.25), (2.58,1.03,.18), upper, .075)
        # A strong large key, not a decorative spray of small dots.
        disc(f'Policy {n:02d} opaline key', (x,y,.365), .23, .10, pearl, 48)
        disc(f'Policy {n:02d} inset key', (x,y,.427), .115, .035, bright, 40)

# Hub is intentionally smaller than the policy pedestals, and is neither an
# institution nor an implied administrative ownership claim.
disc('Neutral archive hub outer', (0,3.46,.17), .35, .19, edge, 64)
disc('Neutral archive hub center', (0,3.46,.30), .23, .12, bright, 64)

# Visible quiet divide: the lower categorical index is a separate catalogue.
block('Upper register underlining', (0,-.54,.026), (13.4,.018,.014), subtle, .006)

# Three distinct trays, 19 / 6 / 19 counts. Their pin coordinates are merely
# indexed slots and carry NO geographic, chronological or political meaning.
for category, cx, count, columns in [
    ('Bu ministry category', -5.12, 19, 5),
    ('Cheo office category', 0, 6, 3),
    ('Cheong administration category', 5.12, 19, 5),
]:
    block(f'{category} indigo underlay', (cx,-2.43,.07), (3.72,2.39,.23), edge, .16)
    block(f'{category} isolated glass tray', (cx,-2.43,.21), (3.61,2.28,.20), lower, .13)
    # Each index mark is a deliberately restrained machined tile, wide enough
    # to read at final website scale, without forming a pretend map.
    rows = math.ceil(count/columns)
    for i in range(count):
        row, col = divmod(i, columns)
        spacing = .59 if columns == 5 else .79
        px = cx + (col-(columns-1)/2)*spacing
        py = -2.43 + (row-(rows-1)/2)*.47
        block(f'{category} index {i+1:02d}', (px,py,.34),
              (.28,.21,.065), mark, .027)
        block(f'{category} index {i+1:02d} facet', (px,py,.378),
              (.20,.11,.014), pearl, .005)

world = bpy.data.worlds.new('Quiet navy ambient')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.034,.043,.12,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .42


def light(name, position, energy, color, size):
    bpy.ops.object.light_add(type='AREA', location=position)
    obj = bpy.context.object
    obj.name = name
    obj.data.energy = energy
    obj.data.color = color
    obj.data.shape = 'DISK'
    obj.data.size = size
    obj.rotation_euler = (Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()

light('Broad porcelain key', (-5,-3,9), 1150, (.72,.82,1), 9)
light('Quiet lilac rim', (5,3,8), 900, (.71,.53,1), 8)
light('Front cool fill', (0,-6,6), 460, (.47,.60,1), 8)

bpy.ops.object.camera_add(location=(0,-3.1,18.0))
camera = bpy.context.object
camera.name = 'Near plan orthographic diagram camera'
camera.rotation_euler = (Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 16.4  # Horizontal span; 1800:1050 yields ~9.57 vertical.
scene.camera = camera

bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
bpy.ops.render.render(write_still=True)
print(f'POLICY_DIAGRAM_RENDER png={PNG} blend={BLEND} upper=10 lower=19/6/19 resolution=1800x1050')
