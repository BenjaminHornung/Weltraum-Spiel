"""Seal and independently re-read the finite experiment package; no private folders/deps."""
import hashlib,json,pathlib,sys,zipfile
spec=pathlib.Path(__file__).resolve().parent;wt=spec.parents[3]
out=wt/'artifacts/hestia-cut-source-gates-20261007/deliverables/Hestia_Cut_Source_Gates_EXPERIMENTAL_2026-10-07.zip'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def checked_files(root):
    for p in sorted(root.rglob('*')):
        rel=p.relative_to(root)
        if any(n in rel.parts for n in ['node_modules','__pycache__','.git','.opencode']):continue
        assert not p.is_symlink(),f'Symlink refused {rel}'
        if p.is_file():yield p
if sys.argv[1]=='make':
    assert not out.exists() and not (spec/'MANIFEST.json').exists(),'Sealed overwrite refused'
    assert (spec/'REPORT.md').is_file() and (spec/'RESULTS.json').is_file()
    payload={}
    for p in checked_files(spec):payload['spec/'+p.relative_to(spec).as_posix()]=p
    build=wt/'artifacts/hestia-cut-source-gates-20261007/final-r02-build'
    for p in checked_files(build):payload['built/'+p.relative_to(build).as_posix()]=p
    payload['LICENSE']=wt/'LICENSE'
    manifest={'classification':'EXPERIMENTAL_FINITE_GATES_NOT_PLANNER_FINAL','originalGoalComplete':False,
              'formal42':False,'formal1400':False,'files':[{'path':n,'bytes':p.stat().st_size,'sha256':digest(p)} for n,p in payload.items()]}
    content=json.dumps(manifest,indent=2).encode();(spec/'MANIFEST.json').write_bytes(content)
    out.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(out,'x',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for name,p in payload.items():z.write(p,name)
        z.writestr('MANIFEST.json',content)
    print(json.dumps({'zip':str(out),'files':len(payload),'bytes':out.stat().st_size,'zipSha256':digest(out),'manifestSha256':hashlib.sha256(content).hexdigest()}))
else:
    assert sys.argv[1]=='check'
    expected=sys.argv[2]
    with zipfile.ZipFile(out) as z:
        assert z.testzip() is None
        names=z.namelist();assert len(names)==len(set(n.lower() for n in names))
        assert all(not pathlib.PurePosixPath(n).is_absolute() and '..' not in pathlib.PurePosixPath(n).parts for n in names)
        raw=z.read('MANIFEST.json');assert hashlib.sha256(raw).hexdigest()==expected,'Manifest anchor mismatch'
        m=json.loads(raw);assert m['originalGoalComplete'] is False and m['formal42'] is False and m['formal1400'] is False
        assert set(names)=={'MANIFEST.json'}|{r['path'] for r in m['files']}
        for row in m['files']:
            value=z.read(row['path']);assert len(value)==row['bytes'] and hashlib.sha256(value).hexdigest()==row['sha256']
    print(json.dumps({'status':'VERIFIED','files':len(m['files']),'zipSha256':digest(out),'manifestSha256':expected}))
