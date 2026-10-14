import collections, hashlib, json, pathlib, sys
root=pathlib.Path(sys.argv[1])
reports=[]
for path in sorted(root.glob('*.cpuprofile')):
    raw=path.read_bytes();p=json.loads(raw);nodes={n['id']:n for n in p['nodes']};parents={c:n['id'] for n in p['nodes'] for c in n.get('children',[])}
    self_time=collections.Counter();inclusive=collections.Counter();canonical_callers=collections.Counter();disjoint=collections.Counter();validation_callers=collections.Counter()
    names=['serializeCanonicalJson','canonicalize','assertMaterialSnapshots','assertFactoryBeltState','advanceFactoryBelt','prepareDryFactoryStep','commitDryFactoryStep','inputBytes','proposalBytes','poweredBandFixture','createResourceContainerSnapshot']
    for sample,weight in zip(p.get('samples',[]),p.get('timeDeltas',[])):
        node=nodes[sample];f=node['callFrame'];self_time[(f.get('functionName',''),f.get('url',''),f.get('lineNumber',-1))]+=weight
        stack=[];q=sample
        while q in nodes:
            stack.append(nodes[q]['callFrame']);q=parents.get(q)
        functions={f.get('functionName','') for f in stack}
        for name in names:
            if name in functions:inclusive[name]+=weight
        if 'assertMaterialSnapshots' in functions:
            start=next(i for i,f in enumerate(stack) if f.get('functionName')=='assertMaterialSnapshots')
            caller=next((f for f in stack[start+1:] if '/src/factory/' in f.get('url','') and f.get('functionName')),None)
            key=(caller.get('functionName',''),caller.get('url','')) if caller else ('no Factory caller','')
            validation_callers[key]+=weight
        canonical=bool(functions.intersection({'serializeCanonicalJson','canonicalize'}))
        if canonical:
            caller=next((f for f in stack if '/src/factory/' in f.get('url','')),None)
            key=(caller.get('functionName',''),caller.get('url','')) if caller else ('no Factory ancestor','')
            canonical_callers[key]+=weight
        leaf_app=next((f for f in stack if '/src/' in f.get('url','')),None)
        disjoint[leaf_app.get('url','').split('/src/')[-1] if leaf_app else 'runner/native/idle/other']+=weight
    total=sum(p.get('timeDeltas',[]))
    report={'path':path.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'wallSpanSeconds':(p['endTime']-p['startTime'])/1e6,'sampledSeconds':total/1e6,'sampleCount':len(p.get('samples',[])),
      'topSelf':[{'function':k[0],'url':k[1],'line':k[2]+1,'seconds':v/1e6,'sampleSharePercent':100*v/total} for k,v in self_time.most_common(20)],
      'inclusiveSelectedFunctions':{k:v/1e6 for k,v in inclusive.items()},
      'canonicalSamplesByNearestFactoryCaller':[{'function':k[0],'url':k[1],'seconds':v/1e6} for k,v in canonical_callers.most_common(15)],
      'materialValidationSamplesByNearestFactoryCaller':[{'function':k[0],'url':k[1],'seconds':v/1e6} for k,v in validation_callers.most_common(15)],
      'disjointNearestSourceBuckets':{k:v/1e6 for k,v in disjoint.most_common()},
      'method':'V8 sample timeDeltas weighted in microseconds. Self values are disjoint. Inclusive function values overlap and MUST NOT be added. Each canonical sample assigned once to nearest Factory ancestor. Separate processes are never added.'}
    reports.append(report)
(root/'v8-profile-attribution.json').write_text(json.dumps(reports,indent=2)+'\n')
for r in reports:print(json.dumps({'path':r['path'],'sampledSeconds':r['sampledSeconds'],'topSelf':r['topSelf'][:8],'inclusiveSelectedFunctions':r['inclusiveSelectedFunctions'],'canonicalSamplesByNearestFactoryCaller':r['canonicalSamplesByNearestFactoryCaller'][:6],'materialValidationSamplesByNearestFactoryCaller':r['materialValidationSamplesByNearestFactoryCaller']}))
