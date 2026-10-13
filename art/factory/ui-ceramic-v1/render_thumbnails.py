"""Blender CPU thumbnails of existing sources. Never saves or changes a native source."""
import bpy,sys,json,hashlib,math
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index("--")+1:]
root=Path(args[0]);out=Path(args[1]);out.mkdir(parents=True,exist_ok=True)
entries={
 "cutter":"art/factory/play-2026-10-12/cutter/cutter/cutter.blend",
 "former":"art/factory/play-surface-v2-2026-10-12/former/former-v2/former-v2.blend",
 "carrier":"art/factory/play-2026-10-12/carrier/carrier-heavy/carrier-heavy.blend",
 "battery":"art/factory/play-2026-10-12/power-kit/battery/battery.blend",
 "cable":"art/factory/play-2026-10-12/power-kit/cable-link/cable-link.blend",
 "storage":"art/factory/play-2026-10-12/storage/storage/storage.blend",
 "bench":"art/factory/play-2026-10-12/workbench/workbench/workbench.blend",
 "brace":"art/factory/play-2026-10-12/brace/brace/brace.blend",
 "belt":"art/factory/play-2026-10-12/belt/belt/belt.blend",
 "steel":"art/factory/play-2026-10-12/materials/steel/steel.blend",
 "semi":"art/factory/play-2026-10-12/materials/semi/semi.blend",
 "sheet":"art/factory/play-2026-10-12/materials/sheet/sheet.blend",
 "profile":"art/factory/play-2026-10-12/materials/profile/profile.blend",
 "offcut":"art/factory/play-2026-10-12/materials/offcut/offcut.blend",
}
records=[]
for name,relative in entries.items():
 source=root/relative
 if not source.exists():raise RuntimeError("Missing actual source: "+str(source))
 before=hashlib.sha256(source.read_bytes()).hexdigest()
 bpy.ops.wm.open_mainfile(filepath=str(source))
 scene=bpy.context.scene
 meshes=[o for o in scene.objects if o.type=="MESH" and not o.hide_render]
 points=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
 lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
 center=(lo+hi)/2;extent=max(hi-lo)
 for o in scene.objects:
  if o.type in ["CAMERA","LIGHT"]:o.hide_render=True
 camera=bpy.data.objects.new("UiThumbnailCamera",bpy.data.cameras.new("UiThumbnailCamera"));scene.collection.objects.link(camera)
 camera.data.type="ORTHO";camera.data.ortho_scale=extent*1.65;camera.location=center+Vector((1.5,-2.3,1.8))*extent
 camera.rotation_euler=(center-camera.location).to_track_quat("-Z","Y").to_euler();scene.camera=camera
 for index,(direction,power) in enumerate([((2,-3,4),900),((-3,-1,2),650),((1,3,3),1000)]):
  light=bpy.data.objects.new("UiThumbnailLight"+str(index),bpy.data.lights.new("UiThumbnailLight"+str(index),"AREA"));scene.collection.objects.link(light)
  light.location=center+Vector(direction)*extent;light.rotation_euler=(center-light.location).to_track_quat("-Z","Y").to_euler();light.data.energy=power*extent*extent;light.data.size=extent*3
 scene.render.engine="CYCLES";scene.cycles.device="CPU";scene.cycles.samples=16;scene.cycles.use_denoising=False
 scene.render.resolution_x=192;scene.render.resolution_y=192;scene.render.resolution_percentage=100
 scene.render.film_transparent=True;scene.render.image_settings.file_format="PNG";scene.render.image_settings.color_mode="RGBA"
 scene.view_settings.view_transform="Standard";scene.view_settings.look="None";scene.view_settings.exposure=0;scene.view_settings.gamma=1
 target=out/(name+".png");scene.render.filepath=str(target);bpy.ops.render.render(write_still=True)
 after=hashlib.sha256(source.read_bytes()).hexdigest()
 assert before==after,"Native source changed"
 records.append({"name":name,"source":relative,"sourceSha256":before,"output":name+".png","outputSha256":hashlib.sha256(target.read_bytes()).hexdigest(),"bytes":target.stat().st_size,"dimensions":[192,192],"transparent":True,"renderer":"Blender Cycles CPU 16 samples; no denoising","sourceUnchanged":True})
 (out/"THUMBNAIL_MANIFEST.json").write_text(json.dumps({"kind":"ACTUAL_BLENDER_UI_THUMBNAILS","sourcesUnchanged":True,"runtimeGeometryModified":False,"items":records},indent=2)+"\n")
 print("UI_THUMBNAIL_DONE "+name,flush=True)
