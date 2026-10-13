"""Open the actual saved Blender source; inspect it without saving/mutating."""
import bpy
import json
from pathlib import Path
parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('assetId')=='hestia_crashsite_hybrid_v2']
assert len(parts)==8
assert sorted(o.name for o in parts if o.name.startswith('turret_'))==['turret_aft','turret_fore']
assert bpy.context.scene['flight']=='PERMANENTLY_INOPERABLE'
assert bpy.context.scene['worldAuthority'] is False
for o in parts:
    assert not o.modifiers and o.get('worldAuthority') is False
    assert o.get('collisionPolicy')=='None' and o.get('gameplayAdmission')=='NOT_ADMITTED'
    assert o.scale[:]==(1,1,1) and o.location[:]==(0,0,0)
    assert all(not p.use_smooth for p in o.data.polygons)
report={'result':'PASS','kind':'ACTUAL_NATIVE_SOURCE_REOPEN','blenderVersion':bpy.app.version_string,
        'parts':[{'name':o.name,'quads':len(o.data.polygons),'vertices':len(o.data.vertices)} for o in sorted(parts,key=lambda o:o.name)],
        'sourceModified':False,'previewRigPresent':bpy.context.scene.camera.name=='PREVIEW_CAMERA_NOT_ASSET',
        'runtimeAdmission':'NOT_ADMITTED','visualAcceptance':'OWNER_REVIEW_PENDING'}
(Path(__file__).resolve().parent/'native-reopen.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
