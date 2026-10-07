"""Bind the existing probe's actual production files and retain measured Source bytes."""
import hashlib, json, pathlib, shutil, sys

spec = pathlib.Path(__file__).resolve().parent
wt = spec.parents[3]
build, receipt, action = map(str, sys.argv[1:])
build, receipt = pathlib.Path(build).resolve(), pathlib.Path(receipt).resolve()
assert build.is_relative_to(wt) and receipt.is_relative_to(spec)
app = wt / 'apps/weltraum-browser'
paths = list((app/'src').rglob('*')) + list((app/'public').rglob('*')) + list((spec/'probes').glob('*'))
paths += [app/n for n in ('package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts')]
paths = sorted({p for p in paths if p.is_file() and 'node_modules' not in p.parts})
def entry(p, root):
    assert not p.is_symlink()
    return {'path': p.relative_to(root).as_posix(), 'bytes': p.stat().st_size,
            'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
source = [entry(p, wt) for p in paths]
built = [entry(p, build) for p in sorted(build.rglob('*')) if p.is_file()]
assert any(p['path']=='index.html' for p in built) and any('physicsWorker-' in p['path'] for p in built)
state = {'source':source, 'built':built, 'serving':'Vite preview actual production bytes',
         'variants':'one identical built bundle; explicit fresh reference/direct session selections'}
if action == 'freeze':
    assert not receipt.exists(), 'Receipt overwrite refused'
    frozen = receipt.parent / (receipt.stem+'-source')
    assert not frozen.exists(), 'Source overwrite refused'
    for p in paths:
        dest = frozen/p.relative_to(wt); dest.parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(p,dest)
    receipt.parent.mkdir(parents=True, exist_ok=True)
    with receipt.open('x', encoding='utf-8') as f: json.dump(state,f,indent=2)
    print(json.dumps({'status':'BOUND','sourceFiles':len(source),'builtFiles':len(built),
                      'sourceHash':hashlib.sha256(json.dumps(source,sort_keys=True).encode()).hexdigest(),
                      'builtHash':hashlib.sha256(json.dumps(built,sort_keys=True).encode()).hexdigest()}))
else:
    assert action == 'verify' and json.loads(receipt.read_text(encoding='utf-8')) == state, 'Measured Source/build changed'
    print(json.dumps({'status':'UNCHANGED','sourceFiles':len(source),'builtFiles':len(built)}))
