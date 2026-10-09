"""Freeze and verify only the actual local product inputs and build bytes."""
import hashlib,json,pathlib,shutil,sys

wt=pathlib.Path(__file__).resolve().parents[5]
app=wt/'apps/weltraum-browser'
build,receipt=map(lambda p:pathlib.Path(p).resolve(),sys.argv[1:3]);action=sys.argv[3]
assert build.is_relative_to(app) and receipt.is_relative_to(wt)
paths=list((app/'src').rglob('*'))+list((app/'public').rglob('*'))
paths += [app/name for name in ('package.json','package-lock.json','tsconfig.json','vite.config.ts')]
paths=sorted({p for p in paths if p.is_file()})
def row(path,root):
    assert not path.is_symlink() and not path.is_junction()
    value=path.read_bytes()
    return {'path':path.relative_to(root).as_posix(),'bytes':len(value),'sha256':hashlib.sha256(value).hexdigest()}
source=[row(p,wt) for p in paths]
built=[row(p,build) for p in sorted(build.rglob('*')) if p.is_file()]
assert source and any(r['path']=='index.html' for r in built)
assert any('physicsWorker-' in r['path'] for r in built)
digest=lambda rows:hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest()
state={'classification':'PRODUCT_SOURCE_BUILD_BINDING_NOT_GAME_QUALIFICATION','source':source,'built':built,
       'sourceManifestHash':digest(source),'buildManifestHash':digest(built)}
if action=='freeze':
    frozen=receipt.parent/(receipt.stem+'-source')
    assert not receipt.exists() and not frozen.exists(),'Existing evidence overwrite refused'
    for path in paths:
        destination=frozen/path.relative_to(wt);destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(path,destination)
    receipt.parent.mkdir(parents=True,exist_ok=True)
    with receipt.open('x',encoding='utf-8') as stream:json.dump(state,stream,indent=2)
else:
    assert action=='verify' and json.loads(receipt.read_text(encoding='utf-8'))==state,'Product Source/build changed'
print(json.dumps({'status':'BOUND' if action=='freeze' else 'UNCHANGED','sourceFiles':len(source),'builtFiles':len(built),
                  'sourceManifestHash':state['sourceManifestHash'],'buildManifestHash':state['buildManifestHash']}))
