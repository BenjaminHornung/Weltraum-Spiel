"""Walkable V1 derivative authoring, no gameplay authority.

blender -b -t 2 --python build_crashsite.py
125 mm body cells with 62.5 mm local details are authored, then greedy-meshed by
semantic part/material. Preview rig is excluded from the runtime GLB.
"""
from pathlib import Path
from collections import defaultdict
import hashlib
import json
import math
import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent
Q = .125
ASSET_ID = 'hestia_crashsite_walkable_v1'
CELLS = {}
PALETTE = {'ceramic': 'DCD4C2', 'worn': '968F7E', 'structure': '303B40',
           'petrol': '397775', 'glass': '173342', 'amber': 'D7A446'}

def box(part, mat, lo, hi):
    a = tuple(round(v / Q) for v in lo)
    b = tuple(round(v / Q) for v in hi)
    assert all(abs(lo[i] / Q-a[i]) < 1e-6 and abs(hi[i] / Q-b[i]) < 1e-6 for i in range(3))
    for x in range(a[0], b[0]):
        for y in range(a[1], b[1]):
            for z in range(a[2], b[2]):
                CELLS[x, y, z] = part, mat

def remove(lo, hi):
    for x in range(round(lo[0]/Q), round(hi[0]/Q)):
        for y in range(round(lo[1]/Q), round(hi[1]/Q)):
            for z in range(round(lo[2]/Q), round(hi[2]/Q)):
                CELLS.pop((x, y, z), None)

def round_ring(part, mat, axis, lo, hi, center, outer, inner, missing=None):
    """Quantized elliptical tube; broken sectors are deliberately authored."""
    uv = [i for i in range(3) if i != axis]
    for a in range(math.floor((center[0]-outer[0])/Q), math.ceil((center[0]+outer[0])/Q)):
        for b in range(math.floor((center[1]-outer[1])/Q), math.ceil((center[1]+outer[1])/Q)):
            u, v = (a+.5)*Q-center[0], (b+.5)*Q-center[1]
            if (u/outer[0])**2+(v/outer[1])**2 > 1: continue
            if inner[0] and (u/inner[0])**2+(v/inner[1])**2 < 1: continue
            if missing and missing(u, v): continue
            for k in range(round(lo/Q), round(hi/Q)):
                xyz = [0, 0, 0]; xyz[axis] = k; xyz[uv[0]] = a; xyz[uv[1]] = b
                CELLS[tuple(xyz)] = part, mat

# Retained pressure shell, with armor layered over the rib cage. This is a
# volumetric cross-section, not rectangular side walls with roof slabs.
for ix in range(-35, 44):
    x = (ix+.5)*Q
    rear = max(0, (x-3.25)/2.25)
    wy = 2.25 - .25*rear
    hz = 1.75 - .125*rear
    cz = 2.25
    rib = any(abs(x-r) < .1875 for r in [-4, -2.5, -1, .5, 2, 3.5, 5])
    wy += .125 if rib else 0
    hz += .125 if rib else 0
    for iy in range(-20, 20):
        y = (iy+.5)*Q
        for iz in range(4, 34):
            z = (iz+.5)*Q
            outside = (y/wy)**2+((z-cz)/hz)**2
            inside = (y/(wy-.25))**2+((z-cz)/(hz-.25))**2
            if outside > 1 or inside < 1: continue
            # Accessible side opening, retained inner floor at one metre.
            # Raised visible side-bay aperture for the declared full-height
            # swept corridor; the outer shell contour and bounds stay intact.
            if -1.75 < x < 2.375 and y < -.875 and 1 <= z < 3.25: continue
            # Two coherent impact tears. Their margins expose underlying ribs.
            tear_roof = ((x-1.25)/1.55)**2+((y+.85)/1.05)**2 < 1 and z > 3.3
            tear_aft = x > 2.875 and y < -.75 and z > 1.5+.3*(x-2.875)
            tail_sever = x > 4.625 and ((y < .375 and z > 1.375) or z < 1.125)
            if tail_sever: continue
            if not rib and (tear_roof or tear_aft): continue
            # Shallow panel seams show dark substrate, without breaking hull.
            seam = ix % 10 == 0 or (iz in [10, 17, 24] and abs(y) > 1.25)
            mat = 'structure' if rib or seam else 'ceramic'
            # Wear is concentrated at lower armor and damaged edges.
            if mat == 'ceramic' and (z < 1.25 or (x > 2.5 and iz % 7 == 2)):
                mat = 'worn'
            CELLS[ix, iy, iz] = ('spine' if rib else 'hull'), mat

