"""Generate reviewable patches from checksum-bound originals; never edit product files."""
from pathlib import Path
import difflib, hashlib, json, tarfile, zipfile

root = Path.cwd()
def sha(data): return hashlib.sha256(data).hexdigest()
def emit(path, data):
    path = root / path
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('xb') as output: output.write(data)
def patch(old, new, before, after):
    return ''.join(difflib.unified_diff(old.decode().splitlines(True), new.decode().splitlines(True),
        fromfile=before, tofile=after)).encode()

rapier = json.loads((root/'upstream/source-provenance.json').read_text())
archive = root/'.upstream-cache'/f"rapier-{rapier['gitHead']}.zip"
assert sha(archive.read_bytes()) == rapier['archiveSha256']
native_rows, native_patch = [], b''
with zipfile.ZipFile(archive) as z:
    prefix = f"rapier-{rapier['gitHead']}/"
    for row in rapier['files']:
        old = z.read(prefix+row['path'])
        assert sha(old) == row['sha256']
        new = (root/'upstream/source'/row['path']).read_bytes()
        if old != new:
            native_rows.append({'path':row['path'], 'before':sha(old), 'after':sha(new)})
            native_patch += patch(old,new,'a/'+row['path'],'b/'+row['path'])
emit('upstream/patches/rapier.diff', native_patch)
parry = json.loads((root/'upstream/parry-provenance.json').read_text())
crate = list((root/'.cargo-home/registry/cache').rglob('parry3d-0.31.1.crate'))
assert len(crate) == 1 and sha(crate[0].read_bytes()) == parry['originalArchiveSha256']
parry_rows, parry_patch = [], b''
with tarfile.open(crate[0]) as t:
    for row in parry['files']:
        path = row['path'].removeprefix('upstream/parry3d/')
        old = t.extractfile('parry3d-0.31.1/'+path).read()
        assert sha(old) == row['sha256']
        new = (root/row['path']).read_bytes()
        if old != new:
            parry_rows.append({'path':path,'before':sha(old),'after':sha(new)})
            parry_patch += patch(old,new,'a/'+path,'b/'+path)
emit('upstream/patches/parry.diff', parry_patch)
manifest = json.loads((root/'source-manifest.json').read_text())
product_rows, product_patch = [], b''
for row in manifest['files']:
    path = row['path'] if 'path' in row else row['sourcePath']
    short = path.removeprefix('apps/weltraum-browser/')
    old = (root/'snapshot/a'/short).read_bytes()
    new = (root/'snapshot/c'/short).read_bytes()
    if old != new:
        product_rows.append({'path':path,'before':sha(old),'candidateSnapshot':sha(new)})
        # Proposal resolves lab imports at the mature product port; A0 owns application.
        proposed = new.replace(b'"../../../../../src/rapier021Candidate"',b'"./rapier021Candidate"')
        proposed = proposed.replace(b'"../../../../src/rapier021Candidate"',b'"../../src/hestia-prototype/physics/rapier021Candidate"')
        product_patch += patch(old,proposed,'a/'+path,'b/'+path)
bridge = (root/'src/rapier021Candidate.ts').read_bytes()
bridge = bridge.replace(b'"../upstream/candidate-package/migration2/dist/rapier"',b'"../../../vendor/rapier-phy01-migration2/dist/rapier"')
bridge = bridge.replace(b'"../upstream/candidate-package/migration2/profile.json"',b'"../../../vendor/rapier-phy01-migration2/profile.json"')
bridge = bridge.replace(b'"../snapshot/c/src/hestia-prototype/physics/profile"',b'"./profile"')
path = 'apps/weltraum-browser/src/hestia-prototype/physics/rapier021Candidate.ts'
product_patch += patch(b'',bridge,'/dev/null','b/'+path)
emit('product-proposal.diff',product_patch)
emit('migration-patches.json',(json.dumps({'upstreamRevision':rapier['gitHead'], 'rapierChanges':native_rows,
    'parryChanges':parry_rows,'productChanges':product_rows, 'proposedBridge':path,
    'productApplied':False,'vendorRequired':'apps/weltraum-browser/vendor/rapier-phy01-migration2 = exact candidate-package/migration2',
    'profileSelection':'LAB_COMPATIBILITY_ONLY_A0_MUST_EXPLICITLY_DECIDE',
    'patches':{'rapier':sha(native_patch),'parry':sha(parry_patch),'product':sha(product_patch)}},indent=2)+'\n').encode())
print(json.dumps({'rapierChanged':len(native_rows),'parryChanged':len(parry_rows),'productChanged':len(product_rows)}))
