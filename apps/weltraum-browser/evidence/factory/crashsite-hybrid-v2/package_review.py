"""Package actual sources/renders. Never modify old deliveries or use LFS pointers."""
from pathlib import Path
import base64
import hashlib
import html
import json
import re
import shutil
import struct
import subprocess
import zipfile

REPO=Path(__file__).resolve().parents[5]
ASSET=REPO/'art/factory/crashsite-hybrid-v2'
EVIDENCE=Path(__file__).resolve().parent
DOCS=REPO/'docs/factory/fp06/play/2026-10-13/crashsite-hybrid-v2'
DEST=Path('/workspace/review-packages/Hestia-Wreck-V2-2026-10-13')
ARCHIVE=DEST.with_suffix('.zip')
assert not DEST.exists() and not ARCHIVE.exists(), 'Preserve existing delivery'
assert (DOCS/'INDEPENDENT_REVIEW.md').is_file(), 'Independent review must be present'
measure=json.loads((ASSET/'STATIC_VALIDATION.json').read_text())
author=json.loads((ASSET/'AUTHORING_REPORT.json').read_text())
assert author['artGridMeters']==measure['artGridMeters']==.0625
for entry in author['outputs']:
    p=ASSET/entry['file']
    assert hashlib.sha256(p.read_bytes()).hexdigest()==entry['sha256'], p
for folder in ['source','images','evidence','report']: (DEST/folder).mkdir(parents=True)
def copy(src, rel):
    target=DEST/rel; target.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(src,target)
    assert not target.read_bytes().startswith(b'version https://git-lfs.github.com/spec/'), target
for p in ASSET.iterdir():
    if p.is_file() and p.suffix!='.png': copy(p,'source/'+p.name)
for p in DOCS.iterdir():
    if p.is_file(): copy(p,'report/'+p.name)
for p in EVIDENCE.iterdir():
    if p.is_file() and p.suffix in ['.json','.log','.mjs','.py']: copy(p,'evidence/'+p.name)
copy(REPO/'LICENSE','LICENSE')
views=[('Approved visual reference · AI concept, not an asset or gameplay screenshot',
        REPO/'art/factory/visual-reference/2026-10-13/crashsite/03-hybrid-revision.png','00-approved-reference.png'),
       ('V1 · previous actual Blender model',REPO/'art/factory/crashsite-hybrid-v1/01-bay-and-turrets.png','00-previous-v1.png')]
captions=['V2 · hull, loading bay and both roof mounts','V2 · torn rear and retained hull',
          'V2 · overhead silhouette and bay access','V2 · recessed cargo bay and ramp',
          'V2 · enclosed cockpit and forward gun','V2 · broken propulsion and tail fin']
for caption,name in zip(captions,json.loads((ASSET/'MODEL_SPEC.json').read_text())['requiredViews']):
    views.append((caption,ASSET/name,name))
views.append(('V1 / V2 · actual Three.js GLB imports, identical camera and lighting; detached review',
              EVIDENCE/'07-browser-comparison.png','07-browser-comparison.png'))
for _,src,name in views: copy(src,'images/'+name)
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip()
header=f'''# Hestia wreck — V2 visual review

Actual Blender model and GLB from commit `{head}`. This package follows the
owner-approved hybrid reference and the critique of V1. All V2 model views
are actual Blender renders; only the first reference is AI concept imagery.

The intended improvements are a full stepped hull, enclosed inclined canopy,
deep loading bay, broad ramp, layered armor over exposed ribs, grounded landing
supports, torn propulsion and two idle roof Gatlings with enclosed magazine
casings. The 15.125 m ship remains permanently unable to fly.

The body grid is 125 mm; local barrel and surface detail is 62.5 mm. These are
art grids. The separate build/terrain grids and the native World are unchanged.

**Visual: OWNER_REVIEW_PENDING. Gameplay admission: NOT_ADMITTED.**
The live wreck has not been replaced. Cargo, material history, native
colliders, terrain, recipes and Save contracts remain unchanged. Turrets are
static art; no defense behavior or free ammunition is included. W09/W10/W11
completion is not claimed by this art package.

| Technical check | Result |
|---|---|
| GLB byte policy | PASS: {measure['triangles']:,} triangles, {measure['drawCalls']} material primitives, six materials, no textures |
| Actual native source reopen | PASS; source hash unchanged |
| Normal TypeScript / Vite build | PASS; source/public/dist GLB payloads match |
| Detached Three.js import | PASS; both real GLBs, no TestBridge or gameplay World |
| Human aesthetic / style approval | OWNER_REVIEW_PENDING |
| Live access, collision and full gameplay flow with V2 | NOT_RUN / NOT_ADMITTED |

Two local authoring passes were used. An independent read-only review is in
`report/INDEPENDENT_REVIEW.md`. A technical PASS does not establish fidelity
to the concept or human visual approval. Remaining visual drift is recorded
there.

Open `GALLERY.html` for a standalone gallery with embedded images. Markdown
uses the included `images/` directory; keep it beside this file after unzip.
The native `.blend`, real `.glb`, authoring script and validator are in
`source/`. Root `LICENSE` applies. No paid generation or third-party models.

Rebuild the asset with installed Blender 4.3.2 and Python 3:

```bash
cd source
blender -b -t 2 --python build_crashsite.py
python3 validate_asset.py
```

## Image review

'''
md=header
gallery=[]
for caption,_,name in views:
    md+=f'### {caption}\n\n![{caption}](images/{name})\n\n'
    data=base64.b64encode((DEST/'images'/name).read_bytes()).decode()
    gallery.append(f'<figure><img src="data:image/png;base64,{data}" alt="{html.escape(caption)}"><figcaption>{html.escape(caption)}</figcaption></figure>')