box('spine', 'structure', (-4.625,-1.75,.625), (5.125,1.75,.875))
box('hull', 'worn', (-4.5,-1.75,.875), (4.5,1.75,1))
box('spine', 'structure', (-4.25,-.25,3.625), (4.875,.25,4))
# Interior rails and conduits are visible through the tears and bay.
for y in [-1.25, 1.125]:
    box('spine', 'structure', (-3.75,y,1.125), (4.625,y+.125,1.25))
    if y == -1.25:
        # Reroute the low transverse bay conduit into the upper clear space.
        box('spine', 'petrol', (-2.75,-.75,3.375), (4.5,-.625,3.5))
    else:
        box('spine', 'petrol', (-2.75,y,2.75), (4.5,y+.125,2.875))
box('spine', 'amber', (-3.875,1.625,2.125), (4.125,1.75,2.25))
remove((-1.75,-1.25,1.125),(2.375,-1.125,1.25))
for x in [-3.75,-2.25,-.75,.75,2.25,3.75]:
    box('spine', 'structure', (x,1.5,1), (x+.125,1.75,3))
    box('spine', 'worn', (x,-1.25,1), (x+.125,1.5,1.125))

# Tapered enclosed prow with an inclined, broad glass canopy. Roof and cheek
# facets step by the same 125 mm grid, with a dark frame and armored brow.
for ix in range(-62, -34):
    x = (ix+.5)*Q
    t = max(0, min(1, (x+7.75)/3.5))
    wy = .625+1.625*t
    hz = .5+1.25*t
    cz = 1.625+.625*t
    canopy_roof = 2+math.floor(t*13)*Q
    for iy in range(-19, 19):
        y = (iy+.5)*Q
        for iz in range(5, 33):
            z = (iz+.5)*Q
            outside = (y/wy)**2+((z-cz)/hz)**2
            inside = (y/max(.25,wy-.25))**2+((z-cz)/max(.25,hz-.25))**2
            if z > canopy_roof or outside > 1 or (inside < 1 and ix > -60): continue
            glass = False  # Broad inclined roof panes are added below.
            side_glass = -6.375 < x < -4.875 and abs(y) > wy*.65 and cz < z < cz+.625
            frame = ix in [-56,-48,-39] or (abs(y) < .125 and z > cz+.375)
            mat = 'glass' if (glass or side_glass) and not frame else 'ceramic'
            if frame or (z < cz-.5 and ix % 10 < 2): mat = 'structure'
            if z < 1.25 and mat == 'ceramic': mat = 'worn'
            CELLS[ix, iy, iz] = ('cockpit' if glass or side_glass or frame else 'hull'), mat
    half = max(.375, math.floor(wy*.7/Q)*Q)
    box('cockpit','structure',(ix*Q,-half,canopy_roof-Q),((ix+1)*Q,half,canopy_roof))
    if -7 < x < -4.75:
        for iy in range(round(-half/Q)+1,round(half/Q)-1):
            # Two slim mullions and one transverse frame make readable panes.
            frame = iy in [-1,0] or ix in [-48,-47]
            CELLS[ix,iy,round(canopy_roof/Q)-1] = 'cockpit','structure' if frame else 'glass'
