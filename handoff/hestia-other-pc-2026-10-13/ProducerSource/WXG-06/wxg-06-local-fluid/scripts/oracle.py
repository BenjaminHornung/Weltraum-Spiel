"""Independent scalar and MAC-flux oracle on emitted actual fields, not TS helpers."""
import json, math, sys
from pathlib import Path

run_id = sys.argv[sys.argv.index('--run-id') + 1]
if not run_id or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-' for c in run_id):
    raise ValueError('RUN_ID')
root = Path(__file__).resolve().parents[1]
run = root.parents[1] / '.devtoolbox/specs/changes/wxg-06-2026-10-09/tests' / run_id / 'runtime'
data = json.loads((run / 'fields.json').read_text())
assert data['w1Before'] == data['w1After']
checks = []
for rec in data['records']:
    c, initial, final = rec['config'], rec['initial'], rec['first']
    n, h, mask = c['grid'], c['cellMeters'], c['obstacle']['coverage']
    assert n == 32 and len(mask) == n ** 3
    index = lambda i, j, k: i + n * (j + n * k)
    def face(a, p):
        return p[a] + (n + 1) * (p[(a + 1) % 3] + n * p[(a + 2) % 3])
    def divergence(vel):
        squares = []
        for k in range(n):
            for j in range(n):
                for i in range(n):
                    if mask[index(i,j,k)]:
                        continue
                    p, value = [i,j,k], 0.0
                    for a in range(3):
                        right = p.copy(); right[a] += 1
                        value += (vel[a][face(a,right)] - vel[a][face(a,p)]) / h
                    squares.append(value ** 2)
        return math.sqrt(math.fsum(squares) / len(squares))
    for snap in (initial, final, rec['final']):
        assert len(snap['density']) == n ** 3
        assert all(math.isfinite(x) and 0 <= x <= 1 for x in snap['density'])
        assert all(math.isfinite(x) and 150 <= x <= 1000 for x in snap['temperature'])
        assert all(snap['density'][i] == 0 for i, state in enumerate(mask) if state != 0)
        assert snap['w1SnapshotId'] == c['background']['snapshotId']
    m = final['metrics']
    before = math.fsum(initial['density']) * h ** 3
    after = math.fsum(final['density']) * h ** 3
    source = rec['signal']['tracerKgPerSecond'] / 120
    error = after - before - source - m['boundaryKg'] - m['decayKg']
    assert abs(error) <= 1e-8 + 1e-10 * abs(before), (rec['fixture'], 'BALANCE', error)
    # Enclosed fixture source never touches the far boundary: constant inflow/outflow cancels.
    assert abs(m['boundaryKg']) < 1e-8
    excess_t = math.fsum(t - c['background']['temperatureK'] for t in final['temperature'])
    assert abs(excess_t - rec['signal']['heatKPerSecond']/120 * math.exp(-c['decayPerSecond']/120)) < 1e-7
    values = {'fixture':rec['fixture'], 'mode':rec['mode'], 'balanceErrorKg':error}
    if rec['mode'] == 'F2':
        old, new = divergence(final['projectionInputVelocity']), divergence(final['velocity'])
        assert abs(old - m['divergenceBefore']) < 1e-10
        assert abs(new - m['divergenceAfter']) < 1e-10
        assert new <= old * 0.1 + 1e-8
        for k in range(n):
            for j in range(n):
                for i in range(n):
                    p = [i,j,k]
                    if mask[index(i,j,k)] == 0:
                        continue
                    for a in range(3):
                        right = p.copy(); right[a] += 1
                        assert final['velocity'][a][face(a,p)] == 0
                        assert final['velocity'][a][face(a,right)] == 0
        values.update(divergenceBefore=old, divergenceAfter=new, ratio=new/old if old else None)
    assert rec['eviction']['allocatedBytes'] == 0
    assert rec['origin']['beforeFieldHash'] == rec['origin']['afterFieldHash']
    checks.append(values)
payload = {'status':'PASS','checks':checks,'independentLanguage':'Python stdlib','profile':'PREDECLARED','hardware':'NOT_RUN'}
(run / 'oracle.json').write_text(json.dumps(payload, indent=2) + '\n')
print(json.dumps(payload))
