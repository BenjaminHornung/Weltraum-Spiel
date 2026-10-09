"""Shared bounded pilot reader; historical Source-Gates output stays immutable."""
import argparse,json,math,pathlib,statistics

PHASES=('cutSupportAnalyzeMs','cutCompileMs','cutNativePrepareMs','cutGraphicsStageMs',
        'cutBodyOwnerPlanMs','cutBodyMeshWorkerMs','cutBodyNativeAdmissionMs',
        'cutBodyMainDecodeMs','cutBodyRenderStageMs','cutNativeInputCopyMs','cutNativeCollisionValidationMs',
        'cutNativeCellValidationMs','cutNativeFragmentSourceMs','cutNativeFragmentAdmissionMs')
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def number(value):return type(value) in (int,float) and math.isfinite(value)
def stats(values,target=250):
    if not values:return None
    return {'n':len(values),'median':statistics.median(values),'min':min(values),'max':max(values),
            'p95NearestRank':sorted(values)[math.ceil(.95*len(values))-1],
            'atMostTarget':sum(v<=target for v in values),'targetMs':target,'values':values}
def phase_values(row,phase):
    command=row.get('commandId') or row.get('markers',{}).get('renderBinding',{}).get('commandId')
    if command is None:return None
    values=[e.get('duration') for e in row.get('raw',{}).get('entries',[])
            if e.get('name')=='hvp.'+phase and e.get('detail',{}).get('data',{}).get('commandId')==command]
    return sum(values) if values and all(number(v) and v>=0 for v in values) else None
def cut_sample(row):
    m=row.get('markers',row.get('sample') or {})
    if any(not number(m.get(k)) for k in ('inputMs','appliedMs','firstCommittedRenderSubmitMs')):
        return {'status':'MISSING','reason':'Required endpoint marker absent/nonfinite'}
    if m.get('outcome')!='Applied' or m.get('problems') or row.get('problems') or row.get('raw',{}).get('dropped',0) or not m['inputMs']<=m['appliedMs']<=m['firstCommittedRenderSubmitMs']:
        return {'status':'INVALID','reason':'Outcome/binding/order invalid'}
    return {'status':'VALID','inputToAppliedMs':m['appliedMs']-m['inputMs'],
            'inputToRenderMs':m['firstCommittedRenderSubmitMs']-m['inputMs']}