box('hull', 'structure', (-7.875,-.5,1.125), (-7.5,.5,1.625))
box('hull', 'worn', (-7.625,-.625,.875), (-6.875,.625,1.125))
# Distinct armored side service hatch, recessed dark handle and little marker.
box('hull', 'structure', (-4.875,-2.125,1.375), (-3.875,-1.875,2.375))
box('hull', 'petrol', (-4.75,-2.25,1.5), (-4,-2.125,2.25))
box('hull', 'structure', (-4.5,-2.375,1.75), (-4.25,-2.25,2))
box('hull', 'amber', (-4.625,-2.375,2.125), (-4.5,-2.25,2.25))
for x in [-6.625,-6,-5.375]:
    box('hull', 'structure', (x,-1.375,1.125), (x+.25,-1.125,1.375))

# Recessed bay: charcoal inner bulkhead, industrial jambs, ceiling rollers,
# closed storage casings and a broad low loading ramp. Casings grant no items.
box('cargo_bay', 'structure', (-1.875,1.125,1), (2.5,1.375,2.625))
for x in [-1.875,2.375]:
    box('cargo_bay', 'structure', (x,-2.25,.75), (x+.25,-1.75,3.125))
    box('cargo_bay', 'petrol', (x,-2.375,1), (x+.125,-2.25,2.875))
    box('cargo_bay', 'worn', (x,-2.5,1), (x+.125,-2.375,1.25))
for x0,x1 in [(-1.875,-.75),(.875,2.625)]:
    box('cargo_bay', 'structure', (x0,-2.25,2.875), (x1,-1.75,3.25))
box('cargo_bay', 'petrol', (-1.75,-2.375,3.375), (2.5,-2.25,3.5))
for x in [-1.5,-.75,0,.75,1.5,2.25]:
    box('cargo_bay', 'worn', (x,-2.5,3.25), (x+.25,-2.375,3.375))
    box('cargo_bay', 'amber', (x,-2.375,3.25), (x+.25,-2.25,3.375))
box('cargo_bay', 'worn', (-1.75,-2.375,.875), (2.375,-1.25,1))
for j in range(24):
    y = -2.5-j*Q
    # One-cell rises distributed over a 3 m run keep a voxel loading-ramp form.
    top = max(.125, 1-math.floor(j/3)*Q)
    box('cargo_bay', 'structure', (-1.5,y,top-Q), (2.125,y+Q,top))
    if j % 6 not in [0,1]:
        box('cargo_bay', 'worn', (-1.25,y,top-Q), (1.875,y+Q,top))
    for x in [-1.625,2.125]:
        box('cargo_bay', 'amber' if j % 4 < 2 else 'structure', (x,y,top), (x+Q,y+Q,top+Q))
# Raised, visible turn pad. It is flush with the existing bay deck at its
# outer edge and one 125 mm step above the inner ramp/deck transition.
box('cargo_bay', 'structure', (-.5,-1.125,1), (.625,.875,1.125))
# Four varied casings with reinforced corners, carrying handle and latch.
for x,y,w,h in [(-1.625,-.75,.875,1),(-1.625,.125,1.125,.75),
                (.625,-.75,.875,1),(.625,.125,.875,.5)]:
    box('cargo_bay','structure',(x,y,1),(x+w,y+.625,1+h))
    box('cargo_bay','petrol',(x+Q,y-Q,1+Q),(x+w-Q,y,1+h-Q))
    box('cargo_bay','worn',(x,y,1+h),(x+w,y+.625,1+h+Q))
    for xx in [x,x+w-Q]:
        box('cargo_bay','worn',(xx,y-Q,1),(xx+Q,y,1+h))
    box('cargo_bay','structure',(x+w/2-Q/2,y-2*Q,1+h-Q),(x+w/2+Q/2,y-Q,1+h))
    box('cargo_bay','amber',(x+w/2-Q/2,y-2*Q,1.375),(x+w/2+Q/2,y-Q,1.5))