(DEST/'REVIEW.md').write_text(md)
(DEST/'GALLERY.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hestia wreck V2 review</title><style>
body{margin:0;background:#202c2e;color:#e7dfcf;font:17px/1.55 system-ui}main{max-width:1440px;margin:auto;padding:28px}h1{font-size:32px;margin-bottom:8px}p{max-width:1000px}figure{margin:36px 0}img{display:block;width:100%;height:auto;background:#405257}figcaption{padding:12px 0;color:#c8d0c9}.state{color:#e8b65e}a{color:#a9d8d0}</style><main>
<h1>Hestia wreck · V2 actual model review</h1><p>Six actual Blender views and a paired Three.js GLB import. The approved AI concept and the previous V1 model are clearly labelled.</p>
<p class="state">OWNER_REVIEW_PENDING · NOT_ADMITTED TO GAMEPLAY</p><p>Actual .blend and .glb sources are in the ZIP. The native World, cargo, colliders, terrain and Save are unchanged. Both turrets are idle art with future finite-ammunition intent.</p>
'''+''.join(gallery)+'</main></html>')
receipt={'schema':'hestia.asset.delivery/v1','sourceCommit':head,'model':'hestia_crashsite_hybrid_v2',
         'actualNativeSource':True,'actualGLB':True,'humanAcceptance':'OWNER_REVIEW_PENDING',
         'runtimeAdmission':'NOT_ADMITTED','worldAuthority':False,'imageCount':len(views),
         'sourceGLBSha256':measure['sha256'],'nativeSha256':measure['nativeSha256']}
(DEST/'DELIVERY_RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n')
files=sorted(p for p in DEST.rglob('*') if p.is_file())
(DEST/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+str(p.relative_to(DEST))+'\n' for p in files))
files=sorted(p for p in DEST.rglob('*') if p.is_file())
manifest={'schema':'hestia.review.manifest/v1','files':[{'path':str(p.relative_to(DEST)),
          'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]}
(DEST/'MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
for p in DEST.rglob('*'): p.chmod(0o755 if p.is_dir() else 0o644)
DEST.chmod(0o755)
for image_path in re.findall(r'!\[[^\]]*\]\(([^)]+)\)',md):
    raw=(DEST/image_path).read_bytes(); assert raw[:8]==b'\x89PNG\r\n\x1a\n'
    assert min(struct.unpack_from('>II',raw,16))>0
with zipfile.ZipFile(ARCHIVE,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in sorted(DEST.rglob('*')):
        if p.is_file(): z.write(p,DEST.name+'/'+str(p.relative_to(DEST)))
ARCHIVE.chmod(0o644)
with zipfile.ZipFile(ARCHIVE) as z:
    assert z.testzip() is None
    for entry in manifest['files']:
        raw=z.read(DEST.name+'/'+entry['path'])
        assert len(raw)==entry['bytes'] and hashlib.sha256(raw).hexdigest()==entry['sha256']
archive_receipt={'result':'PASS','archive':str(ARCHIVE),'bytes':ARCHIVE.stat().st_size,
                 'sha256':hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),'manifestFilesVerified':len(manifest['files']),
                 'markdownImagesVerified':len(views),'embeddedHTMLImages':len(views),'sourceCommit':head}
ARCHIVE.with_suffix('.receipt.json').write_text(json.dumps(archive_receipt,indent=2)+'\n')
print(json.dumps(archive_receipt,indent=2))
