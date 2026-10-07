"""Recalculate finite Cut cohorts from actual markers, including all failed attempts."""
import json, math, pathlib, statistics, sys
spec=pathlib.Path(__file__).resolve().parent
def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def stats(values):
    return {'n':len(values),'median':statistics.median(values),'min':min(values),'max':max(values),
            'p95NearestRank':sorted(values)[math.ceil(.95*len(values))-1],'atMost250':sum(v<=250 for v in values)}
def cohort(folder, variants, terrain=False):
    result={}
    for variant in variants:
        records=[read(spec/'tests'/folder/f'pair-{i}-{variant}-draw-on-repeat-0.json') for i in range(10)]
        assert all(r['failed'] is None and not r['errors'] for r in records)
        cuts={}
        for second in [False,True]:
            rows=[r['results'][int(second)] for r in records]
            times=[row['markers']['firstCommittedRenderSubmitMs']-row['markers']['inputMs'] for row in rows]
            assert all(row['markers']['outcome']=='Applied' and not row['markers']['problems'] for row in rows)
            name=('warmTerrain' if second else 'coldTerrain') if terrain else ('moving' if second else 'coldTerrain')
            spans={}
            for phase in ['cutSupportAnalyzeMs','cutCompileMs','cutNativePrepareMs','cutGraphicsStageMs','cutBodyOwnerPlanMs','cutBodyMeshWorkerMs','cutBodyNativeAdmitMs','cutBodyMainDecodeMs','cutBodyGraphicsStageMs']:
                values=[]
                for row in rows:
                    command=row['markers']['renderBinding']['commandId']
                    matched=[e['duration'] for e in row['raw']['entries'] if e['name']=='hvp.'+phase and e.get('detail',{}).get('data',{}).get('commandId')==command]
                    if matched: values.append(sum(matched))
                if values: spans[phase]=stats(values)
            cuts[name]={'inputToRenderMs':stats(times),'rawTimes':times,'spansOverlappingDoNotSum':spans,
                        'mainSupportQuantumMaxMs':max((row.get('kernelFacts',{}).get('kernelFacts') or {}).get('maxQuantumMs',0) for row in rows),
                        'logicalCpuPeak':max(row[side]['resources']['totalCpuBytes'] for row in rows for side in ['before','after'])}
        plans=[r.get('ownerPlans',[])[0] for r in records if r.get('ownerPlans')]
        if plans:
            labels=sorted({p['label'] for plan in plans for p in plan['phases']})
            cuts['ownerPlanWorkWall']={label:stats([sum(p['totalMs'] for p in plan['phases'] if p['label']==label) for plan in plans]) for label in labels}
            cuts['explicitYieldWaitWall']=stats([p['timing']['taskWaitMs'] for p in plans])
        result[variant]=cuts
    return result
failed=[]
for path in sorted((spec/'tests').glob('*/pair-*.json')):
    r=read(path)
    if r.get('failed'):
        failed.append({'path':path.relative_to(spec).as_posix(),'failed':r['failed'],'completedCuts':len(r['results']),'errors':r['errors']})
result={'classification':'finite production pilot; not 14-population/p95 qualification',
        'A':cohort('A-native-r02',['reference','direct']),
        'BFinal':cohort(sys.argv[1],['direct','owned-moving']),
        'CFinal':cohort(sys.argv[2],['owned-moving','owned-terrain'],True),
        'allFailedBrowserAttempts':failed,
        'gc':'Historical 667.8ms Owner outlier not reproduced/independently attributed; work-wall includes scheduling/GC during execution.',
        'sourceAndBuildBinding':'See final-r02-binding.json; exact frozen Source and actual built bytes retained.',
        'originalGoal':'PAUSED_INCOMPLETE','formal42':False,'formal1400':False,'productAdoption':False}
out=spec/'RESULTS.json'
assert not out.exists(),'Result overwrite refused'
out.write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({gate:{variant:{case:data['inputToRenderMs'] for case,data in rows.items() if 'inputToRenderMs' in data}
                       for variant,rows in result[gate].items()} for gate in ['A','BFinal','CFinal']},indent=2))