# Depth cues on the inner wall and retained empty service shelf.
for x in [-1.25,0,1.25]:
    box('cargo_bay','petrol',(x,1,1.625),(x+.875,1.125,2.25))
    box('cargo_bay','amber',(x+.625,.875,1.875),(x+.75,1,2))

# Crumpled, sheared aft propulsion: circular nacelle rings, a missing sector,
# exposed central hubs and disconnected exhaust. No intact flight engine.
for side in [-1,1]:
    yc = side*1.125
    for lo,hi,outer,inner,mat in [(4.75,5.25,(1,1),(.625,.625),'structure'),
                                  (5.25,5.625,(1.125,1.125),(.75,.75),'worn'),
                                  (5.625,6.125,(1,1),(.625,.625),'structure'),
                                  (6.125,6.375,(1.125,1.125),(.875,.875),'ceramic')]:
        round_ring('rear',mat,0,lo,hi,(yc,1.875),outer,inner,
                   lambda u,v: side == -1 and v>.125 and u<.375)
    round_ring('rear','structure',0,5.625,6.5,(yc,1.875),(.375,.375),(.125,.125))
    for yoff,zoff in [(-.625,0),(.625,0),(0,-.625),(0,.625)]:
        if side == -1 and zoff > 0: continue
        box('rear','worn',(4.875,yc+yoff,1.875+zoff),(6.25,yc+yoff+Q,2+zoff))
# Jagged end bulkhead, exposed severed tubes, and a collapsed tail fin rather
# than the V1 single white staircase. Fin is a broad tapered sheet with spine.
box('rear','structure',(4.625,-.5,1.125),(6.875,.5,1.5))
for x,y,z,length in [(5,-.75,2.625,.875),(4.75,.625,3,.625),(5.25,1.75,2.5,.75)]:
    box('rear','petrol',(x,y,z),(x+length,y+Q,z+Q))
for j in range(18):
    x = 4.375+j*Q
    z = 2.875+j*Q
    chord = max(.5, round((2.25-j*.1)/Q)*Q)
    box('rear','structure',(x,.625,z),(x+chord,1,z+Q))
    if j < 17:
        box('rear','ceramic' if j%5 else 'worn',(x+Q,.5,z),(x+chord-Q,.625,z+Q))
        if j in [5,6,11]:
            remove((x+chord-2*Q,.5,z),(x+chord-Q,.625,z+Q))
    if j in [3,10,16]:
        box('rear','amber',(x+.125,.5,z+.125),(x+.25,.625,z+.25))

# Two discrete roof mounts, with ring pedestal, enclosed receiver armor,
# six hollow barrels, barrel brace, finite-magazine casing and visible pivot.
for part,x in [('turret_fore',-3.25),('turret_aft',2.875)]:
    round_ring(part,'structure',2,3.875,4.125,(x,0),(.75,.75),(0,0))
    round_ring(part,'worn',2,4.125,4.375,(x,0),(.5,.5),(0,0))
    box(part,'structure',(x-.5,-.625,4.375),(x+.625,.625,5.125))
    box(part,'ceramic',(x-.25,-.75,4.5),(x+.5,-.625,5.125))
    box(part,'ceramic',(x-.25,.625,4.5),(x+.5,.75,5.125))
    box(part,'ceramic',(x-.375,-.625,5.125),(x+.625,.625,5.25))
    box(part,'worn',(x+.5,-.625,4.5),(x+.75,.625,5.125))
    box(part,'petrol',(x+.625,-.625,4.5),(x+1.125,.625,5))
    for y in [-.75,.625]:
        box(part,'structure',(x+.75,y,4.625),(x+.875,y+Q,4.875))
        box(part,'amber',(x+.875,y,4.75),(x+1,y+Q,4.875))
    for yy in [-.625,.625]:
        round_ring(part,'worn',1,yy,yy+Q,(x-.125,4.75),(.25,.25),(0,0))
    box(part,'structure',(x-.625,-.625,4.5),(x-.5,.625,5.5))
    box(part,'ceramic',(x-.375,-.625,5.25),(x+.625,.625,5.5))
    for yy,zz in [(-.25,4.625),(.125,4.625),(-.5,4.875),(.375,4.875),(-.25,5.125),(.125,5.125)]:
        # Three-cell square tubes retain visible dark bores on the 125 mm grid.
        box(part,'structure',(x-1.875,yy,zz),(x-.5,yy+.375,zz+.375))
        box(part,'worn',(x-1.75,yy,zz),(x-1.625,yy+.375,zz+.375))
        remove((x-1.875,yy+Q,zz+Q),(x-1.75,yy+2*Q,zz+2*Q))
    round_ring(part,'structure',0,x-1.375,x-1.25,(0,5),(.75,.625),(.625,.5))
    box(part,'amber',(x,-.875,4.625),(x+Q,-.75,4.75))

