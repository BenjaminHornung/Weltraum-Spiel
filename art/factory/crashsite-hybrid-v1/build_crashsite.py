"""Author the owner-selected wreck candidate in Blender; no gameplay admission.

All asset faces are axis-aligned on a 125 mm art grid. Exposed faces are
greedily merged per semantic part/material; no per-voxel objects or textures.
Run: blender -b -t 2 --python build_crashsite.py
"""
from pathlib import Path
from collections import defaultdict
import hashlib
import json
import math
import struct
import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent
Q = 0.125
CELLS = {}
PALETTE = {"ceramic": "E7DFCF", "worn": "ADA799", "structure": "30383D",
           "petrol": "407A79", "glass": "1D2E3C", "amber": "D8A94E"}

def box(part, mat, lo, hi):
    a = tuple(round(v/Q) for v in lo); b = tuple(round(v/Q) for v in hi)
    assert all(abs(lo[i]/Q-a[i]) < 1e-6 and abs(hi[i]/Q-b[i]) < 1e-6 for i in range(3))
    for x in range(a[0], b[0]):
        for y in range(a[1], b[1]):
            for z in range(a[2], b[2]):
                CELLS[(x,y,z)] = (part,mat)

def remove(lo,hi):
    for x in range(round(lo[0]/Q),round(hi[0]/Q)):
        for y in range(round(lo[1]/Q),round(hi[1]/Q)):
            for z in range(round(lo[2]/Q),round(hi[2]/Q)):
                CELLS.pop((x,y,z),None)

# Stepped lower hull and permanently broken rear spine. Front is negative X;
# accessible loading bay faces negative Y. Coordinates are Blender Z-up metres.
box("hull", "structure", (-6.5,-1.375,.5),(5.75,1.375,.875))
box("hull", "worn", (-6.75,-1.5,.625),(3.875,1.5,1.0))
for j in range(15):
    x=-7.5+j*.25; half=.625+min(j,7)*.125; roof=1.375+min(j,10)*.125
    box("hull","ceramic",(x,-half,.875),(x+.25,half,1.125))
    box("hull","ceramic",(x,-half,1.125),(x+.25,-half+.25,roof))
    box("hull","ceramic",(x,half-.25,1.125),(x+.25,half,roof))
    box("hull","ceramic",(x,-half,roof-.25),(x+.25,half,roof))
    if j>=4:
        box("cockpit","glass",(x,-half-.125,roof-.875),(x+.25,-half+.125,roof-.25))
        box("cockpit","glass",(x,half-.125,roof-.875),(x+.25,half+.125,roof-.25))
        box("cockpit","glass",(x,-half+.25,roof),(x+.25,half-.25,roof+.125))
box("hull","structure",(-7.625,-.75,.75),(-7.25,.75,1.25))
box("hull","petrol",(-5.375,-1.75,1.125),(-4.875,-1.5,1.75))

