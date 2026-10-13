"""Inspect actual GLB bytes against the predeclared policy, standard library only."""
from pathlib import Path
import hashlib
import json
import math
import struct

ROOT = Path(__file__).resolve().parent
spec = json.loads((ROOT/'MODEL_SPEC.json').read_text())
file = ROOT/'crashsite-hybrid-v2.glb'
raw = file.read_bytes()
magic,version,length = struct.unpack_from('<4sII',raw)
assert (magic,version,length)==(b'glTF',2,len(raw))
offset=12; chunks=[]
while offset<len(raw):
    size,kind=struct.unpack_from('<I4s',raw,offset); offset+=8
    assert offset+size<=len(raw)
    chunks.append((kind,raw[offset:offset+size])); offset+=size
assert len(chunks)==2 and chunks[0][0]==b'JSON' and chunks[1][0]==b'BIN\0'
doc=json.loads(chunks[0][1]); binary=chunks[1][1]
assert doc['asset']['version']=='2.0'
assert not doc.get('animations') and not doc.get('textures') and not doc.get('images')
assert not doc.get('cameras') and not doc.get('extensionsUsed')
assert len(doc['materials'])<=spec['materialsMax']
assert len(doc['meshes'])==spec['partsMax']
assert sorted(m['name'] for m in doc['meshes'])==spec['parts']
types={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
formats={5123:('H',2),5125:('I',4),5126:('f',4)}
def values(index):
    a=doc['accessors'][index]; view=doc['bufferViews'][a['bufferView']]
    assert not a.get('sparse') and view['buffer']==0
    form,size=formats[a['componentType']]; width=types[a['type']]
    stride=view.get('byteStride',width*size)
    base=view.get('byteOffset',0)+a.get('byteOffset',0)
    assert base+(a['count']-1)*stride+width*size<=len(binary)
    return [struct.unpack_from('<'+form*width,binary,base+i*stride) for i in range(a['count'])]
bounds=[[math.inf]*3,[-math.inf]*3]; triangles=vertices=draws=0; part_results=[]
for node in doc['nodes']:
    assert node.get('translation',[0,0,0])==[0,0,0]
    assert node.get('scale',[1,1,1])==[1,1,1]
    assert node.get('rotation',[0,0,0,1])==[0,0,0,1]
    assert 'matrix' not in node and 'camera' not in node
    e=node['extras']
    assert e['assetId']==spec['assetId'] and e['worldAuthority'] is False
    assert e['collisionPolicy']=='None' and e['gameplayAdmission']=='NOT_ADMITTED'
    assert e['flight']=='PERMANENTLY_INOPERABLE'
for mesh in doc['meshes']:
    count=0
    for primitive in mesh['primitives']:
        assert primitive.get('mode',4)==4 and set(primitive['attributes'])=={'POSITION','NORMAL'}
        pos=values(primitive['attributes']['POSITION']); norm=values(primitive['attributes']['NORMAL'])
        indices=[v[0] for v in values(primitive['indices'])]
        assert len(indices)%3==0 and max(indices)<len(pos)
        assert len(pos)==len(norm)
        for p,n in zip(pos,norm):
            assert all(math.isfinite(v) for v in p+n)
            assert all(abs(v/spec['artGridMeters']-round(v/spec['artGridMeters']))<1e-6 for v in p)
            assert sorted(abs(v) for v in n)==[0,0,1], 'All faces must retain hard voxel normals'
            for j in range(3): bounds[0][j]=min(bounds[0][j],p[j]); bounds[1][j]=max(bounds[1][j],p[j])
        for i in range(0,len(indices),3):
            a,b,c=[pos[indices[i+j]] for j in range(3)]
            u=[b[j]-a[j] for j in range(3)]; v=[c[j]-a[j] for j in range(3)]
            cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
            assert sum(x*x for x in cross)>0, 'No degenerate faces'
            assert sum(cross[j]*norm[indices[i]][j] for j in range(3))>0, 'Winding must face out'
        count+=len(indices)//3; vertices+=len(pos); draws+=1
    triangles+=count; part_results.append({'part':mesh['name'],'triangles':count})
assert triangles<=spec['trianglesMax'] and draws<=spec['drawCallsMax']
assert bounds[0][1]==0 and 14<=bounds[1][0]-bounds[0][0]<=18
assert sorted(n['name'] for n in doc['nodes'] if n['name'].startswith('turret_'))==['turret_aft','turret_fore']
native=(ROOT/'crashsite-hybrid-v2.blend').read_bytes()
assert native.startswith(b'BLENDER'), 'Native source must be a real uncompressed Blender file'
report={'kind':'ACTUAL_STATIC_GLB_INSPECTION','result':'PASS','sha256':hashlib.sha256(raw).hexdigest(),
        'bytes':len(raw),'triangles':triangles,'vertices':vertices,'drawCalls':draws,'parts':part_results,
        'materials':len(doc['materials']),'textures':0,'boundsYupM':{'min':bounds[0],'max':bounds[1]},
        'artGridMeters':spec['artGridMeters'],'nativeBytes':len(native),'nativeSha256':hashlib.sha256(native).hexdigest(),
        'flight':'PERMANENTLY_INOPERABLE','exactTurretCount':2,'worldAuthority':False,
        'runtimeAdmission':'NOT_ADMITTED','visualAcceptance':'OWNER_REVIEW_PENDING'}
(ROOT/'STATIC_VALIDATION.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