# Grounded landing legs support the hull. Paired voxel diagonal
# braces, broad pads and one torn panel establish scale and impact direction.
for x in [-5.125,3.125]:
    for side in [-1,1]:
        for j in range(6):
            y = side*(1.375+j*Q)
            z = .875-j*Q
            box('debris','structure',(x,y,z),(x+.375,y+.25,z+.375))
            box('debris','worn',(x+.375,y,z),(x+.5,y+.25,z+.25))
        yy = side*2.125
        box('debris','structure',(x-.25,yy-.25,0),(x+.875,yy+.5,Q))
        box('debris','worn',(x-.125,yy-.125,Q),(x+.75,yy+.375,2*Q))

# Large recognizable detached aft armor sheets; no random resource confetti.
for j in range(16):
    x = 3.625+j*Q
    y = -2.375-j*Q
    z = .125+(.125 if 5<j<12 else 0)
    box('debris','structure',(x,y,z),(x+.25,y+1,z+.125))
    if j not in [3,11,14]:
        box('debris','ceramic' if j%5 else 'worn',(x,y,z+.125),(x+.25,y+.875,z+.25))
    if j in [4,5,6]:
        box('debris','petrol',(x,y,z+.25),(x+.25,y+.625,z+.375))
for x,y,w,h in [(6.125,-2.125,1,.375),(5.625,-3.125,.5,.25),
                 (4.625,2.25,.875,.375),(-6.75,-2,.75,.125),(6.75,.5,.5,.25)]:
    box('debris','worn',(x,y,0),(x+w,y+.5,h))
    box('debris','ceramic',(x+Q,y+Q,h),(x+w-Q,y+.375,h+Q))

# Deliberate small edge chips on selected plate margins, exposing substrate.
# These are stable authored cuts, not global per-cell random noise.
for lo,hi in [((-3.875,-2,1.125),(-3.625,-1.75,1.375)),
              ((-5.75,-1.625,1.375),(-5.5,-1.375,1.625)),
              ((2.625,-1.875,2.25),(2.875,-1.625,2.5)),
              ((3.875,1.5,2.875),(4.25,1.875,3.125))]:
    remove(lo,hi)

# Fine local art detail is separate from the 125 mm body silhouette. Refining
# the art lattice does not modify HVP cells, building steps or physics.
for part,x in [('turret_fore',-3.25),('turret_aft',2.875)]:
    remove((x-1.875,-.875,4.375),(x-.625,.875,5.625))
CELLS = {(x*2+dx,y*2+dy,z*2+dz): value
         for (x,y,z),value in CELLS.items()
         for dx in range(2) for dy in range(2) for dz in range(2)}