# Main section: an octagonal hard-voxel hull, open bay and torn roof plates.
for ix in range(-32,40):
    x=ix*Q
    for iy in range(-16,16):
        y=iy*Q
        for iz in range(7,28):
            z=iz*Q
            edge=abs(y+.0625)>1.75 or z>3.125
            if not edge: continue
            if abs(y+.0625)>1.75 and z>2.75: continue
            if -1.375<=x<2.5 and y< -1.625 and .875<=z<2.75: continue
            # Authored contiguous gaps, no random confetti.
            if z>3.125 and (-2.5<x<-.75 or 1<x<3.5): continue
            if x>3.25 and (iy+iz+ix//3)%9<4: continue
            CELLS[(ix,iy,iz)]=("hull","worn" if (ix//5+iz//3)%7==0 else "ceramic")
box("spine","structure",(-4.5,-.25,3.125),(6.0,.25,3.625))
for x in [-4,-2.75,-1.5,0,1.5,3,4.5]:
    for y in [-1.875,1.625]:
        box("spine","structure",(x,y,.625),(x+.25,y+.25,2.75))
        box("spine","structure",(x,y+.125,2.625),(x+.25,y+.375,3.125))
    box("spine","structure",(x,-1.5,3.125),(x+.25,1.5,3.375))
# Broken internal conduits and retained floor, no repairable flight machinery.
box("spine","petrol",(-2.75,.875,1),(4.875,1.125,1.25))
box("spine","amber",(-2.375,1.5,2),(3.125,1.625,2.125))
box("spine","structure",(3.625,-1.625,1),(6.75,-1.375,1.375))

# Ground-level bay, usable width 3.5 m; ramp is explicitly a visual candidate.
box("cargo_bay","petrol",(-1.625,-2,.625),(2.75,-1.75,.875))
for x in [-1.625,2.5]:
    box("cargo_bay","petrol",(x,-2,.75),(x+.25,-1.75,2.875))
box("cargo_bay","petrol",(-1.625,-2,2.625),(2.75,-1.75,2.875))
box("cargo_bay","amber",(-1.375,-2.125,2.5),(2.5,-2,2.625))
for step in range(5):
    y=-2.25-step*.375; z=.5-step*.125
    box("cargo_bay","worn",(-1.125,y,z),(2.25,y+.375,z+.125))
for y in [-2.25,-2.625,-3,-3.375,-3.75]:
    box("cargo_bay","structure",(-1.25,y,.125),( -.875,y+.25,.25))
    box("cargo_bay","structure",(2,y,.125),(2.375,y+.25,.25))
# Empty closed storage casings signal the retained finite cargo access module;
# these are art components, never newly granted inventory or ammunition.
for i,(x,y) in enumerate([(-.875,-.875),(.25,-.75),(1.375,-.25)]):
    box("cargo_bay","structure",(x,y,.875),(x+.875,y+.625,1.5))
    box("cargo_bay","petrol",(x+.125,y-.125,1),(x+.75,y,1.375))
    box("cargo_bay","amber",(x+.375,y-.25,1.125),(x+.5,y-.125,1.25))
    box("cargo_bay","worn",(x,y,1.5),(x+.875,y+.625,1.625))

# Ripped rear propulsion: two segmented ring remnants with exposed dark hubs.
for y0 in [-1.25,1.25]:
    for iy in range(-7,8):
        for iz in range(-7,8):
            r=max(abs(iy),abs(iz));
            if 5<=r<=7 and not (iy<0 and iz>1):
                box("rear","worn",(5.5,y0+iy*Q,1.625+iz*Q),(6,y0+(iy+1)*Q,1.625+(iz+1)*Q))
            if 2<=r<=3:
                box("rear","structure",(5.875,y0+iy*Q,1.625+iz*Q),(6.625,y0+(iy+1)*Q,1.625+(iz+1)*Q))
box("rear","structure",(4.75,-.375,1.125),(7.125,.375,1.625))
for j in range(15):
    x=4.875+j*.125; z=2.5+j*.125
    box("rear","ceramic",(x,.875,z),(x+.5,1.125,z+.5))
remove((5.125,-.625,3.25),(7.5,.625,5.25))

# Exactly two retained, idle roof guns. Six distinct square multi-barrels,
# enclosed finite-magazine housing, no muzzle flash or animated combat claim.
for part,x in [("turret_fore",-3.75),("turret_aft",2.75)]:
    box(part,"structure",(x-.5,-.625,3.375),(x+.5,.625,3.625))
    box(part,"worn",(x-.375,-.375,3.625),(x+.375,.375,3.875))
    box(part,"structure",(x-.5,-.5,3.875),(x+.5,.5,4.5))
    box(part,"ceramic",(x,-.625,3.875),(x+.375,.625,4.5))
    box(part,"petrol",(x+.375,-.5,3.875),(x+.875,.5,4.375))
    box(part,"amber",(x+.5,-.625,4),(x+.625,-.5,4.125))
    # Gun barrels face the nose, away from the side loading bay.
    for y,z in [(-.25,4), (0,4),(.25,4),(-.25,4.25),(0,4.25),(.25,4.25)]:
        box(part,"structure",(x-1.5,y,z),(x-.5,y+.125,z+.125))
    box(part,"structure",(x-1.25,-.375,3.875),(x-1.125,.375,4.5))

# Grounded damaged landing struts and deliberate detached wing plates.
for x in [-5.25,3.75]:
    for y in [-1.375,1.125]:
        box("debris","structure",(x,y,0),(x+.5,y+.25,.75))
        box("debris","worn",(x-.125,y-.25,0),(x+.75,y+.5,.125))
for j in range(8):
    x=4+j*.375; y=-2-j*.125
    box("debris","ceramic",(x,y,.125),(x+.375,y+1,.375))
    if j%2==0:box("debris","petrol",(x,y,.375),(x+.375,y+.5,.5))
for x,y in [(4.25,2.375),(5,2.125),(6.125,-1.875),(3.375,-2.125)]:
    box("debris","worn",(x,y,0),(x+.5,y+.375,.375))

# Extract visible coplanar rectangles once, keeping stable part/material roles.
planes=defaultdict(set)
for cell,(part,mat) in CELLS.items():
    for axis in range(3):
        uv=[i for i in range(3) if i!=axis]
        for sign in [-1,1]:
            n=list(cell);n[axis]+=sign
            if tuple(n) not in CELLS:
                planes[(part,mat,axis,sign,cell[axis]+(1 if sign==1 else 0))].add((cell[uv[0]],cell[uv[1]]))
meshes=defaultdict(lambda:{"v":[],"f":[],"m":[]})
for (part,mat,axis,sign,k),cells in sorted(planes.items()):
    uv=[i for i in range(3) if i!=axis]
    while cells:
        u,v=min(cells);w=1;h=1
        while (u+w,v) in cells:w+=1
        while all((u+j,v+h) in cells for j in range(w)):h+=1
        for j in range(w):
            for l in range(h):cells.remove((u+j,v+l))
        points=[]
        for a,b in [(u,v),(u+w,v),(u+w,v+h),(u,v+h)]:
            xyz=[0,0,0];xyz[axis]=k*Q;xyz[uv[0]]=a*Q;xyz[uv[1]]=b*Q;points.append(xyz)
        # (u,v) order yields -Y for axis Y and +X/+Z otherwise.
        if sign != (-1 if axis==1 else 1):points.reverse()
        mesh=meshes[part];base=len(mesh["v"]);mesh["v"].extend(points);mesh["f"].append(tuple(range(base,base+4)));mesh["m"].append(mat)

bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
materials={}
for name,hexcode in PALETTE.items():
    c=[int(hexcode[i:i+2],16)/255 for i in [0,2,4]]
    linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
    m=bpy.data.materials.new(name);m.diffuse_color=(*linear,1);m.use_nodes=True
    bs=m.node_tree.nodes.get("Principled BSDF");bs.inputs['Base Color'].default_value=(*linear,1);bs.inputs['Roughness'].default_value=.86
    materials[name]=m
objects=[]
for part,data in sorted(meshes.items()):
    m=bpy.data.meshes.new(part);m.from_pydata(data['v'],[],data['f']);m.update()
    o=bpy.data.objects.new(part,m);bpy.context.collection.objects.link(o)
    for material in materials.values():m.materials.append(material)
    for polygon,mat in zip(m.polygons,data['m']):polygon.material_index=list(materials).index(mat);polygon.use_smooth=False
    o['assetId']='hestia_crashsite_hybrid_v1';o['partId']=part;o['worldAuthority']=False;o['collisionPolicy']='None';o['gameplayAdmission']='NOT_ADMITTED'
    objects.append(o)
assert set(meshes)=={'hull','cockpit','spine','cargo_bay','rear','turret_fore','turret_aft','debris'}
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=False
scene.render.resolution_x=1440;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.world.color=(.22,.22,.22)
scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast'
floor_mat=bpy.data.materials.new('PREVIEW_GROUND');floor_mat.diffuse_color=(.30,.32,.33,1)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025));bpy.context.object.name='PREVIEW_GROUND_NOT_ASSET';bpy.context.object.data.materials.append(floor_mat)
def point(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
for pos,power,size in [((-7,-10,14),2200,8),((3,8,11),1600,10),((9,-2,8),1000,6)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.name='PREVIEW_LIGHT';o.data.energy=power;o.data.shape='DISK';o.data.size=size;point(o,(0,0,1.5))
bpy.ops.object.camera_add(location=(-12,-19,10));camera=bpy.context.object;camera.name='PREVIEW_CAMERA';scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=20;point(camera,(0,-.375,2))
scene['assetId']='hestia_crashsite_hybrid_v1';scene['artGridMeters']=Q;scene['worldAuthority']=False;scene['flight']='PERMANENTLY_INOPERABLE';scene['turretGameplay']='STATIC_ART_ONLY_FINITE_AMMO_FUTURE'
# The native file contains a named preview rig; export only the eight asset parts.
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'crashsite-hybrid-v1.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'crashsite-hybrid-v1.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
views=[('01-bay-and-turrets',(-12,-19,10),(0,-.375,2),20),('02-rear-damage',(13,-16,8),(0,0,1.875),20),('03-plan-access',(0,-.001,30),(0,0,0),21)]
for name,pos,target,scale in views:
    camera.location=pos;camera.data.ortho_scale=scale;point(camera,target)
    scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
report={'schema':'hestia.crashsite.blender-authoring/v1','blenderVersion':bpy.app.version_string,'artGridMeters':Q,'partCount':len(objects),'parts':[{'name':o.name,'quads':len(o.data.polygons),'vertices':len(o.data.vertices)} for o in objects],'cells':len(CELLS),'turretParts':['turret_fore','turret_aft'],'flight':'PERMANENTLY_INOPERABLE','worldAuthority':False,'runtimeAdmission':'NOT_ADMITTED','views':[v[0]+'.png' for v in views]}
report['outputs']=[{'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in sorted(OUT.iterdir()) if p.suffix in {'.glb','.blend','.png'}]
(OUT/'AUTHORING_REPORT.json').write_text(json.dumps(report,indent=2)+'\n')
print('HESTIA_AUTHORING_REPORT='+json.dumps(report))
