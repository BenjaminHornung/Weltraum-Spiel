"""Independent arithmetic/geometric oracles; no calls into JS implementation."""
import json, math
from decimal import Decimal, getcontext
from pathlib import Path
getcontext().prec = 50
root = Path(__file__).resolve().parents[1]
gold = json.loads((root/'fixtures/climate-weather-goldens.json').read_text(encoding='utf-8'))
config = gold['config']
d = lambda x: Decimal(str(x))
mean = d(config['referenceTemperatureK']) + (d(config['solarFluxWPerM2'])*(1-d('0.3'))/4-d(config['longwaveAtReferenceWPerM2']))/d(config['feedbackWPerM2K'])
amplitude = d(config['p2ForcingWPerM2'])/(d(config['feedbackWPerM2K'])+6*d(config['diffusionWPerM2K']))
expected = ['Unsupported', 'NoAtmosphere', 'Known', 'Unsupported', 'Known', 'Known', 'Known']
for i, row in enumerate(gold['rows']):
    climate = row['climate']
    assert climate['status'] == expected[i], row['name']
    if climate['status'] == 'Known':
        assert abs(d(climate['meanTemperatureK'])-mean) < d('1e-12')
        assert abs(d(climate['p2AmplitudeK'])-amplitude) < d('1e-12')
    for result in row['samples']:
        assert result['status'] == expected[i]
        if result['status'] != 'Known':
            assert 'sample' not in result
            continue
        sample = result['sample']
        assert sample['temperatureK'] > 0 and sample['pressurePa'] > 0
        assert sample['condensates'] == [] and sample['precipitation'] == []
        assert all(0 <= a['massMixingRatio'] <= 1 for a in sample['aerosols'])
        assert all(math.isfinite(v) for v in sample['windBodyFixedMps'].values())
        if row['name'] == 'GasGiant':
            assert result['query']['vertical']['kind'] == 'PressurePa'
            assert sample['pressurePa'] == result['query']['vertical']['pressurePa']
    for obj in row['objects']:
        assert obj['bornTick'] <= 3*7200000 < obj['bornTick'] + obj['lifetimeTicks']
        assert 0 <= obj['envelopeQ16'] <= 65536
        assert abs(sum(v*v for v in obj['centerBodyFixed'].values())-1) < 1e-12
geometry = json.loads((root/'fixtures/geometry-goldens.json').read_text(encoding='utf-8'))['geometry']
axes = {'px': ((1,0,0),(0,0,-1),(0,1,0)), 'nx': ((-1,0,0),(0,0,1),(0,1,0)),
        'py': ((0,1,0),(1,0,0),(0,0,-1)), 'ny': ((0,-1,0),(1,0,0),(0,0,1)),
        'pz': ((0,0,1),(1,0,0),(0,1,0)), 'nz': ((0,0,-1),(-1,0,0),(0,1,0))}
for row in geometry:
    normal, u_axis, v_axis = axes[row['face']]
    res = 2**row['level']; u = -1 + (2*row['x']+1)/res; v = -1 + (2*row['y']+1)/res
    point = [normal[i] + u*u_axis[i] + v*v_axis[i] for i in range(3)]
    length = math.sqrt(sum(x*x for x in point))
    for i, name in enumerate(('x','y','z')):
        assert abs(row['n'][name]-point[i]/length) < 1e-12
    # Independent spherical polygon area from two spherical triangles (L'Huilier).
    corners = []
    for cu, cv in ((-1+2*row['x']/res,-1+2*row['y']/res),(-1+2*(row['x']+1)/res,-1+2*row['y']/res),(-1+2*(row['x']+1)/res,-1+2*(row['y']+1)/res),(-1+2*row['x']/res,-1+2*(row['y']+1)/res)):
        p = [normal[i]+cu*u_axis[i]+cv*v_axis[i] for i in range(3)]; norm = math.sqrt(sum(x*x for x in p)); corners.append([x/norm for x in p])
    area = 0
    for inds in ((0,1,2),(0,2,3)):
        p,q,r = [corners[i] for i in inds]
        sides = [math.acos(max(-1,min(1,sum(a*b for a,b in zip(x,y))))) for x,y in ((p,q),(q,r),(r,p))]
        sem = sum(sides)/2
        area += 4*math.atan(math.sqrt(math.tan(sem/2)*math.prod(math.tan((sem-a)/2) for a in sides)))
    assert abs(row['areaM2']-area) < 1e-12
projection = json.loads((root/'fixtures/macro-projection.json').read_text(encoding='utf-8'))
cells = projection['cells']; assert len(cells) == 384
assert len({tuple(c['address'][k] for k in ('face','level','x','y')) for c in cells}) == 384
radius = 8282000
assert abs(sum(c['areaM2'] for c in cells)/(4*math.pi*radius*radius)-1) < 1e-12
print(json.dumps({'status':'PASS','oracle':'Python Decimal EBM + independent spherical-triangle area + six original states + synthetic authoring limits','profiles':7,'geometryFaces':6,'projectionCells':384,'naturalClimateValidation':'NOT_RUN'}))
