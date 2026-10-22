(async(page)=>{
  const host=page.context().browser(), previous=host.__fp06R87;
  if(!previous||host.__fp06PerfV6?.runs.length)throw Error('Preserve existing completed measurements');
  const stored=await previous.slot();
  if(stored.payloadSha256!=='a2eccec1b71b982b45f069fbfde282c04aa8533d060191bc133672dc8121ecc0')throw Error('Preserve original Save19');
  const p=await previous.context.newPage();
  await previous.p.close();
  await p.bringToFront();
  const blankRaf=await p.evaluate(()=>new Promise(resolve=>{const start=performance.now(),timestamps=[];const next=t=>{timestamps.push(t);if(performance.now()-start<5000)requestAnimationFrame(next);else resolve({start,end:performance.now(),timestamps,visibility:document.visibilityState,focused:document.hasFocus(),viewport:[innerWidth,innerHeight,devicePixelRatio]});};requestAnimationFrame(next);}));
  await p.addInitScript(()=>{
    const b=window.__fp06V6Perf={collecting:false,start:0,end:0,samples:[],raf:[],longtasks:[],drops:0,input:{count:0,x:0,y:0,max:0}};
    const measures=entries=>{if(!b.collecting)return;for(const e of entries){
      if(!(e.name.startsWith('hvp.factory')||['hvp.frameIntervalMs','hvp.mainFrameCpuMs','hvp.solverStepCpuMs','hvp.resources'].includes(e.name))||e.startTime<b.start||e.startTime+e.duration>b.end)continue;
      if(b.samples.length>=100000){b.drops++;continue;}b.samples.push({name:e.name,start:e.startTime,duration:e.duration,detail:e.detail});
    }};
    const observer=new PerformanceObserver(list=>measures(list.getEntries()));
    observer.observe({type:'measure'});
    const receiveLongtasks=entries=>{if(!b.collecting)return;for(const e of entries){
      if(e.startTime<b.start||e.startTime+e.duration>b.end)continue;if(b.longtasks.length>=2000){b.drops++;continue;}b.longtasks.push({start:e.startTime,duration:e.duration});
    }};
    const longtasks=new PerformanceObserver(list=>receiveLongtasks(list.getEntries()));
    longtasks.observe({type:'longtask'});
    b.flush=()=>{measures(observer.takeRecords());receiveLongtasks(longtasks.takeRecords());};
    const frame=t=>{if(b.collecting){if(b.raf.length<100000)b.raf.push(t);else b.drops++;}requestAnimationFrame(frame);};requestAnimationFrame(frame);
    addEventListener('mousemove',e=>{if(!b.collecting||!document.pointerLockElement)return;b.input.count++;b.input.x+=e.movementX;b.input.y+=e.movementY;b.input.max=Math.max(b.input.max,Math.abs(e.movementX),Math.abs(e.movementY));},true);
  });
  const s=host.__fp06PerfV6={p,context:previous.context,profile:previous.profile,original:previous,events:[],runs:[],errors:[],blankRaf,originalSlot:stored};
  p.on('pageerror',e=>s.errors.push(e.message));
  s.slot=()=>p.evaluate(async()=>{
    const name='weltraum-hestia-factory-v1';
    if(!(await indexedDB.databases()).some(d=>d.name===name))throw Error('No existing Factory database');
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onupgradeneeded=()=>{r.transaction.abort();reject(Error('Read cannot create/upgrade database'));};});
    const record=await new Promise((resolve,reject)=>{const tx=db.transaction('saveSlots','readonly'),r=tx.objectStore('saveSlots').get('factory-primary');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();});
    if(!record)throw Error('Missing existing slot');
    const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
    return {metadata:record.metadata,payloadSha256:await digest(record.payloadBytes)};
  });
  s.read=()=>p.evaluate(()=>{
    const j=k=>{const v=document.body.dataset[k];return v?JSON.parse(v):null;},n=j('hestiaPrototypePhysics'),u=j('hestiaFactoryUi'),c=j('hestiaFactoryConstruction');
    return {at:performance.now(),status:n?.status,tick:n?.ticks,player:n?.player?.position,camera:j('hestiaPrototypePlayerCamera'),input:j('hestiaPrototypeInput'),transport:j('hestiaFactoryInputTransport'),clock:j('hestiaPrototypePhysicsClock'),factorySteps:u?.factorySteps,epoch:u?.host?.epoch,confirmed:u?.host?.confirmed,sourceDigest:u?.host?.terrain?.sourceDigest,profile:u?.host?.terrain?.profileVersion,owners:n?.factoryFacilities?.owners?.length,massMg:c?.massMg,physicsBodies:n?.bodyCount,physicsColliders:n?.colliderCount,measurementHealth:j('hestiaPrototypeMeasurements'),render:j('hestiaPrototypeOwnedRender'),persistence:u?.host?.persistence,visibility:document.visibilityState,focused:document.hasFocus(),viewport:[innerWidth,innerHeight,devicePixelRatio],testBridge:'TestBridge' in window};
  });
  s.pause=async()=>{const r=await s.read();if(r.status==='Running')await p.keyboard.press('Escape');await p.waitForFunction(()=>JSON.parse(document.body.dataset.hestiaPrototypePhysics||'null')?.status==='Paused',null,{timeout:5000});return s.read();};
  s.play=async()=>{await p.bringToFront();await p.getByRole('button',{name:'Play',exact:true}).click();await p.waitForFunction(()=>JSON.parse(document.body.dataset.hestiaPrototypePhysics||'null')?.status==='Running'&&document.pointerLockElement?.id==='debug-scene',null,{timeout:5000});return s.read();};
  s.reload=async measured=>{const before=await s.slot();if(before.payloadSha256!=='a2eccec1b71b982b45f069fbfde282c04aa8533d060191bc133672dc8121ecc0')throw Error('Preserve original Save19');await p.goto('http://127.0.0.1:5197/factory.html?factoryLoad=primary'+(measured?'&hvpMeasure=1':''));await p.waitForFunction(()=>JSON.parse(document.body.dataset.hestiaPrototypePhysics||'null')?.status==='Paused'&&JSON.parse(document.body.dataset.hestiaFactoryUi||'null')?.host?.confirmed,null,{timeout:30000});const r=await s.read();if(r.tick!==48547||r.owners!==10||r.massMg!==2984400000||r.testBridge)throw Error('Saved baseline mismatch');return r;};
  s.collect=async(label,milliseconds=30000)=>{
    if(milliseconds!==30000)throw Error('Frozen 30-second comparison window');
    const start=await s.read();if(!['Paused','Running'].includes(start.status)||start.testBridge)throw Error('No valid baseline state');
    await p.evaluate(()=>{const b=window.__fp06V6Perf;b.samples=[];b.raf=[];b.longtasks=[];b.drops=0;b.input={count:0,x:0,y:0,max:0};b.start=performance.now();b.end=Infinity;b.collecting=true;});
    await p.waitForTimeout(milliseconds);
    const raw=await p.evaluate(()=>{const b=window.__fp06V6Perf;b.end=performance.now();b.flush();b.collecting=false;return {start:b.start,end:b.end,samples:b.samples,raf:b.raf,longtasks:b.longtasks,drops:b.drops,input:b.input};});
    const end=await s.read();const run={label,atUtc:new Date().toISOString(),start,end,raw,errors:[...s.errors]};s.runs.push(run);return run;
  };
  await p.goto('http://127.0.0.1:5197/factory.html?factoryLoad=primary&hvpMeasure=1');
  await p.waitForFunction(()=>JSON.parse(document.body.dataset.hestiaPrototypePhysics||'null')?.status==='Paused'&&JSON.parse(document.body.dataset.hestiaFactoryUi||'null')?.host?.confirmed,null,{timeout:30000});
  const initial=await s.read(),slot=await s.slot();
  if(initial.tick!==48547||initial.owners!==10||initial.massMg!==2984400000||slot.payloadSha256!==stored.payloadSha256)throw Error('Initial saved scene mismatch');
  return {registered:true,profile:s.profile,url:p.url(),blankRaf,initial,slot,noGameplaySampleOrProfileStarted:true};
})
