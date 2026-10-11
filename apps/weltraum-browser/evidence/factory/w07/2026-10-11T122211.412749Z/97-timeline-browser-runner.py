from pathlib import Path
import subprocess,time,datetime,hashlib,json,gzip,re,sys,shutil,os
app=Path.cwd();wt=app.parent.parent;run=app/'evidence/factory/w07/2026-10-11T122211.412749Z';folder=run/'browser-timeline-diagnostic-97';folder.mkdir();backup=run/'97-fixed-output-originals';backup.mkdir();h=lambda b:hashlib.sha256(b).hexdigest()
seal=json.loads(Path('/workspace/.cloud-setup/fp06-w07-timeline-overlay-final-files.json').read_text());baselinePath=Path('/workspace/.cloud-setup/fp06-w07-cdp-trusted-driver-product-files.json');baseline=json.loads(baselinePath.read_text());
for f in seal['productFiles']:assert h((wt/f['path']).read_bytes())==f['sha256'],f['path']
prior=json.loads((run/'90-passive-diagnostic-artifact-receipt.json').read_text())
for f in prior['artifacts']:
 b=(run/f['path']).read_bytes();assert h(b)==f['sha256'] and len(b)==f['bytes']
fixed=['browser-native-walk-taps.json','browser-cargo-open-native-walk.json','browser-ghost-cancel.json','paid-native-cutter.png','browser-paid-cutter.json','browser-second-cutter-depletion.json','browser-native-disposal.json','diagnostic-render-wall-95-ready.json','diagnostic-render-wall-95-neutral.json','diagnostic-render-wall-95-125.json','diagnostic-render-wall-95-metadata.json','diagnostic-timeline-95-trace.json','diagnostic-timeline-95-metadata.json']
origins=[]
for name in fixed:
 p=run/name;b=p.read_bytes() if p.exists() else None;origins.append({'path':name,'existed':b is not None,'sha256':h(b) if b is not None else None,'bytes':len(b) if b is not None else None})
 if b is not None:(backup/name).write_bytes(b)
normal=(run/'95-normal-e2e-original.spec.ts.txt').read_bytes();assert h(normal)=='030fc301147af6a45da6412847368e6c7d5243b70811018e53883b83210ef605'
(run/'97-before-main-cpu-diagnostic-admission.json').write_text(json.dumps({'overlayAll30Match':True,'overlaySealSha256':h(Path('/workspace/.cloud-setup/fp06-w07-timeline-overlay-final-files.json').read_bytes()),'verified90Artifacts':len(prior['artifacts']),'normalArchiveSha256':h(normal),'fixedWriterOrigins':origins},indent=2)+'\n')
config=Path('/workspace/.cloud-setup/fp06-w07.playwright.config.mts');assert h(config.read_bytes())=='53a55a48da97d43a02e317fb8edc844d57a9b5687f356a7ebf4f5b470efcf900'
argv=['npm','run','test:e2e','--','--config='+str(config),'tests/e2e/factory-placement.spec.ts'];env=os.environ.copy();env.update({'FP06_E2E_RUN_DIR':str(folder),'WELTRAUM_FACTORY_EVIDENCE_RUN':run.name,'WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH':'/usr/bin/chromium'});start=datetime.datetime.now(datetime.timezone.utc).isoformat();clock=time.monotonic();raw=bytearray();code=None
print('ACTUAL_BROWSER97_START '+start,flush=True)
try:
 p=subprocess.Popen(argv,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env=env)
 while True:
  data=p.stdout.readline()
  if not data:break
  raw.extend(data);sys.stdout.buffer.write(data);sys.stdout.buffer.flush()
 code=p.wait()
finally:
 end=datetime.datetime.now(datetime.timezone.utc).isoformat();duration=time.monotonic()-clock;b=bytes(raw);label='97-timeline-browser-diagnostic'
 (run/(label+'.raw.log.gz')).write_bytes(gzip.compress(b,mtime=0));(run/(label+'.log')).write_bytes(re.sub(rb'\x1b\[[0-9;]*m',b'',b));(run/(label+'.exit.txt')).write_text(str(code)+'\n')
 receipt={'kind':'DIAGNOSTIC_ONLY_TIMELINE_NOT_GAMEPLAY_GATE','argv':argv,'cwd':str(app),'env':{k:env[k] for k in ['FP06_E2E_RUN_DIR','WELTRAUM_FACTORY_EVIDENCE_RUN','WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH']},'startUtc':start,'endUtc':end,'wrapperSeconds':duration,'exitCode':code,'rawBytes':len(b),'rawSha256':h(b),'configSha256':h(config.read_bytes()),'overlaySealSha256':h(Path('/workspace/.cloud-setup/fp06-w07-timeline-overlay-final-files.json').read_bytes()),'timelineScope':'Original Chrome devtools.timeline with same wall/DOM/passive observation; no hardware attribution'}
 (run/(label+'-command.json')).write_text(json.dumps(receipt,indent=2)+'\n')
 fresh=[]
 for item in origins:
  src=run/item['path']
  if src.exists() and (not item['existed'] or h(src.read_bytes())!=item['sha256']):shutil.copyfile(src,folder/src.name);fresh.append(item['path'])
 artifacts=[]
 for src in sorted(folder.rglob('*')):
  if src.is_file():bb=src.read_bytes();artifacts.append({'path':str(src.relative_to(run)),'sha256':h(bb),'bytes':len(bb)})
 (run/'97-timeline-artifact-receipt.json').write_text(json.dumps({'kind':'DIAGNOSTIC_ONLY','actualFreshFixedOutputs':fresh,'artifacts':artifacts},indent=2)+'\n')
 for item in origins:
  dest=run/item['path']
  if item['existed']:dest.write_bytes((backup/item['path']).read_bytes());assert h(dest.read_bytes())==item['sha256']
  elif dest.exists():dest.unlink()
 (app/'tests/e2e/factory-placement.spec.ts').write_bytes(normal)
 restored=[]
 for f in baseline['productFiles']:
  bb=(wt/f['path']).read_bytes();match=h(bb)==f['sha256'];restored.append({'path':f['path'],'sha256':h(bb),'bytes':len(bb),'matchesBaseline':match})
 assert all(f['matchesBaseline'] for f in restored)
 port=subprocess.run(['ss','-ltnp','sport = :5174'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 (run/'97-after-main-cpu-diagnostic-full-restore-port-receipt.json').write_text(json.dumps({'timestampUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baselineSealSha256':h(baselinePath.read_bytes()),'all30ProductHashesMatch':True,'normalE2eSha256':h(normal),'fixedOriginalOrAbsentStatesRestored':True,'productFiles':restored,'portExitCode':port.returncode,'portOutput':port.stdout.decode(),'cpuGpuPortLease':'RELEASED_AFTER_ACTUAL_CLI','diagnosticNotGate':True},indent=2)+'\n')
 print(json.dumps({**receipt,'artifacts':len(artifacts),'artifactBytes':sum(f['bytes'] for f in artifacts),'all30Restore':'MATCH','fixedOriginals':'RESTORED','cpuGpuPort':'RELEASED'}),flush=True)
sys.exit(code if code is not None else 1)