def cohort(folder,variants,pairs=10,terrain=False,target=250,d1=False,pair_prefix='d1'):
    if pair_prefix not in ('d1','d2','d3-d4'):raise ValueError('Unknown normal paired record prefix')
    if len(variants)!=2 or len(set(variants))!=2 or pairs<1:raise ValueError('Two distinct declared variants and positive pair count required')
    native_complete=True
    if d1:
        exit_path,report_path=folder/'NATIVE_EXIT.json',folder/'pw-report.json'
        native_complete=exit_path.exists() and report_path.exists()
        if native_complete:
            exit_receipt,report=read(exit_path),read(report_path)
            native_complete=exit_receipt.get('exitCode')==0 and report.get('stats',{}).get('expected')==pairs and report.get('stats',{}).get('unexpected')==0
    result={}
    for variant in variants:
        if not variant or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in variant):
            raise ValueError('Invalid declared variant')
        records=[]
        for i in range(pairs):
            path=folder/f'{pair_prefix}-pair-{i}'/f'{variant}.json' if d1 else folder/f'pair-{i}-{variant}-draw-on-repeat-0.json'
            if not path.exists():records.append(None);continue
            record=read(path)
            if (record.get('mode')!=variant if d1 else record.get('name')!=path.stem):raise ValueError('Record variant/run ID differs from declared filename')
            records.append(record)
        cuts={}
        for second in (0,1,2) if d1 else (False,True):
            rows=[];samples=[]
            for record in records:
                if record is None:samples.append({'status':'MISSING','reason':'Planned file absent'});continue
                if not native_complete or record.get('failed') or record.get('failure') or record.get('errors'):
                    samples.append({'status':'INVALID','reason':'Failed browser attempt retained'});continue
                values=record.get('results',[])
                if len(values)<=int(second):samples.append({'status':'MISSING','reason':'Planned Cut absent'});continue
                row=values[int(second)];sample=cut_sample(row);samples.append(sample)
                if sample['status']=='VALID':rows.append(row)
            phases={}
            for phase in PHASES:
                values=[phase_values(row,phase) for row in rows]
                phases[phase]={'status':'MEASURED' if values and all(v is not None for v in values) else 'MISSING',
                               'missing':sum(v is None for v in values),'stats':stats([v for v in values if v is not None],target)}
            name=('coldTerrain','moving','coldRecut')[second] if d1 else ('warmTerrain' if second else 'coldTerrain') if terrain else ('moving' if second else 'coldTerrain')
            valid=[s for s in samples if s['status']=='VALID']
            cuts[name]={'planned':pairs,'valid':len(valid),'invalid':sum(s['status']=='INVALID' for s in samples),
                        'missing':sum(s['status']=='MISSING' for s in samples),'samples':samples,
                        'inputToAppliedMs':stats([s['inputToAppliedMs'] for s in valid],target),
                        'inputToRenderMs':stats([s['inputToRenderMs'] for s in valid],target),
                        'overlappingWallPhasesDoNotSum':phases}
        result[variant]=cuts
    a,b=variants
    ratios={case:[result[b][case]['samples'][i]['inputToRenderMs']/result[a][case]['samples'][i]['inputToRenderMs']
                  if result[a][case]['samples'][i]['status']=='VALID' and result[b][case]['samples'][i]['status']=='VALID'
                  and result[a][case]['samples'][i]['inputToRenderMs']>0 else None for i in range(pairs)] for case in result[a]}
    readiness={variant:{metric:stats([entry['duration'] for i in range(pairs)
        for path in [folder/f'{pair_prefix}-pair-{i}'/f'{variant}.json'] if path.exists()
        for entry in (read(path).get('ready') or {}).get('entries',[]) if entry.get('name')=='hvp.'+metric],5000)
        for metric in ('coldSceneReadyV2Ms','toolReadyV2Ms','startupSourceMs','startupCoastMeshMs','startupCutPoolPrepareMs')} for variant in variants} if d1 else None
    navigation_readiness={variant:{field:stats([entry['duration'] for i in range(pairs)
        for path in [folder/f'{pair_prefix}-pair-{i}'/f'{variant}.json'] if path.exists()
        for entry in (read(path).get(field) or {}).get('entries',[]) if entry.get('name')=='hvp.'+metric],5000)
        for field,metric in (('ready','coldSceneReadyV2Ms'),('loadReady','loadSceneReadyV2Ms'),('coldLoadReady','coldSceneReadyV2Ms'))}
        for variant in variants} if d1 else None
    return {'classification':'DIAGNOSTIC_PILOT_NOT_QUALIFICATION','pairs':pairs,'variants':result,'nativeComplete':native_complete,'readiness':readiness,
            'navigationReadiness':navigation_readiness,
            'pairedCandidateControlRatio':ratios,'formal42':False,'formal1400':False,
            'note':'Missing phases stay Missing; timings are overlapping wall spans, not CPU or GPU duration.'}
def write_result(path,value):
    with path.open('x',encoding='utf-8') as out:json.dump(value,out,indent=2)
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--series',type=pathlib.Path,required=True)
    parser.add_argument('--variants',required=True);parser.add_argument('--pairs',type=int,default=10)
    parser.add_argument('--terrain',action='store_true');parser.add_argument('--d1',action='store_true');parser.add_argument('--pair-prefix',choices=('d1','d2','d3-d4'),default='d1');parser.add_argument('--target',type=float,default=250)
    parser.add_argument('--output',type=pathlib.Path,required=True);args=parser.parse_args()
    wt=pathlib.Path(__file__).resolve().parents[5]
    if not args.series.resolve().is_relative_to(wt) or not args.output.resolve().is_relative_to(wt):
        raise ValueError('Inputs/outputs must stay within this worktree')
    if args.output.exists():raise FileExistsError('Result overwrite refused')
    if not number(args.target) or args.target<=0:raise ValueError('Positive finite target required')
    value=cohort(args.series,args.variants.split(','),args.pairs,args.terrain,args.target,args.d1,args.pair_prefix)
    write_result(args.output,value)
    print(json.dumps({variant:{case:{'valid':v['valid'],'invalid':v['invalid'],'missing':v['missing'],
            'inputToRenderMs':v['inputToRenderMs']} for case,v in cuts.items()} for variant,cuts in value['variants'].items()}))
if __name__=='__main__':main()
