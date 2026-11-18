"""Build a compact, editable machined dial for the policy console.
Run: blender -b --factory-startup --python-exit-code 1 -P scripts/build-console-knob.py
Blender 4.0.2 arm64 verified. Export converts Blender Z-up to glTF Y-up.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist/assets/console-knob.glb'
DESIGN = ROOT / 'design'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
def material(name, color, metal, rough):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m
metal=material('M_SatinAluminum',(.48,.51,.52),1,.29)
paint=material('M_GraphiteCoating',(.024,.029,.032),0,.31)
mark=material('M_IvoryIndex',(.77,.75,.66),0,.43)
# A continuous lathed profile: bottom foot, knurled grip, bevel and inset top.
profile=[(.57,0),(.64,.045),(.66,.09),(.66,.12),(.66,.47),(.65,.52),(.60,.57),(.53,.585),(.52,.57),(0,.57)]
N=192;verts=[];faces=[];mats=[]
for j,(r,z) in enumerate(profile[:-1]):
    for i in range(N):
        # 64 fine grip flutes, tapered away at the chamfers.
        flute=.016*(1-math.cos(i*2*math.pi/3)) if j in (3,4) else 0
        a=i*math.tau/N;verts.append(((r-flute)*math.cos(a),(r-flute)*math.sin(a),z))
for j in range(len(profile)-2):
    for i in range(N):
        faces.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i));mats.append(1 if j>=6 else 0)
faces.append(tuple(reversed(range(N))));mats.append(1)
faces.append(tuple((len(profile)-2)*N+i for i in range(N)));mats.append(1)
mesh=bpy.data.meshes.new('DialLathe');mesh.from_pydata(verts,[],faces);mesh.update()
body=bpy.data.objects.new('ConsoleDial',mesh);bpy.context.collection.objects.link(body)
body.data.materials.append(metal);body.data.materials.append(paint)
for p,idx in zip(mesh.polygons,mats):p.material_index=idx;p.use_smooth=len(p.vertices)==4
bpy.context.view_layer.objects.active=body;body.select_set(True)
uv=mesh.uv_layers.new(name='UVMap')
for face in mesh.polygons:
    if len(face.vertices)==4:
        j=face.index//N;i=face.index%N
        coords=[(i/N,j/16),((i+1)/N,j/16),((i+1)/N,(j+1)/16),(i/N,(j+1)/16)]
        for loop,coord in zip(face.loop_indices,coords):uv.data[loop].uv=coord
    else:
        center=.25 if face.index==len(mesh.polygons)-2 else .75
        for loop in face.loop_indices:
            co=mesh.vertices[mesh.loops[loop].vertex_index].co
            uv.data[loop].uv=(center+co.x*.25,.77+co.y*.25)
body.data.use_auto_smooth=True
normal=body.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL');normal.keep_sharp=True
tri=body.modifiers.new('Export triangulation','TRIANGULATE');tri.keep_custom_normals=True
# A narrow index inlay sits flush over the cap; separate solid rather than z-fighting decal.
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,-.34,.576))
index=bpy.context.object;index.name='DialIndex';index.dimensions=(.025,.17,.014)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
index.data.materials.append(mark)
bev=index.modifiers.new('Soft index edges','BEVEL');bev.width=.005;bev.segments=3
assets=[body,index]
for ob in assets:ob.select_set(True)
DESIGN.mkdir(exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(DESIGN/'console-knob.blend'))
result=bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
assert result=={'FINISHED'} and OUT.stat().st_size>0
report={'blender':bpy.app.version_string,'asset':OUT.name,'bytes':OUT.stat().st_size,'dimensions':[1.32,1.32,.585],'objects':len(assets),'materials':3,'meshes':[]}
for ob in assets:
    evaluated=ob.evaluated_get(bpy.context.evaluated_depsgraph_get());me=evaluated.to_mesh();me.calc_loop_triangles()
    report['meshes'].append({'name':ob.name,'vertices':len(me.vertices),'triangles':len(me.loop_triangles)})
    evaluated.to_mesh_clear()
(ROOT/'qa/console-model.json').write_text(json.dumps(report,indent=2)+'\n')
# Two actual material review renders. Rendering objects are not exported.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=False
scene.render.resolution_x=600;scene.render.resolution_y=600;scene.render.resolution_percentage=100
scene.world.color=(.15,.15,.15)
def area(name,loc,power,size):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,.2))-o.location).to_track_quat('-Z','Y').to_euler()
area('Softbox',(-2,-3,4),260,3);area('Rim',(2,1,2),180,2)
d=bpy.data.cameras.new('ReviewCamera');cam=bpy.data.objects.new('ReviewCamera',d);bpy.context.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO';d.ortho_scale=2
for name,loc in [('front',(1.3,-2.1,1.7)),('back',(-1.6,1.8,1.1))]:
    cam.location=loc;cam.rotation_euler=(Vector((0,0,.25))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(ROOT/'qa'/('console-knob-'+name+'.png'));bpy.ops.render.render(write_still=True)
print('CONSOLE_MODEL',json.dumps(report))
