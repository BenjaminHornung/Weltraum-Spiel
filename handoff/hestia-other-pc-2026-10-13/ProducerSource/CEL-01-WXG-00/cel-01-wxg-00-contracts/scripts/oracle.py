"""Independent lexical JSON canonicalization/profile/read oracle; no JS imports."""
import hashlib, json, pathlib, sys
class Number(str):
    pass
def load(path):
    return json.loads(path.read_text(encoding='utf-8'), parse_int=Number, parse_float=Number)
def canonical(v):
    if isinstance(v, Number):
        return '0' if v in ('-0', '-0.0') else str(v)
    if v is None or isinstance(v, (str, bool)):
        return json.dumps(v, ensure_ascii=False, separators=(',', ':'))
    if isinstance(v, list):
        return '[' + ','.join(canonical(x) for x in v) + ']'
    return '{' + ','.join(json.dumps(k, ensure_ascii=False)+':'+canonical(v[k]) for k in sorted(v)) + '}'
def digest(v):
    return 'sha256:'+hashlib.sha256(canonical(v).encode('utf-8')).hexdigest()
root=pathlib.Path(__file__).resolve().parent.parent
profiles=load(root/'fixtures/profiles.json')
reads=load(root/'fixtures/read-goldens-input.json')
states=['Unsupported','NoAtmosphere','Known','Unsupported','Known','Known']
rows=[]
for f,r,state in zip(profiles,reads,states,strict=True):
    refs={}
    for kind in ('physics','optics','profile'):
        p=dict(f[kind]);actual=p.pop('digest');expected=digest(p)
        assert actual==expected, (f['name'],kind)
        refs[kind]=expected
    assert r['status']==state
    if state=='NoAtmosphere':
        assert r['precipitation']==[] and 'sample' not in r
    if f['name']=='Hestia':
        assert f['physics']['gasMixture'] is None and f['physics']['thermodynamics'] is None
        assert r['reasonCode']=='MISSING_GAS_MIXTURE'
    if f['name']=='Methane':
        assert f['physics']['condensibleSpecies'][0]['saturation'] is None
        assert r['reasonCode']=='SATURATION_UNDEFINED'
    if state=='Known':
        assert r['sample']['temperatureK']==Number('280')
        assert r['sample']['windBodyFixedMps']=={'x':Number('0'),'y':Number('3'),'z':Number('0')}
        assert r['sample']['precipitation']==[] and r['sample']['stormIds']==[]
    payload=dict(r);actual=payload.pop('WeatherSnapshotId');assert actual==digest(payload)
    rows.append({'name':f['name'],'status':state,'profileDigests':refs,'WeatherSnapshotId':actual})
vectors=[{'input':{'z':Number('-0'),'a':Number('1')},'bytes':'{"a":1,"z":0}'},
         {'input':{'b':['é',True,None],'a':Number('120')},'bytes':'{"a":120,"b":["é",true,null]}'}]
for v in vectors:
    assert canonical(v['input'])==v['bytes']
    v['digest']='sha256:'+hashlib.sha256(v['bytes'].encode()).hexdigest()
output={'oracle':'Python 3.12 lexical JSON AST and independent SHA256; exact authored diagnostics, no meteorological oracle','rows':rows,'canonicalVectors':vectors}
path=root/'fixtures/schema-goldens.json'
if '--check' in sys.argv:
    assert json.loads(path.read_text(encoding='utf-8'))==json.loads(json.dumps(output))
else:
    with path.open('x',encoding='utf-8',newline='\n') as handle:json.dump(output,handle,ensure_ascii=False,indent=2);handle.write('\n')
print(json.dumps({'status':'PASS','profiles':len(rows),'canonicalVectors':len(vectors)}))
