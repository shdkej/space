"""Render the decorative paper-index relief used in the Civic Ledger overview.

The geometry is intentionally abstract; no policy-to-agency relationship is encoded.
Run with Blender: blender -b --python design/blender/ledger_relief.py
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "dist" / "assets" / "ledger-relief.png"
SCENE = ROOT / "design" / "blender" / "ledger-relief.blend"
OUT.parent.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, color, metallic=0.0, roughness=0.56):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    output = nodes.new("ShaderNodeOutputMaterial")
    mat.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat

paper = material("warm stock / paper", (0.89, 0.88, 0.82))
navy = material("ink / civic", (0.045, 0.11, 0.16))
orange = material("index tab / vermilion", (0.72, 0.23, 0.11))
blue = material("index tab / slate", (0.17, 0.34, 0.42))


def block(name, loc, scale, mat, bevel=0.08):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    if bevel:
        mod = ob.modifiers.new("soft machined edge", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        ob.modifiers.new("weighted face normals", "WEIGHTED_NORMAL")
    return ob

# A compact stack of archival sheets, not a network diagram.
for i, mat in enumerate((blue, navy, paper)):
    x = (i - 1) * 0.22
    y = i * 0.28
    z = i * 0.21
    block(f"index sheet {i + 1}", (x, y, z), (3.5, 2.45, 0.13), mat, 0.04)

# Neutral little index marks on the face of the top sheet.
for row in range(4):
    block(f"row rule {row + 1}", (-0.62, 0.25 + row * 0.42, 0.493),
          (1.48 + (row % 2) * 0.4, 0.028, 0.009), navy, 0)
for col in range(3):
    block(f"index tick {col + 1}", (0.80 + col * 0.27, 0.22, 0.494),
          (0.12, 0.12, 0.009), orange, 0.015)
block("vermillion tab", (1.68, 0.80, 0.455), (0.62, 0.39, 0.045), orange, 0.025)

bpy.ops.object.camera_add(location=(6.2, -8.0, 7.8))
cam = bpy.context.object
cam.rotation_euler = (Vector((0.0, 0.3, 0.12)) - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.type = "ORTHO"
cam.data.ortho_scale = 5.7
bpy.context.scene.camera = cam

for loc, power, size in [((-4, -3, 8), 850, 5), ((4, 3, 6), 550, 4)]:
    bpy.ops.object.light_add(type="AREA", location=loc)
    light = bpy.context.object
    light.data.energy = power
    light.data.shape = "DISK"
    light.data.size = size
    light.rotation_euler = (Vector((0, 0, 0)) - light.location).to_track_quat("-Z", "Y").to_euler()

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.render.resolution_x = 720
scene.render.resolution_y = 440
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.filepath = str(OUT)
scene.world.color = (0.85, 0.87, 0.86)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SCENE))
bpy.ops.render.render(write_still=True)
print(f"RENDERED {OUT} and saved {SCENE}")