Q = .0625
for part,x in [('turret_fore',-3.25),('turret_aft',2.875)]:
    for yy,zz in [(-.25,4.6875),(.125,4.6875),(-.4375,4.875),(.3125,4.875),(-.25,5.0625),(.125,5.0625)]:
        box(part,'structure',(x-1.875,yy,zz),(x-.625,yy+.1875,zz+.1875))
        box(part,'worn',(x-1.8125,yy,zz),(x-1.75,yy+.1875,zz+.1875))
        remove((x-1.875,yy+Q,zz+Q),(x-.625,yy+2*Q,zz+2*Q))
    round_ring(part,'structure',0,x-1.3125,x-1.1875,(.03125,4.96875),(.5625,.4375),(.5,.375))
    # Small raised receiver cooling fins, authored as geometry.
    for xx in [x-.1875,x,x+.1875]:
        box(part,'worn',(xx,-.8125,4.6875),(xx+Q,-.75,4.9375))

# Local surface wear at visible ceramic margins. Restrict it to the lower
# prow and the two torn armor regions; intact roof plates stay calm/readable.
chip_cells=[]
for (ix,iy,iz),(part,mat) in CELLS.items():
    if part not in ['hull','cockpit'] or mat!='ceramic': continue
    x,y,z=(ix+.5)*Q,(iy+.5)*Q,(iz+.5)*Q
    region=(x < -4.5 and y < -.25 and z < 1.75) or (x > 2.5 and z > 1.75) or (-.25<x<2.5 and y<-.625 and z>3.375)
    if not region: continue
    outer=(ix,iy-1,iz) not in CELLS or (ix,iy,iz+1) not in CELLS
    if outer and (ix*17+iy*7+iz*11)%31 in [0,1]: chip_cells.append((ix,iy,iz))
for cell in chip_cells:
    part,_=CELLS[cell]; CELLS[cell]=part,'worn'

# Exposed-face greedy meshing: no instances or individual voxel objects.
planes = defaultdict(set)
for cell,(part,mat) in CELLS.items():
    for axis in range(3):
        uv = [i for i in range(3) if i != axis]
        for sign in [-1,1]:
            n = list(cell); n[axis] += sign
            if tuple(n) not in CELLS:
                planes[part,mat,axis,sign,cell[axis]+(1 if sign==1 else 0)].add((cell[uv[0]],cell[uv[1]]))
meshes = defaultdict(lambda: {'v': [], 'f': [], 'm': []})
for (part,mat,axis,sign,k),cells in sorted(planes.items()):
    uv = [i for i in range(3) if i != axis]
    while cells:
        u,v = min(cells); w=h=1
        while (u+w,v) in cells: w += 1
        while all((u+j,v+h) in cells for j in range(w)): h += 1
        for j in range(w):
            for l in range(h): cells.remove((u+j,v+l))
        points = []
        for a,b in [(u,v),(u+w,v),(u+w,v+h),(u,v+h)]:
            xyz = [0,0,0]; xyz[axis]=k*Q; xyz[uv[0]]=a*Q; xyz[uv[1]]=b*Q; points.append(xyz)
        if sign != (-1 if axis==1 else 1): points.reverse()
        mesh=meshes[part]; base=len(mesh['v']); mesh['v'].extend(points)
        mesh['f'].append(tuple(range(base,base+4))); mesh['m'].append(mat)

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
materials = {}
for name,h in PALETTE.items():
    c = [int(h[i:i+2],16)/255 for i in [0,2,4]]
    linear = [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
    m = bpy.data.materials.new(name); m.diffuse_color=(*linear,1); m.use_nodes=True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*linear,1)
    bs.inputs['Roughness'].default_value=.82 if name!='glass' else .32
    bs.inputs['Metallic'].default_value=.25 if name=='structure' else 0
    materials[name]=m
objects=[]
for part,data in sorted(meshes.items()):
    m=bpy.data.meshes.new(part); m.from_pydata(data['v'],[],data['f']); m.update()
    o=bpy.data.objects.new(part,m); bpy.context.collection.objects.link(o)
    for material in materials.values(): m.materials.append(material)
    for polygon,mat in zip(m.polygons,data['m']):
        polygon.material_index=list(materials).index(mat); polygon.use_smooth=False
    o['assetId']=ASSET_ID; o['partId']=part; o['worldAuthority']=False
    o['collisionPolicy']='None'; o['gameplayAdmission']='NOT_ADMITTED'
    o['flight']='PERMANENTLY_INOPERABLE'; o['artGridMeters']=Q; o['bodyGridMeters']=.125
    objects.append(o)
