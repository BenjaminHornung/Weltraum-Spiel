"""Bind an explicit source manifest and every actual product preview response byte."""
import hashlib,json,pathlib,sys,urllib.parse,urllib.request
wt=pathlib.Path(__file__).resolve().parents[5]
build,output=map(pathlib.Path,sys.argv[1:3]);base=sys.argv[3]
assert build.resolve().is_relative_to(wt) and output.resolve().is_relative_to(wt)
assert base=='http://127.0.0.1:5289' and not output.exists()
binding_path=pathlib.Path(sys.argv[4]) if len(sys.argv)>4 else wt/'.devtoolbox/specs/changes/hestia-cut-source-gates-2026-10-07/tests/final-r02-binding.json'
assert binding_path.resolve().is_relative_to(wt)
binding=json.loads(binding_path.read_text())
sha=lambda value:hashlib.sha256(value).hexdigest()
for row in binding['source']:
    value=(wt/row['path']).read_bytes();assert len(value)==row['bytes'] and sha(value)==row['sha256'],'Source changed'
source_hash=sha(json.dumps(binding['source'],sort_keys=True).encode())
assert source_hash==binding.get('sourceManifestHash','cdce5dc042b8366a5835d81f3d106d22127a436f468d805c9abc0fe111c0df4b')
rows=[]
for path in sorted(build.rglob('*')):
    assert not path.is_symlink() and not path.is_junction()
    if not path.is_file():continue
    name=path.relative_to(build).as_posix();value=path.read_bytes()
    with urllib.request.urlopen(base+'/'+urllib.parse.quote(name,safe='/'),timeout=20) as response:
        assert response.status==200 and response.read()==value,'Preview bytes differ from built file'
    rows.append({'path':name,'bytes':len(value),'sha256':sha(value)})
assert any(r['path']=='index.html' for r in rows) and any('physicsWorker-' in r['path'] for r in rows)
receipt={'classification':'NORMAL_PRODUCT_SERVED_BYTE_PROOF_NOT_GAME_QUALIFICATION','sourceBinding':str(binding_path.relative_to(wt)),
 'sourceFiles':len(binding['source']),'sourceManifestHash':source_hash,'servedFiles':len(rows),'built':rows,
 'buildManifestHash':sha(json.dumps(rows,sort_keys=True).encode()),'normalProduct':True,'gamePlaytested':False}
with output.open('x',encoding='utf-8') as stream:json.dump(receipt,stream,indent=2)
print(json.dumps({k:v for k,v in receipt.items() if k!='built'}))
