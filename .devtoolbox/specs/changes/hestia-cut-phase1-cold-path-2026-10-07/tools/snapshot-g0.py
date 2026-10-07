"""Recoverable exact scoped E bytes; excludes private tools, dependencies and caches."""
import hashlib,json,pathlib,subprocess,zipfile

spec=pathlib.Path(__file__).resolve().parents[1]
wt=spec.parents[3]
git=r'C:\IFI_SourceCode\Utils\opencode-migration\runtime\git\cmd\git.exe'
def query(*args):
    return subprocess.check_output([git,*args],cwd=wt).decode('utf-8').strip()
def sha(data):return hashlib.sha256(data).hexdigest()
out=wt/'artifacts/hestia-cut-phase1-20261007/g0-r01/working-tree-checkpoint.zip'
assert not out.exists(),'Checkpoint overwrite refused'
assert not query('diff','--cached','--name-only'),'Foreign index state: stop before checkpoint'
paths={wt/p for p in query('diff','--name-only','--','apps/weltraum-browser').splitlines()}
roots=[wt/'apps/weltraum-browser/src/hestia-prototype/experiments']
roots += [wt/'.devtoolbox/specs/changes'/n for n in ['hestia-cut-core-experiments-2026-10-07','hestia-cut-source-gates-2026-10-07']]
for root in roots:
    for p in root.rglob('*'):
        if any(s in p.parts for s in ['node_modules','__pycache__','.git','.opencode','.vite']):continue
        assert not p.is_symlink() and not p.is_junction(),'Reparse payload refused'
        if p.is_file():paths.add(p)
payload={p.relative_to(wt).as_posix():p.read_bytes() for p in sorted(paths)}
assert all(not pathlib.PurePosixPath(n).is_absolute() and '..' not in pathlib.PurePosixPath(n).parts for n in payload)
assert all(pathlib.PurePosixPath(n).suffix.lower() not in ['.pem','.pfx','.p12','.key'] and not pathlib.PurePosixPath(n).name.startswith('.env') for n in payload)
payload['working-tree.patch']=subprocess.check_output([git,'diff','--binary','--','apps/weltraum-browser'],cwd=wt)
manifest={'classification':'EXPERIMENT_CHECKPOINT_NOT_PRODUCT_MIGRATION','head':query('rev-parse','HEAD'),
 'tree':query('rev-parse','HEAD^{tree}'),'branch':query('branch','--show-current'),
 'excluded':'private .opencode; dependency/cache folders; unrelated worktrees and generated nested DevToolbox config',
 'files':[{'path':n,'bytes':len(v),'sha256':sha(v)} for n,v in payload.items()]}
encoded=json.dumps(manifest,indent=2).encode()
out.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(out,'x',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for n,value in payload.items():z.writestr(n,value)
    z.writestr('MANIFEST.json',encoded)
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None and len(z.namelist())==len(payload)+1
    assert sha(z.read('MANIFEST.json'))==sha(encoded)
    for row in manifest['files']:
        data=z.read(row['path']);assert len(data)==row['bytes'] and sha(data)==row['sha256']
receipt={'zip':str(out),'files':len(payload),'bytes':out.stat().st_size,'zipSha256':sha(out.read_bytes()),
 'manifestSha256':sha(encoded),'status':'BYTE_VERIFIED','head':manifest['head'],'tree':manifest['tree'],'branch':manifest['branch']}
(out.parent/'CHECKPOINT.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
print(json.dumps(receipt))