spec=json.loads((OUT/'MODEL_SPEC.json').read_text())
assert set(meshes)==set(spec['parts'])
assert sum(len(o.data.polygons)*2 for o in objects)<=spec['trianglesMax']

scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=48
scene.cycles.use_denoising=False; scene.render.resolution_x=1440
scene.render.resolution_y=900; scene.render.resolution_percentage=100
scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.55,.62,.65,1)
scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.45
scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
floor_mat=bpy.data.materials.new('PREVIEW_GROUND'); floor_mat.diffuse_color=(.28,.32,.33,1)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025))
bpy.context.object.name='PREVIEW_GROUND_NOT_ASSET'; bpy.context.object.data.materials.append(floor_mat)
def point(o,p): o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
for pos,power,size in [((-7,-10,14),2000,8),((3,8,11),1700,10),((9,-2,8),1100,6)]:
    bpy.ops.object.light_add(type='AREA',location=pos); o=bpy.context.object
    o.name='PREVIEW_LIGHT_NOT_ASSET'; o.data.energy=power; o.data.shape='DISK'; o.data.size=size; point(o,(0,0,2))
bpy.ops.object.camera_add(location=(-12,-19,10)); camera=bpy.context.object
camera.name='PREVIEW_CAMERA_NOT_ASSET'; scene.camera=camera; camera.data.type='ORTHO'
camera.data.ortho_scale=21; point(camera,(0,-.5,2))
scene['assetId']=ASSET_ID; scene['artGridMeters']=Q; scene['bodyGridMeters']=.125; scene['worldAuthority']=False
scene['flight']='PERMANENTLY_INOPERABLE'; scene['turretGameplay']='STATIC_ART_ONLY_FINITE_AMMO_FUTURE'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'crashsite-walkable-v1.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in objects: o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'crashsite-walkable-v1.glb'),export_format='GLB',use_selection=True,
                          export_extras=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
views=[('01-bay-and-turrets',(-13,-22,10),(0,-.5,2.125),21),
       ('02-rear-damage',(13,-19,9),(0,-.5,2),21),
       ('03-plan-access',(0,-.001,30),(0,-.5,0),22),
       ('04-cargo-detail',(-2,-15,5),(.375,-1.5,1.75),9),
       ('05-cockpit-and-turret',(-14,-14,8),(-4.25,0,2.75),10),
       ('06-broken-propulsion',(14,-9,7),(4.75,0,2.5),10)]
for name,pos,target,scale in views:
    camera.location=pos; camera.data.ortho_scale=scale; point(camera,target)
    scene.render.filepath=str(OUT/(name+'.png')); bpy.ops.render.render(write_still=True)
report={'schema':'hestia.crashsite.blender-authoring/v1','blenderVersion':bpy.app.version_string,
        'artGridMeters':Q,'partCount':len(objects),'cells':len(CELLS),
        'parts':[{'name':o.name,'quads':len(o.data.polygons),'vertices':len(o.data.vertices)} for o in objects],
        'turretParts':['turret_fore','turret_aft'],'flight':'PERMANENTLY_INOPERABLE',
        'worldAuthority':False,'collisionPolicy':'None','gameplayAdmission':'NOT_ADMITTED',
        'visualAcceptance':'OWNER_REVIEW_PENDING',
        'previewRigExported':False,'views':[v[0]+'.png' for v in views]}
report['outputs']=[{'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size}
                   for p in sorted(OUT.iterdir()) if p.suffix in {'.glb','.blend','.png'}]
(OUT/'AUTHORING_REPORT.json').write_text(json.dumps(report,indent=2)+'\n')
print('HESTIA_AUTHORING_REPORT='+json.dumps(report))
